/**
 * Static-first dataset loader with injected fetch and client-side analytics.
 * Works directly on GitHub Pages without requiring a backend server.
 */

import { buildAnalyticsReport, mergeDatasets } from "./analytics.js";

const SAFE_DATA_FILE_RE = /^[A-Za-z0-9._-]+\.json$/;
export const ALL_DATASETS_KEY = "__ALL__";

export class QuizApiClient {
  constructor(fetchFn = (...args) => globalThis.fetch(...args), { basePath = "./data" } = {}) {
    if (typeof fetchFn !== "function") {
      throw new TypeError("fetchFn must be a function");
    }
    this._fetch = fetchFn;
    this._basePath = basePath.replace(/\/+$/, "");
    this._manifestCache = null;
    this._datasetCache = new Map();
  }

  async listDatasets({ forceRefresh = false } = {}) {
    if (forceRefresh) {
      this._manifestCache = null;
      this._datasetCache.clear();
    }
    if (!this._manifestCache) {
      const response = await this._fetch(`${this._basePath}/manifest.json`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error("Não foi possível carregar o catálogo de datasets (data/manifest.json).");
      }
      const manifest = await this._parseJson(response);
      this._manifestCache = Array.isArray(manifest.datasets) ? manifest.datasets : [];
    }
    return this._manifestCache.map((entry) => entry.filename);
  }

  async _loadDatasetByEntry(entry) {
    if (!entry) {
      throw new Error("Dataset solicitado não encontrado.");
    }
    if (!SAFE_DATA_FILE_RE.test(entry.data_file || "")) {
      throw new Error("Nome de arquivo de dados inválido.");
    }

    let dataset = this._datasetCache.get(entry.data_file);
    if (!dataset) {
      const response = await this._fetch(`${this._basePath}/${entry.data_file}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error("Falha ao carregar os dados do quiz.");
      }
      dataset = await this._parseJson(response);
      this._datasetCache.set(entry.data_file, dataset);
    }
    return dataset;
  }

  async fetchReport({ file = "", sortBy = "score", includeZero = false, forceRefresh = false } = {}) {
    if (forceRefresh) {
      this._manifestCache = null;
      this._datasetCache.clear();
    }
    await this.listDatasets();

    if (this._manifestCache.length === 0) {
      throw new Error("Nenhum dataset disponível.");
    }

    if (file === ALL_DATASETS_KEY) {
      const datasets = await Promise.all(
        this._manifestCache.map((entry) => this._loadDatasetByEntry(entry))
      );
      const combined = mergeDatasets(datasets, {
        includeZeroAttempts: includeZero,
        sortBy,
      });
      return buildAnalyticsReport(combined, {
        sortBy,
        includeZeroAttempts: includeZero,
      });
    }

    const entry = file
      ? this._manifestCache.find((item) => item.filename === file)
      : this._manifestCache[0];

    const dataset = await this._loadDatasetByEntry(entry);

    return buildAnalyticsReport(dataset, {
      sortBy,
      includeZeroAttempts: includeZero,
    });
  }

  async _parseJson(response) {
    try {
      return await response.json();
    } catch {
      throw new Error("Resposta JSON inválida.");
    }
  }
}
