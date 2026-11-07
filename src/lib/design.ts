// Shared chart colors follow the SEO editorial ledger palette.
export const uiColors = {
  background: '#f2efe8',
  surface: '#fffdf8',
  elevated: '#ece8df',
  line: '#d7d3c9',
  text: '#202922',
  muted: '#4a584e',
  soft: '#68766c',
  focus: '#ffffff',
  query: '#245b78',
  impression: '#755d40',
} as const;

export const semanticColors = {
  safe: '#176448',
  medium: '#986022',
  danger: '#a23d36',
  review: '#626d63',
  accent: '#173e31',
} as const;

// Rank bands remain distinct on both warm paper and chart backgrounds.
export const rankingColors = {
  top3: '#245b78',
  top5: '#176448',
  top10: '#a66a25',
  top20: '#a23d36',
  top50: '#715f87',
  top100: '#68766c',
} as const;
