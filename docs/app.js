/**
 * Main Quiz Analytics Dashboard controller (Static GitHub Pages compatible).
 */

import { QuizApiClient } from "./modules/api_client.js";
import { renderBarChart, renderScatterPlot } from "./modules/charts.js";
import { clear, el } from "./modules/dom.js";
import {
  accuracyTierClass,
  buildRankingCsv,
  filterParticipants,
  formatNumber,
  formatPercent,
  formatSeconds,
  medalLabel,
} from "./modules/formatters.js";
import { TabController, normalizeTabId } from "./modules/tabs.js";
import { ThemeController } from "./modules/theme.js";

const api = new QuizApiClient();

const state = {
  datasets: [],
  selectedFile: "",
  sortBy: "score",
  includeZero: false,
  searchQuery: "",
  report: null,
};

const dom = {
  quizSubtitle: document.getElementById("quiz-subtitle"),
  datasetSelect: document.getElementById("dataset-select"),
  sortSelect: document.getElementById("sort-select"),
  includeZeroToggle: document.getElementById("include-zero-toggle"),
  refreshBtn: document.getElementById("refresh-btn"),
  exportCsvBtn: document.getElementById("export-csv-btn"),
  themeToggleBtn: document.getElementById("theme-toggle-btn"),
  statusBanner: document.getElementById("status-banner"),
  sessionMeta: document.getElementById("session-meta"),
  kpiGrid: document.getElementById("kpi-grid"),
  rankingModeBadge: document.getElementById("ranking-mode-badge"),
  podiumGrid: document.getElementById("podium-grid"),
  top10Tbody: document.getElementById("top10-tbody"),
  correlationBadge: document.getElementById("correlation-badge"),
  chartAccuracyDist: document.getElementById("chart-accuracy-dist"),
  chartScoreDist: document.getElementById("chart-score-dist"),
  chartScatter: document.getElementById("chart-scatter"),
  statsSampleLabel: document.getElementById("stats-sample-label"),
  descriptiveTbody: document.getElementById("descriptive-tbody"),
  deviceBreakdownHost: document.getElementById("device-breakdown-host"),
  questionHighlights: document.getElementById("question-highlights"),
  questionsChartHost: document.getElementById("questions-chart-host"),
  allCountDesc: document.getElementById("all-count-desc"),
  participantSearch: document.getElementById("participant-search"),
  allTbody: document.getElementById("all-tbody"),
  questionDialog: document.getElementById("question-dialog"),
  dialogTitle: document.getElementById("dialog-title"),
  dialogBody: document.getElementById("dialog-body"),
  dialogCloseBtn: document.getElementById("dialog-close-btn"),
  chartTooltip: document.getElementById("chart-tooltip"),
};

function setStatus(message, isError = false) {
  if (!message) {
    dom.statusBanner.hidden = true;
    dom.statusBanner.textContent = "";
    dom.statusBanner.classList.remove("error");
    return;
  }
  dom.statusBanner.hidden = false;
  dom.statusBanner.textContent = message;
  dom.statusBanner.classList.toggle("error", Boolean(isError));
}

function renderSessionMeta(report) {
  clear(dom.sessionMeta);
  const details = report.details || {};
  const chips = [
    ["Arquivo", report.filename],
    ["Tipo", details.game_type || "Quiz"],
    ["Início", details.game_started_on || "--"],
    ["Término", details.game_ended_on || "--"],
    ["Participantes únicos (planilha)", String(details.reported_participants ?? "--")],
    ["Total de linhas/tentativas", String(report.total_attempts_count)],
  ];
  for (const [label, value] of chips) {
    dom.sessionMeta.appendChild(
      el("span", { className: "meta-chip" }, [
        `${label}: `,
        el("strong", { text: value }),
      ])
    );
  }
}

