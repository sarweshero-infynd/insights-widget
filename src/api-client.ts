import type { ChatResponse, PageContext } from "./types";

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
    return validateUrl(this.apiUrl) && this.agentId.length > 0;
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
    if (!history || history.length === 0) {
      finalMessage += `\n\n[SYSTEM INSTRUCTION: You are an autonomous goal-oriented agent. When executing multi-step tasks, you MUST track your progress by outputting your current goal state using the following XML schema before your <action> tag:
<goal description="Overall task description" status="in_progress">
  <step status="completed">Step 1</step>
  <step status="active">Step 2</step>
  <step status="pending">Step 3</step>
</goal>
Valid goal statuses: in_progress, completed, failed. Valid step statuses: completed, active, pending, failed.]`;
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
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
