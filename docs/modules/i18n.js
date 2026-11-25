/**
 * Lightweight bilingual (PT-BR / EN) internationalization module with dependency injection.
 * Uses only textContent and attribute updates (never innerHTML).
 */

export const LOCALE_STORAGE_KEY = "quiz_analytics_locale";
export const DEFAULT_LOCALE = "pt";
export const SUPPORTED_LOCALES = new Set(["pt", "en"]);

export const TRANSLATIONS = {
  pt: {
    pageTitle: "Quantum Quiz Analytics — Top 10 & Estatísticas",
    skipLink: "Pular para o conteúdo principal",
    brandTag: "Wayground Look",
    controlsAria: "Controles do painel",
    controlDataset: "Quiz / Visão",
    controlSort: "Critério Top 10",
    sortScore: "Pontuação (Score)",
    sortSheetRank: "Acertos + Menor Tempo",
    includeZero: "Incluir 0 questões",
    refreshBtn: "Atualizar",
    refreshTitle: "Recarregar dados",
    exportCsvBtn: "Exportar CSV",
    exportCsvTitle: "Exportar ranking em CSV",
    themeTitle: "Alternar tema claro/escuro",
    langTitle: "Alternar idioma (Português / English)",
    langButton: "PT → EN",
    tabTop10: "Top 10 Melhores Alunos",
    tabStats: "Dados Estatísticos",
    tabProgression: "Evolução no Ranking",
    headingProgression: "Evolução da Colocação por Quiz",
    descProgression: "Posição acumulada de cada candidato do primeiro até o último quiz.",
    progressionLimitLabel: "Exibir no gráfico",
    progressionTop5: "Top 5",
    progressionTop10: "Top 10",
    progressionTop15: "Top 15",
    progressionChartTitle: "Trajetória no Ranking (1º ao Último Quiz)",
    progressionChartSub: "Quanto mais alto na linha, melhor a colocação (#1 no topo)",
    progressionTableTitle: "Tabela de Colocações por Quiz",
    progressionTableSub: "Mostrando {shown} de {total} candidatos",
    progressionSearchPlaceholder: "Filtrar candidato...",
    progressionNeedCombined: "Selecione 'Soma Geral' no topo (com 2 ou mais quizzes) para visualizar a evolução das colocações.",
    progressionSwitchBtn: "Ver Soma Geral",
    thFinalRank: "Final",
    thDelta: "Variação",
    thFinalScore: "Pontuação Final",
    progressionStagePrefix: "Quiz",
    progressionChartAria: "Gráfico de evolução da colocação dos candidatos ao longo dos quizzes",
    headingTop10: "Top 10 Melhores Alunos",
    descTop10: "Pódio e classificação dos 10 melhores desempenhos.",
    headingAll: "Classificação Completa",
    searchPlaceholder: "Filtrar por nome, apelido ou dispositivo...",
    searchSrOnly: "Buscar aluno",
    thRank: "#",
    thSheetRank: "Rank Planilha",
    thStudent: "Aluno",
    thNickname: "Apelido",
    thScore: "Pontuação",
    thAccuracy: "Acurácia",
    thCorrect: "Acertos",
    thCorrectAttempted: "Acertos / Tent.",
    thTotalTime: "Tempo Total",
    thTime: "Tempo",
    thDevice: "Dispositivo",
    heroEyebrow: "Painel Estatístico",
    heroHint: "Visão geral da turma e indicadores de desempenho",
    headingStats: "Dados Estatísticos da Turma",
    descStats: "Distribuições, dispersão tempo × pontuação, análise descritiva e dificuldade por questão.",
    chartAccTitle: "Distribuição de Acurácia (% de acertos)",
    chartAccSub: "Quantidade de alunos por faixa de acerto",
    chartScoreTitle: "Distribuição de Pontuação (Score)",
    chartScoreSub: "Frequência de alunos por faixa de pontos",
    chartAttemptedTitle: "Distribuição de Questões Participadas",
    chartAttemptedSub: "Quantidade de alunos por faixa de questões respondidas",
    chartScatterTitle: "Dispersão: Tempo Total vs Pontuação",
    chartScatterSub: "Relação entre rapidez e nota final (Top 10 em destaque)",
    headingDescriptive: "Estatística Descritiva",
    thMetric: "Métrica",
    thMean: "Média",
    thMedian: "Mediana",
    thStdDev: "Desvio Padrão",
    thMin: "Mínimo",
    thMax: "Máximo",
    headingDevices: "Dispositivos e Navegadores",
    devicesSub: "Origem dos acessos",
    headingQuizComparison: "Comparativo por Quiz (Todos os Arquivos)",
    quizComparisonSub: "Estatísticas individuais de cada planilha combinada no painel",
    thQuizFile: "Arquivo / Quiz",
    thQuizDate: "Data",
    thActiveAttempts: "Ativos / Tentativas",
    thClassAccuracy: "Acurácia Turma",
    thMeanScore: "Pontuação Média",
    thMaxScore: "Maior Pontuação",
    thMeanTime: "Tempo Médio",
    thDayLeader: "1º do Dia",
    headingStudentDetail: "Desempenho Individual por Aluno",
    descStudentDetail: "Selecione o nome do aluno para ver quais questões ele acertou e errou.",
    selectStudentLabel: "Aluno",
    selectStudentAria: "Selecionar aluno para ver acertos e erros por questão",
    studentNoData: "Nenhum aluno disponível para exibir respostas por questão.",
    studentAnswersUnavailable: "Sem detalhamento de respostas por questão para este aluno.",
    studentCorrectCount: "Acertou: {count}",
    studentIncorrectCount: "Errou: {count}",
    studentUnattemptedCount: "Não tentou: {count}",
    statusCorrect: "Acertou",
    statusIncorrect: "Errou",
    statusPartial: "Parcial",
    statusUnattempted: "Não tentou",
    statusUngraded: "Sem nota",
    studentAnswerPrefix: "Resposta: {answer}",
    headingQuestions: "Desempenho por Questão",
    descQuestions: "Clique em uma questão para inspecionar o enunciado e os contadores detalhados.",
    dialogDefaultTitle: "Detalhes da Questão",
    dialogClose: "Fechar",
    loadingSubtitle: "Carregando dados...",
    loadingStatus: "Carregando estatísticas e ranking...",
    loadError: "Erro ao carregar dados.",
    datasetsError: "Falha ao consultar datasets.",
    noDatasetOption: "Nenhum dataset encontrado",
    noDatasetStatus: "Nenhum dataset encontrado. Execute build_static_data.py após adicionar arquivos em dados/.",
    combinedOption: "Soma Geral ({count} quizzes)",
    combinedFilename: "Soma Geral ({count} quizzes)",
    combinedGameType: "Ranking Acumulado",
    metaQuizzesSummed: "Quizzes somados",
    metaFile: "Arquivo",
    metaType: "Tipo",
    metaStarted: "Início",
    metaEnded: "Término",
    metaUniqueCombined: "Participantes únicos (combinados)",
    metaUniqueSheet: "Participantes únicos (planilha)",
    metaAttempts: "Total de linhas/tentativas",
    kpiStudents: "Alunos Analisados",
    kpiStudentsSub: "{active} ativos · {zero} com 0 questões",
    kpiClassAcc: "Acurácia da Turma",
    kpiClassAccSub: "Mediana individual: {median}",
    kpiMeanScore: "Pontuação Média",
    kpiMeanScoreSub: "Mediana: {median} · Máx: {max}",
    kpiMeanTime: "Tempo Médio Ativo",
    kpiMeanTimeSub: "Mediana: {median}",
    kpiLeader: "Líder Geral",
    kpiLeaderSub: "{score} pts ({acc})",
    kpiNoRecords: "Sem registros",
    kpiThresholds: "Notas ≥ 70% / 100%",
    kpiThresholdsSub: "Acima de 70% / gabaritaram",
    podiumEmpty: "Nenhum aluno encontrado para o pódio.",
    podiumNickname: "Apelido: {nick}",
    podiumSheetRank: "Rank na planilha: #{rank}",
    podiumQuizzes: "{count}/{total} quizzes",
    podiumAcc: "Acurácia: {value}",
    podiumHits: "Acertos: {correct}/{attempted}",
    podiumTime: "Tempo: {value}",
    rankingModeSheet: "Ordenado por Acertos + Menor Tempo",
    rankingModeScore: "Ordenado por Pontuação (Score)",
    sampleLabel: "Amostra: {count} registros",
    corrUnavailable: "Correlação Tempo × Score: N/D",
    corrNeg: "negativa (mais rápido = maior nota)",
    corrPos: "positiva",
    corrWeak: "fraca",
    corrLabel: "Correlação Tempo × Score: r = {r} ({dir})",
    metricScore: "Pontuação (Score)",
    metricAccuracy: "Acurácia (%)",
    metricTime: "Tempo Total",
    noDevices: "Sem dados de dispositivos.",
    questionDialogTitle: "Questão {number} · {type}",
    qAcc: "Acurácia",
    qAvgTime: "Tempo Médio",
    qCorrect: "Corretas",
    qIncorrect: "Incorretas",
    qUnattempted: "Não tentadas",
    easiestQuestion: "Mais fácil: Q{number} ({acc})",
    hardestQuestion: "Mais difícil: Q{number} ({acc})",
    noQuestions: "Nenhuma questão encontrada na aba Overview.",
    questionClickTitle: "Clique para ver detalhes da questão",
    allCountDesc: "Exibindo {shown} de {total} participantes.",
    chartAccAria: "Distribuição de acurácia em porcentagem",
    chartScoreAria: "Distribuição de pontuação",
    chartAttemptedAria: "Distribuição de questões participadas",
    chartBarEmpty: "Sem dados suficientes para exibir distribuição.",
    chartScatterEmpty: "Sem registros com tempo maior que zero para dispersão.",
    chartScatterAria: "Gráfico de dispersão entre tempo total e pontuação",
    chartScatterXAxis: "Tempo Total (mm:ss)",
    chartStudentsUnit: "alunos",
    chartPointsUnit: "pts",
    chartInTime: "em",
  },
  en: {
    pageTitle: "Quantum Quiz Analytics — Top 10 & Statistics",
    skipLink: "Skip to main content",
    brandTag: "Wayground Look",
    controlsAria: "Dashboard controls",
    controlDataset: "Quiz / View",
    controlSort: "Top 10 Criteria",
    sortScore: "Score (Points)",
    sortSheetRank: "Correct + Fastest Time",
    includeZero: "Include 0 questions",
    refreshBtn: "Refresh",
    refreshTitle: "Reload data",
    exportCsvBtn: "Export CSV",
    exportCsvTitle: "Export ranking as CSV",
    themeTitle: "Toggle light/dark theme",
    langTitle: "Switch language (Português / English)",
    langButton: "EN → PT",
    tabTop10: "Top 10 Leaderboard",
    tabStats: "Statistical Data",
    tabProgression: "Ranking Progression",
    headingProgression: "Ranking Progression Across Quizzes",
    descProgression: "Cumulative placement of each candidate from the first quiz to the last.",
    progressionLimitLabel: "Show in chart",
    progressionTop5: "Top 5",
    progressionTop10: "Top 10",
    progressionTop15: "Top 15",
    progressionChartTitle: "Leaderboard Trajectory (1st to Last Quiz)",
    progressionChartSub: "Higher line means better placement (#1 at the top)",
    progressionTableTitle: "Placement History Table",
    progressionTableSub: "Showing {shown} of {total} candidates",
    progressionSearchPlaceholder: "Filter candidate...",
    progressionNeedCombined: "Select 'Overall Sum' at the top (with 2+ quizzes) to view ranking progression.",
    progressionSwitchBtn: "View Overall Sum",
    thFinalRank: "Final",
    thDelta: "Change",
    thFinalScore: "Final Score",
    progressionStagePrefix: "Quiz",
    progressionChartAria: "Ranking progression bump chart across quizzes",
    headingTop10: "Top 10 Leaderboard",
    descTop10: "Podium and ranking of the top 10 performers.",
    headingAll: "Full Standings",
    searchPlaceholder: "Filter by name, nickname, or device...",
    searchSrOnly: "Search student",
    thRank: "#",
    thSheetRank: "Sheet Rank",
    thStudent: "Student",
    thNickname: "Nickname",
    thScore: "Score",
    thAccuracy: "Accuracy",
    thCorrect: "Correct",
    thCorrectAttempted: "Correct / Att.",
    thTotalTime: "Total Time",
    thTime: "Time",
    thDevice: "Device",
    heroEyebrow: "Statistics Panel",
    heroHint: "Class overview and performance indicators",
    headingStats: "Class Statistical Data",
    descStats: "Distributions, time × score scatter plot, descriptive stats, and per-question difficulty.",
    chartAccTitle: "Accuracy Distribution (% correct)",
    chartAccSub: "Number of students per accuracy bracket",
    chartScoreTitle: "Score Distribution",
    chartScoreSub: "Student frequency per score bracket",
    chartAttemptedTitle: "Questions Participated Distribution",
    chartAttemptedSub: "Number of students by questions attempted bracket",
    chartScatterTitle: "Scatter: Total Time vs Score",
    chartScatterSub: "Relationship between speed and final score (Top 10 highlighted)",
    headingDescriptive: "Descriptive Statistics",
    thMetric: "Metric",
    thMean: "Mean",
    thMedian: "Median",
    thStdDev: "Std. Dev.",
    thMin: "Min",
    thMax: "Max",
    headingDevices: "Devices & Browsers",
    devicesSub: "Access sources",
    headingQuizComparison: "Quiz-by-Quiz Comparison (All Files)",
    quizComparisonSub: "Individual statistics for each spreadsheet combined in the dashboard",
    thQuizFile: "File / Quiz",
    thQuizDate: "Date",
    thActiveAttempts: "Active / Attempts",
    thClassAccuracy: "Class Accuracy",
    thMeanScore: "Mean Score",
    thMaxScore: "Top Score",
    thMeanTime: "Mean Time",
    thDayLeader: "Quiz Leader",
    headingStudentDetail: "Individual Student Breakdown",
    descStudentDetail: "Select a student by name to see which questions they got right or wrong.",
    selectStudentLabel: "Student",
    selectStudentAria: "Select student to inspect per-question results",
    studentNoData: "No students available to display per-question results.",
    studentAnswersUnavailable: "No per-question answer breakdown available for this student.",
    studentCorrectCount: "Correct: {count}",
    studentIncorrectCount: "Incorrect: {count}",
    studentUnattemptedCount: "Unattempted: {count}",
    statusCorrect: "Correct",
    statusIncorrect: "Incorrect",
    statusPartial: "Partial",
    statusUnattempted: "Unattempted",
    statusUngraded: "Ungraded",
    studentAnswerPrefix: "Answer: {answer}",
    headingQuestions: "Performance by Question",
    descQuestions: "Click a question to inspect its prompt and detailed counters.",
    dialogDefaultTitle: "Question Details",
    dialogClose: "Close",
    loadingSubtitle: "Loading data...",
    loadingStatus: "Loading statistics and leaderboard...",
    loadError: "Failed to load data.",
    datasetsError: "Failed to query datasets.",
    noDatasetOption: "No dataset found",
    noDatasetStatus: "No dataset found. Run build_static_data.py after adding files to dados/.",
    combinedOption: "Overall Sum ({count} quizzes)",
    combinedFilename: "Overall Sum ({count} quizzes)",
    combinedGameType: "Cumulative Ranking",
    metaQuizzesSummed: "Summed quizzes",
    metaFile: "File",
    metaType: "Type",
    metaStarted: "Started",
    metaEnded: "Ended",
    metaUniqueCombined: "Unique participants (combined)",
    metaUniqueSheet: "Unique participants (sheet)",
    metaAttempts: "Total rows/attempts",
    kpiStudents: "Students Analyzed",
    kpiStudentsSub: "{active} active · {zero} with 0 questions",
    kpiClassAcc: "Class Accuracy",
    kpiClassAccSub: "Individual median: {median}",
    kpiMeanScore: "Mean Score",
    kpiMeanScoreSub: "Median: {median} · Max: {max}",
    kpiMeanTime: "Mean Active Time",
    kpiMeanTimeSub: "Median: {median}",
    kpiLeader: "Overall Leader",
    kpiLeaderSub: "{score} pts ({acc})",
    kpiNoRecords: "No records",
    kpiThresholds: "Scores ≥ 70% / 100%",
    kpiThresholdsSub: "Above 70% / perfect score",
    podiumEmpty: "No students found for the podium.",
    podiumNickname: "Nickname: {nick}",
    podiumSheetRank: "Sheet rank: #{rank}",
    podiumQuizzes: "{count}/{total} quizzes",
    podiumAcc: "Accuracy: {value}",
    podiumHits: "Correct: {correct}/{attempted}",
    podiumTime: "Time: {value}",
    rankingModeSheet: "Sorted by Correct + Fastest Time",
    rankingModeScore: "Sorted by Score (Points)",
    sampleLabel: "Sample: {count} records",
    corrUnavailable: "Time × Score Correlation: N/A",
    corrNeg: "negative (faster = higher score)",
    corrPos: "positive",
    corrWeak: "weak",
    corrLabel: "Time × Score Correlation: r = {r} ({dir})",
    metricScore: "Score (Points)",
    metricAccuracy: "Accuracy (%)",
    metricTime: "Total Time",
    noDevices: "No device data available.",
    questionDialogTitle: "Question {number} · {type}",
    qAcc: "Accuracy",
    qAvgTime: "Avg. Time",
    qCorrect: "Correct",
    qIncorrect: "Incorrect",
    qUnattempted: "Unattempted",
    easiestQuestion: "Easiest: Q{number} ({acc})",
    hardestQuestion: "Hardest: Q{number} ({acc})",
    noQuestions: "No questions found in the Overview sheet.",
    questionClickTitle: "Click to view question details",
    allCountDesc: "Showing {shown} of {total} participants.",
    chartAccAria: "Accuracy percentage distribution",
    chartScoreAria: "Score distribution",
    chartAttemptedAria: "Questions attempted distribution",
    chartBarEmpty: "Not enough data to display distribution.",
    chartScatterEmpty: "No records with time greater than zero for scatter plot.",
    chartScatterAria: "Scatter plot of total time vs score",
    chartScatterXAxis: "Total Time (mm:ss)",
    chartStudentsUnit: "students",
    chartPointsUnit: "pts",
    chartInTime: "in",
  },
};