function renderKpis(report) {
  clear(dom.kpiGrid);
  const h = report.highlights || {};
  const zeroCount = report.total_attempts_count - report.active_participants_count;
  const kpis = [
    {
      label: "Alunos Analisados",
      value: String(report.filtered_count),
      sub: `${report.active_participants_count} ativos · ${zeroCount} com 0 questões`,
    },
    {
      label: "Acurácia da Turma",
      value: formatPercent(report.details?.class_accuracy_percent ?? report.accuracy_stats.mean),
      sub: `Mediana individual: ${formatPercent(report.accuracy_stats.median)}`,
    },
    {
      label: "Pontuação Média",
      value: formatNumber(report.score_stats.mean),
      sub: `Mediana: ${formatNumber(report.score_stats.median)} · Máx: ${formatNumber(report.score_stats.max_value)}`,
    },
    {
      label: "Tempo Médio Ativo",
      value: formatSeconds(report.time_stats.mean),
      sub: `Mediana: ${formatSeconds(report.time_stats.median)}`,
    },
    {
      label: "Líder Geral",
      value: h.leader_name ? String(h.leader_name) : "--",
      sub: h.leader_score !== undefined
        ? `${formatNumber(Number(h.leader_score))} pts (${formatPercent(Number(h.leader_accuracy || 0))})`
        : "Sem registros",
    },
    {
      label: "Notas ≥ 70% / 100%",
      value: `${h.above_70_percent_count ?? 0} / ${h.perfect_scores_count ?? 0}`,
      sub: "Acima de 70% / gabaritaram",
    },
  ];

  for (const item of kpis) {
    dom.kpiGrid.appendChild(
      el("article", { className: "kpi-card" }, [
        el("span", { className: "kpi-label", text: item.label }),
        el("span", { className: "kpi-value", text: item.value }),
        el("span", { className: "kpi-sub", text: item.sub }),
      ])
    );
  }
}

function renderPodium(top10) {
  clear(dom.podiumGrid);
  const top3 = top10.slice(0, 3);
  if (top3.length === 0) {
    dom.podiumGrid.appendChild(
      el("p", { className: "muted-small", text: "Nenhum aluno encontrado para o pódio." })
    );
    return;
  }

  for (const student of top3) {
    dom.podiumGrid.appendChild(
      el("article", { className: `podium-card rank-${student.rank}` }, [
        el("div", { className: "podium-top" }, [
          el("span", { className: "medal-pill", text: medalLabel(student.rank) }),
          el("span", { className: "podium-score", text: `${formatNumber(student.score)} pts` }),
        ]),
        el("h3", { className: "podium-name", text: student.display_name }),
        el("span", {
          className: "podium-nick",
          text: student.player_name && student.player_name !== student.display_name
            ? `Apelido: ${student.player_name}`
            : `Rank na planilha: #${student.sheet_rank}`,
        }),
        el("div", { className: "podium-metrics" }, [
          el("span", { text: `Acurácia: ${formatPercent(student.accuracy_percent)}` }),
          el("span", { text: `Acertos: ${student.correct}/${student.attempted_questions}` }),
          el("span", { text: `Tempo: ${formatSeconds(student.total_time_seconds)}` }),
        ]),
      ])
    );
  }
}

function buildAccuracyCell(accuracyPercent) {
  const tier = accuracyTierClass(accuracyPercent);
  const fill = el("div", { className: `acc-bar-fill ${tier}` });
  fill.style.width = `${Math.max(0, Math.min(100, accuracyPercent))}%`;
  return el("td", {}, [
    el("div", { className: "acc-meter" }, [
      el("div", { className: "acc-bar-track" }, [fill]),
      el("span", { text: formatPercent(accuracyPercent) }),
    ]),
  ]);
}

