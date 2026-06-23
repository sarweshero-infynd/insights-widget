import type { PageContext, PageElement, BrowserAction, BrowserActionStep, RouteEntry } from "./types";

const ROUTE_STORAGE_PREFIX = "iw_";
const MAX_ROUTES = 200;

// CSS.escape polyfill for older browsers (Safari < 13.1, IE11)
const escapeCSS = typeof CSS !== "undefined" && CSS.escape
  ? CSS.escape
  : (s: string) => s.replace(/([^\w-])/g, "\\$1");

/**
 * DomController handles two core responsibilities:
 * 1. Harvesting page context (interactive elements, page text, site routes) to feed to the AI agent
 * 2. Executing browser actions returned by the AI agent (navigate, click, type, etc.)
 *
 * Key design: After navigation, it waits for the DOM to stabilize before reporting
 * completion, so the widget can re-harvest and feed the new page data back to the agent.
 */
export class DomController {
  private observer: MutationObserver | null = null;
  private onContextChange?: () => void;
  private _debounceTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  private maxElements: number;
  private widgetShadowHost: HTMLElement | null = null;
  private agentId: string = "default";
  private textSelectorMap = new Map<HTMLElement, string>();

  constructor(maxElements = 50) {
    this.maxElements = maxElements;
  }

  setWidgetHost(el: HTMLElement): void {
    this.widgetShadowHost = el;
  }

  setMaxElements(max: number): void {
    this.maxElements = Math.max(1, Math.min(200, max));
  }

  setAgentId(id: string): void {
    this.agentId = id || "default";
  }

  startObserving(callback: () => void): void {
    if (!document.body) return;
    this.onContextChange = callback;
    this.observer = new MutationObserver(() => {
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.onContextChange?.(), 1500);
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  }

  stopObserving(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = undefined;
    }
    this.observer?.disconnect();
    this.observer = null;
  }

  /**
   * Clean up any DOM mutations made to the host page (e.g., data-iw-text attributes).
   */
  cleanupHostDom(): void {
    for (const [el] of this.textSelectorMap) {
      el.removeAttribute("data-iw-text");
    }
    this.textSelectorMap.clear();
  }

