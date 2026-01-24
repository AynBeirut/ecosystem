// Quick script to manually update ON-008 to "returned" status
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBLhjaKje1LkGgayWfAkSx0xWlCg2r7g5E",
  authDomain: "market-flow-7b074.firebaseapp.com",
  projectId: "market-flow-7b074",
  storageBucket: "market-flow-7b074.firebasestorage.app",
  messagingSenderId: "677781279031",
  appId: "1:677781279031:web:8f90b57c71a8b93d1e0ce8",
  measurementId: "G-G31QFQS64M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixOrderStatus() {
  try {
    // Find ON-008
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('invoiceNumber', '==', 'ON-008'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('ON-008 not found');
      return;
    }
    
    const orderDoc = snapshot.docs[0];
    const orderData = orderDoc.data();
    
    console.log('Found ON-008:', orderDoc.id);
    console.log('Current status:', orderData.status);
    console.log('Current amountPaid:', orderData.amountPaid);
    
    // Update to returned status with refund in payment history
    const refundPayment = {
      amount: -4.15,
      method: 'return',
      date: new Date().toISOString(),
      notes: 'Sales Return SRET-001',
      recordedBy: 'System Fix',
    };
    
    const updatedPaymentHistory = [...(orderData.paymentHistory || []), refundPayment];
    
    await updateDoc(doc(db, 'orders', orderDoc.id), {
      status: 'returned',
      amountPaid: 0,
      paymentStatus: 'unpaid',
      paymentHistory: updatedPaymentHistory,
      updatedAt: new Date().toISOString(),
    });
    
    console.log('✓ ON-008 updated to "returned" status');
    console.log('✓ Amount paid set to $0.00');
    console.log('✓ Payment status set to "unpaid"');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixOrderStatus();
