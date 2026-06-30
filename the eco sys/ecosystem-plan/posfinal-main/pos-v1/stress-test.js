/**
 * POS STRESS TEST - Run in Console
 * Copy this entire file and paste into the browser console while POS is running
 */

// Stress Test Controller
window.POSStressTest = {
    stats: {
        operations: 0,
        success: 0,
        errors: 0,
        startTime: null
    },

    log(message, emoji = '📋') {
        const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour12: false, 
            fractionalSecondDigits: 3 
        });
        console.log(`${emoji} [${timestamp}] ${message}`);
    },

    updateStats() {
        const duration = Date.now() - this.stats.startTime;
        console.log(`
📊 === STRESS TEST STATISTICS ===
   Operations: ${this.stats.operations}
   Successful: ${this.stats.success}
   Errors: ${this.stats.errors}
   Duration: ${duration}ms
   Success Rate: ${((this.stats.success / this.stats.operations) * 100).toFixed(2)}%
================================
        `);
    },

    resetStats() {
        this.stats = {
            operations: 0,
            success: 0,
            errors: 0,
            startTime: Date.now()
        };
    },

    /**
     * TEST 1: Save Queue Test (20 simultaneous saves)
     */
    async testSaveQueue() {
        this.resetStats();
        this.log('Starting Save Queue Test - 20 simultaneous saves', '🚀');
        
        const promises = [];
        for (let i = 0; i < 20; i++) {
            this.stats.operations++;
            const promise = new Promise((resolve) => {
                setTimeout(async () => {
                    try {
                        if (typeof window.saveDatabase === 'function') {
                            await window.saveDatabase();
                            this.stats.success++;
                            if (i % 5 === 0) {
                                this.log(`Save ${i + 1}/20 completed`, '✅');
                            }
                        }
                        resolve();
                    } catch (err) {
                        this.stats.errors++;
                        this.log(`Save ${i + 1} failed: ${err.message}`, '❌');
                        resolve();
                    }
                }, Math.random() * 50);
            });
            promises.push(promise);
        }

        await Promise.all(promises);
        this.log('Save Queue Test COMPLETED', '✅');
        this.log('Check for "⏸️ Save already in progress, queuing..." messages', '💡');
        this.updateStats();
    },

    /**
     * TEST 2: Rapid Transactions (3rd operation freeze scenario)
     */
    async testRapidTransactions(count = 10) {
        this.resetStats();
        this.log(`Starting Rapid Transactions Test - ${count} operations with NO delay`, '🚀');
        
        for (let i = 0; i < count; i++) {
            this.stats.operations++;
            try {
                // Rapid database operations
                await window.runExec(
                    "UPDATE settings SET value = ? WHERE key = 'stress_test_counter'",
                    [i]
                );
                this.stats.success++;
                
                if (i === 2) {
                    this.log('Operation 3 (critical test point) - Should NOT freeze', '⚠️');
                }
                if (i % 5 === 0) {
                    this.log(`Transaction ${i + 1}/${count} completed`, '✅');
                }
            } catch (err) {
                this.stats.errors++;
                this.log(`Transaction ${i + 1} failed: ${err.message}`, '❌');
            }
        }

        this.log('Rapid Transactions Test COMPLETED', '✅');
        this.updateStats();
    },

    /**
     * TEST 3: Mixed Operations (Reads + Writes + Saves)
     */
    async testMixedOperations(count = 30) {
        this.resetStats();
        this.log(`Starting Mixed Operations Test - ${count} operations`, '🚀');
        
        for (let i = 0; i < count; i++) {
            this.stats.operations++;
            try {
                const opType = i % 3;
                
                if (opType === 0) {
                    // Read operation
                    await window.runQuery('SELECT COUNT(*) FROM products');
                } else if (opType === 1) {
                    // Write operation
                    await window.runExec(
                        "UPDATE settings SET value = ? WHERE key = 'stress_test_counter'",
                        [Date.now()]
                    );
                } else {
                    // Save operation
                    await window.saveDatabase();
                }
                
                this.stats.success++;
                if (i % 10 === 0) {
                    this.log(`Mixed operation ${i + 1}/${count} completed`, '✅');
                }
            } catch (err) {
                this.stats.errors++;
                this.log(`Operation ${i + 1} failed: ${err.message}`, '❌');
            }
        }

        this.log('Mixed Operations Test COMPLETED', '✅');
        this.updateStats();
    },

    /**
     * TEST 4: Burst Test (10 operations in < 100ms)
     */
    async testBurst() {
        this.resetStats();
        this.log('Starting Burst Test - 10 operations in parallel', '🚀');
        
        const promises = [];
        for (let i = 0; i < 10; i++) {
            this.stats.operations++;
            const promise = (async () => {
                try {
                    await window.runExec(
                        "UPDATE settings SET value = ? WHERE key = 'stress_test_counter'",
                        [i]
                    );
                    this.stats.success++;
                    this.log(`Burst operation ${i + 1} completed`, '✅');
                } catch (err) {
                    this.stats.errors++;
                    this.log(`Burst operation ${i + 1} failed: ${err.message}`, '❌');
                }
            })();
            promises.push(promise);
        }

        await Promise.all(promises);
        this.log('Burst Test COMPLETED', '✅');
        this.updateStats();
    },

    /**
     * FULL STRESS TEST - Runs all tests
     */
    async runFullStressTest() {
        console.clear();
        this.log('💥💥💥 STARTING FULL STRESS TEST 💥💥💥', '🔥');
        this.log('This will test the save queue and performance fixes', '⚠️');
        
        await this.testSaveQueue();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await this.testRapidTransactions(20);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await this.testMixedOperations(30);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await this.testBurst();
        
        this.log('💥 FULL STRESS TEST COMPLETED 💥', '🎉');
        this.log('Check console logs for any freeze indicators or errors', '📊');
    }
};

// Quick access functions
window.runStressTest = () => window.POSStressTest.runFullStressTest();
window.testSaveQueue = () => window.POSStressTest.testSaveQueue();
window.testRapidTransactions = (count) => window.POSStressTest.testRapidTransactions(count);
window.testBurst = () => window.POSStressTest.testBurst();

// Print instructions
console.log(`
╔════════════════════════════════════════════════════════════╗
║           🔥 POS STRESS TEST LOADED 🔥                     ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Available Commands:                                        ║
║                                                            ║
║  runStressTest()           - Run full stress test          ║
║  testSaveQueue()           - Test save queue (20 saves)    ║
║  testRapidTransactions(20) - Test rapid operations         ║
║  testBurst()               - Test burst operations         ║
║                                                            ║
║  Example:                                                  ║
║    > runStressTest()                                       ║
║                                                            ║
║  What to look for:                                         ║
║    ✅ All operations complete                              ║
║    ✅ No UI freeze during test                             ║
║    ✅ "⏸️ Save already in progress, queuing..." messages   ║
║    ✅ "🔄 Processing queued save..." messages              ║
║    ❌ Any errors or timeout messages                       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);
