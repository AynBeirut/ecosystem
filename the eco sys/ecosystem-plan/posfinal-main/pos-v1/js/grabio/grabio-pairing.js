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
        <div class="modal-content" style="max-width: 480px; max-height: 90vh; display: flex; flex-direction: column;">
            <div class="modal-header">
                <h2>🔗 Pair with Grabio</h2>
            </div>
            <form id="grabio-pair-form" style="padding: var(--space-lg, 20px); overflow: auto;">
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
            </form>
            <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 16px; border-top: 1px solid rgba(255,255,255,0.08);">
                <button type="button" id="grabio-pair-back" style="padding: 10px 14px; border-radius: 8px; border: 1px solid #555; background: #2a2a2a; color: #fff; cursor: pointer;">Back</button>
                <button type="button" id="grabio-pair-submit" class="btn-primary" style="padding: 10px 14px; border-radius: 8px; border: none; background: #0d6efd; color: #fff; cursor: pointer;">Pair device</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const form = document.getElementById('grabio-pair-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            submitGrabioPairingForm();
        });
    }
    document.getElementById('grabio-pair-submit').addEventListener('click', submitGrabioPairingForm);
    document.getElementById('grabio-pair-back').addEventListener('click', closeGrabioPairingModal);
    document.getElementById('grabio-pair-code').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });

    const submitOnEnter = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        submitGrabioPairingForm();
    };
    document.getElementById('grabio-device-name').addEventListener('keydown', submitOnEnter);
    document.getElementById('grabio-pair-code').addEventListener('keydown', submitOnEnter);
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
        if (typeof startGrabioHeartbeat === 'function') {
            startGrabioHeartbeat();
        }
        if (typeof pullGrabioCatalog === 'function') {
            pullGrabioCatalog().catch((error) => {
                console.warn('[Grabio] Catalog pull after pairing failed:', error);
            });
        }
        showPostPairMigrationOption();
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
 * After successful pairing, show migration option instead of closing modal.
 */
function showPostPairMigrationOption() {
    const salesCount = typeof countMigratableSales === 'function' ? countMigratableSales() : 0;
    const form = document.getElementById('grabio-pair-form');
    const footer = document.getElementById(GRABIO_PAIR_MODAL_ID)?.querySelector('.modal-footer');

    if (form) {
        if (salesCount > 0) {
            form.innerHTML = `
                <div style="text-align: center; padding: 20px 0;">
                    <div style="font-size: 2.5em; margin-bottom: 12px;">✅</div>
                    <h3 style="margin: 0 0 8px 0; color: #27ae60;">Paired successfully!</h3>
                    <p style="margin: 0 0 20px 0; opacity: 0.85;">
                        You have <strong>${salesCount}</strong> local record${salesCount === 1 ? '' : 's'} (products, customers, orders, etc.) that can be synced to Grabio.
                    </p>
                    <div id="grabio-migrate-progress" style="display: none; margin: 16px 0;">
                        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; height: 8px; overflow: hidden; margin-bottom: 8px;">
                            <div id="grabio-migrate-bar" style="height: 100%; width: 0%; background: #0d6efd; transition: width 0.3s;"></div>
                        </div>
                        <p id="grabio-migrate-status" style="font-size: 0.85em; margin: 0; opacity: 0.7;">Preparing...</p>
                    </div>
                    <div id="grabio-migrate-result" style="display: none; margin: 16px 0; padding: 12px; border-radius: 8px; background: rgba(39,174,96,0.1); border: 1px solid rgba(39,174,96,0.3);">
                    </div>
                </div>
            `;
        } else {
            form.innerHTML = `
                <div style="text-align: center; padding: 20px 0;">
                    <div style="font-size: 2.5em; margin-bottom: 12px;">✅</div>
                    <h3 style="margin: 0 0 8px 0; color: #27ae60;">Paired successfully!</h3>
                    <p style="margin: 0; opacity: 0.85;">Your POS is now connected to Grabio. New sales will sync automatically.</p>
                </div>
            `;
        }
    }

    if (footer) {
        if (salesCount > 0) {
            footer.innerHTML = `
                <button type="button" id="grabio-migrate-skip" style="padding: 10px 14px; border-radius: 8px; border: 1px solid #555; background: #2a2a2a; color: #fff; cursor: pointer;">Skip</button>
                <button type="button" id="grabio-migrate-start" style="padding: 10px 18px; border-radius: 8px; border: none; background: #0d6efd; color: #fff; cursor: pointer; font-weight: 600;">Sync All Data to Grabio</button>
            `;
            document.getElementById('grabio-migrate-skip').addEventListener('click', closeGrabioPairingModal);
            document.getElementById('grabio-migrate-start').addEventListener('click', startMigrationFromModal);
        } else {
            footer.innerHTML = `
                <button type="button" id="grabio-migrate-done" style="padding: 10px 18px; border-radius: 8px; border: none; background: #0d6efd; color: #fff; cursor: pointer;">Done</button>
            `;
            document.getElementById('grabio-migrate-done').addEventListener('click', closeGrabioPairingModal);
        }
    }
}

