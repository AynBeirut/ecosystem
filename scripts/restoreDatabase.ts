/**
 * Database Restore Script
 * 
 * Restores collections from backup JSON files
 * USE WITH EXTREME CAUTION - This will overwrite existing data!
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function confirmAction(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function restoreCollection(
  collectionName: string,
  backupData: any[],
  storeId: string,
  clearExisting: boolean
) {
  console.log(`\n📦 Restoring ${collectionName}...`);
  
  if (clearExisting) {
    console.log(`  🗑️  Clearing existing documents...`);
    const collectionRef = collection(db, collectionName);
    const q = query(collectionRef, where('storeId', '==', storeId));
    const snapshot = await getDocs(q);
    
    for (const document of snapshot.docs) {
      await deleteDoc(doc(db, collectionName, document.id));
    }
    console.log(`  ✓ Cleared ${snapshot.size} existing documents`);
  }
  
  console.log(`  📝 Writing ${backupData.length} documents...`);
  let successCount = 0;
  let errorCount = 0;
  
  for (const document of backupData) {
    try {
      const { id, ...data } = document;
      await setDoc(doc(db, collectionName, id), data);
      successCount++;
    } catch (error) {
      console.error(`    ❌ Error restoring document ${document.id}:`, error);
      errorCount++;
    }
  }
  
  console.log(`  ✓ Restored ${successCount} documents`);
  if (errorCount > 0) {
    console.log(`  ⚠️  ${errorCount} documents failed to restore`);
  }
}

async function restoreDatabase(storeId: string, backupFolder: string, clearExisting: boolean = false) {
  try {
    const backupDir = path.join(process.cwd(), 'backups', backupFolder);
    
    if (!fs.existsSync(backupDir)) {
      throw new Error(`Backup folder not found: ${backupDir}`);
    }
    
    console.log(`\n⚠️  WARNING: Database Restore Operation`);
    console.log(`📁 Backup location: ${backupDir}`);
    console.log(`🏪 Target Store ID: ${storeId}`);
    console.log(`${clearExisting ? '🗑️  Clear Existing: YES (will delete current data)' : '📝 Clear Existing: NO (will merge/overwrite)'}`);
    
    // Read metadata
    const metadataPath = path.join(backupDir, 'backup-metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      console.log(`\n📊 Backup Info:`);
      console.log(`   Date: ${new Date(metadata.timestamp).toLocaleString()}`);
      console.log(`   Total Documents: ${metadata.totalDocuments}`);
      console.log(`   Collections: ${Object.keys(metadata.collections).length}`);
    }
    
    const confirmed = await confirmAction('\n⚠️  This operation will modify your database. Continue?');
    if (!confirmed) {
      console.log('\n❌ Restore cancelled by user');
      return;
    }
    
    console.log('\n🔄 Starting database restore...');
    
    // Read and restore each collection
    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.json') && file !== 'backup-metadata.json');
    
    for (const file of files) {
      const collectionName = file.replace('.json', '');
      const filePath = path.join(backupDir, file);
      
      try {
        const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        await restoreCollection(collectionName, backupData, storeId, clearExisting);
      } catch (error) {
        console.error(`\n❌ Error restoring ${collectionName}:`, error);
      }
    }
    
    console.log('\n✅ Restore completed!');
    console.log('\n⚠️  IMPORTANT: Please verify data integrity:');
    console.log('   1. Check critical collections in Firebase console');
    console.log('   2. Run integrity check: npx ts-node scripts/auditAccountData.ts <storeId>');
    console.log('   3. Test key operations in application');
    
  } catch (error) {
    console.error('\n❌ Restore failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const storeId = process.argv[2];
  const backupFolder = process.argv[3];
  const clearExisting = process.argv[4] === '--clear';
  
  if (!storeId || !backupFolder) {
    console.error('❌ Error: Missing required arguments');
    console.log('\nUsage: npx ts-node scripts/restoreDatabase.ts <storeId> <backupFolder> [--clear]');
    console.log('\nExample: npx ts-node scripts/restoreDatabase.ts ABC123 backup-ABC123-2026-02-17');
    console.log('\nOptions:');
    console.log('  --clear    Clear existing documents before restore (DANGEROUS)');
    process.exit(1);
  }
  
  try {
    await restoreDatabase(storeId, backupFolder, clearExisting);
    process.exit(0);
  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { restoreDatabase };
