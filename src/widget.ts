import type { WidgetConfig, ChatMessage, BrowserAction, BrowserActionStep } from "./types";
import { ApiClient } from "./api-client";
import { DomController } from "./dom-controller";
import { renderMarkdown } from "./markdown";
import { getStyles } from "./styles";
import { icons } from "./icons";

const MAX_HISTORY_LENGTH = 100;
const MAX_FOLLOWUP_DEPTH = 3;
const STORAGE_KEY_PREFIX = "iw_";
const MAX_ERROR_MESSAGE_LENGTH = 200;
const MAX_INPUT_LENGTH = 4000;
const DEBUG_PREFIX = "[InsightsWidget]";

const DEFAULT_SUGGESTIONS = [
  "Summarize the latest sales inbox updates",
  "Show my WhatsApp chats overview",
  "Any new messages on LinkedIn?",
  "Give me a summary of active campaigns",
];

function debugLog(config: WidgetConfig | undefined, ...args: unknown[]): void {
  if (config?.debug) {
    console.log(DEBUG_PREFIX, ...args);
  }
}

export class InsightsWidgetElement extends HTMLElement {
  private shadow: ShadowRoot;
  private config!: WidgetConfig;
  private api!: ApiClient;
  private dom: DomController;
  private messages: ChatMessage[] = [];
  private isOpen = false;
  private isExpanded = false;
  private isChatting = false;
  private message = "";
  private abortController: AbortController | null = null;
  private followUpDepth = 0;
  private lastMessageTime = 0;
  private currentTheme: "light" | "dark" = "light";
  private boundKeyHandler?: (e: KeyboardEvent) => void;

