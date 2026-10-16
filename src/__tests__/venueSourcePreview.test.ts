import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { previewVenueSource } from '@/lib/venueSourcePreview';

describe('Venue source preview', () => {
  it('maps specs, briefings, and allergens without saving or keeping money', () => {
    const preview = previewVenueSource([
      {
        name: 'Serve',
        rows: [
          ['Cocktail', 'Glassware', 'Quantity', '', 'Ingredient', 'Garnish', 'Method', 'Price'],
          ['House cooler', 'Highball', '50', 'ml', 'Mint syrup', 'Mint', 'Build', '12'],
          ['', '', '90', 'ml', 'Soda', '', 'Add ice', ''],
        ],
      },
      {
        name: 'Batch',
        rows: [
          ['Cocktail', 'Storage Vessel', 'Measure', '1 Litre', 'Par', 'Par QTY', 'Ingredient', 'Shelf Life'],
          ['Mint syrup', 'Bottle', 'g', '500', '4', '2000', 'Mint', '3 days'],
        ],
      },
      {
        name: 'Month',
        rows: [
          ['DAY', 'FOOD ITEM', 'BUZZ WORDS', 'ONE LINER', 'BEVERAGE ITEM', 'BUZZ WORDS'],
          ['1', 'Herb plate', 'Fresh', 'Herbs and bread', 'House cooler', 'Cool'],
        ],
      },
      {
        name: 'Matrix',
        rows: [
          ['Item', 'Allergens', 'Notes', 'Cost'],
          ['Herb plate', 'Sesame', 'Shared fryer', '4'],
        ],
      },
      { name: 'Cover', rows: [['Brand book']] },
    ]);

    expect(preview.saved).toBe(false);
    expect(preview.specs.map((row) => row.title)).toEqual(['House cooler', 'Mint syrup']);
    expect(preview.specs[0].lines).toEqual([
      { item: 'Mint syrup', quantity: '50', unit: 'ml' },
      { item: 'Soda', quantity: '90', unit: 'ml' },
    ]);
    expect(preview.specs[0].method).toContain('Add ice');
    expect(preview.specs[0]).not.toHaveProperty('price');
    expect(preview.briefings[0]).toMatchObject({
      day: 'Day 1',
      foodFocus: 'Herb plate',
      beverageFocus: 'House cooler',
      status: 'draft',
    });
    expect(preview.bible.map((row) => row.title)).toEqual(['Herb plate', 'House cooler']);
    expect(preview.allergens[0]).toEqual({ title: 'Herb plate', allergens: 'Sesame', notes: 'Shared fryer' });
    expect(preview.skippedSheets).toEqual(['Cover']);
    expect(JSON.stringify(preview)).not.toMatch(/price|cost|cogs|salary/i);
  });

  it('maps the local source workbooks when they are on disk', () => {
    const dir = resolve(process.cwd(), 'the eco sys/finedinnig ');
    const files = [
      'Berenjak ME. Beverages specs. 2026 .xlsx',
      'Copy2-MONTHLY BRIEFING F&B.xlsx',
    ];
    if (!files.every((name) => existsSync(resolve(dir, name)))) return;
    const sheets = files.flatMap((name) => {
      const book = XLSX.readFile(resolve(dir, name));
      return book.SheetNames.map((sheetName) => ({
        name: sheetName,
        rows: XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, raw: false, defval: '' }) as string[][],
      }));
    });
    const preview = previewVenueSource(sheets);
    expect(preview.saved).toBe(false);
    expect(preview.specs.length).toBeGreaterThan(0);
    expect(preview.briefings.length).toBeGreaterThan(0);
    expect(preview.bible.length).toBeGreaterThan(0);
    expect(JSON.stringify(preview)).not.toMatch(/"price"|"cost"|"cogs"|"salary"/);
  });

  it('stays a preview in product code', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/venueSourcePreview.ts'), 'utf8');
    expect(source).not.toMatch(/addDoc|setDoc|updateDoc|firestore/i);
    expect(source.toLowerCase()).not.toContain('berenjak');
  });
});
