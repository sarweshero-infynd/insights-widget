export interface WidgetConfig {
  /** API Base URL (e.g., https://ai-studio.example.com/api/v1) */
  apiUrl: string;

  /** API Key for authentication */
  apiKey: string;

  /** Target Agent ID */
  agentId: string;

  /** Widget color theme */
  theme?: "dark" | "light" | "auto";

  /** FAB position on screen */
  position?: "bottom-right" | "bottom-left";

  /** Chat panel title */
  title?: string;

  /** Chat panel subtitle */
  subtitle?: string;

  /** Suggestion chips shown in empty state */
  suggestions?: string[];

  /** Maximum page elements to harvest for context */
  maxContextElements?: number;

  /** Enable debug logging */
  debug?: boolean;

  /** Locale for i18n */
  locale?: string;

  /** Custom color overrides */
  colors?: ThemeColors;

  /** Panel dimensions */
  panel?: PanelConfig;

  /** FAB configuration */
  fab?: FabConfig;

  /** Custom CSS styles injected into shadow DOM */
  customStyles?: string;

  /** Animation settings */
  animations?: AnimationConfig;

  /** Feature toggles */
  features?: FeatureConfig;
}

export interface ThemeColors {
  /** Primary brand color (used for FAB, user bubbles, accents) */
  primary?: string;

  /** Secondary accent color */
  secondary?: string;

  /** Panel background color */
  panelBackground?: string;

  /** Header background color */
  headerBackground?: string;

  /** Message area background */
  messageBackground?: string;

  /** Input area background */
  inputBackground?: string;

  /** Primary text color */
  textPrimary?: string;

  /** Secondary text color */
  textSecondary?: string;

  /** Border color throughout widget */
  border?: string;

  /** User message bubble background (gradient start) */
  userBubbleStart?: string;

  /** User message bubble background (gradient end) */
  userBubbleEnd?: string;

  /** Assistant message bubble background */
  assistantBubble?: string;

  /** Success/completed color */
  success?: string;

  /** Error color */
  error?: string;

  /** Warning/pending color */
  warning?: string;
}

export interface PanelConfig {
  /** Panel width in pixels */
  width?: number;

  /** Panel height in pixels */
  height?: number;

  /** Expanded panel width */
  expandedWidth?: number;

  /** Expanded panel height */
  expandedHeight?: number;

  /** Border radius in pixels */
  borderRadius?: number;

  /** Panel offset from FAB */
  offset?: number;

  /** Show close button */
  showCloseButton?: boolean;

  /** Show expand button */
  showExpandButton?: boolean;

  /** Show clear history button */
  showClearButton?: boolean;
}

export interface FabConfig {
  /** FAB size in pixels */
  size?: number;

  /** FAB border radius (50 for circle) */
  borderRadius?: number;

  /** FAB background color (overrides theme) */
  background?: string;

  /** FAB icon color */
  iconColor?: string;

  /** Enable pulse animation */
  pulse?: boolean;

  /** Enable hover scale effect */
  hoverScale?: boolean;

  /** Show notification badge */
  showBadge?: boolean;
}

export interface AnimationConfig {
  /** Panel open/close transition duration in ms */
  transitionDuration?: number;

  /** Enable typing indicator animation */
  typingIndicator?: boolean;

  /** Enable floating animation on empty state */
  floatAnimation?: boolean;

  /** Enable pulse animation on FAB */
  pulseAnimation?: boolean;
}

export interface FeatureConfig {
  /** Enable markdown rendering */
  markdown?: boolean;

  /** Enable copy button on code blocks */
  codeCopyButton?: boolean;

  /** Enable goal tracking display */
  goalTracking?: boolean;

  /** Enable browser action display */
  browserActions?: boolean;

  /** Enable thinking/reasoning display */
  thinkingDisplay?: boolean;

  /** Enable tool calls display */
  toolCalls?: boolean;

  /** Enable Escape key to close */
  escapeToClose?: boolean;

  /** Enable auto-scroll to bottom on new messages */
  autoScroll?: boolean;
}

// ── Internal Types ───────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  thinkingStatus?: "start" | "done";
  goal?: GoalState;
  toolCalls?: ToolCall[];
  browserActions?: BrowserActionStep[];
  isStreaming?: boolean;
  timestamp: number;
}

export interface ToolCall {
  tool_call_id: string;
  tool_name: string;
  input: string;
  output?: string;
  status: "success" | "error" | "pending";
}

export interface BrowserActionStep {
  action: string;
  path?: string;
  tab?: string;
  selector?: string;
  value?: string;
  label: string;
  status: "pending" | "executing" | "completed" | "error";
}

export interface GoalStep {
  description: string;
  status: "completed" | "active" | "pending" | "failed";
}

export interface GoalState {
  description: string;
  status: "in_progress" | "completed" | "failed";
  steps: GoalStep[];
}

export interface BrowserAction {
  action: "navigate" | "click" | "scroll" | "highlight" | "fill" | "type" | "select" | "read_page";
  path?: string;
  tab?: string;
  selector?: string;
  value?: string;
  buttonText?: string;
  formFields?: Record<string, string>;
  message?: string;
  status?: "pending" | "executing" | "completed" | "error";
}

export interface PageElement {
  tag: string;
  type?: string;
  text?: string;
  placeholder?: string;
  href?: string;
  selector: string;
  id?: string;
  name?: string;
  className?: string;
  visible: boolean;
  value?: string;
}

export interface PageContext {
  url: string;
  pathname: string;
  title: string;
  elements: PageElement[];
  textContent?: string;
  timestamp: number;
}

export interface ChatResponse {
  reply: string;
  model_used?: string;
  thinking?: string;
  tool_calls?: ToolCall[];
}