export function normalizeLocale(value) {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = value.trim().toLowerCase();
  if (!cleaned) return null;
  if (cleaned === "pt" || cleaned.startsWith("pt-") || cleaned.startsWith("pt_")) {
    return "pt";
  }
  if (cleaned === "en" || cleaned.startsWith("en-") || cleaned.startsWith("en_")) {
    return "en";
  }
  return SUPPORTED_LOCALES.has(cleaned) ? cleaned : null;
}

export function computeNextLocale(currentLocale) {
  return normalizeLocale(currentLocale) === "en" ? "pt" : "en";
}

export function resolveInitialLocale({ storage = null, navigatorLanguage = null } = {}) {
  if (storage && typeof storage.getItem === "function") {
    try {
      const saved = normalizeLocale(storage.getItem(LOCALE_STORAGE_KEY));
      if (saved) {
        return saved;
      }
    } catch {
      // Ignore storage access errors in restricted contexts.
    }
  }
  const browserLocale = normalizeLocale(navigatorLanguage);
  return browserLocale || DEFAULT_LOCALE;
}

export function t(locale, key, params = {}) {
  const lang = normalizeLocale(locale) || DEFAULT_LOCALE;
  const dict = TRANSLATIONS[lang] || TRANSLATIONS[DEFAULT_LOCALE];
  const fallbackDict = TRANSLATIONS[DEFAULT_LOCALE];
  const template = dict[key] ?? fallbackDict[key] ?? String(key);
  return template.replace(/\{(\w+)\}/g, (_, token) =>
    params[token] !== undefined && params[token] !== null ? String(params[token]) : ""
  );
}

