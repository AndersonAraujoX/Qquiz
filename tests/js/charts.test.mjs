import test from "node:test";
import assert from "node:assert/strict";

import { renderBarChart, renderScatterPlot } from "../../docs/modules/charts.js";

function createStubElement(tagName, namespaceURI = null) {
  const attrs = new Map();
  const listeners = new Map();
  const children = [];

  return {
    tagName,
    namespaceURI,
    className: "",
    textContent: "",
    style: {},
    hidden: false,
    children,
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    getAttribute(name) {
      return attrs.get(name) ?? null;
    },
    appendChild(child) {
      children.push(child);
      return child;
    },
    replaceChildren(...nodes) {
      children.length = 0;
      children.push(...nodes);
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push(fn);
    },
    dispatch(type, event = {}) {
      for (const fn of listeners.get(type) || []) {
        fn(event);
      }
    },
    getBoundingClientRect() {
      return { left: 10, width: 20, top: 40 };
    },
  };
}

function createStubDocument() {
  return {
    createElement(tag) {
      return createStubElement(tag);
    },
    createElementNS(ns, tag) {
      return createStubElement(tag, ns);
    },
    createTextNode(text) {
      return { textContent: String(text) };
    },
  };
}

function collectByTag(node, tagName, acc = []) {
  if (!node) return acc;
  if (node.tagName === tagName) {
    acc.push(node);
  }
  for (const child of node.children || []) {
    collectByTag(child, tagName, acc);
  }
  return acc;
}

test("renderBarChart renders rounded Wayground-styled bars and interactive tooltip", () => {
  // Arrange
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const stubDoc = createStubDocument();
  globalThis.document = stubDoc;
  globalThis.window = { innerWidth: 1024 };

  try {
    const container = createStubElement("div");
    const tooltip = createStubElement("div");
    tooltip.hidden = true;
    const buckets = [
      { label: "0-50%", count: 2, percentage: 25 },
      { label: "51-100%", count: 6, percentage: 75 },
    ];

    // Act
    renderBarChart(container, buckets, tooltip, {
      ariaLabel: "Distribuição teste",
      barColor: "#FF319F",
      doc: stubDoc,
    });

    // Assert
    const svgs = collectByTag(container, "svg");
    const rects = collectByTag(container, "rect");
    assert.equal(svgs.length, 1);
    assert.equal(svgs[0].getAttribute("aria-label"), "Distribuição teste");
    assert.equal(rects.length, 2);
    assert.equal(rects[0].getAttribute("fill"), "#FF319F");
    assert.equal(rects[0].getAttribute("rx"), "8");

    rects[1].dispatch("mouseenter", { clientX: 200, clientY: 150 });
    assert.equal(tooltip.hidden, false);
    assert.match(tooltip.textContent, /51-100% — 6 alunos/);
    rects[1].dispatch("mouseleave");
    assert.equal(tooltip.hidden, true);
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  }
});

test("renderScatterPlot highlights Top 10 and ignores inactive or zero-time participants", () => {
  // Arrange
  const prevDoc = globalThis.document;
  const stubDoc = createStubDocument();
  globalThis.document = stubDoc;

  try {
    const container = createStubElement("div");
    const participants = [
      { rank: 1, display_name: "Ana", score: 5000, total_time_seconds: 90, is_active: true },
      { rank: 12, display_name: "Leo", score: 2500, total_time_seconds: 140, is_active: true },
      { rank: 99, display_name: "Zero", score: 0, total_time_seconds: 0, is_active: false },
    ];

    // Act
    renderScatterPlot(container, participants, new Set([1]), null, {
      top10Color: "#FF319F",
      otherColor: "#FFC48A",
      doc: stubDoc,
    });

    // Assert
    const circles = collectByTag(container, "circle");
    assert.equal(circles.length, 2);
    assert.equal(circles[0].getAttribute("fill"), "#FFC48A");
    assert.equal(circles[0].getAttribute("r"), "4.5");
    assert.equal(circles[1].getAttribute("fill"), "#FF319F");
    assert.equal(circles[1].getAttribute("r"), "7");
  } finally {
    globalThis.document = prevDoc;
  }
});

test("renderBarChart and renderScatterPlot handle empty, null, and invalid inputs gracefully", () => {
  // Arrange
  const prevDoc = globalThis.document;
  const stubDoc = createStubDocument();
  globalThis.document = stubDoc;

  try {
    const barContainer = createStubElement("div");
    const scatterContainer = createStubElement("div");

    // Act
    renderBarChart(null, [], null, { doc: stubDoc });
    renderBarChart(barContainer, [], null, { doc: stubDoc });
    renderScatterPlot(null, null, null, null, { doc: stubDoc });
    renderScatterPlot(scatterContainer, [null, { is_active: false, total_time_seconds: 10 }], null, null, {
      doc: stubDoc,
    });

    // Assert
    assert.equal(barContainer.children.length, 1);
    assert.equal(barContainer.children[0].tagName, "p");
    assert.equal(scatterContainer.children.length, 1);
    assert.equal(scatterContainer.children[0].tagName, "p");
  } finally {
    globalThis.document = prevDoc;
  }
});
