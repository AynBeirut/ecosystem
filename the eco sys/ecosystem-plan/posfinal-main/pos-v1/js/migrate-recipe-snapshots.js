// One-time migration: Drop and recreate sale_recipe_snapshots table with correct schema
(function() {
    function migrateSaleRecipeSnapshots() {
        if (typeof window.db === 'undefined' || window.db === null) {
            setTimeout(migrateSaleRecipeSnapshots, 500);
            return;
        }
        
        try {
            console.log('🔧 Migrating sale_recipe_snapshots table...');
            
            // Drop old table if it exists
            window.db.run('DROP TABLE IF EXISTS sale_recipe_snapshots');
            
            // Create new table with correct schema
            window.db.run(`
                CREATE TABLE sale_recipe_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER NOT NULL,
                    raw_material_id INTEGER NOT NULL,
                    quantity REAL NOT NULL,
                    cost_at_sale REAL NOT NULL,
                    timestamp INTEGER NOT NULL
                )
            `);
            
            console.log('✅ sale_recipe_snapshots table migrated successfully');
            
            // Save database
            if (typeof saveDatabase === 'function') {
                saveDatabase().then(() => {
                    console.log('💾 Database saved after migration');
                });
            }
        } catch (error) {
            console.error('❌ Migration error:', error);
        }
    }
    
    migrateSaleRecipeSnapshots();
})();
