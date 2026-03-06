// Stock In Management JavaScript
// API_BASE_URL is provided by config.js via window.API_BASE_URL

// Note: getToken() and checkAuth() are provided by navbar.js

// API Headers with token
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

// DOM Elements
let stockInForm;
let recentTransactionsBody;
let productsData = []; // Store all products for searching
let productSelectElement; // Store reference to hidden input
let productSearchElement; // Store reference to search input
let productSelectDropdown; // Store reference to the select dropdown

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Get DOM elements
  stockInForm = document.getElementById('stockInForm');
  recentTransactionsBody = document.getElementById('recentTransactionsBody');
  productSelectElement = document.getElementById('productSelect');
  productSearchElement = document.getElementById('productSearch');
  productSelectDropdown = document.getElementById('productSelectDropdown');

  console.log('✅ DOM Elements loaded:', {
    stockInForm: !!stockInForm,
    productSelect: !!productSelectElement,
    productSearch: !!productSearchElement,
    productSelectDropdown: !!productSelectDropdown
  });

  // Load initial data
  loadProducts();
  loadSuppliers();
  loadWarehouses();
  loadRecentTransactions();

  // Event listeners
  if (stockInForm) {
    stockInForm.addEventListener('submit', handleStockIn);
  }

  // Event listener for dropdown select
  if (productSelectDropdown) {
    productSelectDropdown.addEventListener('change', (e) => {
      const selectedProductId = e.target.value;
      
      if (selectedProductId) {
        // Find the selected product from productsData
        const selectedProduct = productsData.find(p => p._id === selectedProductId);
        
        if (selectedProduct) {
          console.log('✅ Product selected from dropdown:', selectedProduct.name);
          
          // Set the hidden input value
          productSelectElement.value = selectedProductId;
          
          // Update current stock display
          document.getElementById('currentStock').textContent = selectedProduct.quantity;
          
          // Auto-populate unit price
          const unitPriceInput = document.getElementById('unitPrice');
          if (unitPriceInput && selectedProduct.unitPrice) {
            unitPriceInput.value = selectedProduct.unitPrice;
          }
          
          // Clear search input
          if (productSearchElement) {
            productSearchElement.value = '';
          }
        }
      }
    });
  }

  // Product search functionality
  const productDropdown = document.getElementById('productDropdown');

  if (productSearchElement) {
    // Show dropdown when user types
    productSearchElement.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      
      console.log('Search term:', searchTerm); // Debug
      console.log('Products available:', productsData.length); // Debug
      
      if (searchTerm.length === 0) {
        productDropdown.style.display = 'none';
        return;
      }

      // Check if products are loaded
      if (!Array.isArray(productsData) || productsData.length === 0) {
        productDropdown.innerHTML = '<div class="list-group-item text-warning"><i class="bi bi-hourglass-split me-2"></i>Loading products... Please wait.</div>';
        productDropdown.style.display = 'block';
        
        // Retry loading products if they haven't loaded
        loadProducts();
        return;
      }

      // Filter products based on search term
      const filteredProducts = productsData.filter(product => {
        const productName = (product.name || '').toLowerCase();
        const productSku = (product.sku || '').toLowerCase();
        
        return productName.includes(searchTerm) || productSku.includes(searchTerm);
      });

      console.log('Filtered products:', filteredProducts.length); // Debug
      console.log('Filtered results:', filteredProducts.map(p => p.name)); // Debug

      if (filteredProducts.length === 0) {
        productDropdown.innerHTML = '<div class="list-group-item text-muted"><i class="bi bi-search me-2"></i>No products found matching "' + searchTerm + '"</div>';
        productDropdown.style.display = 'block';
        return;
      }

      // Display filtered products
      productDropdown.innerHTML = filteredProducts.map(product => `
        <button type="button" class="list-group-item list-group-item-action" data-id="${product._id}" data-stock="${product.quantity}" data-price="${product.unitPrice || 0}">
          <div class="d-flex justify-content-between">
            <div>
              <strong>${product.name}</strong>
              <br>
              <small class="text-muted">SKU: ${product.sku}</small>
            </div>
            <div class="text-end">
              <span class="badge bg-primary">${product.quantity} in stock</span>
            </div>
          </div>
        </button>
      `).join('');

      productDropdown.style.display = 'block';

      // Add click handlers to dropdown items
      productDropdown.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', function() {
          const productId = this.getAttribute('data-id');
          const productStock = this.getAttribute('data-stock');
          const productPrice = this.getAttribute('data-price');
          const productName = this.querySelector('strong').textContent;
          
          console.log('✅ Product selected from search:', { productId, productName, productStock, productPrice });
          
          // Set hidden input value using global variable
          if (productSelectElement) {
            productSelectElement.value = productId;
            console.log('✅ Hidden input value set to:', productSelectElement.value);
            console.log('✅ Hidden input name attribute:', productSelectElement.name);
          } else {
            console.error('❌ productSelectElement is null!');
          }
          
          // Set search input to show selected product using global variable
          if (productSearchElement) {
            productSearchElement.value = productName;
          }
          
          // Clear the dropdown select
          if (productSelectDropdown) {
            productSelectDropdown.value = '';
          }
          
          // Update current stock display
          document.getElementById('currentStock').textContent = productStock;
          
          // Auto-populate unit price
          const unitPriceInput = document.getElementById('unitPrice');
          if (unitPriceInput && productPrice) {
            unitPriceInput.value = productPrice;
          }
          
          // Hide dropdown
          productDropdown.style.display = 'none';
        });
      });
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!productSearchElement.contains(e.target) && !productDropdown.contains(e.target)) {
        productDropdown.style.display = 'none';
      }
    });

    // Show dropdown on focus if there's text
    productSearchElement.addEventListener('focus', (e) => {
      if (e.target.value.length > 0) {
        productSearchElement.dispatchEvent(new Event('input'));
      }
    });
  }

  // Logout functionality
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', handleLogout);
  });
});

