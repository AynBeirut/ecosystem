// ===================================
// GRABIO POS - SYNC (heartbeat live; catalog/orders stubs)
// ===================================

let grabioHeartbeatTimer = null;
let grabioHeartbeatInFlight = false;
let grabioPendingHeartbeat = false;
let grabioOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let grabioSyncListenersBound = false;

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
        startGrabioHeartbeat();
    }
}

function handleGrabioOffline() {
    grabioOnline = false;
    console.log('📡 Grabio sync: offline — heartbeat queued until online');
    grabioPendingHeartbeat = true;
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

/** Phase 2 — API not live */
async function pullGrabioCatalog() {
    console.log('[Grabio] GET /pos/catalog — not live yet');
    return { success: false, skipped: true, reason: 'not_live_yet' };
}

/** Phase 2 — API not live */
async function pushGrabioOrder(/* salePayload */) {
    console.log('[Grabio] POST /pos/orders — not live yet');
    return { success: false, skipped: true, reason: 'not_live_yet' };
}

async function initGrabioSync() {
    bindGrabioSyncListeners();
    await loadGrabioConfig();
    if (isGrabioPaired()) {
        startGrabioHeartbeat();
    }
}

if (typeof window !== 'undefined') {
    window.sendGrabioHeartbeat = sendGrabioHeartbeat;
    window.startGrabioHeartbeat = startGrabioHeartbeat;
    window.stopGrabioHeartbeat = stopGrabioHeartbeat;
    window.pullGrabioCatalog = pullGrabioCatalog;
    window.pushGrabioOrder = pushGrabioOrder;
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
