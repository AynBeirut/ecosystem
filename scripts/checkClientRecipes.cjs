// Check recipes for specific client account
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

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

async function checkClientRecipes() {
  console.log('\n=== CHECKING CLIENT RECIPES ===\n');
  
  try {
    // Check for h.akalfouni (exists) - y.malek doesn't exist yet
    const salesEmail = 'h.akalfouni@nip-lb.com';
    
    // Find the user
    console.log(`Looking for user: ${salesEmail}...\n`);
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    let userAccount = null;
    
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      if (user.email === salesEmail) {
        userAccount = { id: doc.id, ...user };
      }
    });
    
    if (!userAccount) {
      console.log(`❌ User ${salesEmail} not found in database`);
      console.log('\nAll users in database:');
      usersSnapshot.forEach(doc => {
        const user = doc.data();
        console.log(`  - ${user.email} (ID: ${doc.id})`);
      });
      return;
    }
    
    console.log(`✅ Found user:`);
    console.log(`   Email: ${userAccount.email}`);
    console.log(`   ID: ${userAccount.id}`);
    console.log(`   Store ID: ${userAccount.storeId || 'NO STORE ID'}\n`);
    
    const storeId = userAccount.storeId;
    
    if (!storeId) {
      console.log('❌ No storeId found for this account');
      return;
    }
    
    console.log(`Checking recipes for storeId: ${storeId}...\n`);
    
    // Get all recipes for this store
    const recipesRef = collection(db, 'recipes');
    const recipesSnapshot = await getDocs(recipesRef);
    
    // Get all raw materials
    const materialsRef = collection(db, 'rawMaterials');
    const materialsSnapshot = await getDocs(materialsRef);
    const materialIds = new Set();
    materialsSnapshot.forEach(doc => materialIds.add(doc.id));
    
    const storeRecipes = [];
    const brokenRecipes = [];
    
    recipesSnapshot.forEach(doc => {
      const recipe = doc.data();
      if (recipe.storeId === storeId) {
        storeRecipes.push({ id: doc.id, ...recipe });
        
        // Check for issues
        const issues = [];
        
        if (!recipe.outputQuantity || recipe.outputQuantity === 0) {
          issues.push('Missing or zero outputQuantity');
        }
        
        if (!recipe.outputUnit) {
          issues.push('Missing outputUnit');
        }
        
        if (!recipe.ingredients || recipe.ingredients.length === 0) {
          issues.push('No ingredients');
        } else {
          recipe.ingredients.forEach((ing, index) => {
            if (!ing.rawMaterialId) {
              issues.push(`Ingredient ${index + 1}: Missing rawMaterialId`);
            } else if (!materialIds.has(ing.rawMaterialId)) {
              issues.push(`Ingredient ${index + 1}: References deleted material (${ing.rawMaterialId})`);
            }
            
            if (!ing.quantity || ing.quantity === 0) {
              issues.push(`Ingredient ${index + 1}: Zero quantity`);
            }
          });
        }
        
        if (issues.length > 0) {
          brokenRecipes.push({
            id: doc.id,
            name: recipe.name,
            issues: issues
          });
        }
      }
    });
    
    console.log(`Found ${storeRecipes.length} total recipes for this store\n`);
    
    if (brokenRecipes.length === 0) {
      console.log('✅ All recipes are valid! No broken recipes found.\n');
    } else {
      console.log(`❌ Found ${brokenRecipes.length} BROKEN recipes:\n`);
      
      brokenRecipes.forEach((recipe, idx) => {
        console.log(`${idx + 1}. "${recipe.name}"`);
        console.log(`   ID: ${recipe.id}`);
        console.log(`   Issues:`);
        recipe.issues.forEach(issue => {
          console.log(`     - ${issue}`);
        });
        console.log();
      });
    }
    
  } catch (error) {
    console.error('\nError:', error.message);
  }
  
  process.exit(0);
}

checkClientRecipes();
