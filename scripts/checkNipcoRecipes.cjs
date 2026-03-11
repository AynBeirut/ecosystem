// Check Nipco (y.malek) recipes specifically
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

async function checkNipcoRecipes() {
  console.log('\n=== NIPCO (y.malek@nip-lb.com) RECIPES ===\n');
  
  try {
    const nipcoStoreId = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
    
    // Get all recipes for Nipco store
    const recipesRef = collection(db, 'recipes');
    const recipesSnapshot = await getDocs(recipesRef);
    
    // Get all raw materials
    const materialsRef = collection(db, 'rawMaterials');
    const materialsSnapshot = await getDocs(materialsRef);
    const materialIds = new Set();
    const materialsData = {};
    materialsSnapshot.forEach(doc => {
      materialIds.add(doc.id);
      materialsData[doc.id] = doc.data();
    });
    
    const nipcoRecipes = [];
    const brokenRecipes = [];
    
    recipesSnapshot.forEach(doc => {
      const recipe = doc.data();
      if (recipe.storeId === nipcoStoreId) {
        nipcoRecipes.push({ id: doc.id, ...recipe });
        
        // Detailed check for issues
        const issues = [];
        
        if (!recipe.outputQuantity || recipe.outputQuantity === 0) {
          issues.push(`❌ Missing/zero outputQuantity (current: ${recipe.outputQuantity})`);
        }
        
        if (!recipe.outputUnit) {
          issues.push(`❌ Missing outputUnit`);
        }
        
        if (!recipe.ingredients || recipe.ingredients.length === 0) {
          issues.push(`❌ No ingredients array`);
        } else {
          recipe.ingredients.forEach((ing, index) => {
            if (!ing.rawMaterialId) {
              issues.push(`❌ Ingredient ${index + 1}: Missing rawMaterialId`);
            } else if (!materialIds.has(ing.rawMaterialId)) {
              issues.push(`❌ Ingredient ${index + 1}: References DELETED material ID: ${ing.rawMaterialId}`);
            } else {
              const material = materialsData[ing.rawMaterialId];
              issues.push(`✅ Ingredient ${index + 1}: ${material.name} (${ing.quantity} ${ing.unit})`);
            }
            
            if (!ing.quantity || ing.quantity === 0) {
              issues.push(`   └─ ❌ Zero/missing quantity`);
            }
            
            if (!ing.unit) {
              issues.push(`   └─ ❌ Missing unit`);
            }
          });
        }
        
        if (!recipe.storeId) {
          issues.push(`❌ Missing storeId`);
        }
        
        // Count broken issues (exclude ✅)
        const brokenIssues = issues.filter(i => i.includes('❌'));
        
        if (brokenIssues.length > 0) {
          brokenRecipes.push({
            id: doc.id,
            name: recipe.name,
            allDetails: issues,
            brokenIssues: brokenIssues
          });
        }
      }
    });
    
    console.log(`Found ${nipcoRecipes.length} recipes for Nipco store\n`);
    
    if (brokenRecipes.length === 0) {
      console.log('✅ ALL RECIPES ARE VALID!\n');
      console.log('All recipes have:');
      console.log('  - Valid outputQuantity');
      console.log('  - Valid outputUnit');
      console.log('  - Valid ingredients with existing materials');
      console.log('  - Valid quantities and units\n');
    } else {
      console.log(`❌ Found ${brokenRecipes.length} BROKEN recipes:\n`);
      console.log('='+ '='.repeat(60) + '\n');
      
      brokenRecipes.forEach((recipe, idx) => {
        console.log(`${idx + 1}. Recipe: "${recipe.name}"`);
        console.log(`   ID: ${recipe.id}`);
        console.log(`   Issues:\n`);
        recipe.allDetails.forEach(detail => {
          console.log(`   ${detail}`);
        });
        console.log('\n' + '='.repeat(60) + '\n');
      });
      
      console.log('\n💡 TO FIX:');
      console.log('These recipes are broken and cannot be edited until fixed.');
      console.log('Options:');
      console.log('1. Delete broken recipes and recreate them');
      console.log('2. Run migration script to populate missing fields');
      console.log('3. Manually fix via direct database update\n');
    }
    
    // List all recipes
    console.log('\n📋 ALL NIPCO RECIPES:\n');
    nipcoRecipes.forEach((recipe, idx) => {
      const status = brokenRecipes.find(b => b.id === recipe.id) ? '❌ BROKEN' : '✅ OK';
      console.log(`${idx + 1}. ${status} - "${recipe.name}" (ID: ${recipe.id})`);
    });
    
  } catch (error) {
    console.error('\nError:', error.message);
  }
  
  process.exit(0);
}

checkNipcoRecipes();
