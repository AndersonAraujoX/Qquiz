import test from "node:test";
import assert from "node:assert/strict";

import {
  accuracyTierClass,
  buildRankingCsv,
  filterParticipants,
  formatPercent,
  formatSeconds,
  medalLabel,
  sanitizeCsvCell,
} from "../../docs/modules/formatters.js";

test("formatSeconds formats durations and handles invalid inputs safely", () => {
  // Arrange / Act / Assert
  assert.equal(formatSeconds(0), "00:00");
  assert.equal(formatSeconds(96), "01:36");
  assert.equal(formatSeconds(219.4), "03:39");
  assert.equal(formatSeconds(-5), "00:00");
  assert.equal(formatSeconds(Number.NaN), "00:00");
});

test("formatPercent and accuracyTierClass classify boundaries accurately", () => {
  // Arrange / Act / Assert
  assert.equal(formatPercent(84), "84%");
  assert.equal(formatPercent(62.46), "62.5%");
  assert.equal(formatPercent(null), "0%");
  assert.equal(accuracyTierClass(75), "high");
  assert.equal(accuracyTierClass(50), "mid");
  assert.equal(accuracyTierClass(49.9), "low");
});

test("medalLabel returns podium descriptions and generic labels", () => {
  // Arrange / Act / Assert
  assert.match(medalLabel(1), /Ouro/);
  assert.match(medalLabel(2), /Prata/);
  assert.match(medalLabel(3), /Bronze/);
  assert.equal(medalLabel(7), "7º Lugar");
  assert.match(medalLabel(1, "en"), /Gold/);
  assert.match(medalLabel(2, "en"), /Silver/);
  assert.match(medalLabel(3, "en"), /Bronze/);
  assert.equal(medalLabel(7, "en"), "7th Place");
});

test("filterParticipants filters case-insensitively across name, nickname, and device", () => {
  // Arrange
  const list = [
    { display_name: "Pedro Marques", player_name: "pmp", device_info: "Chrome on Windows" },
    { display_name: "José Souza", player_name: "jsouza", device_info: "Firefox on Linux" },
  ];

  // Act
  const byDevice = filterParticipants(list, "linux");
  const all = filterParticipants(list, "   ");
  const invalid = filterParticipants(null, "a");

  // Assert
  assert.equal(byDevice.length, 1);
  assert.equal(byDevice[0].display_name, "José Souza");
  assert.equal(all.length, 2);
  assert.deepEqual(invalid, []);
});

test("sanitizeCsvCell and buildRankingCsv neutralize spreadsheet formula injection", () => {
  // Arrange
  const participants = [
    {
      rank: 1,
      sheet_rank: 1,
      display_name: "=CMD('calc')",
      player_name: "+evil",
      score: 5000,
      accuracy_percent: 88,
      correct: 7,
      attempted_questions: 8,
      total_time_seconds: 150,
      device_info: "Chrome",
    },
  ];

  // Act
  const cell = sanitizeCsvCell('=1+1"test');
  const csv = buildRankingCsv(participants);

  // Assert
  assert.equal(cell, `"'=1+1""test"`);
  assert.match(csv, /"'=CMD\('calc'\)"/);
  assert.match(csv, /"'\+evil"/);
});
