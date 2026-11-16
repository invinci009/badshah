import type { Metadata, Viewport } from 'next'
import { Inter, Rajdhani, Kaushan_Script } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { PwaProvider } from '@/components/pwa/PwaProvider'
import PwaInstallPrompt from '@/components/pwa/PwaInstallPrompt'
import OfflineIndicator from '@/components/pwa/OfflineIndicator'
import { generateBrandingCSS } from '@/config/branding'
import { getRestaurantConfig } from '@/config/loader'
import { ClientConfigProvider } from '@/config/client'

const inter = Inter({ subsets: ['latin'] })
const rajdhani = Rajdhani({
  subsets: ['latin', 'devanagari'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
})
const kaushan = Kaushan_Script({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-script',
  display: 'swap',
})
const bruceForever = localFont({
  src: './fonts/BruceForever.ttf',
  variable: '--font-bruce',
  display: 'swap',
})
const onStageSerial = localFont({
  src: [
    {
      path: './fonts/OnStageSerial-Xbold.woff2',
      weight: '800',
      style: 'normal',
    },
    {
      path: './fonts/OnStageSerial-Xbold.ttf',
      weight: '800',
      style: 'normal',
    },
  ],
  variable: '--font-onstage',
  display: 'swap',
})

const config = getRestaurantConfig()

export const metadata: Metadata = {
  title: {
    default: `${config.name} — Restaurant Feedback & Authentic Reviews`,
    template: `%s | ${config.name}`,
  },
  description: `QR-based customer feedback platform for ${config.name} with AI-assisted review drafting`,
  applicationName: `${config.name} Feedback`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: config.name,
  },
  formatDetection: {
    telephone: false,
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: ['/icons/icon-192x192.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: config.branding.primaryColor },
    { media: '(prefers-color-scheme: light)', color: config.branding.primaryColor },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={config.name} />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <style dangerouslySetInnerHTML={{ __html: generateBrandingCSS(config) }} />
      </head>
      <body className={`${inter.className} ${rajdhani.variable} ${kaushan.variable} ${bruceForever.variable} ${onStageSerial.variable} min-h-screen min-h-[100dvh] bg-slate-950 text-slate-100 antialiased overflow-x-hidden`}>
        <ClientConfigProvider config={config}>
          <PwaProvider>
            <OfflineIndicator />
            {children}
            <PwaInstallPrompt />
          </PwaProvider>
        </ClientConfigProvider>
      </body>
    </html>
  )
}