function renderTop10Table(report) {
  clear(dom.top10Tbody);
  dom.rankingModeBadge.textContent =
    report.sort_by === "sheet_rank"
      ? "Ordenado por Acertos + Menor Tempo"
      : "Ordenado por Pontuação (Score)";

  for (const p of report.top_10) {
    const rankClass = p.rank <= 3 ? `rank-badge top-${p.rank}` : "rank-badge";
    const row = el("tr", {}, [
      el("td", {}, [el("span", { className: rankClass, text: String(p.rank) })]),
      el("td", {}, [el("strong", { text: p.display_name })]),
      el("td", { text: p.player_name || "--" }),
      el("td", { className: "num", text: formatNumber(p.score) }),
      buildAccuracyCell(p.accuracy_percent),
      el("td", { className: "num", text: `${p.correct}/${p.attempted_questions}` }),
      el("td", { className: "num", text: formatSeconds(p.total_time_seconds) }),
      el("td", { text: p.device_info }),
    ]);
    dom.top10Tbody.appendChild(row);
  }
}

function renderDescriptiveStats(report) {
  clear(dom.descriptiveTbody);
  dom.statsSampleLabel.textContent = `Amostra: ${report.filtered_count} registros`;

  const corr = report.time_score_correlation;
  if (corr === null || corr === undefined) {
    dom.correlationBadge.textContent = "Correlação Tempo × Score: N/D";
  } else {
    const direction = corr < -0.2 ? "negativa (mais rápido = maior nota)" : corr > 0.2 ? "positiva" : "fraca";
    dom.correlationBadge.textContent = `Correlação Tempo × Score: r = ${corr.toFixed(2)} (${direction})`;
  }

  const rows = [
    { label: "Pontuação (Score)", stats: report.score_stats, fmt: formatNumber },
    { label: "Acurácia (%)", stats: report.accuracy_stats, fmt: formatPercent },
    { label: "Tempo Total", stats: report.time_stats, fmt: formatSeconds },
  ];

  for (const { label, stats, fmt } of rows) {
    dom.descriptiveTbody.appendChild(
      el("tr", {}, [
        el("td", {}, [el("strong", { text: label })]),
        el("td", { className: "num", text: fmt(stats.mean) }),
        el("td", { className: "num", text: fmt(stats.median) }),
        el("td", { className: "num", text: fmt(stats.std_dev) }),
        el("td", { className: "num", text: fmt(stats.q1) }),
        el("td", { className: "num", text: fmt(stats.q3) }),
        el("td", { className: "num", text: fmt(stats.min_value) }),
        el("td", { className: "num", text: fmt(stats.max_value) }),
      ])
    );
  }
}

function renderDevices(breakdown) {
  clear(dom.deviceBreakdownHost);
  if (!Array.isArray(breakdown) || breakdown.length === 0) {
    dom.deviceBreakdownHost.appendChild(
      el("p", { className: "muted-small", text: "Sem dados de dispositivos." })
    );
    return;
  }
  for (const item of breakdown) {
    const fill = el("div", { className: "acc-bar-fill" });
    fill.style.width = `${Math.max(2, Math.min(100, item.percentage))}%`;
    dom.deviceBreakdownHost.appendChild(
      el("div", { className: "device-item" }, [
        el("div", { className: "device-label-row" }, [
          el("span", { text: item.device }),
          el("strong", { text: `${item.count} (${formatPercent(item.percentage)})` }),
        ]),
        el("div", { className: "acc-bar-track" }, [fill]),
      ])
    );
  }
}

function openQuestionDialog(q) {
  dom.dialogTitle.textContent = `Questão ${q.number} · ${q.question_type}`;
  clear(dom.dialogBody);

  dom.dialogBody.appendChild(el("p", { text: q.question_text }));
  dom.dialogBody.appendChild(
    el("div", { className: "dialog-metrics" }, [
      el("div", { className: "dialog-metric-box" }, [
        el("div", { className: "kpi-label", text: "Acurácia" }),
        el("strong", { text: formatPercent(q.accuracy_percent) }),
      ]),
      el("div", { className: "dialog-metric-box" }, [
        el("div", { className: "kpi-label", text: "Tempo Médio" }),
        el("strong", { text: formatSeconds(q.average_time_seconds) }),
      ]),
      el("div", { className: "dialog-metric-box" }, [
        el("div", { className: "kpi-label", text: "Corretas" }),
        el("strong", { text: String(q.correct_count) }),
      ]),
      el("div", { className: "dialog-metric-box" }, [
        el("div", { className: "kpi-label", text: "Incorretas" }),
        el("strong", { text: String(q.incorrect_count) }),
      ]),
      el("div", { className: "dialog-metric-box" }, [
        el("div", { className: "kpi-label", text: "Não tentadas" }),
        el("strong", { text: String(q.unattempted_count) }),
      ]),
    ])
  );

  if (typeof dom.questionDialog.showModal === "function") {
    dom.questionDialog.showModal();
  }
}

