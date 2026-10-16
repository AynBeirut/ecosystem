import catalogRows from '../data/grabioMetaCatalogRows.json';

export type GrabioMetaCatalogRow = {
  id: string;
  title: string;
  description: string;
  availability: string;
  condition: string;
  price: string;
  link: string;
  image_link: string;
  brand: string;
  google_product_category: string;
  retailer_id: string;
};

function escapeCsvCell(value: string): string {
  const cell = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  if (/[",\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function buildGrabioMetaCatalogRows(): GrabioMetaCatalogRow[] {
  return catalogRows as GrabioMetaCatalogRow[];
}

export function grabioMetaCatalogToCsv(rows: GrabioMetaCatalogRow[] = buildGrabioMetaCatalogRows()): string {
  const headers = [
    'id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'link',
    'image_link',
    'brand',
    'google_product_category',
    'retailer_id',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.title,
        row.description,
        row.availability,
        row.condition,
        row.price,
        row.link,
        row.image_link,
        row.brand,
        row.google_product_category,
        row.retailer_id,
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
