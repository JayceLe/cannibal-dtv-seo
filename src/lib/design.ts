// Shared chart colors follow the same roles as the CSS tokens.
export const uiColors = {
  background: '#0f1117',
  surface: '#181c27',
  elevated: '#202636',
  line: '#283144',
  text: '#f4f5f8',
  muted: '#9aa4b7',
  soft: '#6d778d',
  focus: '#ffffff',
  query: '#62aef0',
  impression: '#d6b6f6',
} as const;

export const semanticColors = {
  safe: '#2ecc71',
  medium: '#f08c3a',
  danger: '#ff6492',
  review: '#9aa4b7',
  accent: '#0075de',
} as const;

// Rank bands are categorical, using Notion's sticker and structural palette.
export const rankingColors = {
  top3: '#62aef0',   // Sticker Sky
  top5: '#2a9d99',   // Sticker Teal
  top10: '#f08c3a',  // Sticker Orange
  top20: '#ff6492',  // Sticker Pink
  top50: '#d6b6f6',  // Sticker Purple
  top100: '#7a869e', // Soft Slate
} as const;