  /**
   * Harvest the current page's interactive elements + visible text content.
   * This data is sent alongside the user's message so the AI agent knows what's on screen.
   */
  harvestPageContext(): PageContext {
    const elements: PageElement[] = [];
    const interactiveSelectors = [
      "a[href]",
      "button",
      "input",
      "textarea",
      "select",
      "[role='button']",
      "[role='link']",
      "[role='tab']",
      "[role='menuitem']",
      "[data-testid]",
    ];

    const selector = interactiveSelectors.join(", ");
    const seen = new Set<string>();

    document.querySelectorAll(selector).forEach((el) => {
      if (elements.length >= this.maxElements) return;

      const htmlEl = el as HTMLElement;

      // Exclude the widget's own elements
      if (this.widgetShadowHost && this.widgetShadowHost.contains(htmlEl)) return;

      if (!isVisible(htmlEl)) return;

      const tag = htmlEl.tagName.toLowerCase();
      const id = htmlEl.id || undefined;
      const className = (typeof htmlEl.className === "string" ? htmlEl.className : "").slice(0, 80) || undefined;
      const text = getElementText(htmlEl).slice(0, 100) || undefined;

      const cssSelector = buildSelector(htmlEl);
      if (seen.has(cssSelector)) return;
      seen.add(cssSelector);

      const entry: PageElement = {
        tag,
        text,
        selector: cssSelector,
        id,
        className,
        visible: true,
      };

      if (tag === "input" || tag === "textarea") {
        entry.type = (htmlEl as HTMLInputElement).type || "text";
        entry.placeholder = (htmlEl as HTMLInputElement).placeholder || undefined;
        entry.value = (htmlEl as HTMLInputElement).value || undefined;
      }
      if (tag === "a") {
        entry.href = (htmlEl as HTMLAnchorElement).href || undefined;
      }
      if (tag === "input" || tag === "select") {
        entry.name = (htmlEl as HTMLInputElement).name || undefined;
      }
      if (tag === "select") {
        const sel = htmlEl as HTMLSelectElement;
        entry.value = sel.options[sel.selectedIndex]?.value || undefined;
      }

      elements.push(entry);
    });

    // Set data-iw-text attributes for text-based selector matching
    // Store mapping internally to avoid mutating the host page DOM
    this.textSelectorMap.clear();
    document.querySelectorAll(selector).forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (this.widgetShadowHost && this.widgetShadowHost.contains(htmlEl)) return;
      if (!isVisible(htmlEl)) return;
      const text = getElementText(htmlEl).slice(0, 40);
      if (text && !htmlEl.querySelector("*")) {
        const tag = htmlEl.tagName.toLowerCase();
        if (tag === "button" || tag === "a" || htmlEl.getAttribute("role") === "button") {
          this.textSelectorMap.set(htmlEl, text);
          htmlEl.setAttribute("data-iw-text", text);
        }
      }
    });

    // Also harvest some visible text content for richer context
    const textContent = harvestTextContent(this.widgetShadowHost);

    // Discover and merge site routes
    const freshRoutes = this.discoverRoutes();
    this.mergeRoutes(freshRoutes);
    const routes = this.loadRoutes();

    return {
      url: window.location.href,
      pathname: window.location.pathname,
      title: document.title,
      elements,
      textContent,
      routes,
      timestamp: Date.now(),
    };
  }

  // ─── Route Discovery ──────────────────────────────────────────────────────

  /**
   * Discover all navigable routes on the current page from multiple sources:
   * 1. <a href> tags (both visible and hidden — nav menus, footers, etc.)
   * 2. SPA router globals (Next.js, Nuxt, React Router, Vue Router)
   * 3. Script-based route configurations
   */
  private discoverRoutes(): RouteEntry[] {
    const routes: RouteEntry[] = [];
    const seen = new Set<string>();
    const origin = window.location.origin;

    const addRoute = (path: string, label?: string, title?: string) => {
      if (!path || path.startsWith("#") || path.startsWith("javascript:") || path.startsWith("mailto:") || path.startsWith("tel:")) return;
      try {
        const url = new URL(path, origin);
        if (url.origin !== origin) return;
        const pathname = url.pathname.replace(/\/$/, "") || "/";
        if (seen.has(pathname)) return;
        seen.add(pathname);
        routes.push({ path: pathname, label, title });
      } catch { /* skip invalid URLs */ }
    };

    // 1. Scan all <a href> tags
    document.querySelectorAll("a[href]").forEach((a) => {
      const anchor = a as HTMLAnchorElement;
      const href = anchor.getAttribute("href");
      if (!href) return;
      const text = (anchor.textContent || "").trim().slice(0, 60) || undefined;
      addRoute(href, text);
    });

    // 2. SPA Router Globals

    // Next.js — __NEXT_DATA__.props.pageProps.__routes or buildManifest
    try {
      const win = window as unknown as Record<string, unknown>;
      const nextData = win["__NEXT_DATA__"] as Record<string, unknown> | undefined;
      if (nextData?.props) {
        const props = nextData.props as Record<string, unknown>;
        const pageProps = props.pageProps as Record<string, unknown> | undefined;
        // Next.js app router routes
        if (pageProps?.routes && Array.isArray(pageProps.routes)) {
          for (const r of pageProps.routes as Array<Record<string, string>>) {
            if (r.path) addRoute(r.path, r.name || r.label);
          }
        }
      }
      // Next.js pages manifest
      const buildManifest = win["__BUILD_MANIFEST"] as Record<string, unknown> | undefined;
      if (buildManifest) {
        for (const key of Object.keys(buildManifest)) {
          if (key !== "/_app" && key !== "/_error" && key !== "/_document") {
            addRoute(key);
          }
        }
      }
    } catch { /* skip */ }

    // Nuxt — __NUXT__.config.routes or router options
    try {
      const win = window as unknown as Record<string, unknown>;
      const nuxtData = win["__NUXT__"] as Record<string, unknown> | undefined;
      if (nuxtData?.config) {
        const config = nuxtData.config as Record<string, unknown>;
        if (config.router && typeof config.router === "object") {
          const router = config.router as Record<string, unknown>;
          if (Array.isArray(router.routes)) {
            for (const r of router.routes as Array<Record<string, string>>) {
              if (r.path) addRoute(r.path, r.name);
            }
          }
        }
      }
    } catch { /* skip */ }

    // React Router — check for route manifest in __remixContext or window.__router
    try {
      const win = window as unknown as Record<string, unknown>;
      const remixCtx = win["__remixContext"] as Record<string, unknown> | undefined;
      if (remixCtx?.manifest) {
        const manifest = remixCtx.manifest as Record<string, unknown>;
        for (const [key, val] of Object.entries(manifest)) {
          if (key.startsWith("/") && val && typeof val === "object") {
            const entry = val as Record<string, unknown>;
            const routeId = (entry.id || entry.module || "") as string;
            addRoute(key, routeId.split("/").pop());
          }
        }
      }
    } catch { /* skip */ }

    // 3. Script-based route configs (JSON-LD, data attributes)
    document.querySelectorAll("script[type='application/json'], script[data-routes]").forEach((script) => {
      try {
        const text = script.textContent || "";
        const data = JSON.parse(text);
        if (data && typeof data === "object") {
          const routeList = data.routes || data.pages || data.navigation;
          if (Array.isArray(routeList)) {
            for (const r of routeList) {
              if (typeof r === "string") addRoute(r);
              else if (r?.path) addRoute(r.path, r.name || r.label);
            }
          }
        }
      } catch { /* skip malformed JSON */ }
    });

    // 4. data-route attributes on any element
    document.querySelectorAll("[data-route]").forEach((el) => {
      const route = el.getAttribute("data-route");
      if (route) {
        const text = (el.textContent || "").trim().slice(0, 60) || undefined;
        addRoute(route, text);
      }
    });

    return routes;
  }

  /**
   * Merge freshly discovered routes into the persisted route store.
   * Preserves existing routes, adds new ones, updates labels if better ones found.
   */
  private mergeRoutes(freshRoutes: RouteEntry[]): void {
    const existing = this.loadRoutes();
    const merged = new Map<string, RouteEntry>();

    for (const r of existing) {
      merged.set(r.path, r);
    }

    for (const r of freshRoutes) {
      const existing = merged.get(r.path);
      if (!existing) {
        merged.set(r.path, r);
      } else if (r.label && (!existing.label || r.label.length > existing.label.length)) {
        merged.set(r.path, { ...existing, label: r.label });
      }
    }

    // Always include current page
    const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
    if (!merged.has(currentPath)) {
      merged.set(currentPath, { path: currentPath, title: document.title });
    }

    const result = Array.from(merged.values()).slice(0, MAX_ROUTES);
    this.saveRoutes(result);
  }

  private getRouteStorageKey(): string {
    return `${ROUTE_STORAGE_PREFIX}${this.agentId}_routes`;
  }

  private loadRoutes(): RouteEntry[] {
    try {
      const raw = sessionStorage.getItem(this.getRouteStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, MAX_ROUTES);
      }
    } catch { /* ignore corrupt data */ }
    return [];
  }

  private saveRoutes(routes: RouteEntry[]): void {
    try {
      sessionStorage.setItem(this.getRouteStorageKey(), JSON.stringify(routes.slice(0, MAX_ROUTES)));
    } catch { /* storage full or unavailable */ }
  }

  /**
   * Execute a sequence of browser actions and return step summaries.
   * After navigation actions, waits for DOM to stabilize before continuing.
   */
  async executeActions(
    actions: BrowserAction[],
    onStepUpdate?: (steps: BrowserActionStep[]) => void
  ): Promise<BrowserActionStep[]> {
    const steps: BrowserActionStep[] = actions.map((a) => ({
      action: a.action,
      path: a.path,
      tab: a.tab,
      selector: a.selector,
      value: a.value,
      label: buildActionLabel(a),
      status: "pending" as const,
    }));

    for (let i = 0; i < actions.length; i++) {
      steps[i].status = "executing";
      onStepUpdate?.(steps);

      try {
        await executeAction(actions[i]);

        // Wait for DOM to stabilize after actions that may change the page
        if (actions[i].action === "navigate") {
          await waitForDomStable(3000);
        } else if (actions[i].action === "click") {
          // Clicks may open modals, dropdowns, or tabs — wait for DOM to settle
          await waitForDomStable(2000);
        } else {
          await delay(300);
        }

        steps[i].status = "completed";
      } catch (err) {
        steps[i].status = "error";
        console.warn(`[InsightsWidget] Action failed:`, actions[i], err);
      }

      onStepUpdate?.(steps);

      // Delay between sequential actions
      if (i < actions.length - 1) {
        await delay(500);
      }
    }

    return steps;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isVisible(el: HTMLElement): boolean {
  try {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function getElementText(el: HTMLElement): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.placeholder || el.value || "";
  }
  if (el instanceof HTMLSelectElement) {
    const selected = el.options[el.selectedIndex];
    return selected?.text || "";
  }
  return (el.textContent || "").trim();
}

function buildSelector(el: HTMLElement): string {
  // Priority: data-testid > id > aria-label > name > tag+class
  const testId = el.getAttribute("data-testid");
  if (testId) return `[data-testid="${escapeCSS(testId)}"]`;

  if (el.id) return `#${escapeCSS(el.id)}`;

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return `[aria-label="${escapeCSS(ariaLabel)}"]`;

  const tag = el.tagName.toLowerCase();
  const parts: string[] = [tag];

  if (el instanceof HTMLInputElement && el.type && el.type !== "text") {
    parts.push(`[type="${el.type}"]`);
  }

  const name = el.getAttribute("name");
  if (name) {
    parts.push(`[name="${escapeCSS(name)}"]`);
    return parts.join("");
  }

  // For buttons/links, use text content as a fallback selector hint
  const text = getElementText(el).slice(0, 40);
  if (text && !el.querySelector("*")) {
    if (tag === "button" || tag === "a" || el.getAttribute("role") === "button") {
      const safeText = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      parts.push(`[data-iw-text="${safeText}"]`);
    }
  }

  // Last resort: add first class
  const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
  if (cls) parts.push(`.${escapeCSS(cls)}`);

  return parts.join("");
}

function buildActionLabel(action: BrowserAction): string {
  switch (action.action) {
    case "navigate": {
      const page = action.path?.split("/").filter(Boolean).pop() || "page";
      return `Navigate to ${page.charAt(0).toUpperCase()}${page.slice(1)}`;
    }
    case "click":
      return `Click "${action.buttonText || action.selector || "element"}"`;
    case "type":
      return `Type in ${action.selector || "field"}`;
    case "fill":
      return `Fill ${action.selector || "form"}`;
    case "select":
      return `Select "${action.value || "option"}"`;
    case "scroll":
      return `Scroll ${action.value ? `${action.value}px` : "page"}`;
    case "highlight":
      return `Highlight ${action.selector || "element"}`;
    case "read_page":
      return "Reading page content";
    default:
      return `${action.action}`;
  }
}

/**
 * Execute a single browser action on the host page DOM.
 */
async function executeAction(action: BrowserAction): Promise<void> {
  switch (action.action) {
    case "navigate": {
      if (!action.path) break;

      if (action.path.startsWith("http")) {
        // Full URL — hard navigate
        window.location.href = action.path;
        return;
      }

      // Step 1: ALWAYS dispatch custom event first — lets React Router / SPA handle it
      const navEvent = new CustomEvent("insights-widget:navigate", {
        detail: { path: action.path, tab: action.tab },
        bubbles: true,
        cancelable: true
      });
      const notCancelled = document.dispatchEvent(navEvent);

      // If host app handled it (called e.preventDefault()), we're done
      if (!notCancelled) return;

      // Step 2: Host app didn't handle it — try finding a matching <a> link
      const matchingLink = findMatchingLink(action.path);
      if (matchingLink) {
        // Prevent full page refresh — use SPA navigation instead
        matchingLink.click();
        return;
      }

      // Step 3: Advanced Heuristic — Sub-path Tab Resolution
      if (action.path.startsWith("/")) {
        const parts = action.path.split("/").filter(Boolean);
        if (parts.length > 1) {
          const basePath = "/" + parts[0];
          const tabName = parts[parts.length - 1];
          if (window.location.pathname === basePath || window.location.pathname.startsWith(basePath + "/")) {
            const tabBtn = findByText(tabName, "button, [role='tab'], a");
            if (tabBtn) {
              tabBtn.click();
              return;
            }
          }
        }
      }

      // Step 4: Fallback — relative path might be a tab name
      if (!action.path.startsWith("/") && !action.path.includes("?")) {
        const tabBtn = findByText(action.path, "button, [role='tab'], a");
        if (tabBtn) {
          tabBtn.click();
          return;
        }
      }

      // Step 5: Last resort — hard navigate (only for absolute paths)
      if (action.path.startsWith("/")) {
        window.location.href = action.path;
      }
      break;
    }

    case "click": {
      const el = findElement(action.selector, action.buttonText);
      if (!el) throw new Error(`Element not found: ${action.selector || action.buttonText}`);
      try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
      await delay(300);
      try {
        el.click();
      } catch (e) {
        // Fallback for click failures
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      }
      break;
    }

    case "type":
    case "fill": {
      if (action.formFields) {
        // Batch fill multiple fields
        for (const [selector, value] of Object.entries(action.formFields)) {
          const el = findElement(selector);
          if (el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
            try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
            await delay(150);
            try { el.focus(); } catch (e) {}
            setNativeValue(el, value || "");
          }
        }
      } else if (action.selector) {
        const el = findElement(action.selector);
        if (!el) throw new Error(`Element not found: ${action.selector}`);
        if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
          throw new Error(`Element is not an input: ${action.selector}`);
        }
        try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
        await delay(200);
        try { el.focus(); } catch (e) {}
        setNativeValue(el, action.value || "");
      }
      break;
    }

    case "select": {
      const el = findElement(action.selector);
      if (!el || !(el instanceof HTMLSelectElement)) {
        throw new Error(`Select element not found: ${action.selector}`);
      }

      // Try to match by value first, then by text
      let found = false;
      for (const opt of el.options) {
        if (opt.value === action.value || opt.text.toLowerCase().includes((action.value || "").toLowerCase())) {
          const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
          if (nativeSetter) {
            nativeSetter.call(el, opt.value);
          } else {
            el.value = opt.value;
          }
          el.dispatchEvent(new Event("change", { bubbles: true }));
          found = true;
          break;
        }
      }
      if (!found) throw new Error(`Option not found: ${action.value}`);
      break;
    }

    case "scroll": {
      const px = parseInt(action.value || "300", 10);
      if (action.selector) {
        const el = findElement(action.selector);
        if (el) {
          try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
        }
      } else {
        window.scrollBy({ top: px, behavior: "smooth" });
      }
      break;
    }

    case "highlight": {
      const el = findElement(action.selector);
      if (!el) throw new Error(`Element not found: ${action.selector}`);
      try {
        const orig = el.style.outline;
        const origTransition = el.style.transition;
        el.style.transition = "outline 0.3s";
        el.style.outline = "3px solid #7c3aed";
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        await delay(2500);
        el.style.outline = orig;
        el.style.transition = origTransition;
      } catch (e) {}
      break;
    }

    case "read_page":
      // No-op — the widget will re-harvest context automatically
      break;
  }
}