export function applyStaticTranslations(doc, locale) {
  if (!doc || typeof doc.querySelectorAll !== "function") {
    return;
  }
  const lang = normalizeLocale(locale) || DEFAULT_LOCALE;
  doc.title = t(lang, "pageTitle");

  for (const node of doc.querySelectorAll("[data-i18n]")) {
    const key = node.getAttribute("data-i18n");
    if (key) {
      node.textContent = t(lang, key);
    }
  }
  for (const node of doc.querySelectorAll("[data-i18n-placeholder]")) {
    const key = node.getAttribute("data-i18n-placeholder");
    if (key) {
      node.setAttribute("placeholder", t(lang, key));
    }
  }
  for (const node of doc.querySelectorAll("[data-i18n-title]")) {
    const key = node.getAttribute("data-i18n-title");
    if (key) {
      node.setAttribute("title", t(lang, key));
    }
  }
  for (const node of doc.querySelectorAll("[data-i18n-aria-label]")) {
    const key = node.getAttribute("data-i18n-aria-label");
    if (key) {
      node.setAttribute("aria-label", t(lang, key));
    }
  }
}

export class LocaleController {
  constructor({
    root = globalThis.document?.documentElement ?? null,
    button = null,
    storage = null,
    navigatorLanguage = globalThis.navigator?.language ?? null,
    onChange = null,
  } = {}) {
    if (!root || typeof root.setAttribute !== "function") {
      throw new TypeError("LocaleController requires a valid root element with setAttribute.");
    }
    this._root = root;
    this._button = button;
    this._storage = storage;
    this._navigatorLanguage = navigatorLanguage;
    this._onChange = typeof onChange === "function" ? onChange : null;
    this._currentLocale = DEFAULT_LOCALE;
  }

