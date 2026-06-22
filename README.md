# @27x/insights-widget

A standalone, framework-agnostic AI Assistance Web Component. Embed a fully customizable chat widget into any website to provide autonomous, agentic UI interactions, DOM harvesting, and real-time AI chat capabilities.

[![Version](https://img.shields.io/npm/v/@27x/insights-widget)](https://www.npmjs.com/package/@27x/insights-widget)
[![License](https://img.shields.io/npm/l/@27x/insights-widget)](https://github.com/27x/insights-widget/blob/main/LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@27x/insights-widget)](https://bundlephobia.com/package/@27x/insights-widget)

---

## Features

- **Zero Dependencies** — Pure vanilla JavaScript, no framework required
- **Shadow DOM** — Complete style isolation from host page
- **Dual Themes** — Beautiful light and dark themes with runtime toggle
- **Fully Customizable** — Colors, sizes, animations, and features configurable
- **AI-Powered Actions** — Navigate pages, fill forms, click elements autonomously
- **Markdown Rendering** — Rich text with code blocks, tables, and copy buttons
- **Goal Tracking** — Visual progress indicators for multi-step tasks
- **Accessibility** — ARIA labels, keyboard navigation, screen reader support
- **Session History** — Persistent chat history via sessionStorage
- **Framework Integration** — Custom events for SPA routing (Next.js, React Router, Vue Router)
- **Theme Toggle** — Users can switch between light/dark modes via header button

---

## Quick Start

### Via CDN (Easiest)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Website</title>
    <script src="https://unpkg.com/@27x/insights-widget@latest/dist/insights-widget.js" defer></script>
</head>
<body>
    <insights-widget 
        api-url="https://your-api.example.com/api/v1"
        api-key="your_api_key"
        agent-id="your_agent_id"
        theme="light"
        position="bottom-right"
        title="AI Assistant"
        subtitle="How can I help?">
    </insights-widget>
</body>
</html>
```

### Via NPM

```bash
npm install @27x/insights-widget
```

```javascript
// Auto-registers <insights-widget> custom element
import "@27x/insights-widget";

// Or use the programmatic API
import { InsightsWidget } from "@27x/insights-widget";

InsightsWidget.init({
  apiUrl: "https://your-api.example.com/api/v1",
  apiKey: "your_api_key",
  agentId: "your_agent_id",
  theme: "light",
  position: "bottom-right",
  title: "AI Assistant"
});
```

---

## Configuration

### Basic Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `api-url` | `string` | **required** | API endpoint URL |
| `api-key` | `string` | **required** | API authentication key |
| `agent-id` | `string` | **required** | Target agent identifier |
| `theme` | `"light" \| "dark" \| "auto"` | `"light"` | Color theme (user can toggle at runtime) |
| `position` | `"bottom-right" \| "bottom-left"` | `"bottom-right"` | FAB position |
| `title` | `string` | `"AI Assistant"` | Chat panel title |
| `subtitle` | `string` | `"Insights & Actions"` | Chat panel subtitle |

### Theme Colors

Customize every color in the widget:

```javascript
InsightsWidget.init({
  apiUrl: "...",
  apiKey: "...",
  agentId: "...",
  colors: {
    primary: "#6366f1",        // Primary brand color (FAB, accents)
    secondary: "#8b5cf6",      // Secondary accent
    panelBackground: "#ffffff", // Panel background
    textPrimary: "#111827",    // Main text color
    textSecondary: "#6b7280",  // Secondary text
    border: "#e5e7eb",         // Border color
    success: "#10b981",        // Completed states
    error: "#ef4444",          // Error states
    warning: "#f59e0b",        // Warning states
  }
});
```

### Panel Configuration

```javascript
InsightsWidget.init({
  apiUrl: "...",
  apiKey: "...",
  agentId: "...",
  panel: {
    width: 400,              // Panel width (px)
    height: 580,             // Panel height (px)
    expandedWidth: 640,      // Expanded width
    expandedHeight: 680,     // Expanded height
    borderRadius: 16,        // Border radius
    offset: 72,              // Distance from FAB
    showCloseButton: true,   // Show/hide close button
    showExpandButton: true,  // Show/hide expand button
    showClearButton: true,   // Show/hide clear history button
  }
});
```

### FAB Configuration

```javascript
InsightsWidget.init({
  apiUrl: "...",
  apiKey: "...",
  agentId: "...",
  fab: {
    size: 56,                // FAB diameter (px)
    borderRadius: 50,        // 50 = circle, lower = rounded square
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    iconColor: "#ffffff",
    pulse: true,             // Pulse animation
    hoverScale: true,        // Scale on hover
    showBadge: true,         // Notification badge
  }
});
```

### Animation Configuration

```javascript
InsightsWidget.init({
  apiUrl: "...",
  apiKey: "...",
  agentId: "...",
  animations: {
    transitionDuration: 250,  // Panel open/close speed (ms)
    typingIndicator: true,    // Animated dots while typing
    floatAnimation: true,     // Float on empty state icon
    pulseAnimation: true,     // FAB pulse animation
  }
});
```

### Feature Toggles

```javascript
InsightsWidget.init({
  apiUrl: "...",
  apiKey: "...",
  agentId: "...",
  features: {
    markdown: true,           // Enable markdown rendering
    codeCopyButton: true,     // Copy button on code blocks
    goalTracking: true,       // Goal progress display
    browserActions: true,     // Browser action display
    thinkingDisplay: true,    // AI thinking/reasoning
    toolCalls: true,          // Tool call display
    escapeToClose: true,      // ESC key closes widget
    autoScroll: true,         // Auto-scroll on new messages
  }
});
```

### Custom CSS

Inject your own styles into the Shadow DOM:

```javascript
InsightsWidget.init({
  apiUrl: "...",
  apiKey: "...",
  agentId: "...",
  customStyles: `
    .iw-fab {
      box-shadow: 0 8px 32px rgba(99, 102, 241, 0.4) !important;
    }
    .iw-panel {
      backdrop-filter: blur(20px);
    }
  `
});
```

### Suggestion Chips

```javascript
InsightsWidget.init({
  apiUrl: "...",
  apiKey: "...",
  agentId: "...",
  suggestions: [
    "What's on my dashboard?",
    "Show recent orders",
    "Analyze sales trends",
  ]
});
```

---

## Programmatic API

### Global Methods

```javascript
// Open the chat panel
InsightsWidget.open();

// Close the chat panel
InsightsWidget.close();

// Clear chat history
InsightsWidget.clearHistory();

// Update configuration
InsightsWidget.configure({ title: "New Title" });

// Toggle between light and dark theme
InsightsWidget.toggleTheme();

// Check if widget is loaded
if (InsightsWidget.isReady()) {
  console.log("Widget ready!");
}

// Remove widget from DOM
InsightsWidget.destroy();
```

### HTML Attributes

```html
<insights-widget
  api-url="https://api.example.com"
  api-key="key_123"
  agent-id="agent_456"
  theme="dark"
  position="bottom-left"
  title="Support Bot"
  subtitle="Ask me anything">
</insights-widget>
```

---

## SPA Integration

### Next.js / React Router

```javascript
// In your layout or app component
useEffect(() => {
  const handleNavigate = (e) => {
    e.preventDefault(); // Prevent default location.href fallback
    router.push(e.detail.path);
  };
  
  document.addEventListener('insights-widget:navigate', handleNavigate);
  return () => document.removeEventListener('insights-widget:navigate', handleNavigate);
}, [router]);
```

### Vue Router

```javascript
mounted() {
  const handleNavigate = (e) => {
    e.preventDefault();
    this.$router.push(e.detail.path);
  };
  
  document.addEventListener('insights-widget:navigate', handleNavigate);
  this.$once('hook:beforeDestroy', () => {
    document.removeEventListener('insights-widget:navigate', handleNavigate);
  });
}
```

### Plain JavaScript

```javascript
document.addEventListener('insights-widget:navigate', (e) => {
  e.preventDefault();
  window.history.pushState({}, '', e.detail.path);
  // Trigger your router's state change
});
```

---

## Browser Actions

The widget can execute autonomous browser actions based on AI responses:

| Action | Description |
|--------|-------------|
| `navigate` | Navigate to a URL or SPA route |
| `click` | Click an element by selector or text |
| `type` | Type text into an input field |
| `fill` | Fill form fields |
| `select` | Select an option from dropdown |
| `scroll` | Scroll to an element or by pixels |
| `highlight` | Highlight an element temporarily |
| `read_page` | Re-harvest page context |

### Action Format

```xml
<action type="navigate" path="/dashboard" />
<action type="click" selector="#submit-btn" buttonText="Submit" />
<action type="type" selector="[name='email']" value="user@example.com" />
<action type="fill" formFields='{"#name": "John", "#email": "john@example.com"}' />
```

---

## Goal Tracking

The AI can track multi-step goals with visual progress:

```xml
<goal description="Update campaign settings" status="in_progress">
  <step status="completed">Navigate to campaigns</step>
  <step status="active">Find the edit button</step>
  <step status="pending">Update the name</step>
</goal>
```

---

## TypeScript Support

Full TypeScript types are included:

```typescript
import type { 
  WidgetConfig, 
  ThemeColors, 
  PanelConfig, 
  FabConfig,
  AnimationConfig,
  FeatureConfig 
} from '@27x/insights-widget';
```

---

## Theming Examples

### Dark Professional

```javascript
{
  theme: "dark",
  colors: {
    primary: "#3b82f6",
    secondary: "#60a5fa",
    panelBackground: "#0f172a",
    textPrimary: "#f8fafc",
    border: "#1e293b",
  }
}
```

### Brand Purple

```javascript
{
  theme: "light",
  colors: {
    primary: "#7c3aed",
    secondary: "#a855f7",
    userBubbleStart: "#7c3aed",
    userBubbleEnd: "#a855f7",
  }
}
```

### Minimal White

```javascript
{
  theme: "light",
  colors: {
    primary: "#000000",
    secondary: "#374151",
    panelBackground: "#ffffff",
    border: "#d1d5db",
  },
  fab: {
    background: "#000000",
    pulse: false,
  }
}
```

---

## Security Considerations

- API keys are sent in request headers (use HTTPS in production)
- All user input is escaped to prevent XSS
- Markdown rendering sanitizes HTML output
- `javascript:` and `data:` URLs are blocked in links
- Shadow DOM provides complete style isolation

---

## Browser Support

- Chrome 67+
- Firefox 63+
- Safari 10.1+
- Edge 79+

Requires:
- `CustomElements` v1
- `ShadowRoot` v1
- `AbortSignal` (with polyfill for older browsers)

---

## Development

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Watch for changes
npm run watch
```

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