// Load products for dropdown
async function loadProducts() {
  try {
    console.log('Loading products...'); // Debug log
    const response = await fetch(`${window.API_BASE_URL}/products?limit=1000`, {
      headers: getHeaders()
    });

    console.log('Products response status:', response.status); // Debug log

    const data = await response.json();
    
    // Check for session expiry (auto logout on server restart)
    if (window.handleApiError && window.handleApiError(response, data)) {
      return; // User logged out, no need to continue
    }

    if (!response.ok) {
      console.error('Failed to load products, status:', response.status);
      console.error('Error data:', data);
      
      // Update placeholder to show error
      const productSearch = document.getElementById('productSearch');
      if (productSearch) {
        productSearch.placeholder = 'Error loading products';
        productSearch.disabled = true;
      }
      return;
    }

    console.log('Products data:', data); // Debug log
    console.log('Data structure:', data.data); // Debug log
    
    if (data.data && data.data.products && Array.isArray(data.data.products)) {
      // Store products globally for searching
      productsData = data.data.products;
      console.log('Loaded', productsData.length, 'products for searching');
      console.log('Sample product:', productsData[0]); // Debug - show first product
      
      // Populate the select dropdown
      if (productSelectDropdown) {
        productSelectDropdown.innerHTML = '<option value="">-- Choose from dropdown or search below --</option>' +
          productsData.map(product => {
            const stockInfo = product.quantity >= 0 ? `${product.quantity}` : '0';
            return `<option value="${product._id}">${product.name} (Stock: ${stockInfo})</option>`;
          }).join('');
        console.log('✅ Populated product select dropdown with', productsData.length, 'products');
      }
      
      // Update search placeholder to indicate products are loaded
      if (productSearchElement) {
        productSearchElement.placeholder = `Type to search ${productsData.length} products...`;
      }
    } else {
      console.error('No products found in response or wrong structure');
      console.error('Expected data.data.products to be an array, got:', typeof data.data?.products);
      productsData = [];
      
      // Update placeholder to show no products
      const productSearch = document.getElementById('productSearch');
      if (productSearch) {
        productSearch.placeholder = 'No products available';
        productSearch.disabled = true;
      }
    }
  } catch (error) {
    console.error('Error loading products:', error);
    productsData = [];
    
    // Update placeholder to show error
    const productSearch = document.getElementById('productSearch');
    if (productSearch) {
      productSearch.placeholder = 'Error loading products';
      productSearch.disabled = true;
    }
  }
}

