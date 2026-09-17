export const RESTAURANT_DEMO_SESSION_STORAGE_KEY = 'grabio_restaurant_demo_session_id';
export const RESTAURANT_DEMO_TTL_MS = 30 * 60 * 1000;
export const RESTAURANT_DEMO_MAX_ACTIONS = 5;
export const RESTAURANT_DEMO_COLLECTION = 'demoRestaurantSessions';

export const RESTAURANT_DEMO_SEED = {
  venueName: 'Bistro Lumière (sample)',
  tagline: 'Fine dining · Live Kitchen package preview',
  sampleProducts: [
    { name: 'Duck confit', priceUsd: 28, category: 'Mains' },
    { name: 'Burrata starter', priceUsd: 14, category: 'Starters' },
  ],
  sampleGuests: [{ name: 'Sample guest — Amal H.', phone: '+961 ••• ••••' }],
  sampleReservations: [{ guestName: 'Walk-in preview', partySize: 2, dateTime: 'Tonight 8:00 PM' }],
};
