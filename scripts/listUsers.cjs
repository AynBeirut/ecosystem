// List all users in the database
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

async function listUsers() {
  console.log('\n=== ALL USERS IN DATABASE ===\n');
  
  try {
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    console.log(`Found ${usersSnapshot.size} users:\n`);
    
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      console.log(`User ID: ${doc.id}`);
      console.log(`  Email: ${user.email || 'N/A'}`);
      console.log(`  Account Type: ${user.accountType || 'N/A'}`);
      console.log(`  Store ID: ${user.storeId || doc.id}`);
      console.log();
   });
    
  } catch (error) {
    console.error('Error listing users:', error);
  }
  
  process.exit(0);
}

listUsers();
