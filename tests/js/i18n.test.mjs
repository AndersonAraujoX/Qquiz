import test from "node:test";
import assert from "node:assert/strict";

import {
  LOCALE_STORAGE_KEY,
  LocaleController,
  applyStaticTranslations,
  computeNextLocale,
  normalizeLocale,
  resolveInitialLocale,
  t,
} from "../../docs/modules/i18n.js";

function createFakeRoot() {
  const attrs = new Map();
  return {
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    getAttribute(name) {
      return attrs.get(name) ?? null;
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

test("normalizeLocale and computeNextLocale handle regional codes and invalid values", () => {
  // Arrange / Act / Assert
  assert.equal(normalizeLocale("pt-BR"), "pt");
  assert.equal(normalizeLocale("EN-us"), "en");
  assert.equal(normalizeLocale("fr"), null);
  assert.equal(normalizeLocale(null), null);
  assert.equal(computeNextLocale("pt"), "en");
  assert.equal(computeNextLocale("en"), "pt");
  assert.equal(computeNextLocale("unknown"), "en");
});

test("resolveInitialLocale prioritizes stored preference and falls back to navigatorLanguage", () => {
  // Arrange
  const storageEn = createFakeStorage({ [LOCALE_STORAGE_KEY]: "en" });
  const storageInvalid = createFakeStorage({ [LOCALE_STORAGE_KEY]: "es" });

  // Act / Assert
  assert.equal(
    resolveInitialLocale({ storage: storageEn, navigatorLanguage: "pt-BR" }),
    "en"
  );
  assert.equal(
    resolveInitialLocale({ storage: storageInvalid, navigatorLanguage: "en-GB" }),
    "en"
  );
  assert.equal(
    resolveInitialLocale({ storage: null, navigatorLanguage: null }),
    "pt"
  );
});

test("t interpolates parameters and falls back safely for unknown keys", () => {
  // Arrange / Act / Assert
  assert.equal(t("en", "combinedOption", { count: 2 }), "Overall Sum (2 quizzes)");
  assert.equal(t("pt", "combinedOption", { count: 2 }), "Soma Geral (2 quizzes)");
  assert.equal(t("en", "missing_key"), "missing_key");
});

test("applyStaticTranslations updates textContent, placeholder, title, and aria-label", () => {
  // Arrange
  const textNode = {
    textContent: "",
    getAttribute(name) {
      return name === "data-i18n" ? "exportCsvBtn" : null;
    },
  };
  const inputNode = {
    attrs: new Map(),
    getAttribute(name) {
      return name === "data-i18n-placeholder" ? "searchPlaceholder" : null;
    },
    setAttribute(name, val) {
      this.attrs.set(name, val);
    },
  };
  const titleNode = {
    attrs: new Map(),
    getAttribute(name) {
      return name === "data-i18n-title" ? "refreshTitle" : null;
    },
    setAttribute(name, val) {
      this.attrs.set(name, val);
    },
  };
  const ariaNode = {
    attrs: new Map(),
    getAttribute(name) {
      return name === "data-i18n-aria-label" ? "controlsAria" : null;
    },
    setAttribute(name, val) {
      this.attrs.set(name, val);
    },
  };
  const fakeDoc = {
    title: "",
    querySelectorAll(selector) {
      if (selector === "[data-i18n]") return [textNode];
      if (selector === "[data-i18n-placeholder]") return [inputNode];
      if (selector === "[data-i18n-title]") return [titleNode];
      if (selector === "[data-i18n-aria-label]") return [ariaNode];
      return [];
    },
  };

  // Act
  applyStaticTranslations(fakeDoc, "en");

  // Assert
  assert.match(fakeDoc.title, /Statistics/);
  assert.equal(textNode.textContent, "Export CSV");
  assert.equal(inputNode.attrs.get("placeholder"), "Filter by name, nickname, or device...");
  assert.equal(titleNode.attrs.get("title"), "Reload data");
  assert.equal(ariaNode.attrs.get("aria-label"), "Dashboard controls");
});

test("LocaleController initializes, toggles, persists, and triggers onChange", () => {
  // Arrange
  const root = createFakeRoot();
  const button = createFakeButton();
  const storage = createFakeStorage();
  const changes = [];
  const controller = new LocaleController({
    root,
    button,
    storage,
    navigatorLanguage: "pt-BR",
    onChange: (next) => changes.push(next),
  });

  // Act
  const initial = controller.init();
  const afterFirstToggle = controller.toggle();
  const afterSecondToggle = controller.toggle();

  // Assert
  assert.equal(initial, "pt");
  assert.equal(afterFirstToggle, "en");
  assert.equal(afterSecondToggle, "pt");
  assert.equal(root.getAttribute("lang"), "pt-BR");
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(button.textContent, "PT → EN");
  assert.equal(storage.getItem(LOCALE_STORAGE_KEY), "pt");
  assert.deepEqual(changes, ["en", "pt"]);
});

test("LocaleController handles storage errors gracefully and rejects invalid root or locale", () => {
  // Arrange
  const throwingStorage = {
    getItem() {
      throw new Error("Blocked");
    },
    setItem() {
      throw new Error("Quota");
    },
  };
  const root = createFakeRoot();
  const controller = new LocaleController({
    root,
    button: null,
    storage: throwingStorage,
    navigatorLanguage: "en-US",
  });

  // Act
  const initial = controller.init();
  const next = controller.toggle();

  // Assert
  assert.equal(initial, "en");
  assert.equal(next, "pt");
  assert.throws(() => new LocaleController({ root: null }), TypeError);
  assert.throws(() => controller.apply("de"), RangeError);
});
