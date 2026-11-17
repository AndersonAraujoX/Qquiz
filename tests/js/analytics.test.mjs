import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAnalyticsReport,
  computeDescriptiveStats,
  computePearsonCorrelation,
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
