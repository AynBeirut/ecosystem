// ===================================
// GRABIO POS - SYNC (heartbeat live; catalog/orders stubs)
// ===================================

let grabioHeartbeatTimer = null;
let grabioHeartbeatInFlight = false;
let grabioPendingHeartbeat = false;
let grabioOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let grabioSyncListenersBound = false;
let grabioQueueDrainInFlight = false;

const GRABIO_SYNC_QUEUE_SOURCE = 'grabio';
const GRABIO_SYNC_QUEUE_TABLE = 'sales';

function bindGrabioSyncListeners() {
    if (grabioSyncListenersBound || typeof window === 'undefined') return;
    grabioSyncListenersBound = true;
    window.addEventListener('online', handleGrabioOnline);
    window.addEventListener('offline', handleGrabioOffline);
}

function handleGrabioOnline() {
    grabioOnline = true;
    console.log('🌐 Grabio sync: back online');
    if (isGrabioPaired()) {
        sendGrabioHeartbeat({ reason: 'online' });
        drainGrabioQueue().catch((error) => {
            console.error('[Grabio] Failed draining queue on reconnect:', error);
        });
        startGrabioHeartbeat();
    }
}

function handleGrabioOffline() {
    grabioOnline = false;
    console.log('📡 Grabio sync: offline — heartbeat queued until online');
    grabioPendingHeartbeat = true;
}

