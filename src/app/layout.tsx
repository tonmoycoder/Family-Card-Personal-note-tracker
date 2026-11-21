import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

const hindSiliguri = Hind_Siliguri({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['bengali'],
  variable: '--font-hind-siliguri',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ফ্যামিলি কার্ড সার্ভে | বাংলাদেশ মাঠপর্যায় PWA',
  description: 'বাংলাদেশ ফ্যামিলি কার্ড তালিকা থেকে বাদ পড়া পরিবার মাঠপর্যায় তথ্য সংগ্রহ অ্যাপ্লিকেশন',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'কার্ড সার্ভে',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#047857',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn" className={`${hindSiliguri.variable} h-full`}>
      <body className="min-h-full bg-slate-100 text-slate-900 font-sans antialiased selection:bg-emerald-200 selection:text-emerald-900">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
