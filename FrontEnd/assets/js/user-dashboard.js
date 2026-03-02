// User Dashboard JavaScript
// API_BASE_URL is set by config.js
// getToken() is provided by navbar.js

// Get user data from localStorage
const getUserId = () => localStorage.getItem('userId');
const getUserName = () => localStorage.getItem('userName');
const getWarehouseId = () => localStorage.getItem('warehouseId');
const getWarehouseName = () => localStorage.getItem('warehouseName');
const getUserRole = () => localStorage.getItem('userRole');

// Check authentication (user-specific)
async function checkUserAuth() {
  const token = getToken();
  const userRole = getUserRole();
  
  if (!token) {
    window.location.href = 'user-login.html';
    return false;
  }
  
  // Validate token with backend
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${window.API_BASE_URL}/auth/validate`, {
      method: 'GET',
      headers: getHeaders(),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Token invalid or expired
      localStorage.clear();
      window.location.href = 'user-login.html';
      return false;
    }
  } catch (error) {
    // Only ignore AbortError (from timeout during rapid refresh)
    // All other errors (network errors, server down, etc.) should log out
    if (error.name === 'AbortError') {
      console.warn('⚠️ User auth request timeout - page might be refreshing');
      // Don't logout on timeout, allow page to continue
      return true;
    }
    
    // For ALL other errors (including network errors), log out
    // This includes: server down, server restart, connection refused, etc.
    console.error('Auth validation error:', error.message || error);
    console.log('🚪 Logging out and redirecting to login...');
    localStorage.clear();
    window.location.href = 'user-login.html';
    return false;
  }
  
  // Redirect admins to admin dashboard
  if (userRole === 'admin') {
    window.location.href = 'admin.html';
    return false;
  }

  // Redirect managers with multiple warehouses if no warehouse is currently selected
  if (userRole === 'manager') {
    const warehouseId = localStorage.getItem('warehouseId');
    const managerWarehouses = localStorage.getItem('managerWarehouses');
    if (!warehouseId && managerWarehouses) {
      try {
        const whs = JSON.parse(managerWarehouses);
        if (Array.isArray(whs) && whs.length > 1) {
          window.location.href = 'manager-warehouse-select.html';
          return false;
        }
      } catch (_) {}
    }
  }
  
  return true;
}

// Heartbeat mechanism for user dashboard
let userHeartbeatInterval = null;

function startUserAuthHeartbeat() {
  // Clear any existing interval
  if (userHeartbeatInterval) {
    clearInterval(userHeartbeatInterval);
  }
  
  // Check immediately
  silentUserTokenCheck();
  
  // Then check every 30 seconds
  userHeartbeatInterval = setInterval(() => {
    silentUserTokenCheck();
  }, 30000); // 30 seconds
  
  console.log('🔄 User auth heartbeat started - checking token every 30 seconds');
}

// Silent token validation for user
async function silentUserTokenCheck() {
  const token = getToken();
  
  if (!token) {
    if (userHeartbeatInterval) {
      clearInterval(userHeartbeatInterval);
    }
    return;
  }
  
  try {
    const response = await fetch(`${window.API_BASE_URL}/auth/validate`, {
      method: 'GET',
      headers: getHeaders()
    });
    
    if (!response.ok) {
      console.warn('🚨 User token validation failed during heartbeat check');
      console.log('🔄 Server instance changed - logging out...');
      
      if (userHeartbeatInterval) {
        clearInterval(userHeartbeatInterval);
      }
      
      localStorage.clear();
      window.location.href = 'user-login.html';
    } else {
      console.log('✅ User heartbeat: Token still valid');
    }
  } catch (error) {
    console.warn('⚠️ User heartbeat check failed:', error.message);
    
    // Retry once after 2 seconds
    setTimeout(async () => {
      try {
        const retryResponse = await fetch(`${window.API_BASE_URL}/auth/validate`, {
          method: 'GET',
          headers: getHeaders()
        });
        
        if (!retryResponse.ok) {
          console.error('🚨 User token invalid after server restart');
          if (userHeartbeatInterval) clearInterval(userHeartbeatInterval);
          localStorage.clear();
          window.location.href = 'user-login.html';
        }
      } catch (retryError) {
        console.error('🚨 Server unreachable - logging out user');
        if (userHeartbeatInterval) clearInterval(userHeartbeatInterval);
        localStorage.clear();
        window.location.href = 'user-login.html';
      }
    }, 2000);
  }
}

// API Headers with token
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

// Switch back to warehouse selection (managers with multiple warehouses)
function switchWarehouse() {
  // Clear current warehouse selection so the select page doesn't skip itself
  localStorage.removeItem('warehouseId');
  localStorage.removeItem('warehouseName');
  localStorage.removeItem('warehouseCode');
  window.location.href = '/pages/manager-warehouse-select.html';
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  // Validate authentication first
  const isAuthenticated = await checkUserAuth();
  if (!isAuthenticated) return;

  // Display user and warehouse info
  document.getElementById('userName').textContent = getUserName() || 'User';
  document.getElementById('warehouseName').textContent = getWarehouseName() || 'Warehouse';

  // Show "Switch Warehouse" button for managers who have multiple warehouses
  const userRole = getUserRole();
  const managerWarehouses = localStorage.getItem('managerWarehouses');
  if (userRole === 'manager' && managerWarehouses) {
    try {
      const whs = JSON.parse(managerWarehouses);
      if (Array.isArray(whs) && whs.length > 1) {
        const switchBtn = document.getElementById('switchWarehouseNavItem');
        if (switchBtn) switchBtn.classList.remove('d-none');
      }
    } catch (_) {}
  }
  if (userRole === 'viewer') {
    // Hide Stock In and Stock Out action cards
    const quickActionsContainer = document.querySelector('.card-body .row.g-4');
    if (quickActionsContainer) {
      const stockInCard = quickActionsContainer.children[0]; // First column (Stock In)
      const stockOutCard = quickActionsContainer.children[1]; // Second column (Stock Out)
      
      if (stockInCard) stockInCard.style.display = 'none';
      if (stockOutCard) stockOutCard.style.display = 'none';
      
      // Make View Products take full width
      const viewProductsCard = quickActionsContainer.children[2];
      if (viewProductsCard) {
        viewProductsCard.className = 'col-12';
      }
    }
  }

  // Load dashboard data
  loadDashboardStats();
  
  // Start heartbeat to detect server restarts
  const token = getToken();
  if (token) {
    startUserAuthHeartbeat();
  }
  
  // Add visual feedback while loading
  console.log('✅ [User Dashboard] Initialization complete');
  console.log('👤 [User Dashboard] User info:', {
    name: getUserName(),
    warehouse: getWarehouseName(),
    role: getUserRole()
  });
});

// Load dashboard statistics
async function loadDashboardStats() {
  try {
    console.log('🔄 [User Dashboard] Loading stats...');
    console.log('🔑 [User Dashboard] API URL:', window.API_BASE_URL);
    console.log('🔑 [User Dashboard] Token:', getToken() ? 'Present' : 'Missing');
    console.log('🔑 [User Dashboard] Headers:', getHeaders());
    
    // Pass the currently-selected warehouseId so the backend uses the correct warehouse
    // (critical for managers who selected a warehouse from the multi-warehouse select page)
    const selectedWarehouseId = getWarehouseId();
    const statsUrl = selectedWarehouseId
      ? `${window.API_BASE_URL}/user-dashboard/stats?warehouseId=${encodeURIComponent(selectedWarehouseId)}`
      : `${window.API_BASE_URL}/user-dashboard/stats`;

    const response = await fetch(statsUrl, {
      headers: getHeaders()
    });

    console.log('📥 [User Dashboard] Response status:', response.status);
    
    if (!response.ok) {
      if (response.status === 401) {
        console.log('❌ [User Dashboard] Unauthorized - clearing storage');
        localStorage.clear();
        window.location.href = 'user-login.html';
        return;
      }
      const errorText = await response.text();
      console.error('❌ [User Dashboard] Response error:', errorText);
      throw new Error('Failed to load dashboard stats');
    }

    const data = await response.json();
    console.log('📦 [User Dashboard] Data received:', data);
    
    if (data.success && data.data) {
      console.log('✅ [User Dashboard] Updating dashboard with data:', data.data);
      
      // Save user data to localStorage and update the DOM from the verified API response.
      // The init code already set DOM from localStorage, but localStorage can be stale
      // (e.g. from a previous session). Refreshing the DOM here ensures the correct
      // logged-in user's name is always shown in the navbar.
      if (data.data.user) {
        console.log('💾 [User Dashboard] Saving user data to localStorage');
        if (data.data.user._id) localStorage.setItem('userId', data.data.user._id);
        localStorage.setItem('userName', data.data.user.name);
        localStorage.setItem('userEmail', data.data.user.email);
        localStorage.setItem('userRole', data.data.user.role);
        // Always refresh the navbar name from the API-verified data
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = data.data.user.name || getUserName() || 'User';
      }
      
      // Only update the warehouse display text — do NOT overwrite warehouseId/warehouseName
      // in localStorage as that would clobber the warehouse the manager selected.
      // If the user has no warehouse in localStorage yet (first login edge-case), save it.
      if (data.data.warehouse) {
        if (!localStorage.getItem('warehouseId')) {
          console.log('💾 [User Dashboard] No warehouse in localStorage, saving from API response');
          localStorage.setItem('warehouseId', data.data.warehouse._id);
          localStorage.setItem('warehouseName', data.data.warehouse.name);
          localStorage.setItem('warehouseCode', data.data.warehouse.code || '');
        }
        // Always keep the DOM in sync with the warehouse the stats were fetched for
        const whNameEl = document.getElementById('warehouseName');
        if (whNameEl) whNameEl.textContent = getWarehouseName() || data.data.warehouse.name || 'Warehouse';
      }
      
      updateDashboardStats(data.data);
    } else {
      console.error('⚠️ [User Dashboard] Invalid data structure:', data);
      showAlert(`API returned: ${data.message || 'Unknown error'}`, 'warning');
    }
  } catch (error) {
    console.error('💥 [User Dashboard] Error loading dashboard stats:', error);
    console.error('💥 [User Dashboard] Error stack:', error.stack);
    showAlert('Failed to load dashboard data: ' + error.message, 'danger');
  }
}

// Update dashboard statistics
function updateDashboardStats(data) {
  console.log('📊 [User Dashboard] updateDashboardStats called with:', data);
  
  const { stats, lowStockProducts, recentTransactions } = data;
  
  console.log('📊 Stats:', stats);
  console.log('📦 Low stock products:', lowStockProducts);
  console.log('💰 Recent transactions:', recentTransactions);

  // Update stat cards
  const totalProductsEl = document.getElementById('totalProducts');
  const lowStockCountEl = document.getElementById('lowStockCount');
  const totalQuantityEl = document.getElementById('totalQuantity');
  const totalValueEl = document.getElementById('totalValue');
  
  console.log('🎯 DOM Elements:', {
    totalProducts: totalProductsEl,
    lowStockCount: lowStockCountEl,
    totalQuantity: totalQuantityEl,
    totalValue: totalValueEl
  });
  
  if (totalProductsEl) totalProductsEl.textContent = stats.totalProducts || 0;
  if (lowStockCountEl) lowStockCountEl.textContent = stats.lowStockCount || 0;
  if (totalQuantityEl) totalQuantityEl.textContent = stats.totalQuantity || 0;
  if (totalValueEl) totalValueEl.textContent = typeof window.formatPrice === 'function' ? window.formatPrice(stats.totalValue || 0) : `Rs ${(stats.totalValue || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;  

  console.log('✅ [User Dashboard] Stats updated');

  // Display low stock items
  displayLowStockItems(lowStockProducts || []);

  // Display recent transactions
  displayRecentTransactions(recentTransactions || []);
}

// Display low stock items
function displayLowStockItems(items) {
  const container = document.getElementById('lowStockItems');
  
  if (items.length === 0) {
    container.innerHTML = '<p class="text-muted text-center mb-0">No low stock items</p>';
    return;
  }

  container.innerHTML = items.map(item => {
    // Backend aggregation returns warehouseQuantity and minStockLevel directly
    const quantity = item.warehouseQuantity || 0;
    const minStock = item.minStockLevel || 0;
    
    return `
      <div class="alert alert-warning mb-2">
        <strong>${item.name}</strong><br>
        <small>SKU: ${item.sku}</small><br>
        <small>Stock: ${quantity} / Min: ${minStock}</small>
      </div>
    `;
  }).join('');
}

// Display recent transactions
function displayRecentTransactions(transactions) {
  const tbody = document.getElementById('recentTransactions');
  
  if (transactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No recent transactions</td></tr>';
    return;
  }

  tbody.innerHTML = transactions.map(transaction => {
    const date = new Date(transaction.createdAt).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const typeBadge = transaction.type === 'stock_in' ? 'success' : 
                      transaction.type === 'stock_out' ? 'danger' : 'info';
    const typeText = transaction.type.replace('_', ' ').toUpperCase();
    
    return `
      <tr>
        <td>${date}</td>
        <td>
          <strong>${transaction.product?.name || 'N/A'}</strong><br>
          <small class="text-muted">${transaction.product?.sku || ''}</small>
        </td>
        <td><span class="badge bg-${typeBadge}">${typeText}</span></td>
        <td>${transaction.quantity}</td>
        <td>${transaction.performedBy?.name || 'System'}</td>
      </tr>
    `;
  }).join('');
}

// View warehouse products
function viewWarehouseProducts() {
  // You can create a separate page or modal for this
  showAlert('Products view coming soon', 'info');
}

// Logout function
function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.clear();
    window.location.href = 'user-login.html';
  }
}

// Show alert function
function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
  alertDiv.style.zIndex = '9999';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(alertDiv);

  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}
