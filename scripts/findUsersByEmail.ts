/**
 * Find user by email in Firebase Auth
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Initialize Firebase Admin
try {
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8')
  );
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin');
  process.exit(1);
}

const AUTH_EMAILS = [
  'anwar.abouhassan@gmail.com',
  'info@aynbeirut.com',
  'info@emoove.co',
  'y.malek@nip-lb.com',
  'sawtonaorganization@gmail.com'
];

async function findUsers() {
  console.log('\n🔍 Looking up users in Firebase Auth...\n');
  console.log('='.repeat(80));
  
  for (const email of AUTH_EMAILS) {
    try {
      const user = await admin.auth().getUserByEmail(email);
      console.log(`\n✅ ${email}`);
      console.log(`   User ID: ${user.uid}`);
      console.log(`   Created: ${new Date(user.metadata.creationTime!).toLocaleDateString()}`);
      console.log(`   Last Sign In: ${user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleDateString() : 'Never'}`);
      
      // Check if they have a store
      const db = admin.firestore();
      const storeRef = db.collection('storeProfiles').doc(user.uid);
      const storeSnap = await storeRef.get();
      
      if (storeSnap.exists()) {
        const data = storeSnap.data();
        console.log(`   ✓ HAS STORE: ${data?.storeName || 'N/A'}`);
        console.log(`   Store Email: ${data?.email || data?.ownerEmail || 'N/A'}`);
      } else {
        console.log(`   ✗ NO STORE (needs to upgrade to admin)`);
      }
    } catch (error: any) {
      console.log(`\n❌ ${email}`);
      console.log(`   Not found in Firebase Auth`);
    }
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

findUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
