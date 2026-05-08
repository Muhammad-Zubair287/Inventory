/**
 * Manager Warehouse Selection
 * Displays all warehouses the logged-in manager can access.
 * Clicking a warehouse stores it in localStorage and enters the dashboard.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken() {
  return sessionStorage.getItem('token');
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

function handleLogout() {
  // Clear per-tab session storage
  sessionStorage.clear();
  window.location.href = '/pages/login.html';
}

// Make handleLogout available globally (called from inline HTML onclick)
window.handleLogout = handleLogout;

// ─── UI helpers ───────────────────────────────────────────────────────────────

function showState(state) {
  // state: 'loading' | 'error' | 'empty' | 'grid'
  document.getElementById('loadingState').style.display  = state === 'loading' ? 'block' : 'none';
  document.getElementById('errorState').style.display   = state === 'error'   ? 'block' : 'none';
  document.getElementById('emptyState').style.display   = state === 'empty'   ? 'block' : 'none';

  const grid = document.getElementById('warehouseGrid');
  if (state === 'grid') {
    grid.style.removeProperty('display'); // remove the inline display:none
    grid.style.display = 'flex';          // Bootstrap row needs to be flex
    grid.classList.add('d-flex');
  } else {
    grid.style.display = 'none';
  }
}

function setErrorMessage(msg) {
  document.getElementById('errorMessage').textContent = msg || 'Something went wrong.';
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function statusBadge(status) {
  const map = {
    active:      { cls: 'bg-success',   label: 'Active'      },
    inactive:    { cls: 'bg-secondary', label: 'Inactive'    },
    maintenance: { cls: 'bg-warning text-dark', label: 'Maintenance' },
    full:        { cls: 'bg-danger',    label: 'Full'        },
  };
  const s = map[status] || { cls: 'bg-secondary', label: status || 'Unknown' };
  return `<span class="badge badge-status ${s.cls}">${s.label}</span>`;
}

// ─── Render warehouses ────────────────────────────────────────────────────────

function renderWarehouses(warehouses) {
  const grid = document.getElementById('warehouseGrid');
  grid.innerHTML = '';

  warehouses.forEach((wh, idx) => {
    const id       = wh._id   || wh.id   || wh;
    const name     = wh.name  || 'Warehouse';
    const code     = wh.code  || '';
    const location = wh.location || '';
    const status   = wh.status   || 'active';

    // Column sizing: up to 4 across on large screens, 2 on md, 1 on small
    const col = document.createElement('div');
    col.className = 'col-12 col-sm-6 col-md-4 col-lg-3';

    col.innerHTML = `
      <div
        class="warehouse-card h-100"
        tabindex="0"
        role="button"
        aria-label="Enter ${name}"
        data-id="${id}"
        data-name="${name}"
        data-code="${code}"
        data-status="${status}"
      >
        <div class="warehouse-icon">
          <i class="bi bi-building"></i>
        </div>
        <div class="warehouse-code">${code}</div>
        <div class="warehouse-name">${name}</div>
        ${location ? `<div class="warehouse-location"><i class="bi bi-geo-alt me-1"></i>${location}</div>` : ''}
        <div class="mt-2">${statusBadge(status)}</div>
        <div class="enter-label">
          <i class="bi bi-arrow-right-circle me-1"></i>Enter Warehouse
        </div>
      </div>
    `;

    // Click handler
    const card = col.querySelector('.warehouse-card');
    card.addEventListener('click', () => selectWarehouse(wh));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') selectWarehouse(wh);
    });

    grid.appendChild(col);
  });

  showState('grid');
}

// ─── Select a warehouse ───────────────────────────────────────────────────────

function selectWarehouse(wh) {
  const id   = wh._id   || wh.id   || wh;
  const name = wh.name  || '';
  const code = wh.code  || '';

  sessionStorage.setItem('warehouseId',   id);
  sessionStorage.setItem('warehouseName', name);
  sessionStorage.setItem('warehouseCode', code);

  // Navigate into the warehouse dashboard
  window.location.href = '/pages/user-dashboard.html';
}

// ─── Load warehouses ──────────────────────────────────────────────────────────

async function loadWarehouses() {
  showState('loading');

  // Try localStorage first (populated at login time)
  const cached = sessionStorage.getItem('managerWarehouses');
  if (cached) {
    try {
      const warehouses = JSON.parse(cached);
      if (Array.isArray(warehouses) && warehouses.length > 0) {
        // If objects only have IDs, fetch full details from the API
        if (typeof warehouses[0] === 'string' || !warehouses[0].name) {
          await fetchWarehouseDetails(warehouses.map(w => w._id || w.id || w));
        } else {
          renderWarehouses(warehouses);
        }
        return;
      }
    } catch (_) { /* fall through to API */ }
  }

  // Fallback: fetch from API
  await fetchAllManagerWarehouses();
}

async function fetchWarehouseDetails(ids) {
  try {
    // Fetch each warehouse detail in parallel
    const results = await Promise.all(
      ids.map(id =>
        fetch(`${window.API_BASE_URL}/warehouses/${id}`, { headers: getHeaders() })
          .then(r => (r.ok ? r.json() : null))
          .then(d => (d && d.data ? d.data : null))
      )
    );
    const valid = results.filter(Boolean);
    if (valid.length === 0) {
      showState('empty');
    } else {
      // Cache enriched data
      sessionStorage.setItem('managerWarehouses', JSON.stringify(valid));
      renderWarehouses(valid);
    }
  } catch (err) {
    console.error('[WarehouseSelect] fetchWarehouseDetails error:', err);
    setErrorMessage('Could not load warehouse details. Please try again.');
    showState('error');
  }
}

async function fetchAllManagerWarehouses() {
  try {
    const response = await fetch(`${window.API_BASE_URL}/auth/me`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleLogout();
        return;
      }
      throw new Error('Failed to load user profile');
    }

    const data = await response.json();
    const user = data.data || data.user || data;
    const warehouses = user.warehouses || [];

    if (warehouses.length === 0) {
      showState('empty');
      return;
    }

    sessionStorage.setItem('managerWarehouses', JSON.stringify(warehouses));
    renderWarehouses(warehouses);
  } catch (err) {
    console.error('[WarehouseSelect] fetchAllManagerWarehouses error:', err);
    setErrorMessage(err.message || 'Could not load warehouses. Please try again.');
    showState('error');
  }
}

// ─── Auth check ───────────────────────────────────────────────────────────────

async function checkAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = '/pages/login.html';
    return false;
  }

  const userRole = sessionStorage.getItem('userRole');
  if (userRole === 'admin') {
    window.location.href = '/pages/admin.html';
    return false;
  }

  // Validate token silently
  try {
    const res = await fetch(`${window.API_BASE_URL}/auth/validate`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      sessionStorage.clear();
      window.location.href = '/pages/login.html';
      return false;
    }
  } catch (_) {
    // Allow offline/timeout — don't log out
  }

  return true;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await checkAuth();
  if (!ok) return;

  // Display manager name
  const name = sessionStorage.getItem('userName') || 'Manager';
  document.getElementById('managerName').textContent = name;
  document.getElementById('managerNameHeader').textContent = name;

  await loadWarehouses();
});
