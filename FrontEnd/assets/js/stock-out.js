// Stock Out Management JavaScript
// API_BASE_URL is provided by config.js via window.API_BASE_URL

// Note: getToken() and checkAuth() are provided by navbar.js

// API Headers with token
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

// DOM Elements
let stockOutForm;
let recentTransactionsBody;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Get DOM elements
  stockOutForm = document.getElementById('stockOutForm');
  recentTransactionsBody = document.getElementById('recentTransactionsBody');

  // Load initial data
  loadProducts();
  loadWarehouses();
  loadRecentTransactions();

  // Event listeners
  if (stockOutForm) {
    stockOutForm.addEventListener('submit', handleStockOut);
  }

  // Product selection change - populate current stock
  const productSelect = document.getElementById('productSelect');
  if (productSelect) {
    productSelect.addEventListener('change', handleProductChange);
  }

  // Logout functionality
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', handleLogout);
  });
});

// Load products for dropdown
async function loadProducts() {
  try {
    console.log('📦 [Stock-Out] Loading products...');
    // Remove status filter to load ALL products
    const response = await fetch(`${window.API_BASE_URL}/products?limit=1000`, {
      headers: getHeaders()
    });

    console.log('📦 [Stock-Out] Products response status:', response.status);
    const data = await response.json();
    console.log('📦 [Stock-Out] Products response data:', data);
    
    // Check for session expiry (auto logout on server restart)
    if (window.handleApiError && window.handleApiError(response, data)) {
      return; // User logged out, no need to continue
    }

    if (!response.ok) {
      console.error('❌ [Stock-Out] Failed to load products');
      return;
    }
    
    const productSelect = document.getElementById('productSelect');
    console.log('📦 [Stock-Out] Product select element:', productSelect ? 'Found' : 'NOT FOUND');
    
    if (productSelect && data.data && data.data.products) {
      const products = data.data.products;
      console.log(`📦 [Stock-Out] Found ${products.length} products`);
      
      productSelect.innerHTML = '<option value="">Select Product</option>' +
        products.map(product => {
          const stockInfo = product.quantity > 0 ? `Stock: ${product.quantity}` : 'Out of Stock';
          return `<option value="${product._id}" data-stock="${product.quantity}" data-price="${product.unitPrice || 0}">${product.name} (SKU: ${product.sku}) - ${stockInfo}</option>`;
        }).join('');
      
      console.log(`✅ [Stock-Out] Added ${products.length} products to dropdown`);
      
      // Initialize Select2 for searchable dropdown
      if (typeof $ !== 'undefined' && $.fn.select2) {
        $('#productSelect').select2({
          theme: 'bootstrap-5',
          width: '100%',
          placeholder: 'Search for a product...',
          allowClear: true,
          matcher: function(params, data) {
            // If there are no search terms, return all data
            if ($.trim(params.term) === '') {
              return data;
            }

            // Do not display the item if there is no 'text' property
            if (typeof data.text === 'undefined') {
              return null;
            }

            // Search in product name, SKU, and stock info
            const searchTerm = params.term.toLowerCase();
            const text = data.text.toLowerCase();
            
            if (text.indexOf(searchTerm) > -1) {
              return data;
            }

            // Return `null` if the term should not be displayed
            return null;
          }
        });
        
        // Handle Select2 change event
        $('#productSelect').on('select2:select', function(e) {
          handleProductChange({ target: e.target });
        });
      }
    } else {
      console.warn('⚠️ [Stock-Out] Product select element or products data missing');
    }
  } catch (error) {
    console.error('❌ [Stock-Out] Error loading products:', error);
  }
}

// Load warehouses for dropdown
async function loadWarehouses() {
  try {
    const response = await fetch(`${window.API_BASE_URL}/warehouses`, {
      headers: getHeaders()
    });

    const data = await response.json();
    
    // Check for session expiry (auto logout on server restart)
    if (window.handleApiError && window.handleApiError(response, data)) {
      return; // User logged out, no need to continue
    }

    if (!response.ok) return;
    const warehouseSelect = document.getElementById('warehouseSelect');
    
    if (warehouseSelect && data.data.warehouses) {
      warehouseSelect.innerHTML = '<option value="">Choose a warehouse</option>' +
        data.data.warehouses.map(warehouse => 
          `<option value="${warehouse._id}">${warehouse.name} - ${warehouse.location?.city || ''}</option>`
        ).join('');
    }
  } catch (error) {
    console.error('Error loading warehouses:', error);
  }
}

