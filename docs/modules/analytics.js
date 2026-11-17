/**
 * Pure client-side ranking and statistical analytics engine.
 * Enables full interactive filtering/sorting on static hosting (GitHub Pages).
 */

export const VALID_SORT_MODES = new Set(["score", "sheet_rank"]);

function roundTo(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function quantile(sortedValues, q) {
  if (!sortedValues.length) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const pos = (sortedValues.length - 1) * q;
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  if (low === high) return sortedValues[low];
  const weight = pos - low;
  return sortedValues[low] * (1 - weight) + sortedValues[high] * weight;
}

export function computeDescriptiveStats(values) {
  const clean = (Array.isArray(values) ? values : [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));

  if (clean.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      std_dev: 0,
      min_value: 0,
      max_value: 0,
      q1: 0,
      q3: 0,
    };
  }

  const sorted = [...clean].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((acc, v) => acc + v, 0) / n;
  const median = quantile(sorted, 0.5);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);

  let stdDev = 0;
  if (n >= 2) {
    const variance =
      sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1);
    stdDev = Math.sqrt(variance);
  }

  return {
    count: n,
    mean: roundTo(mean, 2),
    median: roundTo(median, 2),
    std_dev: roundTo(stdDev, 2),
    min_value: roundTo(sorted[0], 2),
    max_value: roundTo(sorted[n - 1], 2),
    q1: roundTo(q1, 2),
    q3: roundTo(q3, 2),
  };
}

export function computePearsonCorrelation(xs, ys) {
  if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || xs.length < 2) {
    return null;
  }
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let sumSqX = 0;
  let sumSqY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  const den = Math.sqrt(sumSqX) * Math.sqrt(sumSqY);
  if (den === 0) return null;
  return roundTo(num / den, 4);
}

function rankParticipants(participants, sortBy) {
  const copy = [...participants];
  if (sortBy === "sheet_rank") {
    return copy.sort((a, b) => {
      if (a.sheet_rank !== b.sheet_rank) return a.sheet_rank - b.sheet_rank;
      if (a.correct !== b.correct) return b.correct - a.correct;
      if (a.total_time_seconds !== b.total_time_seconds) {
        return a.total_time_seconds - b.total_time_seconds;
      }
      if (a.score !== b.score) return b.score - a.score;
      return String(a.display_name).localeCompare(String(b.display_name));
    });
  }

  return copy.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.accuracy_percent !== b.accuracy_percent) {
      return b.accuracy_percent - a.accuracy_percent;
    }
    const timeA = a.attempted_questions > 0 ? a.total_time_seconds : Number.POSITIVE_INFINITY;
    const timeB = b.attempted_questions > 0 ? b.total_time_seconds : Number.POSITIVE_INFINITY;
    if (timeA !== timeB) return timeA - timeB;
    if (a.sheet_rank !== b.sheet_rank) return a.sheet_rank - b.sheet_rank;
    return String(a.display_name).localeCompare(String(b.display_name));
  });
}

function buildDistribution(participants, ranges, extractor) {
  const total = participants.length;
  return ranges.map(([label, low, high]) => {
    const count = participants.filter((p) => {
      const val = extractor(p);
      return val >= low && val <= high;
    }).length;
    const percentage = total > 0 ? roundTo((count / total) * 100, 1) : 0;
    return { label, count, percentage };
  });
}

function buildDeviceBreakdown(participants) {
  if (!participants.length) return [];
  const total = participants.length;
  const counts = new Map();
  for (const p of participants) {
    const key = p.device_info || "Desconhecido";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([device, count]) => ({
      device,
      count,
      percentage: roundTo((count / total) * 100, 1),
    }));
}

export function buildAnalyticsReport(
  dataset,
  { sortBy = "score", includeZeroAttempts = false } = {}
) {
  if (!dataset || typeof dataset !== "object") {
    throw new TypeError("Dataset object is required.");
  }
  if (!VALID_SORT_MODES.has(sortBy)) {
    throw new Error(`Unsupported sortBy: ${sortBy}`);
  }

  const allParticipants = Array.isArray(dataset.participants) ? dataset.participants : [];
  const activeParticipants = allParticipants.filter((p) => (p.attempted_questions || 0) > 0);
  const target = includeZeroAttempts ? allParticipants : activeParticipants;

  const sorted = rankParticipants(target, sortBy).map((p, index) => ({
    ...p,
    rank: index + 1,
    is_active: (p.attempted_questions || 0) > 0,
  }));

  const top10 = sorted.slice(0, 10);

  const scoreStats = computeDescriptiveStats(target.map((p) => p.score));
  const accuracyStats = computeDescriptiveStats(target.map((p) => p.accuracy_percent));
  const timeStats = computeDescriptiveStats(
    target.filter((p) => p.total_time_seconds > 0).map((p) => p.total_time_seconds)
  );

  const timed = target.filter((p) => (p.attempted_questions || 0) > 0 && p.total_time_seconds > 0);
  const timeScoreCorrelation = computePearsonCorrelation(
    timed.map((p) => p.total_time_seconds),
    timed.map((p) => p.score)
  );

  const questions = Array.isArray(dataset.questions) ? dataset.questions : [];
  let easiestQuestion = null;
  let hardestQuestion = null;
  if (questions.length > 0) {
    easiestQuestion = [...questions].sort(
      (a, b) => b.accuracy_percent - a.accuracy_percent || a.average_time_seconds - b.average_time_seconds
    )[0];
    hardestQuestion = [...questions].sort(
      (a, b) => a.accuracy_percent - b.accuracy_percent || a.average_time_seconds - b.average_time_seconds
    )[0];
  }

  const highlights = {};
  if (sorted.length > 0) {
    const leader = sorted[0];
    highlights.leader_name = leader.display_name;
    highlights.leader_score = leader.score;
    highlights.leader_accuracy = leader.accuracy_percent;
    highlights.perfect_scores_count = target.filter((p) => p.accuracy_percent >= 100).length;
    highlights.above_70_percent_count = target.filter((p) => p.accuracy_percent >= 70).length;
  }

  return {
    filename: dataset.filename || "",
    details: dataset.details || {},
    sort_by: sortBy,
    include_zero_attempts: includeZeroAttempts,
    total_attempts_count: allParticipants.length,
    active_participants_count: activeParticipants.length,
    filtered_count: target.length,
    top_10: top10,
    all_ranked: sorted,
    score_stats: scoreStats,
    accuracy_stats: accuracyStats,
    time_stats: timeStats,
    score_distribution: buildDistribution(
      target,
      [
        ["0–1499", 0, 1499],
        ["1500–2999", 1500, 2999],
        ["3000–4499", 3000, 4499],
        ["4500–5999", 4500, 5999],
        ["6000+", 6000, 1e9],
      ],
      (p) => p.score
    ),
    accuracy_distribution: buildDistribution(
      target,
      [
        ["0–24%", 0, 24.99],
        ["25–49%", 25, 49.99],
        ["50–74%", 50, 74.99],
        ["75–99%", 75, 99.99],
        ["100%", 100, 100.01],
      ],
      (p) => p.accuracy_percent
    ),
    questions,
    easiest_question: easiestQuestion,
    hardest_question: hardestQuestion,
    device_breakdown: buildDeviceBreakdown(target),
    time_score_correlation: timeScoreCorrelation,
    highlights,
  };
}