function renderQuestions(report) {
  clear(dom.questionHighlights);
  clear(dom.questionsChartHost);

  if (report.easiest_question) {
    dom.questionHighlights.appendChild(
      el("span", {
        className: "highlight-tag easy",
        text: `Mais fácil: Q${report.easiest_question.number} (${formatPercent(report.easiest_question.accuracy_percent)})`,
      })
    );
  }
  if (report.hardest_question) {
    dom.questionHighlights.appendChild(
      el("span", {
        className: "highlight-tag hard",
        text: `Mais difícil: Q${report.hardest_question.number} (${formatPercent(report.hardest_question.accuracy_percent)})`,
      })
    );
  }

  if (!Array.isArray(report.questions) || report.questions.length === 0) {
    dom.questionsChartHost.appendChild(
      el("p", { className: "muted-small", text: "Nenhuma questão encontrada na aba Overview." })
    );
    return;
  }

  for (const q of report.questions) {
    const tier = accuracyTierClass(q.accuracy_percent);
    const fill = el("div", { className: `acc-bar-fill ${tier}` });
    fill.style.width = `${Math.max(0, Math.min(100, q.accuracy_percent))}%`;

    const btn = el(
      "button",
      {
        className: "question-row-btn",
        attrs: { type: "button", title: "Clique para ver detalhes da questão" },
        onClick: () => openQuestionDialog(q),
      },
      [
        el("span", { className: "q-num", text: `Q${q.number}` }),
        el("span", { className: "q-title", text: q.question_text }),
        el("div", { className: "acc-meter" }, [
          el("div", { className: "acc-bar-track" }, [fill]),
          el("span", { text: formatPercent(q.accuracy_percent) }),
        ]),
        el("span", { className: "q-stats-cell", text: `⏱ ${formatSeconds(q.average_time_seconds)}` }),
      ]
    );
    dom.questionsChartHost.appendChild(btn);
  }
}

function renderAllParticipantsTable(report) {
  clear(dom.allTbody);
  const filtered = filterParticipants(report.all_ranked, state.searchQuery);
  dom.allCountDesc.textContent = `Exibindo ${filtered.length} de ${report.all_ranked.length} participantes.`;

  for (const p of filtered) {
    dom.allTbody.appendChild(
      el("tr", {}, [
        el("td", { text: String(p.rank) }),
        el("td", { text: `#${p.sheet_rank}` }),
        el("td", {}, [el("strong", { text: p.display_name })]),
        el("td", { text: p.player_name || "--" }),
        el("td", { className: "num", text: formatNumber(p.score) }),
        buildAccuracyCell(p.accuracy_percent),
        el("td", { className: "num", text: `${p.correct} / ${p.attempted_questions}` }),
        el("td", { className: "num", text: formatSeconds(p.total_time_seconds) }),
        el("td", { text: p.device_info }),
      ])
    );
  }
}

function renderReport(report) {
  state.report = report;
  dom.quizSubtitle.textContent = `${report.filename} · ${report.details?.game_type || "Quiz"}`;

  renderSessionMeta(report);
  renderKpis(report);
  renderPodium(report.top_10);
  renderTop10Table(report);

  renderBarChart(dom.chartAccuracyDist, report.accuracy_distribution, dom.chartTooltip, {
    ariaLabel: "Distribuição de acurácia em porcentagem",
    barColor: "var(--success)",
  });
  renderBarChart(dom.chartScoreDist, report.score_distribution, dom.chartTooltip, {
    ariaLabel: "Distribuição de pontuação",
    barColor: "var(--accent)",
  });

  const top10Set = new Set(report.top_10.map((p) => p.rank));
  renderScatterPlot(dom.chartScatter, report.all_ranked, top10Set, dom.chartTooltip, {
    top10Color: "var(--accent)",
    otherColor: "var(--scatter-other)",
  });

  renderDescriptiveStats(report);
  renderDevices(report.device_breakdown);
  renderQuestions(report);
  renderAllParticipantsTable(report);
}

