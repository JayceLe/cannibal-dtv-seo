import type { Metadata } from 'next';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import './globals.css';
import './theme.css';
export const metadata: Metadata={title:'Cannibal Query · SEO Intelligence',description:'Phân tích SEO cannibal theo từ khóa và DMC3. Import, theo dõi và so sánh hiệu suất hằng tuần.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>;}
