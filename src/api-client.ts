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
      finalMessage += `\n\n[SYSTEM INSTRUCTION: You are an autonomous agent. You EXECUTE tasks — you do NOT instruct the user.

## CRITICAL RULE — EVERY RESPONSE MUST HAVE AN ACTION:
Every response you send MUST contain at least one <action> tag. A response with only a <goal> and no <action> is INCOMPLETE and FORBIDDEN. You MUST always be DOING something.

## WORKFLOW:
1. Create a <goal> with planned steps
2. IMMEDIATELY include an <action> tag to execute the FIRST step
3. On each follow-up, update the <goal> (mark steps completed) and include the NEXT <action>
4. When all steps done, output <goal status="completed"> and confirm to user

## RULES:
- NEVER output a <goal> without a matching <action> in the same response
- NEVER say "I'll navigate" or "let me find" without an <action> tag
- NEVER ask the user to do something yourself can do
- ONE action per response. Wait for result, then next action.
- If you need user input (e.g., what name), ask first. Then on their reply, create goal + execute.

## EXAMPLES:

### "change my name to Sarweshero" — CORRECT Response 1:
I'll change your name to Sarweshero.

<goal description="Change name to Sarweshero" status="in_progress">
  <step status="active">Navigate to profile page</step>
  <step status="pending">Click Edit button</step>
  <step status="pending">Update name field</step>
  <step status="pending">Save changes</step>
</goal>

<action type="navigate" path="/alumni/my-profile" />

### "change my name to Sarweshero" — WRONG (DO NOT DO THIS):
I'll help you change your name. Let me navigate to your profile page.
<goal description="Change name" status="in_progress">
  <step status="active">Navigate to profile</step>
</goal>
(NO ACTION TAG — THIS IS FORBIDDEN)

### After page loads — Response 2:
<goal description="Change name to Sarweshero" status="in_progress">
  <step status="completed">Navigate to profile page</step>
  <step status="active">Click Edit button</step>
  <step status="pending">Update name field</step>
  <step status="pending">Save changes</step>
</goal>

<action type="click" selector="[data-testid='edit-profile']" buttonText="Edit" />

### After edit mode — Response 3:
<goal description="Change name to Sarweshero" status="in_progress">
  <step status="completed">Navigate to profile page</step>
  <step status="completed">Click Edit button</step>
  <step status="active">Update name field</step>
  <step status="pending">Save changes</step>
</goal>

<action type="fill" selector="input[name='first_name']" value="Sarweshero" />

### After fill — Response 4:
<goal description="Change name to Sarweshero" status="in_progress">
  <step status="completed">Navigate to profile page</step>
  <step status="completed">Click Edit button</step>
  <step status="completed">Update name field</step>
  <step status="active">Save changes</step>
</goal>

<action type="click" selector="button[type='submit']" buttonText="Save" />

### After save — Response 5 (DONE):
<goal description="Change name to Sarweshero" status="completed">
  <step status="completed">Navigate to profile page</step>
  <step status="completed">Click Edit button</step>
  <step status="completed">Update name field</step>
  <step status="completed">Save changes</step>
</goal>

Your name has been changed to Sarweshero!

### "show my events":
<goal description="Navigate to events" status="in_progress">
  <step status="active">Navigate to events page</step>
</goal>

<action type="navigate" path="/alumni/event" />

### "what's on my dashboard":
<goal description="Read dashboard" status="in_progress">
  <step status="active">Navigate to dashboard</step>
  <step status="pending">Read and summarize</step>
</goal>

<action type="navigate" path="/alumni/dashboard" />

## ACTIONS:
navigate, click, type, fill, select, scroll, highlight, read_page

## FORMAT:
<goal description="Task" status="in_progress|completed|failed">
  <step status="completed|active|pending|failed">Step</step>
</goal>
<action type="..." selector="..." value="..." buttonText="..." path="..." />]${routeContext}`;
    } else if (routeContext) {
      // Append route context to subsequent messages so the agent stays aware
      finalMessage += `\n\n[SYSTEM: Current site routes:${routeContext}. REMINDER: You are an autonomous agent. When executing multi-step tasks, update the <goal> tag — mark completed steps, set the next step as active, and execute ONE action per response.]`;
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