  get currentLocale() {
    return this._currentLocale;
  }

  init() {
    const initial = resolveInitialLocale({
      storage: this._storage,
      navigatorLanguage: this._navigatorLanguage,
    });
    this.apply(initial, { persist: false, notify: false });
    return initial;
  }

  apply(locale, { persist = true, notify = true } = {}) {
    const resolved = normalizeLocale(locale);
    if (!resolved) {
      throw new RangeError(`Unsupported locale: ${String(locale)}`);
    }

    this._currentLocale = resolved;
    this._root.setAttribute("lang", resolved === "en" ? "en" : "pt-BR");

    if (this._button) {
      if (typeof this._button.setAttribute === "function") {
        this._button.setAttribute("aria-pressed", String(resolved === "en"));
        this._button.setAttribute("title", t(resolved, "langTitle"));
      }
      if ("textContent" in this._button) {
        this._button.textContent = t(resolved, "langButton");
      }
    }

    if (persist && this._storage && typeof this._storage.setItem === "function") {
      try {
        this._storage.setItem(LOCALE_STORAGE_KEY, resolved);
      } catch {
        // Ignore storage quota or security errors.
      }
    }

    if (notify && this._onChange) {
      this._onChange(resolved);
    }

    return resolved;
  }

  toggle() {
    const next = computeNextLocale(this._currentLocale);
    return this.apply(next, { persist: true, notify: true });
  }
}