function normalizeNumber(value, fallback = 0) {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function asString(value) {
    return value === null || value === undefined ? '' : String(value);
}

function getGrabioSyncAuth() {
    const cfg = getGrabioConfig();
    return {
        storeId: asString(cfg.storeId).trim(),
        deviceId: asString(cfg.deviceId).trim(),
        deviceToken: asString(cfg.deviceToken).trim(),
        composedProductSource: asString(cfg.composedProductSource || 'platform').trim() || 'platform'
    };
}

function getGrabioLocalProductType(apiType) {
    if (apiType === 'composed') return 'composed';
    return 'item';
}

async function upsertCatalogProducts(products) {
    if (typeof runExec !== 'function') {
        throw new Error('runExec is not available');
    }

    for (const product of products) {
        await runExec(
            `INSERT OR REPLACE INTO products
                (id, name, category, type, price, cost, icon, barcode, stock, unit, hourlyEnabled, firstHourRate, additionalHourRate, serviceDuration, description, createdAt, updatedAt, synced)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                asString(product.id),
                asString(product.name),
                asString(product.category || 'General'),
                getGrabioLocalProductType(asString(product.type)),
                normalizeNumber(product.price, 0),
                0,
                '📦',
                asString(product.barcode || null) || null,
                normalizeNumber(product.stock, 0),
                null,
                0,
                0,
                0,
                60,
                asString(product.description),
                Date.now(),
                Date.now()
            ]
        );
    }
}

function getGrabioLocalSaleId(salePayload) {
    if (!salePayload || typeof salePayload !== 'object') {
        return `sale-${Date.now()}`;
    }
    return (
        asString(salePayload.localSaleId).trim() ||
        asString(salePayload.id).trim() ||
        asString(salePayload.receiptNumber).trim() ||
        `sale-${Date.now()}`
    );
}

async function listPendingGrabioQueueRows() {
    if (typeof getPendingSyncOperations !== 'function') return [];
    const rows = await getPendingSyncOperations();
    return rows.filter((row) => {
        const data = row && row.data ? row.data : {};
        return (
            row &&
            row.synced === 0 &&
            row.table_name === GRABIO_SYNC_QUEUE_TABLE &&
            data &&
            data.source === GRABIO_SYNC_QUEUE_SOURCE
        );
    });
}

async function addGrabioOrderToQueue(salePayload) {
    const localSaleId = getGrabioLocalSaleId(salePayload);
    const pending = await listPendingGrabioQueueRows();
    const alreadyQueued = pending.some((row) => {
        const data = row.data || {};
        return asString(data.localSaleId).trim() === localSaleId;
    });
    if (alreadyQueued) return { queued: false, localSaleId, reason: 'already_queued' };

    const queueData = {
        ...salePayload,
        localSaleId,
        source: GRABIO_SYNC_QUEUE_SOURCE
    };

    if (typeof addToSyncQueue === 'function') {
        await addToSyncQueue('INSERT', GRABIO_SYNC_QUEUE_TABLE, queueData);
    } else if (typeof runExec === 'function') {
        await runExec(
            `INSERT INTO sync_queue (operation, table_name, data, timestamp, synced)
             VALUES (?, ?, ?, ?, 0)`,
            ['INSERT', GRABIO_SYNC_QUEUE_TABLE, JSON.stringify(queueData), Date.now()]
        );
    } else {
        throw new Error('No sync queue writer available');
    }

    return { queued: true, localSaleId };
}

function toGrabioOrderItems(items) {
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => {
            const productId =
                asString(item.productId).trim() ||
                asString(item.id).trim() ||
                asString(item.product_id).trim();
            const quantity = normalizeNumber(item.quantity, 0);
            if (!productId || quantity <= 0) return null;
            const price = normalizeNumber(item.price ?? item.unitPrice, 0);
            return {
                productId,
                name: asString(item.name),
                quantity,
                price,
                total: normalizeNumber(item.total, price * quantity)
            };
        })
        .filter(Boolean);
}

function toGrabioOrderPayload(salePayload) {
    const auth = getGrabioSyncAuth();
    const totals = salePayload && salePayload.totals ? salePayload.totals : {};
    return {
        storeId: auth.storeId,
        deviceId: auth.deviceId,
        deviceToken: auth.deviceToken,
        localSaleId: getGrabioLocalSaleId(salePayload),
        composedProductSource: auth.composedProductSource,
        paymentMethod: asString(salePayload && salePayload.paymentMethod).trim() || 'cash',
        timestamp:
            asString(salePayload && salePayload.timestamp).trim() ||
            new Date().toISOString(),
        items: toGrabioOrderItems(salePayload && salePayload.items),
        totals: {
            subtotal: normalizeNumber(totals.subtotal, 0),
            taxAmount: normalizeNumber(totals.taxAmount ?? totals.tax, 0),
            discountAmount: normalizeNumber(totals.discountAmount ?? totals.discount, 0),
            total: normalizeNumber(totals.total, 0)
        }
    };
}

async function postGrabioOrder(payload) {
    const response = await fetch(getGrabioApiUrl('/pos/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    let data = {};
    try {
        data = await response.json();
    } catch (e) {
        data = {};
    }

    if (response.status === 401) {
        stopGrabioHeartbeat();
        if (typeof openGrabioPairingModal === 'function') {
            openGrabioPairingModal();
        }
        throw new Error('Grabio session expired. Re-pair this POS device.');
    }

    if (!response.ok || data.success === false) {
        throw new Error(data.message || data.error || `Order push failed (HTTP ${response.status})`);
    }

    return { response, data };
}

async function drainGrabioQueue() {
    if (grabioQueueDrainInFlight || !isGrabioPaired() || !grabioOnline) {
        return { success: false, skipped: true };
    }
    grabioQueueDrainInFlight = true;
    try {
        const pendingRows = await listPendingGrabioQueueRows();
        if (pendingRows.length === 0) return { success: true, pushed: 0 };

        let pushed = 0;
        for (const row of pendingRows) {
            const payload = toGrabioOrderPayload(row.data || {});
            if (!Array.isArray(payload.items) || payload.items.length === 0) {
                console.warn('[Grabio] Queue row has no valid items, skipping:', row.id);
                continue;
            }

            await postGrabioOrder(payload);
            if (typeof markSyncOperationComplete === 'function') {
                await markSyncOperationComplete(row.id);
            }
            pushed += 1;
        }

        if (pushed > 0) {
            console.log(`[Grabio] Drained ${pushed} queued order(s)`);
        }
        return { success: true, pushed };
    } finally {
        grabioQueueDrainInFlight = false;
    }
}

/**
 * POST /pos/heartbeat
 */
async function sendGrabioHeartbeat(options = {}) {
    if (!isGrabioPaired()) {
        return { success: false, skipped: true, reason: 'not_paired' };
    }

    if (!grabioOnline) {
        grabioPendingHeartbeat = true;
        return { success: false, skipped: true, reason: 'offline' };
    }

    if (grabioHeartbeatInFlight) {
        grabioPendingHeartbeat = true;
        return { success: false, skipped: true, reason: 'in_flight' };
    }

    const cfg = getGrabioConfig();
    grabioHeartbeatInFlight = true;

    try {
        const response = await fetch(getGrabioApiUrl('/pos/heartbeat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                storeId: cfg.storeId,
                deviceId: cfg.deviceId,
                deviceToken: cfg.deviceToken
            })
        });

        let data = {};
        try {
            data = await response.json();
        } catch (e) {
            /* ignore */
        }

        if (response.status === 401) {
            console.warn('🔑 Grabio heartbeat rejected (401) — re-pair required');
            stopGrabioHeartbeat();
            if (typeof openGrabioPairingModal === 'function') {
                openGrabioPairingModal();
            }
            throw new Error('Grabio session expired. Generate a new code in admin and pair again.');
        }

        if (!response.ok || data.success === false) {
            throw new Error(data.message || data.error || `Heartbeat failed (HTTP ${response.status})`);
        }

        grabioPendingHeartbeat = false;
        if (options.reason) {
            console.log(`💓 Grabio heartbeat OK (${options.reason})`);
        } else {
            console.log('💓 Grabio heartbeat OK');
        }
        return { success: true, data };
    } catch (error) {
        console.error('Grabio heartbeat error:', error);
        throw error;
    } finally {
        grabioHeartbeatInFlight = false;
        if (grabioPendingHeartbeat && grabioOnline && isGrabioPaired()) {
            grabioPendingHeartbeat = false;
            sendGrabioHeartbeat({ reason: 'queued' }).catch(() => {});
        }
    }
}

/**
 * Start heartbeat interval (default 30s from grabio-config).
 * @param {number} [intervalSeconds] — optional override
 */
function startGrabioHeartbeat(intervalSeconds) {
    bindGrabioSyncListeners();
    stopGrabioHeartbeat();

    if (!isGrabioPaired()) {
        console.log('⚠️ Grabio heartbeat not started — not paired');
        return;
    }

    const seconds =
        intervalSeconds ||
        Math.round(getGrabioHeartbeatIntervalMs() / 1000) ||
        30;
    const intervalMs = seconds * 1000;

    console.log(`💓 Grabio heartbeat every ${seconds}s`);

    if (grabioOnline) {
        sendGrabioHeartbeat({ reason: 'start' }).catch(() => {});
    } else {
        grabioPendingHeartbeat = true;
    }

    grabioHeartbeatTimer = setInterval(() => {
        if (grabioOnline && isGrabioPaired()) {
            sendGrabioHeartbeat().catch(() => {});
        } else {
            grabioPendingHeartbeat = true;
        }
    }, intervalMs);
}

function stopGrabioHeartbeat() {
    if (grabioHeartbeatTimer) {
        clearInterval(grabioHeartbeatTimer);
        grabioHeartbeatTimer = null;
        console.log('⏸️ Grabio heartbeat stopped');
    }
}

async function pullGrabioCatalog() {
    if (!isGrabioPaired()) {
        return { success: false, skipped: true, reason: 'not_paired' };
    }
    if (!grabioOnline) {
        return { success: false, skipped: true, reason: 'offline' };
    }

    const auth = getGrabioSyncAuth();
    const query = new URLSearchParams({
        storeId: auth.storeId,
        deviceId: auth.deviceId,
        deviceToken: auth.deviceToken,
        composedProductSource: auth.composedProductSource
    });

    const response = await fetch(`${getGrabioApiUrl('/pos/catalog')}?${query.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    let data = {};
    try {
        data = await response.json();
    } catch (e) {
        data = {};
    }

    if (response.status === 401) {
        stopGrabioHeartbeat();
        if (typeof openGrabioPairingModal === 'function') {
            openGrabioPairingModal();
        }
        throw new Error('Grabio session expired. Re-pair this POS device.');
    }
    if (!response.ok || data.success === false) {
        throw new Error(data.message || data.error || `Catalog pull failed (HTTP ${response.status})`);
    }

    const products = Array.isArray(data.products) ? data.products : [];
    await upsertCatalogProducts(products);
    if (typeof saveDatabase === 'function') {
        await saveDatabase();
    }

    console.log(`[Grabio] Catalog synced (${products.length} products)`);
    return { success: true, productsCount: products.length, products };
}

async function pushGrabioOrder(salePayload, options = {}) {
    const { queueIfOffline = true } = options;

    if (!salePayload || typeof salePayload !== 'object') {
        return drainGrabioQueue();
    }

    const payload = toGrabioOrderPayload(salePayload);
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
        throw new Error('Cannot push empty sale payload to Grabio');
    }

    if (!isGrabioPaired()) {
        if (queueIfOffline) {
            await addGrabioOrderToQueue(salePayload);
            return { success: false, queued: true, reason: 'not_paired', localSaleId: payload.localSaleId };
        }
        return { success: false, skipped: true, reason: 'not_paired' };
    }

    if (!grabioOnline) {
        if (queueIfOffline) {
            await addGrabioOrderToQueue(salePayload);
            return { success: false, queued: true, reason: 'offline', localSaleId: payload.localSaleId };
        }
        return { success: false, skipped: true, reason: 'offline' };
    }

    try {
        const { data } = await postGrabioOrder(payload);
        if (data && data.alreadyExisted) {
            console.log(`[Grabio] Order already existed for localSaleId=${payload.localSaleId}`);
        } else {
            console.log(`[Grabio] Order pushed localSaleId=${payload.localSaleId}`);
        }
        return {
            success: true,
            orderId: data.orderId,
            alreadyExisted: Boolean(data.alreadyExisted),
            localSaleId: payload.localSaleId
        };
    } catch (error) {
        if (queueIfOffline) {
            await addGrabioOrderToQueue(salePayload);
            console.warn('[Grabio] Push failed, queued order for retry:', error);
            return {
                success: false,
                queued: true,
                reason: 'push_failed',
                localSaleId: payload.localSaleId,
                error: error.message || String(error)
            };
        }
        throw error;
    }
}

async function initGrabioSync() {
    bindGrabioSyncListeners();
    await loadGrabioConfig();
    if (isGrabioPaired()) {
        startGrabioHeartbeat();
        if (grabioOnline) {
            drainGrabioQueue().catch((error) => {
                console.error('[Grabio] Initial queue drain failed:', error);
            });
        }
    }
}

if (typeof window !== 'undefined') {
    window.sendGrabioHeartbeat = sendGrabioHeartbeat;
    window.startGrabioHeartbeat = startGrabioHeartbeat;
    window.stopGrabioHeartbeat = stopGrabioHeartbeat;
    window.pullGrabioCatalog = pullGrabioCatalog;
    window.pushGrabioOrder = pushGrabioOrder;
    window.drainGrabioQueue = drainGrabioQueue;
    window.queueGrabioOrderForSync = addGrabioOrderToQueue;
    window.initGrabioSync = initGrabioSync;

    const bootSync = () => {
        if (window.dbReady && typeof window.dbReady.then === 'function') {
            window.dbReady.then(initGrabioSync).catch(initGrabioSync);
        } else {
            setTimeout(initGrabioSync, 1000);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootSync);
    } else {
        bootSync();
    }
}
