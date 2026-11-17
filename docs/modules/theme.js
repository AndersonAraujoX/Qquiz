/**
 * Theme management module with dependency injection for storage, DOM root, and media queries.
 */

export const THEME_STORAGE_KEY = "quiz_analytics_theme";
export const VALID_THEMES = new Set(["light", "dark"]);

export function normalizeTheme(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return VALID_THEMES.has(normalized) ? normalized : null;
}

export function computeNextTheme(currentTheme) {
  return normalizeTheme(currentTheme) === "dark" ? "light" : "dark";
}

export function formatThemeButtonLabel(theme) {
  return normalizeTheme(theme) === "dark" ? "Tema: Escuro" : "Tema: Claro";
}

export function resolveInitialTheme({ storage = null, matchMediaFn = null } = {}) {
  if (storage && typeof storage.getItem === "function") {
    try {
      const saved = normalizeTheme(storage.getItem(THEME_STORAGE_KEY));
      if (saved) {
        return saved;
      }
    } catch {
      // Ignore storage access errors in restricted browser contexts.
    }
  }

  if (typeof matchMediaFn === "function") {
    try {
      const mediaQuery = matchMediaFn("(prefers-color-scheme: dark)");
      if (mediaQuery && mediaQuery.matches === true) {
        return "dark";
      }
    } catch {
      // Ignore matchMedia errors.
    }
  }

  return "light";
}

export class ThemeController {
  constructor({
    root = globalThis.document?.documentElement ?? null,
    button = null,
    storage = null,
    matchMediaFn = typeof globalThis.matchMedia === "function"
      ? (query) => globalThis.matchMedia(query)
      : null,
  } = {}) {
    if (!root || typeof root.setAttribute !== "function" || typeof root.getAttribute !== "function") {
      throw new TypeError("ThemeController requires a valid root element with getAttribute/setAttribute.");
    }
    this._root = root;
    this._button = button;
    this._storage = storage;
    this._matchMediaFn = matchMediaFn;
    this._currentTheme = "light";
  }

  get currentTheme() {
    return this._currentTheme;
  }

  init() {
    const initial = resolveInitialTheme({
      storage: this._storage,
      matchMediaFn: this._matchMediaFn,
    });
    this.apply(initial, { persist: false });
    return initial;
  }

  apply(theme, { persist = true } = {}) {
    const resolved = normalizeTheme(theme);
    if (!resolved) {
      throw new RangeError(`Unsupported theme: ${String(theme)}`);
    }

    this._currentTheme = resolved;
    this._root.setAttribute("data-theme", resolved);

    if (this._button) {
      if (typeof this._button.setAttribute === "function") {
        this._button.setAttribute("aria-pressed", String(resolved === "dark"));
      }
      if ("textContent" in this._button) {
        this._button.textContent = formatThemeButtonLabel(resolved);
      }
    }

    if (persist && this._storage && typeof this._storage.setItem === "function") {
      try {
        this._storage.setItem(THEME_STORAGE_KEY, resolved);
      } catch {
        // Ignore storage quota or security errors.
      }
    }

    return resolved;
  }

  toggle() {
    const active = normalizeTheme(this._root.getAttribute("data-theme")) ?? this._currentTheme;
    const next = computeNextTheme(active);
    return this.apply(next, { persist: true });
  }
}
