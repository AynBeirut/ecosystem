/**
 * SEO Audit — Apache Log Parser & Firestore Uploader
 * Run on VPS (cron daily) → seo_audits/grabio_space
 */

import { createReadStream, existsSync, readFileSync } from 'fs';
import { createInterface } from 'readline';
import { resolve } from 'path';

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const LOG_PATH  = getArg('log',  '/var/log/apache2/access.log');
const SITE      = getArg('site', 'grabio.space');
const DAYS_BACK = parseInt(getArg('days', '0'), 10);
const KEY_PATH  = resolve(process.cwd(), getArg('key', 'serviceAccountKey.json'));

const BOT_UA_PATTERNS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'sogou', 'exabot', 'facebot', 'ia_archiver',
  'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'petalbot',
  'seznambot', 'archive.org_bot', 'ccbot', 'crawler', 'spider',
];

const LOG_REGEX = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*?)"\s+(\d{3})\s+(\S+)\s+"([^"]*)"\s+"([^"]*)"/;

const MONTH_MAP = {
  Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
  Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12',
};

function parseLogLine(line) {
  const m = LOG_REGEX.exec(line);
  if (!m) return null;

  const [, ip, dateStr, request, status, , , ua] = m;
  const [datePart] = dateStr.split(':');
  const [day, mon, year] = datePart.split('/');
  const isoDate = `${year}-${MONTH_MAP[mon] || '01'}-${day.padStart(2, '0')}`;

  const [, url] = request.split(' ');
  const isBot = BOT_UA_PATTERNS.some(p => ua.toLowerCase().includes(p));

  return { ip, date: isoDate, url: url || '/', status: parseInt(status, 10), isBot, ua };
}

function isScannerProbe(url) {
  return /\.(php|phtml|asp|aspx|env|sql)(\?|$|\/)/i.test(url)
    || /^\/(wp-|\.git|\.env|vendor\/|modules\/|cgi-bin\/)/i.test(url);
}

