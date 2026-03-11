// Find user by email and their recipes
const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');
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

async function findUserAndRecipes(userEmail) {
  console.log(`\n=== SEARCHING FOR: ${userEmail} ===\n`);
  
  try {
    // Check users collection
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    let targetUserId = null;
    
    console.log(`Checking ${usersSnapshot.size} users...\n`);
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.email === userEmail) {
        targetUserId = doc.id;
        console.log(`✅ Found user:`);
        console.log(`  User ID: ${doc.id}`);
        console.log(`  Email: ${userData.email}`);
        console.log(`  Store ID: ${userData.storeId || doc.id}`);
        console.log(`  Account Type: ${userData.accountType || 'N/A'}\n`);
      }
    });
    
    if (!targetUserId) {
      console.log(`❌ No user found with email: ${userEmail}\n`);
      return;
    }
    
    // The storeId is usually the user's UID
    const storeId = targetUserId;
    
    // Now find recipes for this store
    const recipesRef = collection(db, 'recipes');
    const recipesQuery = query(recipesRef, where('storeId', '==', storeId));
    const recipesSnapshot = await getDocs(recipesQuery);
    
    console.log(`Found ${recipesSnapshot.size} recipes for this store\n`);
    
    // Get all raw materials to check references
    const materialsRef = collection(db, 'rawMaterials');
    const materialsSnapshot = await getDocs(materialsRef);
    const materialIds = new Set();
    materialsSnapshot.forEach(doc => materialIds.add(doc.id));
    
    const issues = [];
    const workingRecipes = [];
    
    recipesSnapshot.forEach(doc => {
      const recipe = doc.data();
      const recipeIssues = {
        id: doc.id,
        name: recipe.name,
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
      
      if (recipeIssues.problems.length > 0) {
        issues.push(recipeIssues);
      } else {
        workingRecipes.push(recipe.name);
      }
    });
    
    // Report findings
    console.log(`\n=== RECIPE STATUS ===\n`);
    console.log(`✅ Working recipes (${workingRecipes.length}):`);
    workingRecipes.forEach(name => console.log(`  - ${name}`));
    
    if (issues.length > 0) {
      console.log(`\n❌ Broken recipes (${issues.length}):\n`);
      
      issues.forEach((issue, idx) => {
        console.log(`${idx + 1}. Recipe: "${issue.name}" (ID: ${issue.id})`);
        issue.problems.forEach(problem => {
          console.log(`   - ${problem}`);
        });
        console.log();
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

const targetEmail = process.argv[2] || 'y.malek@nip-lb.com';
findUserAndRecipes(targetEmail);
