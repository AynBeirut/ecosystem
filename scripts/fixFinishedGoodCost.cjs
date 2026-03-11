// Fix "All Care 2 Ply Facial 3Kg" cost price
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc } = require('firebase/firestore');

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

async function fixCost() {
  console.log('\n=== FIXING COST FOR "All Care 2 Ply Facial 3Kg" ===\n');
  
  try {
    const docId = 'AUMG5bjCZJ5FUxQhhpEt';
    const correctCost = 5.21737;
    
    const finishedGoodRef = doc(db, 'finishedGoodsInventory', docId);
    
    console.log(`Updating document: ${docId}`);
    console.log(`Setting costPrice to: $${correctCost}`);
    
    await updateDoc(finishedGoodRef, {
      costPrice: correctCost,
      updatedAt: new Date().toISOString()
    });
    
    console.log('\n✅ SUCCESS! Cost updated to $5.22');
    console.log('\nThe finished good "All Care 2 Ply Facial 3Kg" now shows the correct cost.');
    console.log('Refresh the Finished Goods Inventory page to see the update.\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  }
  
  process.exit(0);
}

fixCost();
