import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2/scheduler';
import { sendExpiringReminderEmail, sendGracePeriodEmail } from '../services/emailService';

const db = admin.firestore();

interface ServiceSubscriptionRecord {
  id?: string;
  serviceId?: string;
  serviceName?: string;
  customerId?: string;
  customerName?: string;
  storeId?: string;
  paymentType?: 'monthly' | 'yearly';
  price?: number;
  nextBillingDate?: string;
  renewalReminderDays?: number;
  status?: string;
  lastReminderForBillingDate?: string;
  lastChargeForBillingDate?: string;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function nextServiceBillingDate(fromDate: Date, billingType: 'monthly' | 'yearly'): string {
  const next = new Date(fromDate);
  if (billingType === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next.toISOString();
}

async function processServiceRenewals(now: Date): Promise<{ reminders: number; charges: number }> {
  const subscriptionsRef = db.collection('serviceSubscriptions');
  const activeSubscriptions = await subscriptionsRef.where('status', '==', 'active').get();

  let reminderCount = 0;
  let chargeCount = 0;

  for (const subscriptionDoc of activeSubscriptions.docs) {
    const subscription = { id: subscriptionDoc.id, ...(subscriptionDoc.data() as ServiceSubscriptionRecord) };
    const nextBillingDate = asDate(subscription.nextBillingDate);
    const paymentType = subscription.paymentType;

    if (!nextBillingDate || (paymentType !== 'monthly' && paymentType !== 'yearly')) {
      continue;
    }

    const msUntilBilling = nextBillingDate.getTime() - now.getTime();
    const daysUntilBilling = Math.ceil(msUntilBilling / (24 * 60 * 60 * 1000));
    const reminderDays = Math.max(1, Number(subscription.renewalReminderDays || (paymentType === 'monthly' ? 7 : 30)));
    const billingKey = nextBillingDate.toISOString();

    if (daysUntilBilling > 0 && daysUntilBilling <= reminderDays && subscription.lastReminderForBillingDate !== billingKey) {
      await db.collection('serviceRenewalReminders').add({
        subscriptionId: subscriptionDoc.id,
        storeId: subscription.storeId || '',
        customerId: subscription.customerId || '',
        customerName: subscription.customerName || '',
        serviceId: subscription.serviceId || '',
        serviceName: subscription.serviceName || 'Service',
        nextBillingDate: billingKey,
        daysUntilBilling,
        amount: Number(subscription.price || 0),
        status: 'queued',
        createdAt: now.toISOString(),
      });

      await subscriptionDoc.ref.update({
        lastReminderForBillingDate: billingKey,
        lastReminderSentAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      reminderCount += 1;
    }

    if (daysUntilBilling <= 0 && subscription.lastChargeForBillingDate !== billingKey) {
      const chargeId = `${subscriptionDoc.id}_${billingKey.slice(0, 10)}`;
      const chargeRef = db.collection('serviceRenewalCharges').doc(chargeId);

      await chargeRef.set(
        {
          subscriptionId: subscriptionDoc.id,
          storeId: subscription.storeId || '',
          customerId: subscription.customerId || '',
          customerName: subscription.customerName || '',
          serviceId: subscription.serviceId || '',
          serviceName: subscription.serviceName || 'Service',
          paymentType,
          amount: Number(subscription.price || 0),
          dueDate: billingKey,
          status: 'pending',
          nextCycleDate: nextServiceBillingDate(nextBillingDate, paymentType),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        { merge: true }
      );

      await subscriptionDoc.ref.update({
        status: 'payment_due',
        billingStatus: 'payment_due',
        paymentDueSince: now.toISOString(),
        lastChargeForBillingDate: billingKey,
        updatedAt: now.toISOString(),
      });

      chargeCount += 1;
    }
  }

  return { reminders: reminderCount, charges: chargeCount };
}

/**
 * Check subscriptions daily at 9 AM UTC
 * Scheduled to run every day at 09:00
 */
export const checkSubscriptions = functions.onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'UTC',
    memory: '256MiB'
  },
  async (event) => {
    console.log('🔍 Starting subscription check...');
    
    try {
      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      
      const storesRef = db.collection('storeProfiles');
      const allStores = await storesRef.get();
      
      let expiringReminders = 0;
      let gracePeriodWarnings = 0;
      let expiredBlocked = 0;
      let dataDeleted = 0;

      const serviceRenewalSummary = await processServiceRenewals(now);
      
      for (const storeDoc of allStores.docs) {
        const store = storeDoc.data();
        const storeId = storeDoc.id;
        
        // Skip legacy users and cancelled subscriptions
        if (store.isLegacyUser || store.subscriptionStatus === 'cancelled') {
          continue;
        }
        
        const expiresAt = store.subscriptionEndsAt ? new Date(store.subscriptionEndsAt) : null;
        
        if (!expiresAt) continue;
        
        // Check if subscription expires in 30 days (for legacy users expiring Feb 2027)
        if (expiresAt <= in30Days && expiresAt > in7Days && !store.reminder30DaysSent) {
          await sendExpiringReminderEmail(store.email || '', 30, store.subscriptionTier || 'starter');
          await storesRef.doc(storeId).update({
            reminder30DaysSent: true,
            updatedAt: new Date().toISOString()
          });
          expiringReminders++;
          console.log(`📧 30-day reminder sent to ${storeId}`);
        }
        
        // Check if subscription expires in 7 days
        if (expiresAt <= in7Days && expiresAt > in3Days && !store.reminder7DaysSent) {
          await sendExpiringReminderEmail(store.email || '', 7, store.subscriptionTier || 'starter');
          await storesRef.doc(storeId).update({
            reminder7DaysSent: true,
            updatedAt: new Date().toISOString()
          });
          expiringReminders++;
          console.log(`📧 7-day reminder sent to ${storeId}`);
        }
        
        // Check if subscription expires in 3 days
        if (expiresAt <= in3Days && expiresAt > now && !store.reminder3DaysSent) {
          await sendExpiringReminderEmail(store.email || '', 3, store.subscriptionTier || 'starter');
          await storesRef.doc(storeId).update({
            reminder3DaysSent: true,
            updatedAt: new Date().toISOString()
          });
          expiringReminders++;
          console.log(`📧 3-day reminder sent to ${storeId}`);
        }
        
        // Check if subscription has expired (start grace period)
        if (expiresAt <= now && store.subscriptionStatus === 'active') {
          const graceEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          
          await storesRef.doc(storeId).update({
            subscriptionStatus: 'grace_period',
            graceStartedAt: now.toISOString(),
            graceEndsAt: graceEndsAt.toISOString(),
            updatedAt: new Date().toISOString()
          });
          
          await sendGracePeriodEmail(store.email || '', 7);
          gracePeriodWarnings++;
          console.log(`⚠️ Grace period started for ${storeId}`);
        }
        
        // Check grace period (send daily reminders)
        if (store.subscriptionStatus === 'grace_period' && store.graceEndsAt) {
          const graceEnds = new Date(store.graceEndsAt);
          const daysRemaining = Math.ceil((graceEnds.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          
          if (daysRemaining > 0) {
            await sendGracePeriodEmail(store.email || '', daysRemaining);
            gracePeriodWarnings++;
            console.log(`⚠️ Grace period reminder sent to ${storeId} (${daysRemaining} days left)`);
          } else {
            // Grace period ended - block account
            const dataDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            
            await storesRef.doc(storeId).update({
              subscriptionStatus: 'blocked',
              blockedAt: now.toISOString(),
              dataWillDeleteAt: dataDeleteAt.toISOString(),
              updatedAt: new Date().toISOString()
            });
            
            expiredBlocked++;
            console.log(`🚫 Account blocked: ${storeId}`);
          }
        }
        
        // Check if data should be deleted (30 days after block)
        if (store.subscriptionStatus === 'blocked' && store.dataWillDeleteAt) {
          const deleteAt = new Date(store.dataWillDeleteAt);
          
          if (deleteAt <= now) {
            // Delete store data
            await deleteStoreData(storeId);
            dataDeleted++;
            console.log(`🗑️ Data deleted for ${storeId}`);
          }
        }
      }
      
      console.log('\n📊 Subscription Check Summary:');
      console.log(`   Expiring reminders sent: ${expiringReminders}`);
      console.log(`   Grace period warnings: ${gracePeriodWarnings}`);
      console.log(`   Accounts blocked: ${expiredBlocked}`);
      console.log(`   Data deleted: ${dataDeleted}`);
      console.log(`   Service renewal reminders queued: ${serviceRenewalSummary.reminders}`);
      console.log(`   Service renewal charges created: ${serviceRenewalSummary.charges}`);
      console.log('✅ Subscription check complete\n');
      
    } catch (error) {
      console.error('❌ Subscription check error:', error);
      throw error;
    }
  }
);

/**
 * Delete store data after 30 days of being blocked
 */
async function deleteStoreData(storeId: string) {
  const batch = db.batch();
  
  try {
    // Collections to delete
    const collections = [
      'composedProducts',
      'finishedGoods',
      'orders',
      'rawMaterials',
      'recipes',
      'customers',
      'subAccounts',
      'auditLogs'
    ];
    
    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName)
        .where('storeId', '==', storeId)
        .get();
      
      snapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
    }
    
    // Mark store profile as deleted (don't delete it completely for record keeping)
    const storeRef = db.collection('storeProfiles').doc(storeId);
    batch.update(storeRef, {
      subscriptionStatus: 'deleted',
      dataDeletedAt: new Date().toISOString(),
      deletedReason: 'Subscription expired and not renewed within grace period + 30 days',
      updatedAt: new Date().toISOString()
    });
    
    await batch.commit();
    
    console.log(`Data successfully deleted for store: ${storeId}`);
  } catch (error) {
    console.error(`Error deleting data for store ${storeId}:`, error);
    throw error;
  }
}
