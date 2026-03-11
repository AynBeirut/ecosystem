// Use Firebase client SDK instead of admin SDK
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

async function diagnoseRecipes(ownerEmail) {
  console.log('\n=== DIAGNOSING RECIPES ===\n');
  
  try {
    // First, find the storeId for this owner email
    const storesRef = collection(db, 'storeProfiles');
    const storesSnapshot = await getDocs(storesRef);
    let targetStoreId = null;
    let storeName = null;
    
    storesSnapshot.forEach(doc => {
      const store = doc.data();
      if (store.ownerEmail === ownerEmail) {
        targetStoreId = doc.id;
        storeName = store.businessName;
        console.log(`Found store: ${store.businessName} (ID: ${doc.id})`);
        console.log(`Owner: ${store.ownerEmail}\n`);
      }
    });
    
    if (!targetStoreId) {
      console.log(`❌ No store found for owner email: ${ownerEmail}\n`);
      console.log('Available stores:');
      storesSnapshot.forEach(doc => {
        const store = doc.data();
        console.log(`  - ${store.businessName} (${store.ownerEmail})`);
      });
      return;
    }
    
    // Get all recipes
    const recipesRef = collection(db, 'recipes');
    const recipesSnapshot = await getDocs(recipesRef);
    
    // Filter recipes for this store only
    const storeRecipes = [];
    recipesSnapshot.forEach(doc => {
      const recipe = doc.data();
      if (recipe.storeId === targetStoreId) {
        storeRecipes.push({ id: doc.id, ...recipe });
      }
    });
    
    console.log(`Found ${storeRecipes.length} recipes for ${storeName}\n`);
    
    // Get all raw materials to check references
    const materialsRef = collection(db, 'rawMaterials');
    const materialsSnapshot = await getDocs(materialsRef);
    const materialIds = new Set();
    materialsSnapshot.forEach(doc => materialIds.add(doc.id));
    console.log(`Found ${materialIds.size} raw materials in database\n`);
    
    const issues = [];
    
    storeRecipes.forEach(recipe => {
      const recipeIssues = {
        id: recipe.id,
        name: recipe.name,
        storeId: recipe.storeId,
        problems: []
      };
      
      // Check for missing outputQuantity
      if (!recipe.outputQuantity || recipe.outputQuantity === 0) {
        recipeIssues.problems.push(`Missing or zero outputQuantity (current: ${recipe.outputQuantity})`);
      }
      
      // Check for missing outputUnit
      if (!recipe.outputUnit) {
        recipeIssues.problems.push(`Missing outputUnit`);
      }
      
      // Check ingredients
      if (!recipe.ingredients || recipe.ingredients.length === 0) {
        recipeIssues.problems.push(`No ingredients`);
      } else {
        // Check each ingredient
        recipe.ingredients.forEach((ing, index) => {
          if (!ing.rawMaterialId) {
            recipeIssues.problems.push(`Ingredient ${index + 1}: Missing rawMaterialId`);
          } else if (!materialIds.has(ing.rawMaterialId)) {
            recipeIssues.problems.push(`Ingredient ${index + 1}: References deleted material (${ing.rawMaterialId})`);
          }
          
          if (!ing.quantity || ing.quantity === 0) {
            recipeIssues.problems.push(`Ingredient ${index + 1}: Missing or zero quantity (current: ${ing.quantity})`);
          }
          
          if (!ing.unit) {
            recipeIssues.problems.push(`Ingredient ${index + 1}: Missing unit`);
          }
        });
      }
      
      // Check for missing storeId
      if (!recipe.storeId) {
        recipeIssues.problems.push(`Missing storeId`);
      }
      
      if (recipeIssues.problems.length > 0) {
        issues.push(recipeIssues);
      }
    });
    
    // Report findings
    if (issues.length === 0) {
      console.log('✅ All recipes look good! No issues found.\n');
    } else {
      console.log(`❌ Found ${issues.length} recipes with issues:\n`);
      
      issues.forEach((issue, idx) => {
        console.log(`${idx + 1}. Recipe: "${issue.name}" (ID: ${issue.id})`);
        console.log(`   Store ID: ${issue.storeId || 'MISSING'}`);
        issue.problems.forEach(problem => {
          console.log(`   - ${problem}`);
        });
        console.log();
      });
      
      console.log('\n=== FIXES NEEDED ===\n');
      console.log('To fix these recipes:');
      console.log('1. Go to the Recipes page');
      console.log('2. Edit each recipe listed above');
      console.log('3. Fix the issues mentioned');
      console.log('4. Or delete the broken recipes and recreate them\n');
    }
    
  } catch (error) {
    console.error('Error diagnosing recipes:', error);
  }
  
  process.exit(0);
}

// Check for email parameter
const targetEmail = process.argv[2] || 'y.malek@nip-lb.com';
console.log(`\nChecking recipes for: ${targetEmail}\n`);
diagnoseRecipes(targetEmail);
