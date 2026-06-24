// Fix duplicate recipe entries - run once to clean database
(function() {
    function cleanupDuplicateRecipes() {
        if (typeof window.db === 'undefined' || window.db === null) {
            setTimeout(cleanupDuplicateRecipes, 500);
            return;
        }
        
        try {
            console.log('🔧 Checking for duplicate recipe entries...');
            
            // Check for duplicates
            const duplicates = window.db.exec(`
                SELECT product_id, raw_material_id, COUNT(*) as count
                FROM product_recipes
                GROUP BY product_id, raw_material_id
                HAVING count > 1
            `);
            
            if (!duplicates.length || !duplicates[0] || duplicates[0].values.length === 0) {
                console.log('✅ No duplicate recipes found');
                return;
            }
            
            console.log(`⚠️ Found ${duplicates[0].values.length} duplicate recipe entries`);
            duplicates[0].values.forEach(row => {
                console.log(`   Product ${row[0]}, Material ${row[1]}: ${row[2]} entries`);
            });
            
            // Delete duplicates, keeping only the first (lowest rowid) of each
            console.log('🗑️ Deleting duplicate entries...');
            window.db.exec(`
                DELETE FROM product_recipes 
                WHERE rowid NOT IN (
                    SELECT MIN(rowid) 
                    FROM product_recipes 
                    GROUP BY product_id, raw_material_id
                )
            `);
            
            // Verify cleanup
            const afterCheck = window.db.exec(`
                SELECT product_id, raw_material_id, COUNT(*) as count
                FROM product_recipes
                GROUP BY product_id, raw_material_id
                HAVING count > 1
            `);
            
            if (!afterCheck.length || !afterCheck[0] || afterCheck[0].values.length === 0) {
                console.log('✅ All duplicate recipes removed successfully!');
                
                // Save database
                if (typeof saveDatabase === 'function') {
                    saveDatabase().then(() => {
                        console.log('💾 Database saved after cleanup');
                        alert('✅ Duplicate recipes fixed! The double deduction issue should be resolved.');
                    });
                }
            } else {
                console.error('⚠️ Some duplicates still remain:', afterCheck[0].values);
            }
            
        } catch (error) {
            console.error('❌ Cleanup error:', error);
        }
    }
    
    // Run cleanup
    cleanupDuplicateRecipes();
})();
