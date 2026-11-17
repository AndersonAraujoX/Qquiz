/**
 * Pure formatting, filtering, and CSV-sanitizing utilities.
 */

export function formatSeconds(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0%";
  }
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function accuracyTierClass(accuracyPercent) {
  if (typeof accuracyPercent !== "number" || !Number.isFinite(accuracyPercent)) {
    return "low";
  }
  if (accuracyPercent >= 75) return "high";
  if (accuracyPercent >= 50) return "mid";
  return "low";
}

export function medalLabel(rank) {
  if (rank === 1) return "1º Lugar · Ouro";
  if (rank === 2) return "2º Lugar · Prata";
  if (rank === 3) return "3º Lugar · Bronze";
  return `${rank}º Lugar`;
}

export function filterParticipants(participants, query) {
  if (!Array.isArray(participants)) {
    return [];
  }
  const needle = typeof query === "string" ? query.trim().toLowerCase() : "";
  if (!needle) {
    return participants;
  }
  return participants.filter((p) => {
    const haystack = [p.display_name, p.player_name, p.device_info]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function sanitizeCsvCell(value) {
  const raw = value === null || value === undefined ? "" : String(value);
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  const escaped = neutralized.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildRankingCsv(participants) {
  const headers = [
    "Rank",
    "Rank Planilha",
    "Aluno",
    "Apelido",
    "Pontuacao",
    "Acuracia (%)",
    "Acertos",
    "Tentativas",
    "Tempo (s)",
    "Dispositivo",
  ];
  const lines = [headers.map(sanitizeCsvCell).join(",")];
  for (const p of Array.isArray(participants) ? participants : []) {
    lines.push(
      [
        p.rank,
        p.sheet_rank,
        p.display_name,
        p.player_name,
        p.score,
        p.accuracy_percent,
        p.correct,
        p.attempted_questions,
        Math.round(p.total_time_seconds ?? 0),
        p.device_info,
      ]
        .map(sanitizeCsvCell)
        .join(",")
    );
  }
  return lines.join("\n");
}