// Handle product selection change
function handleProductChange(e) {
  const selectedOption = e.target.options[e.target.selectedIndex];
  const currentStock = selectedOption.getAttribute('data-stock');
  const productPrice = selectedOption.getAttribute('data-price');
  const currentStockDisplay = document.getElementById('currentStock');
  const quantityInput = document.getElementById('quantityInput');
  const unitPriceInput = document.getElementById('unitPrice');
  
  if (currentStockDisplay) {
    currentStockDisplay.textContent = currentStock || '0';
  }
  
  // Auto-populate unit price
  if (unitPriceInput && productPrice) {
    unitPriceInput.value = productPrice;
  }
  
  // Set max attribute on quantity input
  if (quantityInput && currentStock) {
    quantityInput.setAttribute('max', currentStock);
  }
}

// Handle stock-out submission
async function handleStockOut(e) {
  e.preventDefault();

  const formData = new FormData(stockOutForm);
  const productSelect = document.getElementById('productSelect');
  const selectedOption = productSelect.options[productSelect.selectedIndex];
  const currentStock = parseInt(selectedOption.getAttribute('data-stock') || '0');
  const requestedQuantity = parseInt(formData.get('quantity'));

  const transactionData = {
    product: formData.get('product'),
    warehouse: formData.get('warehouse'),
    type: 'stock_out',
    quantity: requestedQuantity,
    unitPrice: parseFloat(formData.get('unitPrice')),
    reason: formData.get('reason') || undefined
  };

  // Validate
  if (!transactionData.product) {
    showAlert('Please select a product', 'warning');
    return;
  }

  if (!transactionData.warehouse) {
    showAlert('Please select a warehouse', 'warning');
    return;
  }

  if (!transactionData.quantity || transactionData.quantity <= 0) {
    showAlert('Please enter a valid quantity', 'warning');
    return;
  }

  if (!transactionData.unitPrice || transactionData.unitPrice < 0) {
    showAlert('Please enter a valid unit price', 'warning');
    return;
  }

  // Check if product is out of stock
  if (currentStock === 0) {
    showAlert('Cannot remove stock! This product is out of stock.', 'danger');
    return;
  }

  // Check if sufficient stock
  if (requestedQuantity > currentStock) {
    showAlert(`Insufficient stock! Available: ${currentStock}, Requested: ${requestedQuantity}`, 'danger');
    return;
  }

  try {
    const response = await fetch(`${window.API_BASE_URL}/transactions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(transactionData)
    });

    const data = await response.json();

    // Check for session expiry (auto logout on server restart)
    if (window.handleApiError && window.handleApiError(response, data)) {
      return; // User logged out, no need to continue
    }

    if (!response.ok) {
      throw new Error(data.message || 'Failed to record stock-out');
    }

    // Get the transaction data
    const transaction = data.data;
    
    showAlert(`Stock-out successful! Transaction #${transaction.transactionNumber || 'N/A'}`, 'success');
    stockOutForm.reset();
    document.getElementById('currentStock').textContent = '0';
    
    loadRecentTransactions();
    loadProducts(); // Reload to update stock levels
  } catch (error) {
    console.error('Error recording stock-out:', error);
    showAlert(error.message, 'danger');
  }
}

// Load recent stock-out transactions
async function loadRecentTransactions() {
  if (!recentTransactionsBody) return;

  try {
    const response = await fetch(`${window.API_BASE_URL}/transactions?type=stock_out&limit=10&sort=-createdAt`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }

    const data = await response.json();
    displayRecentTransactions(data.data.transactions);
  } catch (error) {
    console.error('Error loading transactions:', error);
  }
}

// Display recent transactions
function displayRecentTransactions(transactions) {
  if (!recentTransactionsBody) return;

  if (!transactions || transactions.length === 0) {
    recentTransactionsBody.innerHTML = '<tr><td colspan="5" class="text-center">No recent transactions</td></tr>';
    return;
  }

  recentTransactionsBody.innerHTML = transactions.map(transaction => {
    const date = new Date(transaction.createdAt).toLocaleString();
    return `
      <tr>
        <td>${transaction.transactionNumber}</td>
        <td>${transaction.product?.name || 'N/A'}</td>
        <td>${transaction.quantity}</td>
        <td>${date}</td>
        <td>${transaction.notes || '-'}</td>
      </tr>
    `;
  }).join('');
}

// Show alert message
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

// Logout handler
async function handleLogout() {
  try {
    await fetch(`${window.API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getHeaders()
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    localStorage.clear();
    window.location.href = 'login.html';
  }
}
