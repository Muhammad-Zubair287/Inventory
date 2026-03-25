// Products Management JavaScript
// API_BASE_URL is provided by navbar.js

// Note: getToken() and checkAuth() are provided by navbar.js

// API Headers with token
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

// DOM Elements
let productsTableBody;
let addProductForm;
let editProductModal;
let editProductForm;
let searchInput;
let currentEditId = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Get DOM elements
  productsTableBody = document.getElementById('productsTableBody');
  addProductForm = document.getElementById('addProductForm');
  editProductForm = document.getElementById('editProductForm');
  searchInput = document.getElementById('searchInput');

  // Load initial data
  loadProducts();
  loadCategories();
  loadSuppliers();
  loadWarehouses(); // Load warehouses as checkbox list

  // Event listeners
  if (addProductForm) {
    addProductForm.addEventListener('submit', handleAddProduct);
  }
  if (editProductForm) {
    editProductForm.addEventListener('submit', handleEditProduct);
  }
  if (searchInput) {
    searchInput.addEventListener('input', debounce(loadProducts, 500));
  }

  // Re-validate warehouse totals whenever the product quantity field changes
  const qtyInput = document.getElementById('productQuantity');
  if (qtyInput) {
    qtyInput.addEventListener('input', validateWarehouseQty);
  }

  // Reset warehouse checklist when the Add Product modal is closed
  const addModal = document.getElementById('addProductModal');
  if (addModal) {
    addModal.addEventListener('hidden.bs.modal', () => {
      document.querySelectorAll('#warehouseStockList .wh-checkbox').forEach(cb => {
        cb.checked = false;
      });
      document.querySelectorAll('#warehouseStockList .wh-qty-input').forEach(inp => {
        inp.value = '0';
        inp.disabled = true;
      });
      const errorEl = document.getElementById('warehouseQtyError');
      if (errorEl) errorEl.style.display = 'none';
    });
  }

  // Logout functionality
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', handleLogout);
  });

  // Initialize existing product autocomplete
  initializeExistingProductAutocomplete();
});

/**
 * Initialize Existing Product Autocomplete
 * Allows users to search and auto-fill form from existing products
 */
