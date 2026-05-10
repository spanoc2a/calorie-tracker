export const metadata = {
  title: "Nutrainer — Nutrition, Sport & Santé par l'IA",
  description: "Suivi nutritionnel intelligent, analyses de bilan sanguin, programmes IA et synchronisation Strava. L'app de nutrition et performance pour athletes et coachs.",
  metadataBase: new URL('https://nutrainer.io'),
  keywords: ["nutrition", "suivi calories", "bilan sanguin", "coach sportif", "macros", "IA nutrition", "programme alimentaire", "Strava"],
  robots: { index: true, follow: true },
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  openGraph: {
    title: "Nutrainer — Nutrition, Sport & Santé par l'IA",
    description: "Suivi nutritionnel intelligent, analyses de bilan sanguin, programmes IA et synchronisation Strava.",
    url: "https://nutrainer.io",
    siteName: "Nutrainer",
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "Nutrainer — Nutrition & Performance" }],
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nutrainer — Nutrition, Sport & Santé par l'IA",
    description: "Suivi nutritionnel intelligent, analyses de bilan sanguin, programmes IA et synchronisation Strava.",
    images: ["/api/og"],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Nutrainer',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web',
  description: 'Application de suivi nutritionnel intelligent avec analyses de bilan sanguin IA, programmes personnalisés et synchronisation Strava.',
  url: 'https://nutrainer.io',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', description: 'Essai gratuit 7 jours' },
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '120' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <link rel="alternate" hrefLang="fr" href="https://nutrainer.io/" />
        <link rel="alternate" hrefLang="en" href="https://nutrainer.io/" />
        <link rel="alternate" hrefLang="es" href="https://nutrainer.io/" />
        <link rel="alternate" hrefLang="de" href="https://nutrainer.io/" />
        <link rel="alternate" hrefLang="pt" href="https://nutrainer.io/" />
        <link rel="alternate" hrefLang="it" href="https://nutrainer.io/" />
        <link rel="alternate" hrefLang="x-default" href="https://nutrainer.io/" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Nutrainer" />
        <meta name="theme-color" content="#0d0d0d" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});` }} />
      </body>
    </html>
  );
}
