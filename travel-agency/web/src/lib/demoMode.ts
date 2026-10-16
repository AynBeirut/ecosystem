export function isTravelDemo(): boolean {
  return import.meta.env.VITE_TRAVEL_DEMO === 'true' || import.meta.env.VITE_TRAVEL_DEMO === '1';
}

export const DEMO_STORE_ID = 'demo-travel-agency';