function initializeExistingProductAutocomplete() {
  const existingProductInput = document.getElementById('existingProductSelect');
  const existingProductDropdown = document.getElementById('existingProductDropdown');
  const clearBtn = document.getElementById('clearExistingProduct');
  const clearAutoFillBtn = document.getElementById('clearAutoFill');
  let allProducts = [];
  let selectedProductId = null;

  if (!existingProductInput) return;

  // Load all products for autocomplete on input focus
  existingProductInput.addEventListener('focus', async () => {
    if (allProducts.length === 0) {
      await loadProductsForAutocomplete();
    }
    if (allProducts.length > 0) {
      showAutocompleteDropdown(allProducts);
    }
  });

  // Filter products on input
  existingProductInput.addEventListener('input', () => {
    const query = existingProductInput.value.trim();
    clearBtn.style.display = query ? 'block' : 'none';

    if (query.length === 0) {
      if (allProducts.length > 0) {
        showAutocompleteDropdown(allProducts);
      }
      return;
    }

    const filtered = allProducts.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase())
    );

    showAutocompleteDropdown(filtered);
  });

  // Handle clear button
  clearBtn?.addEventListener('click', () => {
    existingProductInput.value = '';
    clearBtn.style.display = 'none';
    selectedProductId = null;
    document.getElementById('autoSelectedProductInfo').style.display = 'none';
    existingProductDropdown.style.display = 'none';
    existingProductInput.focus();
  });

  // Handle clear auto-fill button
  clearAutoFillBtn?.addEventListener('click', () => {
    const form = document.getElementById('addProductForm');
    if (form) {
      form.reset();
      existingProductInput.value = '';
      clearBtn.style.display = 'none';
      selectedProductId = null;
      document.getElementById('autoSelectedProductInfo').style.display = 'none';
      existingProductDropdown.style.display = 'none';
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (
      e.target !== existingProductInput &&
      e.target !== existingProductDropdown &&
      !existingProductDropdown.contains(e.target)
    ) {
      existingProductDropdown.style.display = 'none';
    }
  });

  /**
   * Load all products for autocomplete
   */
  async function loadProductsForAutocomplete() {
    try {
      const response = await fetch(`${API_BASE_URL}/products?limit=100`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        console.warn('Failed to load products for autocomplete');
        return;
      }

      const data = await response.json();
      allProducts = data.data?.products || [];
      console.log(`✅ Loaded ${allProducts.length} products for autocomplete`);
    } catch (error) {
      console.error('Error loading products for autocomplete:', error);
    }
  }

  /**
   * Show autocomplete dropdown with product list
   */
  function showAutocompleteDropdown(products) {
    existingProductDropdown.style.display = 'block';

    if (products.length === 0) {
      existingProductDropdown.innerHTML = `
        <div class="p-3 text-muted text-center small">
          <i class="bi bi-search me-1"></i>No products found
        </div>
      `;
      return;
    }

    existingProductDropdown.innerHTML = products.map(product => `
      <div
        class="p-2 border-bottom cursor-pointer"
        style="cursor:pointer; padding:10px 12px; transition: background-color 0.2s;"
        onmouseover="this.style.backgroundColor='#f8f9fa'"
        onmouseout="this.style.backgroundColor='transparent'"
        onclick="selectExistingProduct('${product._id}', '${product.name.replace(/'/g, "\\'")}', '${product.sku}')"
      >
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <strong class="d-block">${product.name}</strong>
            <small class="text-muted">SKU: ${product.sku}</small>
          </div>
          <span class="badge bg-secondary">₨${product.unitPrice?.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
        </div>
      </div>
    `).join('');
  }

  // Store function globally for onclick
  window.selectExistingProduct = async (productId, productName, productSku) => {
    selectedProductId = productId;

    try {
      // Fetch full product details
      const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        showAlert('Failed to load product details', 'danger');
        return;
      }

      const data = await response.json();
      const product = data.data?.product || data.data || data;

      // Auto-fill form fields
      autoFillProductForm(product);

      // Update UI
      existingProductInput.value = `${product.name} (${product.sku})`;
      clearBtn.style.display = 'block';
      existingProductDropdown.style.display = 'none';

      // Show confirmation alert
      document.getElementById('selectedProductName').textContent = `${product.name} (SKU: ${product.sku})`;
      document.getElementById('autoSelectedProductInfo').style.display = 'block';

      console.log('✅ Product auto-filled:', product.name);
    } catch (error) {
      console.error('Error selecting product:', error);
      showAlert('Failed to load product details', 'danger');
    }
  };
}

/**
 * Auto-fill product form from selected product
 */
function autoFillProductForm(product) {
  // Fill editable fields - user can still override these
  const fieldMappings = {
    'productSKU': product.sku,
    'productName': product.name,
    'productCategory': product.category,
    'productPrice': product.unitPrice,
    'productDescription': product.description || '',
    'productMinStock': product.minStockLevel || 10,
    'productSupplier': product.supplier?._id || '',
  };

  for (const [fieldId, value] of Object.entries(fieldMappings)) {
    const field = document.getElementById(fieldId);
    if (field) {
      field.value = value;
      // Add visual feedback that field was auto-filled
      field.classList.add('auto-filled');
      // Remove class after animation
      setTimeout(() => field.classList.remove('auto-filled'), 1500);
    }
  }

  // Quantity and warehouse assignment stay empty for user to choose
  const qtyField = document.getElementById('productQuantity');
  if (qtyField) {
    qtyField.value = '0';
  }
}

