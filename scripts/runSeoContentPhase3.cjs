#!/usr/bin/env node
/**
 * Phase 3 — generate Cursor AI drafts for seeded seo_content ideas (inventory + accounting).
 *
 *   node scripts/runSeoContentPhase3.cjs
 *   node scripts/runSeoContentPhase3.cjs --write
 *   node scripts/runSeoContentPhase3.cjs --write --limit 2
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));

const serviceAccountPath = path.join(repoRoot, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))),
    projectId: 'market-flow-7b074',
  });
}

const envPath = path.join(repoRoot, 'functions', '.env');
let CURSOR_API_KEY = process.env.CURSOR_API_KEY || '';
if (!CURSOR_API_KEY && fs.existsSync(envPath)) {
  const m = fs.readFileSync(envPath, 'utf8').match(/^CURSOR_API_KEY=(.+)$/m);
  if (m) CURSOR_API_KEY = m[1].trim();
}

const WRITE = process.argv.includes('--write');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 && process.argv[limitArg + 1] ? parseInt(process.argv[limitArg + 1], 10) : 999;

const PILLARS = {
  inventory: 'Inventory & Stock Management Software',
  accounting: 'Accounting & General Ledger Software',
};

function buildPrompt(item) {
  const pillarTitle = PILLARS[item.pillarSlug] || item.pillarSlug || 'Grabio software';
  const ctaBlock =
    item.intentStage === 'decision'
      ? '\nInclude a decision-stage CTA section with lead capture (demo request / contact form mention).'
      : '';

  return `You are an SEO content strategist for Grabio (grabio.space) — cloud software for inventory, accounting, POS, CRM, restaurant, and manufacturing SMBs in Lebanon and MENA.

Write structured SEO content for:
- Title: ${item.title}
- Target keyword: ${item.targetKeyword || '(assign a keyword)'}
- Content type: ${item.contentType}
- Intent stage: ${item.intentStage}
- Assigned URL: ${item.assignedUrl || '(TBD)'}
- Pillar topic: ${pillarTitle}
- Notes: ${item.notes || 'none'}
${ctaBlock}

Return ONLY valid JSON (no markdown fences) with this shape:
{
  "h1": "...",
  "metaTitle": "...",
  "metaDescription": "...",
  "bodyHtml": "<section>...</section>",
  "faqHtml": "<section><h2>FAQ</h2>...</section>",
  "suggestedInternalLinks": ["/solutions/accounting", "..."],
  "schemaType": "Article|FAQPage|HowTo",
  "rawMarkdown": "full markdown version"
}

Rules:
- H1 must include the target keyword naturally
- 3-5 H2 sections in bodyHtml with practical Grabio-specific detail (no fluff)
- FAQ: 3 questions minimum
- Suggest 3-6 internal links to /solutions/* pages
- metaTitle 50-60 chars, metaDescription 140-160 chars
- Do not invent fake statistics or client names`;
}

function parseDraft(raw) {
  const trimmed = String(raw || '').trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        h1: String(parsed.h1 ?? ''),
        metaTitle: String(parsed.metaTitle ?? ''),
        metaDescription: String(parsed.metaDescription ?? ''),
        bodyHtml: String(parsed.bodyHtml ?? ''),
        faqHtml: String(parsed.faqHtml ?? ''),
        suggestedInternalLinks: Array.isArray(parsed.suggestedInternalLinks)
          ? parsed.suggestedInternalLinks.map(String)
          : [],
        schemaType: String(parsed.schemaType ?? 'Article'),
        rawMarkdown: String(parsed.rawMarkdown ?? trimmed),
      };
    } catch {
      /* fall through */
    }
  }
  return null;
}

function computeChecklist(draft) {
  const bodyText = `${draft.bodyHtml} ${draft.faqHtml}`.replace(/<[^>]+>/g, ' ');
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  return {
    hasH1: Boolean(draft.h1.trim()),
    hasMetaTitle: draft.metaTitle.length >= 30 && draft.metaTitle.length <= 65,
    hasMetaDescription: draft.metaDescription.length >= 120 && draft.metaDescription.length <= 165,
    wordCount,
    internalLinksCount: draft.suggestedInternalLinks.length,
    schemaType: draft.schemaType.trim(),
    intentStageMatch: true,
  };
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function runCursorTextPrompt(apiKey, prompt) {
  const createRes = await fetch('https://api.cursor.com/v1/agents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'grabio-seo-phase3', prompt: { text: prompt } }),
  });
  if (!createRes.ok) {
    const errBody = await createRes.json().catch(() => ({}));
    throw new Error(String(errBody.message || errBody.error || `Cursor create ${createRes.status}`));
  }
  const created = await createRes.json();
  const agentId = created.agent?.id;
  const runId = created.run?.id || created.agent?.latestRunId;
  if (!agentId || !runId) throw new Error('No run id from Cursor');

  const started = Date.now();
  while (Date.now() - started < 180_000) {
    const runRes = await fetch(`https://api.cursor.com/v1/agents/${agentId}/runs/${runId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!runRes.ok) throw new Error(`Cursor poll ${runRes.status}`);
    const run = await runRes.json();
    if (run.status === 'FINISHED') {
      const text = String(run.result || '').trim();
      if (!text) throw new Error('Empty Cursor result');
      return text;
    }
    if (run.status === 'FAILED' || run.status === 'CANCELLED') {
      throw new Error(`Cursor run ${run.status}`);
    }
    await sleep(2500);
  }
  throw new Error('Cursor timed out');
}

async function main() {
  if (!CURSOR_API_KEY) {
    console.error('❌ CURSOR_API_KEY not set (functions/.env)');
    process.exit(1);
  }

  const db = admin.firestore();
  const snap = await db.collection('seo_content').get();
  const targets = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(
      (row) => row.status === 'idea' && !row.draft,
    )
    .slice(0, LIMIT);

  console.log(`Phase 3 targets: ${targets.length} idea(s) without drafts.`);

  if (!WRITE) {
    targets.forEach((row) => console.log(`  • [${row.pillarSlug}] ${row.title}`));
    console.log('\nDry run — pass --write to generate drafts (~30–60s each).');
    return;
  }

  let ok = 0;
  const failed = [];

  for (let i = 0; i < targets.length; i += 1) {
    const row = targets[i];
    console.log(`\n[${i + 1}/${targets.length}] ${row.title}`);
    try {
      const raw = await runCursorTextPrompt(CURSOR_API_KEY, buildPrompt(row));
      const draft = parseDraft(raw);
      if (!draft) throw new Error('Failed to parse JSON draft');
      const checklist = computeChecklist(draft);
      const scoreFlags = [
        checklist.hasH1,
        checklist.hasMetaTitle,
        checklist.hasMetaDescription,
        checklist.wordCount >= 800,
        checklist.internalLinksCount >= 3,
        Boolean(checklist.schemaType),
      ];
      const score = Math.round((scoreFlags.filter(Boolean).length / scoreFlags.length) * 100);
      const nextStatus = score >= 70 ? 'review' : 'draft';

      await db.collection('seo_content').doc(row.id).update({
        draft,
        checklist,
        status: nextStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  ✓ ${nextStatus} · checklist ~${score}% · ${checklist.wordCount} words`);
      ok += 1;
    } catch (err) {
      console.error(`  ✗ ${err.message || err}`);
      failed.push(row.title);
    }
  }

  console.log(`\nDone: ${ok}/${targets.length} generated.${failed.length ? ` Failed: ${failed.join('; ')}` : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