// Load suppliers for dropdown
async function loadSuppliers() {
  try {
    console.log('📦 Loading suppliers...');
    const response = await fetch(`${window.API_BASE_URL}/suppliers/active`, {
      headers: getHeaders()
    });

    console.log('📦 Suppliers response status:', response.status);
    const data = await response.json();
    console.log('📦 Suppliers response data:', data);
    
    // Check for session expiry (auto logout on server restart)
    if (window.handleApiError && window.handleApiError(response, data)) {
      return; // User logged out, no need to continue
    }

    if (!response.ok) {
      console.error('❌ Failed to load suppliers, response not OK');
      return;
    }
    
    const supplierSelect = document.getElementById('supplierSelect');
    console.log('📦 Supplier select element:', supplierSelect);
    
    // The API returns suppliers in data.data (array)
    const suppliers = Array.isArray(data.data) ? data.data : [];
    console.log('📦 Suppliers array:', suppliers);
    console.log('📦 Number of suppliers:', suppliers.length);
    
    if (supplierSelect) {
      if (suppliers.length > 0) {
        supplierSelect.innerHTML = '<option value="">Select Supplier (Optional)</option>' +
          suppliers.map(supplier => 
            `<option value="${supplier._id}">${supplier.name}</option>`
          ).join('');
        console.log(`✅ Loaded ${suppliers.length} suppliers into dropdown`);
      } else {
        supplierSelect.innerHTML = '<option value="">Select Supplier (Optional)</option>';
        console.warn('⚠️ No active suppliers found');
      }
    } else {
      console.error('❌ Supplier select element not found in DOM');
    }
  } catch (error) {
    console.error('❌ Error loading suppliers:', error);
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

// Handle stock-in submission
async function handleStockIn(e) {
  e.preventDefault();

  // Get values directly from form elements - use global references where available
  const warehouseSelectElement = document.getElementById('warehouseSelect');
  const quantityElement = document.getElementById('quantity');
  const unitPriceElement = document.getElementById('unitPrice');
  const supplierSelectElement = document.getElementById('supplierSelect');

  const transactionData = {
    product: productSelectElement?.value || '',
    warehouse: warehouseSelectElement?.value || '',
    type: 'stock_in',
    quantity: parseInt(quantityElement?.value || '0'),
    unitPrice: parseFloat(unitPriceElement?.value || '0'),
    supplier: supplierSelectElement?.value || undefined
  };

  // Debug logging
  console.log('📝 Form submitted - Transaction Data:', transactionData);
  console.log('📦 Product ID:', transactionData.product);
  console.log('🏢 Warehouse:', transactionData.warehouse);
  console.log('📊 Quantity:', transactionData.quantity);
  console.log('💰 Unit Price:', transactionData.unitPrice);
  console.log('🔍 Product Element:', productSelectElement);
  console.log('🔍 Product Element Value:', productSelectElement?.value);

  // Validate
  if (!transactionData.product || transactionData.product === '' || transactionData.product === 'null') {
    console.error('❌ Product validation failed. Product value:', transactionData.product);
    showAlert('Please select a product from the search dropdown', 'warning');
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
      throw new Error(data.message || 'Failed to record stock-in');
    }

    // Get the transaction data
    const transaction = data.data;
    
    showAlert(`Stock-in successful! Transaction #${transaction.transactionNumber || 'N/A'}`, 'success');
    stockInForm.reset();
    document.getElementById('currentStock').textContent = '0';
    
    loadRecentTransactions();
    loadProducts(); // Reload to update stock levels
  } catch (error) {
    console.error('Error recording stock-in:', error);
    showAlert(error.message, 'danger');
  }
}

// Load recent stock-in transactions
async function loadRecentTransactions() {
  if (!recentTransactionsBody) return;

  try {
    const response = await fetch(`${window.API_BASE_URL}/transactions?type=stock_in&limit=10&sort=-createdAt`, {
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
    recentTransactionsBody.innerHTML = '<tr><td colspan="6" class="text-center">No recent transactions</td></tr>';
    return;
  }

  recentTransactionsBody.innerHTML = transactions.map(transaction => {
    const date = new Date(transaction.createdAt).toLocaleString();
    return `
      <tr>
        <td>${transaction.transactionNumber}</td>
        <td>${transaction.product?.name || 'N/A'}</td>
        <td>${transaction.quantity}</td>
        <td>${transaction.supplier?.name || 'N/A'}</td>
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
