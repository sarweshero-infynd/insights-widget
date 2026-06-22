const DANGEROUS_PROTOCOLS = /^\s*(javascript|data|vbscript):/i;
let codeBlockCounter = 0;

function isSafeUrl(url: string): boolean {
  return !DANGEROUS_PROTOCOLS.test(url);
}

/**
 * Render a subset of Markdown to HTML.
 *
 * Processing order matters:
 *   1. Fenced code blocks — extracted & escaped first so nothing touches them.
 *   2. Inline code — same treatment.
 *   3. Block-level structures (lists, blockquotes, tables, headings, hr) are
 *      detected and their **text content** is escaped at this point.
 *   4. Inline formatting (bold, italic, links, images) runs LAST so it can
 *      convert markdown syntax inside any block element without the result
 *      being re-escaped.
 *   5. Paragraph wrapping on remaining bare text.
 */
export function renderMarkdown(text: string): string {
  if (!text) return "";

  let html = text;

  // ── 1. Fenced code blocks (must be first) ──────────────────────────────
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const escaped = escapeHtml(code.trimEnd());
    const safeLang = (lang || "text").replace(/[^a-zA-Z0-9_-]/g, "");
    const codeId = `code-${++codeBlockCounter}-${Math.random().toString(36).slice(2, 6)}`;
    return `<div class="iw-code-block"><div class="iw-code-header"><span class="iw-code-lang">${safeLang}</span><button class="iw-copy-btn" data-code-id="${codeId}" aria-label="Copy code">Copy</button></div><pre><code id="${codeId}" class="lang-${safeLang}">${escaped}</code></pre></div>`;
  });

  // ── 2. Inline code ─────────────────────────────────────────────────────
  html = html.replace(/`([^`\n]+)`/g, (_m, code: string) => `<code>${escapeHtml(code)}</code>`);

  // ── 3. Headings ────────────────────────────────────────────────────────
  // Escape heading content to prevent XSS, but allow inline formatting markers
  // to survive for later processing.
  html = html.replace(/^#### (.+)$/gm, (_m, t: string) => `<h4>${escapeHtmlPreserveMarkdown(t)}</h4>`);
  html = html.replace(/^### (.+)$/gm, (_m, t: string) => `<h3>${escapeHtmlPreserveMarkdown(t)}</h3>`);
  html = html.replace(/^## (.+)$/gm, (_m, t: string) => `<h2>${escapeHtmlPreserveMarkdown(t)}</h2>`);
  html = html.replace(/^# (.+)$/gm, (_m, t: string) => `<h1>${escapeHtmlPreserveMarkdown(t)}</h1>`);

  // ── 4. Blockquotes ────────────────────────────────────────────────────
  // Escape blockquote content to prevent XSS.
  html = html.replace(/^> (.+)$/gm, (_m, t: string) => `<blockquote>${escapeHtmlPreserveMarkdown(t)}</blockquote>`);
  html = html.replace(/<\/blockquote>\n<blockquote>/g, "\n");

  // ── 5. Horizontal rules ───────────────────────────────────────────────
  html = html.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:12px 0">');

  // ── 6. Tables ─────────────────────────────────────────────────────────
  // Cell content is NOT escaped — inline formatting runs after this.
  html = processTables(html);

  // ── 7. Unordered lists ────────────────────────────────────────────────
  // Escape list items to prevent XSS, but allow inline formatting markers.
  html = html.replace(/^(?:- (.+)\n?)+/gm, (match) => {
    const items = match
      .split("\n")
      .filter((l) => l.startsWith("- "))
      .map((l) => `<li>${escapeHtmlPreserveMarkdown(l.slice(2))}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // ── 8. Ordered lists ──────────────────────────────────────────────────
  html = html.replace(/^(?:\d+\. (.+)\n?)+/gm, (match) => {
    const items = match
      .split("\n")
      .filter((l) => /^\d+\./.test(l))
      .map((l) => `<li>${escapeHtmlPreserveMarkdown(l.replace(/^\d+\.\s*/, ""))}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  // ── 9. Inline formatting (runs AFTER all block-level processing) ──────
  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, (_m, t: string) => `<strong><em>${escapeHtml(t)}</em></strong>`);
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, (_m, t: string) => `<strong>${escapeHtml(t)}</strong>`);
  // Italic
  html = html.replace(/\*(.+?)\*/g, (_m, t: string) => `<em>${escapeHtml(t)}</em>`);

  // Links (with XSS protection)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t: string, href: string) => {
    const safeHref = isSafeUrl(href) ? href : "#";
    return `<a href="${escapeAttr(safeHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t)}</a>`;
  });

  // Images (with XSS protection)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, src: string) => {
    const safeSrc = isSafeUrl(src) ? src : "";
    return safeSrc ? `<img src="${escapeAttr(safeSrc)}" alt="${escapeAttr(alt)}" style="max-width:100%;border-radius:8px;margin:8px 0" loading="lazy">` : "";
  });

  // ── 10. Paragraphs: wrap remaining bare text lines ────────────────────
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|ul|ol|li|pre|blockquote|hr|table|thead|tbody|tr|div)/.test(trimmed)) return trimmed;
      if (trimmed.startsWith("<")) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return html;
}

function processTables(html: string): string {
  const lines = html.split("\n");
  let i = 0;
  const result: string[] = [];

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("|") && i + 1 < lines.length && lines[i + 1].trim().includes("---")) {
      const headerCells = parseTableRow(line);
      i += 2; // skip header + separator

      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(parseTableRow(lines[i].trim()));
        i++;
      }

      let table = "<table><thead><tr>";
      for (const cell of headerCells) {
        table += `<th>${escapeHtmlPreserveMarkdown(cell)}</th>`;
      }
      table += "</tr></thead><tbody>";
      for (const row of rows) {
        table += "<tr>";
        for (const cell of row) {
          table += `<td>${escapeHtmlPreserveMarkdown(cell)}</td>`;
        }
        table += "</tr>";
      }
      table += "</tbody></table>";
      result.push(table);
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join("\n");
}

function parseTableRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlPreserveMarkdown(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
