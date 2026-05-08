// User Products JavaScript
// API_BASE_URL is set by config.js
// getToken() is provided by navbar.js

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

// Check authentication (user-specific for products)
async function checkProductsAuth() {
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
      console.warn('⚠️ Products auth request timeout - page might be refreshing');
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
  
  return true;
}

// Logout handler
function handleLogout() {
  sessionStorage.clear();
  window.location.href = 'user-login.html';
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
    const searchInput = document.getElementById('searchInput');
    const stockFilter = document.getElementById('stockFilter');
    
    const params = new URLSearchParams();
    if (searchInput.value) {
      params.append('search', searchInput.value);
    }
    // Pass the selected warehouseId so the backend returns products for the correct warehouse
    // (fixes the bug where manager-selected warehouse was overridden by the user's default warehouse)
    if (user.warehouseId) {
      params.append('warehouseId', user.warehouseId);
    }
    
    const response = await fetch(`${window.API_BASE_URL}/user-dashboard/warehouse-products?${params.toString()}`, {
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Failed to load products');

    const data = await response.json();
    const tbody = document.getElementById('productsTableBody');
    
    // Get products - already filtered by backend for user's warehouse
    let products = data.data.products;
    
    // Filter by stock level if selected
    if (stockFilter.value) {
      products = products.filter(product => {
        const warehouseStock = product.warehouseStock?.find(s => s.warehouse.toString() === user.warehouseId);
        const qty = warehouseStock?.quantity || 0;
        
        switch (stockFilter.value) {
          case 'in-stock':
            return qty > product.minStockLevel;
          case 'low-stock':
            return qty > 0 && qty <= product.minStockLevel;
          case 'out-of-stock':
            return qty === 0;
          default:
            return true;
        }
      });
    }
    
    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No products found</td></tr>';
      return;
    }

    tbody.innerHTML = products.map(product => {
      const warehouseStock = product.warehouseStock?.find(s => s.warehouse.toString() === user.warehouseId);
      const currentStock = warehouseStock?.quantity || 0;
      const minStock = warehouseStock?.minStockLevel || product.minStockLevel || 0;
      
      let stockStatus = '';
      let stockBadge = '';
      
      if (currentStock === 0) {
        stockStatus = 'Out of Stock';
        stockBadge = 'bg-danger';
      } else if (currentStock <= minStock) {
        stockStatus = 'Low Stock';
        stockBadge = 'bg-warning';
      } else {
        stockStatus = 'In Stock';
        stockBadge = 'bg-success';
      }
      
      return `
        <tr>
          <td>${product.sku}</td>
          <td>${product.name}</td>
          <td>${product.category}</td>
          <td><span class="badge ${stockBadge}">${currentStock}</span></td>
          <td>${minStock}</td>
          <td>${typeof window.formatPrice === 'function' ? window.formatPrice(product.unitPrice || 0) : `Rs ${product.unitPrice ? product.unitPrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`}</td>
          <td><span class="badge ${stockBadge}">${stockStatus}</span></td>
          <td>
            <button class="btn btn-sm btn-info" onclick="viewProductDetails('${product._id}')">
              <i class="bi bi-eye"></i> View
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading products:', error);
    showAlert('Failed to load products', 'danger');
  }
}

// View product details
async function viewProductDetails(productId) {
  try {
    const response = await fetch(`${window.API_BASE_URL}/products/${productId}`, {
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Failed to load product details');

    const data = await response.json();
    const product = data.data;
    const user = getUser();
    
    const warehouseStock = product.warehouseStock?.find(s => s.warehouse.toString() === user.warehouseId);
    const currentStock = warehouseStock?.quantity || 0;
    
    const detailsContent = document.getElementById('productDetailsContent');
    detailsContent.innerHTML = `
      <div class="row">
        <div class="col-md-6">
          <h6 class="text-primary">Basic Information</h6>
          <table class="table table-sm">
            <tr><th>SKU:</th><td>${product.sku}</td></tr>
            <tr><th>Name:</th><td>${product.name}</td></tr>
            <tr><th>Category:</th><td>${product.category}</td></tr>
            <tr><th>Description:</th><td>${product.description || 'N/A'}</td></tr>
          </table>
        </div>
        <div class="col-md-6">
          <h6 class="text-primary">Stock Information</h6>
          <table class="table table-sm">
            <tr><th>Current Stock:</th><td><span class="badge bg-info">${currentStock}</span></td></tr>
            <tr><th>Min Stock Level:</th><td>${product.minStockLevel}</td></tr>
            <tr><th>Unit Price:</th><td>${typeof window.formatPrice === 'function' ? window.formatPrice(product.unitPrice || 0) : `$${product.unitPrice?.toFixed(2) || '0.00'}`}</td></tr>
            <tr><th>Warehouse:</th><td>${user.warehouseName}</td></tr>
          </table>
        </div>
      </div>
    `;
    
    const modal = new bootstrap.Modal(document.getElementById('productDetailsModal'));
    modal.show();
  } catch (error) {
    console.error('Error loading product details:', error);
    showAlert('Failed to load product details', 'danger');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Validate authentication first
  const isAuthenticated = await checkProductsAuth();
  if (!isAuthenticated) return;

  const user = getUser();
  
  // Set user info
  document.getElementById('userName').textContent = user.name;
  document.getElementById('warehouseName').textContent = user.warehouseName;

  // Load products
  loadProducts();

  // Search input
  document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(loadProducts, 500);
  });

  // Stock filter
  document.getElementById('stockFilter').addEventListener('change', loadProducts);
});
