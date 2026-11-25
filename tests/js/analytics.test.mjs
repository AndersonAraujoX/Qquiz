import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAnalyticsReport,
  buildAttemptedQuestionsDistribution,
  buildRankingProgression,
  computeDescriptiveStats,
  computePearsonCorrelation,
  mergeDatasets,
  normalizeParticipantKey,
} from "../../docs/modules/analytics.js";

test("computeDescriptiveStats handles empty, single, and multi-element arrays", () => {
  // Arrange & Act
  const empty = computeDescriptiveStats([]);
  const single = computeDescriptiveStats([55]);
  const multi = computeDescriptiveStats([10, 20, 30, 40]);

  // Assert
  assert.equal(empty.count, 0);
  assert.equal(empty.mean, 0);
  assert.equal(single.count, 1);
  assert.equal(single.median, 55);
  assert.equal(single.std_dev, 0);
  assert.equal(multi.count, 4);
  assert.equal(multi.mean, 25);
  assert.equal(multi.median, 25);
  assert.equal(multi.min_value, 10);
  assert.equal(multi.max_value, 40);
});

test("computePearsonCorrelation returns exact correlation or null on invalid/constant inputs", () => {
  // Arrange / Act / Assert
  assert.equal(computePearsonCorrelation([1], [2]), null);
  assert.equal(computePearsonCorrelation([3, 3, 3], [1, 2, 3]), null);
  assert.equal(computePearsonCorrelation([1, 2, 3], [2, 4, 6]), 1);
  assert.equal(computePearsonCorrelation([1, 2, 3], [6, 4, 2]), -1);
});

test("buildAnalyticsReport builds Top 10, filters zero attempts, and sorts by score or sheet_rank", () => {
  // Arrange
  const participants = [
    {
      sheet_rank: 99,
      display_name: "Reconectou",
      player_name: "reco",
      attempted_questions: 0,
      accuracy_percent: 0,
      score: 0,
      correct: 0,
      total_time_seconds: 0,
      device_info: "Chrome",
    },
    ...Array.from({ length: 12 }, (_, idx) => ({
      sheet_rank: 12 - idx,
      display_name: `Aluno ${idx + 1}`,
      player_name: `a${idx + 1}`,
      attempted_questions: 8,
      accuracy_percent: 50 + idx * 4,
      score: 3000 + idx * 250,
      correct: 4 + (idx % 5),
      total_time_seconds: 200 - idx * 5,
      device_info: idx % 2 === 0 ? "Chrome on Windows" : "Firefox on Linux",
    })),
  ];
  const dataset = {
    filename: "quiz.xlsx",
    details: { class_accuracy_percent: 65 },
    participants,
    questions: [
      { number: 1, accuracy_percent: 90, average_time_seconds: 15 },
      { number: 2, accuracy_percent: 25, average_time_seconds: 40 },
    ],
  };

  // Act
  const byScore = buildAnalyticsReport(dataset, { sortBy: "score", includeZeroAttempts: false });
  const withZero = buildAnalyticsReport(dataset, { sortBy: "sheet_rank", includeZeroAttempts: true });

  // Assert
  assert.equal(byScore.total_attempts_count, 13);
  assert.equal(byScore.active_participants_count, 12);
  assert.equal(byScore.top_10.length, 10);
  assert.equal(byScore.top_10[0].display_name, "Aluno 12");
  assert.equal(byScore.easiest_question.number, 1);
  assert.equal(byScore.hardest_question.number, 2);
  assert.equal(withZero.filtered_count, 13);
  assert.equal(withZero.all_ranked[0].sheet_rank, 1);
});

test("buildAnalyticsReport throws on invalid dataset or unsupported sortBy", () => {
  // Arrange / Act / Assert
  assert.throws(() => buildAnalyticsReport(null), TypeError);
  assert.throws(
    () => buildAnalyticsReport({ participants: [] }, { sortBy: "bad" }),
    Error
  );
});

test("normalizeParticipantKey normalizes accents, case, extra spaces, and reconnect asterisks", () => {
  // Arrange / Act / Assert
  assert.equal(normalizeParticipantKey({ display_name: "Kevin Martínez" }), "kevin martinez");
  assert.equal(normalizeParticipantKey({ display_name: "  kevin   martinez*** " }), "kevin martinez");
  assert.equal(normalizeParticipantKey({ display_name: "", player_name: "L*" }), "l");
  assert.equal(normalizeParticipantKey(null), "");
  assert.equal(normalizeParticipantKey({ display_name: "   " }), "");
});

