#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const rootDir = process.cwd();
const tsconfigPath = path.join(rootDir, 'tsconfig.app.json');
const baselinePath = path.resolve(rootDir, '.ci/inventory-type-baseline.json');
const updateMode = process.argv.includes('--update-baseline');

const TARGET_FILES = [
  'src/pages/admin/AdminOrders.tsx',
  'src/pages/admin/AdminFinishedGoods.tsx',
  'src/pages/admin/AdminPurchases.tsx',
].map((filePath) => path.resolve(rootDir, filePath));

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function getRelative(filePath) {
  return toPosix(path.relative(rootDir, filePath));
}

function normalizeDiagnostic(diag) {
  const filePath = diag.file ? path.resolve(diag.file.fileName) : null;
  const relativePath = filePath ? getRelative(filePath) : 'unknown';
  const position = diag.file && typeof diag.start === 'number'
    ? diag.file.getLineAndCharacterOfPosition(diag.start)
    : { line: 0, character: 0 };
  const endPosition = diag.file && typeof diag.length === 'number' && typeof diag.start === 'number'
    ? diag.file.getLineAndCharacterOfPosition(diag.start + diag.length)
    : { line: 0, character: 0 };
  const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');

  return {
    file: relativePath,
    line: position.line + 1,
    column: position.character + 1,
    endLine: endPosition.line + 1,
    endColumn: endPosition.character + 1,
    code: diag.code,
    category: diag.category,
    message,
  };
}

function diagnosticKey(diag) {
  return [
    diag.file,
    diag.code,
    diag.category,
    diag.message,
  ].join('::');
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) return [];
  const data = fs.readFileSync(baselinePath, 'utf8');
  const parsed = JSON.parse(data);
  return Array.isArray(parsed.diagnostics) ? parsed.diagnostics : [];
}

function writeBaseline(diagnostics) {
  const payload = {
    generatedAt: new Date().toISOString(),
    targetFiles: TARGET_FILES.map(getRelative),
    diagnostics,
  };
  fs.writeFileSync(baselinePath, JSON.stringify(payload, null, 2) + '\n');
}

function loadTsConfig() {
  const configSource = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configSource.error) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext([configSource.error], {
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getCanonicalFileName: (f) => f,
      getNewLine: () => ts.sys.newLine,
    }));
  }

  const parsed = ts.parseJsonConfigFileContent(
    configSource.config,
    ts.sys,
    rootDir,
    undefined,
    tsconfigPath,
  );

  if (parsed.errors.length > 0) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getCanonicalFileName: (f) => f,
      getNewLine: () => ts.sys.newLine,
    }));
  }

  return parsed;
}

function main() {
  const parsed = loadTsConfig();
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });

  const allDiagnostics = ts.getPreEmitDiagnostics(program);

  const filtered = allDiagnostics.filter((diag) => {
    if (!diag.file) return false;
    const resolved = path.resolve(diag.file.fileName);
    return TARGET_FILES.includes(resolved);
  });

  const normalized = filtered.map(normalizeDiagnostic).sort((a, b) => diagnosticKey(a).localeCompare(diagnosticKey(b)));

  if (updateMode) {
    writeBaseline(normalized);
    console.log(`Inventory type baseline updated with ${normalized.length} diagnostic(s).`);
    process.exit(0);
  }

  const baselineDiagnostics = readBaseline();
  const baselineSet = new Set(baselineDiagnostics.map(diagnosticKey));
  const unexpected = normalized.filter((diag) => !baselineSet.has(diagnosticKey(diag)));

  if (unexpected.length === 0) {
    console.log('Inventory type gate passed (no new TypeScript diagnostics in protected files).');
    process.exit(0);
  }

  console.error(`Inventory type gate failed. Found ${unexpected.length} new diagnostic(s):`);

  for (const diag of unexpected) {
    console.error(`- ${diag.file}:${diag.line}:${diag.column} TS${diag.code} ${diag.message}`);
  }
  console.error('If these are intentional and resolved later, update baseline with:');
  console.error('  node scripts/health/checkInventoryTypes.cjs --update-baseline');

  process.exit(1);
}

try {
  main();
} catch (error) {
  console.error('Failed to run inventory type gate.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
