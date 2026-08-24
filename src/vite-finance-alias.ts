import type { Plugin } from 'vite';
import path from 'path';
import fs from 'fs';

function resolveWithExtensions(basePath: string): string | null {
  const extensions = ['.tsx', '.ts', '.jsx', '.js', ''];
  for (const ext of extensions) {
    const candidate = basePath + ext;
    if (!fs.existsSync(candidate)) continue;
    // Prefer real files; bare path may match a directory (e.g. @/features/ocr).
    if (ext === '' && fs.statSync(candidate).isDirectory()) {
      const indexHit = resolveWithExtensions(path.join(candidate, 'index'));
      if (indexHit) return indexHit;
      continue;
    }
    if (fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Route @/ to finance src or main src based on the importing file.
 *  Also resolve @grabio/* always to main Grabio src (shared features like OCR).
 */
export function financeInternalAlias(financeSrc: string, mainSrc: string): Plugin {
  const financeMarker = path.normalize(financeSrc);
  const legacyFinanceMarker = path.normalize(
    financeSrc.replace(`${path.sep}vendor${path.sep}`, `${path.sep}suba eco sys${path.sep}`),
  );
  const isFinanceImporter = (importer?: string) => {
    if (!importer) return false;
    const norm = path.normalize(importer);
    return (
      norm.includes(financeMarker) ||
      norm.includes(legacyFinanceMarker) ||
      norm.includes('beirut-finance-flow-main') ||
      norm.includes(`${path.sep}vendor${path.sep}`)
    );
  };
  return {
    name: 'grabio-internal-alias',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.startsWith('@grabio/')) {
        return resolveWithExtensions(path.join(mainSrc, source.slice('@grabio/'.length)));
      }
      if (!source.startsWith('@/')) return null;
      const rel = source.slice(2);
      const root = isFinanceImporter(importer) ? financeSrc : mainSrc;
      return resolveWithExtensions(path.join(root, rel));
    },
  };
}
