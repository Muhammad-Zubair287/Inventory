/**
 * Navbar JavaScript - Admin Name Display and Global Functions
 * Fetches and displays the logged-in admin's name across all pages
 * Provides global authentication functions
 */

// Use API_BASE_URL from config.js (loaded before this script)
// Fallback to localhost if config.js hasn't set it yet
window.API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001/api';

// Global API error handler - intercepts 401 errors and logs out
window.handleApiError = function(response, data) {
  // Check for session expired / unauthorized errors
  if (response.status === 401) {
    console.warn('Session expired or invalid. Logging out...');
    sessionStorage.clear();
    window.location.href = '/pages/login.html';
    return true; // Error was handled
  }
  return false; // Error not handled, let caller handle it
};

// Get user from sessionStorage
function getUser() {
  const userStr = sessionStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      console.error('Error parsing user data:', e);
    }
  }
  return null;
}

// Get token from sessionStorage (exposed globally for other scripts)
function getToken() {
  return sessionStorage.getItem('token');
}
window.getToken = getToken; // Make globally accessible

// Update admin name and profile image in navbar
function updateAdminName() {
  const user = getUser();
  const UPLOAD_BASE_URL = window.API_BASE_URL.replace('/api', '');
  
  console.log('Updating navbar with user:', user);
  
  if (user) {
    // Display the user's name
    const displayName = user.name || user.username || 'Admin User';
    const displayEmail = user.email || '';
    const displayRole = user.role || 'Administrator';
    
    // Update all name elements
    document.querySelectorAll('.user-display-name, .admin-name').forEach(el => {
      el.textContent = displayName;
    });
    
    // Update all email elements
    document.querySelectorAll('.user-display-email').forEach(el => {
      el.textContent = displayEmail;
    });
    
    // Update all role elements
    document.querySelectorAll('.user-display-role').forEach(el => {
      el.textContent = displayRole;
    });
    
    // Update profile image
    const profileImage = user.profileImage;
    if (profileImage) {
      const imageUrl = profileImage.startsWith('http') 
        ? profileImage 
        : `${UPLOAD_BASE_URL}${profileImage}`;
      
      document.querySelectorAll('#navbar-profile-img, .navbar-profile-img').forEach(img => {
        img.src = imageUrl;
      });
    } else {
      // Use avatar with user's name
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
      document.querySelectorAll('#navbar-profile-img, .navbar-profile-img').forEach(img => {
        img.src = avatarUrl;
      });
    }
  }
}

// Handle logout
function handleLogout() {
  // Get user role to determine which login page to redirect to
  const userRole = sessionStorage.getItem('userRole');

  // Clear per-tab session storage
  sessionStorage.clear();

  // Redirect to appropriate login page
  if (userRole === 'admin') {
    window.location.href = 'login.html';
  } else {
    window.location.href = 'user-login.html';
  }
}

