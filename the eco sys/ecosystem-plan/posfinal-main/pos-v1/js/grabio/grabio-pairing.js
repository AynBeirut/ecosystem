// ===================================
// GRABIO POS - PAIRING UI
// Operator enters admin-generated code → POST /pos/pair (NOT /pos/pairing-code)
// ===================================

const GRABIO_PAIR_MODAL_ID = 'grabio-pair-modal';

/**
 * POST /pos/pair — POS-side only. Code is generated in Grabio admin (/admin/pos).
 */
async function requestGrabioPair({ code, deviceName, composedProductSource }) {
    const normalizedCode = String(code || '').trim().replace(/\D/g, '');
    if (normalizedCode.length !== 6) {
        throw new Error('Enter the 6-digit code from Grabio admin.');
    }
    if (!deviceName || !String(deviceName).trim()) {
        throw new Error('Enter a device name (e.g. Front counter).');
    }

    const source = composedProductSource === 'pos' ? 'pos' : 'platform';
    const url = getGrabioApiUrl('/pos/pair');

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: normalizedCode,
            deviceName: String(deviceName).trim(),
            composedProductSource: source
        })
    });

    let data = {};
    try {
        data = await response.json();
    } catch (e) {
        /* non-JSON body */
    }

    if (!response.ok || data.success === false) {
        const msg =
            data.message ||
            data.error ||
            (response.status === 401
                ? 'Invalid or expired pairing code.'
                : `Pairing failed (HTTP ${response.status}).`);
        throw new Error(msg);
    }

    return {
        ...data,
        deviceName: String(deviceName).trim(),
        composedProductSource: data.composedProductSource || source
    };
}

function ensureGrabioPairModal() {
    if (document.getElementById(GRABIO_PAIR_MODAL_ID)) {
        return;
    }

    const modal = document.createElement('div');
    modal.id = GRABIO_PAIR_MODAL_ID;
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 480px;">
            <div class="modal-header">
                <h2>🔗 Pair with Grabio</h2>
            </div>
            <div style="padding: var(--space-lg, 20px);">
                <p style="font-size: 0.95em; margin: 0 0 16px 0; opacity: 0.85;">
                    In <strong>grabio.space/admin/pos</strong>, generate a 6-digit code, then enter it here.
                </p>
                <div id="grabio-pair-status" class="connection-status" style="margin-bottom: 16px;">Not paired</div>
                <div class="form-group">
                    <label for="grabio-device-name">Device name</label>
                    <input type="text" id="grabio-device-name" placeholder="Front counter" maxlength="80" autocomplete="off">
                </div>
                <div class="form-group">
                    <label for="grabio-pair-code">6-digit pairing code</label>
                    <input type="text" id="grabio-pair-code" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="123456" autocomplete="one-time-code">
                </div>
                <div class="form-group">
                    <label>Composed product stock</label>
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                        <label style="font-weight: normal; cursor: pointer;">
                            <input type="radio" name="grabio-composed-source" value="platform" checked>
                            Platform deducts ingredients (recommended for live kitchen)
                        </label>
                        <label style="font-weight: normal; cursor: pointer;">
                            <input type="radio" name="grabio-composed-source" value="pos">
                            POS deducts locally; platform records outcome
                        </label>
                    </div>
                </div>
                <p id="grabio-pair-error" style="color: #e74c3c; font-size: 0.9em; min-height: 1.2em; margin: 12px 0 0 0;"></p>
            </div>
            <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 16px;">
                <button type="button" id="grabio-pair-submit" class="btn-primary">Pair device</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('grabio-pair-submit').addEventListener('click', submitGrabioPairingForm);
    document.getElementById('grabio-pair-code').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
}

function getSelectedComposedProductSource() {
    const selected = document.querySelector('input[name="grabio-composed-source"]:checked');
    return selected && selected.value === 'pos' ? 'pos' : 'platform';
}