  private panelEl?: HTMLDivElement;
  private messagesEl?: HTMLDivElement;
  private inputEl?: HTMLTextAreaElement;
  private fabEl?: HTMLButtonElement;
  private badgeEl?: HTMLSpanElement;
  private sendBtnEl?: HTMLButtonElement;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.dom = new DomController(50);
  }

  connectedCallback(): void {
    try {
      this.readConfig();
    } catch {
      this.config = {
        apiUrl: "",
        apiKey: "",
        agentId: "",
        theme: "light",
        position: "bottom-right",
        title: "AI Assistant",
        subtitle: "Insights & Actions",
        suggestions: DEFAULT_SUGGESTIONS,
      };
      this.currentTheme = "light";
    }
    debugLog(this.config, "Connected", { apiUrl: this.config.apiUrl, agentId: this.config.agentId });
    this.api = new ApiClient(this.config.apiUrl, this.config.apiKey, this.config.agentId);
    this.dom.setWidgetHost(this);
    this.dom.setMaxElements(this.config.maxContextElements || 50);
    this.loadHistory();
    this.render();
    this.dom.startObserving(() => {});

    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.isOpen) {
        this.isOpen = false;
        this.updatePanel();
      }
    };
    document.addEventListener("keydown", this.boundKeyHandler);

    if (!this.api.isValid()) {
      debugLog(this.config, "Invalid configuration detected");
      this.messages.push({
        role: "assistant",
        content: "Widget configuration is incomplete. Please provide apiUrl, apiKey, and agentId.",
        timestamp: Date.now(),
      });
      this.renderMessages();
    }
  }

  disconnectedCallback(): void {
    this.dom.stopObserving();
    this.abortController?.abort();
    this.abortController = null;
    this.followUpDepth = 0;
    if (this.boundKeyHandler) {
      document.removeEventListener("keydown", this.boundKeyHandler);
      this.boundKeyHandler = undefined;
    }
  }

  // ─── Configuration ───

  private readConfig(): void {
    const scriptEl = document.querySelector("script[data-api-url]") as HTMLScriptElement | null;
    const themeAttr = (this.getAttribute("theme") || scriptEl?.dataset.theme || "light") as WidgetConfig["theme"];
    this.config = {
      apiUrl: this.getAttribute("api-url") || scriptEl?.dataset.apiUrl || "",
      apiKey: this.getAttribute("api-key") || scriptEl?.dataset.apiKey || "",
      agentId: this.getAttribute("agent-id") || scriptEl?.dataset.agentId || "",
      theme: themeAttr,
      position: (this.getAttribute("position") || scriptEl?.dataset.position || "bottom-right") as WidgetConfig["position"],
      title: this.getAttribute("title") || scriptEl?.dataset.title || "AI Assistant",
      subtitle: this.getAttribute("subtitle") || scriptEl?.dataset.subtitle || "Insights & Actions",
      suggestions: DEFAULT_SUGGESTIONS,
    };
    this.currentTheme = this.resolveTheme(themeAttr);
  }

  private resolveTheme(theme: WidgetConfig["theme"]): "light" | "dark" {
    if (theme === "auto") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return theme || "light";
  }

  public toggleTheme(): void {
    this.currentTheme = this.currentTheme === "light" ? "dark" : "light";
    this.config.theme = this.currentTheme;
    this.render();
    debugLog(this.config, "Theme toggled to", this.currentTheme);
  }

  public configure(opts: Partial<WidgetConfig>): void {
    this.config = { ...this.config, ...opts };
    
    if (this.config.apiUrl && this.config.apiKey && this.config.agentId && this.api) {
      this.api.setConfig(this.config.apiUrl, this.config.apiKey, this.config.agentId);
    }
    if (opts.suggestions) this.config.suggestions = opts.suggestions;
    if (opts.maxContextElements) this.dom.setMaxElements(opts.maxContextElements);
    this.render();
  }

  public open(): void { this.isOpen = true; this.updatePanel(); this.focusInput(); }
  public close(): void { this.isOpen = false; this.updatePanel(); }

  public clearHistory(): void {
    this.messages = [];
    this.saveHistory();
    this.abortController?.abort();
    this.isChatting = false;
    this.renderMessages();
  }

  // ─── History ───

  private getStorageKey(): string {
    const agentId = this.config?.agentId || "default";
    return `${STORAGE_KEY_PREFIX}${agentId}_history`;
  }

  private loadHistory(): void {
    try {
      const raw = sessionStorage.getItem(this.getStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.messages = parsed.slice(-MAX_HISTORY_LENGTH);
        }
      }
    } catch { /* ignore corrupt data */ }
  }

  private saveHistory(): void {
    try {
      const trimmed = this.messages.slice(-MAX_HISTORY_LENGTH);
      sessionStorage.setItem(this.getStorageKey(), JSON.stringify(trimmed));
    } catch { /* storage full or unavailable */ }
  }

  // ─── Render ───

  private render(): void {
    this.shadow.innerHTML = `<style>${getStyles(this.config)}</style>${this.config.customStyles ? `<style>${this.config.customStyles}</style>` : ""}`;

    // FAB
    this.fabEl = el("button", "iw-fab") as HTMLButtonElement;
    this.fabEl.setAttribute("aria-label", "Open AI Assistant");
    this.fabEl.setAttribute("type", "button");
    this.fabEl.innerHTML = icons.sparkles(26);
    this.fabEl.addEventListener("click", () => {
      this.isOpen = !this.isOpen;
      this.updatePanel();
      if (this.isOpen) this.focusInput();
    });

    this.badgeEl = el("span", "iw-fab-badge") as HTMLSpanElement;
    this.badgeEl.setAttribute("aria-hidden", "true");
    this.badgeEl.style.display = "none";
    this.fabEl.appendChild(this.badgeEl);

    // Panel
    this.panelEl = el("div", "iw-panel") as HTMLDivElement;
    this.panelEl.setAttribute("role", "dialog");
    this.panelEl.setAttribute("aria-label", this.config.title || "AI Assistant");

    // Header
    const themeIcon = this.currentTheme === "light" ? icons.moon(16) : icons.sun(16);
    const themeLabel = this.currentTheme === "light" ? "Switch to dark mode" : "Switch to light mode";
    const header = el("div", "iw-header");
    header.innerHTML = `
      <div class="iw-header-left">
        <div class="iw-header-avatar" aria-hidden="true">${icons.bot(24)}</div>
        <div>
          <div class="iw-header-title">${esc(this.config.title || "AI Assistant")}</div>
          <div class="iw-header-sub">${esc(this.config.subtitle || "Insights & Actions")}</div>
        </div>
      </div>
      <div class="iw-header-actions">
        <button class="iw-icon-btn iw-theme-btn" title="${themeLabel}" aria-label="${themeLabel}">${themeIcon}</button>
        <button class="iw-icon-btn iw-clear-btn" title="Clear chat" aria-label="Clear chat history">${icons.trash(16)}</button>
        <button class="iw-icon-btn iw-expand-btn" title="Toggle size" aria-label="Toggle panel size">${icons.maximize(16)}</button>
        <button class="iw-icon-btn iw-close-btn" title="Close" aria-label="Close panel">${icons.chevronDown(18)}</button>
      </div>`;

    const themeBtn = header.querySelector(".iw-theme-btn");
    const clearBtn = header.querySelector(".iw-clear-btn");
    const expandBtn = header.querySelector(".iw-expand-btn");
    const closeBtn = header.querySelector(".iw-close-btn");

    if (themeBtn) themeBtn.addEventListener("click", () => this.toggleTheme());

    if (clearBtn) clearBtn.addEventListener("click", () => this.clearHistory());
    if (expandBtn) expandBtn.addEventListener("click", () => {
      this.isExpanded = !this.isExpanded;
      this.panelEl!.classList.toggle("iw-expanded", this.isExpanded);
      expandBtn.innerHTML = this.isExpanded ? icons.minimize(16) : icons.maximize(16);
      expandBtn.setAttribute("aria-label", this.isExpanded ? "Collapse panel" : "Expand panel");
    });
    if (closeBtn) closeBtn.addEventListener("click", () => {
      this.isOpen = false; this.updatePanel();
    });

    // Messages
    this.messagesEl = el("div", "iw-messages") as HTMLDivElement;
    this.messagesEl.setAttribute("role", "log");
    this.messagesEl.setAttribute("aria-live", "polite");
    this.messagesEl.setAttribute("aria-label", "Chat messages");

    // Input
    const inputWrap = el("div", "iw-input-wrap");
    inputWrap.innerHTML = `
      <div class="iw-input-container">
        <textarea class="iw-input" rows="1" placeholder="Ask assistant..." aria-label="Message input" maxlength="${MAX_INPUT_LENGTH}"></textarea>
        <button class="iw-send-btn" disabled aria-label="Send message">${icons.send(14)}</button>
      </div>
      <div class="iw-input-footer"><span class="iw-input-hint">Press Enter to send, Shift+Enter for new line</span></div>`;

    this.inputEl = inputWrap.querySelector(".iw-input") as HTMLTextAreaElement;
    this.sendBtnEl = inputWrap.querySelector(".iw-send-btn") as HTMLButtonElement;

    if (this.inputEl) {
      this.inputEl.addEventListener("input", () => {
        this.message = this.inputEl!.value;
        this.sendBtnEl!.disabled = !this.message.trim() || this.isChatting;
        autoResize(this.inputEl!);
      });
      this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.handleSend(); }
        if (e.key === "Escape") { this.close(); }
      });
    }

    if (this.sendBtnEl) {
      this.sendBtnEl.addEventListener("click", () => this.handleSend());
    }

    // Assemble
    this.panelEl.append(header, this.messagesEl, inputWrap);
    this.shadow.append(this.fabEl, this.panelEl);
    this.renderMessages();
    this.updatePanel();
  }

  // ─── Messages Rendering ───

  private renderMessages(): void {
    if (!this.messagesEl) return;

    if (this.messages.length === 0) {
      this.messagesEl.innerHTML = this.renderEmpty();
      this.messagesEl.querySelectorAll(".iw-suggestion").forEach((btn) => {
        btn.addEventListener("click", () => this.handleSend((btn as HTMLElement).textContent || ""));
      });
      return;
    }

    let html = "";
    for (const msg of this.messages) html += this.renderMsg(msg);

    // Show typing indicator when waiting for response
    if (this.isChatting) {
      html += `<div class="iw-typing"><div class="iw-typing-avatar">${icons.bot(14)}</div>
        <div class="iw-typing-bubble"><div class="iw-loading">
          <div class="iw-loading-dots"><div class="iw-loading-dot"></div><div class="iw-loading-dot"></div><div class="iw-loading-dot"></div></div>
          <span class="iw-loading-text">Generating...</span></div></div></div>`;
    }

    this.messagesEl.innerHTML = html;
    this.setupCopyButtons();
    raf(() => { if (this.messagesEl) this.messagesEl.scrollTop = this.messagesEl.scrollHeight; });
  }

  private setupCopyButtons(): void {
    if (!this.messagesEl) return;
    this.messagesEl.querySelectorAll(".iw-copy-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const codeId = (btn as HTMLElement).dataset.codeId;
        const codeEl = codeId ? this.messagesEl!.querySelector(`#${codeId}`) : null;
        if (codeEl) {
          try {
            await navigator.clipboard.writeText(codeEl.textContent || "");
            btn.classList.add("copied");
            const originalText = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => {
              btn.classList.remove("copied");
              btn.textContent = originalText;
            }, 2000);
          } catch {
            debugLog(this.config, "Clipboard copy failed");
          }
        }
      });
    });
  }

  private renderEmpty(): string {
    const allSuggestions = this.config.suggestions || DEFAULT_SUGGESTIONS;
    const uniqueSuggestions = [...new Set(allSuggestions.filter((s) => s && s.trim()))];
    const chips = uniqueSuggestions
      .map((s) => `<button class="iw-suggestion" type="button" aria-label="Send suggestion: ${esc(s)}">${esc(s)}</button>`).join("");
    return `<div class="iw-empty">
      <div class="iw-empty-icon" aria-hidden="true">${icons.bot(28)}</div>
      <div><h4>Ask anything about your platform</h4>
        <p>I can navigate pages, read data, fill forms, and give you insights — all from this chat.</p></div>
      ${chips ? `<div class="iw-suggestions-label" id="iw-suggestions-label">Quick Suggestions</div>
      <div class="iw-suggestions" aria-labelledby="iw-suggestions-label">${chips}</div>` : ""}</div>`;
  }

  private renderMsg(msg: ChatMessage): string {
    const isUser = msg.role === "user";
    const cls = isUser ? "iw-user" : "iw-assistant";
    const label = isUser ? "You" : (this.config.title || "AI Assistant");
    let body = "";

    if (msg.thinking) {
      body += `<div class="iw-thinking"><div class="iw-thinking-header">${icons.sparkles(12)} Thinking</div>
        <div class="iw-thinking-content">${esc(msg.thinking)}</div></div>`;
    }
    
    if (msg.goal) {
      const isDone = msg.goal.status === "completed";
      let goalHtml = `<div class="iw-goal-card">
         <div class="iw-goal-header">
           <div class="iw-goal-icon">${isDone ? icons.checkCircle(16) : `<span style="animation:iw-spin 1s linear infinite;display:inline-flex">${icons.loader(16)}</span>`}</div>
           <div class="iw-goal-title">Goal: ${esc(msg.goal.description)}</div>
         </div>
         <div class="iw-goal-steps">`;
      const steps = msg.goal.steps || [];
      for (const step of steps) {
         const sDone = step.status === "completed";
         const sActive = step.status === "active";
         const icon = sDone ? icons.checkCircle(14) : sActive ? `<span style="animation:iw-spin 1s linear infinite;display:inline-flex">${icons.loader(14)}</span>` : `<div style="width:12px;height:12px;border-radius:50%;border:1px solid #666;margin:1px;"></div>`;
         const stepCls = sDone ? "iw-goal-step-done" : sActive ? "iw-goal-step-active" : "iw-goal-step-pending";
         goalHtml += `<div class="iw-goal-step ${stepCls}">${icon} <span>${esc(step.description)}</span></div>`;
      }
      goalHtml += `</div></div>`;
      body += goalHtml;
    }

    if (msg.toolCalls?.length) {
      body += `<div class="iw-tools">`;
      for (const tc of msg.toolCalls) {
        const icon = tc.status === "success" ? icons.checkCircle(12) : icons.loader(12);
        body += `<div class="iw-tool-item">${icon}<span>${esc(tc.tool_name)}${tc.status === "success" ? " ✓" : tc.status === "error" ? " ✗" : ""}</span></div>`;
      }
      body += `</div>`;
    }
    if (!isUser && msg.browserActions?.length) {
      body += this.renderSteps(msg.browserActions);
    }
    if (msg.content) {
      body += `<div class="iw-md">${renderMarkdown(msg.content)}</div>`;
    } else if (msg.isStreaming && !msg.thinking && !msg.browserActions?.length && !msg.goal) {
      body += `<div class="iw-loading"><div class="iw-loading-dots"><div class="iw-loading-dot"></div><div class="iw-loading-dot"></div><div class="iw-loading-dot"></div></div><span class="iw-loading-text">Generating...</span></div>`;
    }

    return `<div class="iw-msg ${cls}"><div class="iw-msg-bubble">${body}</div><span class="iw-msg-label">${esc(label)}</span></div>`;
  }

  private renderSteps(actions: BrowserActionStep[]): string {
    const iconMap: Record<string, string> = {
      navigate: icons.navigation(16), click: icons.mousePointer(16), scroll: icons.arrowDown(16),
      highlight: icons.highlighter(16), fill: icons.mousePointer(16), type: icons.mousePointer(16),
      select: icons.mousePointer(16), read_page: icons.table(16),
    };

    let html = `<div class="iw-actions"><span class="iw-actions-label">${icons.bot(12)} Actions</span>`;
    for (const step of actions) {
      const sc = step.status === "completed" ? "iw-completed" : step.status === "executing" ? "iw-executing" : step.status === "error" ? "iw-error" : "iw-pending";
      const icon = step.status === "completed" ? icons.checkCircle(16) :
        step.status === "executing" ? `<span style="animation:iw-spin 1s linear infinite;display:inline-flex">${icons.loader(16)}</span>` :
        step.status === "error" ? icons.x(16) : (iconMap[step.action] || icons.navigation(16));
      html += `<div class="iw-action-step ${sc}">${icon}<span class="iw-action-label">${esc(step.label)}</span></div>`;
    }
    return html + `</div>`;
  }

  // ─── Core Send + Action Workflow ───

  private async handleSend(textToSend?: string): Promise<void> {
    const prompt = (textToSend || this.message).trim();
    if (!prompt || this.isChatting) return;

    const now = Date.now();
    if (now - this.lastMessageTime < 500) return;
    this.lastMessageTime = now;

    if (!textToSend && this.inputEl) {
      this.message = "";
      this.inputEl.value = "";
      autoResize(this.inputEl);
      if (this.sendBtnEl) this.sendBtnEl.disabled = true;
    }

    this.messages.push({ role: "user", content: prompt, timestamp: Date.now() });
    this.isChatting = true;
    this.renderMessages();

    try {
      this.abortController = new AbortController();
      debugLog(this.config, "Sending message", { prompt: prompt.slice(0, 100), historyLength: this.messages.length });

      const pageContext = this.dom.harvestPageContext();
      debugLog(this.config, "Page context harvested", { elements: pageContext.elements.length });

      const history = this.messages
        .filter((m) => !m.isStreaming && m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await this.api.sendMessage(prompt, history, pageContext, this.abortController.signal);
      debugLog(this.config, "Response received", { hasContent: !!response.reply, hasThinking: !!response.thinking });

      const { actions, steps, goal, cleanContent } = parseActionTags(response.reply || "");

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: cleanContent,
        thinking: response.thinking,
        thinkingStatus: response.thinking ? "done" : undefined,
        goal: goal,
        toolCalls: response.tool_calls?.length ? response.tool_calls : undefined,
        browserActions: steps.length > 0 ? steps : undefined,
        isStreaming: false,
        timestamp: Date.now(),
      };
      this.messages.push(assistantMsg);
      this.isChatting = false;
      this.renderMessages();
      this.saveHistory();

      if (actions.length > 0) {
        const msgIdx = this.messages.length - 1;
        await this.dom.executeActions(actions, (updatedSteps) => {
          this.messages[msgIdx].browserActions = updatedSteps;
          this.renderMessages();
        });
        this.saveHistory();

        const hasNavigation = actions.some((a) => a.action === "navigate" || a.action === "read_page");
        const isGoalActive = goal && goal.status === "in_progress";
        
        if ((hasNavigation || isGoalActive) && this.followUpDepth < MAX_FOLLOWUP_DEPTH) {
          this.followUpDepth++;
          await this.followUpWithPageData(prompt);
        }
      } else if (goal && goal.status === "in_progress" && this.followUpDepth < MAX_FOLLOWUP_DEPTH) {
        this.followUpDepth++;
        await this.followUpWithPageData(prompt);
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === "AbortError") return;
      const errorMsg = truncate(error.message || "Unknown error", MAX_ERROR_MESSAGE_LENGTH);
      this.messages.push({
        role: "assistant",
        content: `Error: ${errorMsg}`,
        timestamp: Date.now(),
      });
      this.saveHistory();
    } finally {
      this.abortController = null;
      this.isChatting = false;
      this.renderMessages();
    }
  }

  /**
   * After navigation/read_page, re-harvest the new page's DOM and send it
   * back to the agent so it can process the data and answer the user's question.
   */
  private async followUpWithPageData(originalPrompt: string): Promise<void> {
    this.isChatting = true;
    this.renderMessages();

    try {
      this.abortController = new AbortController();

      const newContext = this.dom.harvestPageContext();

      const followUp = `[SYSTEM: Page navigated. Current URL: ${newContext.url}, Title: "${newContext.title}". `
        + `Visible text content: ${(newContext.textContent || "").slice(0, 2000)}. `
        + `Interactive elements: ${JSON.stringify(newContext.elements.slice(0, 30))}. `
        + `Please process this page data and provide the answer to the user's original request: "${originalPrompt}"]`;

      const history = this.messages
        .filter((m) => !m.isStreaming && m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await this.api.sendMessage(followUp, history, newContext, this.abortController.signal);

      const { actions: newActions, steps: newSteps, goal, cleanContent } = parseActionTags(response.reply || "");

      this.messages.push({
        role: "assistant",
        content: cleanContent,
        thinking: response.thinking,
        thinkingStatus: response.thinking ? "done" : undefined,
        goal: goal,
        toolCalls: response.tool_calls?.length ? response.tool_calls : undefined,
        browserActions: newSteps.length > 0 ? newSteps : undefined,
        isStreaming: false,
        timestamp: Date.now(),
      });

      this.saveHistory();

      if (newActions.length > 0) {
        const msgIdx = this.messages.length - 1;
        await this.dom.executeActions(newActions, (updatedSteps) => {
          this.messages[msgIdx].browserActions = updatedSteps;
          this.renderMessages();
        });
        this.saveHistory();

        const hasNavigation = newActions.some((a) => a.action === "navigate" || a.action === "read_page");
        const isGoalActive = goal && goal.status === "in_progress";

        if ((hasNavigation || isGoalActive) && this.followUpDepth < MAX_FOLLOWUP_DEPTH) {
          this.followUpDepth++;
          await this.followUpWithPageData(originalPrompt);
        }
      } else if (goal && goal.status === "in_progress" && this.followUpDepth < MAX_FOLLOWUP_DEPTH) {
        this.followUpDepth++;
        await this.followUpWithPageData(originalPrompt);
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name !== "AbortError") {
        const errorMsg = truncate(error.message || "Unknown error", MAX_ERROR_MESSAGE_LENGTH);
        this.isChatting = false;
        this.messages.push({
          role: "assistant",
          content: `Could not process page data: ${errorMsg}`,
          timestamp: Date.now(),
        });
        this.saveHistory();
      }
    } finally {
      this.abortController = null;
      this.isChatting = false;
      this.followUpDepth = 0;
      this.renderMessages();
    }
  }

  // ─── Helpers ───

  private updatePanel(): void {
    if (!this.panelEl || !this.fabEl) return;
    this.panelEl.classList.toggle("iw-visible", this.isOpen);
    this.fabEl.classList.toggle("iw-open", this.isOpen);
    // Update FAB icon WITHOUT destroying the badge
    const svgEls = this.fabEl.querySelectorAll(":scope > svg");
    svgEls.forEach((s) => s.remove());
    this.fabEl.insertAdjacentHTML("afterbegin", this.isOpen ? icons.x(26) : icons.sparkles(26));
  }

  private focusInput(): void {
    raf(() => this.inputEl?.focus());
  }
}

