import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TAB_ID,
  TabController,
  nextTabIdByKey,
  normalizeTabId,
} from "../../docs/modules/tabs.js";

function makeStubButton(tabId) {
  const listeners = new Map();
  const attrs = new Map();
  const classes = new Set();
  return {
    dataset: { tab: tabId },
    focused: false,
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    trigger(type, event = {}) {
      const fn = listeners.get(type);
      if (fn) fn(event);
    },
    setAttribute(k, v) {
      attrs.set(k, v);
    },
    getAttribute(k) {
      return attrs.get(k);
    },
    classList: {
      toggle(cls, force) {
        if (force) classes.add(cls);
        else classes.delete(cls);
      },
      contains(cls) {
        return classes.has(cls);
      },
    },
    focus() {
      this.focused = true;
    },
  };
}

function makeStubPanel(tabId) {
  return {
    dataset: { tabPanel: tabId },
    hidden: false,
  };
}

test("normalizeTabId resolves valid hashes and falls back to default", () => {
  // Arrange / Act / Assert
  assert.equal(normalizeTabId("#top10"), "top10");
  assert.equal(normalizeTabId("  ESTATISTICAS "), "estatisticas");
  assert.equal(normalizeTabId("#evolucao"), "evolucao");
  assert.equal(normalizeTabId("#unknown"), DEFAULT_TAB_ID);
  assert.equal(normalizeTabId(null), DEFAULT_TAB_ID);
});

test("nextTabIdByKey handles arrow, Home, End, unknown keys, and empty arrays", () => {
  // Arrange
  const ids = ["top10", "estatisticas"];

  // Act / Assert
  assert.equal(nextTabIdByKey(ids, 0, "ArrowRight"), "estatisticas");
  assert.equal(nextTabIdByKey(ids, 0, "ArrowLeft"), "estatisticas");
  assert.equal(nextTabIdByKey(ids, 1, "ArrowRight"), "top10");
  assert.equal(nextTabIdByKey(ids, 1, "Home"), "top10");
  assert.equal(nextTabIdByKey(ids, 0, "End"), "estatisticas");
  assert.equal(nextTabIdByKey(ids, 0, "Enter"), null);
  assert.equal(nextTabIdByKey([], 0, "ArrowRight"), null);
});

test("TabController switches panels, updates ARIA attributes, and handles keyboard nav", () => {
  // Arrange
  const btnTop = makeStubButton("top10");
  const btnStats = makeStubButton("estatisticas");
  const panelTop = makeStubPanel("top10");
  const panelStats = makeStubPanel("estatisticas");
  const changed = [];

  const controller = new TabController({
    tabButtons: [btnTop, btnStats],
    tabPanels: [panelTop, panelStats],
    initialTab: "top10",
    onChange: (id) => changed.push(id),
  });

  // Act
  controller.init();

  // Assert initial state (top10 visible, estatisticas hidden, init does not fire onChange)
  assert.equal(controller.activeTab, "top10");
  assert.equal(panelTop.hidden, false);
  assert.equal(panelStats.hidden, true);
  assert.equal(btnTop.getAttribute("aria-selected"), "true");
  assert.equal(btnStats.getAttribute("aria-selected"), "false");
  assert.deepEqual(changed, []);

  // Act: click stats tab
  btnStats.trigger("click");

  // Assert
  assert.equal(controller.activeTab, "estatisticas");
  assert.equal(panelTop.hidden, true);
  assert.equal(panelStats.hidden, false);
  assert.equal(btnStats.getAttribute("aria-selected"), "true");
  assert.equal(btnStats.getAttribute("tabindex"), "0");
  assert.equal(btnTop.getAttribute("tabindex"), "-1");
  assert.deepEqual(changed, ["estatisticas"]);

  // Act: keyboard ArrowLeft back to top10
  let prevented = false;
  btnStats.trigger("keydown", {
    key: "ArrowLeft",
    preventDefault() {
      prevented = true;
    },
  });

  // Assert
  assert.equal(prevented, true);
  assert.equal(controller.activeTab, "top10");
  assert.equal(btnTop.focused, true);
  assert.deepEqual(changed, ["estatisticas", "top10"]);
});

test("TabController throws TypeError when tabButtons or tabPanels are invalid", () => {
  // Arrange / Act / Assert
  assert.throws(() => new TabController({ tabButtons: [], tabPanels: [] }), TypeError);
  assert.throws(() => new TabController({ tabButtons: null, tabPanels: [] }), TypeError);
});
