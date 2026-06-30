/**
 * QUICK FREEZE TEST - Paste in Console
 * Tests the execution queue fix for rapid operations
 */

async function quickFreezeTest() {
    console.clear();
    console.log('🔥 QUICK FREEZE TEST - Testing execution queue fix');
    console.log('================================================\n');
    
    const startTime = Date.now();
    let completed = 0;
    let failed = 0;
    
    // Test 1: 10 rapid parallel operations
    console.log('TEST 1: 10 parallel operations (should NOT freeze)');
    console.log('Expected behavior:');
    console.log('  ✅ Operations queue and execute sequentially');
    console.log('  ✅ All operations complete successfully');
    console.log('  ✅ No UI freeze\n');
    
    const promises = [];
    for (let i = 0; i < 10; i++) {
        const promise = (async () => {
            try {
                await runExec(
                    "UPDATE settings SET value = ? WHERE key = 'freeze_test'",
                    [Date.now()]
                );
                completed++;
                return i;
            } catch (err) {
                failed++;
                console.error(`❌ Operation ${i} failed:`, err);
                return null;
            }
        })();
        promises.push(promise);
    }
    
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    console.log('\n================================================');
    console.log('📊 RESULTS:');
    console.log(`   Total operations: 10`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Success rate: ${((completed / 10) * 100).toFixed(1)}%`);
    
    if (completed === 10) {
        console.log('\n✅ ✅ ✅ TEST PASSED - No freeze detected!');
    } else {
        console.log('\n❌ TEST FAILED - Some operations did not complete');
    }
    
    console.log('\nLook for these console messages:');
    console.log('  ⚡ Executing operation #N - Operations executing');
    console.log('  ⏸️ Operation queued - Queue working');
    console.log('  🔄 Processing next queued operation - Queue processing');
    console.log('  💾 Saving database - Background saves happening');
}

// Make it globally accessible
window.quickFreezeTest = quickFreezeTest;

console.log(`
╔════════════════════════════════════════════════════════════╗
║           🔧 QUICK FREEZE TEST LOADED 🔧                   ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Run the test:                                             ║
║    > quickFreezeTest()                                     ║
║                                                            ║
║  What was fixed:                                           ║
║    ✅ Execution queue prevents race conditions             ║
║    ✅ saveDatabase() is non-blocking (fire-and-forget)     ║
║    ✅ Operations complete immediately without waiting      ║
║                                                            ║
║  What to expect:                                           ║
║    ✅ All 10 operations complete successfully              ║
║    ✅ No UI freeze during test                             ║
║    ✅ Operations queue if one is already executing         ║
║    ✅ Console shows operation tracking                     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);
