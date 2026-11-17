/**
 * Accessible tab navigation controller (WAI-ARIA Tabs pattern) with URL hash sync.
 */

export const DEFAULT_TAB_ID = "top10";
export const VALID_TABS = new Set(["top10", "estatisticas"]);

export function normalizeTabId(candidate, fallback = DEFAULT_TAB_ID) {
  if (typeof candidate !== "string") {
    return fallback;
  }
  const cleaned = candidate.replace(/^#/, "").trim().toLowerCase();
  return VALID_TABS.has(cleaned) ? cleaned : fallback;
}

export function nextTabIdByKey(tabIds, currentIndex, key) {
  if (!Array.isArray(tabIds) || tabIds.length === 0) {
    return null;
  }
  if (key === "ArrowRight") {
    return tabIds[(currentIndex + 1) % tabIds.length];
  }
  if (key === "ArrowLeft") {
    return tabIds[(currentIndex - 1 + tabIds.length) % tabIds.length];
  }
  if (key === "Home") {
    return tabIds[0];
  }
  if (key === "End") {
    return tabIds[tabIds.length - 1];
  }
  return null;
}

export class TabController {
  constructor({ tabButtons, tabPanels, initialTab = DEFAULT_TAB_ID, onChange = null } = {}) {
    if (!Array.isArray(tabButtons) || !Array.isArray(tabPanels) || tabButtons.length === 0) {
      throw new TypeError("tabButtons and tabPanels must be non-empty arrays.");
    }
    this._tabButtons = tabButtons;
    this._tabPanels = tabPanels;
    this._onChange = typeof onChange === "function" ? onChange : null;
    this._activeTab = normalizeTabId(initialTab);
  }

  get activeTab() {
    return this._activeTab;
  }

  init() {
    const tabIds = this._tabButtons.map((btn) => btn.dataset.tab);

    this._tabButtons.forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        this.activate(btn.dataset.tab);
      });

      btn.addEventListener("keydown", (event) => {
        const nextId = nextTabIdByKey(tabIds, idx, event.key);
        if (!nextId) return;
        event.preventDefault();
        this.activate(nextId, { focusTab: true });
      });
    });

    this.activate(this._activeTab, { notify: false });
  }

  activate(tabId, { focusTab = false, notify = true } = {}) {
    const target = normalizeTabId(tabId);
    this._activeTab = target;

    for (const btn of this._tabButtons) {
      const isSelected = btn.dataset.tab === target;
      btn.setAttribute("aria-selected", String(isSelected));
      btn.setAttribute("tabindex", isSelected ? "0" : "-1");
      btn.classList.toggle("is-active", isSelected);
      if (isSelected && focusTab && typeof btn.focus === "function") {
        btn.focus();
      }
    }

    for (const panel of this._tabPanels) {
      const isMatch = panel.dataset.tabPanel === target;
      panel.hidden = !isMatch;
    }

    if (notify && this._onChange) {
      this._onChange(target);
    }
    return target;
  }
}
