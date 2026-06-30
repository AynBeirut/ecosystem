/**
 * Reservations / Events Module v2
 * Multi-venue · Calendar view · No time limit
 * Stored as sales: paymentStatus='partial', notes._res=1, notes.venueId
 */

console.log('🗓️ Loading reservations.js v2...');

// ─────────────────────────────────────────
// MODULE STATE
// ─────────────────────────────────────────

let _resItems = [];
let _calYear  = new Date().getFullYear();
let _calMonth = new Date().getMonth(); // 0-indexed

// ─────────────────────────────────────────
// DB INIT — venues table
// ─────────────────────────────────────────

function ensureVenuesTable() {
    try {
        runExec(`CREATE TABLE IF NOT EXISTS venues (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            description TEXT    DEFAULT '',
            color       TEXT    DEFAULT '#3b82f6',
            capacity    INTEGER DEFAULT 0,
            createdAt   TEXT    DEFAULT CURRENT_TIMESTAMP
        )`);
    } catch(e) { console.warn('ensureVenuesTable:', e.message); }
}
// NOTE: called inside showReservationsModal(), not at load time (DB not ready at load time)

// ─────────────────────────────────────────
// TABS
// ─────────────────────────────────────────

function switchResTab(tab) {
    ['list','calendar','venues'].forEach(t => {
        const panel = document.getElementById(`res-tab-${t}`);
        if (panel) panel.style.display = t === tab ? 'block' : 'none';
        const btn = document.querySelector(`[data-res-tab="${t}"]`);
        if (btn) {
            btn.style.background = t === tab ? '#3b82f6' : 'transparent';
            btn.style.color      = t === tab ? '#fff'    : '#888';
        }
    });
    if (tab === 'calendar') { populateVenueFilters(); renderCalendar(); }
    if (tab === 'venues')   { renderVenuesList(); }
    if (tab === 'list')     { populateVenueFilters(); renderReservationsList(); }
}

// ─────────────────────────────────────────
// MAIN MODAL
// ─────────────────────────────────────────

