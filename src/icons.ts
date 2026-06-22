const svg = (inner: string, size = 24) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const icons = {
  sparkles: (s?: number) =>
    svg(`<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"`, s),

  x: (s?: number) =>
    svg(`<path d="M18 6 6 18"/><path d="m6 6 12 12"`, s),

  send: (s?: number) =>
    svg(`<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"`, s),

  bot: (s?: number) =>
    svg(`<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"`, s),

  maximize: (s?: number) =>
    svg(`<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"`, s),

  minimize: (s?: number) =>
    svg(`<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"`, s),

  chevronDown: (s?: number) =>
    svg(`<path d="m6 9 6 6 6-6"`, s),

  trash: (s?: number) =>
    svg(`<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>`, s),

  loader: (s?: number) =>
    svg(`<path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"`, s),

  checkCircle: (s?: number) =>
    svg(`<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"`, s),

  navigation: (s?: number) =>
    svg(`<polygon points="3 11 22 2 13 21 11 13 3 11"`, s),

  mousePointer: (s?: number) =>
    svg(`<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3"/><path d="m13 13 6 6"`, s),

  arrowDown: (s?: number) =>
    svg(`<path d="M12 5v14"/><path d="m19 12-7 7-7-7"`, s),

  highlighter: (s?: number) =>
    svg(`<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"`, s),

  user: (s?: number) =>
    svg(`<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"`, s),

  table: (s?: number) =>
    svg(`<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"`, s),

  barChart: (s?: number) =>
    svg(`<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"`, s),

  sun: (s?: number) =>
    svg(`<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"`, s),

  moon: (s?: number) =>
    svg(`<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"`, s),
};
