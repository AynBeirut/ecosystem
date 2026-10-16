import type { TravelItineraryDay, TravelItineraryItem } from './types';

const img = {
  dubai: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80',
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
  safari: 'https://images.unsplash.com/photo-1454496529418-7a8e8e036b3d?w=800&q=80',
  istanbul: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&q=80',
  bosphorus: 'https://images.unsplash.com/photo-1541431146787-fc4e649c5f3f?w=800&q=80',
  mosque: 'https://images.unsplash.com/photo-1527838837500-5a070bb213e7?w=800&q=80',
};

function item(
  type: TravelItineraryItem['type'],
  title: string,
  cost: number,
  sell: number,
  extra?: Partial<TravelItineraryItem>,
): TravelItineraryItem {
  return { id: `demo-${title.replace(/\s+/g, '-').slice(0, 24)}`, type, title, cost, sell, ...extra };
}

/** Dubai honeymoon — 5 days; totals 172600 / 185000 (legacy demo quote). */
export function buildDubaiHoneymoonDays(): TravelItineraryDay[] {
  return [
    {
      id: 'demo-dxb-d1',
      dayNumber: 1,
      title: 'Day 1 — Arrival in Dubai',
      date: '2026-11-10',
      items: [
        item('flight', 'DEL → DXB · Emirates EK513', 49000, 50200, { time: '04:15', description: '2 adults · economy' }),
        item('transfer', 'Private airport → hotel', 1800, 2000, { time: '09:30' }),
        item('hotel', 'Atlantis The Palm — 5 nights', 50200, 56000, { time: '14:00', imageUrl: img.hotel, description: 'Ocean King' }),
        item('note', 'Welcome cake on arrival', 0, 0, { description: 'Complimentary' }),
      ],
    },
    {
      id: 'demo-dxb-d2',
      dayNumber: 2,
      title: 'Day 2 — Desert safari',
      date: '2026-11-11',
      items: [
        item('activity', 'Evening desert safari + BBQ', 8400, 11200, { time: '15:00', imageUrl: img.safari }),
        item('transfer', 'Hotel ↔ desert camp', 1200, 1600, { time: '14:30' }),
      ],
    },
    {
      id: 'demo-dxb-d3',
      dayNumber: 3,
      title: 'Day 3 — City & Burj Khalifa',
      date: '2026-11-12',
      items: [
        item('activity', 'Dubai city tour', 5800, 5800, { time: '10:00', imageUrl: img.dubai }),
        item('activity', 'Burj Khalifa At The Top', 5800, 6200, { time: '18:30' }),
      ],
    },
    {
      id: 'demo-dxb-d4',
      dayNumber: 4,
      title: 'Day 4 — Marina cruise',
      date: '2026-11-13',
      items: [
        item('note', 'Dhow dinner cruise — Marina (included in package)', 0, 0, { time: '19:30', description: 'Pool morning · cruise evening' }),
      ],
    },
    {
      id: 'demo-dxb-d5',
      dayNumber: 5,
      title: 'Day 5 — Departure',
      date: '2026-11-14',
      items: [
        item('transfer', 'Hotel → DXB airport', 1400, 1800, { time: '06:00' }),
        item('flight', 'DXB → DEL · Emirates EK512', 49000, 50200, { time: '10:25' }),
      ],
    },
  ];
}

/** Istanbul family — 5 days; totals derived from items. */
export function buildIstanbulFamilyDays(): TravelItineraryDay[] {
  return [
    {
      id: 'demo-ist-d1',
      dayNumber: 1,
      title: 'Day 1 — Arrival in Istanbul',
      date: '2026-12-01',
      items: [
        item('flight', 'BOM → IST · Turkish Airlines', 38000, 44000, { time: '06:50' }),
        item('transfer', 'IST → Sultanahmet', 2200, 2800, { time: '14:00' }),
        item('hotel', 'Sura Hagia Sophia — 4 nights', 32000, 38000, { time: '15:30', imageUrl: img.istanbul }),
      ],
    },
    {
      id: 'demo-ist-d2',
      dayNumber: 2,
      title: 'Day 2 — Old City',
      date: '2026-12-02',
      items: [
        item('activity', 'Hagia Sophia & Blue Mosque tour', 4500, 6000, { time: '09:30', imageUrl: img.mosque }),
        item('activity', 'Grand Bazaar visit', 1200, 1800, { time: '14:00' }),
      ],
    },
    {
      id: 'demo-ist-d3',
      dayNumber: 3,
      title: 'Day 3 — Bosphorus',
      date: '2026-12-03',
      items: [
        item('activity', 'Bosphorus sunset cruise', 6800, 9000, { time: '16:30', imageUrl: img.bosphorus }),
        item('transfer', 'Hotel ↔ pier', 900, 1200, { time: '15:45' }),
        item('note', 'Dinner on own', 0, 0),
      ],
    },
    {
      id: 'demo-ist-d4',
      dayNumber: 4,
      title: 'Day 4 — Hammam & Asian side',
      date: '2026-12-04',
      items: [
        item('activity', 'Üsküdar walking tour', 3800, 5000, { time: '10:00' }),
        item('activity', 'Traditional hammam', 5200, 7000, { time: '17:00' }),
      ],
    },
    {
      id: 'demo-ist-d5',
      dayNumber: 5,
      title: 'Day 5 — Departure',
      date: '2026-12-05',
      items: [
        item('transfer', 'Hotel → IST airport', 2200, 2800, { time: '08:00' }),
        item('flight', 'IST → BOM · Turkish Airlines', 38000, 44000, { time: '13:40' }),
      ],
    },
  ];
}

/** Public `/travel/p/demo` payload — stable ids for client preview. */
export function buildDemoPublicProposalDays(): TravelItineraryDay[] {
  return buildDubaiHoneymoonDays();
}
