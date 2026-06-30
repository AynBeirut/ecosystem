// PATCH FOR COMPOSED PRODUCT DEDUCTION DEBUGGING
// Add this enhanced logging to deductStockAfterSale function

// Replace the deductStockAfterSale function with this version:
/*
async function deductStockAfterSale(cartItems) {
    console.log('📦 ==================== STOCK DEDUCTION START ====================');
    console.log('📦 Deducting stock for', cartItems.length, 'items...');
    console.log('📋 Cart items:', cartItems.map(i => `${i.name} x${i.quantity}`).join(', '));
    
    for (const item of cartItems) {
        console.log(`\n🔍 Processing: ${item.name} (ID: ${item.id}, Quantity: ${item.quantity})`);
        
        const products = await loadProductsFromDB();
        const product = products.find(p => p.id === item.id);
        
        if (!product) {
            console.warn(`⚠️ Product not found: ${item.name}`);
            continue;
        }
        
        // Check if this is a composed product with a recipe
        if (product.has_recipe === 1) {
            console.log(`🍽️ "${item.name}" is a COMPOSED product`);
            console.log(`   Cart quantity: ${item.quantity}`);
            
            // Get recipe ingredients
            const recipeResult = db.exec(`
                SELECT raw_material_id, quantity
                FROM product_recipes
                WHERE product_id = ${item.id}
            `);
            
            if (recipeResult && recipeResult[0] && recipeResult[0].values.length > 0) {
                console.log(`   Recipe has ${recipeResult[0].values.length} ingredient(s):`);
                
                // Deduct each ingredient
                for (const ingredientRow of recipeResult[0].values) {
                    const materialId = ingredientRow[0];
                    const quantityPerUnit = ingredientRow[1];
                    const totalQuantityNeeded = quantityPerUnit * item.quantity;
                    
                    const material = products.find(p => p.id === materialId);
                    if (material) {
                        const currentStock = material.stock || 0;
                        const newStock = Math.max(0, currentStock - totalQuantityNeeded);
                        
                        console.log(`   🔹 Ingredient: ${material.name} (ID: ${materialId})`);
                        console.log(`      Recipe quantity per unit: ${quantityPerUnit}`);
                        console.log(`      Units being sold: ${item.quantity}`);
                        console.log(`      CALCULATION: ${quantityPerUnit} × ${item.quantity} = ${totalQuantityNeeded}`);
                        console.log(`      Stock before: ${currentStock}`);
                        console.log(`      Stock after: ${newStock}`);
                        console.log(`      Actual deduction: ${totalQuantityNeeded}`);
                        
                        await updateProductStock(
                            materialId,
                            newStock,
                            `Used in ${item.name} (sale: ${item.quantity} unit${item.quantity > 1 ? 's' : ''})`
                        );
                    } else {
                        console.warn(`   ⚠️ Material ID ${materialId} not found in products table`);
                    }
                }
                
                // Save recipe snapshot for historical tracking
                await saveRecipeSnapshot(item.id, item.quantity);
                
                console.log(`✅ Completed ingredient deduction for ${item.name}`);
            } else {
                console.warn(`⚠️ No recipe found for ${item.name} in product_recipes table`);
            }
        } else {
            // Regular product - deduct from its own stock
            const currentStock = product.stock || 0;
            const newStock = Math.max(0, currentStock - item.quantity);
            
            console.log(`📦 "${item.name}" is a REGULAR product`);
            console.log(`   Current stock: ${currentStock}`);
            console.log(`   Deducting: ${item.quantity}`);
            console.log(`   New stock: ${newStock}`);
            
            await updateProductStock(
                item.id,
                newStock,
                `Sale: ${item.quantity} unit${item.quantity > 1 ? 's' : ''} sold`
            );
        }
    }
    
    // Save database after all stock changes
    await saveDatabase();
    console.log('\n✅ ==================== STOCK DEDUCTION COMPLETE ====================');
    
    // Check for low stock after sale
    checkLowStock();
}
*/

// INSTRUCTIONS:
// 1. Copy the function above (without the comment markers)
// 2. Open js/inventory.js
// 3. Find the deductStockAfterSale function (around line 468)
// 4. Replace it with the enhanced version above
// 5. Save and restart the app
// 6. Sell 1 Test item and check the console logs
// 7. The logs will show EXACTLY:
//    - What quantity is in the cart
//    - What quantity per unit is in the recipe  
//    - The multiplication calculation
//    - The actual deduction amount
