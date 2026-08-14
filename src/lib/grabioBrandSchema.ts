/** Shared JSON-LD for Grabio marketing pages — helps search + AI crawlers. */

export const GRABIO_ORG = {
  '@type': 'Organization' as const,
  '@id': 'https://grabio.space/#organization',
  name: 'Grabio',
  legalName: 'Grabio',
  url: 'https://grabio.space',
  logo: 'https://grabio.space/og-image.png',
  description:
    'Grabio is a modular cloud business platform for inventory, accounting, POS, CRM, manufacturing, and restaurant operations — built for MENA and global SMBs.',
  foundingDate: '2022',
  areaServed: ['LB', 'AE', 'Global'],
  sameAs: [
    'https://www.linkedin.com/company/grabio',
    'https://play.google.com/store/apps/details?id=space.grabio.admin',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'sales',
    email: 'hello@grabio.space',
    availableLanguage: ['English', 'Arabic', 'French'],
  },
};

export const GRABIO_SOFTWARE_APP = {
  '@type': 'SoftwareApplication' as const,
  '@id': 'https://grabio.space/#software',
  name: 'Grabio Business Platform',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android, Windows',
  offers: {
    '@type': 'Offer',
    price: '5',
    priceCurrency: 'USD',
    description: 'Modular plans from Invoice Manager at $5/mo',
  },
  featureList: [
    'Inventory and stock management',
    'General ledger accounting and vouchers',
    'Windows POS and mobile admin apps',
    'Sales CRM and PSA projects',
    'Restaurant recipe deduction',
    'Manufacturing BOM and production',
    'AI workflow agent',
    'WordPress embed and Shopify-style builder',
  ],
};

export function buildFaqSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function buildSolutionSchema(params: {
  name: string;
  description: string;
  url: string;
  faqs: { question: string; answer: string }[];
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      GRABIO_ORG,
      GRABIO_SOFTWARE_APP,
      {
        '@type': 'WebPage',
        name: params.name,
        description: params.description,
        url: params.url,
        isPartOf: { '@id': 'https://grabio.space/#software' },
        about: { '@id': 'https://grabio.space/#organization' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: params.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  };
}
