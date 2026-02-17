/**
 * Database Backup Script
 * 
 * Exports all critical collections to JSON files with timestamp
 * Run BEFORE making any data cleanup changes
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

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

const COLLECTIONS_TO_BACKUP = [
  'orders',
  'finishedGoodsInventory',
  'customers',
  'products',
  'recipes',
  'rawMaterials',
  'production',
  'salesReturns',
  'suppliers',
  'purchases',
  'expenses',
  'storeProfiles',
];

interface BackupMetadata {
  timestamp: string;
  storeId: string;
  collections: {
    [key: string]: {
      count: number;
      size: number;
    };
  };
  totalDocuments: number;
  totalSize: number;
}

async function backupCollection(collectionName: string, storeId: string): Promise<any[]> {
  console.log(`📦 Backing up ${collectionName}...`);
  
  const collectionRef = collection(db, collectionName);
  const q = query(collectionRef, where('storeId', '==', storeId));
  const snapshot = await getDocs(q);
  
  const documents = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
  
  console.log(`  ✓ ${documents.length} documents backed up`);
  return documents;
}

async function backupDatabase(storeId: string) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups', `backup-${storeId}-${timestamp}`);
    
    // Create backup directory
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    console.log(`\n🔄 Starting database backup for store: ${storeId}`);
    console.log(`📁 Backup location: ${backupDir}\n`);
    
    const metadata: BackupMetadata = {
      timestamp: new Date().toISOString(),
      storeId,
      collections: {},
      totalDocuments: 0,
      totalSize: 0,
    };
    
    // Backup each collection
    for (const collectionName of COLLECTIONS_TO_BACKUP) {
      try {
        const documents = await backupCollection(collectionName, storeId);
        
        // Save to file
        const filePath = path.join(backupDir, `${collectionName}.json`);
        const content = JSON.stringify(documents, null, 2);
        fs.writeFileSync(filePath, content);
        
        // Update metadata
        const fileSize = Buffer.byteLength(content, 'utf8');
        metadata.collections[collectionName] = {
          count: documents.length,
          size: fileSize,
        };
        metadata.totalDocuments += documents.length;
        metadata.totalSize += fileSize;
      } catch (error) {
        console.error(`  ❌ Error backing up ${collectionName}:`, error);
        metadata.collections[collectionName] = {
          count: 0,
          size: 0,
        };
      }
    }
    
    // Save metadata
    const metadataPath = path.join(backupDir, 'backup-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    // Create restore instructions
    const instructions = `# Database Backup - ${timestamp}

Store ID: ${storeId}
Date: ${new Date().toLocaleString()}

## Backup Summary
- Total Documents: ${metadata.totalDocuments}
- Total Size: ${(metadata.totalSize / 1024 / 1024).toFixed(2)} MB
- Collections: ${Object.keys(metadata.collections).length}

## Collections Backed Up
${Object.entries(metadata.collections)
  .map(([name, data]) => `- ${name}: ${data.count} documents (${(data.size / 1024).toFixed(2)} KB)`)
  .join('\n')}

## Restore Instructions

To restore this backup, run:
\`\`\`bash
npx ts-node scripts/restoreDatabase.ts ${storeId} ${path.basename(backupDir)}
\`\`\`

## Manual Restore
1. Stop all application access to database
2. Navigate to backup directory: ${backupDir}
3. Review each JSON file before importing
4. Use Firebase console or scripts to import data
5. Verify data integrity after restore

**WARNING: Restore will overwrite existing data. Backup current state first!**
`;
    
    const readmePath = path.join(backupDir, 'README.md');
    fs.writeFileSync(readmePath, instructions);
    
    console.log('\n✅ Backup completed successfully!');
    console.log(`\n📊 Backup Summary:`);
    console.log(`   Total Documents: ${metadata.totalDocuments}`);
    console.log(`   Total Size: ${(metadata.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Location: ${backupDir}`);
    console.log(`\n📖 See README.md in backup folder for restore instructions\n`);
    
    return backupDir;
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const storeId = process.argv[2];
  
  if (!storeId) {
    console.error('❌ Error: Please provide store ID as argument');
    console.log('Usage: npx ts-node scripts/backupDatabase.ts <storeId>');
    process.exit(1);
  }
  
  try {
    await backupDatabase(storeId);
    process.exit(0);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { backupDatabase };
