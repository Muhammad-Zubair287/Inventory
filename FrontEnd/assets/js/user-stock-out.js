// User Stock Out JavaScript
// API_BASE_URL is set by config.js
// getToken() is provided by navbar.js

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
      localStorage.clear();
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
    localStorage.clear();
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
    const productSelect = document.getElementById('product');
    
    productSelect.innerHTML = '<option value="">Select Product</option>';
    data.data.products.forEach(product => {
      const option = document.createElement('option');
      option.value = product._id;
      option.textContent = `${product.name} (${product.sku})`;
      option.dataset.product = JSON.stringify(product);
      productSelect.appendChild(option);
    });
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
      const whs = JSON.parse(localStorage.getItem('managerWarehouses') || '[]');
      if (whs.length > 1) {
        const switchBtn = document.getElementById('switchWarehouseNavItem');
        if (switchBtn) switchBtn.classList.remove('d-none');
      }
    } catch (_) {}
  }

  // Load data
  loadProducts();
  loadRecentTransactions();

  // Product selection change
  document.getElementById('product').addEventListener('change', function() {
    const selectedOption = this.options[this.selectedIndex];
    if (selectedOption.value) {
      const product = JSON.parse(selectedOption.dataset.product);
      const stockInfo = document.getElementById('currentStockInfo');
      
      // Find stock for user's warehouse
      const warehouseStock = product.warehouseStock?.find(s => s.warehouse.toString() === user.warehouseId);
      const currentQty = warehouseStock?.quantity || 0;
      
      stockInfo.innerHTML = `
        <p><strong>Product:</strong> ${product.name}</p>
        <p><strong>SKU:</strong> ${product.sku}</p>
        <p><strong>Available Stock:</strong> <span class="badge ${currentQty > 0 ? 'bg-success' : 'bg-danger'}">${currentQty}</span></p>
        <p><strong>Category:</strong> ${product.category}</p>
      `;
      
      // Update available quantity display
      document.getElementById('availableQty').textContent = `Available: ${currentQty}`;
      document.getElementById('quantity').max = currentQty;
      
      // Set default unit price if available
      if (product.unitPrice) {
        document.getElementById('unitPrice').value = product.unitPrice;
      }
    } else {
      document.getElementById('currentStockInfo').innerHTML = 
        '<p class="text-muted small">Select a product to view current stock</p>';
      document.getElementById('availableQty').textContent = 'Available: 0';
    }
  });

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
