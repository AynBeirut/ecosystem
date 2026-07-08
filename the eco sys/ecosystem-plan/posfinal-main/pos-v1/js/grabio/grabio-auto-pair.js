// ===================================
// GRABIO POS - AUTO PAIR ON FIRST LAUNCH
// Checks for install token in:
//   1. Command-line arg: --pair-token=XXXX
//   2. pairing.json file next to the exe
// If found and POS not yet paired, auto-pairs silently.
// ===================================

(function () {
    'use strict';

    function getInstallToken() {
        // Source 1: Electron command-line args
        if (typeof process !== 'undefined' && process.argv) {
            for (const arg of process.argv) {
                if (arg.startsWith('--pair-token=')) {
                    return arg.split('=')[1].trim();
                }
            }
        }

        // Source 2: electronAPI exposed from main process
        if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.getInstallToken) {
            const token = window.electronAPI.getInstallToken();
            if (token) return token;
        }

        // Source 3: pairing.json file (read via electronAPI or inline)
        if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.readPairingFile) {
            try {
                const data = window.electronAPI.readPairingFile();
                if (data && data.installToken) return data.installToken;
            } catch (e) { /* no file */ }
        }

        return null;
    }

    async function attemptAutoPair(token) {
        if (!token || token.length < 20) return false;

        const url = getGrabioApiUrl('/pos/auto-pair');
        console.log('[AutoPair] Attempting auto-pair with install token...');

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ installToken: token })
            });

            let data = {};
            try { data = await response.json(); } catch { data = {}; }

            if (!response.ok || !data.success) {
                console.warn('[AutoPair] Failed:', data.error || `HTTP ${response.status}`);
                return false;
            }

            // Apply pairing result to config
            if (typeof applyGrabioPairingResult === 'function') {
                applyGrabioPairingResult({
                    storeId: data.storeId,
                    deviceId: data.deviceId,
                    deviceToken: data.deviceToken,
                    composedProductSource: data.composedProductSource || 'platform',
                    deviceName: data.deviceName || 'POS Terminal'
                });
            }

            console.log('[AutoPair] Successfully paired!', { storeId: data.storeId, deviceId: data.deviceId });

            // Pull catalog after auto-pair
            if (typeof pullGrabioCatalog === 'function') {
                pullGrabioCatalog().catch(e => console.warn('[AutoPair] Catalog pull failed:', e));
            }

            return true;
        } catch (e) {
            console.error('[AutoPair] Network error:', e.message);
            return false;
        }
    }

    async function initAutoPair() {
        // Only attempt if not already paired
        if (typeof isGrabioPaired === 'function' && isGrabioPaired()) {
            return;
        }

        const token = getInstallToken();
        if (!token) return;

        // Wait for config to be loaded
        await new Promise(r => setTimeout(r, 1000));

        if (typeof isGrabioPaired === 'function' && isGrabioPaired()) {
            return;
        }

        const success = await attemptAutoPair(token);
        if (success) {
            // Remove pairing.json after successful pair (so it doesn't re-pair on next launch)
            if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.clearPairingFile) {
                try { window.electronAPI.clearPairingFile(); } catch { /* ok */ }
            }
        }
    }

    // Run after DOM is ready and other scripts have loaded
    if (typeof window !== 'undefined') {
        window.initAutoPair = initAutoPair;
        window.addEventListener('load', () => {
            setTimeout(initAutoPair, 2000);
        });
    }
})();
