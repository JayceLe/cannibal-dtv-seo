// Shared chart colors follow the same roles as the CSS tokens.
export const uiColors={background:'#0b0b0b',surface:'#171717',elevated:'#222222',line:'#343434',text:'#f5f5f5',muted:'#b3b3b3',soft:'#a7a7a7',focus:'#ffffff',query:'#62a1df',impression:'#ad86d6'} as const;
export const semanticColors={safe:'#60b88a',medium:'#e3b352',danger:'#e9757c',review:'#b3b3b3',accent:'#277c4c'} as const;

// Rank bands are categorical, independent of increase/decrease status colors.
export const rankingColors={top3:uiColors.query,top5:'#3da67e',top10:'#d6a044',top20:'#d57567',top50:uiColors.impression,top100:'#8f9ead'} as const;