test("mergeDatasets sums scores across quizzes, deduplicates reconnects, and identifies 1st place", () => {
  // Arrange
  const day1 = {
    filename: "Day1.xlsx",
    details: { game_started_on: "Mon 16 Nov 2026,08:54 AM", game_ended_on: "Mon 16 Nov 2026,09:06 AM" },
    participants: [
      {
        sheet_rank: 1,
        display_name: "Pedro Marques",
        player_name: "Pedro Marques",
        attempted_questions: 8,
        accuracy_percent: 100,
        score: 6330,
        correct: 8,
        total_time_seconds: 219,
        device_info: "Chrome",
      },
      {
        sheet_rank: 2,
        display_name: "Kevin Martinez",
        player_name: "Kevin Martinez",
        attempted_questions: 8,
        accuracy_percent: 62.5,
        score: 4590,
        correct: 5,
        total_time_seconds: 100,
        device_info: "Chrome",
        question_answers: [
          { question_number: 1, status: "correct", response: "Option A" },
        ],
      },
      {
        sheet_rank: 3,
        display_name: "Nathália Ferino",
        player_name: "Nathália Ferino***",
        attempted_questions: 6,
        accuracy_percent: 16.7,
        score: 740,
        correct: 1,
        total_time_seconds: 179,
        device_info: "Safari",
      },
      {
        sheet_rank: 4,
        display_name: "Nathália Ferino",
        player_name: "Nathália Ferino",
        attempted_questions: 0,
        accuracy_percent: 0,
        score: 0,
        correct: 0,
        total_time_seconds: 0,
        device_info: "Safari",
      },
    ],
    questions: [{ number: 1, question_text: "Qubit?", accuracy_percent: 80, average_time_seconds: 20 }],
  };

  const day2 = {
    filename: "Day2.xlsx",
    details: { game_started_on: "Wed 18 Nov 2026,11:17 AM", game_ended_on: "Wed 18 Nov 2026,11:31 AM" },
    participants: [
      {
        sheet_rank: 1,
        display_name: "Pedro Marques",
        player_name: "Pedro Marques",
        attempted_questions: 8,
        accuracy_percent: 100,
        score: 5080,
        correct: 8,
        total_time_seconds: 274,
        device_info: "Chrome",
      },
      {
        sheet_rank: 2,
        display_name: "Kevin Martínez",
        player_name: "Kevin Martínez",
        attempted_questions: 8,
        accuracy_percent: 75,
        score: 4930,
        correct: 6,
        total_time_seconds: 107,
        device_info: "Firefox",
        question_answers: [
          { question_number: 1, status: "incorrect", response: "Option B" },
        ],
      },
      {
        sheet_rank: 3,
        display_name: "Arthur Kenzo",
        player_name: "ArtKenzo",
        attempted_questions: 8,
        accuracy_percent: 100,
        score: 5780,
        correct: 8,
        total_time_seconds: 163,
        device_info: "Chrome",
      },
    ],
    questions: [{ number: 1, question_text: "Entanglement?", accuracy_percent: 60, average_time_seconds: 25 }],
  };

  // Act
  const merged = mergeDatasets([day1, day2]);
  const report = buildAnalyticsReport(merged, { sortBy: "score" });

  // Assert
  assert.equal(report.top_10.length, 4);
  assert.equal(report.highlights.leader_name, "Pedro Marques");
  assert.equal(report.highlights.leader_score, 11410);
  const kevin = report.all_ranked.find((p) => p.display_name.startsWith("Kevin"));
  assert.equal(kevin.score, 9520);
  assert.equal(kevin.correct, 11);
  assert.equal(kevin.attempted_questions, 16);
  assert.equal(kevin.quizzes_count, 2);
  assert.deepEqual(kevin.question_answers, [
    { question_number: 1, status: "correct", response: "Option A" },
    { question_number: 2, status: "incorrect", response: "Option B" },
  ]);
  const nathalia = report.all_ranked.find((p) => p.display_name.startsWith("Nathália"));
  assert.equal(nathalia.score, 740);
  assert.equal(nathalia.quizzes_count, 1);
  assert.deepEqual(nathalia.question_answers, []);
  assert.equal(report.questions.length, 2);
  assert.equal(report.score_distribution.length, 5);
  assert.equal(merged.details.quiz_summaries.length, 2);
  assert.equal(merged.details.quiz_summaries[0].leader_name, "Pedro Marques");
  assert.equal(merged.details.quiz_summaries[0].max_score, 6330);
  assert.equal(merged.details.quiz_summaries[1].leader_name, "Arthur Kenzo");
  // Assert chronological ordering in mergeDatasets when game_started_on dates are out of order
  assert.equal(merged.details.quiz_summaries[0].title, "Day1");
  assert.equal(merged.details.quiz_summaries[1].title, "Day2");

  const reversedMerged = mergeDatasets([day2, day1]);
  assert.equal(reversedMerged.details.quiz_summaries[0].title, "Day1");
  assert.equal(reversedMerged.details.quiz_summaries[1].title, "Day2");
  assert.equal(reversedMerged.details.game_started_on, "Mon 16 Nov 2026,08:54 AM");
  assert.equal(reversedMerged.details.game_ended_on, "Wed 18 Nov 2026,11:31 AM");
});

