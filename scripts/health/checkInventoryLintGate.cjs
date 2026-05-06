#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');

const rootDir = process.cwd();
const baselinePath = path.resolve(rootDir, '.ci/inventory-lint-baseline.json');
const updateMode = process.argv.includes('--update-baseline');

const TARGET_FILES = [
  'src/pages/admin/AdminOrders.tsx',
  'src/pages/admin/AdminFinishedGoods.tsx',
  'src/pages/admin/AdminPurchases.tsx',
];

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function normalizeIssue(filePath, message) {
  return {
    file: toPosix(path.relative(rootDir, filePath)),
    line: message.line || 0,
    column: message.column || 0,
    endLine: message.endLine || 0,
    endColumn: message.endColumn || 0,
    severity: message.severity,
    ruleId: message.ruleId || 'unknown-rule',
    message: message.message,
  };
}

function issueKey(issue) {
  return [
    issue.file,
    issue.severity,
    issue.ruleId,
    issue.message,
  ].join('::');
}

async function collectIssues() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(TARGET_FILES);

  const issues = [];
  for (const result of results) {
    for (const msg of result.messages) {
      issues.push(normalizeIssue(result.filePath, msg));
    }
  }

  issues.sort((a, b) => issueKey(a).localeCompare(issueKey(b)));
  return issues;
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) {
    return [];
  }
  const data = fs.readFileSync(baselinePath, 'utf8');
  const parsed = JSON.parse(data);
  return Array.isArray(parsed.issues) ? parsed.issues : [];
}

function writeBaseline(issues) {
  const payload = {
    generatedAt: new Date().toISOString(),
    targetFiles: TARGET_FILES,
    issues,
  };
  fs.writeFileSync(baselinePath, JSON.stringify(payload, null, 2) + '\n');
}

async function main() {
  const currentIssues = await collectIssues();

  if (updateMode) {
    writeBaseline(currentIssues);
    console.log(`Inventory lint baseline updated with ${currentIssues.length} issue(s).`);
    return;
  }

  const baselineIssues = readBaseline();
  const baselineSet = new Set(baselineIssues.map(issueKey));

  const unexpected = currentIssues.filter((issue) => !baselineSet.has(issueKey(issue)));

  if (unexpected.length === 0) {
    console.log('Inventory lint gate passed (no new lint issues in protected files).');
    return;
  }

  console.error(`Inventory lint gate failed. Found ${unexpected.length} new issue(s):`);
  for (const issue of unexpected) {
    console.error(`- ${issue.file}:${issue.line}:${issue.column} [${issue.ruleId}] ${issue.message}`);
  }
  console.error('If these are intentional and resolved later, update baseline with:');
  console.error('  node scripts/health/checkInventoryLintGate.cjs --update-baseline');
  process.exit(1);
}

main().catch((error) => {
  console.error('Failed to run inventory lint gate.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
