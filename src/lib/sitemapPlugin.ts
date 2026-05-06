/**
 * Vite plugin to copy and update sitemap.xml during build,
 * and to inject a sitemap route into Firebase hosting rewrites.
 *
 * Usage: add sitemapPlugin() to vite.config.ts plugins array.
 */

import type { Plugin } from 'vite';
import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'https://grabio.space';
const TODAY = new Date().toISOString().split('T')[0];

// Static pages: [path, changefreq, priority]
const STATIC_PAGES: [string, string, number][] = [
  ['/', 'weekly', 1.0],
  ['/features', 'monthly', 0.9],
  ['/pricing', 'monthly', 0.9],
  ['/use-cases', 'monthly', 0.8],
  ['/about', 'monthly', 0.7],
  ['/contact', 'monthly', 0.7],
  ['/privacy', 'yearly', 0.4],
  ['/marketplace', 'daily', 0.8],
  ['/login', 'yearly', 0.5],
  ['/signup', 'yearly', 0.6],
  ['/blog', 'weekly', 0.8],
];

interface BlogEntry {
  slug: string;
  updatedAt: string;
}

function buildSitemap(blogPosts: BlogEntry[]): string {
  const entries: string[] = [];

  for (const [path, changefreq, priority] of STATIC_PAGES) {
    entries.push(`  <url>
    <loc>${BASE_URL}${path}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`);
  }

  for (const post of blogPosts) {
    const lastmod = post.updatedAt.split('T')[0];
    entries.push(`  <url>
    <loc>${BASE_URL}/blog/${post.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${entries.join('\n')}

</urlset>`;
}

export function sitemapPlugin(): Plugin {
  return {
    name: 'grabio-sitemap',
    closeBundle() {
      try {
        // sitemapPlugin.ts is at src/lib/sitemapPlugin.ts → go up two levels for project root
        const blogDataPath = resolve(__dirname, '../data/blog-posts.ts');
        const source = readFileSync(blogDataPath, 'utf-8');

        // Extract slugs and updatedAt from source with a simple regex
        const slugMatches = [...source.matchAll(/slug:\s*'([^']+)'/g)];
        const updatedAtMatches = [...source.matchAll(/updatedAt:\s*'([^']+)'/g)];

        const blogPosts: BlogEntry[] = slugMatches.map((m, i) => ({
          slug: m[1],
          updatedAt: updatedAtMatches[i]?.[1] ?? TODAY,
        }));

        const sitemap = buildSitemap(blogPosts);
        const outputPath = resolve(process.cwd(), 'dist/sitemap.xml');
        writeFileSync(outputPath, sitemap, 'utf-8');
        console.log(`[grabio-sitemap] Generated sitemap with ${blogPosts.length + STATIC_PAGES.length} URLs → dist/sitemap.xml`);
      } catch (err) {
        console.warn('[grabio-sitemap] Could not auto-generate sitemap:', err);
      }
    },
  };
}