async function startMigrationFromModal() {
    const startBtn = document.getElementById('grabio-migrate-start');
    const skipBtn = document.getElementById('grabio-migrate-skip');
    const progressDiv = document.getElementById('grabio-migrate-progress');
    const bar = document.getElementById('grabio-migrate-bar');
    const statusEl = document.getElementById('grabio-migrate-status');
    const resultDiv = document.getElementById('grabio-migrate-result');

    if (startBtn) startBtn.disabled = true;
    if (skipBtn) skipBtn.style.display = 'none';
    if (progressDiv) progressDiv.style.display = 'block';

    try {
        const stats = await migrateHistoricalSales(({ phase, current, total, label }) => {
            const pct = Math.round((current / total) * 100);
            if (bar) bar.style.width = `${pct}%`;
            if (statusEl) statusEl.textContent = label || `Syncing ${phase}...`;
        });

        if (progressDiv) progressDiv.style.display = 'none';
        if (resultDiv) {
            resultDiv.style.display = 'block';
            const lines = [];
            if (stats.products.synced) lines.push(`${stats.products.synced} products`);
            if (stats.customers.synced) lines.push(`${stats.customers.synced} customers`);
            if (stats.suppliers.synced) lines.push(`${stats.suppliers.synced} suppliers`);
            if (stats.purchases.synced) lines.push(`${stats.purchases.synced} purchases`);
            if (stats.expenses.synced) lines.push(`${stats.expenses.synced} expenses`);
            if (stats.orders.posted) lines.push(`${stats.orders.posted} orders`);
            const totalFailed = (stats.products.failed || 0) + (stats.customers.failed || 0) + (stats.suppliers.failed || 0) + (stats.purchases.failed || 0) + (stats.expenses.failed || 0) + (stats.orders.failed || 0);
            resultDiv.innerHTML = `
                <strong style="color: #27ae60;">Sync complete!</strong><br>
                <span style="font-size: 0.9em;">
                    ${lines.join(', ')} synced${totalFailed ? ` | <span style="color:#e74c3c">${totalFailed} failed</span>` : ''}
                </span>
            `;
        }

        const footer = document.getElementById(GRABIO_PAIR_MODAL_ID)?.querySelector('.modal-footer');
        if (footer) {
            footer.innerHTML = `
                <button type="button" id="grabio-migrate-close" style="padding: 10px 18px; border-radius: 8px; border: none; background: #27ae60; color: #fff; cursor: pointer;">Done</button>
            `;
            document.getElementById('grabio-migrate-close').addEventListener('click', closeGrabioPairingModal);
        }
    } catch (err) {
        console.error('[Grabio-Migrate] Migration error:', err);
        if (statusEl) statusEl.textContent = `Error: ${err.message}`;
        if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Retry'; }
        if (skipBtn) skipBtn.style.display = '';
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