// Debounce function for search
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Load all products
async function loadProducts() {
  try {
    console.log('Loading products...');
    console.log('Token:', getToken() ? 'exists' : 'missing');
    
    const params = new URLSearchParams();
    params.append('limit', '100'); // fetch all products (no pagination UI)
    
    if (searchInput && searchInput.value) {
      params.append('search', searchInput.value);
    }

    const url = `${API_BASE_URL}/products?${params.toString()}`;
    console.log('Fetching from:', url);

    const response = await fetch(url, {
      headers: getHeaders()
    });

    console.log('Response status:', response.status);

    const data = await response.json();
    
    // Check for session expiry (auto logout on server restart)
    if (window.handleApiError && window.handleApiError(response, data)) {
      return; // User logged out, no need to continue
    }

    if (!response.ok) {
      console.error('API Error:', data);
      throw new Error(data.message || 'Failed to fetch products');
    }
    console.log('API Response:', data);
    console.log('Products received:', data.data?.products?.length || 0);
    
    displayProducts(data.data.products);
  } catch (error) {
    console.error('Error loading products:', error);
    if (productsTableBody) {
      productsTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error: ${error.message}</td></tr>`;
    }
    showAlert('Failed to load products: ' + error.message, 'danger');
  }
}

// Display products in table
function displayProducts(products) {
  console.log('displayProducts called with:', products);
  
  if (!productsTableBody) {
    console.error('productsTableBody element not found!');
    return;
  }

  if (!products || products.length === 0) {
    console.log('No products to display');
    productsTableBody.innerHTML = '<tr><td colspan="8" class="text-center">No products found</td></tr>';
    return;
  }

  console.log(`Displaying ${products.length} products`);
  
  productsTableBody.innerHTML = products.map(product => `
    <tr>
      <td>${product.sku}</td>
      <td>${product.name}</td>
      <td>${product.category}</td>
      <td>${product.quantity}</td>
      <td>${typeof window.formatPrice === 'function' ? window.formatPrice(product.unitPrice || 0) : `Rs ${product.unitPrice ? product.unitPrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`}</td>
      <td>
        <span class="badge ${product.status === 'available' ? 'bg-success' : 'bg-secondary'}">
          ${product.status}
        </span>
        ${product.quantity <= (product.minStockLevel || 5 ) ? '<span class="badge bg-warning ms-1">Low Stock</span>' : ''}
      </td>
      <td>${product.supplier?.name || 'N/A'}</td>
      <td>
        <div class="d-flex flex-column gap-1">
          <button class="btn btn-sm btn-outline-info" onclick="showDetailModal('${product._id}')" title="View Details">
            <i class="bi bi-eye"></i> Detail
          </button>
          <button class="btn btn-sm btn-outline-primary" onclick="showEditModal('${product._id}')" title="Edit Product">
            <i class="bi bi-pencil-square"></i> Edit
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${product._id}')" title="Delete Product">
            <i class="bi bi-trash"></i> Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Load categories for filter (optional - can be removed if not using filter)
async function loadCategories() {
  // Category filter removed from UI
  // This function kept for future use if filter is added
  return;
}

// Load suppliers for dropdown
async function loadSuppliers() {
  try {
    console.log('📦 [Products] Loading suppliers...');
    const response = await fetch(`${API_BASE_URL}/suppliers/active`, {
      headers: getHeaders()
    });

    console.log('📦 [Products] Suppliers response status:', response.status);
    const data = await response.json();
    console.log('📦 [Products] Suppliers response data:', data);
    
    // Check for session expiry (auto logout on server restart)
    if (window.handleApiError && window.handleApiError(response, data)) {
      return; // User logged out, no need to continue
    }

    if (!response.ok) {
      console.error('❌ [Products] Failed to load suppliers:', data);
      return;
    }

    // The API returns suppliers in data.data (array directly)
    const suppliers = Array.isArray(data.data) ? data.data : [];
    console.log(`📦 [Products] Found ${suppliers.length} suppliers`);
    if (suppliers.length > 0) {
      console.log('📦 [Products] Suppliers:', suppliers.map(s => s.name).join(', '));
    } else {
      console.warn('⚠️ [Products] No active suppliers found. Please add suppliers and mark them as Active.');
    }
    
    const supplierSelects = document.querySelectorAll('#productSupplier, #editSupplierSelect');
    console.log('📦 [Products] Found', supplierSelects.length, 'supplier select elements');
    
    supplierSelects.forEach(select => {
      if (select) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Supplier (Optional)</option>';
        
        if (suppliers.length > 0) {
          select.innerHTML += suppliers.map(sup => 
            `<option value="${sup._id}">${sup.name}</option>`
          ).join('');
          console.log(`✅ [Products] Added ${suppliers.length} suppliers to dropdown`);
        }
        
        // Restore previous value if it still exists
        if (currentValue) {
          select.value = currentValue;
        }
      }
    });
  } catch (error) {
    console.error('❌ [Products] Error loading suppliers:', error);
  }
}

// Load warehouses and render the multi-select checkbox list
async function loadWarehouses() {
  const list = document.getElementById('warehouseStockList');
  if (!list) return;

  try {
    const response = await fetch(`${API_BASE_URL}/warehouses`, {
      headers: getHeaders()
    });

    const data = await response.json();

    // Check for session expiry
    if (window.handleApiError && window.handleApiError(response, data)) return;

    if (!response.ok) {
      list.innerHTML = '<div class="text-muted small text-danger">Could not load warehouses.</div>';
      return;
    }

    const warehouses = data.data?.warehouses || [];
    console.log(`🏢 [Products] Found ${warehouses.length} warehouses`);

    if (warehouses.length === 0) {
      list.innerHTML = '<div class="text-muted small">No warehouses available.</div>';
      return;
    }

    list.innerHTML = `
      <div class="d-flex align-items-center gap-2 mb-1 pb-1 border-bottom">
        <div class="form-check mb-0 flex-grow-1" style="min-width: 0;">
          <input
            class="form-check-input"
            type="checkbox"
            id="wh_check_all"
          >
          <label class="form-check-label fw-semibold" for="wh_check_all">Select All</label>
        </div>
      </div>
    ` + warehouses.map(wh => `
      <div class="d-flex align-items-center gap-2 mb-2 warehouse-row" data-id="${wh._id}">
        <div class="form-check mb-0 flex-grow-1" style="min-width: 0;">
          <input
            class="form-check-input wh-checkbox"
            type="checkbox"
            id="wh_check_${wh._id}"
            value="${wh._id}"
          >
          <label class="form-check-label text-truncate w-100" for="wh_check_${wh._id}" title="${wh.code} — ${wh.name}">
            <span class="fw-semibold">${wh.code}</span>
            <span class="text-muted">— ${wh.name}</span>
          </label>
        </div>
        <input
          type="number"
          class="form-control form-control-sm wh-qty-input"
          id="wh_qty_${wh._id}"
          placeholder="Qty"
          min="0"
          value="0"
          style="width: 90px; flex-shrink: 0;"
          disabled
          aria-label="Quantity for ${wh.name}"
        >
      </div>
    `).join('');

    // Bind Select All checkbox
    const selectAllCb = list.querySelector('#wh_check_all');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', function () {
        list.querySelectorAll('.wh-checkbox').forEach(cb => {
          cb.checked = this.checked;
          const qtyInput = document.getElementById('wh_qty_' + cb.value);
          if (qtyInput) {
            qtyInput.disabled = !this.checked;
            if (!this.checked) qtyInput.value = '0';
          }
        });
        validateWarehouseQty();
      });
    }

    // Bind checkbox → enable/disable qty input
    list.querySelectorAll('.wh-checkbox').forEach(cb => {
      cb.addEventListener('change', function () {
        const qtyInput = document.getElementById('wh_qty_' + this.value);
        if (this.checked) {
          qtyInput.disabled = false;
          qtyInput.focus();
          qtyInput.select();
        } else {
          qtyInput.disabled = true;
          qtyInput.value = '0';
        }
        // Update Select All state
        const allCbs = list.querySelectorAll('.wh-checkbox');
        const allChecked = Array.from(allCbs).every(c => c.checked);
        const noneChecked = Array.from(allCbs).every(c => !c.checked);
        if (selectAllCb) {
          selectAllCb.checked = allChecked;
          selectAllCb.indeterminate = !allChecked && !noneChecked;
        }
        validateWarehouseQty();
      });
    });

    // Revalidate whenever a qty changes
    list.querySelectorAll('.wh-qty-input').forEach(inp => {
      inp.addEventListener('input', validateWarehouseQty);
    });

    console.log(`✅ [Products] Rendered ${warehouses.length} warehouses as checkbox list`);
  } catch (error) {
    console.error('❌ [Products] Error loading warehouses:', error);
    if (list) {
      list.innerHTML = '<div class="text-muted small text-danger">Failed to load warehouses.</div>';
    }
  }
}