function showReservationsModal() {
    const modal = document.getElementById('reservations-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    ensureVenuesTable();
    populateVenueFilters();
    switchResTab('list');
}

function closeReservationsModal() {
    const modal = document.getElementById('reservations-modal');
    if (modal) modal.style.display = 'none';
}

// ─────────────────────────────────────────
// NEW RESERVATION MODAL
// ─────────────────────────────────────────

function showNewReservationModal() {
    // Customers
    try {
        const customers = runQuery('SELECT id, name, phone FROM customers ORDER BY name ASC');
        const sel = document.getElementById('res-customer-select');
        if (sel) {
            sel.innerHTML = '<option value="">-- Walk-in / New Client --</option>';
            (customers || []).forEach(c => {
                const opt = document.createElement('option');
                opt.value       = c.id;
                opt.textContent = `${c.name}${c.phone ? ' · ' + c.phone : ''}`;
                opt.dataset.name  = c.name;
                opt.dataset.phone = c.phone || '';
                sel.appendChild(opt);
            });
        }
    } catch(e) { console.warn('Could not load customers:', e.message); }

    // Venues
    populateReservationVenueSelect();

    // Default date = tomorrow; NO max — reservations can be months/years in the future
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('res-event-date');
    if (dateInput) {
        dateInput.value = tomorrow.toISOString().split('T')[0];
        dateInput.removeAttribute('max');
    }

    // Reset
    _resItems = [];
    ['res-event-name','res-notes','res-manual-name','res-manual-phone'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const di = document.getElementById('res-deposit-amount'); if (di) di.value = '0';
    const il = document.getElementById('res-items-list');
    if (il) il.innerHTML = '<p style="color:#888;font-size:13px;text-align:center;">No items added yet</p>';
    const td = document.getElementById('res-totals-display'); if (td) td.style.display = 'none';
    const qEl = document.getElementById('res-item-qty'); if (qEl) qEl.value = 1;

    populateReservationProductSelect();
    document.getElementById('new-reservation-modal').style.display = 'flex';
}

function closeNewReservationModal() {
    document.getElementById('new-reservation-modal').style.display = 'none';
}

function populateReservationVenueSelect() {
    try {
        const venues = runQuery('SELECT id, name, color FROM venues ORDER BY name ASC');
        const sel = document.getElementById('res-venue-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">— No specific venue —</option>';
        (venues || []).forEach(v => {
            const opt       = document.createElement('option');
            opt.value       = v.id;
            opt.textContent = `🏛️ ${v.name}`;
            opt.dataset.color = v.color || '#3b82f6';
            sel.appendChild(opt);
        });
    } catch(e) { console.warn('populateReservationVenueSelect:', e.message); }
}

// ─────────────────────────────────────────
// PRODUCT SELECT FOR RESERVATION
// ─────────────────────────────────────────

function populateReservationProductSelect() {
    try {
        const products = runQuery("SELECT id, name, price, icon FROM products WHERE stock > 0 OR type='service' ORDER BY name ASC");
        const sel = document.getElementById('res-product-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select product / service --</option>';
        (products || []).forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.icon || '📦'} ${p.name} — $${parseFloat(p.price).toFixed(2)}`;
            opt.dataset.price = p.price;
            opt.dataset.name  = p.name;
            opt.dataset.icon  = p.icon || '📦';
            sel.appendChild(opt);
        });
    } catch(e) { console.warn('Could not load products:', e.message); }
}

function addReservationItem() {
    const sel   = document.getElementById('res-product-select');
    const qty   = parseInt(document.getElementById('res-item-qty').value) || 1;
    if (!sel || !sel.value) { alert('Select a product first.'); return; }

    const opt   = sel.options[sel.selectedIndex];
    const price = parseFloat(opt.dataset.price) || 0;
    const existing = _resItems.find(i => i.id == sel.value);
    if (existing) {
        existing.quantity += qty;
    } else {
        _resItems.push({ id: sel.value, name: opt.dataset.name, icon: opt.dataset.icon, price, quantity: qty });
    }
    renderResItemsList();
}

function removeResItem(idx) {
    _resItems.splice(idx, 1);
    renderResItemsList();
}

function renderResItemsList() {
    const container = document.getElementById('res-items-list');
    if (!container) return;

    if (_resItems.length === 0) {
        container.innerHTML = '<p style="color:#888;font-size:13px;text-align:center;">No items added yet</p>';
        document.getElementById('res-totals-display').style.display = 'none';
        return;
    }

    const subtotal = _resItems.reduce((s, i) => s + i.price * i.quantity, 0);

    container.innerHTML = _resItems.map((item, idx) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#1a2035;border-radius:6px;margin-bottom:6px;">
            <span>${item.icon} ${item.name} ×${item.quantity}</span>
            <span style="display:flex;align-items:center;gap:10px;">
                <strong>$${(item.price * item.quantity).toFixed(2)}</strong>
                <button onclick="removeResItem(${idx})" style="background:#ef4444;border:none;color:white;border-radius:4px;padding:2px 8px;cursor:pointer;">✕</button>
            </span>
        </div>
    `).join('');

    const totalsEl = document.getElementById('res-totals-display');
    totalsEl.style.display = 'block';
    document.getElementById('res-subtotal-val').textContent = `$${subtotal.toFixed(2)}`;

    // Update deposit max
    const depositInput = document.getElementById('res-deposit-amount');
    if (depositInput) {
        depositInput.max = subtotal.toFixed(2);
        if (parseFloat(depositInput.value) > subtotal) depositInput.value = subtotal.toFixed(2);
    }
    updateResRemainingDisplay();
}

function updateResRemainingDisplay() {
    const subtotal = _resItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const deposit  = parseFloat(document.getElementById('res-deposit-amount')?.value) || 0;
    const remaining = Math.max(0, subtotal - deposit);
    const depositEl   = document.getElementById('res-deposit-val');
    const remainingEl = document.getElementById('res-remaining-val');
    if (depositEl)   depositEl.textContent   = `$${deposit.toFixed(2)}`;
    if (remainingEl) remainingEl.textContent = `$${remaining.toFixed(2)}`;
}

// ─────────────────────────────────────────
// SAVE RESERVATION
// ─────────────────────────────────────────

async function saveReservation() {
    const eventName   = document.getElementById('res-event-name').value.trim();
    const eventDate   = document.getElementById('res-event-date').value;
    const deposit     = parseFloat(document.getElementById('res-deposit-amount').value) || 0;
    const notes       = document.getElementById('res-notes').value.trim();
    const customerSel = document.getElementById('res-customer-select');
    const manualName  = document.getElementById('res-manual-name').value.trim();
    const manualPhone = document.getElementById('res-manual-phone').value.trim();

    const venueSel    = document.getElementById('res-venue-select');
    const venueId     = venueSel?.value ? parseInt(venueSel.value) : null;
    const venueName   = venueId
        ? (venueSel.options[venueSel.selectedIndex]?.textContent?.replace('🏛️ ', '').trim() || '')
        : null;

    if (!eventName)           { alert('Enter an event name.'); return; }
    if (!eventDate)           { alert('Select an event date.'); return; }
    if (_resItems.length === 0) { alert('Add at least one product or service.'); return; }

    const subtotal = _resItems.reduce((s, i) => s + i.price * i.quantity, 0);
    if (deposit <= 0)         { alert('Deposit must be greater than $0.'); return; }
    if (deposit > subtotal)   { alert('Deposit cannot exceed total amount.'); return; }

    const remaining = subtotal - deposit;

    // Customer info
    let customerInfo = { name: 'Walk-in', phone: '' };
    if (customerSel && customerSel.value) {
        const opt = customerSel.options[customerSel.selectedIndex];
        customerInfo = { name: opt.dataset.name, phone: opt.dataset.phone };
    } else if (manualName) {
        customerInfo = { name: manualName, phone: manualPhone };
    }

    // Generate receipt number (RES prefix)
    let receiptNum = 'RES-000001';
    try {
        const last = runQuery("SELECT receiptNumber FROM sales WHERE receiptNumber LIKE 'RES-%' ORDER BY id DESC LIMIT 1");
        if (last && last.length > 0) {
            const lastNum = parseInt((last[0].receiptNumber || 'RES-000000').replace('RES-', '')) || 0;
            receiptNum = 'RES-' + String(lastNum + 1).padStart(6, '0');
        }
    } catch(e) {}

    const totals = { subtotal, tax: 0, total: subtotal, discount: 0, discountPercent: 0, taxEnabled: false };
    const metaNotes = JSON.stringify({ _res: 1, eventName, eventDate, venueId, venueName, userNotes: notes });

    try {
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        runExec(`
            INSERT INTO sales (timestamp, date, items, totals, paymentMethod, customerInfo, receiptNumber, cashierId, notes, paymentStatus, downPayment, remainingBalance)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'partial', ?, ?)
        `, [
            Date.now(),
            new Date().toISOString().split('T')[0],
            JSON.stringify(_resItems),
            JSON.stringify(totals),
            'Deposit',
            JSON.stringify(customerInfo),
            receiptNum,
            user?.id || null,
            metaNotes,
            deposit,
            remaining
        ]);

        await saveDatabase();

        _resItems = [];
        closeNewReservationModal();
        renderReservationsList();

        showNotification(`✅ Reservation ${receiptNum} created! Deposit: $${deposit.toFixed(2)}, Remaining: $${remaining.toFixed(2)}`, 'success');
    } catch(e) {
        console.error('saveReservation error:', e);
        alert('Failed to save reservation: ' + e.message);
    }
}

// ─────────────────────────────────────────
// RESERVATIONS LIST
// ─────────────────────────────────────────

function renderReservationsList() {
    const container = document.getElementById('reservations-list');
    if (!container) return;

    try {
        const filterStatus  = document.getElementById('res-filter-status')?.value  || 'open';
        const filterVenueId = document.getElementById('res-filter-venue')?.value   || '';

        const sales = runQuery(`
            SELECT * FROM sales
            WHERE paymentStatus IN ('partial','paid')
              AND notes LIKE '%"_res":1%'
            ORDER BY timestamp DESC
        `);

        if (!sales || sales.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:60px 20px;color:#888;">
                    <div style="font-size:48px;margin-bottom:12px;">🗓️</div>
                    <p style="font-size:16px;font-weight:600;color:#ccc;">No reservations yet</p>
                    <p style="font-size:13px;">Click "＋ New Reservation" to create one</p>
                </div>`;
            return;
        }

        let filtered = sales.filter(s => {
            if (filterStatus === 'open')   return s.paymentStatus === 'partial';
            if (filterStatus === 'closed') return s.paymentStatus === 'paid';
            return true;
        });

        if (filterVenueId) {
            filtered = filtered.filter(s => {
                try { return String(JSON.parse(s.notes || '{}').venueId) === filterVenueId; }
                catch(e) { return false; }
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:40px;color:#888;">No ${filterStatus === 'all' ? '' : filterStatus} reservations${filterVenueId ? ' for this venue' : ''}.</div>`;
            return;
        }

        container.innerHTML = filtered.map(sale => {
            let meta = {};     try { meta     = JSON.parse(sale.notes      || '{}'); } catch(e) {}
            let customer = {}; try { customer = JSON.parse(sale.customerInfo || '{}'); } catch(e) {}
            let totals = {};   try { totals   = JSON.parse(sale.totals     || '{}'); } catch(e) {}

            const isClosed  = sale.paymentStatus === 'paid';
            const eventDate = meta.eventDate
                ? new Date(meta.eventDate + 'T00:00:00').toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})
                : '—';
            const isPast      = meta.eventDate && new Date(meta.eventDate + 'T00:00:00') < new Date();
            const statusBadge = isClosed
                ? `<span style="background:#10b981;color:#fff;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">✅ Closed</span>`
                : isPast
                    ? `<span style="background:#ef4444;color:#fff;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">⚠️ Overdue</span>`
                    : `<span style="background:#f59e0b;color:#000;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">🕐 Open</span>`;
            const venueBadge = meta.venueName
                ? `<span style="background:#1e3a5f;color:#58a6ff;padding:2px 8px;border-radius:10px;font-size:11px;">🏛️ ${meta.venueName}</span>`
                : '';

            return `
            <div style="background:#1a2035;border-radius:10px;padding:16px;margin-bottom:12px;border-left:4px solid ${isClosed ? '#10b981' : isPast ? '#ef4444' : '#f59e0b'};">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                    <div>
                        <div style="font-size:15px;font-weight:700;color:#e0e0e0;">🗓️ ${meta.eventName || 'Unnamed Event'}</div>
                        <div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap;">
                            <span style="font-size:12px;color:#888;">${sale.receiptNumber} · ${new Date(sale.timestamp).toLocaleDateString()}</span>
                            ${venueBadge}
                        </div>
                    </div>
                    ${statusBadge}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;color:#aaa;margin-bottom:12px;">
                    <div>📅 Event: <strong style="color:#ccc;">${eventDate}</strong></div>
                    <div>👤 ${customer.name || 'Walk-in'}${customer.phone ? ' · ' + customer.phone : ''}</div>
                    <div>💰 Total: <strong style="color:#ccc;">$${parseFloat(totals.total || 0).toFixed(2)}</strong></div>
                    <div>✅ Deposit: <strong style="color:#10b981;">$${parseFloat(sale.downPayment || 0).toFixed(2)}</strong></div>
                </div>
                ${!isClosed ? `
                <div style="background:#0d1420;border-radius:6px;padding:8px 12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#ef4444;font-weight:600;">Remaining: $${parseFloat(sale.remainingBalance || 0).toFixed(2)}</span>
                    ${meta.userNotes ? `<span style="color:#888;font-size:12px;">📝 ${meta.userNotes}</span>` : ''}
                </div>
                <button onclick="showCloseEventModal(${sale.id},'${sale.receiptNumber}',${parseFloat(sale.remainingBalance||0)})"
                    style="width:100%;padding:10px;background:#10b981;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
                    🎉 Close Event — Collect $${parseFloat(sale.remainingBalance||0).toFixed(2)}
                </button>` : `
                <div style="color:#10b981;font-size:13px;text-align:center;padding:8px;">
                    ✅ Fully paid on ${meta._closedAt ? new Date(meta._closedAt).toLocaleDateString() : '—'}
                </div>`}
            </div>`;
        }).join('');

    } catch(e) {
        console.error('renderReservationsList error:', e);
        container.innerHTML = `<div style="color:#ef4444;padding:20px;">Error loading reservations: ${e.message}</div>`;
    }
}

// ─────────────────────────────────────────
// VENUE MANAGEMENT
// ─────────────────────────────────────────

function renderVenuesList() {
    const container = document.getElementById('venues-list');
    if (!container) return;
    try {
        const venues = runQuery('SELECT * FROM venues ORDER BY name ASC') || [];
        if (!venues.length) {
            container.innerHTML = `<div style="text-align:center;padding:30px;color:#888;">No venues yet. Add one above.</div>`;
            return;
        }
        container.innerHTML = venues.map(v => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#1a2035;border-radius:8px;margin-bottom:8px;border-left:4px solid ${v.color || '#3b82f6'};">
                <div style="flex:1;">
                    <div style="font-size:14px;font-weight:600;color:#e0e0e0;">🏛️ ${v.name}</div>
                    ${v.description ? `<div style="font-size:12px;color:#888;margin-top:2px;">${v.description}</div>` : ''}
                    ${v.capacity ? `<div style="font-size:12px;color:#aaa;">Capacity: ${v.capacity}</div>` : ''}
                </div>
                <input type="color" value="${v.color || '#3b82f6'}" onchange="updateVenueColor(${v.id},this.value)"
                    style="width:32px;height:32px;border:none;background:none;cursor:pointer;border-radius:4px;" title="Change color">
                <button onclick="deleteVenue(${v.id})"
                    style="background:#ef4444;border:none;color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;">
                    Delete
                </button>
            </div>
        `).join('');
    } catch(e) {
        container.innerHTML = `<div style="color:#ef4444;">Error: ${e.message}</div>`;
    }
}

async function saveVenue() {
    const name     = document.getElementById('venue-name-input')?.value.trim();
    const color    = document.getElementById('venue-color-input')?.value || '#3b82f6';
    const capacity = parseInt(document.getElementById('venue-capacity-input')?.value) || 0;
    const desc     = document.getElementById('venue-desc-input')?.value.trim() || '';
    if (!name) { alert('Enter a venue name.'); return; }
    try {
        runExec('INSERT INTO venues (name, description, color, capacity) VALUES (?,?,?,?)', [name, desc, color, capacity]);
        await saveDatabase();
        document.getElementById('venue-name-input').value     = '';
        document.getElementById('venue-desc-input').value     = '';
        document.getElementById('venue-capacity-input').value = '';
        renderVenuesList();
        populateVenueFilters();
        showNotification(`✅ Venue "${name}" added.`, 'success');
    } catch(e) { alert('Failed to save venue: ' + e.message); }
}

async function deleteVenue(id) {
    if (!confirm('Delete this venue? Existing reservations keep their venue name.')) return;
    try {
        runExec('DELETE FROM venues WHERE id = ?', [id]);
        await saveDatabase();
        renderVenuesList();
        populateVenueFilters();
        showNotification('Venue deleted.', 'info');
    } catch(e) { alert('Failed to delete venue: ' + e.message); }
}

async function updateVenueColor(id, color) {
    try {
        runExec('UPDATE venues SET color = ? WHERE id = ?', [color, id]);
        await saveDatabase();
        renderVenuesList();
        populateVenueFilters();
    } catch(e) { console.warn('updateVenueColor:', e.message); }
}

function populateVenueFilters() {
    let venues = [];
    try { venues = runQuery('SELECT id, name, color FROM venues ORDER BY name ASC') || []; } catch(e) {}
    ['res-filter-venue','res-cal-venue-filter'].forEach(selId => {
        const sel = document.getElementById(selId);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = '<option value="">All Venues</option>';
        venues.forEach(v => {
            const opt       = document.createElement('option');
            opt.value       = v.id;
            opt.textContent = `🏛️ ${v.name}`;
            if (String(v.id) === cur) opt.selected = true;
            sel.appendChild(opt);
        });
    });
}

// ─────────────────────────────────────────
// CALENDAR
// ─────────────────────────────────────────

function prevCalMonth() {
    _calMonth--;
    if (_calMonth < 0) { _calMonth = 11; _calYear--; }
    renderCalendar();
}

function nextCalMonth() {
    _calMonth++;
    if (_calMonth > 11) { _calMonth = 0; _calYear++; }
    renderCalendar();
}

function renderCalendar() {
    const grid  = document.getElementById('res-calendar-grid');
    const label = document.getElementById('res-cal-month-label');
    if (!grid) return;

    const filterVenueId = document.getElementById('res-cal-venue-filter')?.value || '';
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    if (label) label.textContent = `${MONTHS[_calMonth]} ${_calYear}`;

    // Venue colors
    let venueColors = {};
    try { (runQuery('SELECT id, color FROM venues') || []).forEach(v => { venueColors[v.id] = v.color || '#3b82f6'; }); } catch(e) {}

    // Load reservations
    const monthStr = `${_calYear}-${String(_calMonth + 1).padStart(2,'0')}`;
    let sales = [];
    try {
        sales = runQuery(`SELECT notes, paymentStatus FROM sales
            WHERE notes LIKE '%"_res":1%' AND paymentStatus IN ('partial','paid')`) || [];
    } catch(e) {}

    // Build dayMap
    const dayMap = {};
    sales.forEach(s => {
        let meta = {}; try { meta = JSON.parse(s.notes || '{}'); } catch(e) {}
        if (!meta.eventDate || !meta.eventDate.startsWith(monthStr)) return;
        if (filterVenueId && String(meta.venueId) !== filterVenueId) return;
        if (!dayMap[meta.eventDate]) dayMap[meta.eventDate] = [];
        dayMap[meta.eventDate].push({
            eventName: meta.eventName || 'Event',
            venueName: meta.venueName || '',
            color:     venueColors[meta.venueId] || '#f59e0b',
            status:    s.paymentStatus
        });
    });

    const firstDay    = new Date(_calYear, _calMonth, 1).getDay();
    const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
    const today       = new Date();
    const todayStr    = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    let html = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;background:#1e2d45;border-radius:8px;overflow:hidden;">
        ${DAYS.map(d => `<div style="text-align:center;padding:8px 4px;font-size:12px;font-weight:600;color:#888;background:#0d1420;">${d}</div>`).join('')}`;

    for (let i = 0; i < firstDay; i++) html += `<div style="background:#0a0f1a;min-height:72px;"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr  = `${_calYear}-${String(_calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const bookings = dayMap[dateStr] || [];
        const isToday  = dateStr === todayStr;
        const isPast   = dateStr < todayStr;
        const hasBk    = bookings.length > 0;

        const dots = bookings.slice(0,4).map(b =>
            `<div style="width:7px;height:7px;border-radius:50%;background:${b.color};display:inline-block;margin:1px;" title="${b.eventName}${b.venueName?' · '+b.venueName:''}"></div>`
        ).join('');

        html += `
        <div onclick="${hasBk ? `showCalDayBookings('${dateStr}')` : ''}"
            style="background:${isToday ? '#1e3a5f' : '#0d1420'};min-height:72px;padding:6px;
                   cursor:${hasBk ? 'pointer' : 'default'};
                   border:1px solid ${isToday ? '#3b82f6' : 'transparent'};box-sizing:border-box;"
            onmouseover="if(${hasBk?1:0}) this.style.background='#1a2035'"
            onmouseout="this.style.background='${isToday ? '#1e3a5f' : '#0d1420'}'">
            <div style="font-size:13px;font-weight:600;color:${isToday ? '#3b82f6' : isPast ? '#444' : '#ccc'};">${day}</div>
            ${hasBk ? `
            <div style="margin-top:3px;">${dots}${bookings.length > 4 ? `<span style="font-size:9px;color:#888;">+${bookings.length-4}</span>` : ''}</div>
            <div style="font-size:10px;color:#aaa;margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
                ${bookings[0].eventName}${bookings.length > 1 ? ` +${bookings.length-1}` : ''}
            </div>` : ''}
        </div>`;
    }
    html += `</div>`;
    grid.innerHTML = html;
    const detail = document.getElementById('res-day-bookings');
    if (detail) detail.style.display = 'none';
}

function showCalDayBookings(dateStr) {
    const detail        = document.getElementById('res-day-bookings');
    if (!detail) return;
    const filterVenueId = document.getElementById('res-cal-venue-filter')?.value || '';

    let sales = [];
    try {
        sales = runQuery(`SELECT * FROM sales WHERE notes LIKE '%"_res":1%'
            AND notes LIKE ? AND paymentStatus IN ('partial','paid')`,
            [`%"eventDate":"${dateStr}"%`]) || [];
    } catch(e) { console.warn('showCalDayBookings:', e.message); }

    if (filterVenueId) {
        sales = sales.filter(s => {
            try { return String(JSON.parse(s.notes || '{}').venueId) === filterVenueId; } catch(e) { return false; }
        });
    }

    if (!sales.length) { detail.style.display = 'none'; return; }

    const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB',
        {weekday:'long',day:'numeric',month:'long',year:'numeric'});

    detail.innerHTML = `
        <div style="margin-top:16px;background:#1a2035;border-radius:10px;padding:16px;">
            <div style="font-size:14px;font-weight:600;color:#ccc;margin-bottom:12px;">📅 ${dateLabel}</div>
            ${sales.map(s => {
                let meta = {}; try { meta = JSON.parse(s.notes||'{}'); } catch(e) {}
                let cust = {}; try { cust = JSON.parse(s.customerInfo||'{}'); } catch(e) {}
                let tot  = {}; try { tot  = JSON.parse(s.totals||'{}'); } catch(e) {}
                const closed = s.paymentStatus === 'paid';
                return `
                <div style="border:1px solid #2a3a55;border-radius:8px;padding:12px;margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <strong style="color:#e0e0e0;">${meta.eventName || 'Unnamed'}</strong>
                        <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${closed?'#10b981':'#f59e0b'};color:${closed?'#fff':'#000'};">
                            ${closed ? '✅ Closed' : '🕐 Open'}
                        </span>
                    </div>
                    <div style="font-size:12px;color:#888;margin-top:6px;display:flex;flex-wrap:wrap;gap:8px;">
                        <span>👤 ${cust.name||'Walk-in'}${cust.phone?' · '+cust.phone:''}</span>
                        ${meta.venueName ? `<span>🏛️ ${meta.venueName}</span>` : ''}
                        <span>💰 $${parseFloat(tot.total||0).toFixed(2)}</span>
                        ${!closed ? `<span style="color:#ef4444;">Remaining: $${parseFloat(s.remainingBalance||0).toFixed(2)}</span>` : ''}
                    </div>
                    <div style="font-size:11px;color:#555;margin-top:4px;">${s.receiptNumber}</div>
                </div>`;
            }).join('')}
        </div>`;
    detail.style.display = 'block';
}

// ─────────────────────────────────────────
// CLOSE EVENT (COLLECT REMAINING PAYMENT)
// ─────────────────────────────────────────

function showCloseEventModal(saleId, receiptNumber, remaining) {
    document.getElementById('close-event-sale-id').value   = saleId;
    document.getElementById('close-event-receipt').textContent = receiptNumber;
    document.getElementById('close-event-remaining').textContent = `$${remaining.toFixed(2)}`;
    document.getElementById('close-event-amount').value    = remaining.toFixed(2);
    document.getElementById('close-event-amount').max      = remaining.toFixed(2);
    document.getElementById('close-event-modal').style.display = 'flex';
}

function closeCloseEventModal() {
    document.getElementById('close-event-modal').style.display = 'none';
}

async function confirmCloseEvent() {
    const saleId  = parseInt(document.getElementById('close-event-sale-id').value);
    const amount  = parseFloat(document.getElementById('close-event-amount').value) || 0;
    const method  = document.getElementById('close-event-method').value;

    if (!saleId || amount <= 0) { alert('Enter a valid payment amount.'); return; }

    try {
        // Get current sale
        const sales = runQuery('SELECT * FROM sales WHERE id = ?', [saleId]);
        if (!sales || sales.length === 0) { alert('Reservation not found.'); return; }
        const sale = sales[0];
        const newRemaining = Math.max(0, (sale.remainingBalance || 0) - amount);

        // Record in partial_payments table
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        runExec(`
            INSERT INTO partial_payments (saleId, amount, paymentMethod, timestamp, receiptNumber, cashierId, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            saleId,
            amount,
            method,
            new Date().toISOString(),
            sale.receiptNumber,
            user?.id || null,
            'Event close payment'
        ]);

        // Update sale
        const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

        // Store close date in notes JSON (sales table has no paidDate column)
        let updatedNotes = sale.notes || '{}';
        try {
            const parsed = JSON.parse(updatedNotes);
            if (newRemaining <= 0) parsed._closedAt = new Date().toISOString();
            updatedNotes = JSON.stringify(parsed);
        } catch(e) { /* leave notes as-is if not JSON */ }

        runExec(`
            UPDATE sales
            SET remainingBalance = ?,
                paymentStatus = ?,
                notes = ?
            WHERE id = ?
        `, [newRemaining, newStatus, updatedNotes, saleId]);

        await saveDatabase();
        closeCloseEventModal();
        renderReservationsList();

        const msg = newRemaining <= 0
            ? `✅ Event fully paid! Receipt ${sale.receiptNumber} closed.`
            : `💰 $${amount.toFixed(2)} received. Remaining: $${newRemaining.toFixed(2)}`;
        showNotification(msg, newRemaining <= 0 ? 'success' : 'info');

    } catch(e) {
        console.error('confirmCloseEvent error:', e);
        alert('Failed to record payment: ' + e.message);
    }
}

// ─────────────────────────────────────────
// NOTIFICATION HELPER (fallback)
// ─────────────────────────────────────────

function showNotification(message, type = 'info') {
    if (typeof showProgressNotification === 'function') {
        showProgressNotification(message, type);
        return;
    }
    // Fallback simple toast
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `position:fixed;bottom:24px;right:24px;padding:12px 20px;background:${type==='success'?'#10b981':type==='error'?'#ef4444':'#3b82f6'};color:#fff;border-radius:8px;font-size:14px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.4);`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}
