export const knownCategories = ['CAMERA','ĐIỆN THOẠI CŨ','ÉP KÍNH ANDROID','ÉP KÍNH APPLE','IPHONE CŨ','LAPTOP MÀN HÌNH MACBOOK','LAPTOP PIN MACBOOK','LAPTOP_BÀN PHÍM','LAPTOP_LOA','LAPTOP_MAIN','LAPTOP_MÀN HÌNH','LAPTOP_Ổ CỨNG','LAPTOP_PIN','LAPTOP_RAM','LAPTOP_SAC','LOA','MAIN','MÀN HÌNH ANDROID','MÀN HÌNH APPLE','OPPO CŨ','PIN ANDROID','PIN APPLE','REDMI CŨ','SAC+MIC','SAMSUNG CŨ','VỎ MÁY','XIAOMI CŨ'];
// Stable category identities. Color belongs to data marks, not entire panels.
const palette=['#619eff','#ff9955','#52cc98','#b48aff','#45c6dd','#ed7eb7','#e4cf54','#90a9ca','#429dd6','#e87878','#91c65f','#d893ed','#42bfa6','#f0ac55','#9182e0','#6bbbd5','#cf889e','#b6d77a','#de9a83','#4eac98','#b794ea','#f4c55b','#72acc6','#a2a8e9','#e98fbc','#82c5b9','#c6b487'] as const;
export function categoryColor(name:string){
 const index=knownCategories.indexOf(name);
 if(index>=0)return palette[index];
 let hash=0;for(const char of name)hash=(hash*31+char.charCodeAt(0))>>>0;
 return `hsl(${hash%360} 62% 64%)`;
}
