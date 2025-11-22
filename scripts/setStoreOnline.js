// This script will update your Firestore store profile to set status: 'online' for your store.
// Run this script in a Node.js environment with Firebase Admin SDK configured.

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

async function setStoreOnline(userId) {
  const ref = db.collection('storeProfiles').doc(userId);
  await ref.update({ status: 'online' });
  console.log(`Store for user ${userId} set to online.`);
}

// Replace with your actual user ID
setStoreOnline('YOUR_USER_ID_HERE').catch(console.error);
