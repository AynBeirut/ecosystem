import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  buildGrabioMetaCatalogRows,
  grabioMetaCatalogToCsv,
} from '../src/lib/grabioMetaCatalog';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows = buildGrabioMetaCatalogRows();
const csv = grabioMetaCatalogToCsv(rows);
const date = new Date().toISOString().slice(0, 10);

mkdirSync(join(root, 'public', 'meta-catalog'), { recursive: true });
writeFileSync(join(root, 'public', 'meta-catalog', 'grabio-packages-feed.csv'), csv, 'utf8');
writeFileSync(join(root, 'reporting', 'data', `grabio-meta-catalog-packages-${date}.csv`), csv, 'utf8');

mkdirSync(join(root, 'functions', 'src', 'data'), { recursive: true });
writeFileSync(
  join(root, 'functions', 'src', 'data', 'grabioMetaCatalogRows.json'),
  JSON.stringify(rows, null, 2),
  'utf8',
);

console.log(`Grabio Meta catalog: ${rows.length} rows → public/meta-catalog/grabio-packages-feed.csv`);
