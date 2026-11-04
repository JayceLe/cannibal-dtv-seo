export const knownCategories = ['CAMERA','ĐIỆN THOẠI CŨ','ÉP KÍNH ANDROID','ÉP KÍNH APPLE','IPHONE CŨ','LAPTOP MÀN HÌNH MACBOOK','LAPTOP PIN MACBOOK','LAPTOP_BÀN PHÍM','LAPTOP_LOA','LAPTOP_MAIN','LAPTOP_MÀN HÌNH','LAPTOP_Ổ CỨNG','LAPTOP_PIN','LAPTOP_RAM','LAPTOP_SAC','LOA','MAIN','MÀN HÌNH ANDROID','MÀN HÌNH APPLE','OPPO CŨ','PIN ANDROID','PIN APPLE','REDMI CŨ','SAC+MIC','SAMSUNG CŨ','VỎ MÁY','XIAOMI CŨ'];
// Stable category identities. Color belongs to data marks, not entire panels.
const palette=['#4e8dcc','#d98243','#36a67a','#9768cf','#289eb6','#c75a91','#c7ae3f','#7594b8','#337fa9','#ce6466','#79a548','#b373ca','#329b8a','#d49340','#7d76bd','#4e9eb4','#b9778f','#9dbb58','#ce8a74','#3d9984','#a580cb','#d4ad43','#5999b3','#8b91cc','#ce77a4','#63aa9e','#b3a16b'] as const;
export function categoryColor(name:string){
 const index=knownCategories.indexOf(name);
 if(index>=0)return palette[index];
 let hash=0;for(const char of name)hash=(hash*31+char.charCodeAt(0))>>>0;
 return `hsl(${hash%360} 48% 53%)`;
}
