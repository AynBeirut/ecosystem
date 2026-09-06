#!/usr/bin/env node
/**
 * Run JD Edwards voucher tests for JV, PV, RV, CRN, DRN, CV.
 * Writes report to reporting/data/voucher-jdedwards-all-types-{date}.json
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const vendor = path.join(repoRoot, 'vendor/beirut-finance-flow-main');
const date = new Date().toISOString().slice(0, 10);
const reportDir = path.join(repoRoot, 'reporting/data');
const reportPath = path.join(reportDir, `voucher-jdedwards-all-types-${date}.json`);

if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

let stdout = '';
let exitCode = 0;
try {
  stdout = execSync('npm test -- voucherJdEdwardsAllTypes.test.ts 2>&1', {
    cwd: vendor,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
} catch (err) {
  exitCode = err.status || 1;
  stdout = (err.stdout || '') + (err.stderr || '') + (err.message || '');
}

const passed = /Tests\s+(\d+)\s+passed/.exec(stdout);
const failed = /(\d+)\s+failed/.exec(stdout);
const testCount = passed ? Number(passed[1]) : 0;
const failCount = failed ? Number(failed[1]) : exitCode ? 1 : 0;

const types = ['JV', 'PV', 'RV', 'CRN', 'DRN', 'CV'];
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'JD Edwards grid — all voucher types (unit)',
  store: 'logic-only (no Firestore post)',
  types,
  vitest: {
    passed: testCount,
    failed: failCount,
    exitCode,
  },
  status: exitCode === 0 && failCount === 0 ? 'passed' : 'failed',
  outputTail: stdout.split('\n').slice(-40).join('\n'),
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(stdout);
console.log(`\nReport: ${reportPath}`);
console.log(report.status === 'passed' ? '✅ All voucher type tests passed' : '❌ Tests failed');
process.exit(exitCode);
