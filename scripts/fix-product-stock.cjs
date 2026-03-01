const admin = require('firebase-admin');
const serviceAccount = require('../market-flow-7b074-firebase-adminsdk-fbsvc-055ba89870.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixStock() {
  const productId = 'jBKJIUJdYQYK0qwop7Mr';
  const productRef = db.collection('products').doc(productId);
  const productSnap = await productRef.get();
  
  if (productSnap.exists) {
    const data = productSnap.data();
    console.log('\nCurrent Product:');
    console.log('Name:', data.name);
    console.log('Current Stock:', data.stock);
    console.log('In Stock:', data.inStock);
    
    // Update stock to 100
    await productRef.update({
      stock: 100,
      inStock: true
    });
    
    console.log('\n✅ Stock updated to 100');
    console.log('Product is now available for purchase!');
  } else {
    console.log('Product not found');
  }
  
  process.exit(0);
}

fixStock().catch(console.error);