function setGrabioPairStatus(message, tone = 'neutral') {
    const el = document.getElementById('grabio-pair-status');
    if (!el) return;
    el.textContent = message;
    el.style.color =
        tone === 'success' ? '#27ae60' : tone === 'error' ? '#e74c3c' : '#666';
}

function setGrabioPairError(message) {
    const el = document.getElementById('grabio-pair-error');
    if (el) el.textContent = message || '';
}

function openGrabioPairingModal() {
    ensureGrabioPairModal();
    setGrabioPairError('');
    const cfg = getGrabioConfig();
    const nameInput = document.getElementById('grabio-device-name');
    const codeInput = document.getElementById('grabio-pair-code');
    if (nameInput) nameInput.value = cfg.deviceName || '';
    if (codeInput) codeInput.value = '';

    const platformRadio = document.querySelector('input[name="grabio-composed-source"][value="platform"]');
    const posRadio = document.querySelector('input[name="grabio-composed-source"][value="pos"]');
    if (cfg.composedProductSource === 'pos' && posRadio) {
        posRadio.checked = true;
    } else if (platformRadio) {
        platformRadio.checked = true;
    }

    if (isGrabioPaired()) {
        setGrabioPairStatus(`Paired — store ${cfg.storeId}, device ${cfg.deviceId}`, 'success');
    } else {
        setGrabioPairStatus('Not paired');
    }

    document.getElementById(GRABIO_PAIR_MODAL_ID).classList.add('active');
    if (codeInput) codeInput.focus();
}

function closeGrabioPairingModal() {
    const modal = document.getElementById(GRABIO_PAIR_MODAL_ID);
    if (modal) modal.classList.remove('active');
}

async function submitGrabioPairingForm() {
    const submitBtn = document.getElementById('grabio-pair-submit');
    const deviceName = document.getElementById('grabio-device-name')?.value;
    const code = document.getElementById('grabio-pair-code')?.value;
    const composedProductSource = getSelectedComposedProductSource();

    setGrabioPairError('');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Pairing…';
    }

    try {
        const result = await requestGrabioPair({ code, deviceName, composedProductSource });
        await applyGrabioPairingResult(result);
        setGrabioPairStatus('Paired successfully', 'success');
        if (typeof showNotification === 'function') {
            showNotification('Grabio pairing successful', 'success');
        }
        closeGrabioPairingModal();
        if (typeof startGrabioHeartbeat === 'function') {
            startGrabioHeartbeat();
        }
    } catch (error) {
        console.error('Grabio pairing failed:', error);
        const message = error.message || 'Pairing failed. Check the code and try again.';
        setGrabioPairError(message);
        setGrabioPairStatus('Pairing failed', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Pair device';
        }
    }
}

/**
 * Show pairing modal on startup when not yet paired.
 */
async function initGrabioPairing() {
    ensureGrabioPairModal();
    await loadGrabioConfig();

    if (!isGrabioPaired()) {
        openGrabioPairingModal();
    } else {
        console.log('✅ Grabio already paired');
        if (typeof startGrabioHeartbeat === 'function') {
            startGrabioHeartbeat();
        }
    }
}

if (typeof window !== 'undefined') {
    window.requestGrabioPair = requestGrabioPair;
    window.openGrabioPairingModal = openGrabioPairingModal;
    window.closeGrabioPairingModal = closeGrabioPairingModal;
    window.submitGrabioPairingForm = submitGrabioPairingForm;
    window.initGrabioPairing = initGrabioPairing;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const start = () => initGrabioPairing();
            if (window.dbReady && typeof window.dbReady.then === 'function') {
                window.dbReady.then(start).catch(start);
            } else {
                setTimeout(start, 1000);
            }
        });
    } else {
        const start = () => initGrabioPairing();
        if (window.dbReady && typeof window.dbReady.then === 'function') {
            window.dbReady.then(start).catch(start);
        } else {
            setTimeout(start, 1000);
        }
    }
}
