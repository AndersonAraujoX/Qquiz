/**
 * Pure client-side ranking and statistical analytics engine.
 * Enables full interactive filtering/sorting on static hosting (GitHub Pages).
 */

export const VALID_SORT_MODES = new Set(["score", "sheet_rank"]);

function roundTo(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function normalizeParticipantKey(participant) {
  if (!participant || typeof participant !== "object") {
    return "";
  }
  const rawName =
    String(participant.display_name || "").trim() ||
    String(participant.player_name || "").trim();
  if (!rawName) {
    return "";
  }
  return rawName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hasRichFormatting(text) {
  const value = String(text || "");
  return /[^\x00-\x7F]/.test(value) || /[A-Z][a-z]/.test(value);
}

function pickPreferredDisplayName(currentName, candidateName) {
  const current = String(currentName || "").trim();
  const candidate = String(candidateName || "").trim();
  if (!current) return candidate;
  if (!candidate) return current;
  if (hasRichFormatting(candidate) && !hasRichFormatting(current)) {
    return candidate;
  }
  if (candidate.length > current.length && !candidate.endsWith("*")) {
    return candidate;
  }
  return current;
}

function pickBetterAttempt(existing, candidate) {
  if (!existing) return candidate;
  const exActive = (existing.attempted_questions || 0) > 0 ? 1 : 0;
  const caActive = (candidate.attempted_questions || 0) > 0 ? 1 : 0;
  if (caActive !== exActive) return caActive > exActive ? candidate : existing;
  if ((candidate.score || 0) !== (existing.score || 0)) {
    return (candidate.score || 0) > (existing.score || 0) ? candidate : existing;
  }
  if ((candidate.correct || 0) !== (existing.correct || 0)) {
    return (candidate.correct || 0) > (existing.correct || 0) ? candidate : existing;
  }
  if ((candidate.attempted_questions || 0) !== (existing.attempted_questions || 0)) {
    return (candidate.attempted_questions || 0) > (existing.attempted_questions || 0)
      ? candidate
      : existing;
  }
  return (candidate.total_time_seconds || 0) < (existing.total_time_seconds || 0)
    ? candidate
    : existing;
}

function deduplicateDatasetParticipants(participants, includeZeroAttempts) {
  const byKey = new Map();
  for (const p of Array.isArray(participants) ? participants : []) {
    if (!p || typeof p !== "object") continue;
    if (!includeZeroAttempts && (p.attempted_questions || 0) <= 0) {
      continue;
    }
    const key = normalizeParticipantKey(p);
    if (!key) continue;
    byKey.set(key, pickBetterAttempt(byKey.get(key), p));
  }
  return byKey;
}

export function mergeDatasets(datasets, { includeZeroAttempts = false } = {}) {
  if (!Array.isArray(datasets) || datasets.length === 0) {
    throw new TypeError("A non-empty array of datasets is required.");
  }

  const aggregated = new Map();
  const combinedQuestions = [];
  const quizTitles = [];
  const quizSummaries = [];
  let totalCorrectAll = 0;
  let totalAttemptedAll = 0;
  let totalRawAttempts = 0;
  let questionCounter = 1;

  datasets.forEach((dataset, datasetIdx) => {
    if (!dataset || typeof dataset !== "object") {
      throw new TypeError(`Invalid dataset at index ${datasetIdx}.`);
    }
    const label = String(dataset.filename || `Quiz ${datasetIdx + 1}`).replace(/\.xlsx$/i, "");
    quizTitles.push(label);

    const singleReport = buildAnalyticsReport(dataset, {
      sortBy: "score",
      includeZeroAttempts,
    });
    quizSummaries.push({
      filename: dataset.filename || label,
      title: label,
      started_on: dataset.details?.game_started_on || "--",
      active_participants: singleReport.active_participants_count,
      total_attempts: singleReport.total_attempts_count,
      class_accuracy_percent:
        dataset.details?.class_accuracy_percent ?? singleReport.accuracy_stats.mean,
      mean_score: singleReport.score_stats.mean,
      max_score: singleReport.score_stats.max_value,
      mean_time_seconds: singleReport.time_stats.mean,
      leader_name: singleReport.highlights?.leader_name || "--",
      leader_score: singleReport.highlights?.leader_score ?? 0,
    });

    const allInQuiz = Array.isArray(dataset.participants) ? dataset.participants : [];
    totalRawAttempts += allInQuiz.length;

    const deduped = deduplicateDatasetParticipants(allInQuiz, includeZeroAttempts);
    for (const [key, p] of deduped.entries()) {
      const score = Number(p.score) || 0;
      const correct = Number(p.correct) || 0;
      const attempted = Number(p.attempted_questions) || 0;
      const timeSec = Number(p.total_time_seconds) || 0;
      const isActive = attempted > 0;

      totalCorrectAll += correct;
      totalAttemptedAll += attempted;

      const entry = aggregated.get(key);
      if (!entry) {
        aggregated.set(key, {
          key,
          display_name: p.display_name || p.player_name || key,
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          player_names: p.player_name ? [String(p.player_name).replace(/\*+$/g, "").trim()] : [],
          score,
          correct,
          attempted_questions: attempted,
          total_time_seconds: timeSec,
          device_info: p.device_info || "Desconhecido",
          quizzes_count: isActive ? 1 : 0,
          total_quizzes: datasets.length,
        });
      } else {
        entry.display_name = pickPreferredDisplayName(
          entry.display_name,
          p.display_name || p.player_name
        );
        if (p.player_name) {
          const cleanNick = String(p.player_name).replace(/\*+$/g, "").trim();
          if (cleanNick && !entry.player_names.includes(cleanNick)) {
            entry.player_names.push(cleanNick);
          }
        }
        entry.score += score;
        entry.correct += correct;
        entry.attempted_questions += attempted;
        entry.total_time_seconds += timeSec;
        if (p.device_info) {
          entry.device_info = p.device_info;
        }
        if (isActive) {
          entry.quizzes_count += 1;
        }
      }
    }

    const questions = Array.isArray(dataset.questions) ? dataset.questions : [];
    for (const q of questions) {
      combinedQuestions.push({
        ...q,
        number: questionCounter,
        question_text: `[Dia ${datasetIdx + 1} · Q${q.number}] ${q.question_text || ""}`.trim(),
      });
      questionCounter += 1;
    }
  });

  const combinedParticipants = [...aggregated.values()]
    .sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;
      if (a.total_time_seconds !== b.total_time_seconds) {
        return a.total_time_seconds - b.total_time_seconds;
      }
      if (b.score !== a.score) return b.score - a.score;
      return String(a.display_name).localeCompare(String(b.display_name));
    })
    .map((item, idx) => {
      const accuracy =
        item.attempted_questions > 0
          ? roundTo((item.correct / item.attempted_questions) * 100, 1)
          : 0;
      const nickList = item.player_names.filter(
        (n) => n.toLowerCase() !== String(item.display_name).toLowerCase()
      );
      return {
        sheet_rank: idx + 1,
        first_name: item.first_name,
        last_name: item.last_name,
        display_name: item.display_name,
        player_name: nickList.length > 0 ? nickList.join(" / ") : item.player_names[0] || item.display_name,
        attempted_questions: item.attempted_questions,
        accuracy_percent: accuracy,
        score: item.score,
        correct: item.correct,
        total_time_seconds: roundTo(item.total_time_seconds, 2),
        device_info: item.device_info,
        quizzes_count: item.quizzes_count,
        total_quizzes: item.total_quizzes,
        is_active: item.attempted_questions > 0,
      };
    });

  const startedDates = datasets
    .map((d) => d.details?.game_started_on)
    .filter(Boolean);
  const endedDates = datasets
    .map((d) => d.details?.game_ended_on)
    .filter(Boolean);
  const classAccuracy =
    totalAttemptedAll > 0 ? roundTo((totalCorrectAll / totalAttemptedAll) * 100, 1) : 0;

  return {
    filename: `Soma Geral (${datasets.length} quizzes)`,
    details: {
      game_type: "Ranking Acumulado",
      game_started_on: startedDates[0] || "--",
      game_ended_on: endedDates[endedDates.length - 1] || "--",
      reported_participants: combinedParticipants.length,
      class_accuracy_percent: classAccuracy,
      dataset_count: datasets.length,
      quiz_titles: quizTitles,
      quiz_summaries: quizSummaries,
      total_raw_attempts: totalRawAttempts,
    },
    participants: combinedParticipants,
    questions: combinedQuestions,
  };
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

  const datasetCount = Math.max(1, Number(dataset.details?.dataset_count) || 1);
  const step = 1500 * datasetCount;
  const scoreRanges = [
    [`0–${step - 1}`, 0, step - 1],
    [`${step}–${step * 2 - 1}`, step, step * 2 - 1],
    [`${step * 2}–${step * 3 - 1}`, step * 2, step * 3 - 1],
    [`${step * 3}–${step * 4 - 1}`, step * 3, step * 4 - 1],
    [`${step * 4}+`, step * 4, 1e9],
  ];

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
      scoreRanges,
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
