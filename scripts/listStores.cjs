// List all stores in the database
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

async function listStores() {
  console.log('\n=== ALL STORES IN DATABASE ===\n');
  
  try {
    const storesRef = collection(db, 'storeProfiles');
    const storesSnapshot = await getDocs(storesRef);
    
    console.log(`Found ${storesSnapshot.size} stores:\n`);
    
    storesSnapshot.forEach(doc => {
      const store = doc.data();
      console.log(`Store ID: ${doc.id}`);
      console.log(`  All fields:`, JSON.stringify(store, null, 2));
      console.log();
    });
    
  } catch (error) {
    console.error('Error listing stores:', error);
  }
  
  process.exit(0);
}

listStores();