async function main() {
  console.log(`[SEO Audit] Reading: ${LOG_PATH}`);
  if (!existsSync(LOG_PATH)) {
    console.error(`[SEO Audit] Log file not found: ${LOG_PATH}`);
    process.exit(1);
  }
  if (!existsSync(KEY_PATH)) {
    console.error(`[SEO Audit] Service account key not found: ${KEY_PATH}`);
    process.exit(1);
  }

  const cutoffDate = DAYS_BACK > 0
    ? new Date(Date.now() - DAYS_BACK * 86400 * 1000).toISOString().split('T')[0]
    : null;

  let totalLines = 0;
  let totalRequests = 0;
  let minDate = null;
  let maxDate = null;

  const statusCounts = {};
  const dailyCounts  = {};
  const urlCounts    = {};
  const url404Counts = {};
  const ipCounts     = {};
  let scannerProbes  = 0;

  const rl = createInterface({
    input: createReadStream(LOG_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    totalLines++;
    const parsed = parseLogLine(line.trim());
    if (!parsed) continue;
    if (cutoffDate && parsed.date < cutoffDate) continue;

    totalRequests++;

    if (!minDate || parsed.date < minDate) minDate = parsed.date;
    if (!maxDate || parsed.date > maxDate) maxDate = parsed.date;

    const sc = String(parsed.status);
    statusCounts[sc] = (statusCounts[sc] || 0) + 1;

    dailyCounts[parsed.date] = (dailyCounts[parsed.date] || 0) + 1;

    const url = parsed.url.split('?')[0];
    urlCounts[url] = (urlCounts[url] || 0) + 1;
    if (isScannerProbe(url)) scannerProbes++;
    if (parsed.status === 404) {
      url404Counts[url] = (url404Counts[url] || 0) + 1;
    }

    if (!ipCounts[parsed.ip]) ipCounts[parsed.ip] = { hits: 0, isBot: parsed.isBot };
    ipCounts[parsed.ip].hits++;
    if (parsed.isBot) ipCounts[parsed.ip].isBot = true;
  }

  console.log(`[SEO Audit] Parsed ${totalLines} lines → ${totalRequests} matched requests`);

  const days = Object.keys(dailyCounts).length || 1;
  const avgDaily = Math.round(totalRequests / days);

  const ok200   = statusCounts['200'] || 0;
  const broken404 = statusCounts['404'] || 0;
  const server5xx = (statusCounts['500'] || 0) + (statusCounts['502'] || 0) + (statusCounts['503'] || 0);
  const redirect301 = (statusCounts['301'] || 0) + (statusCounts['302'] || 0);
  const redirectRatio = totalRequests > 0 ? redirect301 / totalRequests : 0;
  // grabio.space on VPS is a redirect stub to Firebase — almost all hits are scanner probes → 301.
  const vhostMode = ok200 === 0 && redirectRatio >= 0.9 ? 'redirect_stub' : 'standard';
  const healthScore = vhostMode === 'redirect_stub'
    ? Math.max(0, 100 - Math.round(((broken404 + server5xx) / totalRequests) * 100))
    : (totalRequests > 0 ? Math.round((ok200 / totalRequests) * 100) : 0);

  const topPages = Object.entries(urlCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([url, requests], i) => ({
      rank: i + 1,
      url,
      requests,
      share: totalRequests > 0 ? +((requests / totalRequests) * 100).toFixed(1) : 0,
    }));

  const top404Urls = Object.entries(url404Counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([url, hits]) => ({ url, hits }));

  const topIPs = Object.entries(ipCounts)
    .sort((a, b) => b[1].hits - a[1].hits)
    .slice(0, 20)
    .map(([ip, data], i) => ({ rank: i + 1, ip, hits: data.hits, isBot: data.isBot }));

  const dailySeries = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, requests]) => {
      const d = new Date(date + 'T00:00:00Z');
      const label = `${String(d.getUTCDate()).padStart(2,'0')}/${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]}`;
      const vsAvg = avgDaily > 0 ? Math.round(((requests - avgDaily) / avgDaily) * 100) : 0;
      return { date: label, isoDate: date, requests, vsAvg };
    });

  const subnetGroups = {};
  topIPs.forEach(({ ip, hits, isBot }) => {
    const subnet = ip.split('.').slice(0, 3).join('.');
    if (!subnetGroups[subnet]) subnetGroups[subnet] = { count: 0, hits: 0, isBot };
    subnetGroups[subnet].count++;
    subnetGroups[subnet].hits += hits;
    if (isBot) subnetGroups[subnet].isBot = true;
  });
  const botSubnet = Object.entries(subnetGroups)
    .filter(([, g]) => g.count >= 3)
    .sort((a, b) => b[1].hits - a[1].hits)[0];

  const auditDoc = {
    site: SITE,
    generated_at: new Date().toISOString(),
    date_from: minDate,
    date_to: maxDate,
    days,
    total_requests: totalRequests,
    avg_daily: avgDaily,
    health_score: healthScore,
    vhost_mode: vhostMode,
    data_source_note: vhostMode === 'redirect_stub'
      ? 'VPS Apache redirect stub only — canonical site traffic is on Firebase/Fastly. Use GSC/GA4 for real SEO health.'
      : null,
    status_breakdown: statusCounts,
    findings: {
      broken_urls: broken404,
      redirects: redirect301,
      scanner_probes: scannerProbes,
      bot_subnet: botSubnet ? botSubnet[0] : null,
      bot_ip_count: botSubnet ? botSubnet[1].count : 0,
    },
    top_404_urls: top404Urls,
    top_pages: topPages,
    top_ips: topIPs,
    daily_series: dailySeries,
  };

  console.log('[SEO Audit] Uploading to Firestore...');

  let admin;
  try {
    admin = (await import('firebase-admin')).default;
  } catch {
    console.error('[SEO Audit] firebase-admin not found. Run: npm install firebase-admin');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = admin.firestore();
  const docRef = db.collection('seo_audits').doc(SITE.replace(/\./g, '_'));
  await docRef.set(auditDoc, { merge: false });

  console.log(`[SEO Audit] ✓ Uploaded to Firestore → seo_audits/${SITE.replace(/\./g, '_')}`);
  console.log(`  Total requests : ${totalRequests.toLocaleString()}`);
  console.log(`  Health score   : ${healthScore}% (${vhostMode})`);
  console.log(`  Scanner probes : ${scannerProbes.toLocaleString()}`);
  console.log(`  Broken 404s    : ${broken404.toLocaleString()}`);
  console.log(`  Top 404 URLs   : ${top404Urls.length}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('[SEO Audit] Fatal error:', err);
  process.exit(1);
});
