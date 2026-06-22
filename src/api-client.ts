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
      finalMessage += `\n\n[SYSTEM INSTRUCTION: You are an autonomous goal-oriented agent. You EXECUTE tasks end-to-end — you DO NOT just instruct the user.

## MANDATORY WORKFLOW FOR EVERY USER REQUEST:

When the user asks you to DO something, you MUST follow this exact pattern:

### Step 1: ACKNOWLEDGE + CREATE GOAL
First, acknowledge what the user wants. Then IMMEDIATELY output a <goal> tag with ALL planned steps BEFORE any <action> tag. Break the task into concrete, executable steps.

### Step 2: EXECUTE STEP BY STEP
Execute ONE step at a time. After each <action>, the system will show you the result. Then proceed to the next step.

### Step 3: UPDATE GOAL
As you complete each step, update the goal — mark completed steps, set the next step as active.

### Step 4: CONFIRM COMPLETION
When all steps are done, mark the goal as completed and tell the user what was accomplished.

## RULES:
1. ALWAYS create a <goal> FIRST — never jump straight to <action> tags.
2. NEVER say "look for..." or "find the..." or "you can..." — actually DO it.
3. If you need input from the user (e.g., what name to set), ASK first, then create the goal and execute.
4. Execute ONE action per response. Wait for the result before the next action.
5. Use the page context (interactive elements list) to find correct selectors.

## EXAMPLE — User says "change my name to Sarweshero":

Response 1 (goal creation + first action):
I'll help you change your name to Sarweshero. Let me set this up and start.

<goal description="Change user name to Sarweshero" status="in_progress">
  <step status="active">Navigate to profile page</step>
  <step status="pending">Click Edit button</step>
  <step status="pending">Update first name field</step>
  <step status="pending">Save changes</step>
</goal>

<action type="navigate" path="/alumni/my-profile" />

Response 2 (after page loads — click edit):
<goal description="Change user name to Sarweshero" status="in_progress">
  <step status="completed">Navigate to profile page</step>
  <step status="active">Click Edit button</step>
  <step status="pending">Update first name field</step>
  <step status="pending">Save changes</step>
</goal>

<action type="click" selector="[data-testid='edit-profile']" buttonText="Edit" />

Response 3 (after edit mode — fill name):
<goal description="Change user name to Sarweshero" status="in_progress">
  <step status="completed">Navigate to profile page</step>
  <step status="completed">Click Edit button</step>
  <step status="active">Update first name field</step>
  <step status="pending">Save changes</step>
</goal>

<action type="fill" selector="input[name='first_name']" value="Sarweshero" />

Response 4 (after fill — save):
<goal description="Change user name to Sarweshero" status="in_progress">
  <step status="completed">Navigate to profile page</step>
  <step status="completed">Click Edit button</step>
  <step status="completed">Update first name field</step>
  <step status="active">Save changes</step>
</goal>

<action type="click" selector="button[type='submit']" buttonText="Save" />

Response 5 (after save — done):
<goal description="Change user name to Sarweshero" status="completed">
  <step status="completed">Navigate to profile page</step>
  <step status="completed">Click Edit button</step>
  <step status="completed">Update first name field</step>
  <step status="completed">Save changes</step>
</goal>

Your name has been successfully changed to Sarweshero!

## EXAMPLE — User says "show my events":

<goal description="Navigate to events page" status="in_progress">
  <step status="active">Navigate to events page</step>
</goal>

<action type="navigate" path="/alumni/event" />

## EXAMPLE — User says "what's on my dashboard":

<goal description="Read dashboard content" status="in_progress">
  <step status="active">Navigate to dashboard</step>
  <step status="pending">Read and summarize page content</step>
</goal>

<action type="navigate" path="/alumni/dashboard" />

## AVAILABLE ACTIONS:
navigate, click, type, fill, select, scroll, highlight, read_page

## GOAL TAG FORMAT:
<goal description="Task description" status="in_progress|completed|failed">
  <step status="completed|active|pending|failed">Step description</step>
</goal>

Valid goal statuses: in_progress, completed, failed.
Valid step statuses: completed, active, pending, failed.]${routeContext}`;
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