// ── Action Tag Parser ────────────────────────────────────────────────────────

function parseActionTags(content: string): {
  actions: BrowserAction[];
  steps: BrowserActionStep[];
  goal?: import("./types").GoalState;
  cleanContent: string;
} {
  const actions: BrowserAction[] = [];
  const steps: BrowserActionStep[] = [];
  let goal: import("./types").GoalState | undefined;

  // Parse Goal
  const goalRegex = /<goal\s+([^>]+)>([\s\S]*?)<\/goal>/g;
  const goalMatch = goalRegex.exec(content);
  if (goalMatch) {
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
    let am;
    while ((am = attrRegex.exec(goalMatch[1])) !== null) {
      attrs[am[1]] = am[2] || am[3] || am[4] || "";
    }
    
    const stepsContent = goalMatch[2];
    const goalSteps: import("./types").GoalStep[] = [];
    const stepRegex = /<step\s+status=(?:"([^"]*)"|'([^']*)')>([\s\S]*?)<\/step>/g;
    let stepMatch;
    while ((stepMatch = stepRegex.exec(stepsContent)) !== null) {
      goalSteps.push({
        status: (stepMatch[1] || stepMatch[2]) as import("./types").GoalStep["status"],
        description: stepMatch[3].trim()
      });
    }

    goal = {
      description: attrs.description || "In Progress",
      status: (attrs.status || "in_progress") as import("./types").GoalState["status"],
      steps: goalSteps
    };
  }
  const regex = /<action\s+([^>]+)\s*\/?>/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
    let am;
    while ((am = attrRegex.exec(match[1])) !== null) {
      attrs[am[1]] = am[2] || am[3] || am[4] || "";
    }
    if (attrs.type) {
      actions.push({
        action: attrs.type as BrowserAction["action"],
        path: attrs.path, tab: attrs.tab, selector: attrs.selector,
        value: attrs.value, buttonText: attrs.buttonText,
        formFields: undefined, message: attrs.message, status: "pending",
      });
      const label = buildLabel(attrs);
      steps.push({
        action: attrs.type, path: attrs.path, tab: attrs.tab,
        selector: attrs.selector, value: attrs.value, label, status: "pending",
      });
    }
  }

  const cleanContent = content
    .replace(/<action\s+[^>]+\/?>/g, "")
    .replace(/<goal\s+[^>]+>[\s\S]*?<\/goal>/g, "")
    .trim();
    
  return { actions, steps, goal, cleanContent };
}

function buildLabel(a: Record<string, string>): string {
  switch (a.type) {
    case "navigate": {
      const p = a.path?.split("/").filter(Boolean).pop() || "page";
      return `Navigate to ${p.charAt(0).toUpperCase()}${p.slice(1)}`;
    }
    case "click": return `Click "${a.buttonText || a.selector || "element"}"`;
    case "type": return `Type in ${a.selector || "field"}`;
    case "fill": return `Fill ${a.selector || "form"}`;
    case "scroll": return `Scroll ${a.value ? `${a.value}px` : "page"}`;
    default: return a.type || "action";
  }
}

// ── Tiny helpers ─────────────────────────────────────────────────────────────

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}

function esc(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function autoResize(ta: HTMLTextAreaElement): void {
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 96) + "px";
}

function raf(fn: () => void): void {
  requestAnimationFrame(fn);
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
}
