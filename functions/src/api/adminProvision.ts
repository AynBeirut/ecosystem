import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { PACKAGE_PRESETS } from '../lib/moduleManifest';
import { modulesRecordFromList } from '../lib/moduleManifest';

const db = admin.firestore();
const PRESET = 'pkg_live_kitchen';
const LIVE_KITCHEN_MODULES = PACKAGE_PRESETS[PRESET].defaultModules;

function assertAdminSecret(req: Request): boolean {
  const expected = String(process.env.ADMIN_PROVISION_SECRET || '').trim();
  if (!expected) return false;
  const provided = String(req.get('x-admin-secret') || req.body?.secret || '').trim();
  return provided.length > 0 && provided === expected;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'store';
}

export async function provisionLiveKitchen(req: Request, res: Response): Promise<void> {
  try {
    if (!assertAdminSecret(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    const user = await admin.auth().getUserByEmail(email);
    const userId = user.uid;
    const now = new Date().toISOString();
    const endsAt = new Date();
    endsAt.setFullYear(endsAt.getFullYear() + 1);

    const profileRef = db.collection('storeProfiles').doc(userId);
    const sellerRef = db.collection('sellers').doc(userId);
    const usersRef = db.collection('users').doc(userId);
    const [profileSnap, sellerSnap] = await Promise.all([profileRef.get(), sellerRef.get()]);

    const existing = profileSnap.data() || {};
    const storeName =
      String(existing.storeName || user.displayName || email.split('@')[0] || 'My Store').trim();
    const storeSlug = String(existing.storeSlug || slugify(storeName)).trim();

    const patch = {
      email,
      ownerEmail: email,
      storeName,
      storeSlug,
      status: existing.status || 'online',
      pricingVersion: 'modular-v2',
      startingPackage: PRESET,
      businessWorkflow: 'live_kitchen',
      enabledModules: modulesRecordFromList(LIVE_KITCHEN_MODULES),
      seatCount: 1,
      posLocationCount: 1,
      subscriptionPlan: existing.subscriptionPlan || 'yearly',
      composedProductSource: 'platform',
      subscriptionStatus: 'active',
      subscriptionTier: existing.subscriptionTier || 'starter',
      subscriptionStartedAt: existing.subscriptionStartedAt || now,
      subscriptionEndsAt: existing.subscriptionEndsAt || endsAt.toISOString(),
      nextBillingDate: existing.nextBillingDate || endsAt.toISOString(),
      allowsComposed: true,
      allowsManufacturing: false,
      migrationNotes: `Live Kitchen package provisioned via admin API for ${email}`,
      updatedAt: now,
      ...(profileSnap.exists ? {} : { createdAt: now }),
    };

    const batch = db.batch();
    batch.set(profileRef, patch, { merge: true });

    if (!sellerSnap.exists) {
      batch.set(sellerRef, {
        isSeller: true,
        sellerSince: now,
        role: 'admin',
        userId,
        storeId: userId,
        updatedAt: now,
      }, { merge: true });
    }

    batch.set(usersRef, {
      email,
      storeId: userId,
      role: 'admin',
      updatedAt: now,
    }, { merge: true });

    await batch.commit();

    res.json({
      success: true,
      email,
      userId,
      startingPackage: PRESET,
      modules: LIVE_KITCHEN_MODULES,
      createdProfile: !profileSnap.exists,
    });
  } catch (error: unknown) {
    console.error('provisionLiveKitchen error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Provisioning failed',
    });
  }
}
