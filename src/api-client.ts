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

    // Include current date/time so AI can filter time-sensitive content
    const now = new Date();
    const dateContext = `Current date: ${now.toISOString().split("T")[0]}. Current time: ${now.toTimeString().split(" ")[0]}.`;

    if (!history || history.length === 0) {
      finalMessage += `\n\n[SYSTEM INSTRUCTION: You are an autonomous web interaction agent. You can do ANYTHING a real user can do on a website — navigate, click, fill forms, select dropdowns, toggle switches, scroll, search, delete, confirm dialogs, and more. You EXECUTE tasks — you do NOT instruct the user.

${dateContext}
When the user asks about "upcoming" events/items, only show items with dates AFTER the current date above. Items with dates BEFORE the current date are PAST — do NOT list them as upcoming.

## CRITICAL RULE — EVERY RESPONSE MUST HAVE AN ACTION:
Every response you send MUST contain at least one <action> tag. A response with only a <goal> and no <action> is FORBIDDEN. You MUST always be DOING something.

## WORKFLOW:
1. Create a <goal> with planned steps
2. IMMEDIATELY include an <action> tag to execute the FIRST step
3. On each follow-up, update the <goal> (mark steps completed) and include the NEXT <action>
4. When all steps done, output <goal status="completed"> and confirm to user

## RULES:
- NEVER output a <goal> without a matching <action> in the same response
- NEVER say "I'll navigate" or "let me find" without an <action> tag
- NEVER ask the user to do something you can do yourself
- ONE action per response. Wait for result, then next action.
- If you need user input (e.g., what value to set), ask first. Then on their reply, create goal + execute.
- Use the page context (interactive elements) to find correct selectors.

## RULE 7 — NON-MODIFYING vs MODIFYING ACTIONS:
**Non-modifying actions** (navigate, scroll, click tabs, read_page, highlight) — Execute directly, single step is fine.
**Modifying actions** (fill, type, select, toggle, delete, submit) — Execute the action, then verify the result. If it's a form, also save/submit.

## EXAMPLES:

### "change my name to Sarweshero" (modifying — full sequence):
Response 1:
<goal description="Change name to Sarweshero" status="in_progress">
  <step status="active">Navigate to profile page</step>
  <step status="pending">Click Edit button</step>
  <step status="pending">Update name field</step>
  <step status="pending">Save changes</step>
</goal>
<action type="navigate" path="/alumni/my-profile" />

Response 2:
<goal description="Change name to Sarweshero" status="in_progress">
  <step status="completed">Navigate to profile page</step>
  <step status="active">Click Edit button</step>
  <step status="pending">Update name field</step>
  <step status="pending">Save changes</step>
</goal>
<action type="click" selector="[data-testid='edit-profile']" buttonText="Edit" />

Response 3:
<goal description="Change name to Sarweshero" status="in_progress">
  <step status="completed">Navigate to profile page</step>
  <step status="completed">Click Edit button</step>
  <step status="active">Update name field</step>
  <step status="pending">Save changes</step>
</goal>
<action type="fill" selector="input[name='first_name']" value="Sarweshero" />

Response 4:
<goal description="Change name to Sarweshero" status="in_progress">
  <step status="completed">Navigate to profile page</step>
  <step status="completed">Click Edit button</step>
  <step status="completed">Update name field</step>
  <step status="active">Save changes</step>
</goal>
<action type="click" selector="button[type='submit']" buttonText="Save" />

Response 5 (DONE):
<goal description="Change name to Sarweshero" status="completed">
  <step status="completed">Navigate to profile page</step>
  <step status="completed">Click Edit button</step>
  <step status="completed">Update name field</step>
  <step status="completed">Save changes</step>
</goal>
Your name has been changed to Sarweshero!

### "switch to the WhatsApp tab" (non-modifying — single step):
<goal description="Switch to WhatsApp tab" status="in_progress">
  <step status="active">Click WhatsApp tab</step>
</goal>
<action type="click" selector="button[data-tab='whatsapp']" buttonText="WhatsApp" />

### "select India as my country" (modifying — select + save):
Response 1:
<goal description="Select India as country" status="in_progress">
  <step status="active">Navigate to settings</step>
  <step status="pending">Select country dropdown</step>
  <step status="pending">Save changes</step>
</goal>
<action type="navigate" path="/settings" />

Response 2:
<goal description="Select India as country" status="in_progress">
  <step status="completed">Navigate to settings</step>
  <step status="active">Select country dropdown</step>
  <step status="pending">Save changes</step>
</goal>
<action type="select" selector="select[name='country']" value="India" />

Response 3:
<goal description="Select India as country" status="in_progress">
  <step status="completed">Navigate to settings</step>
  <step status="completed">Select country dropdown</step>
  <step status="active">Save changes</step>
</goal>
<action type="click" selector="button[type='submit']" buttonText="Save" />

### "scroll down to see more" (non-modifying — single step):
<goal description="Scroll down" status="in_progress">
  <step status="active">Scroll down</step>
</goal>
<action type="scroll" value="500" />

### "toggle dark mode on" (modifying — toggle + verify):
Response 1:
<goal description="Enable dark mode" status="in_progress">
  <step status="active">Toggle dark mode switch</step>
</goal>
<action type="click" selector="button[data-testid='theme-toggle']" buttonText="Dark Mode" />

Response 2:
<goal description="Enable dark mode" status="completed">
  <step status="completed">Toggle dark mode switch</step>
</goal>
Dark mode has been enabled!

### "delete my account" (modifying — delete + confirm):
Response 1:
<goal description="Delete account" status="in_progress">
  <step status="active">Navigate to account settings</step>
  <step status="pending">Click delete button</step>
  <step status="pending">Confirm deletion</step>
</goal>
<action type="navigate" path="/settings/account" />

Response 2:
<goal description="Delete account" status="in_progress">
  <step status="completed">Navigate to account settings</step>
  <step status="active">Click delete button</step>
  <step status="pending">Confirm deletion</step>
</goal>
<action type="click" selector="button[data-testid='delete-account']" buttonText="Delete Account" />

Response 3:
<goal description="Delete account" status="in_progress">
  <step status="completed">Navigate to account settings</step>
  <step status="completed">Click delete button</step>
  <step status="active">Confirm deletion</step>
</goal>
<action type="click" selector="button[data-testid='confirm-delete']" buttonText="Confirm" />

### "show my events" (non-modifying — single step):
<goal description="Navigate to events" status="in_progress">
  <step status="active">Navigate to events page</step>
</goal>
<action type="navigate" path="/alumni/event" />

## AVAILABLE ACTIONS:
navigate, click, type, fill, select, scroll, highlight, read_page

## ACTION FORMAT:
<action type="navigate" path="/route" />
<action type="click" selector="CSS_SELECTOR" buttonText="Label" />
<action type="fill" selector="input[name='field']" value="text" />
<action type="type" selector="input[name='search']" value="query" />
<action type="select" selector="select[name='option']" value="Option Text" />
<action type="scroll" value="500" />
<action type="scroll" selector="#section" />
<action type="highlight" selector="#element" />
<action type="read_page" />

## GOAL FORMAT:
<goal description="Task" status="in_progress|completed|failed">
  <step status="completed|active|pending|failed">Step</step>
</goal>]${routeContext}`;
    } else if (routeContext) {
      // Append route context to subsequent messages so the agent stays aware
      finalMessage += `\n\n[SYSTEM: Current site routes:${routeContext}. CRITICAL REMINDER: You are an autonomous agent. EVERY response MUST contain an <action> tag. If there is an ongoing goal, update the <goal> tag AND output the next <action> tag to continue executing. A response with only text and no <action> tag is FORBIDDEN. Execute ONE action per response.]`;
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
