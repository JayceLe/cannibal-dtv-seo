export const knownCategories = ['CAMERA','ĐIỆN THOẠI CŨ','ÉP KÍNH ANDROID','ÉP KÍNH APPLE','IPHONE CŨ','LAPTOP MÀN HÌNH MACBOOK','LAPTOP PIN MACBOOK','LAPTOP_BÀN PHÍM','LAPTOP_LOA','LAPTOP_MAIN','LAPTOP_MÀN HÌNH','LAPTOP_Ổ CỨNG','LAPTOP_PIN','LAPTOP_RAM','LAPTOP_SAC','LOA','MAIN','MÀN HÌNH ANDROID','MÀN HÌNH APPLE','OPPO CŨ','PIN ANDROID','PIN APPLE','REDMI CŨ','SAC+MIC','SAMSUNG CŨ','VỎ MÁY','XIAOMI CŨ'];
// High-distinction editorial DMC3 palette, calibrated for maximum contrast and readability.
const palette = [
  '#0284c7', // CAMERA - Sky / Cyan Blue
  '#ea580c', // ĐIỆN THOẠI CŨ - Warm Orange
  '#16a34a', // ÉP KÍNH ANDROID - Fresh Green
  '#9333ea', // ÉP KÍNH APPLE - Vibrant Purple
  '#1e40af', // IPHONE CŨ - Deep Indigo
  '#0d9488', // LAPTOP MÀN HÌNH MACBOOK - Teal
  '#e11d48', // LAPTOP PIN MACBOOK - Rose Crimson
  '#d97706', // LAPTOP_BÀN PHÍM - Amber / Mustard
  '#2563eb', // LAPTOP_LOA - Cobalt Royal
  '#7c3aed', // LAPTOP_MAIN - Royal Violet
  '#059669', // LAPTOP_MÀN HÌNH - Emerald
  '#c026d3', // LAPTOP_Ổ CỨNG - Magenta / Fuchsia
  '#dc2626', // LAPTOP_PIN - Coral Red
  '#0891b2', // LAPTOP_RAM - Ocean Cyan
  '#ca8a04', // LAPTOP_SAC - Warm Ochre Gold
  '#4f46e5', // LOA - Deep Indigo
  '#b45309', // MAIN - Terracotta Rust
  '#15803d', // MÀN HÌNH ANDROID - Forest Green
  '#6d28d9', // MÀN HÌNH APPLE - Royal Purple
  '#0e7490', // OPPO CŨ - Deep Teal
  '#166534', // PIN ANDROID - Dark Forest
  '#be123c', // PIN APPLE - Ruby Wine
  '#c2410c', // REDMI CŨ - Burnt Orange
  '#475569', // SAC+MIC - Slate Gray
  '#1d4ed8', // SAMSUNG CŨ - Samsung Royal Blue
  '#78350f', // VỎ MÁY - Bronze Brown
  '#f97316', // XIAOMI CŨ - Xiaomi Orange
] as const;
export function categoryColor(name:string){
 const index=knownCategories.indexOf(name);
 if(index>=0)return palette[index];
 let hash=0;for(const char of name)hash=(hash*31+char.charCodeAt(0))>>>0;
 return `hsl(${hash%360} 48% 53%)`;
}
