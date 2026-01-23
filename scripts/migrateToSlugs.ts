/**
 * Migration Script: Add slugs to existing stores and products
 * 
 * This script:
 * 1. Fetches all stores without slugs
 * 2. Generates unique slugs for each store
 * 3. Updates store documents with slugs
 * 4. Fetches all products without slugs
 * 5. Generates unique slugs for each product
 * 6. Updates product documents with slugs
 * 
 * Usage:
 * npx ts-node scripts/migrateToSlugs.ts
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
import { generateUniqueSlug } from '../src/lib/slugify';

// Firebase configuration - replace with your config
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface MigrationResult {
  total: number;
  updated: number;
  skipped: number;
  errors: Array<{ id: string; name: string; error: string }>;
}

async function migrateStores(): Promise<MigrationResult> {
  console.log('\n🏪 Starting store migration...\n');
  
  const result: MigrationResult = {
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
        // Skip if store already has a slug
        if (storeData.slug) {
          console.log(`⏭️  Skipping "${storeName}" - already has slug: ${storeData.slug}`);
          result.skipped++;
          continue;
        }

        // Generate unique slug
        const slug = await generateUniqueSlug(storeName, 'storeProfiles', storeId);
        
        // Update store document
        await updateDoc(doc(db, 'storeProfiles', storeId), { slug });
        
        console.log(`✅ Updated "${storeName}" with slug: ${slug}`);
        result.updated++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to update "${storeName}":`, errorMsg);
        result.errors.push({ id: storeId, name: storeName, error: errorMsg });
      }
    }

    console.log('\n📊 Store Migration Summary:');
    console.log(`   Total: ${result.total}`);
    console.log(`   Updated: ${result.updated}`);
    console.log(`   Skipped: ${result.skipped}`);
    console.log(`   Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(err => {
        console.log(`   - ${err.name} (${err.id}): ${err.error}`);
      });
    }

  } catch (error) {
    console.error('Failed to fetch stores:', error);
  }

  return result;
}

async function migrateProducts(): Promise<MigrationResult> {
  console.log('\n📦 Starting product migration...\n');
  
  const result: MigrationResult = {
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
        // Skip if product already has a slug
        if (productData.slug) {
          console.log(`⏭️  Skipping "${productName}" - already has slug: ${productData.slug}`);
          result.skipped++;
          continue;
        }

        // Generate unique slug
        const slug = await generateUniqueSlug(productName, 'products', productId);
        
        // Update product document
        await updateDoc(doc(db, 'products', productId), { slug });
        
        console.log(`✅ Updated "${productName}" with slug: ${slug}`);
        result.updated++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to update "${productName}":`, errorMsg);
        result.errors.push({ id: productId, name: productName, error: errorMsg });
      }
    }

    console.log('\n📊 Product Migration Summary:');
    console.log(`   Total: ${result.total}`);
    console.log(`   Updated: ${result.updated}`);
    console.log(`   Skipped: ${result.skipped}`);
    console.log(`   Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(err => {
        console.log(`   - ${err.name} (${err.id}): ${err.error}`);
      });
    }

  } catch (error) {
    console.error('Failed to fetch products:', error);
  }

  return result;
}

async function runMigration() {
  console.log('🚀 Starting Slug Migration\n');
  console.log('This script will add slugs to stores and products that don\'t have them yet.\n');
  
  const startTime = Date.now();

  // Migrate stores first
  const storeResults = await migrateStores();

  // Then migrate products
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

// Run the migration
runMigration().catch(error => {
  console.error('\n💥 Migration failed:', error);
  process.exit(1);
});
