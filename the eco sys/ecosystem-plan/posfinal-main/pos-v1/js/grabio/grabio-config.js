// ===================================
// GRABIO POS - CONFIG
// API URL + pairing credentials (app_settings, same pattern as sync-manager.js)
// ===================================

const GRABIO_API_BASE =
    'https://api-5nbn2jdbxa-uc.a.run.app';

/** app_settings keys (category: grabio) */
const GRABIO_SETTING_KEYS = {
    storeId: 'grabio_store_id',
    deviceId: 'grabio_device_id',
    deviceToken: 'grabio_device_token',
    composedProductSource: 'grabio_composed_product_source',
    deviceName: 'grabio_device_name',
    heartbeatIntervalSeconds: 'grabio_heartbeat_interval_seconds'
};

const GRABIO_DEFAULTS = {
    composedProductSource: 'platform',
    heartbeatIntervalSeconds: 30
};

let grabioConfig = {
    apiBase: GRABIO_API_BASE,
    storeId: null,
    deviceId: null,
    deviceToken: null,
    composedProductSource: GRABIO_DEFAULTS.composedProductSource,
    deviceName: null,
    heartbeatIntervalSeconds: GRABIO_DEFAULTS.heartbeatIntervalSeconds
};

// ===================================
// LOAD / SAVE
// ===================================

/**
 * Load Grabio credentials from app_settings (mirrors loadVPSConfig in sync-manager.js).
 */
async function loadGrabioConfig() {
    try {
        grabioConfig.storeId = getAppSetting(GRABIO_SETTING_KEYS.storeId);
        grabioConfig.deviceId = getAppSetting(GRABIO_SETTING_KEYS.deviceId);
        grabioConfig.deviceToken = getAppSetting(GRABIO_SETTING_KEYS.deviceToken);
        grabioConfig.composedProductSource =
            getAppSetting(GRABIO_SETTING_KEYS.composedProductSource) ||
            GRABIO_DEFAULTS.composedProductSource;
        grabioConfig.deviceName = getAppSetting(GRABIO_SETTING_KEYS.deviceName);

        const intervalRaw = getAppSetting(GRABIO_SETTING_KEYS.heartbeatIntervalSeconds);
        const parsed = parseInt(intervalRaw, 10);
        grabioConfig.heartbeatIntervalSeconds =
            Number.isFinite(parsed) && parsed > 0
                ? parsed
                : GRABIO_DEFAULTS.heartbeatIntervalSeconds;

        console.log('✅ Grabio configuration loaded');
        console.log('🏪 Store ID:', grabioConfig.storeId || 'Not paired');
        console.log('📱 Device ID:', grabioConfig.deviceId || 'Not paired');
        return { ...grabioConfig };
    } catch (error) {
        console.error('Failed to load Grabio config:', error);
        return { ...grabioConfig };
    }
}

/**
 * Persist one or more Grabio fields to app_settings.
 * @param {Object} fields - e.g. { storeId, deviceId, deviceToken, composedProductSource, deviceName }
 */
async function saveGrabioConfig(fields = {}) {
    const map = {
        storeId: GRABIO_SETTING_KEYS.storeId,
        deviceId: GRABIO_SETTING_KEYS.deviceId,
        deviceToken: GRABIO_SETTING_KEYS.deviceToken,
        composedProductSource: GRABIO_SETTING_KEYS.composedProductSource,
        deviceName: GRABIO_SETTING_KEYS.deviceName,
        heartbeatIntervalSeconds: GRABIO_SETTING_KEYS.heartbeatIntervalSeconds
    };

    try {
        for (const [field, key] of Object.entries(map)) {
            if (fields[field] !== undefined && fields[field] !== null) {
                const value = String(fields[field]);
                await setAppSetting(key, value, 'grabio');
                grabioConfig[field] =
                    field === 'heartbeatIntervalSeconds'
                        ? parseInt(value, 10)
                        : fields[field];
            }
        }
        console.log('✅ Grabio configuration saved');
        return { ...grabioConfig };
    } catch (error) {
        console.error('Failed to save Grabio config:', error);
        throw error;
    }
}

/**
 * Apply pairing response from POST /pos/pair and persist locally.
 * @param {Object} pairResult - { storeId, deviceId, deviceToken, composedProductSource?, deviceName? }
 */
async function applyGrabioPairingResult(pairResult) {
    if (!pairResult || !pairResult.storeId || !pairResult.deviceId || !pairResult.deviceToken) {
        throw new Error('Invalid pairing response: missing storeId, deviceId, or deviceToken');
    }

    return saveGrabioConfig({
        storeId: pairResult.storeId,
        deviceId: pairResult.deviceId,
        deviceToken: pairResult.deviceToken,
        composedProductSource:
            pairResult.composedProductSource || GRABIO_DEFAULTS.composedProductSource,
        deviceName: pairResult.deviceName || grabioConfig.deviceName
    });
}

/**
 * Remove Grabio pairing from local storage (does not call remote API).
 */
async function clearGrabioConfig() {
    return saveGrabioConfig({
        storeId: '',
        deviceId: '',
        deviceToken: '',
        deviceName: '',
        composedProductSource: GRABIO_DEFAULTS.composedProductSource
    });
}

// ===================================
// ACCESSORS
// ===================================

function getGrabioConfig() {
    return { ...grabioConfig };
}

function getGrabioApiBase() {
    return grabioConfig.apiBase || GRABIO_API_BASE;
}

/**
 * @param {string} path - e.g. '/pos/pair' or 'pos/heartbeat'
 */
function getGrabioApiUrl(path) {
    const base = getGrabioApiBase().replace(/\/$/, '');
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${base}${suffix}`;
}

function isGrabioPaired() {
    return Boolean(
        grabioConfig.storeId &&
            grabioConfig.deviceId &&
            grabioConfig.deviceToken
    );
}

function getGrabioHeartbeatIntervalMs() {
    const seconds =
        grabioConfig.heartbeatIntervalSeconds ||
        GRABIO_DEFAULTS.heartbeatIntervalSeconds;
    return seconds * 1000;
}

// Export for tests / explicit init (optional; globals match sync-manager style)
if (typeof window !== 'undefined') {
    window.GRABIO_API_BASE = GRABIO_API_BASE;
    window.GRABIO_SETTING_KEYS = GRABIO_SETTING_KEYS;
    window.loadGrabioConfig = loadGrabioConfig;
    window.saveGrabioConfig = saveGrabioConfig;
    window.applyGrabioPairingResult = applyGrabioPairingResult;
    window.clearGrabioConfig = clearGrabioConfig;
    window.getGrabioConfig = getGrabioConfig;
    window.getGrabioApiBase = getGrabioApiBase;
    window.getGrabioApiUrl = getGrabioApiUrl;
    window.isGrabioPaired = isGrabioPaired;
    window.getGrabioHeartbeatIntervalMs = getGrabioHeartbeatIntervalMs;
}
