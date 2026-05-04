import './globals.css'

export const metadata = {
  title: 'Strangr — A quiet place for loud ideas.',
  description: 'The anti-noise network for makers. No engagement traps. No outrage feed. Just curated spaces and posts that earned the room.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Strangr',
  },
  openGraph: {
    title: 'Strangr',
    description: 'A quiet place for loud ideas.',
    type: 'website',
  },
}

export const viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <div className="page-enter">
          {children}
        </div>
      </body>
    </html>
  )
}