// Check authentication
async function checkAuth() {
  const token = getToken();
  const userRole = sessionStorage.getItem('userRole');
  console.log('🔐 [navbar.js] Checking authentication...');
  console.log('🔐 [navbar.js] User role:', userRole);
  
  if (!token) {
    console.warn('⚠️ [navbar.js] No token found, redirecting to login');
    // Redirect based on user role
    if (userRole === 'admin') {
      window.location.href = 'login.html';
    } else {
      window.location.href = 'user-login.html';
    }
    return false;
  }
  
  // Validate token with backend
  try {
    console.log('🔐 [navbar.js] Validating token with backend...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${window.API_BASE_URL}/auth/validate`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log('📡 [navbar.js] Response status:', response.status);
    
    if (!response.ok) {
      // Token invalid or expired (401, 403, etc.)
      console.error('❌ [navbar.js] Token validation failed. Logging out...');
      sessionStorage.clear();
      // Redirect based on user role
      if (userRole === 'admin') {
        window.location.href = 'login.html';
      } else {
        window.location.href = 'user-login.html';
      }
      return false;
    }
    
    console.log('✅ [navbar.js] Token validated successfully');
    return true;
  } catch (error) {
    // Only ignore AbortError (from timeout during rapid refresh)
    // All other errors (network errors, server down, etc.) should log out
    if (error.name === 'AbortError') {
      console.warn('⚠️ [navbar.js] Request timeout - page might be refreshing');
      // Don't logout on timeout, could be rapid refresh
      return true; // Allow page to load, token still exists
    }
    
    // For ALL other errors (including network errors), log out
    // This includes: server down, server restart, connection refused, etc.
    console.error('❌ [navbar.js] Auth validation error:', error.message || error);
    console.log('🚪 [navbar.js] Logging out and redirecting to login...');
    sessionStorage.clear();
    // Redirect based on user role
    if (userRole === 'admin') {
      window.location.href = 'login.html';
    } else {
      window.location.href = 'user-login.html';
    }
    return false;
  }
}
window.checkAuth = checkAuth; // Make globally accessible

// Heartbeat mechanism - Check token validity every 30 seconds
let heartbeatInterval = null;

function startAuthHeartbeat() {
  // Clear any existing interval
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  // Check immediately
  silentTokenCheck();
  
  // Then check every 30 seconds
  heartbeatInterval = setInterval(() => {
    silentTokenCheck();
  }, 30000); // 30 seconds
  
  console.log('🔄 Auth heartbeat started - checking token every 30 seconds');
}

// Silent token validation (doesn't show alerts, just logs out if invalid)
async function silentTokenCheck() {
  const token = getToken();
  
  if (!token) {
    // No token, stop heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    return;
  }
  
  try {
    const response = await fetch(`${window.API_BASE_URL}/auth/validate`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      // Token invalid (server restarted with new instance ID)
      console.warn('🚨 Token validation failed during heartbeat check');
      console.log('🔄 Server instance changed - logging out...');
      
      // Stop heartbeat
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      // Clear session and redirect
      sessionStorage.clear();
      window.location.href = '/pages/login.html';
    } else {
      console.log('✅ Heartbeat: Token still valid');
    }
  } catch (error) {
    // Network error - server might be down
    console.warn('⚠️ Heartbeat check failed:', error.message);
    
    // If it's a network error, the server might be restarting
    // Try one more time after 2 seconds
    setTimeout(async () => {
      try {
        const retryResponse = await fetch(`${window.API_BASE_URL}/auth/validate`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!retryResponse.ok) {
          console.error('🚨 Token invalid after server restart');
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          sessionStorage.clear();
          window.location.href = '/pages/login.html';
        }
      } catch (retryError) {
        console.error('🚨 Server unreachable - logging out');
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        sessionStorage.clear();
        window.location.href = '/pages/login.html';
      }
    }, 2000);
  }
}

// Initialize navbar
document.addEventListener('DOMContentLoaded', function() {
  // Check if this is a user-specific page (don't run global auth check)
  const isUserPage = window.location.pathname.includes('user-');
  
  // Check authentication (only if admin-auth.js is not present and not a user page)
  if (typeof window.adminAuth === 'undefined' && !isUserPage) {
    checkAuth();
  }
  
  // Update admin name
  updateAdminName();
  
  // Make updateAdminName globally accessible
  window.updateAdminName = updateAdminName;
  
  // Listen for storage changes (profile updates from settings page)
  window.addEventListener('storage', function(e) {
    if (e.key === 'user' && e.newValue) {
      updateAdminName();
    }
  });
  
  // Also listen for custom event for same-page updates
  window.addEventListener('userProfileUpdated', function() {
    updateAdminName();
  });
  
  // Add logout event listeners to all logout buttons
  // Only if admin-auth.js is not handling it
  if (typeof setupLogoutButtons === 'undefined') {
    const logoutButtons = document.querySelectorAll('.logout-btn');
    logoutButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        handleLogout();
      });
    });
  }
  
  // Initialize global navbar search
  initializeGlobalSearch();
  
  // Start auth heartbeat to detect server restarts
  const token = getToken();
  if (token) {
    startAuthHeartbeat();
  }
});

// Global Search Functionality
function initializeGlobalSearch() {
  const navbarSearch = document.getElementById('navbarGlobalSearch');
  if (!navbarSearch) return;
  
  // Debounce function for search
  let searchTimeout;
  
  navbarSearch.addEventListener('input', function(e) {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length === 0) {
      hideSearchResults();
      return;
    }
    
    if (query.length < 2) {
      return; // Wait for at least 2 characters
    }
    
    searchTimeout = setTimeout(() => {
      performGlobalSearch(query);
    }, 300);
  });
  
  // Close search results when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.global-search-container')) {
      hideSearchResults();
    }
  });
}

async function performGlobalSearch(query) {
  const token = getToken();
  if (!token) return;
  
  try {
    // Search in multiple endpoints
    const [products, suppliers, warehouses, users] = await Promise.allSettled([
      fetch(`${window.API_BASE_URL}/products?search=${encodeURIComponent(query)}&limit=3`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.ok ? res.json() : { data: [] }),
      
      fetch(`${window.API_BASE_URL}/suppliers?search=${encodeURIComponent(query)}&limit=3`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.ok ? res.json() : { data: [] }),
      
      fetch(`${window.API_BASE_URL}/warehouses?search=${encodeURIComponent(query)}&limit=3`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.ok ? res.json() : { data: [] }),
      
      fetch(`${window.API_BASE_URL}/users?search=${encodeURIComponent(query)}&limit=3`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.ok ? res.json() : { data: [] })
    ]);
    
    displaySearchResults({
      products: products.status === 'fulfilled' ? products.value.data : [],
      suppliers: suppliers.status === 'fulfilled' ? suppliers.value.data : [],
      warehouses: warehouses.status === 'fulfilled' ? warehouses.value.data : [],
      users: users.status === 'fulfilled' ? users.value.data : []
    });
  } catch (error) {
    console.error('Global search error:', error);
  }
}

