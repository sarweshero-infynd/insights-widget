import { InsightsWidgetElement } from "./widget";
import type { WidgetConfig } from "./types";

const TAG_NAME = "insights-widget";
const INITIALIZATION_MARKER = "__iw_initialized";

if (typeof customElements !== "undefined" && !customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, InsightsWidgetElement);
}

function createInstance(): InsightsWidgetElement {
  const el = document.createElement(TAG_NAME) as InsightsWidgetElement;
  document.body.appendChild(el);
  return el;
}

const InsightsWidget = {
  init(config: Partial<WidgetConfig>): void {
    if (typeof document === "undefined") return;
    const existing = document.querySelector(TAG_NAME) as InsightsWidgetElement | null;
    if (existing) {
      existing.configure(config);
      return;
    }
    const el = createInstance();
    el.configure(config);
  },

  getInstance(): InsightsWidgetElement | null {
    return document.querySelector(TAG_NAME) as InsightsWidgetElement | null;
  },

  open(): void { this.getInstance()?.open(); },
  close(): void { this.getInstance()?.close(); },
  clearHistory(): void { this.getInstance()?.clearHistory(); },
  configure(config: Partial<WidgetConfig>): void { this.getInstance()?.configure(config); },
  toggleTheme(): void { this.getInstance()?.toggleTheme(); },

  isReady(): boolean {
    return this.getInstance() !== null;
  },

  destroy(): void {
    const instance = this.getInstance();
    if (instance) {
      instance.clearHistory();
      instance.remove();
    }
  },
};

if (typeof window !== "undefined") {
  (window as any).InsightsWidget = InsightsWidget;
}

if (typeof document !== "undefined" && !(window as any)[INITIALIZATION_MARKER]) {
  (window as any)[INITIALIZATION_MARKER] = true;

  const scriptEl = document.querySelector<HTMLScriptElement>("script[data-api-url]");
  if (scriptEl) {
    const config: Partial<WidgetConfig> = {
      apiUrl: scriptEl.dataset.apiUrl || "",
      apiKey: scriptEl.dataset.apiKey || "",
      agentId: scriptEl.dataset.agentId || "",
      theme: (scriptEl.dataset.theme as WidgetConfig["theme"]) || "light",
      position: (scriptEl.dataset.position as WidgetConfig["position"]) || "bottom-right",
      title: scriptEl.dataset.title || undefined,
      subtitle: scriptEl.dataset.subtitle || undefined,
    };

    const initWidget = () => InsightsWidget.init(config);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initWidget);
    } else {
      initWidget();
    }
  }
}

export { InsightsWidget, InsightsWidgetElement };
export type { WidgetConfig };
