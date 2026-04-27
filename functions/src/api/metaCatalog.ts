import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { ALLOWED_META_EVENTS, trackMetaConversion } from '../services/metaConversion';

type AuthUser = { uid: string };

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function authenticateRequest(req: Request): Promise<AuthUser | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (_err) {
    return null;
  }
}

async function canAccessStore(user: AuthUser, storeId: string): Promise<boolean> {
  if (!storeId) return false;
  if (user.uid === storeId) return true;

  const db = admin.firestore();
  const [storeSnap, userSnap, sellerSnap] = await Promise.all([
    db.collection('storeProfiles').doc(storeId).get(),
    db.collection('users').doc(user.uid).get(),
    db.collection('sellers').doc(user.uid).get(),
  ]);

  if (!storeSnap.exists) return false;

  const storeData = storeSnap.data() as Record<string, unknown>;
  if (typeof storeData.ownerId === 'string' && storeData.ownerId === user.uid) return true;

  if (userSnap.exists) {
    const userData = userSnap.data() as Record<string, unknown>;
    if (typeof userData.storeId === 'string' && userData.storeId === storeId) return true;
  }

  if (sellerSnap.exists) {
    const sellerData = sellerSnap.data() as Record<string, unknown>;
    if (typeof sellerData.storeId === 'string' && sellerData.storeId === storeId) return true;
  }

  return false;
}

/**
 * GET /meta/catalog/feed?storeId=xxx
 * Public feed endpoint formatted for Meta catalog ingestion.
 */
export async function getMetaCatalogFeed(req: Request, res: Response): Promise<void> {
  try {
    const storeId = String(req.query.storeId || '').trim();
    if (!storeId) {
      res.status(400).json({ error: 'Missing required query param: storeId' });
      return;
    }

    const db = admin.firestore();
    const [storeSnap, productsSnap] = await Promise.all([
      db.collection('storeProfiles').doc(storeId).get(),
      db.collection('products').where('storeId', '==', storeId).get(),
    ]);

    if (!storeSnap.exists) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const storeData = storeSnap.data() as Record<string, unknown>;
    const storeSlug = String(storeData.slug || storeId).trim();
    const storeName = String(storeData.name || 'Store').trim();
    const currency = String(storeData.mainCurrency || 'USD').trim();

    const items = productsSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data() as Record<string, unknown>;
      const productSlug = String(data.slug || doc.id).trim();
      const price = Number(data.price || 0);
      const inStock = Boolean(data.inStock);
      return {
        id: doc.id,
        title: String(data.name || '').trim(),
        description: String(data.description || '').trim(),
        availability: inStock ? 'in stock' : 'out of stock',
        condition: 'new',
        price: `${Number.isFinite(price) ? price.toFixed(2) : '0.00'} ${currency}`,
        link: `https://grabio.space/${storeSlug}/product/${productSlug}`,
        image_link: String(data.image || '').trim(),
        brand: storeName,
        google_product_category: String(data.category || '').trim(),
      };
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json({
      generatedAt: new Date().toISOString(),
      storeId,
      count: items.length,
      items,
    });
  } catch (err) {
    console.error('Meta catalog feed error:', err);
    res.status(500).json({ error: 'Failed to generate Meta catalog feed' });
  }
}

/**
 * POST /meta/catalog/sync
 * Body: { storeId }
 * Validates settings and records a sync job with latest catalog metadata.
 */
