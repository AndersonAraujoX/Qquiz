import test from "node:test";
import assert from "node:assert/strict";

import { QuizApiClient } from "../../docs/modules/api_client.js";

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
