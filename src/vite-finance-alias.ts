import type { Plugin } from 'vite';
import path from 'path';
import fs from 'fs';

function resolveWithExtensions(basePath: string): string | null {
  const extensions = ['', '.tsx', '.ts', '.jsx', '.js'];
  for (const ext of extensions) {
    const candidate = basePath + ext;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Route @/ to finance src or main src based on the importing file. */
export function financeInternalAlias(financeSrc: string, mainSrc: string): Plugin {
  const financeMarker = path.normalize(financeSrc);
  return {
    name: 'grabio-internal-alias',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!source.startsWith('@/')) return null;
      const rel = source.slice(2);
      const norm = importer ? path.normalize(importer) : '';
      const root = norm.includes(financeMarker) || norm.includes('beirut-finance-flow-main')
        ? financeSrc
        : mainSrc;
      return resolveWithExtensions(path.join(root, rel));
    },
  };
}
