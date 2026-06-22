import type { ChatResponse, PageContext, RouteEntry } from "./types";

const DEFAULT_TIMEOUT_MS = 60000;
const MAX_MESSAGE_LENGTH = 50000;

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export class ApiClient {
  private apiUrl: string;
  private apiKey: string;
  private agentId: string;
  private timeoutMs: number;

  constructor(apiUrl: string, apiKey: string, agentId: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.apiUrl = apiUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.agentId = agentId;
    this.timeoutMs = timeoutMs;
  }

  setConfig(apiUrl: string, apiKey: string, agentId: string): void {
    this.apiUrl = apiUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.agentId = agentId;
  }

  isValid(): boolean {
    return validateUrl(this.apiUrl) && this.apiKey.length > 0 && this.agentId.length > 0;
  }

  async sendMessage(
    message: string,
    history: Array<{ role: string; content: string }>,
    pageContext?: PageContext,
    signal?: AbortSignal
  ): Promise<ChatResponse> {
    if (!this.isValid()) {
      throw new Error("Invalid API configuration: check apiUrl and agentId");
    }

    const url = `${this.apiUrl}/agents/${encodeURIComponent(this.agentId)}/chat`;
    const trimmedMessage = message.slice(0, MAX_MESSAGE_LENGTH);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    let finalMessage = trimmedMessage;

    // Build route context for the system instruction
    let routeContext = "";
    if (pageContext?.routes && pageContext.routes.length > 0) {
      routeContext = `\nAvailable site routes: ${pageContext.routes.map((r: RouteEntry) => `${r.path}${r.label ? ` (${r.label})` : ""}`).join(", ")}.`;
    }

    if (!history || history.length === 0) {
      finalMessage += `\n\n[SYSTEM INSTRUCTION: You are an autonomous goal-oriented agent that EXECUTES tasks end-to-end. You DO NOT just instruct the user — you PERFORM the actions yourself using <action> tags.

CORE RULES:
1. When the user asks you to DO something (change name, update profile, submit form, etc.), you MUST execute the full workflow yourself: navigate → find element → click → fill → save/submit.
2. NEVER respond with "look for..." or "find the..." or "you can..." — instead, actually DO it with <action> tags.
3. If you need input from the user (e.g., what name to set), ASK the user first. Wait for their response. Then execute the actions with the input they provided.
4. After each action, observe the result and continue to the next step automatically.
5. Track your progress using <goal> tags for multi-step tasks.

ACTION WORKFLOW for "change my name to X":
- Step 1: Navigate to profile page → <action type="navigate" path="/alumni/my-profile" />
- Step 2: Click Edit button → <action type="click" selector="..." buttonText="Edit" />
- Step 3: Fill the name field → <action type="fill" selector="..." value="X" />
- Step 4: Click Save → <action type="click" selector="..." buttonText="Save" />

Always use <goal> tags to track multi-step progress:
<goal description="Task description" status="in_progress">
  <step status="completed">Completed step</step>
  <step status="active">Current step</step>
  <step status="pending">Future step</step>
</goal>

Available actions: navigate, click, type, fill, select, scroll, highlight, read_page.
Use the page context (interactive elements) to find the correct selectors.]${routeContext}`;
    } else if (routeContext) {
      // Append route context to subsequent messages so the agent stays aware
      finalMessage += `\n\n[SYSTEM: Current site routes:${routeContext}]`;
    }

    const body: Record<string, unknown> = {
      message: finalMessage,
      history: history || [],
      page_context: pageContext || undefined,
      stream: false,
      enable_thinking: false
    };

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), this.timeoutMs);

    let combinedSignal: AbortSignal;
    if (signal) {
      if (typeof AbortSignal.any === "function") {
        combinedSignal = AbortSignal.any([signal, timeoutController.signal]);
      } else {
        const combined = new AbortController();
        const onAbort = () => combined.abort(signal.reason || timeoutController.signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
        timeoutController.signal.addEventListener("abort", onAbort, { once: true });
        combinedSignal = combined.signal;
      }
    } else {
      combinedSignal = timeoutController.signal;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: combinedSignal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "Unknown error");
        let detail = text;
        try {
          const parsed = JSON.parse(text);
          detail = parsed.detail || parsed.message || text;
        } catch {
          // use raw text
        }
        throw new Error(`API error ${response.status}: ${detail}`);
      }

      const data = await response.json();
      return data as ChatResponse;
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === "AbortError" && !signal?.aborted) {
        throw new Error("Request timed out");
      }
      if (error.name === "TypeError" && error.message.includes("Failed to fetch")) {
        throw new Error("Network error: unable to reach the API server");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
