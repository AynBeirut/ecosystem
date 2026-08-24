/**
 * Migration Script: Add slugs to existing stores and products
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  query,
  where 
} from 'firebase/firestore';

// Firebase configuration from environment (no hardcoded keys)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error('Set VITE_FIREBASE_* env vars before running migrateToSlugs.js');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Slug generation function
function generateSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function checkSlugExists(slug, collectionName, excludeId) {
  const ref = collection(db, collectionName);
  const q = query(ref, where('slug', '==', slug));
  const snapshot = await getDocs(q);
  
  // Filter out the document we're updating
  const docs = snapshot.docs.filter(doc => doc.id !== excludeId);
  return docs.length > 0;
}

async function generateUniqueSlug(text, collectionName, excludeId) {
  let slug = generateSlug(text);
  let counter = 2;
  
  while (await checkSlugExists(slug, collectionName, excludeId)) {
    slug = `${generateSlug(text)}-${counter}`;
    counter++;
    if (counter > 100) {
      slug = `${generateSlug(text)}-${Date.now()}`;
      break;
    }
  }
  
  return slug;
}

async function migrateStores() {
  console.log('\n🏪 Starting store migration...\n');
  
  const result = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  try {
    const storesRef = collection(db, 'storeProfiles');
    const snapshot = await getDocs(storesRef);
    result.total = snapshot.size;

    console.log(`Found ${result.total} stores`);

    for (const docSnap of snapshot.docs) {
      const storeData = docSnap.data();
      const storeId = docSnap.id;
      const storeName = storeData.name || 'Unnamed Store';

      try {
        if (storeData.slug) {
          console.log(`⏭️  Skipping "${storeName}" - already has slug: ${storeData.slug}`);
          result.skipped++;
          continue;
        }

        const slug = await generateUniqueSlug(storeName, 'storeProfiles', storeId);
        await updateDoc(doc(db, 'storeProfiles', storeId), { slug });
        
        console.log(`✅ Updated "${storeName}" with slug: ${slug}`);
        result.updated++;
      } catch (error) {
        const errorMsg = error.message || String(error);
        console.error(`❌ Failed to update "${storeName}":`, errorMsg);
        result.errors.push({ id: storeId, name: storeName, error: errorMsg });
      }
    }

    console.log('\n📊 Store Migration Summary:');
    console.log(`   Total: ${result.total}`);
    console.log(`   Updated: ${result.updated}`);
    console.log(`   Skipped: ${result.skipped}`);
    console.log(`   Errors: ${result.errors.length}`);

  } catch (error) {
    console.error('Failed to fetch stores:', error);
  }

  return result;
}

async function migrateProducts() {
  console.log('\n📦 Starting product migration...\n');
  
  const result = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    result.total = snapshot.size;

    console.log(`Found ${result.total} products`);

    for (const docSnap of snapshot.docs) {
      const productData = docSnap.data();
      const productId = docSnap.id;
      const productName = productData.name || 'Unnamed Product';

      try {
        if (productData.slug) {
          console.log(`⏭️  Skipping "${productName}" - already has slug: ${productData.slug}`);
          result.skipped++;
          continue;
        }

        const slug = await generateUniqueSlug(productName, 'products', productId);
        await updateDoc(doc(db, 'products', productId), { slug });
        
        console.log(`✅ Updated "${productName}" with slug: ${slug}`);
        result.updated++;
      } catch (error) {
        const errorMsg = error.message || String(error);
        console.error(`❌ Failed to update "${productName}":`, errorMsg);
        result.errors.push({ id: productId, name: productName, error: errorMsg });
      }
    }

    console.log('\n📊 Product Migration Summary:');
    console.log(`   Total: ${result.total}`);
    console.log(`   Updated: ${result.updated}`);
    console.log(`   Skipped: ${result.skipped}`);
    console.log(`   Errors: ${result.errors.length}`);

  } catch (error) {
    console.error('Failed to fetch products:', error);
  }

  return result;
}

async function runMigration() {
  console.log('🚀 Starting Slug Migration\n');
  
  const startTime = Date.now();

  const storeResults = await migrateStores();
  const productResults = await migrateProducts();

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('✨ Migration Complete!');
  console.log('='.repeat(60));
  console.log(`\n⏱️  Duration: ${duration}s`);
  console.log(`\n📊 Overall Summary:`);
  console.log(`   Stores: ${storeResults.updated}/${storeResults.total} updated`);
  console.log(`   Products: ${productResults.updated}/${productResults.total} updated`);
  console.log(`   Total Errors: ${storeResults.errors.length + productResults.errors.length}`);
  
  if (storeResults.errors.length + productResults.errors.length === 0) {
    console.log('\n✅ All migrations completed successfully!');
  } else {
    console.log('\n⚠️  Some items failed to migrate. See error details above.');
  }
  
  process.exit(0);
}

runMigration().catch(error => {
  console.error('\n💥 Migration failed:', error);
  process.exit(1);
});
