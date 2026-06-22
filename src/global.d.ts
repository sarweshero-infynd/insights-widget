declare namespace InsightsWidgetNS {
  interface API {
    init(config: Partial<import("./types").WidgetConfig>): void;
    getInstance(): import("./widget").InsightsWidgetElement | null;
    open(): void;
    close(): void;
    clearHistory(): void;
    configure(config: Partial<import("./types").WidgetConfig>): void;
    toggleTheme(): void;
    isReady(): boolean;
    destroy(): void;
  }
}

declare const InsightsWidget: InsightsWidgetNS.API;

interface Window {
  InsightsWidget: InsightsWidgetNS.API;
}
