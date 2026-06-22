import type { WidgetConfig, ThemeColors, PanelConfig, FabConfig, AnimationConfig } from "./types";

// ── Default Color Palettes ──────────────────────────────────────────────────

const LIGHT_COLORS: ThemeColors = {
  primary: "#7c3aed",
  secondary: "#a855f7",
  panelBackground: "#ffffff",
  headerBackground: "rgba(255, 255, 255, 0.95)",
  messageBackground: "#f9fafb",
  inputBackground: "rgba(255, 255, 255, 0.95)",
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  border: "#e5e7eb",
  userBubbleStart: "#7c3aed",
  userBubbleEnd: "#a855f7",
  assistantBubble: "#f3f4f6",
  success: "#10b981",
  error: "#ef4444",
  warning: "#f59e0b",
};

const DARK_COLORS: ThemeColors = {
  primary: "#a78bfa",
  secondary: "#c4b5fd",
  panelBackground: "#0f0d15",
  headerBackground: "rgba(15, 13, 21, 0.95)",
  messageBackground: "#16131f",
  inputBackground: "rgba(15, 13, 21, 0.95)",
  textPrimary: "#f5f3ff",
  textSecondary: "#a1a1aa",
  border: "#27272a",
  userBubbleStart: "#7c3aed",
  userBubbleEnd: "#a855f7",
  assistantBubble: "#1e1b2e",
  success: "#4ade80",
  error: "#f87171",
  warning: "#fbbf24",
};

const DEFAULT_PANEL: PanelConfig = {
  width: 400,
  height: 580,
  expandedWidth: 640,
  expandedHeight: 680,
  borderRadius: 16,
  offset: 72,
  showCloseButton: true,
  showExpandButton: true,
  showClearButton: true,
};

const DEFAULT_FAB: FabConfig = {
  size: 56,
  borderRadius: 50,
  pulse: true,
  hoverScale: true,
  showBadge: true,
};

const DEFAULT_ANIMATIONS: AnimationConfig = {
  transitionDuration: 250,
  typingIndicator: true,
  floatAnimation: true,
  pulseAnimation: true,
};

// ── Resolve Colors ──────────────────────────────────────────────────────────

function resolveColors(config: WidgetConfig): ThemeColors {
  const isDark = config.theme === "dark" || config.theme === "auto";
  const base = isDark ? DARK_COLORS : LIGHT_COLORS;
  return { ...base, ...config.colors };
}

// ── Main Style Generator ────────────────────────────────────────────────────

