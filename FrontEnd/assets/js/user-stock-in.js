// User Stock In JavaScript
// API_BASE_URL is set by config.js
// getToken() is provided by navbar.js

console.log('📦 [Stock-In] Page loaded');
console.log('📦 [Stock-In] Initial localStorage check:', {
  token: localStorage.getItem('token') ? 'EXISTS' : 'MISSING',
  userRole: localStorage.getItem('userRole') || 'MISSING',
  userName: localStorage.getItem('userName') || 'MISSING',
  warehouseId: localStorage.getItem('warehouseId') || 'MISSING',
  warehouseName: localStorage.getItem('warehouseName') || 'MISSING',
  allKeys: Object.keys(localStorage)
});

// Store products data for searching
let productsData = [];

// Get user data from local storage
function getUser() {
  const userRole = localStorage.getItem('userRole');
  const userName = localStorage.getItem('userName');
  const warehouseId = localStorage.getItem('warehouseId');
  const warehouseName = localStorage.getItem('warehouseName');
  
  if (userRole && userName) {
    return { role: userRole, name: userName, warehouseId, warehouseName };
  }
  return null;
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

// Check authentication (user-specific for stock-in)
async function checkStockInAuth() {
  console.log('🔐 [Stock-In] Starting authentication check...');
  console.log('🔐 [Stock-In] window.getToken exists?', typeof window.getToken);
  console.log('🔐 [Stock-In] getToken exists?', typeof getToken);
  
  const user = getUser();
  const token = window.getToken ? window.getToken() : localStorage.getItem('token');
  
  console.log('🔐 [Stock-In] User:', user);
  console.log('🔐 [Stock-In] Token:', token ? 'Present (' + token.substring(0, 20) + '...)' : 'Missing');
  console.log('🔐 [Stock-In] API URL:', window.API_BASE_URL);
  console.log('🔐 [Stock-In] localStorage contents:', {
    token: localStorage.getItem('token') ? 'exists' : 'missing',
    userRole: localStorage.getItem('userRole'),
    userName: localStorage.getItem('userName'),
    warehouseId: localStorage.getItem('warehouseId')
  });
  
  if (!user || !token) {
    console.error('❌ [Stock-In] No user or token found. Redirecting to login...');
    console.error('❌ [Stock-In] User check:', !user ? 'FAILED' : 'PASSED');
    console.error('❌ [Stock-In] Token check:', !token ? 'FAILED' : 'PASSED');
    window.location.href = 'user-login.html';
    return false;
  }
  
  // Validate token with backend
  try {
    console.log('🔐 [Stock-In] Validating token with backend...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${window.API_BASE_URL}/auth/validate`, {
      method: 'GET',
      headers: getHeaders(),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log('📡 [Stock-In] Response status:', response.status);
    
    if (!response.ok) {
      // Token invalid or expired
      console.error('❌ [Stock-In] Token validation failed. Status:', response.status);
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ [Stock-In] Error data:', errorData);
      localStorage.clear();
      window.location.href = 'user-login.html';
      return false;
    }
    
    console.log('✅ [Stock-In] Token validated successfully');
  } catch (error) {
    // Only ignore AbortError (from timeout during rapid refresh)
    if (error.name === 'AbortError') {
      console.warn('⚠️ [Stock-In] Request timeout - page might be refreshing');
      return true; // Allow page to continue
    }
    
    // For all other errors, log out
    console.error('❌ [Stock-In] Auth validation error:', error);
    console.error('❌ [Stock-In] Error name:', error.name);
    console.error('❌ [Stock-In] Error message:', error.message);
    localStorage.clear();
    window.location.href = 'user-login.html';
    return false;
  }
  
  // Redirect admin to admin panel
  if (user.role === 'admin') {
    console.log('🔀 [Stock-In] Admin detected, redirecting to admin panel...');
    window.location.href = 'admin.html';
    return false;
  }

  // Redirect manager back to warehouse selection if no warehouse chosen
  if (user.role === 'manager') {
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

  console.log('✅ [Stock-In] Authentication successful');
  return true;
  
  // Redirect VIEWER role to dashboard (no stock operations allowed)
  if (user.role === 'viewer') {
    showAlert('Viewers do not have permission to perform stock operations', 'warning');
    setTimeout(() => {
      window.location.href = 'user-dashboard.html';
    }, 2000);
    return false;
  }
  
  return true;
}

// Logout handler
function handleLogout() {
  localStorage.clear();
  window.location.href = 'user-login.html';
}

// Switch warehouse (managers only)
function switchWarehouse() {
  localStorage.removeItem('warehouseId');
  localStorage.removeItem('warehouseName');
  localStorage.removeItem('warehouseCode');
  window.location.href = 'manager-warehouse-select.html';
}

// Show alert
function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
  alertDiv.style.zIndex = '9999';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(alertDiv);
  setTimeout(() => alertDiv.remove(), 5000);
}

// Load products
async function loadProducts() {
  try {
    const user = getUser();
    const response = await fetch(`${window.API_BASE_URL}/products`, {
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Failed to load products');

    const data = await response.json();
    
    // Store products globally for searching
    if (data.data && data.data.products && Array.isArray(data.data.products)) {
      productsData = data.data.products;
      console.log('Loaded', productsData.length, 'products for searching');
      
      // Enable the search input
      const productSearch = document.getElementById('productSearch');
      if (productSearch) {
        productSearch.placeholder = `Search ${productsData.length} products by name or SKU...`;
        productSearch.disabled = false;
      }
    } else {
      productsData = [];
      const productSearch = document.getElementById('productSearch');
      if (productSearch) {
        productSearch.placeholder = 'No products available';
        productSearch.disabled = true;
      }
    }
  } catch (error) {
    console.error('Error loading products:', error);
    showAlert('Failed to load products', 'danger');
    productsData = [];
  }
}

// Load suppliers
async function loadSuppliers() {
  try {
    const response = await fetch(`${window.API_BASE_URL}/suppliers/active`, {
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Failed to load suppliers');

    const data = await response.json();
    const supplierSelect = document.getElementById('supplier');
    
    console.log('Suppliers response:', data);
    
    // Clear existing options except the first one (placeholder)
    supplierSelect.innerHTML = '<option value="">Select Supplier (Optional)</option>';
    
    // Check if data.data is an array
    const suppliers = Array.isArray(data.data) ? data.data : [];
    
    if (suppliers.length === 0) {
      console.warn('No active suppliers found');
      return;
    }
    
    suppliers.forEach(supplier => {
      const option = document.createElement('option');
      option.value = supplier._id;
      option.textContent = supplier.name;
      supplierSelect.appendChild(option);
    });
    
    console.log(`Loaded ${suppliers.length} suppliers`);
  } catch (error) {
    console.error('Error loading suppliers:', error);
    showAlert('Failed to load suppliers', 'danger');
  }
}

// Load recent transactions
async function loadRecentTransactions() {
  try {
    const user = getUser();
    console.log('📊 [Stock-In] Loading recent transactions for warehouse:', user.warehouseId);
    
    const response = await fetch(
      `${window.API_BASE_URL}/transactions?warehouse=${user.warehouseId}&type=stock_in&limit=10`,
      { headers: getHeaders() }
    );

    console.log('📊 [Stock-In] Transactions response status:', response.status);

    if (!response.ok) {
      console.error('❌ [Stock-In] Failed to load transactions');
      throw new Error('Failed to load transactions');
    }

    const data = await response.json();
    console.log('📊 [Stock-In] Transactions data:', data);
    
    const tbody = document.getElementById('recentTransactions');
    
    if (!data.data || !data.data.transactions || data.data.transactions.length === 0) {
      console.log('ℹ️ [Stock-In] No transactions found');
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No recent transactions</td></tr>';
      return;
    }

    console.log('✅ [Stock-In] Found', data.data.transactions.length, 'transactions');
    tbody.innerHTML = data.data.transactions.map(t => `
      <tr>
        <td>${new Date(t.transactionDate).toLocaleDateString()}</td>
        <td>${t.product?.name || 'N/A'}</td>
        <td>${t.quantity}</td>
        <td>${typeof window.formatPrice === 'function' ? window.formatPrice(t.unitPrice || 0) : `$${t.unitPrice.toFixed(2)}`}</td>
        <td>${typeof window.formatPrice === 'function' ? window.formatPrice((t.quantity * t.unitPrice) || 0) : `$${(t.quantity * t.unitPrice).toFixed(2)}`}</td>
        <td>${t.supplier?.name || 'N/A'}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('💥 [Stock-In] Error loading transactions:', error);
  }
}

// Handle product selection
document.addEventListener('DOMContentLoaded', async () => {
  // Validate authentication first
  const isAuthenticated = await checkStockInAuth();
  if (!isAuthenticated) return;

  const user = getUser();
  
  // Set user info
  document.getElementById('userName').textContent = user.name;
  document.getElementById('warehouseName').textContent = user.warehouseName;
  document.getElementById('warehouse').value = user.warehouseName;
  document.getElementById('warehouseId').value = user.warehouseId;
  document.getElementById('currentWarehouseName').textContent = user.warehouseName;

  // Show "Switch Warehouse" button for managers with multiple warehouses
  if (user.role === 'manager') {
    try {
      const whs = JSON.parse(localStorage.getItem('managerWarehouses') || '[]');
      if (whs.length > 1) {
        const switchBtn = document.getElementById('switchWarehouseNavItem');
        if (switchBtn) switchBtn.classList.remove('d-none');
      }
    } catch (_) {}
  }

  // Load data
  loadProducts();
  loadSuppliers();
  loadRecentTransactions();

  // Product search functionality
  const productSearch = document.getElementById('productSearch');
  const productDropdown = document.getElementById('productDropdown');
  const productInput = document.getElementById('product');

  if (productSearch) {
    // Shared function: filter products and render dropdown
    function showProductDropdown(searchTerm) {
      if (!Array.isArray(productsData) || productsData.length === 0) {
        productDropdown.innerHTML = '<div class="list-group-item text-warning"><i class="bi bi-hourglass-split me-2"></i>Loading products...</div>';
        productDropdown.style.display = 'block';
        loadProducts();
        return;
      }

      const term = searchTerm.toLowerCase().trim();
      const filteredProducts = term.length === 0
        ? productsData
        : productsData.filter(product =>
            (product.name || '').toLowerCase().includes(term) ||
            (product.sku || '').toLowerCase().includes(term)
          );

      if (filteredProducts.length === 0) {
        productDropdown.innerHTML = '<div class="list-group-item text-muted"><i class="bi bi-search me-2"></i>No products found</div>';
        productDropdown.style.display = 'block';
        return;
      }

      productDropdown.innerHTML = filteredProducts.map(product => `
        <button type="button" class="list-group-item list-group-item-action" data-id="${product._id}" data-product='${JSON.stringify(product)}'>
          <div class="d-flex justify-content-between">
            <div>
              <strong>${product.name}</strong>
              <br>
              <small class="text-muted">SKU: ${product.sku}</small>
            </div>
            <div class="text-end">
              <span class="badge bg-primary">${product.quantity || 0} in stock</span>
            </div>
          </div>
        </button>
      `).join('');

      productDropdown.style.display = 'block';

      productDropdown.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', function() {
          const productId = this.getAttribute('data-id');
          const product = JSON.parse(this.getAttribute('data-product'));
          const productName = this.querySelector('strong').textContent;

          productInput.value = productId;
          productSearch.value = productName;
          document.getElementById('currentStock').textContent = product.quantity || 0;

          const stockInfo = document.getElementById('currentStockInfo');
          const warehouseStock = product.warehouseStock?.find(s => s.warehouse.toString() === user.warehouseId);
          const currentQty = warehouseStock?.quantity || 0;

          stockInfo.innerHTML = `
            <p><strong>Product:</strong> ${product.name}</p>
            <p><strong>SKU:</strong> ${product.sku}</p>
            <p><strong>Current Stock:</strong> <span class="badge bg-info">${currentQty}</span></p>
            <p><strong>Category:</strong> ${product.category || 'N/A'}</p>
          `;

          if (product.unitPrice) {
            document.getElementById('unitPrice').value = product.unitPrice;
          }

          productDropdown.style.display = 'none';
        });
      });
    }

    // Filter as user types
    productSearch.addEventListener('input', (e) => {
      showProductDropdown(e.target.value);
    });

    // Show full list on click / focus
    productSearch.addEventListener('focus', () => {
      showProductDropdown(productSearch.value);
    });
    productSearch.addEventListener('click', () => {
      showProductDropdown(productSearch.value);
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!productSearch.contains(e.target) && !productDropdown.contains(e.target)) {
        productDropdown.style.display = 'none';
      }
    });
  }

  // Form submission
  document.getElementById('stockInForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const supplierValue = formData.get('supplier');
    
    const stockInData = {
      product: formData.get('product'),
      warehouse: user.warehouseId,
      quantity: parseInt(formData.get('quantity')),
      unitPrice: parseFloat(formData.get('unitPrice')),
      type: 'stock_in',
      notes: formData.get('notes') || ''
    };

    // Only add supplier if it's not empty
    if (supplierValue && supplierValue.trim() !== '') {
      stockInData.supplier = supplierValue;
    }

    console.log('📤 [Stock-In] Form data collected:', {
      product: formData.get('product'),
      warehouse: user.warehouseId,
      quantity: formData.get('quantity'),
      unitPrice: formData.get('unitPrice'),
      supplier: supplierValue,
      notes: formData.get('notes')
    });
    console.log('📤 [Stock-In] Sending stock in data:', stockInData);

    try {
      const response = await fetch(`${window.API_BASE_URL}/transactions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(stockInData)
      });

      console.log('📥 [Stock-In] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [Stock-In] Full error response:', JSON.stringify(errorData, null, 2));
        console.error('❌ [Stock-In] Error object:', errorData);
        console.error('❌ [Stock-In] Validation errors:', errorData.errors);
        
        // Create detailed error message
        let errorMessage = errorData.message || 'Failed to add stock';
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const errorList = errorData.errors.map(e => `${e.field}: ${e.message}`).join(', ');
          errorMessage += ` - ${errorList}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      showAlert('Stock added successfully!', 'success');
      
      // Reset form and reload data
      e.target.reset();
      document.getElementById('currentStockInfo').innerHTML = 
        '<p class="text-muted small">Select a product to view current stock</p>';
      loadProducts();
      loadRecentTransactions();
    } catch (error) {
      console.error('Error adding stock:', error);
      showAlert(error.message || 'Failed to add stock', 'danger');
    }
  });
});
