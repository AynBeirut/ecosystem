// Check finished goods products vs recipes
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

async function checkFinishedGoods() {
  console.log('\n=== NIPCO FINISHED GOODS vs RECIPES ===\n');
  
  try {
    const nipcoStoreId = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
    
    // Get recipes
    const recipesRef = collection(db, 'recipes');
    const recipesSnapshot = await getDocs(recipesRef);
    const recipesByName = {};
    recipesSnapshot.forEach(doc => {
      const recipe = doc.data();
      if (recipe.storeId === nipcoStoreId) {
        // Extract base name (remove date prefix)
        const baseName = recipe.name.replace(/^\d+\w+\d+\s+/, '');
        recipesByName[baseName] = {
          id: doc.id,
          name: recipe.name,
          totalCost: recipe.totalCost || 0,
          costPerUnit: recipe.costPerUnit || 0
        };
      }
    });
    
    // Get finished goods from finishedGoodsInventory collection
    const finishedGoodsRef = collection(db, 'finishedGoodsInventory');
    const finishedGoodsSnapshot = await getDocs(finishedGoodsRef);
    
    console.log('Checking Nipco finished goods against recipes:\n');
    console.log('='.repeat(80) + '\n');
    
    let foundIssue = false;
    
    finishedGoodsSnapshot.forEach(doc => {
      const fg = doc.data();
      if (fg.storeId === nipcoStoreId) {
        const productName = fg.productName;
        const productCost = fg.costPrice || 0;
        
        // Try to find matching recipe (remove date prefix from recipe name)
        const recipe = recipesByName[productName];
        
        console.log(`Finished Good: "${productName}"`);
        console.log(`  ID: ${doc.id}`);
        console.log(`  Item Code: ${fg.itemCode || 'N/A'}`);
        console.log(`  Current Stock: ${fg.currentStock || 0}`);
        console.log(`  Cost Price: $${productCost}`);
        
        if (recipe) {
          console.log(`  Recipe Found: "${recipe.name}"`);
          console.log(`  Recipe Cost: $${recipe.costPerUnit}`);
          
          if (Math.abs(productCost - recipe.costPerUnit) > 0.01) {
            console.log(`\n  ❌ MISMATCH! FG cost ($${productCost}) != Recipe cost ($${recipe.costPerUnit})`);
            console.log(`  💡 FIX NEEDED: Update finishedGood costPrice to $${recipe.costPerUnit}`);
            console.log(`  📝 Document ID: ${doc.id}\n`);
            foundIssue = true;
          } else {
            console.log(`  ✅ Costs match!\n`);
          }
        } else {
          console.log(`  ⚠️  No matching recipe found`);
          console.log(`  Available recipes:`, Object.keys(recipesByName).join(', '));
          console.log();
        }
        
        console.log('='.repeat(80) + '\n');
      }
    });
    
    if (foundIssue) {
      console.log('\n💡 SOLUTION:');
      console.log('The product records have outdated costs.');
      console.log('Need to sync product costs with recipe costs.');
      console.log('I can create a fix script to update the products.\n');
    }
    
  } catch (error) {
    console.error('\nError:', error.message);
    console.error(error);
  }
  
  process.exit(0);
}

checkFinishedGoods();
