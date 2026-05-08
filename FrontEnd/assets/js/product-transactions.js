// Product Transaction History
// Reads productId & productName from URL query params
// API_BASE_URL provided by config.js, getToken() by navbar.js

console.log('📊 [ProductTx] Script loaded');

// ── State ──────────────────────────────────────────────────────────────────
let productId   = null;
let productName = '';
let currentPage = 1;
const PAGE_SIZE = 20;

// Active filter state
let activeFrom = null;   // ISO string or null
let activeTo   = null;   // ISO string or null
let activePreset = 'all';

// ── Helpers ────────────────────────────────────────────────────────────────
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
});

const formatTxPrice = (amount) => {
  if (typeof window.formatPrice === 'function') return window.formatPrice(amount);
  return 'Rs ' + new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const isoDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';

// ── Preset → date range mapping ────────────────────────────────────────────
function presetToDates(preset) {
  const now  = new Date();
  const from = new Date();
  switch (preset) {
    case 'today':  from.setHours(0, 0, 0, 0);               break;
    case '2days':  from.setDate(now.getDate() - 1);          break;
    case '1week':  from.setDate(now.getDate() - 7);          break;
    case '2weeks': from.setDate(now.getDate() - 14);         break;
    case '1month': from.setMonth(now.getMonth() - 1);        break;
    case '1year':  from.setFullYear(now.getFullYear() - 1);  break;
    case 'all':
    default: return { from: null, to: null };
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

const PRESET_LABELS = {
  today: 'Today',
  '2days': 'Last 2 Days',
  '1week': 'Last 1 Week',
  '2weeks': 'Last 2 Weeks',
  '1month': 'Last 1 Month',
  '1year': 'Last 1 Year',
  all: 'All Time',
};

// ── Load transaction history ───────────────────────────────────────────────
async function loadTransactions(page = 1) {
  currentPage = page;
  const container = document.getElementById('transactionsContent');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading…</span>
      </div>
      <p class="text-muted mt-3">Loading transactions…</p>
    </div>`;

  try {
    const params = new URLSearchParams({ page, limit: PAGE_SIZE });
    if (activeFrom) params.append('startDate', activeFrom);
    if (activeTo)   params.append('endDate',   activeTo);

    const response = await fetch(
      `${window.API_BASE_URL}/transactions/product/${productId}?${params}`,
      { headers: getHeaders() }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Server error ${response.status}`);
    }

    const result = await response.json();
    const { transactions = [], pagination = {} } = result.data || {};

    renderTransactions(transactions, pagination);
    updateProductInfoStats(transactions);
  } catch (err) {
    console.error('❌ [ProductTx] Error:', err);
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle me-2"></i>
        <strong>Error:</strong> ${err.message}
      </div>`;
  }
}

// ── Detail modal ──────────────────────────────────────────────────────────
let txDetailModal = null;

function openDetailModal(t) {
  if (!txDetailModal) {
    txDetailModal = new bootstrap.Modal(document.getElementById('txDetailModal'));
  }

  const isIn = t.type === 'stock_in';
  const typeBadge = isIn
    ? '<span class="badge bg-success fs-6"><i class="bi bi-plus-circle me-1"></i>Stock In</span>'
    : '<span class="badge bg-danger  fs-6"><i class="bi bi-dash-circle me-1"></i>Stock Out</span>';

  // Header colour
  const header = document.getElementById('txDetailModalHeader');
  header.className = `modal-header ${isIn ? 'bg-success' : 'bg-danger'} text-white`;
  header.querySelector('.btn-close').className = 'btn-close btn-close-white';

  // Warehouse location string
  const wh = t.warehouse || {};
  const loc = wh.location || {};
  const locationParts = [loc.address, loc.city, loc.state, loc.country, loc.zipCode].filter(Boolean);
  const locationStr = locationParts.length ? locationParts.join(', ') : '—';

  // Performed by
  const by = t.performedBy || {};
  const byStr = by.name ? `${by.name}${by.email ? ` &lt;${by.email}&gt;` : ''}${by.role ? ` · <em>${by.role}</em>` : ''}` : '—';

  // Approved by
  const approvedBy = t.approvedBy;
  const approvedStr = approvedBy?.name ? `${approvedBy.name}${approvedBy.email ? ` &lt;${approvedBy.email}&gt;` : ''}` : '—';

  // Supplier
  const sup = t.supplier || {};
  const supStr = sup.name ? `${sup.name}${sup.company ? ` — ${sup.company}` : ''}${sup.phone ? ` · ${sup.phone}` : ''}` : '—';

  // Transaction date (use transactionDate field if available, fall back to createdAt)
  const txDateStr  = fmtDateFull(t.transactionDate || t.createdAt);
  const createdStr = fmtDateFull(t.createdAt);

  document.getElementById('txDetailModalLabel').innerHTML =
    `<i class="bi bi-receipt me-2"></i>${t.transactionNumber || 'Transaction Detail'}`;

  document.getElementById('txDetailModalBody').innerHTML = `
    <div class="row g-0 mb-3">
      <div class="col-12 d-flex align-items-center gap-3 p-3 rounded" style="background:#f8f9fa;">
        ${typeBadge}
        <div>
          <div class="fw-bold fs-5">${escapeHtml(t.product?.name || productName)}</div>
          <div class="text-muted small">SKU: ${t.product?.sku || '—'} &nbsp;|&nbsp; Category: ${t.product?.category || '—'}</div>
        </div>
        <div class="ms-auto text-end">
          <div class="text-muted small">Total Value</div>
          <div class="fw-bold fs-5">${formatTxPrice((t.quantity || 0) * (t.unitPrice || 0))}</div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <!-- Left column -->
      <div class="col-md-6">
        <div class="card h-100 border-0 shadow-sm">
          <div class="card-header bg-light fw-semibold">
            <i class="bi bi-info-circle me-2 text-primary"></i>Transaction Info
          </div>
          <div class="card-body">
            <table class="table table-sm table-borderless mb-0">
              <tbody>
                <tr>
                  <td class="text-muted fw-semibold" style="width:45%;">Transaction #</td>
                  <td><code>${t.transactionNumber || '—'}</code></td>
                </tr>
                <tr>
                  <td class="text-muted fw-semibold">Reference #</td>
                  <td>${t.referenceNumber || '—'}</td>
                </tr>
                <tr>
                  <td class="text-muted fw-semibold">Status</td>
                  <td><span class="badge bg-success">${t.status || 'completed'}</span></td>
                </tr>
                <tr>
                  <td class="text-muted fw-semibold">Transaction Date</td>
                  <td>${txDateStr}</td>
                </tr>
                <tr>
                  <td class="text-muted fw-semibold">Recorded At</td>
                  <td>${createdStr}</td>
                </tr>
                <tr>
                  <td class="text-muted fw-semibold">Quantity</td>
                  <td><strong>${(t.quantity || 0).toLocaleString()} units</strong></td>
                </tr>
                <tr>
                  <td class="text-muted fw-semibold">Unit Price</td>
                  <td>${formatTxPrice(t.unitPrice || 0)}</td>
                </tr>
                <tr>
                  <td class="text-muted fw-semibold">Total Value</td>
                  <td><strong>${formatTxPrice((t.quantity || 0) * (t.unitPrice || 0))}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="col-md-6">
        <div class="card border-0 shadow-sm mb-3">
          <div class="card-header bg-light fw-semibold">
            <i class="bi bi-building me-2 text-primary"></i>Warehouse
          </div>
          <div class="card-body">
            <table class="table table-sm table-borderless mb-0">
              <tbody>
                <tr>
                  <td class="text-muted fw-semibold" style="width:45%;">Name</td>
                  <td><strong>${escapeHtml(wh.name || '—')}</strong></td>
                </tr>
                <tr>
                  <td class="text-muted fw-semibold">Code</td>
                  <td><code>${wh.code || '—'}</code></td>
                </tr>
                <tr>
                  <td class="text-muted fw-semibold">Location</td>
                  <td>${escapeHtml(locationStr)}</td>
                </tr>
                ${wh.contactPerson ? `<tr><td class="text-muted fw-semibold">Contact</td><td>${escapeHtml(wh.contactPerson)}</td></tr>` : ''}
                ${wh.phone ? `<tr><td class="text-muted fw-semibold">Phone</td><td>${escapeHtml(wh.phone)}</td></tr>` : ''}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card border-0 shadow-sm">
          <div class="card-header bg-light fw-semibold">
            <i class="bi bi-person me-2 text-primary"></i>People
          </div>
          <div class="card-body">
            <table class="table table-sm table-borderless mb-0">
              <tbody>
                <tr>
                  <td class="text-muted fw-semibold" style="width:45%;">Performed By</td>
                  <td>${byStr}</td>
                </tr>
                <tr>
                  <td class="text-muted fw-semibold">Approved By</td>
                  <td>${approvedStr}</td>
                </tr>
                <tr>
                  <td class="text-muted fw-semibold">Supplier</td>
                  <td>${supStr}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Notes & Reason full width -->
      ${(t.notes || t.reason) ? `
      <div class="col-12">
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-light fw-semibold">
            <i class="bi bi-chat-left-text me-2 text-primary"></i>Notes &amp; Reason
          </div>
          <div class="card-body">
            ${t.reason ? `<p class="mb-1"><span class="fw-semibold text-muted">Reason:</span> ${escapeHtml(t.reason)}</p>` : ''}
            ${t.notes  ? `<p class="mb-0"><span class="fw-semibold text-muted">Notes:</span> ${escapeHtml(t.notes)}</p>`  : ''}
          </div>
        </div>
      </div>` : ''}
    </div>
  `;

  txDetailModal.show();
}

// Full date + time formatter for modal
const fmtDateFull = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

// ── Render table ───────────────────────────────────────────────────────────
function renderTransactions(transactions, pagination) {
  const container = document.getElementById('transactionsContent');

  const totalIn  = transactions.filter(t => t.type === 'stock_in') .reduce((s, t) => s + t.quantity, 0);
  const totalOut = transactions.filter(t => t.type === 'stock_out').reduce((s, t) => s + t.quantity, 0);

  container.innerHTML = `
    <!-- Mini stats -->
    <div class="row g-3 mb-4">
      <div class="col-md-4">
        <div class="card" style="border-left:4px solid #0d6efd;">
          <div class="card-body d-flex align-items-center gap-3">
            <i class="bi bi-receipt fs-2 text-primary"></i>
            <div>
              <div class="text-muted small fw-semibold">Total Transactions</div>
              <div class="h4 mb-0 fw-bold">${pagination.total || transactions.length}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card" style="border-left:4px solid #198754;">
          <div class="card-body d-flex align-items-center gap-3">
            <i class="bi bi-plus-circle fs-2 text-success"></i>
            <div>
              <div class="text-muted small fw-semibold">Stock In (this page)</div>
              <div class="h4 mb-0 fw-bold text-success">${totalIn.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card" style="border-left:4px solid #dc3545;">
          <div class="card-body d-flex align-items-center gap-3">
            <i class="bi bi-dash-circle fs-2 text-danger"></i>
            <div>
              <div class="text-muted small fw-semibold">Stock Out (this page)</div>
              <div class="h4 mb-0 fw-bold text-danger">${totalOut.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="card">
      <div class="card-header bg-white d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h5 class="mb-0">
          <i class="bi bi-clock-history me-2"></i>
          ${escapeHtml(productName)} — Transaction History
        </h5>
        <div class="d-flex align-items-center gap-3">
          <small class="text-muted"><i class="bi bi-hand-index me-1"></i>Click any row for full details</small>
          <small class="text-muted">
            ${pagination.total > 0
              ? `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, pagination.total)} of ${pagination.total}`
              : '0 records'}
          </small>
        </div>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover table-striped mb-0" id="txHistoryTable">
            <thead class="table-light">
              <tr>
                <th>Transaction #</th>
                <th>Date &amp; Time</th>
                <th class="text-center">Type</th>
                <th class="text-end">Quantity</th>
                <th class="text-end">Unit Price</th>
                <th class="text-end">Total Value</th>
                <th>Warehouse</th>
                <th>Performed By</th>
                <th>Supplier</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.length === 0 ? `
                <tr>
                  <td colspan="9" class="text-center text-muted py-5">
                    <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                    No transactions found for the selected period
                  </td>
                </tr>
              ` : transactions.map(t => {
                const isIn     = t.type === 'stock_in';
                const typeBadge = isIn
                  ? '<span class="badge bg-success"><i class="bi bi-plus-circle me-1"></i>Stock In</span>'
                  : '<span class="badge bg-danger"><i class="bi bi-dash-circle me-1"></i>Stock Out</span>';

                const wh = t.warehouse || {};
                const loc = wh.location || {};
                const city = loc.city ? ` <small class="text-muted d-block">${loc.city}${loc.state ? ', ' + loc.state : ''}</small>` : '';
                const warehouseCell = `<strong>${wh.name || '—'}</strong>${wh.code ? ` <code class="ms-1">${wh.code}</code>` : ''}${city}`;

                // Encode the full transaction as JSON for the click handler
                const tJson = escapeAttr(JSON.stringify(t));

                return `
                  <tr style="cursor:pointer;" title="Click for full details" data-tx="${tJson}">
                    <td><code class="small">${t.transactionNumber || '—'}</code></td>
                    <td style="white-space:nowrap;"><small>${fmtDate(t.createdAt)}</small></td>
                    <td class="text-center">${typeBadge}</td>
                    <td class="text-end fw-bold">${t.quantity.toLocaleString()}</td>
                    <td class="text-end">${formatTxPrice(t.unitPrice || 0)}</td>
                    <td class="text-end fw-semibold">${formatTxPrice((t.quantity || 0) * (t.unitPrice || 0))}</td>
                    <td>${warehouseCell}</td>
                    <td>${t.performedBy?.name || '—'}</td>
                    <td>${t.supplier?.name || '—'}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${pagination.pages > 1 ? `
      <div class="card-footer bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
        <small class="text-muted">Page ${pagination.page} of ${pagination.pages}</small>
        <nav>
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item ${currentPage <= 1 ? 'disabled' : ''}">
              <button class="page-link" onclick="loadTransactions(${currentPage - 1})">
                <i class="bi bi-chevron-left"></i>
              </button>
            </li>
            ${Array.from({ length: pagination.pages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === pagination.pages || Math.abs(p - currentPage) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map(p => p === '...'
                ? `<li class="page-item disabled"><span class="page-link">…</span></li>`
                : `<li class="page-item ${p === currentPage ? 'active' : ''}">
                     <button class="page-link" onclick="loadTransactions(${p})">${p}</button>
                   </li>`
              ).join('')}
            <li class="page-item ${currentPage >= pagination.pages ? 'disabled' : ''}">
              <button class="page-link" onclick="loadTransactions(${currentPage + 1})">
                <i class="bi bi-chevron-right"></i>
              </button>
            </li>
          </ul>
        </nav>
      </div>` : ''}
    </div>
  `;
}

// ── Update product info card stats from current page data ──────────────────
function updateProductInfoStats(transactions) {
  const totalIn  = transactions.filter(t => t.type === 'stock_in') .reduce((s, t) => s + t.quantity, 0);
  const totalOut = transactions.filter(t => t.type === 'stock_out').reduce((s, t) => s + t.quantity, 0);

  const inEl  = document.getElementById('infoTotalIn');
  const outEl = document.getElementById('infoTotalOut');
  if (inEl)  inEl.textContent  = totalIn.toLocaleString();
  if (outEl) outEl.textContent = totalOut.toLocaleString();
}

// ── Active filter badge ────────────────────────────────────────────────────
function updateFilterBadge() {
  const badge    = document.getElementById('activeFilterBadge');
  const badgeText = document.getElementById('activeFilterText');
  if (!badge || !badgeText) return;

  if (activePreset === 'all' && !activeFrom && !activeTo) {
    badge.classList.add('d-none');
    return;
  }

  let label;
  if (activePreset !== 'all' && PRESET_LABELS[activePreset]) {
    label = PRESET_LABELS[activePreset];
  } else if (activeFrom || activeTo) {
    const f = activeFrom ? isoDate(activeFrom) : '…';
    const t = activeTo   ? isoDate(activeTo)   : 'now';
    label = `${f} → ${t}`;
  } else {
    label = 'Custom Range';
  }

  badgeText.textContent = label;
  badge.classList.remove('d-none');
}

// ── Export CSV ─────────────────────────────────────────────────────────────
async function exportCsv() {
  try {
    // Fetch all data (no pagination) for export
    const params = new URLSearchParams({ page: 1, limit: 10000 });
    if (activeFrom) params.append('startDate', activeFrom);
    if (activeTo)   params.append('endDate',   activeTo);

    const response = await fetch(
      `${window.API_BASE_URL}/transactions/product/${productId}?${params}`,
      { headers: getHeaders() }
    );

    if (!response.ok) throw new Error('Failed to fetch data for export');

    const result   = await response.json();
    const rows     = result.data?.transactions || [];

    const headers  = [
      'Transaction #', 'Reference #', 'Date', 'Transaction Date', 'Type', 'Status',
      'Quantity', 'Unit Price', 'Total Value',
      'Warehouse Name', 'Warehouse Code', 'Warehouse City', 'Warehouse State',
      'Performed By', 'Performed By Email',
      'Supplier', 'Reason', 'Notes',
    ];
    const csvRows  = [headers];

    rows.forEach(t => {
      const wh  = t.warehouse  || {};
      const loc = wh.location  || {};
      const by  = t.performedBy || {};
      const sup = t.supplier    || {};
      csvRows.push([
        t.transactionNumber || '',
        t.referenceNumber   || '',
        fmtDate(t.createdAt),
        fmtDate(t.transactionDate || t.createdAt),
        t.type === 'stock_in' ? 'Stock In' : 'Stock Out',
        t.status || 'completed',
        t.quantity,
        t.unitPrice || 0,
        (t.quantity || 0) * (t.unitPrice || 0),
        wh.name  || '',
        wh.code  || '',
        loc.city  || '',
        loc.state || '',
        by.name  || '',
        by.email || '',
        sup.name || '',
        (t.reason || '').replace(/"/g, '""'),
        (t.notes  || '').replace(/"/g, '""'),
      ]);
    });

    const csvContent = csvRows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob  = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url   = URL.createObjectURL(blob);
    const link  = document.createElement('a');
    const fname = `${productName.replace(/\s+/g, '_')}_transactions_${new Date().toISOString().split('T')[0]}.csv`;

    link.href = url;
    link.download = fname;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Export failed: ' + err.message);
  }
}

// ── Escape HTML helper ─────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Escape for HTML attribute (data-tx JSON)
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Populate product info card (from URL / optional API call) ──────────────
async function loadProductInfo() {
  const card     = document.getElementById('productInfoCard');
  const subtitle = document.getElementById('productSubtitle');

  if (card) card.style.display = 'flex';

  const nameEl = document.getElementById('infoProductName');
  const skuEl  = document.getElementById('infoProductSku');
  const catEl  = document.getElementById('infoProductCategory');
  const curEl  = document.getElementById('infoCurrentStock');

  if (nameEl) nameEl.textContent = productName || '—';
  if (subtitle) subtitle.textContent = `Viewing full history for: ${productName}`;

  // Try to load extra product details from the products API
  try {
    const res  = await fetch(`${window.API_BASE_URL}/products/${productId}`, { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      const p    = data.data || {};
      if (nameEl) nameEl.textContent = p.name || productName;
      if (skuEl)  skuEl.textContent  = p.sku  || '—';
      if (catEl)  catEl.textContent  = p.category || '—';
      if (curEl)  {
        const qty = p.quantity || 0;
        curEl.textContent = qty.toLocaleString();
        curEl.className   = `h5 mb-0 fw-bold ${qty > 0 ? 'text-success' : 'text-danger'}`;
      }
      // Update page title
      if (subtitle) subtitle.textContent = `Viewing full history for: ${p.name || productName}`;
      document.title = `${p.name || productName} — Transaction History`;
    }
  } catch (_) {
    // Non-fatal — basic info already shown from URL params
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Parse URL params
  const urlParams  = new URLSearchParams(window.location.search);
  productId   = urlParams.get('productId');
  productName = decodeURIComponent(urlParams.get('productName') || 'Product');

  if (!productId) {
    document.getElementById('transactionsContent').innerHTML = `
      <div class="alert alert-warning">
        <i class="bi bi-exclamation-triangle me-2"></i>
        No product selected. <a href="reports.html">Go back to Reports</a>.
      </div>`;
    return;
  }

  // Update page subtitle immediately from URL
  const subtitle = document.getElementById('productSubtitle');
  if (subtitle) subtitle.textContent = `Viewing full history for: ${productName}`;

  // Product info
  await loadProductInfo();

  // Initial load (all time)
  await loadTransactions(1);

  // ── Row click → detail modal ────────────────────────────────────────────
  // Use event delegation so it works after every re-render
  document.getElementById('transactionsContent').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-tx]');
    if (!row) return;
    try {
      const tx = JSON.parse(row.dataset.tx);
      openDetailModal(tx);
    } catch (_) {}
  });

  // ── Preset buttons ──────────────────────────────────────────────────────
  document.querySelectorAll('.preset-btn[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const preset = btn.dataset.preset;
      activePreset = preset;

      const { from, to } = presetToDates(preset);
      activeFrom = from;
      activeTo   = to;

      // Clear custom inputs when using preset
      document.getElementById('fromDate').value = from ? isoDate(from) : '';
      document.getElementById('toDate').value   = to   ? isoDate(to)   : '';

      updateFilterBadge();
      loadTransactions(1);
    });
  });

  // ── Custom apply ────────────────────────────────────────────────────────
  document.getElementById('applyCustomDate').addEventListener('click', () => {
    const from = document.getElementById('fromDate').value;
    const to   = document.getElementById('toDate').value;

    if (!from && !to) {
      alert('Please select at least one date.');
      return;
    }

    // Deactivate presets
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    activePreset = 'custom';

    activeFrom = from ? new Date(from).toISOString() : null;
    activeTo   = to   ? new Date(to + 'T23:59:59').toISOString() : null;

    updateFilterBadge();
    loadTransactions(1);
  });

  // ── Clear filter ────────────────────────────────────────────────────────
  document.getElementById('clearDateFilter').addEventListener('click', () => {
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value   = '';

    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.preset-btn[data-preset="all"]').classList.add('active');

    activePreset = 'all';
    activeFrom   = null;
    activeTo     = null;

    updateFilterBadge();
    loadTransactions(1);
  });

  // ── Export ──────────────────────────────────────────────────────────────
  document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
});
