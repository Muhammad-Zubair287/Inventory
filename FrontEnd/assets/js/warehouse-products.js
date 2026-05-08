// Warehouse Products Page JavaScript

// API_BASE_URL is already declared in navbar.js
let currentWarehouseId = null;
let allProducts = [];

// Load warehouse and products on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication first
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        console.log('❌ [Warehouse Products] Not authenticated, redirecting to login');
        return;
    }
    
    // Get warehouse ID and name from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentWarehouseId = urlParams.get('id');
    const warehouseName = urlParams.get('name');

    if (!currentWarehouseId) {
        window.location.href = 'warehouse-list.html';
        return;
    }

    // Set warehouse name in breadcrumb and header
    if (warehouseName) {
        document.getElementById('warehouseNameBreadcrumb').textContent = warehouseName;
        document.getElementById('warehouseName').textContent = `${warehouseName} - Products`;
    }

    await loadWarehouseDetails();
    await loadWarehouseProducts();
    setupSearch();
});

// Load warehouse details
async function loadWarehouseDetails() {
    try {
        const token = sessionStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        const response = await fetch(`${window.API_BASE_URL}/warehouses/${currentWarehouseId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            sessionStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }

        const data = await response.json();

        if (data.success && data.data && data.data.warehouse) {
            displayWarehouseInfo(data.data.warehouse);
        }
    } catch (error) {
        console.error('Error loading warehouse details:', error);
    }
}

// Display warehouse information
function displayWarehouseInfo(warehouse) {
    document.getElementById('warehouseInfoName').textContent = warehouse.name;
    // warehouse.location is an object with city, state, etc.
    const locationStr = `${warehouse.location.city}, ${warehouse.location.state}`;
    document.getElementById('warehouseInfoLocation').textContent = locationStr;
}

// Load warehouse products
async function loadWarehouseProducts() {
    try {
        console.log('🔍 [Warehouse Products] Loading products for warehouse:', currentWarehouseId);
        const token = sessionStorage.getItem('token');
        if (!token) {
            console.log('❌ [Warehouse Products] No token found');
            window.location.href = 'login.html';
            return;
        }

        const url = `${window.API_BASE_URL}/warehouses/${currentWarehouseId}/inventory`;
        console.log('📡 [Warehouse Products] Fetching from:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📥 [Warehouse Products] Response status:', response.status);

        if (response.status === 401) {
            console.log('❌ [Warehouse Products] Unauthorized');
            sessionStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }

        const data = await response.json();
        console.log('📦 [Warehouse Products] Data received:', data);

        if (data.success && data.data && data.data.inventory) {
            console.log('✅ [Warehouse Products] Found products:', data.data.inventory.length);
            allProducts = data.data.inventory;
            displayProducts(data.data.inventory);
            updateProductCount(data.data.inventory.length);
        } else {
            console.log('⚠️ [Warehouse Products] No inventory in response');
            showError('Failed to load products');
        }
    } catch (error) {
        console.error('💥 [Warehouse Products] Error loading products:', error);
        console.error('💥 [Warehouse Products] Error message:', error.message);
        showError('Error loading products. Please try again.');
    }
}

// Display products in table
function displayProducts(products) {
    const tbody = document.getElementById('productsTableBody');
    
    if (!products || products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5">
                    <i class="bi bi-box-seam fs-1 text-muted"></i>
                    <p class="text-muted mt-3 mb-0">No products found in this warehouse</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = products.map(product => {
        const quantity = product.warehouseQuantity || 0;
        const unitPrice = product.unitPrice || product.price || 0; // Try both fields
        const totalValue = quantity * unitPrice;
        
        // Determine status badge
        let statusBadge = '';
        if (product.status === 'available') {
            statusBadge = '<span class="badge bg-success">Available</span>';
        } else if (product.status === 'low_stock') {
            statusBadge = '<span class="badge bg-warning">Low Stock</span>';
        } else if (product.status === 'out_of_stock') {
            statusBadge = '<span class="badge bg-danger">Out of Stock</span>';
        } else if (product.status === 'discontinued') {
            statusBadge = '<span class="badge bg-secondary">Discontinued</span>';
        }

        return `
            <tr class="product-row" data-name="${product.name.toLowerCase()}" data-sku="${product.sku.toLowerCase()}" data-category="${(product.category || '').toLowerCase()}">
                <td>
                    <div class="fw-semibold">${product.name}</div>
                    ${product.description ? `<small class="text-muted">${product.description.substring(0, 50)}${product.description.length > 50 ? '...' : ''}</small>` : ''}
                </td>
                <td><span class="badge bg-light text-dark">${product.sku}</span></td>
                <td>${product.category || '-'}</td>
                <td>
                    <span class="badge ${quantity > 10 ? 'bg-success' : quantity > 0 ? 'bg-warning' : 'bg-danger'} rounded-pill">
                        ${quantity.toLocaleString()}
                    </span>
                </td>
                <td>${typeof window.formatPrice === 'function' ? window.formatPrice(unitPrice) : `Rs ${unitPrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td>
                <td class="fw-semibold">${typeof window.formatPrice === 'function' ? window.formatPrice(totalValue) : `Rs ${totalValue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

// Update product count
function updateProductCount(count) {
    document.getElementById('totalProductsBadge').textContent = `${count} Product${count !== 1 ? 's' : ''}`;
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchProduct');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const productRows = document.querySelectorAll('.product-row');
            let visibleCount = 0;
            
            productRows.forEach(row => {
                const name = row.dataset.name;
                const sku = row.dataset.sku;
                const category = row.dataset.category;
                
                if (name.includes(searchTerm) || sku.includes(searchTerm) || category.includes(searchTerm)) {
                    row.style.display = '';
                    visibleCount++;
                } else {
                    row.style.display = 'none';
                }
            });
            
            updateProductCount(visibleCount);
        });
    }
}

// Show error message
function showError(message) {
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="7">
                <div class="alert alert-danger m-3" role="alert">
                    <i class="bi bi-exclamation-triangle me-2"></i>${message}
                </div>
            </td>
        </tr>
    `;
}