function displaySearchResults(results) {
  let resultsContainer = document.getElementById('globalSearchResults');
  
  // Create results container if it doesn't exist
  if (!resultsContainer) {
    resultsContainer = document.createElement('div');
    resultsContainer.id = 'globalSearchResults';
    resultsContainer.className = 'position-absolute bg-white border rounded-3 shadow-lg mt-1 p-3';
    resultsContainer.style.cssText = 'top: 100%; left: 0; right: 0; max-height: 500px; overflow-y: auto; z-index: 1050;';
    
    const searchContainer = document.querySelector('.global-search-container');
    if (searchContainer) {
      searchContainer.style.position = 'relative';
      searchContainer.appendChild(resultsContainer);
    }
  }
  
  // Build results HTML
  let html = '';
  let hasResults = false;
  
  // Products
  if (results.products && results.products.length > 0) {
    hasResults = true;
    html += `
      <div class="mb-3">
        <h6 class="text-muted text-uppercase small fw-bold mb-2">
          <i class="bi bi-box-seam me-1"></i> Products
        </h6>
        <div class="list-group list-group-flush">
    `;
    results.products.forEach(product => {
      html += `
        <a href="/pages/products.html" class="list-group-item list-group-item-action border-0 py-2">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-semibold">${product.name}</div>
              <small class="text-muted">SKU: ${product.sku} | Qty: ${product.quantity}</small>
            </div>
            <i class="bi bi-arrow-right text-muted"></i>
          </div>
        </a>
      `;
    });
    html += `</div></div>`;
  }
  
  // Suppliers
  if (results.suppliers && results.suppliers.length > 0) {
    hasResults = true;
    html += `
      <div class="mb-3">
        <h6 class="text-muted text-uppercase small fw-bold mb-2">
          <i class="bi bi-building me-1"></i> Suppliers
        </h6>
        <div class="list-group list-group-flush">
    `;
    results.suppliers.forEach(supplier => {
      html += `
        <a href="/pages/suppliers.html" class="list-group-item list-group-item-action border-0 py-2">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-semibold">${supplier.name}</div>
              <small class="text-muted">${supplier.email || supplier.contactPerson || ''}</small>
            </div>
            <i class="bi bi-arrow-right text-muted"></i>
          </div>
        </a>
      `;
    });
    html += `</div></div>`;
  }
  
  // Warehouses
  if (results.warehouses && results.warehouses.length > 0) {
    hasResults = true;
    html += `
      <div class="mb-3">
        <h6 class="text-muted text-uppercase small fw-bold mb-2">
          <i class="bi bi-house me-1"></i> Warehouses
        </h6>
        <div class="list-group list-group-flush">
    `;
    results.warehouses.forEach(warehouse => {
      html += `
        <a href="/pages/warehouses.html" class="list-group-item list-group-item-action border-0 py-2">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-semibold">${warehouse.name}</div>
              <small class="text-muted">${warehouse.location || ''}</small>
            </div>
            <i class="bi bi-arrow-right text-muted"></i>
          </div>
        </a>
      `;
    });
    html += `</div></div>`;
  }
  
  // Users
  if (results.users && results.users.length > 0) {
    hasResults = true;
    html += `
      <div class="mb-3">
        <h6 class="text-muted text-uppercase small fw-bold mb-2">
          <i class="bi bi-people me-1"></i> Users
        </h6>
        <div class="list-group list-group-flush">
    `;
    results.users.forEach(user => {
      html += `
        <a href="manage-users.html" class="list-group-item list-group-item-action border-0 py-2">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-semibold">${user.name}</div>
              <small class="text-muted">${user.email}</small>
            </div>
            <i class="bi bi-arrow-right text-muted"></i>
          </div>
        </a>
      `;
    });
    html += `</div></div>`;
  }
  
  if (!hasResults) {
    html = `
      <div class="text-center py-4">
        <i class="bi bi-search text-muted" style="font-size: 2rem;"></i>
        <p class="text-muted mt-2 mb-0">No results found</p>
      </div>
    `;
  }
  
  resultsContainer.innerHTML = html;
  resultsContainer.style.display = 'block';
}

