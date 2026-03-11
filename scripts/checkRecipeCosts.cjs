// Check why "All Care 2 Ply Facial 3Kg" has zero cost
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U",
  authDomain: "market-flow-7b074.firebaseapp.com",
  projectId: "market-flow-7b074",
  storageBucket: "market-flow-7b074.appspot.com",
  messagingSenderId: "997465465802",
  appId: "1:997465465802:web:3c6789ea41a9458a98e533"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkRecipeCosts() {
  console.log('\n=== CHECKING RECIPE COSTS FOR NIPCO ===\n');
  
  try {
    const nipcoStoreId = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
    
    // Get all recipes
    const recipesRef = collection(db, 'recipes');
    const recipesSnapshot = await getDocs(recipesRef);
    
    // Get all raw materials
    const materialsRef = collection(db, 'rawMaterials');
    const materialsSnapshot = await getDocs(materialsRef);
    const materialsData = {};
    materialsSnapshot.forEach(doc => {
      materialsData[doc.id] = doc.data();
    });
    
    console.log('Found', materialsSnapshot.size, 'raw materials\n');
    
    // Check each Nipco recipe
    const nipcoRecipes = [];
    recipesSnapshot.forEach(doc => {
      const recipe = doc.data();
      if (recipe.storeId === nipcoStoreId) {
        nipcoRecipes.push({ id: doc.id, ...recipe });
      }
    });
    
    console.log('Found', nipcoRecipes.length, 'recipes for Nipco\n');
    console.log('='.repeat(80) + '\n');
    
    nipcoRecipes.forEach((recipe, idx) => {
      console.log(`${idx + 1}. Recipe: "${recipe.name}"`);
      console.log(`   ID: ${recipe.id}`);
      console.log(`   Output: ${recipe.outputQuantity || 'MISSING'} ${recipe.outputUnit || 'MISSING'}`);
      console.log(`   Total Cost: $${recipe.totalCost || 0}`);
      console.log(`   Cost Per Unit: $${recipe.costPerUnit || 0}`);
      
      if (!recipe.ingredients || recipe.ingredients.length === 0) {
        console.log(`   ❌ NO INGREDIENTS!`);
      } else {
        console.log(`   Ingredients (${recipe.ingredients.length}):`);
        
        let calculatedTotal = 0;
        
        recipe.ingredients.forEach((ing, i) => {
          const material = materialsData[ing.rawMaterialId];
          if (!material) {
            console.log(`     ${i + 1}. ❌ DELETED MATERIAL: ${ing.rawMaterialId}`);
          } else {
            const materialCost = material.costPerUnit || 0;
            const ingQuantity = ing.quantity || 0;
            const ingCost = materialCost * ingQuantity;
            calculatedTotal += ingCost;
            
            console.log(`     ${i + 1}. ${material.name}`);
            console.log(`        - Quantity: ${ingQuantity} ${ing.unit}`);
            console.log(`        - Material cost: $${materialCost} per ${material.unit}`);
            console.log(`        - Ingredient cost: $${ingCost.toFixed(4)}`);
          }
        });
        
        console.log(`\n   📊 CALCULATED TOTAL COST: $${calculatedTotal.toFixed(4)}`);
        console.log(`   📊 STORED TOTAL COST: $${recipe.totalCost || 0}`);
        
        if (recipe.outputQuantity && recipe.outputQuantity > 0) {
          const calculatedPerUnit = calculatedTotal / recipe.outputQuantity;
          console.log(`   📊 CALCULATED COST PER UNIT: $${calculatedPerUnit.toFixed(4)}`);
          console.log(`   📊 STORED COST PER UNIT: $${recipe.costPerUnit || 0}`);
        } else {
          console.log(`   ❌ Cannot calculate cost per unit - missing outputQuantity`);
        }
        
        if (Math.abs((recipe.totalCost || 0) - calculatedTotal) > 0.01) {
          console.log(`\n   ⚠️  MISMATCH! Stored cost doesn't match calculated cost!`);
        }
        
        if ((recipe.totalCost || 0) === 0 && calculatedTotal > 0) {
          console.log(`\n   ❌ ZERO COST ISSUE: Recipe should cost $${calculatedTotal.toFixed(2)} but shows $0`);
          console.log(`   💡 FIX: Need to recalculate and save this recipe`);
        }
      }
      
      console.log('\n' + '='.repeat(80) + '\n');
    });
    
  } catch (error) {
    console.error('\nError:', error.message);
  }
  
  process.exit(0);
}

checkRecipeCosts();