export async function syncMetaCatalog(req: Request, res: Response): Promise<void> {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      return;
    }

    const storeId = String(req.body?.storeId || '').trim();
    if (!storeId) {
      res.status(400).json({ error: 'Missing required field: storeId' });
      return;
    }

    const hasAccess = await canAccessStore(user, storeId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden: no access to this store' });
      return;
    }

    const db = admin.firestore();
    const [storeSnap, productsSnap] = await Promise.all([
      db.collection('storeProfiles').doc(storeId).get(),
      db.collection('products').where('storeId', '==', storeId).get(),
    ]);

    if (!storeSnap.exists) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const storeData = storeSnap.data() as Record<string, unknown>;
    const metaIntegrationSettings = (storeData.metaIntegrationSettings || {}) as Record<string, unknown>;
    const catalogId = String(metaIntegrationSettings.catalogId || '').trim();
    const facebookPageUrl = String(metaIntegrationSettings.facebookPageUrl || '').trim();

    if (!catalogId) {
      res.status(400).json({ error: 'Missing Meta catalog ID in store profile settings' });
      return;
    }

    const totalProducts = productsSnap.size;
    const validProducts = productsSnap.docs.filter((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data() as Record<string, unknown>;
      const hasName = String(data.name || '').trim().length > 0;
      const hasImage = String(data.image || '').trim().length > 0;
      const price = Number(data.price || 0);
      return hasName && hasImage && Number.isFinite(price) && price > 0;
    }).length;

    const syncedAt = new Date().toISOString();
    const feedUrl = `https://us-central1-market-flow-7b074.cloudfunctions.net/api/meta/catalog/feed?storeId=${encodeURIComponent(storeId)}`;

    const jobRef = await db.collection('metaCatalogSyncJobs').add({
      storeId,
      catalogId,
      facebookPageUrl,
      totalProducts,
      validProducts,
      status: 'completed',
      syncedAt,
      triggeredBy: user.uid,
      feedUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('storeProfiles').doc(storeId).set({
      metaIntegrationSettings: {
        lastCatalogSyncAt: syncedAt,
        lastCatalogSyncJobId: jobRef.id,
        lastCatalogProductCount: validProducts,
        catalogFeedUrl: feedUrl,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(200).json({
      ok: true,
      jobId: jobRef.id,
      syncedAt,
      feedUrl,
      summary: {
        totalProducts,
        validProducts,
        invalidProducts: totalProducts - validProducts,
      },
    });
  } catch (err) {
    console.error('Meta catalog sync error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to sync Meta catalog' });
  }
}

/**
 * POST /meta/shop/connect
 * Body: { storeId }
 * Validates Meta settings and marks Facebook Shop integration as connected.
 */
export async function connectFacebookShop(req: Request, res: Response): Promise<void> {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      return;
    }

    const storeId = String(req.body?.storeId || '').trim();
    if (!storeId) {
      res.status(400).json({ error: 'Missing required field: storeId' });
      return;
    }

    const hasAccess = await canAccessStore(user, storeId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden: no access to this store' });
      return;
    }

    const db = admin.firestore();
    const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
    if (!storeSnap.exists) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const storeData = storeSnap.data() as Record<string, unknown>;
    const metaIntegrationSettings = (storeData.metaIntegrationSettings || {}) as Record<string, unknown>;
    const catalogId = String(metaIntegrationSettings.catalogId || '').trim();
    const facebookPageUrl = String(metaIntegrationSettings.facebookPageUrl || '').trim();
    const lastCatalogSyncAt = String(metaIntegrationSettings.lastCatalogSyncAt || '').trim();

    const missingFields: string[] = [];
    if (!catalogId) missingFields.push('catalogId');
    if (!facebookPageUrl) missingFields.push('facebookPageUrl');
    if (!lastCatalogSyncAt) missingFields.push('lastCatalogSyncAt');

    if (missingFields.length > 0) {
      res.status(400).json({
        error: 'Meta Shop prerequisites are incomplete',
        missingFields,
        hint: 'Set catalog and Facebook Page in profile, then run Meta catalog sync once.',
      });
      return;
    }

    const feedUrl = String(metaIntegrationSettings.catalogFeedUrl || '').trim() ||
      `https://us-central1-market-flow-7b074.cloudfunctions.net/api/meta/catalog/feed?storeId=${encodeURIComponent(storeId)}`;
    const connectedAt = new Date().toISOString();
    const onboardingUrl = `https://business.facebook.com/commerce_manager/catalogs/${encodeURIComponent(catalogId)}`;

    const jobRef = await db.collection('metaShopConnectionJobs').add({
      storeId,
      catalogId,
      facebookPageUrl,
      feedUrl,
      status: 'connected',
      connectedAt,
      connectedBy: user.uid,
      onboardingUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('storeProfiles').doc(storeId).set({
      metaIntegrationSettings: {
        facebookShopEnabled: true,
        facebookShopStatus: 'connected',
        facebookShopConnectedAt: connectedAt,
        facebookShopLastConnectionJobId: jobRef.id,
        catalogFeedUrl: feedUrl,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(200).json({
      ok: true,
      storeId,
      jobId: jobRef.id,
      status: 'connected',
      connectedAt,
      feedUrl,
      onboardingUrl,
      summary: {
        catalogId,
        facebookPageUrl,
      },
    });
  } catch (err) {
    console.error('Facebook Shop connect error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to connect Facebook Shop' });
  }
}

/**
 * POST /meta/instagram/connect
 * Body: { storeId }
 * Validates Meta settings and marks Instagram Shopping integration as connected.
 */
export async function connectInstagramShopping(req: Request, res: Response): Promise<void> {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      return;
    }

    const storeId = String(req.body?.storeId || '').trim();
    if (!storeId) {
      res.status(400).json({ error: 'Missing required field: storeId' });
      return;
    }

    const hasAccess = await canAccessStore(user, storeId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden: no access to this store' });
      return;
    }

    const db = admin.firestore();
    const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
    if (!storeSnap.exists) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const storeData = storeSnap.data() as Record<string, unknown>;
    const metaIntegrationSettings = (storeData.metaIntegrationSettings || {}) as Record<string, unknown>;
    const catalogId = String(metaIntegrationSettings.catalogId || '').trim();
    const facebookPageUrl = String(metaIntegrationSettings.facebookPageUrl || '').trim();
    const lastCatalogSyncAt = String(metaIntegrationSettings.lastCatalogSyncAt || '').trim();

    const missingFields: string[] = [];
    if (!catalogId) missingFields.push('catalogId');
    if (!facebookPageUrl) missingFields.push('facebookPageUrl');
    if (!lastCatalogSyncAt) missingFields.push('lastCatalogSyncAt');

    if (missingFields.length > 0) {
      res.status(400).json({
        error: 'Instagram Shopping prerequisites are incomplete',
        missingFields,
        hint: 'Set catalog and Facebook Page in profile, then run Meta catalog sync once.',
      });
      return;
    }

    const feedUrl = String(metaIntegrationSettings.catalogFeedUrl || '').trim() ||
      `https://us-central1-market-flow-7b074.cloudfunctions.net/api/meta/catalog/feed?storeId=${encodeURIComponent(storeId)}`;
    const connectedAt = new Date().toISOString();
    const onboardingUrl = `https://business.facebook.com/commerce_manager/catalogs/${encodeURIComponent(catalogId)}`;

    const jobRef = await db.collection('instagramShopConnectionJobs').add({
      storeId,
      catalogId,
      facebookPageUrl,
      feedUrl,
      status: 'connected',
      connectedAt,
      connectedBy: user.uid,
      onboardingUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('storeProfiles').doc(storeId).set({
      metaIntegrationSettings: {
        instagramShoppingEnabled: true,
        instagramShoppingStatus: 'connected',
        instagramShoppingConnectedAt: connectedAt,
        instagramShoppingLastConnectionJobId: jobRef.id,
        catalogFeedUrl: feedUrl,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(200).json({
      ok: true,
      storeId,
      jobId: jobRef.id,
      status: 'connected',
      connectedAt,
      feedUrl,
      onboardingUrl,
      summary: {
        catalogId,
        facebookPageUrl,
      },
    });
  } catch (err) {
    console.error('Instagram Shopping connect error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to connect Instagram Shopping' });
  }
}

/**
 * POST /meta/conversion/track
 * Body: { storeId, eventName, eventId?, value?, currency?, contentIds?, contentName?, eventSourceUrl?, userData? }
 * Public endpoint for storefront conversion event forwarding to Meta CAPI.
 */
export async function trackMetaConversionEvent(req: Request, res: Response): Promise<void> {
  try {
    const storeId = String(req.body?.storeId || '').trim();
    const eventName = String(req.body?.eventName || '').trim();

    if (!storeId) {
      res.status(400).json({ error: 'Missing required field: storeId' });
      return;
    }

    if (!eventName || !ALLOWED_META_EVENTS.has(eventName)) {
      res.status(400).json({ error: 'Invalid or unsupported eventName' });
      return;
    }

    const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const clientIpAddress = forwardedFor || req.ip || '';
    const clientUserAgent = String(req.headers['user-agent'] || '');

    const eventId = String(req.body?.eventId || '').trim() || undefined;
    const value = Number(req.body?.value || 0);
    const currency = String(req.body?.currency || 'USD').trim() || 'USD';
    const contentIds = Array.isArray(req.body?.contentIds)
      ? (req.body.contentIds as unknown[]).map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    const contentName = String(req.body?.contentName || '').trim();
    const eventSourceUrl = String(req.body?.eventSourceUrl || req.headers.referer || '').trim() || undefined;

    const result = await trackMetaConversion({
      storeId,
      eventName,
      eventId,
      eventSourceUrl,
      source: 'client_api',
      customData: {
        ...(Number.isFinite(value) && value > 0 ? { value } : {}),
        currency,
        ...(contentIds.length > 0 ? { content_ids: contentIds, content_type: 'product' } : {}),
        ...(contentName ? { content_name: contentName } : {}),
      },
      userData: {
        email: String(req.body?.userData?.email || '').trim(),
        phone: String(req.body?.userData?.phone || '').trim(),
        externalId: String(req.body?.userData?.externalId || '').trim(),
        clientIpAddress,
        clientUserAgent,
      },
    });

    res.status(200).json({
      ok: true,
      result,
    });
  } catch (err) {
    console.error('Meta conversion tracking error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to track conversion event' });
  }
}

/**
 * POST /meta/ads/campaign/create
 * Body: { storeId, name, objective, dailyBudget, currency, promotedProductIds }
 * Creates a Meta Ads campaign job record and updates store meta ads state.
 */
export async function createMetaAdsCampaign(req: Request, res: Response): Promise<void> {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      return;
    }

    const storeId = String(req.body?.storeId || '').trim();
    if (!storeId) {
      res.status(400).json({ error: 'Missing required field: storeId' });
      return;
    }

    const hasAccess = await canAccessStore(user, storeId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden: no access to this store' });
      return;
    }

    const db = admin.firestore();
    const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
    if (!storeSnap.exists) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const storeData = storeSnap.data() as Record<string, unknown>;
    const metaIntegrationSettings = (storeData.metaIntegrationSettings || {}) as Record<string, unknown>;

    const adAccountId = String(metaIntegrationSettings.adAccountId || '').trim();
    const catalogId = String(metaIntegrationSettings.catalogId || '').trim();
    const pixelId = String(metaIntegrationSettings.pixelId || '').trim();
    const lastCatalogSyncAt = String(metaIntegrationSettings.lastCatalogSyncAt || '').trim();

    const missingFields: string[] = [];
    if (!adAccountId) missingFields.push('adAccountId');
    if (!catalogId) missingFields.push('catalogId');
    if (!pixelId) missingFields.push('pixelId');
    if (!lastCatalogSyncAt) missingFields.push('lastCatalogSyncAt');

    if (missingFields.length > 0) {
      res.status(400).json({
        error: 'Meta Ads prerequisites are incomplete',
        missingFields,
        hint: 'Set ad account, pixel, and catalog in profile, then run catalog sync once.',
      });
      return;
    }

    const name = String(req.body?.name || 'Meta Product Campaign').trim();
    const objective = String(req.body?.objective || 'SALES').trim();
    const dailyBudgetRaw = Number(req.body?.dailyBudget || 0);
    const dailyBudget = Number.isFinite(dailyBudgetRaw) && dailyBudgetRaw > 0 ? dailyBudgetRaw : 20;
    const currency = String(req.body?.currency || 'USD').trim() || 'USD';
    const promotedProductIds = Array.isArray(req.body?.promotedProductIds)
      ? (req.body.promotedProductIds as unknown[]).map((value) => String(value || '').trim()).filter(Boolean)
      : [];

    const createdAt = new Date().toISOString();
    const adsManagerUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(adAccountId)}`;

    const campaignRef = await db.collection('metaAdsCampaignJobs').add({
      storeId,
      adAccountId,
      catalogId,
      pixelId,
      name,
      objective,
      dailyBudget,
      currency,
      promotedProductIds,
      promotedProductCount: promotedProductIds.length,
      status: 'draft_created',
      createdAt,
      createdBy: user.uid,
      adsManagerUrl,
      notes: 'Campaign flow created in Grabio. Final launch/config happens in Meta Ads Manager.',
      serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('storeProfiles').doc(storeId).set({
      metaIntegrationSettings: {
        metaAdsEnabled: true,
        lastMetaAdsCampaignId: campaignRef.id,
        lastMetaAdsCampaignName: name,
        lastMetaAdsCampaignAt: createdAt,
        lastMetaAdsCampaignStatus: 'draft_created',
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(200).json({
      ok: true,
      campaignId: campaignRef.id,
      status: 'draft_created',
      createdAt,
      adsManagerUrl,
      summary: {
        name,
        objective,
        dailyBudget,
        currency,
        promotedProductCount: promotedProductIds.length,
      },
    });
  } catch (err) {
    console.error('Meta ads campaign creation error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create Meta Ads campaign' });
  }
}

/**
 * POST /meta/ads/dynamic/enable
 * Body: { storeId, audienceName, retargetingWindowDays, minimumEventCount }
 * Enables dynamic product ads support and stores retargeting configuration.
 */
export async function enableDynamicProductAds(req: Request, res: Response): Promise<void> {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      return;
    }

    const storeId = String(req.body?.storeId || '').trim();
    if (!storeId) {
      res.status(400).json({ error: 'Missing required field: storeId' });
      return;
    }

    const hasAccess = await canAccessStore(user, storeId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden: no access to this store' });
      return;
    }

    const db = admin.firestore();
    const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
    if (!storeSnap.exists) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const storeData = storeSnap.data() as Record<string, unknown>;
    const metaIntegrationSettings = (storeData.metaIntegrationSettings || {}) as Record<string, unknown>;

    const adAccountId = String(metaIntegrationSettings.adAccountId || '').trim();
    const catalogId = String(metaIntegrationSettings.catalogId || '').trim();
    const pixelId = String(metaIntegrationSettings.pixelId || '').trim();
    const lastMetaAdsCampaignId = String(metaIntegrationSettings.lastMetaAdsCampaignId || '').trim();

    const missingFields: string[] = [];
    if (!adAccountId) missingFields.push('adAccountId');
    if (!catalogId) missingFields.push('catalogId');
    if (!pixelId) missingFields.push('pixelId');
    if (!lastMetaAdsCampaignId) missingFields.push('lastMetaAdsCampaignId');

    if (missingFields.length > 0) {
      res.status(400).json({
        error: 'Dynamic product ads prerequisites are incomplete',
        missingFields,
        hint: 'Create a Meta Ads campaign first, then enable dynamic product ads.',
      });
      return;
    }

    const audienceName = String(req.body?.audienceName || 'Recent Product Viewers').trim();
    const retargetingWindowDaysRaw = Number(req.body?.retargetingWindowDays || 14);
    const retargetingWindowDays = Number.isFinite(retargetingWindowDaysRaw) && retargetingWindowDaysRaw >= 1
      ? Math.min(retargetingWindowDaysRaw, 180)
      : 14;
    const minimumEventCountRaw = Number(req.body?.minimumEventCount || 100);
    const minimumEventCount = Number.isFinite(minimumEventCountRaw) && minimumEventCountRaw >= 1
      ? Math.min(minimumEventCountRaw, 10000)
      : 100;

    const enabledAt = new Date().toISOString();
    const adsManagerUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(adAccountId)}`;

    const jobRef = await db.collection('metaDynamicAdsJobs').add({
      storeId,
      adAccountId,
      catalogId,
      pixelId,
      baseCampaignId: lastMetaAdsCampaignId,
      audienceName,
      retargetingWindowDays,
      minimumEventCount,
      status: 'enabled',
      enabledAt,
      enabledBy: user.uid,
      adsManagerUrl,
      productSetFilter: 'in_stock=true',
      serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('storeProfiles').doc(storeId).set({
      metaIntegrationSettings: {
        dynamicProductAdsEnabled: true,
        dynamicProductAdsStatus: 'enabled',
        dynamicProductAdsAudienceName: audienceName,
        dynamicProductAdsRetargetingWindowDays: retargetingWindowDays,
        dynamicProductAdsMinimumEventCount: minimumEventCount,
        lastDynamicProductAdsJobId: jobRef.id,
        lastDynamicProductAdsAt: enabledAt,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(200).json({
      ok: true,
      jobId: jobRef.id,
      status: 'enabled',
      enabledAt,
      adsManagerUrl,
      summary: {
        audienceName,
        retargetingWindowDays,
        minimumEventCount,
      },
    });
  } catch (err) {
    console.error('Dynamic product ads enable error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to enable dynamic product ads' });
  }
}