function hideSearchResults() {
  const resultsContainer = document.getElementById('globalSearchResults');
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
}
// Initialize currency selector
function initCurrencySelector() {
  // Find currency dropdown containers
  const currencyContainers = document.querySelectorAll('.currency-selector-container');
  
  currencyContainers.forEach((container, index) => {
    const currentCurrency = getUserCurrency();
    const icon = currentCurrency === 'USD' ? '$' : 'Rs';
    const uniqueId = `currencyDropdown${index}`;
    
    // Get exchange rate info if available
    let exchangeRateInfo = '';
    if (typeof window.getExchangeRateInfo === 'function') {
      const info = window.getExchangeRateInfo();
      const lastUpdate = typeof window.getLastUpdateTime === 'function' ? window.getLastUpdateTime() : 'Unknown';
      exchangeRateInfo = `
        <li><hr class="dropdown-divider"></li>
        <li class="px-3 py-2">
          <div class="small text-muted">
            <div class="d-flex justify-content-between">
              <span>Exchange Rate:</span>
              <span class="fw-semibold">1 USD = ${info.usdToPkr.toFixed(2)} PKR</span>
            </div>
            <div class="d-flex justify-content-between mt-1">
              <span>Last Updated:</span>
              <span>${lastUpdate}</span>
            </div>
            <button class="btn btn-link btn-sm p-0 mt-1 refresh-rate-btn" type="button" style="font-size: 0.75rem;">
              <i class="bi bi-arrow-clockwise"></i> Refresh Rate
            </button>
          </div>
        </li>
      `;
    }
    
    // Create currency selector HTML
    container.innerHTML = `
      <div class="dropdown">
        <button class="btn btn-outline-secondary btn-sm dropdown-toggle d-flex align-items-center gap-1" 
                type="button" 
                id="${uniqueId}" 
                data-bs-toggle="dropdown" 
                aria-expanded="false">
          <i class="bi ${currentCurrency === 'USD' ? 'bi-currency-dollar' : 'bi-cash'}"></i>
          <span class="currency-label">${currentCurrency}</span>
        </button>
        <ul class="dropdown-menu dropdown-menu-end shadow-sm" aria-labelledby="${uniqueId}" style="min-width: 280px;">
          <li><h6 class="dropdown-header">Select Currency</h6></li>
          <li>
            <button class="dropdown-item currency-option ${currentCurrency === 'PKR' ? 'active' : ''}" 
               type="button"
               data-currency="PKR">
              <i class="bi bi-cash me-2"></i>PKR - Pakistani Rupee
            </button>
          </li>
          <li>
            <button class="dropdown-item currency-option ${currentCurrency === 'USD' ? 'active' : ''}" 
               type="button"
               data-currency="USD">
              <i class="bi bi-currency-dollar me-2"></i>USD - US Dollar
            </button>
          </li>
          ${exchangeRateInfo}
        </ul>
      </div>
    `;
    
    // Add event listeners for currency options
    container.querySelectorAll('.currency-option').forEach(option => {
      option.addEventListener('click', async (e) => {
        e.preventDefault();
        const newCurrency = e.currentTarget.dataset.currency;
        await handleCurrencyChange(newCurrency);
      });
    });
    
    // Add event listener for refresh button
    const refreshBtn = container.querySelector('.refresh-rate-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Show loading state
        refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise spinner-border spinner-border-sm"></i> Updating...';
        refreshBtn.disabled = true;
        
        // Refresh rate
        if (typeof window.refreshExchangeRate === 'function') {
          await window.refreshExchangeRate();
        }
        
        // Reinitialize to show new rate
        setTimeout(() => {
          initCurrencySelector();
        }, 500);
      });
    }
  });
}

// Handle currency change
async function handleCurrencyChange(newCurrency) {
  try {
    // Update localStorage
    setUserCurrency(newCurrency);
    
    // Update backend
    const token = getToken();
    if (token) {
      const response = await fetch(`${window.API_BASE_URL}/users/update-currency`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currency: newCurrency })
      });
      
      if (response.ok) {
        console.log('Currency updated successfully');
      }
    }
    
    // Update UI
    updateCurrencyDisplay(newCurrency);
    
    // Reload page to apply currency changes
    window.location.reload();
    
  } catch (error) {
    console.error('Error updating currency:', error);
  }
}

// Update currency display in selector
function updateCurrencyDisplay(currency) {
  const labels = document.querySelectorAll('.currency-label');
  const buttons = document.querySelectorAll('[id^="currencyDropdown"]');
  
  labels.forEach(label => {
    label.textContent = currency;
  });
  
  buttons.forEach(button => {
    const icon = button.querySelector('i');
    if (icon) {
      icon.className = currency === 'USD' ? 'bi bi-currency-dollar' : 'bi bi-cash';
    }
  });
  
  // Update active state
  document.querySelectorAll('.currency-option').forEach(option => {
    if (option.dataset.currency === currency) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
}

// Make functions globally accessible
window.initCurrencySelector = initCurrencySelector;
window.handleCurrencyChange = handleCurrencyChange;
window.updateCurrencyDisplay = updateCurrencyDisplay;