/** Shared JSON-LD for Grabio marketing pages — helps search + AI crawlers. */

/** Canonical NAP — keep in sync with Google Business Profile Contact tab. */
export const GRABIO_NAP = {
  name: 'Grabio',
  streetAddress: 'VGMG+H8J',
  city: 'Beirut',
  region: 'Beirut Governorate',
  country: 'LB',
  phone: '+96171110952',
  phoneDisplay: '+961 71 110 952',
  whatsappUrl: 'https://wa.me/96171110952',
  email: 'hello@grabio.space',
  website: 'https://grabio.space',
  gbpOpeningDate: '2013-01-01',
  gbpActiveSince: '2013',
  mapsShortUrl: 'https://maps.app.goo.gl/2RRAu3gfUNLZTw118',
  mapsPlaceUrl:
    'https://www.google.com/maps/place/VGMG%2BH8J+Grabio,+Beirut/data=!4m2!3m1!1s0x151f170026664769:0x935d324fcf443fa5!18m1!1e1',
  gbpManageUrl: 'https://business.google.com/',
} as const;

export const GRABIO_ORG = {
  '@type': 'Organization' as const,
  '@id': 'https://grabio.space/#organization',
  name: GRABIO_NAP.name,
  legalName: 'Grabio',
  url: GRABIO_NAP.website,
  logo: 'https://grabio.space/og-image.png',
  description:
    'Grabio is a modular cloud business platform for inventory, accounting, POS, CRM, manufacturing, and restaurant operations — built for MENA and global SMBs.',
  foundingDate: '2022',
  areaServed: ['LB', 'AE', 'Global'],
  sameAs: [
    'https://www.linkedin.com/company/grabio',
    'https://play.google.com/store/apps/details?id=space.grabio.admin',
    GRABIO_NAP.mapsShortUrl,
    GRABIO_NAP.mapsPlaceUrl,
  ],
  contactPoint: [
    {
      '@type': 'ContactPoint' as const,
      contactType: 'customer service',
      telephone: GRABIO_NAP.phone,
      email: GRABIO_NAP.email,
      url: GRABIO_NAP.website,
      availableLanguage: ['English', 'Arabic', 'French'],
    },
    {
      '@type': 'ContactPoint' as const,
      contactType: 'sales',
      url: GRABIO_NAP.whatsappUrl,
      availableLanguage: ['English', 'Arabic', 'French'],
    },
  ],
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