async function loadReport({ forceRefresh = false } = {}) {
  try {
    setStatus("Carregando estatísticas e ranking...");
    const report = await api.fetchReport({
      file: state.selectedFile,
      sortBy: state.sortBy,
      includeZero: state.includeZero,
      forceRefresh,
    });
    setStatus("");
    renderReport(report);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Erro ao carregar dados.", true);
  }
}

async function initDatasetsAndLoad({ forceRefresh = false } = {}) {
  try {
    const datasets = await api.listDatasets({ forceRefresh });
    state.datasets = datasets;
    clear(dom.datasetSelect);

    if (datasets.length === 0) {
      dom.datasetSelect.appendChild(el("option", { value: "", text: "Nenhum dataset encontrado" }));
      setStatus("Nenhum dataset encontrado. Execute build_static_data.py após adicionar arquivos em dados/.", true);
      return;
    }

    for (const file of datasets) {
      dom.datasetSelect.appendChild(el("option", { attrs: { value: file }, text: file }));
    }
    if (!state.selectedFile || !datasets.includes(state.selectedFile)) {
      state.selectedFile = datasets[0];
    }
    dom.datasetSelect.value = state.selectedFile;
    await loadReport({ forceRefresh });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Falha ao consultar datasets.", true);
  }
}

const themeController = new ThemeController({
  root: document.documentElement,
  button: dom.themeToggleBtn,
  storage: (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })(),
});

function toggleTheme() {
  themeController.toggle();
}

function exportCsv() {
  if (!state.report) return;
  const csv = buildRankingCsv(state.report.all_ranked);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ranking-${state.report.filename.replace(/\.xlsx$/i, "")}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  dom.datasetSelect.addEventListener("change", (event) => {
    state.selectedFile = event.target.value;
    loadReport();
  });
  dom.sortSelect.addEventListener("change", (event) => {
    state.sortBy = event.target.value;
    loadReport();
  });
  dom.includeZeroToggle.addEventListener("change", (event) => {
    state.includeZero = event.target.checked;
    loadReport();
  });
  dom.refreshBtn.addEventListener("click", () => initDatasetsAndLoad({ forceRefresh: true }));
  dom.exportCsvBtn.addEventListener("click", exportCsv);
  dom.themeToggleBtn.addEventListener("click", toggleTheme);
  dom.participantSearch.addEventListener("input", (event) => {
    state.searchQuery = event.target.value;
    if (state.report) {
      renderAllParticipantsTable(state.report);
    }
  });
  dom.dialogCloseBtn.addEventListener("click", () => {
    if (typeof dom.questionDialog.close === "function") {
      dom.questionDialog.close();
    }
  });
  dom.questionDialog.addEventListener("click", (event) => {
    if (event.target === dom.questionDialog && typeof dom.questionDialog.close === "function") {
      dom.questionDialog.close();
    }
  });
}

themeController.init();
const tabController = new TabController({
  tabButtons: Array.from(document.querySelectorAll("[data-tab]")),
  tabPanels: Array.from(document.querySelectorAll("[data-tab-panel]")),
  initialTab: normalizeTabId(window.location.hash),
  onChange: (tabId) => {
    const nextHash = `#${tabId}`;
    if (window.location.hash !== nextHash) {
      history.replaceState(null, "", nextHash);
    }
  },
});

window.addEventListener("hashchange", () => {
  tabController.activate(normalizeTabId(window.location.hash), { notify: false });
});

tabController.init();
bindEvents();
initDatasetsAndLoad();