test("mergeDatasets throws TypeError on empty or invalid datasets", () => {
  // Arrange / Act / Assert
  assert.throws(() => mergeDatasets([]), TypeError);
  assert.throws(() => mergeDatasets(null), TypeError);
  assert.throws(() => mergeDatasets([null]), TypeError);
});

test("buildAttemptedQuestionsDistribution buckets single-quiz, multi-quiz, zero-attempt, and empty inputs", () => {
  // Arrange
  const singleParticipants = [
    { attempted_questions: 0 },
    { attempted_questions: 2 },
    { attempted_questions: 5 },
    { attempted_questions: 8 },
    { attempted_questions: 8 },
  ];
  const multiParticipants = [
    { attempted_questions: 4 },
    { attempted_questions: 8 },
    { attempted_questions: 16 },
    { attempted_questions: 24 },
    { attempted_questions: 32 },
    { attempted_questions: 32 },
  ];

  // Act
  const singleDist = buildAttemptedQuestionsDistribution(singleParticipants, {
    totalQuestions: 8,
    datasetCount: 1,
    includeZeroAttempts: true,
  });
  const multiDist = buildAttemptedQuestionsDistribution(multiParticipants, {
    totalQuestions: 32,
    datasetCount: 4,
    includeZeroAttempts: false,
  });
  const emptyDist = buildAttemptedQuestionsDistribution([], { totalQuestions: 8 });
  const nullDist = buildAttemptedQuestionsDistribution(null);

  // Assert
  assert.deepEqual(
    singleDist.map((b) => [b.label, b.count]),
    [
      ["0", 1],
      ["1", 0],
      ["2–3", 1],
      ["4–5", 1],
      ["6–7", 0],
      ["8", 2],
    ]
  );
  assert.deepEqual(
    multiDist.map((b) => [b.label, b.count]),
    [
      ["1–7", 1],
      ["8–15", 1],
      ["16–23", 1],
      ["24–31", 1],
      ["32", 2],
    ]
  );
  assert.deepEqual(emptyDist, []);
  assert.deepEqual(nullDist, []);
});

test("buildRankingProgression tracks cumulative ranks, late joiners, empty inputs, and invalid sortBy", () => {
  // Arrange
  const q1 = {
    filename: "Quiz1.xlsx",
    details: { game_started_on: "Mon 16 Nov 2026,08:54 AM" },
    participants: [
      { display_name: "Ana", score: 5000, correct: 7, attempted_questions: 8, total_time_seconds: 100 },
      { display_name: "Bruno", score: 3000, correct: 4, attempted_questions: 8, total_time_seconds: 120 },
    ],
  };
  const q2 = {
    filename: "Quiz2.xlsx",
    details: { game_started_on: "Tue 17 Nov 2026,11:17 AM" },
    participants: [
      { display_name: "Bruno", score: 6000, correct: 8, attempted_questions: 8, total_time_seconds: 90 },
      { display_name: "Ana", score: 2000, correct: 3, attempted_questions: 8, total_time_seconds: 150 },
      { display_name: "Carla", score: 4000, correct: 6, attempted_questions: 8, total_time_seconds: 110 },
    ],
  };

  // Act
  const prog = buildRankingProgression([q2, q1], { sortBy: "score" });
  const emptyProg = buildRankingProgression([]);

  // Assert
  assert.equal(prog.stages.length, 2);
  assert.equal(prog.stages[0].title, "Quiz1");
  assert.equal(prog.stages[1].title, "Quiz2");

  const bruno = prog.participants.find((p) => p.display_name === "Bruno");
  const ana = prog.participants.find((p) => p.display_name === "Ana");
  const carla = prog.participants.find((p) => p.display_name === "Carla");

  assert.deepEqual(bruno.ranks, [2, 1]);
  assert.equal(bruno.delta, 1);
  assert.equal(bruno.final_score, 9000);
  assert.deepEqual(ana.ranks, [1, 2]);
  assert.equal(ana.delta, -1);
  assert.deepEqual(carla.ranks, [null, 3]);
  assert.equal(carla.delta, 0);

  assert.deepEqual(emptyProg, { stages: [], participants: [] });
  assert.throws(() => buildRankingProgression([q1], { sortBy: "invalid" }), Error);
});
