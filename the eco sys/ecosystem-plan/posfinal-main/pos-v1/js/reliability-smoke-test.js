/**
 * Reliability Smoke Test (manual)
 * Usage in console:
 *   1) const s=document.createElement('script'); s.src='js/reliability-smoke-test.js?'+Date.now(); document.body.appendChild(s)
 *   2) runReliabilitySmokeTest()
 */

window.runReliabilitySmokeTest = async function runReliabilitySmokeTest() {
    const started = Date.now();
    const results = [];

    function check(name, pass, details) {
        results.push({ name, pass, details });
        console.log(`${pass ? '✅' : '❌'} ${name}: ${details}`);
    }

    try {
        console.log('🧪 Reliability Smoke Test');
        console.log('━'.repeat(64));

        // 1) DB and key APIs
        check('Database initialized', !!window.db, window.db ? 'db is available' : 'db missing');
        check('Transaction APIs available', typeof beginTransaction === 'function' && typeof commit === 'function' && typeof rollback === 'function', 'begin/commit/rollback presence');
        check('Critical APIs available', typeof saveSale === 'function' && typeof deductStockAfterSale === 'function', 'saveSale + deductStockAfterSale presence');

        // 2) Migration logging table reachable
        try {
            const systemSettingsExists = runQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'");
            check('system_settings table exists', Array.isArray(systemSettingsExists) && systemSettingsExists.length > 0, 'migration logs can persist');
        } catch (e) {
            check('system_settings table exists', false, e.message);
        }

        // 3) Sales table key columns sanity
        try {
            const salesInfo = runQuery("PRAGMA table_info(sales)");
            const cols = (salesInfo || []).map(c => c.name);
            const required = ['timestamp', 'items', 'totals', 'paymentMethod', 'synced'];
            const missing = required.filter(c => !cols.includes(c));
            check('Sales schema has required columns', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : 'all present');
        } catch (e) {
            check('Sales schema has required columns', false, e.message);
        }

        // 4) Recent sales JSON parse sanity
        try {
            const sales = runQuery('SELECT id, items, totals FROM sales ORDER BY id DESC LIMIT 5') || [];
            let badRows = 0;
            for (const s of sales) {
                try {
                    JSON.parse(s.items || '[]');
                    JSON.parse(s.totals || '{}');
                } catch (_e) {
                    badRows++;
                }
            }
            check('Recent sales JSON is parsable', badRows === 0, `${sales.length} checked, ${badRows} invalid`);
        } catch (e) {
            check('Recent sales JSON is parsable', false, e.message);
        }

        // 5) Sync queue safety sanity for latest sale
        try {
            const latest = runQuery('SELECT id FROM sales ORDER BY id DESC LIMIT 1');
            if (latest && latest.length > 0) {
                const saleId = latest[0].id;
                const syncRows = runQuery('SELECT id, operation, entityType, recordId FROM sync_queue WHERE entityType = ? AND recordId = ? ORDER BY id DESC LIMIT 1', ['sales', String(saleId)]);
                check('Latest sale has sync record', Array.isArray(syncRows) && syncRows.length > 0, syncRows && syncRows.length ? `sync queue id ${syncRows[0].id}` : `no sync row for sale ${saleId}`);
            } else {
                check('Latest sale has sync record', true, 'no sales yet, skipped');
            }
        } catch (e) {
            check('Latest sale has sync record', false, e.message);
        }

        const passed = results.filter(r => r.pass).length;
        const failed = results.length - passed;
        const ms = Date.now() - started;

        console.log('━'.repeat(64));
        console.log(`📊 Summary: ${passed}/${results.length} passed, ${failed} failed (${ms}ms)`);

        return { passed, failed, results, ms };
    } catch (err) {
        console.error('❌ Smoke test crashed:', err);
        throw err;
    }
};

console.log('✅ reliability-smoke-test loaded. Run: runReliabilitySmokeTest()');
