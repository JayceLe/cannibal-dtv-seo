// Shared chart colors follow Airtable's editorial design system.
export const uiColors = {
  background: '#ffffff',
  surface: '#f8fafc',
  elevated: '#f1f5f9',
  line: '#e2e8f0',
  text: '#181d26',
  muted: '#64748b',
  soft: '#94a3b8',
  focus: '#ffffff',
  query: '#1b61c9',
  impression: '#6366f1',
} as const;

export const semanticColors = {
  safe: '#15803d',
  medium: '#b45309',
  danger: '#b91c1c',
  review: '#64748b',
  accent: '#181d26',
} as const;

// Rank bands are categorical, using Airtable's signature surfaces and link palette.
export const rankingColors = {
  top3: '#1b61c9',   // Airtable Link Blue
  top5: '#059669',   // Airtable Mint / Emerald
  top10: '#d97706',  // Airtable Mustard / Amber
  top20: '#dc2626',  // Airtable Coral Red
  top50: '#6366f1',  // Airtable Royal Indigo
  top100: '#64748b', // Slate Gray
} as const;
