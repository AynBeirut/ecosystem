/**
 * Find store for anwar.abouhassan@gmail.com and check its settings
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

const db = admin.firestore();

async function findStoreDetails() {
  try {
    console.log('\n🔍 Finding store for anwar.abouhassan@gmail.com...\n');

    // Get user ID
    const userRecord = await admin.auth().getUserByEmail('anwar.abouhassan@gmail.com');
    const userId = userRecord.uid;
    console.log(`📧 Email: anwar.abouhassan@gmail.com`);
    console.log(`🆔 User ID: ${userId}`);

    // Get storeProfile
    const storeProfileRef = db.collection('storeProfiles').doc(userId);
    const storeDoc = await storeProfileRef.get();

    if (!storeDoc.exists) {
      console.log('❌ No storeProfile found!');
      return;
    }

    const storeData = storeDoc.data();
    console.log(`\n📊 Store Profile:`);
    console.log(`   Name: ${storeData?.name || 'Not set'}`);
    console.log(`   Slug: ${storeData?.slug || 'Not set'}`);
    console.log(`   Subscription Tier: ${storeData?.subscriptionTier || 'none'}`);
    console.log(`   Custom Domain: ${storeData?.customDomain || 'none'}`);
    console.log(`   Has Imported Design: ${storeData?.hasImportedDesign || false}`);
    
    console.log(`\n🎨 Template Colors:`);
    if (storeData?.templateColors) {
      console.log(`   Primary: ${storeData.templateColors.primary || 'Not set'}`);
      console.log(`   Secondary: ${storeData.templateColors.secondary || 'Not set'}`);
      console.log(`   Accent: ${storeData.templateColors.accent || 'Not set'}`);
    } else {
      console.log(`   No template colors configured`);
    }

    console.log(`\n🔗 Store URLs:`);
    if (storeData?.slug) {
      console.log(`   https://grabio.space/store/${storeData.slug}`);
      console.log(`   https://market-flow-7b074.web.app/store/${storeData.slug}`);
    } else {
      console.log(`   https://grabio.space/store/id/${userId}`);
      console.log(`   https://market-flow-7b074.web.app/store/id/${userId}`);
    }

    console.log(`\n✅ Header should show:`);
    const isPaidTier = ['pro', 'business', 'premium'].includes(storeData?.subscriptionTier || '');
    const hasCustomDomain = !!storeData?.customDomain;
    const hasImportedDesign = !!storeData?.hasImportedDesign;
    const useWhiteLabel = isPaidTier || hasCustomDomain || hasImportedDesign;
    
    if (useWhiteLabel) {
      console.log(`   🎨 WHITE-LABEL MODE (store branding)`);
      console.log(`   Triggered by: ${isPaidTier ? 'Business tier' : ''}${hasCustomDomain ? ' + Custom domain' : ''}${hasImportedDesign ? ' + Imported design' : ''}`);
      console.log(`   Background Color: ${storeData?.templateColors?.primary || 'DEFAULT GREEN (no primary color set!)'}`);
    } else {
      console.log(`   💚 STANDARD GRABIO GREEN`);
      console.log(`   Reason: Not a paid tier and no custom domain`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

findStoreDetails();
