import test from "node:test";
import assert from "node:assert/strict";

import { ALL_DATASETS_KEY, QuizApiClient } from "../../docs/modules/api_client.js";

function mockResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

test("QuizApiClient lists datasets and builds report from static JSON via mocked fetch", async () => {
  // Arrange
  const calls = [];
  const manifestPayload = {
    datasets: [
      {
        filename: "QuizA.xlsx",
        data_file: "QuizA.json",
      },
    ],
  };
  const datasetPayload = {
    filename: "QuizA.xlsx",
    details: { class_accuracy_percent: 100 },
    participants: [
      {
        sheet_rank: 1,
        display_name: "Ana",
        player_name: "ana",
        attempted_questions: 8,
        accuracy_percent: 100,
        score: 6200,
        correct: 8,
        total_time_seconds: 110,
        device_info: "Chrome",
      },
    ],
    questions: [],
  };

  const fakeFetch = async (url) => {
    calls.push(url);
    if (url.endsWith("manifest.json")) {
      return mockResponse(manifestPayload);
    }
    if (url.endsWith("QuizA.json")) {
      return mockResponse(datasetPayload);
    }
    return mockResponse({}, { ok: false, status: 404 });
  };

  const client = new QuizApiClient(fakeFetch, { basePath: "./data" });

  // Act
  const files = await client.listDatasets();
  const report = await client.fetchReport({ file: "QuizA.xlsx", sortBy: "score" });

  // Assert
  assert.deepEqual(files, ["QuizA.xlsx"]);
  assert.equal(report.top_10.length, 1);
  assert.equal(report.top_10[0].display_name, "Ana");
  assert.deepEqual(calls, ["./data/manifest.json", "./data/QuizA.json"]);
});

test("QuizApiClient rejects invalid data_file names and HTTP errors", async () => {
  // Arrange
  const badManifestClient = new QuizApiClient(async () =>
    mockResponse({
      datasets: [{ filename: "Evil.xlsx", data_file: "../secret.json" }],
    })
  );
  const failingClient = new QuizApiClient(async () =>
    mockResponse({}, { ok: false, status: 500 })
  );

  // Act & Assert
  await assert.rejects(() => badManifestClient.fetchReport({ file: "Evil.xlsx" }), /inválido/);
  await assert.rejects(() => failingClient.listDatasets(), /manifest\.json/);
  assert.throws(() => new QuizApiClient("not-a-fn"), TypeError);
});

test("QuizApiClient fetches and sums all datasets when file is ALL_DATASETS_KEY", async () => {
  // Arrange
  const manifestPayload = {
    datasets: [
      { filename: "Quiz1.xlsx", data_file: "Quiz1.json" },
      { filename: "Quiz2.xlsx", data_file: "Quiz2.json" },
    ],
  };
  const quiz1 = {
    filename: "Quiz1.xlsx",
    details: {},
    participants: [
      {
        sheet_rank: 1,
        display_name: "Ana",
        player_name: "ana",
        attempted_questions: 8,
        accuracy_percent: 100,
        score: 5000,
        correct: 8,
        total_time_seconds: 100,
        device_info: "Chrome",
      },
    ],
    questions: [],
  };
  const quiz2 = {
    filename: "Quiz2.xlsx",
    details: {},
    participants: [
      {
        sheet_rank: 1,
        display_name: "Ana",
        player_name: "ana",
        attempted_questions: 8,
        accuracy_percent: 87.5,
        score: 4200,
        correct: 7,
        total_time_seconds: 120,
        device_info: "Chrome",
      },
    ],
    questions: [],
  };

  const client = new QuizApiClient(async (url) => {
    if (url.endsWith("manifest.json")) return mockResponse(manifestPayload);
    if (url.endsWith("Quiz1.json")) return mockResponse(quiz1);
    if (url.endsWith("Quiz2.json")) return mockResponse(quiz2);
    return mockResponse({}, { ok: false, status: 404 });
  });

  // Act
  const report = await client.fetchReport({ file: ALL_DATASETS_KEY, sortBy: "score" });

  // Assert
  assert.equal(report.filename, "Soma Geral (2 quizzes)");
  assert.equal(report.highlights.leader_name, "Ana");
  assert.equal(report.highlights.leader_score, 9200);
});

test("QuizApiClient rejects ALL_DATASETS_KEY when manifest has no datasets", async () => {
  // Arrange
  const emptyClient = new QuizApiClient(async () => mockResponse({ datasets: [] }));

  // Act & Assert
  await assert.rejects(
    () => emptyClient.fetchReport({ file: ALL_DATASETS_KEY }),
    /Nenhum dataset disponível/
  );
});