/**
 * Validate that the sum of all selected warehouse quantities
 * does not exceed the total product quantity.
 * @returns {boolean} true when valid
 */
function validateWarehouseQty() {
  const totalQty = parseInt(document.getElementById('productQuantity')?.value) || 0;
  let totalWHQty = 0;

  document.querySelectorAll('#warehouseStockList .wh-checkbox:checked').forEach(cb => {
    totalWHQty += parseInt(document.getElementById('wh_qty_' + cb.value)?.value) || 0;
  });

  const errorEl = document.getElementById('warehouseQtyError');
  if (!errorEl) return true;

  if (totalWHQty > totalQty) {
    errorEl.textContent =
      `Assigned warehouse quantity (${totalWHQty}) exceeds total product quantity (${totalQty}).`;
    errorEl.style.display = 'block';
    return false;
  }

  errorEl.style.display = 'none';
  return true;
}

// Handle add product
async function handleAddProduct(e) {
  e.preventDefault();

  const formData = new FormData(addProductForm);
  const supplierValue = formData.get('supplier');
  const priceValue = formData.get('price');
  const quantityValue = formData.get('quantity');
  const minStockValue = formData.get('minStock');

  const productData = {
    sku: formData.get('sku')?.trim().toUpperCase(),
    name: formData.get('name')?.trim(),
    description: formData.get('description')?.trim() || '',
    category: formData.get('category'),
    unitPrice: priceValue ? parseFloat(priceValue) : 0,
    quantity: quantityValue ? parseInt(quantityValue) : 0,
    minStockLevel: minStockValue ? parseInt(minStockValue) : 10,
    status: 'available'
  };

  // Only add supplier if one is selected
  if (supplierValue && supplierValue.trim() !== '') {
    productData.supplier = supplierValue.trim();
  }

  // Collect all checked warehouses with their quantities
  const selectedWarehouses = [];
  document.querySelectorAll('#warehouseStockList .wh-checkbox:checked').forEach(cb => {
    const qty = parseInt(document.getElementById('wh_qty_' + cb.value)?.value) || 0;
    selectedWarehouses.push({
      warehouse: cb.value,
      quantity: qty,
      minStockLevel: minStockValue ? parseInt(minStockValue) : 10
    });
  });

  // Frontend validation: total warehouse qty must not exceed product quantity
  if (selectedWarehouses.length > 0) {
    const totalWHQty = selectedWarehouses.reduce((sum, ws) => sum + ws.quantity, 0);
    if (totalWHQty > productData.quantity) {
      showAlert(
        `Assigned warehouse quantity (${totalWHQty}) exceeds total product quantity (${productData.quantity}).`,
        'danger'
      );
      // Make sure the error indicator is visible too
      validateWarehouseQty();
      return;
    }
    productData.warehouseStock = selectedWarehouses;
  }

  try {
    console.log('Sending product data:', productData);

    const response = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(productData)
    });

    const data = await response.json();
    console.log('Server response:', data);

    if (!response.ok) {
      // Show detailed validation errors if available
      let errorMessage = data.message || 'Failed to add product';

      // Handle validation errors array
      if (data.errors && Array.isArray(data.errors)) {
        errorMessage = data.errors.map(err => {
          if (typeof err === 'string') return err;
          if (err.message) return err.message;
          if (err.msg) return err.msg;
          return JSON.stringify(err);
        }).join(', ');
      }

      console.error('Validation failed:', errorMessage);
      console.error('Full error response:', data);
      throw new Error(errorMessage);
    }

    showAlert('Product added successfully!', 'success');
    addProductForm.reset();

    // Reset warehouse checklist UI
    document.querySelectorAll('#warehouseStockList .wh-checkbox').forEach(cb => {
      cb.checked = false;
    });
    document.querySelectorAll('#warehouseStockList .wh-qty-input').forEach(inp => {
      inp.value = '0';
      inp.disabled = true;
    });
    const errorEl = document.getElementById('warehouseQtyError');
    if (errorEl) errorEl.style.display = 'none';

    // Close modal
    const modalElement = document.getElementById('addProductModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();

    // Reload products to show new product
    loadProducts();
  } catch (error) {
    console.error('Error adding product:', error);
    console.error('Product data sent:', productData);

    // Better error message handling
    let displayMessage = 'Failed to add product';
    if (error.message && error.message !== '[object Object]') {
      displayMessage = error.message;
    } else if (typeof error === 'string') {
      displayMessage = error;
    }

    showAlert(displayMessage, 'danger');
  }
}

