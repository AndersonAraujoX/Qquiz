/**
 * Main Quiz Analytics Dashboard controller (Static GitHub Pages compatible).
 */

import { ALL_DATASETS_KEY, QuizApiClient } from "./modules/api_client.js";
import { normalizeParticipantKey } from "./modules/analytics.js";
import {
  renderBarChart,
  renderRankingProgressionChart,
  renderScatterPlot,
} from "./modules/charts.js";
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
import { LocaleController, applyStaticTranslations, t } from "./modules/i18n.js";
import { TabController, normalizeTabId } from "./modules/tabs.js";
import { ThemeController } from "./modules/theme.js";

const api = new QuizApiClient();

const state = {
  datasets: [],
  selectedFile: "",
  sortBy: "score",
  includeZero: false,
  searchQuery: "",
  progressionSearch: "",
  progressionLimit: 10,
  selectedStudentKey: "",
  locale: "pt",
  report: null,
};

const dom = {
  quizSubtitle: document.getElementById("quiz-subtitle"),
  datasetSelect: document.getElementById("dataset-select"),
  sortSelect: document.getElementById("sort-select"),
  includeZeroToggle: document.getElementById("include-zero-toggle"),
  refreshBtn: document.getElementById("refresh-btn"),
  exportCsvBtn: document.getElementById("export-csv-btn"),
  langToggleBtn: document.getElementById("lang-toggle-btn"),
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
  chartAttemptedDist: document.getElementById("chart-attempted-dist"),
  chartScatter: document.getElementById("chart-scatter"),
  statsSampleLabel: document.getElementById("stats-sample-label"),
  descriptiveTbody: document.getElementById("descriptive-tbody"),
  deviceBreakdownHost: document.getElementById("device-breakdown-host"),
  quizComparisonSection: document.getElementById("quiz-comparison-section"),
  quizComparisonTbody: document.getElementById("quiz-comparison-tbody"),
  studentDetailSelect: document.getElementById("student-detail-select"),
  studentDetailSummary: document.getElementById("student-detail-summary"),
  studentQuestionsHost: document.getElementById("student-questions-host"),
  progressionLimitSelect: document.getElementById("progression-limit-select"),
  progressionNotice: document.getElementById("progression-notice"),
  progressionSwitchBtn: document.getElementById("progression-switch-btn"),
  progressionChartCard: document.getElementById("progression-chart-card"),
  chartRankingProgression: document.getElementById("chart-ranking-progression"),
  progressionTableHeader: document.getElementById("progression-table-header"),
  progressionCountDesc: document.getElementById("progression-count-desc"),
  progressionSearch: document.getElementById("progression-search"),
  progressionTableCard: document.getElementById("progression-table-card"),
  progressionTheadRow: document.getElementById("progression-thead-row"),
  progressionTbody: document.getElementById("progression-tbody"),
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

function getSafeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

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

function renderDatasetSelectOptions() {
  clear(dom.datasetSelect);
  if (state.datasets.length === 0) {
    dom.datasetSelect.appendChild(
      el("option", { value: "", text: t(state.locale, "noDatasetOption") })
    );
    return;
  }

  if (state.datasets.length > 1) {
    dom.datasetSelect.appendChild(
      el("option", {
        attrs: { value: ALL_DATASETS_KEY },
        text: t(state.locale, "combinedOption", { count: state.datasets.length }),
      })
    );
  }

  for (const file of state.datasets) {
    dom.datasetSelect.appendChild(el("option", { attrs: { value: file }, text: file }));
  }

  const validChoices =
    state.datasets.length > 1 ? [ALL_DATASETS_KEY, ...state.datasets] : state.datasets;
  if (!state.selectedFile || !validChoices.includes(state.selectedFile)) {
    state.selectedFile = state.datasets.length > 1 ? ALL_DATASETS_KEY : state.datasets[0];
  }
  dom.datasetSelect.value = state.selectedFile;
}

function resolveDisplayFilename(report) {
  const count = Number(report.details?.dataset_count);
  if (count > 1) {
    return t(state.locale, "combinedFilename", { count });
  }
  return report.filename;
}

function resolveDisplayGameType(report) {
  if (Number(report.details?.dataset_count) > 1) {
    return t(state.locale, "combinedGameType");
  }
  return report.details?.game_type || "Quiz";
}

function renderSessionMeta(report) {
  clear(dom.sessionMeta);
  const details = report.details || {};
  const isCombined = Array.isArray(details.quiz_titles) && details.quiz_titles.length > 1;
  const chips = [
    [
      isCombined ? t(state.locale, "metaQuizzesSummed") : t(state.locale, "metaFile"),
      isCombined ? details.quiz_titles.join(" + ") : report.filename,
    ],
    [t(state.locale, "metaType"), resolveDisplayGameType(report)],
    [t(state.locale, "metaStarted"), details.game_started_on || "--"],
    [t(state.locale, "metaEnded"), details.game_ended_on || "--"],
    [
      isCombined ? t(state.locale, "metaUniqueCombined") : t(state.locale, "metaUniqueSheet"),
      String(details.reported_participants ?? "--"),
    ],
    [
      t(state.locale, "metaAttempts"),
      String(details.total_raw_attempts ?? report.total_attempts_count),
    ],
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
  const lang = state.locale;
  const zeroCount = report.total_attempts_count - report.active_participants_count;
  const kpis = [
    {
      label: t(lang, "kpiStudents"),
      value: String(report.filtered_count),
      sub: t(lang, "kpiStudentsSub", {
        active: report.active_participants_count,
        zero: zeroCount,
      }),
    },
    {
      label: t(lang, "kpiClassAcc"),
      value: formatPercent(report.details?.class_accuracy_percent ?? report.accuracy_stats.mean),
      sub: t(lang, "kpiClassAccSub", { median: formatPercent(report.accuracy_stats.median) }),
    },
    {
      label: t(lang, "kpiMeanScore"),
      value: formatNumber(report.score_stats.mean, lang),
      sub: t(lang, "kpiMeanScoreSub", {
        median: formatNumber(report.score_stats.median, lang),
        max: formatNumber(report.score_stats.max_value, lang),
      }),
    },
    {
      label: t(lang, "kpiMeanTime"),
      value: formatSeconds(report.time_stats.mean),
      sub: t(lang, "kpiMeanTimeSub", { median: formatSeconds(report.time_stats.median) }),
    },
    {
      label: t(lang, "kpiLeader"),
      value: h.leader_name ? String(h.leader_name) : "--",
      sub:
        h.leader_score !== undefined
          ? t(lang, "kpiLeaderSub", {
              score: formatNumber(Number(h.leader_score), lang),
              acc: formatPercent(Number(h.leader_accuracy || 0)),
            })
          : t(lang, "kpiNoRecords"),
    },
    {
      label: t(lang, "kpiThresholds"),
      value: `${h.above_70_percent_count ?? 0} / ${h.perfect_scores_count ?? 0}`,
      sub: t(lang, "kpiThresholdsSub"),
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
  const lang = state.locale;
  const top3 = top10.slice(0, 3);
  if (top3.length === 0) {
    dom.podiumGrid.appendChild(
      el("p", { className: "muted-small", text: t(lang, "podiumEmpty") })
    );
    return;
  }

  for (const student of top3) {
    const subParts = [];
    if (student.player_name && student.player_name !== student.display_name) {
      subParts.push(t(lang, "podiumNickname", { nick: student.player_name }));
    } else if (!student.total_quizzes || student.total_quizzes <= 1) {
      subParts.push(t(lang, "podiumSheetRank", { rank: student.sheet_rank }));
    }
    if (student.total_quizzes > 1) {
      subParts.push(
        t(lang, "podiumQuizzes", {
          count: student.quizzes_count,
          total: student.total_quizzes,
        })
      );
    }

    dom.podiumGrid.appendChild(
      el("article", { className: `podium-card rank-${student.rank}` }, [
        el("div", { className: "podium-top" }, [
          el("span", { className: "medal-pill", text: medalLabel(student.rank, lang) }),
          el("span", {
            className: "podium-score",
            text: `${formatNumber(student.score, lang)} ${t(lang, "chartPointsUnit")}`,
          }),
        ]),
        el("h3", { className: "podium-name", text: student.display_name }),
        el("span", {
          className: "podium-nick",
          text: subParts.join(" · "),
        }),
        el("div", { className: "podium-metrics" }, [
          el("span", {
            text: t(lang, "podiumAcc", { value: formatPercent(student.accuracy_percent) }),
          }),
          el("span", {
            text: t(lang, "podiumHits", {
              correct: student.correct,
              attempted: student.attempted_questions,
            }),
          }),
          el("span", {
            text: t(lang, "podiumTime", { value: formatSeconds(student.total_time_seconds) }),
          }),
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
  const lang = state.locale;
  dom.rankingModeBadge.textContent =
    report.sort_by === "sheet_rank"
      ? t(lang, "rankingModeSheet")
      : t(lang, "rankingModeScore");

  for (const p of report.top_10) {
    const rankClass = p.rank <= 3 ? `rank-badge top-${p.rank}` : "rank-badge";
    const row = el("tr", {}, [
      el("td", {}, [el("span", { className: rankClass, text: String(p.rank) })]),
      el("td", {}, [el("strong", { text: p.display_name })]),
      el("td", { text: p.player_name || "--" }),
      el("td", { className: "num", text: formatNumber(p.score, lang) }),
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
  const lang = state.locale;
  dom.statsSampleLabel.textContent = t(lang, "sampleLabel", { count: report.filtered_count });

  const corr = report.time_score_correlation;
  if (corr === null || corr === undefined) {
    dom.correlationBadge.textContent = t(lang, "corrUnavailable");
  } else {
    const dir =
      corr < -0.2
        ? t(lang, "corrNeg")
        : corr > 0.2
          ? t(lang, "corrPos")
          : t(lang, "corrWeak");
    dom.correlationBadge.textContent = t(lang, "corrLabel", {
      r: corr.toFixed(2),
      dir,
    });
  }

  const fmtNum = (v) => formatNumber(v, lang);
  const rows = [
    { label: t(lang, "metricScore"), stats: report.score_stats, fmt: fmtNum },
    { label: t(lang, "metricAccuracy"), stats: report.accuracy_stats, fmt: formatPercent },
    { label: t(lang, "metricTime"), stats: report.time_stats, fmt: formatSeconds },
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
      el("p", { className: "muted-small", text: t(state.locale, "noDevices") })
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

function renderQuizComparison(report) {
  if (!dom.quizComparisonSection || !dom.quizComparisonTbody) {
    return;
  }
  clear(dom.quizComparisonTbody);
  const summaries = report.details?.quiz_summaries;
  if (!Array.isArray(summaries) || summaries.length <= 1) {
    dom.quizComparisonSection.hidden = true;
    return;
  }

  const lang = state.locale;
  const ptsUnit = t(lang, "chartPointsUnit");
  dom.quizComparisonSection.hidden = false;

  for (const item of summaries) {
    dom.quizComparisonTbody.appendChild(
      el("tr", {}, [
        el("td", {}, [el("strong", { text: item.title })]),
        el("td", { text: item.started_on || "--" }),
        el("td", { className: "num", text: `${item.active_participants} / ${item.total_attempts}` }),
        el("td", { className: "num", text: formatPercent(item.class_accuracy_percent) }),
        el("td", { className: "num", text: formatNumber(item.mean_score, lang) }),
        el("td", { className: "num", text: formatNumber(item.max_score, lang) }),
        el("td", { className: "num", text: formatSeconds(item.mean_time_seconds) }),
        el("td", {
          text: `${item.leader_name} (${formatNumber(item.leader_score, lang)} ${ptsUnit})`,
        }),
      ])
    );
  }
}

function getStudentSelectionId(participant, index) {
  const key = normalizeParticipantKey(participant);
  return key ? `${key}::${participant.sheet_rank ?? index}` : String(index);
}

function resolveQuestionStatusInfo(status, lang) {
  switch (status) {
    case "correct":
      return { cls: "correct", label: `✓ ${t(lang, "statusCorrect")}` };
    case "incorrect":
      return { cls: "incorrect", label: `✕ ${t(lang, "statusIncorrect")}` };
    case "partial":
      return { cls: "partial", label: `◐ ${t(lang, "statusPartial")}` };
    case "ungraded":
      return { cls: "ungraded", label: `• ${t(lang, "statusUngraded")}` };
    default:
      return { cls: "unattempted", label: `— ${t(lang, "statusUnattempted")}` };
  }
}

function renderStudentBreakdown(report) {
  if (!dom.studentDetailSelect || !dom.studentDetailSummary || !dom.studentQuestionsHost) {
    return;
  }

  const lang = state.locale;
  const participants = Array.isArray(report.all_ranked) ? report.all_ranked : [];
  clear(dom.studentDetailSelect);
  clear(dom.studentDetailSummary);
  clear(dom.studentQuestionsHost);

  if (participants.length === 0) {
    dom.studentQuestionsHost.appendChild(
      el("p", { className: "muted-small", text: t(lang, "studentNoData") })
    );
    return;
  }

  const entries = participants.map((p, idx) => ({
    id: getStudentSelectionId(p, idx),
    key: normalizeParticipantKey(p),
    participant: p,
  }));

  const sortedByName = [...entries].sort((a, b) =>
    String(a.participant.display_name).localeCompare(String(b.participant.display_name))
  );

  for (const item of sortedByName) {
    const p = item.participant;
    const optionText = `${p.display_name} (#${p.rank} · ${formatNumber(p.score, lang)} ${t(lang, "chartPointsUnit")})`;
    dom.studentDetailSelect.appendChild(
      el("option", { attrs: { value: item.id }, text: optionText })
    );
  }

  let selectedEntry =
    entries.find((e) => e.id === state.selectedStudentKey) ||
    entries.find((e) => e.key && e.key === state.selectedStudentKey.split("::")[0]) ||
    entries[0];

  state.selectedStudentKey = selectedEntry.id;
  dom.studentDetailSelect.value = selectedEntry.id;

  const student = selectedEntry.participant;
  const answers = Array.isArray(student.question_answers) ? student.question_answers : [];
  const answerByNumber = new Map(answers.map((a) => [Number(a.question_number), a]));
  const questions = Array.isArray(report.questions) ? report.questions : [];

  const correctCount = answers.filter((a) => a.status === "correct").length || student.correct || 0;
  const incorrectCount =
    answers.filter((a) => a.status === "incorrect").length || student.incorrect || 0;
  const unattemptedCount = questions.length
    ? questions.filter((q) => {
        const qa = answerByNumber.get(Number(q.number));
        return !qa || qa.status === "unattempted";
      }).length
    : student.unattempted || 0;

  dom.studentDetailSummary.appendChild(
    el("span", {
      className: "pill-badge",
      text: `#${student.rank} · ${formatNumber(student.score, lang)} ${t(lang, "chartPointsUnit")} (${formatPercent(student.accuracy_percent)})`,
    })
  );
  dom.studentDetailSummary.appendChild(
    el("span", {
      className: "highlight-tag easy",
      text: t(lang, "studentCorrectCount", { count: correctCount }),
    })
  );
  dom.studentDetailSummary.appendChild(
    el("span", {
      className: "highlight-tag hard",
      text: t(lang, "studentIncorrectCount", { count: incorrectCount }),
    })
  );
  dom.studentDetailSummary.appendChild(
    el("span", {
      className: "meta-chip",
      text: t(lang, "studentUnattemptedCount", { count: unattemptedCount }),
    })
  );

  if (questions.length === 0 || answers.length === 0) {
    dom.studentQuestionsHost.appendChild(
      el("p", { className: "muted-small", text: t(lang, "studentAnswersUnavailable") })
    );
    return;
  }

  for (const q of questions) {
    const qa = answerByNumber.get(Number(q.number)) || {
      question_number: q.number,
      status: "unattempted",
      response: "",
    };
    const statusInfo = resolveQuestionStatusInfo(qa.status, lang);
    const contentChildren = [
      el("span", { className: "student-question-text", text: q.question_text }),
    ];
    if (qa.response) {
      contentChildren.push(
        el("span", {
          className: "student-response-text",
          text: t(lang, "studentAnswerPrefix", { answer: qa.response }),
        })
      );
    }

    dom.studentQuestionsHost.appendChild(
      el("div", { className: "student-question-row" }, [
        el("span", { className: "q-num", text: `Q${q.number}` }),
        el("div", { className: "student-question-content" }, contentChildren),
        el("span", {
          className: `q-status-badge ${statusInfo.cls}`,
          text: statusInfo.label,
        }),
      ])
    );
  }
}

function openQuestionDialog(q) {
  const lang = state.locale;
  dom.dialogTitle.textContent = t(lang, "questionDialogTitle", {
    number: q.number,
    type: q.question_type,
  });
  clear(dom.dialogBody);

  dom.dialogBody.appendChild(el("p", { text: q.question_text }));
  dom.dialogBody.appendChild(
    el("div", { className: "dialog-metrics" }, [
      el("div", { className: "dialog-metric-box" }, [
        el("div", { className: "kpi-label", text: t(lang, "qAcc") }),
        el("strong", { text: formatPercent(q.accuracy_percent) }),
      ]),
      el("div", { className: "dialog-metric-box" }, [
        el("div", { className: "kpi-label", text: t(lang, "qAvgTime") }),
        el("strong", { text: formatSeconds(q.average_time_seconds) }),
      ]),
      el("div", { className: "dialog-metric-box" }, [
        el("div", { className: "kpi-label", text: t(lang, "qCorrect") }),
        el("strong", { text: String(q.correct_count) }),
      ]),
      el("div", { className: "dialog-metric-box" }, [
        el("div", { className: "kpi-label", text: t(lang, "qIncorrect") }),
        el("strong", { text: String(q.incorrect_count) }),
      ]),
      el("div", { className: "dialog-metric-box" }, [
        el("div", { className: "kpi-label", text: t(lang, "qUnattempted") }),
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
  const lang = state.locale;

  if (report.easiest_question) {
    dom.questionHighlights.appendChild(
      el("span", {
        className: "highlight-tag easy",
        text: t(lang, "easiestQuestion", {
          number: report.easiest_question.number,
          acc: formatPercent(report.easiest_question.accuracy_percent),
        }),
      })
    );
  }
  if (report.hardest_question) {
    dom.questionHighlights.appendChild(
      el("span", {
        className: "highlight-tag hard",
        text: t(lang, "hardestQuestion", {
          number: report.hardest_question.number,
          acc: formatPercent(report.hardest_question.accuracy_percent),
        }),
      })
    );
  }

  if (!Array.isArray(report.questions) || report.questions.length === 0) {
    dom.questionsChartHost.appendChild(
      el("p", { className: "muted-small", text: t(lang, "noQuestions") })
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
        attrs: { type: "button", title: t(lang, "questionClickTitle") },
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
  const lang = state.locale;
  const filtered = filterParticipants(report.all_ranked, state.searchQuery);
  dom.allCountDesc.textContent = t(lang, "allCountDesc", {
    shown: filtered.length,
    total: report.all_ranked.length,
  });

  for (const p of filtered) {
    dom.allTbody.appendChild(
      el("tr", {}, [
        el("td", { text: String(p.rank) }),
        el("td", { text: `#${p.sheet_rank}` }),
        el("td", {}, [el("strong", { text: p.display_name })]),
        el("td", { text: p.player_name || "--" }),
        el("td", { className: "num", text: formatNumber(p.score, lang) }),
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
  const lang = state.locale;
  dom.quizSubtitle.textContent = `${resolveDisplayFilename(report)} · ${resolveDisplayGameType(report)}`;

  renderSessionMeta(report);
  renderKpis(report);
  renderPodium(report.top_10);
  renderTop10Table(report);

  renderBarChart(dom.chartAccuracyDist, report.accuracy_distribution, dom.chartTooltip, {
    ariaLabel: t(lang, "chartAccAria"),
    barColor: "var(--success)",
    emptyText: t(lang, "chartBarEmpty"),
    studentsUnit: t(lang, "chartStudentsUnit"),
  });
  renderBarChart(dom.chartScoreDist, report.score_distribution, dom.chartTooltip, {
    ariaLabel: t(lang, "chartScoreAria"),
    barColor: "var(--accent)",
    emptyText: t(lang, "chartBarEmpty"),
    studentsUnit: t(lang, "chartStudentsUnit"),
  });
  renderBarChart(dom.chartAttemptedDist, report.attempted_distribution, dom.chartTooltip, {
    ariaLabel: t(lang, "chartAttemptedAria"),
    barColor: "var(--chart-questions)",
    emptyText: t(lang, "chartBarEmpty"),
    studentsUnit: t(lang, "chartStudentsUnit"),
  });

  const top10Set = new Set(report.top_10.map((p) => p.rank));
  renderScatterPlot(dom.chartScatter, report.all_ranked, top10Set, dom.chartTooltip, {
    top10Color: "var(--accent)",
    otherColor: "var(--scatter-other)",
    emptyText: t(lang, "chartScatterEmpty"),
    ariaLabel: t(lang, "chartScatterAria"),
    xAxisLabel: t(lang, "chartScatterXAxis"),
    pointsUnit: t(lang, "chartPointsUnit"),
    inTimeLabel: t(lang, "chartInTime"),
    locale: lang,
  });

function renderRankingProgression(report) {
  if (!dom.chartRankingProgression || !dom.progressionTheadRow || !dom.progressionTbody) {
    return;
  }

  const lang = state.locale;
  const progression = report.details?.ranking_progression;
  const hasStages =
    progression && Array.isArray(progression.stages) && progression.stages.length >= 2;

  if (dom.progressionNotice) dom.progressionNotice.hidden = Boolean(hasStages);
  if (dom.progressionSwitchBtn) {
    dom.progressionSwitchBtn.hidden = state.datasets.length < 2;
  }
  if (dom.progressionChartCard) dom.progressionChartCard.hidden = !hasStages;
  if (dom.progressionTableHeader) dom.progressionTableHeader.hidden = !hasStages;
  if (dom.progressionTableCard) dom.progressionTableCard.hidden = !hasStages;

  if (!hasStages) {
    clear(dom.chartRankingProgression);
    clear(dom.progressionTheadRow);
    clear(dom.progressionTbody);
    return;
  }

  renderRankingProgressionChart(
    dom.chartRankingProgression,
    progression,
    dom.chartTooltip,
    {
      maxSeries: state.progressionLimit,
      emptyText: t(lang, "progressionNeedCombined"),
      ariaLabel: t(lang, "progressionChartAria"),
      stagePrefix: t(lang, "progressionStagePrefix"),
      pointsUnit: t(lang, "chartPointsUnit"),
      locale: lang,
    }
  );

  clear(dom.progressionTheadRow);
  dom.progressionTheadRow.appendChild(
    el("th", { attrs: { scope: "col" }, text: t(lang, "thFinalRank") })
  );
  dom.progressionTheadRow.appendChild(
    el("th", { attrs: { scope: "col" }, text: t(lang, "thStudent") })
  );
  progression.stages.forEach((stage, idx) => {
    dom.progressionTheadRow.appendChild(
      el("th", {
        className: "num",
        attrs: { scope: "col", title: stage.started_on || stage.title },
        text: `${t(lang, "progressionStagePrefix")} ${idx + 1}`,
      })
    );
  });
  dom.progressionTheadRow.appendChild(
    el("th", { className: "num", attrs: { scope: "col" }, text: t(lang, "thDelta") })
  );
  dom.progressionTheadRow.appendChild(
    el("th", { className: "num", attrs: { scope: "col" }, text: t(lang, "thFinalScore") })
  );

  const needle = state.progressionSearch.trim().toLowerCase();
  const filtered = needle
    ? progression.participants.filter((p) =>
        String(p.display_name).toLowerCase().includes(needle)
      )
    : progression.participants;

  if (dom.progressionCountDesc) {
    dom.progressionCountDesc.textContent = t(lang, "progressionTableSub", {
      shown: filtered.length,
      total: progression.participants.length,
    });
  }

  clear(dom.progressionTbody);
  for (const p of filtered) {
    const rankClass = p.final_rank <= 3 ? `rank-badge top-${p.final_rank}` : "rank-badge";
    const deltaClass = p.delta > 0 ? "up" : p.delta < 0 ? "down" : "flat";
    const deltaText = p.delta > 0 ? `▲ +${p.delta}` : p.delta < 0 ? `▼ ${p.delta}` : "=";

    const cells = [
      el("td", {}, [el("span", { className: rankClass, text: String(p.final_rank) })]),
      el("td", {}, [el("strong", { text: p.display_name })]),
      ...p.ranks.map((r) =>
        el("td", { className: "num", text: typeof r === "number" ? `#${r}` : "—" })
      ),
      el("td", { className: "num" }, [
        el("span", { className: `delta-pill ${deltaClass}`, text: deltaText }),
      ]),
      el("td", { className: "num", text: formatNumber(p.final_score, lang) }),
    ];
    dom.progressionTbody.appendChild(el("tr", {}, cells));
  }
}

  renderDescriptiveStats(report);
  renderDevices(report.device_breakdown);
  renderQuizComparison(report);
  renderStudentBreakdown(report);
  renderQuestions(report);
  renderAllParticipantsTable(report);
  renderRankingProgression(report);
}

function applyLocaleToUi(locale) {
  state.locale = locale;
  applyStaticTranslations(document, locale);
  themeController.setLocale(locale);
  renderDatasetSelectOptions();
  if (state.report) {
    renderReport(state.report);
  } else {
    dom.quizSubtitle.textContent = t(locale, "loadingSubtitle");
  }
}

async function loadReport({ forceRefresh = false } = {}) {
  try {
    setStatus(t(state.locale, "loadingStatus"));
    const report = await api.fetchReport({
      file: state.selectedFile,
      sortBy: state.sortBy,
      includeZero: state.includeZero,
      forceRefresh,
    });
    setStatus("");
    renderReport(report);
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : t(state.locale, "loadError"),
      true
    );
  }
}

async function initDatasetsAndLoad({ forceRefresh = false } = {}) {
  try {
    const datasets = await api.listDatasets({ forceRefresh });
    state.datasets = datasets;
    renderDatasetSelectOptions();

    if (datasets.length === 0) {
      setStatus(t(state.locale, "noDatasetStatus"), true);
      return;
    }

    await loadReport({ forceRefresh });
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : t(state.locale, "datasetsError"),
      true
    );
  }
}

const storage = getSafeStorage();

const themeController = new ThemeController({
  root: document.documentElement,
  button: dom.themeToggleBtn,
  storage,
});

const localeController = new LocaleController({
  root: document.documentElement,
  button: dom.langToggleBtn,
  storage,
  onChange: (nextLocale) => {
    applyLocaleToUi(nextLocale);
  },
});

function toggleTheme() {
  themeController.toggle();
}

function exportCsv() {
  if (!state.report) return;
  const csv = buildRankingCsv(state.report.all_ranked, state.locale);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const rawStem = state.report.filename.replace(/\.xlsx$/i, "");
  const safeStem = rawStem.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "quiz";
  link.download = `ranking-${safeStem}.csv`;
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
  dom.langToggleBtn.addEventListener("click", () => localeController.toggle());
  dom.themeToggleBtn.addEventListener("click", toggleTheme);
  dom.participantSearch.addEventListener("input", (event) => {
    state.searchQuery = event.target.value;
    if (state.report) {
      renderAllParticipantsTable(state.report);
    }
  });
  if (dom.studentDetailSelect) {
    dom.studentDetailSelect.addEventListener("change", (event) => {
      state.selectedStudentKey = event.target.value;
      if (state.report) {
        renderStudentBreakdown(state.report);
      }
    });
  }
  if (dom.progressionLimitSelect) {
    dom.progressionLimitSelect.addEventListener("change", (event) => {
      state.progressionLimit = Number(event.target.value) || 10;
      if (state.report) {
        renderRankingProgression(state.report);
      }
    });
  }
  if (dom.progressionSearch) {
    dom.progressionSearch.addEventListener("input", (event) => {
      state.progressionSearch = event.target.value;
      if (state.report) {
        renderRankingProgression(state.report);
      }
    });
  }
  if (dom.progressionSwitchBtn) {
    dom.progressionSwitchBtn.addEventListener("click", () => {
      if (state.datasets.length > 1) {
        state.selectedFile = ALL_DATASETS_KEY;
        dom.datasetSelect.value = ALL_DATASETS_KEY;
        loadReport();
      }
    });
  }
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
state.locale = localeController.init();
applyLocaleToUi(state.locale);

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
