// Check the actual finishedGood document for 3Kg product
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

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

async function checkFinishedGoodDocument() {
  console.log('\n=== CHECKING "All Care 2 Ply Facial 3Kg" DOCUMENT ===\n');
  
  try {
    const fgDocId = 'AUMG5bjCZJ5FUxQhhpEt';
    
    const fgDocRef = doc(db, 'finishedGoodsInventory', fgDocId);
    const fgSnap = await getDoc(fgDocRef);
    
    if (!fgSnap.exists()) {
      console.log('❌ Document not found!');
      process.exit(1);
    }
    
    const fgData = fgSnap.data();
    
    console.log('Document Data:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(fgData, null, 2));
    console.log('='.repeat(80));
    
    console.log('\n📋 KEY FIELDS:\n');
    console.log(`Product Name: "${fgData.productName}"`);
    console.log(`Recipe ID: ${fgData.recipeId || '❌ MISSING'}`);
    console.log(`Cost Price: $${fgData.costPrice || 0}`);
    console.log(`Current Stock: ${fgData.currentBalance || fgData.currentStock || 0}`);
    
    if (!fgData.recipeId) {
      console.log('\n❌ PROBLEM FOUND: No recipeId field!');
      console.log('This is why the recalculate button doesn\'t work.');
      console.log('\nNeed to link this finished good to its recipe.\n');
      
      // Try to find matching recipe
      const { collection, getDocs, query, where } = require('firebase/firestore');
      const recipesRef = collection(db, 'recipes');
      const q = query(recipesRef, where('storeId', '==', fgData.storeId));
      const recipesSnap = await getDocs(q);
      
      console.log('\nSearching for matching recipe...\n');
      
      recipesSnap.forEach(recipeDoc => {
        const recipe = recipeDoc.data();
        const recipeName = recipe.name;
        const productName = fgData.productName;
        
        // Remove date prefix from recipe name for comparison
        const recipeBaseName = recipeName.replace(/^\d+\w+\d+\s+/, '');
        
        console.log(`Recipe: "${recipeName}"`);
        console.log(`  Base name: "${recipeBaseName}"`);
        console.log(`  Product: "${productName}"`);
        console.log(`  Match: ${recipeBaseName === productName ? '✅ YES' : '❌ NO'}`);
        
        if (recipeBaseName === productName) {
          console.log(`\n  ✅ FOUND MATCHING RECIPE!`);
          console.log(`  Recipe ID: ${recipeDoc.id}`);
          console.log(`  Recipe Cost: $${recipe.costPerUnit || 0}`);
          console.log(`\n  💡 FIX: Set finishedGood.recipeId = "${recipeDoc.id}"\n`);
        }
        console.log();
      });
    } else {
      console.log('\n✅ Has recipeId field');
      console.log('Checking if recipe exists...\n');
      
      const recipeRef = doc(db, 'recipes', fgData.recipeId);
      const recipeSnap = await getDoc(recipeRef);
      
      if (!recipeSnap.exists()) {
        console.log(`❌ Recipe ID ${fgData.recipeId} does NOT exist!`);
        console.log('The recipeId points to a deleted recipe.\n');
      } else {
        const recipe = recipeSnap.data();
        console.log(`✅ Recipe exists: "${recipe.name}"`);
        console.log(`   Recipe Cost: $${recipe.costPerUnit || 0}`);
        console.log(`   Recipe Total Cost: $${recipe.totalCost || 0}`);
        console.log(`   Output: ${recipe.outputQuantity} ${recipe.outputUnit}`);
        
        if ((recipe.costPerUnit || 0) === 0) {
          console.log('\n❌ RECIPE HAS ZERO COST!');
          console.log('The recipe itself has no cost calculated.');
        }
      }
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  }
  
  process.exit(0);
}

checkFinishedGoodDocument();