// Show edit modal
async function showEditModal(productId) {
  currentEditId = productId;

  try {
    const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch product details');
    }

    const data = await response.json();
    console.log('API Response:', data); // Debug log
    
    // Handle different response structures
    const product = data.data?.product || data.data || data;
    
    if (!product || !product.sku) {
      console.error('Invalid product data:', product);
      throw new Error('Invalid product data received');
    }

    // Populate form
    document.getElementById('editSku').value = product.sku;
    document.getElementById('editName').value = product.name;
    document.getElementById('editDescription').value = product.description || '';
    document.getElementById('editCategory').value = product.category;
    document.getElementById('editPrice').value = product.unitPrice;  // Changed from price
    document.getElementById('editQuantity').value = product.quantity;
    document.getElementById('editReorderLevel').value = product.minStockLevel;  // Changed from reorderLevel
    document.getElementById('editSupplierSelect').value = product.supplier?._id || '';
    document.getElementById('editStatus').value = product.status;

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('editProductModal'));
    modal.show();
  } catch (error) {
    console.error('Error loading product:', error);
    showAlert(error.message, 'danger');
  }
}

// Handle edit product
async function handleEditProduct(e) {
  e.preventDefault();

  if (!currentEditId) return;

  const formData = new FormData(editProductForm);
  const productData = {
    sku: formData.get('sku'),
    name: formData.get('name'),
    description: formData.get('description'),
    category: formData.get('category'),
    unitPrice: parseFloat(formData.get('price')),  // Changed: price -> unitPrice
    quantity: parseInt(formData.get('quantity')),
    minStockLevel: parseInt(formData.get('reorderLevel')),  // Changed: reorderLevel -> minStockLevel
    supplier: formData.get('supplier') || undefined,
    status: formData.get('status')
  };

  try {
    const response = await fetch(`${API_BASE_URL}/products/${currentEditId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(productData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update product');
    }

    showAlert('Product updated successfully', 'success');
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
    if (modal) modal.hide();
    
    currentEditId = null;
    loadProducts();
  } catch (error) {
    console.error('Error updating product:', error);
    showAlert(error.message, 'danger');
  }
}

// Delete product
async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to delete this product?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete product');
    }

    showAlert('Product deleted successfully', 'success');
    loadProducts();
  } catch (error) {
    console.error('Error deleting product:', error);
    showAlert(error.message, 'danger');
  }
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

// Show product detail modal
async function showDetailModal(productId) {
  const modalEl = document.getElementById('productDetailModal');
  const body = document.getElementById('productDetailBody');

  // Show spinner
  body.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading…</span>
      </div>
    </div>`;

  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  try {
    const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Failed to fetch product details');

    const data = await response.json();
    const p = data.data?.product || data.data || data;

    // Status badge colour
    const statusColor = {
      available: 'success',
      low_stock: 'warning',
      out_of_stock: 'danger',
      discontinued: 'secondary'
    }[p.status] || 'secondary';

    // Warehouse rows
    let warehouseSection = '';
    if (p.warehouseStock && p.warehouseStock.length > 0) {
      const rows = p.warehouseStock.map(ws => {
        const wh = ws.warehouse;
        const whName = wh?.name || 'Unknown Warehouse';
        const whCode = wh?.code || '—';
        const whCity = wh?.location?.city || '';
        return `
          <tr>
            <td>
              <span class="fw-semibold">${whCode}</span>
              <div class="text-muted small">${whName}${whCity ? ' · ' + whCity : ''}</div>
            </td>
            <td class="text-center">
              <span class="badge bg-primary fs-6">${ws.quantity}</span>
            </td>
            <td class="text-center text-muted small">${ws.minStockLevel ?? '—'}</td>
            <td class="text-muted small">${ws.location || '—'}</td>
            <td class="text-muted small">${ws.lastRestocked ? new Date(ws.lastRestocked).toLocaleDateString() : '—'}</td>
          </tr>`;
      }).join('');

      warehouseSection = `
        <h6 class="fw-semibold mt-4 mb-2">
          <i class="bi bi-building me-1 text-primary"></i>Warehouse Stock Distribution
        </h6>
        <div class="table-responsive">
          <table class="table table-bordered table-sm align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Warehouse</th>
                <th class="text-center">Quantity</th>
                <th class="text-center">Min Stock</th>
                <th>Location / Aisle</th>
                <th>Last Restocked</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    } else {
      warehouseSection = `
        <div class="alert alert-secondary mt-3 mb-0 py-2">
          <i class="bi bi-info-circle me-1"></i>This product is not assigned to any warehouse.
        </div>`;
    }

    body.innerHTML = `
      <!-- Basic info -->
      <div class="row g-3 mb-2">
        <div class="col-sm-8">
          <p class="text-muted small mb-0">Product Name</p>
          <p class="fw-semibold mb-0 fs-5">${p.name}</p>
        </div>
        <div class="col-sm-4 text-sm-end">
          <span class="badge bg-${statusColor} fs-6 px-3">${p.status?.replace('_', ' ')}</span>
        </div>
      </div>
      <hr class="my-2">
      <div class="row g-3">
        <div class="col-sm-4">
          <p class="text-muted small mb-0">SKU</p>
          <p class="fw-semibold mb-0">${p.sku}</p>
        </div>
        <div class="col-sm-4">
          <p class="text-muted small mb-0">Category</p>
          <p class="fw-semibold mb-0 text-capitalize">${p.category?.replace('_', ' ')}</p>
        </div>
        <div class="col-sm-4">
          <p class="text-muted small mb-0">Unit Price</p>
          <p class="fw-semibold mb-0">${typeof window.formatPrice === 'function' ? window.formatPrice(p.unitPrice || 0) : `Rs ${p.unitPrice?.toLocaleString('en-PK', { minimumFractionDigits: 2 }) || '0.00'}`}</p>
        </div>
        <div class="col-sm-4">
          <p class="text-muted small mb-0">Total Quantity</p>
          <p class="fw-semibold mb-0">${p.quantity}</p>
        </div>
        <div class="col-sm-4">
          <p class="text-muted small mb-0">Min Stock Level</p>
          <p class="fw-semibold mb-0">${p.minStockLevel ?? '—'}</p>
        </div>
        <div class="col-sm-4">
          <p class="text-muted small mb-0">Supplier</p>
          <p class="fw-semibold mb-0">${p.supplier?.name || 'N/A'}</p>
        </div>
        ${p.description ? `
        <div class="col-12">
          <p class="text-muted small mb-0">Description</p>
          <p class="mb-0">${p.description}</p>
        </div>` : ''}
      </div>
      ${warehouseSection}`;
  } catch (error) {
    console.error('Error loading product details:', error);
    body.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

// Note: handleLogout() is provided by navbar.js

// Expose functions to global scope for inline onclick handlers
window.showEditModal = showEditModal;
window.deleteProduct = deleteProduct;
window.showDetailModal = showDetailModal;