export function getStyles(config: WidgetConfig): string {
  const position = config.position || "bottom-right";
  const isRight = position === "bottom-right";
  const side = isRight ? "right" : "left";
  const c = resolveColors(config);
  const panel = { ...DEFAULT_PANEL, ...config.panel };
  const fab = { ...DEFAULT_FAB, ...config.fab };
  const anim = { ...DEFAULT_ANIMATIONS, ...config.animations };
  const fabSize = fab.size || 56;
  const br = panel.borderRadius || 16;
  const panelBr = isRight ? `${br}px ${br}px ${br / 4}px ${br}px` : `${br}px ${br}px ${br}px ${br / 4}px`;
  const bubbleBrUser = isRight ? `${br}px ${br}px ${br / 4}px ${br}px` : `${br}px ${br}px ${br}px ${br / 4}px`;
  const bubbleBrAssistant = isRight ? `${br}px ${br}px ${br}px ${br / 4}px` : `${br}px ${br}px ${br / 4}px ${br}px`;
  const transitionMs = anim.transitionDuration || 250;

  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: ${c.textPrimary};
      position: fixed;
      bottom: 24px;
      ${side}: 24px;
      z-index: 2147483647;
      pointer-events: none;
    }

    :host(*) { box-sizing: border-box; }

    /* ── FAB ── */
    .iw-fab {
      pointer-events: auto;
      position: absolute;
      bottom: 0;
      ${side}: 0;
      width: ${fabSize}px;
      height: ${fabSize}px;
      border-radius: ${fab.borderRadius}%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${fab.background || `linear-gradient(135deg, ${c.primary}, ${c.secondary})`};
      color: #fff;
      box-shadow: 0 4px 24px ${c.primary}59, 0 0 0 0 ${c.primary}4d;
      transition: transform 0.3s, box-shadow 0.3s;
      ${fab.pulse ? `animation: iw-pulse 2.5s infinite;` : ""}
      z-index: 1;
    }
    .iw-fab:hover { transform: ${fab.hoverScale ? "scale(1.06)" : "none"}; box-shadow: 0 6px 32px ${c.primary}73; }
    .iw-fab:active { transform: scale(0.95); }
    .iw-fab svg { width: ${fabSize * 0.46}px; height: ${fabSize * 0.46}px; transition: transform 0.3s; }
    .iw-fab.iw-open svg { transform: rotate(90deg); }
    .iw-fab-badge {
      position: absolute;
      top: -4px;
      ${isRight ? "right" : "left"}: -4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: ${c.error};
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ── Panel ── */
    .iw-panel {
      pointer-events: auto;
      position: absolute;
      bottom: ${panel.offset}px;
      ${side}: 0;
      width: ${panel.width}px;
      height: ${panel.height}px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 120px);
      display: flex;
      flex-direction: column;
      background: ${c.panelBackground};
      border: 1px solid ${c.border};
      border-radius: ${panelBr};
      box-shadow: 0 25px 60px rgba(0,0,0,0.15), 0 0 0 1px ${c.border}20;
      overflow: hidden;
      opacity: 0;
      transform: translateY(16px) scale(0.96);
      transition: opacity ${transitionMs}ms ease, transform ${transitionMs}ms ease;
    }
    .iw-panel.iw-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .iw-panel.iw-expanded {
      width: ${panel.expandedWidth}px;
      height: ${panel.expandedHeight}px;
    }

    /* ── Header ── */
    .iw-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      padding: 0 16px;
      border-bottom: 1px solid ${c.border};
      background: ${c.headerBackground};
      backdrop-filter: blur(12px);
    }
    .iw-header-left { display: flex; align-items: center; gap: 10px; }
    .iw-header-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${c.primary}1a;
      color: ${c.primary};
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .iw-header-avatar svg { width: 24px; height: 24px; }
    .iw-header-title { font-size: 13.5px; font-weight: 700; letter-spacing: -0.01em; color: ${c.textPrimary}; }
    .iw-header-sub { font-size: 10px; font-weight: 500; color: ${c.textSecondary}; }
    .iw-header-actions { display: flex; align-items: center; gap: 4px; }
    .iw-icon-btn {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: ${c.textSecondary};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .iw-icon-btn:hover { background: ${c.primary}14; color: ${c.textPrimary}; }
    .iw-icon-btn svg { width: 16px; height: 16px; }
    .iw-theme-btn { transition: transform 0.3s, background 0.15s, color 0.15s; }
    .iw-theme-btn:hover { transform: rotate(15deg); }

    /* ── Messages ── */
    .iw-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: ${c.messageBackground};
      scroll-behavior: smooth;
    }
    .iw-messages::-webkit-scrollbar { width: 5px; }
    .iw-messages::-webkit-scrollbar-track { background: transparent; }
    .iw-messages::-webkit-scrollbar-thumb { background: ${c.border}; border-radius: 4px; }

    /* ── Empty State ── */
    .iw-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px;
      gap: 16px;
    }
    .iw-empty-icon {
      width: 48px;
      height: 48px;
      border-radius: 16px;
      background: linear-gradient(135deg, ${c.primary}26, ${c.secondary}26);
      color: ${c.primary};
      display: flex;
      align-items: center;
      justify-content: center;
      ${anim.floatAnimation ? `animation: iw-float 3s ease-in-out infinite;` : ""}
    }
    .iw-empty-icon svg { width: 28px; height: 28px; }
    .iw-empty h4 { font-size: 14px; font-weight: 700; color: ${c.textPrimary}; }
    .iw-empty p { font-size: 11.5px; color: ${c.textSecondary}; max-width: 280px; }
    .iw-suggestions-label {
      width: 100%;
      max-width: 280px;
      padding-top: 16px;
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${c.textSecondary};
      padding-left: 4px;
    }
    .iw-suggestions {
      width: 100%;
      max-width: 280px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .iw-suggestion {
      width: 100%;
      text-align: left;
      padding: 8px 14px;
      border-radius: 12px;
      border: 1px solid ${c.border};
      background: ${c.panelBackground};
      color: ${c.textPrimary};
      font-size: 11.5px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .iw-suggestion:hover {
      background: ${c.primary}14;
      color: ${c.primary};
      border-color: ${c.primary}40;
    }

    /* ── Message Bubbles ── */
    .iw-msg { display: flex; flex-direction: column; }
    .iw-msg.iw-user { align-items: flex-end; }
    .iw-msg.iw-assistant { align-items: flex-start; }
    .iw-msg-bubble {
      max-width: 85%;
      padding: 14px;
      border-radius: ${br}px;
      font-size: 13.5px;
      line-height: 1.55;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      word-wrap: break-word;
    }
    .iw-msg.iw-user .iw-msg-bubble {
      background: linear-gradient(135deg, ${c.userBubbleStart}, ${c.userBubbleEnd});
      color: #fff;
      border-radius: ${bubbleBrUser};
    }
    .iw-msg.iw-assistant .iw-msg-bubble {
      background: ${c.assistantBubble};
      border: 1px solid ${c.border};
      color: ${c.textPrimary};
      border-radius: ${bubbleBrAssistant};
    }
    .iw-msg-label {
      font-size: 9px;
      color: ${c.textSecondary};
      margin-top: 4px;
      padding: 0 4px;
    }

    /* ── Markdown Content ── */
    .iw-md p { margin: 0 0 8px; }
    .iw-md p:last-child { margin-bottom: 0; }
    .iw-md strong { font-weight: 700; }
    .iw-md em { font-style: italic; }
    .iw-md code {
      padding: 2px 6px;
      border-radius: 4px;
      background: ${c.border}40;
      font-size: 12px;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }
    .iw-md pre {
      padding: 12px;
      border-radius: 8px;
      background: ${c.panelBackground === "#ffffff" ? "#f3f4f6" : "#0a0a0a"};
      overflow-x: auto;
      margin: 8px 0;
    }
    .iw-md pre code { background: none; padding: 0; }
    .iw-code-block { position: relative; margin: 8px 0; }
    .iw-code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 12px;
      background: ${c.panelBackground === "#ffffff" ? "#e5e7eb" : "#1a1a2e"};
      border-radius: 8px 8px 0 0;
      border-bottom: 1px solid ${c.border}40;
    }
    .iw-code-lang {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: ${c.textSecondary};
    }
    .iw-copy-btn {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid ${c.border};
      background: transparent;
      color: ${c.textSecondary};
      cursor: pointer;
      transition: all 0.15s;
    }
    .iw-copy-btn:hover { background: ${c.primary}14; color: ${c.primary}; }
    .iw-copy-btn.copied { color: ${c.success}; border-color: ${c.success}4d; }
    .iw-code-block pre { margin-top: 0; border-radius: 0 0 8px 8px; }
    .iw-md ul, .iw-md ol { padding-left: 20px; margin: 8px 0; }
    .iw-md li { margin: 4px 0; }
    .iw-md a { color: ${c.primary}; text-decoration: underline; }
    .iw-md a:hover { color: ${c.secondary}; }
    .iw-md table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 12px;
    }
    .iw-md th, .iw-md td {
      padding: 6px 10px;
      border: 1px solid ${c.border};
      text-align: left;
    }
    .iw-md th { background: ${c.primary}0d; font-weight: 600; }
    .iw-md blockquote {
      border-left: 3px solid ${c.primary};
      padding-left: 12px;
      margin: 8px 0;
      color: ${c.textSecondary};
    }
    .iw-md h1, .iw-md h2, .iw-md h3, .iw-md h4 {
      margin: 12px 0 8px;
      font-weight: 700;
    }
    .iw-md h1 { font-size: 18px; }
    .iw-md h2 { font-size: 16px; }
    .iw-md h3 { font-size: 14px; }

    /* ── Thinking Block ── */
    .iw-thinking {
      margin-bottom: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      background: ${c.primary}14;
      border: 1px solid ${c.primary}26;
    }
    .iw-thinking-header {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${c.primary};
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .iw-thinking-content {
      font-size: 11px;
      color: ${c.textSecondary};
      max-height: 120px;
      overflow-y: auto;
    }

    /* ── Goal Tracker ── */
    .iw-goal-card { border: 1px solid ${c.border}; border-radius: 8px; background: ${c.assistantBubble}; margin-bottom: 12px; overflow: hidden; }
    .iw-goal-header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: ${c.primary}0d; border-bottom: 1px solid ${c.border}; font-weight: 500; font-size: 13px; color: ${c.primary}; }
    .iw-goal-steps { padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; }
    .iw-goal-step { display: flex; align-items: center; gap: 8px; font-size: 12px; color: ${c.textSecondary}; }
    .iw-goal-step-done { color: ${c.textPrimary}; }
    .iw-goal-step-done .iw-goal-step-label { text-decoration: line-through; opacity: 0.7; }
    .iw-goal-step-active { color: ${c.primary}; font-weight: 500; }
    .iw-goal-icon { display: flex; align-items: center; }

    /* ── Action Steps ── */
    .iw-actions { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
    .iw-actions-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${c.textSecondary};
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .iw-actions-label svg { width: 12px; height: 12px; }
    .iw-action-step {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      transition: background 0.2s;
    }
    .iw-action-step svg { width: 16px; height: 16px; flex-shrink: 0; }
    .iw-action-step.iw-pending {
      background: ${c.panelBackground === "#ffffff" ? "#f9fafb" : "#1a1a2e"};
      border: 1px solid ${c.border};
      color: ${c.textSecondary};
    }
    .iw-action-step.iw-executing {
      background: ${c.primary}1a;
      border: 1px solid ${c.primary}33;
      color: ${c.primary};
    }
    .iw-action-step.iw-completed {
      background: ${c.success}14;
      border: 1px solid ${c.success}2e;
      color: ${c.success};
    }
    .iw-action-step.iw-completed .iw-action-label { text-decoration: line-through; opacity: 0.7; }
    .iw-action-step.iw-error {
      background: ${c.error}14;
      border: 1px solid ${c.error}2e;
      color: ${c.error};
    }

    /* ── Loading Wave ── */
    .iw-loading { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
    .iw-loading-dots { display: flex; gap: 4px; }
    .iw-loading-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${c.primary};
      animation: iw-bounce 1.4s infinite ease-in-out;
    }
    .iw-loading-dot:nth-child(1) { animation-delay: -0.32s; }
    .iw-loading-dot:nth-child(2) { animation-delay: -0.16s; }
    .iw-loading-text { font-size: 11px; color: ${c.textSecondary}; animation: iw-pulse-text 2s infinite; }

    /* ── Tool Calls ── */
    .iw-tools { margin-bottom: 8px; }
    .iw-tool-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 11px;
      color: ${c.textSecondary};
    }
    .iw-tool-item svg { width: 12px; height: 12px; color: ${c.primary}; }

    /* ── Input ── */
    .iw-input-wrap {
      flex-shrink: 0;
      padding: 12px;
      border-top: 1px solid ${c.border};
      background: ${c.inputBackground};
      backdrop-filter: blur(12px);
    }
    .iw-input-container {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 12px;
      border: 1px solid ${c.border};
      background: ${c.messageBackground};
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .iw-input-container:focus-within {
      border-color: ${c.primary};
      box-shadow: 0 0 0 3px ${c.primary}26;
    }
    .iw-input {
      flex: 1;
      resize: none;
      background: transparent;
      border: none;
      outline: none;
      color: ${c.textPrimary};
      font-size: 13px;
      font-family: inherit;
      line-height: 1.5;
      padding: 4px 0;
      max-height: 96px;
      overflow-y: auto;
    }
    .iw-input::placeholder { color: ${c.textSecondary}; }
    .iw-send-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: none;
      background: ${c.primary};
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .iw-send-btn:hover:not(:disabled) { filter: brightness(0.9); }
    .iw-send-btn:disabled { background: ${c.border}; color: ${c.textSecondary}; cursor: not-allowed; }
    .iw-send-btn svg { width: 14px; height: 14px; }
    .iw-send-btn .iw-spin { animation: iw-spin 1s linear infinite; }
    .iw-input-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 6px;
      padding: 0 4px;
    }
    .iw-input-hint { font-size: 9.5px; color: ${c.textSecondary}; }

    /* ── Typing Indicator ── */
    .iw-typing { display: flex; align-items: flex-start; gap: 10px; }
    .iw-typing-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: ${c.primary}1a;
      color: ${c.primary};
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      ${anim.typingIndicator ? `animation: iw-pulse-text 2s infinite;` : ""}
    }
    .iw-typing-avatar svg { width: 14px; height: 14px; }
    .iw-typing-bubble {
      background: ${c.assistantBubble};
      border: 1px solid ${c.border};
      border-radius: ${bubbleBrAssistant};
      padding: 12px 14px;
    }

    /* ── Animations ── */
    @keyframes iw-pulse {
      0% { box-shadow: 0 4px 24px ${c.primary}59, 0 0 0 0 ${c.primary}4d; }
      70% { box-shadow: 0 4px 24px ${c.primary}59, 0 0 0 8px ${c.primary}00; }
      100% { box-shadow: 0 4px 24px ${c.primary}59, 0 0 0 0 ${c.primary}00; }
    }
    @keyframes iw-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    @keyframes iw-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
    @keyframes iw-pulse-text {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes iw-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
}
