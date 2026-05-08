// User Stock Out JavaScript
// API_BASE_URL is set by config.js
// getToken() is provided by navbar.js

// Store products for searching
let productsData = [];

// Get user data from session storage
function getUser() {
  const userRole = sessionStorage.getItem('userRole');
  const userName = sessionStorage.getItem('userName');
  const warehouseId = sessionStorage.getItem('warehouseId');
  const warehouseName = sessionStorage.getItem('warehouseName');
  
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

// Check authentication (user-specific for stock-out)
async function checkStockOutAuth() {
  const user = getUser();
  const token = getToken();
  
  if (!user || !token) {
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
      sessionStorage.clear();
      window.location.href = 'user-login.html';
      return false;
    }
  } catch (error) {
    // Only ignore AbortError (from timeout during rapid refresh)
    if (error.name === 'AbortError') {
      console.warn('⚠️ Stock-out auth request timeout - page might be refreshing');
      return true; // Allow page to continue
    }
    
    // For all other errors, log out
    console.error('Auth validation error:', error);
    sessionStorage.clear();
    window.location.href = 'user-login.html';
    return false;
  }
  
  // Redirect admin to admin panel
  if (user.role === 'admin') {
    window.location.href = 'admin.html';
    return false;
  }

  // Redirect manager back to warehouse selection if no warehouse chosen
  if (user.role === 'manager') {
    const warehouseId = sessionStorage.getItem('warehouseId');
    const managerWarehouses = sessionStorage.getItem('managerWarehouses');
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
  sessionStorage.clear();
  window.location.href = 'user-login.html';
}

// Switch warehouse (managers only)
function switchWarehouse() {
  sessionStorage.removeItem('warehouseId');
  sessionStorage.removeItem('warehouseName');
  sessionStorage.removeItem('warehouseCode');
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

// Load products into productsData array
async function loadProducts() {
  try {
    const user = getUser();
    if (!user || !user.warehouseId) {
      throw new Error('No warehouse selected for this user');
    }

    const query = new URLSearchParams({
      limit: '1000',
      warehouseId: user.warehouseId
    });

    const response = await fetch(`${window.API_BASE_URL}/products?${query.toString()}`, {
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Failed to load products');

    const data = await response.json();
    const productSearch = document.getElementById('productSearch');

    if (data.data && data.data.products && Array.isArray(data.data.products)) {
      productsData = data.data.products.filter(product => Number(product.warehouseQuantity || 0) > 0);
      if (productSearch) {
        if (productsData.length > 0) {
          productSearch.placeholder = `Click or type to search ${productsData.length} products...`;
          productSearch.disabled = false;
        } else {
          productSearch.placeholder = 'No products in this warehouse';
          productSearch.disabled = true;
        }
      }
    } else {
      productsData = [];
      if (productSearch) {
        productSearch.placeholder = 'No products available';
        productSearch.disabled = true;
      }
    }
  } catch (error) {
    console.error('Error loading products:', error);
    showAlert('Failed to load products', 'danger');
  }
}

// Load recent transactions
async function loadRecentTransactions() {
  try {
    const user = getUser();
    console.log('📊 [Stock-Out] Loading recent transactions for warehouse:', user.warehouseId);
    
    const response = await fetch(
      `${window.API_BASE_URL}/transactions?warehouse=${user.warehouseId}&type=stock_out&limit=10`,
      { headers: getHeaders() }
    );

    console.log('📊 [Stock-Out] Transactions response status:', response.status);

    if (!response.ok) throw new Error('Failed to load transactions');

    const data = await response.json();
    console.log('📊 [Stock-Out] Transactions data:', data);
    
    const tbody = document.getElementById('recentTransactions');
    
    if (!data.data || !data.data.transactions || data.data.transactions.length === 0) {
      console.log('📊 [Stock-Out] No transactions found');
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No recent transactions</td></tr>';
      return;
    }

    console.log('📊 [Stock-Out] Loaded', data.data.transactions.length, 'transactions');
    tbody.innerHTML = data.data.transactions.map(t => `
      <tr>
        <td>${new Date(t.transactionDate).toLocaleDateString()}</td>
        <td>${t.product?.name || 'N/A'}</td>
        <td>${t.quantity}</td>
        <td>${typeof window.formatPrice === 'function' ? window.formatPrice(t.unitPrice || 0) : `$${t.unitPrice.toFixed(2)}`}</td>
        <td>${typeof window.formatPrice === 'function' ? window.formatPrice((t.quantity * t.unitPrice) || 0) : `$${(t.quantity * t.unitPrice).toFixed(2)}`}</td>
        <td>${t.notes || 'N/A'}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('❌ [Stock-Out] Error loading transactions:', error);
  }
}

// Handle product selection
document.addEventListener('DOMContentLoaded', async () => {
  // Validate authentication first
  const isAuthenticated = await checkStockOutAuth();
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
      const whs = JSON.parse(sessionStorage.getItem('managerWarehouses') || '[]');
      if (whs.length > 1) {
        const switchBtn = document.getElementById('switchWarehouseNavItem');
        if (switchBtn) switchBtn.classList.remove('d-none');
      }
    } catch (_) {}
  }

  // Load data
  loadProducts();
  loadRecentTransactions();

  // Searchable product dropdown
  const productSearch = document.getElementById('productSearch');
  const productDropdown = document.getElementById('productDropdown');
  const productInput = document.getElementById('product');

  function selectProduct(product) {
    productInput.value = product._id;
    productSearch.value = product.name;
    productDropdown.style.display = 'none';

    const warehouseStock = product.warehouseStock?.find(s => s.warehouse.toString() === user.warehouseId);
    const currentQty = warehouseStock?.quantity ?? product.warehouseQuantity ?? 0;

    document.getElementById('currentStockInfo').innerHTML = `
      <p><strong>Product:</strong> ${product.name}</p>
      <p><strong>SKU:</strong> ${product.sku}</p>
      <p><strong>Available Stock:</strong> <span class="badge ${currentQty > 0 ? 'bg-success' : 'bg-danger'}">${currentQty}</span></p>
      <p><strong>Category:</strong> ${product.category || 'N/A'}</p>
    `;

    document.getElementById('availableQty').textContent = `Available: ${currentQty}`;
    document.getElementById('quantity').max = currentQty;

    if (product.unitPrice) {
      document.getElementById('unitPrice').value = product.unitPrice;
    }
  }

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
      : productsData.filter(p =>
          (p.name || '').toLowerCase().includes(term) ||
          (p.sku || '').toLowerCase().includes(term)
        );

    if (filteredProducts.length === 0) {
      productDropdown.innerHTML = '<div class="list-group-item text-muted"><i class="bi bi-search me-2"></i>No products found</div>';
      productDropdown.style.display = 'block';
      return;
    }

    productDropdown.innerHTML = filteredProducts.map(product => {
      const ws = product.warehouseStock?.find(s => s.warehouse.toString() === user.warehouseId);
      const qty = ws?.quantity ?? product.warehouseQuantity ?? 0;
      return `
        <button type="button" class="list-group-item list-group-item-action" data-id="${product._id}" data-product='${JSON.stringify(product)}'>
          <div class="d-flex justify-content-between">
            <div>
              <strong>${product.name}</strong><br>
              <small class="text-muted">SKU: ${product.sku}</small>
            </div>
            <div class="text-end">
              <span class="badge ${qty > 0 ? 'bg-success' : 'bg-danger'}">${qty} in stock</span>
            </div>
          </div>
        </button>
      `;
    }).join('');

    productDropdown.style.display = 'block';

    productDropdown.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', function() {
        const product = JSON.parse(this.getAttribute('data-product'));
        selectProduct(product);
      });
    });
  }

  if (productSearch) {
    productSearch.addEventListener('input', (e) => showProductDropdown(e.target.value));
    productSearch.addEventListener('focus', () => showProductDropdown(productSearch.value));
    productSearch.addEventListener('click', () => showProductDropdown(productSearch.value));

    document.addEventListener('click', (e) => {
      if (!productSearch.contains(e.target) && !productDropdown.contains(e.target)) {
        productDropdown.style.display = 'none';
      }
    });
  }

  // Validate quantity on input
  document.getElementById('quantity').addEventListener('input', function() {
    const max = parseInt(this.max) || 0;
    const value = parseInt(this.value) || 0;
    
    if (value > max) {
      this.setCustomValidity(`Quantity cannot exceed ${max}`);
      this.classList.add('is-invalid');
    } else {
      this.setCustomValidity('');
      this.classList.remove('is-invalid');
    }
  });

  // Form submission
  document.getElementById('stockOutForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const quantity = parseInt(formData.get('quantity'));
    const maxQty = parseInt(document.getElementById('quantity').max) || 0;
    
    if (quantity > maxQty) {
      showAlert(`Cannot remove ${quantity} items. Only ${maxQty} available in stock.`, 'danger');
      return;
    }

    const stockOutData = {
      product: formData.get('product'),
      warehouse: user.warehouseId,
      quantity: quantity,
      unitPrice: parseFloat(formData.get('unitPrice')),
      type: 'stock_out', // Fixed: was 'out', should be 'stock_out'
      notes: `Reason: ${formData.get('reason')}. ${formData.get('notes') || ''}`
    };

    console.log('Sending stock out data:', stockOutData); // Debug log

    try {
      const response = await fetch(`${window.API_BASE_URL}/transactions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(stockOutData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData); // Debug log
        throw new Error(errorData.message || 'Failed to remove stock');
      }

      const data = await response.json();
      showAlert('Stock removed successfully!', 'success');
      
      // Reset form and reload data
      e.target.reset();
      document.getElementById('currentStockInfo').innerHTML = 
        '<p class="text-muted small">Select a product to view current stock</p>';
      document.getElementById('availableQty').textContent = 'Available: 0';
      loadProducts();
      loadRecentTransactions();
    } catch (error) {
      console.error('Error removing stock:', error);
      showAlert(error.message || 'Failed to remove stock', 'danger');
    }
  });
});
