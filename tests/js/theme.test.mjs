import test from "node:test";
import assert from "node:assert/strict";

import {
  THEME_STORAGE_KEY,
  ThemeController,
  computeNextTheme,
  formatThemeButtonLabel,
  normalizeTheme,
  resolveInitialTheme,
} from "../../docs/modules/theme.js";

function createFakeRoot(initialTheme = null) {
  const attrs = new Map();
  if (initialTheme !== null) {
    attrs.set("data-theme", initialTheme);
  }
  return {
    getAttribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
  };
}

function createFakeButton() {
  const attrs = new Map();
  return {
    textContent: "",
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    getAttribute(name) {
      return attrs.get(name) ?? null;
    },
  };
}

function createFakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

test("normalizeTheme, computeNextTheme, and formatThemeButtonLabel handle valid and edge values", () => {
  // Arrange / Act / Assert
  assert.equal(normalizeTheme(" DARK "), "dark");
  assert.equal(normalizeTheme("light"), "light");
  assert.equal(normalizeTheme("sepia"), null);
  assert.equal(normalizeTheme(null), null);

  assert.equal(computeNextTheme("light"), "dark");
  assert.equal(computeNextTheme("dark"), "light");
  assert.equal(computeNextTheme("unknown"), "dark");

  assert.equal(formatThemeButtonLabel("dark"), "Tema: Escuro");
  assert.equal(formatThemeButtonLabel("light"), "Tema: Claro");
  assert.equal(formatThemeButtonLabel("dark", "en"), "Theme: Dark");
  assert.equal(formatThemeButtonLabel("light", "en"), "Theme: Light");
});

test("resolveInitialTheme prioritizes valid stored preference and falls back to media query", () => {
  // Arrange
  const darkStorage = createFakeStorage({ [THEME_STORAGE_KEY]: "dark" });
  const invalidStorage = createFakeStorage({ [THEME_STORAGE_KEY]: "neon" });
  const darkMedia = () => ({ matches: true });
  const lightMedia = () => ({ matches: false });

  // Act
  const fromStorage = resolveInitialTheme({ storage: darkStorage, matchMediaFn: lightMedia });
  const fromMedia = resolveInitialTheme({ storage: invalidStorage, matchMediaFn: darkMedia });
  const fallbackLight = resolveInitialTheme({ storage: null, matchMediaFn: null });

  // Assert
  assert.equal(fromStorage, "dark");
  assert.equal(fromMedia, "dark");
  assert.equal(fallbackLight, "light");
});

test("ThemeController initializes, toggles, and persists theme using injected dependencies", () => {
  // Arrange
  const root = createFakeRoot();
  const button = createFakeButton();
  const storage = createFakeStorage();
  const controller = new ThemeController({
    root,
    button,
    storage,
    matchMediaFn: () => ({ matches: false }),
  });

  // Act
  const initial = controller.init();
  const toggledToDark = controller.toggle();
  const toggledToLight = controller.toggle();

  // Assert
  assert.equal(initial, "light");
  assert.equal(toggledToDark, "dark");
  assert.equal(toggledToLight, "light");
  assert.equal(root.getAttribute("data-theme"), "light");
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(button.textContent, "Tema: Claro");
  assert.equal(storage.getItem(THEME_STORAGE_KEY), "light");
});

test("ThemeController handles storage errors gracefully and rejects invalid roots or themes", () => {
  // Arrange
  const throwingStorage = {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("QuotaExceededError");
    },
  };
  const root = createFakeRoot();
  const controller = new ThemeController({
    root,
    button: null,
    storage: throwingStorage,
    matchMediaFn: () => {
      throw new Error("Unavailable");
    },
  });

  // Act
  const initial = controller.init();
  const next = controller.toggle();

  // Assert
  assert.equal(initial, "light");
  assert.equal(next, "dark");
  assert.equal(root.getAttribute("data-theme"), "dark");
  assert.throws(() => new ThemeController({ root: null }), TypeError);
  assert.throws(() => controller.apply("invalid-theme"), RangeError);
});