/**
 * Find a link in the page that matches the given path (for SPA-friendly navigation).
 */
function findMatchingLink(path: string): HTMLAnchorElement | null {
  const links = document.querySelectorAll("a[href]");
  for (const link of links) {
    const anchor = link as HTMLAnchorElement;
    try {
      const url = new URL(anchor.href, window.location.origin);
      if (url.pathname === path || url.pathname === path.replace(/\/$/, "")) {
        return anchor;
      }
    } catch {
      // skip invalid URLs
    }
  }
  return null;
}

/**
 * Find an element by selector (supports custom :has-text pseudo), aria-label, and text content.
 */
function findElement(selector?: string, text?: string): HTMLElement | null {
  if (selector) {
    // Handle data-iw-text attribute selector (text-based matching)
    const textAttrMatch = selector.match(/\[data-iw-text="(.+?)"\]/);
    if (textAttrMatch) {
      const baseSelector = selector.replace(/\[data-iw-text=".+?"\]/, "").trim();
      return findByText(textAttrMatch[1], baseSelector || undefined);
    }

    // Handle legacy :has-text() pseudo-selector
    const textMatch = selector.match(/:has-text\((?:["']?)(.*?)(?:["']?)\)/);
    if (textMatch) {
      const baseSelector = selector.replace(/:has-text\(.+?\)/, "").trim();
      return findByText(textMatch[1], baseSelector || undefined);
    }

    // Try standard CSS selector
    try {
      const el = document.querySelector(selector);
      if (el instanceof HTMLElement) return el;
    } catch {
      // Invalid selector — fall through
    }

    // Try aria-label match
    const ariaMatch = selector.match(/\[aria-label="(.+?)"\]/);
    if (ariaMatch) {
      const el = document.querySelector(`[aria-label="${ariaMatch[1]}"]`);
      if (el instanceof HTMLElement) return el;
    }

    // Try data-testid match
    const testidMatch = selector.match(/\[data-testid="(.+?)"\]/);
    if (testidMatch) {
      const el = document.querySelector(`[data-testid="${testidMatch[1]}"]`);
      if (el instanceof HTMLElement) return el;
    }
  }

  // Fall back to text search
  if (text) {
    return findByText(text);
  }

  return null;
}

function findByText(text: string, tagSelector?: string): HTMLElement | null {
  const candidates = document.querySelectorAll(tagSelector || "button, a, [role='button'], span, div, label");
  const lowerText = text.toLowerCase().trim();

  // Exact match first — highest priority
  for (const el of candidates) {
    const htmlEl = el as HTMLElement;
    if (!isVisible(htmlEl)) continue;
    const elText = (htmlEl.textContent || "").trim().toLowerCase();
    if (elText === lowerText) return htmlEl;
  }

  // Exact match on direct text content (ignoring children)
  for (const el of candidates) {
    const htmlEl = el as HTMLElement;
    if (!isVisible(htmlEl)) continue;
    const directText = Array.from(htmlEl.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent || "")
      .join("")
      .trim()
      .toLowerCase();
    if (directText === lowerText) return htmlEl;
  }

  // Partial match — lowest priority
  for (const el of candidates) {
    const htmlEl = el as HTMLElement;
    if (!isVisible(htmlEl)) continue;
    const elText = (htmlEl.textContent || "").trim().toLowerCase();
    if (elText.includes(lowerText)) return htmlEl;
  }

  return null;
}

/**
 * Set input value using the native setter to bypass React/Vue/Angular controlled components.
 */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Harvest visible text content from the page for the AI to understand context.
 * Excludes script/style tags and the widget itself.
 */
function harvestTextContent(widgetHost: HTMLElement | null): string {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Skip script, style, and the widget itself
        const tag = parent.tagName?.toLowerCase();
        if (tag === "script" || tag === "style" || tag === "noscript") return NodeFilter.FILTER_REJECT;
        if (widgetHost && widgetHost.contains(parent)) return NodeFilter.FILTER_REJECT;

        // Only include visible text
        const style = window.getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return NodeFilter.FILTER_REJECT;

        const text = node.textContent?.trim();
        if (!text || text.length < 2) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const chunks: string[] = [];
  let totalLength = 0;
  const MAX_LENGTH = 3000; // Keep text context budget reasonable

  try {
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      if (text && totalLength + text.length < MAX_LENGTH) {
        chunks.push(text);
        totalLength += text.length;
      }
      if (totalLength >= MAX_LENGTH) break;
    }
  } catch (e) {
    // If DOM mutated during walk, just return what we have so far
    console.warn("[InsightsWidget] Error during text harvesting", e);
  }

  return chunks.join(" ").slice(0, MAX_LENGTH);
}

/**
 * Wait for the DOM to stabilize (no mutations for a period).
 * Used after navigation to ensure the new page content has loaded.
 */
function waitForDomStable(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (!document.body) {
      resolve();
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const settled = () => {
      obs.disconnect();
      clearTimeout(timer);
      resolve();
    };

    const obs = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(settled, 500);
    });

    obs.observe(document.body, { childList: true, subtree: true });
    timer = setTimeout(settled, timeoutMs);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
