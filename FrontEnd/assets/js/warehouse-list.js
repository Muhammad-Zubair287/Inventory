// Warehouse List Page JavaScript
console.log('🔵 [Warehouse List] JavaScript file is loading...');

// Get API_BASE_URL from window object
console.log('🚀 [Warehouse List] Script loaded! API URL:', window.API_BASE_URL);

// Load warehouses on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 [Warehouse List] DOM Content Loaded event fired');
    
    // Check authentication first
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        console.log('❌ [Warehouse List] Not authenticated, redirecting to login');
        return;
    }
    
    console.log('📄 [Warehouse List] About to call loadWarehouses()');
    try {
        await loadWarehouses();
        console.log('✅ [Warehouse List] loadWarehouses() completed');
        setupSearch();
        console.log('✅ [Warehouse List] setupSearch() completed');
    } catch (error) {
        console.error('💥 [Warehouse List] Error in DOMContentLoaded:', error);
        alert('ERROR in DOMContentLoaded: ' + error.message);
    }
});

// Load all warehouses
async function loadWarehouses() {
    try {
        console.log('🏢 [Warehouse List] Starting to load warehouses...');
        const token = sessionStorage.getItem('token');
        if (!token) {
            console.log('❌ [Warehouse List] No token found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        console.log('📡 [Warehouse List] Fetching from:', `${window.API_BASE_URL}/warehouses`);
        const response = await fetch(`${window.API_BASE_URL}/warehouses`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📥 [Warehouse List] Response status:', response.status);

        if (response.status === 401) {
            console.log('❌ [Warehouse List] Unauthorized, redirecting to login');
            sessionStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }

        const data = await response.json();
        console.log('📦 [Warehouse List] Data received:', data);

        if (data.success && data.data && data.data.warehouses) {
            console.log('✅ [Warehouse List] Found warehouses:', data.data.warehouses.length);
            displayWarehouses(data.data.warehouses);
        } else {
            console.log('⚠️ [Warehouse List] No warehouses in response');
            console.log('⚠️ [Warehouse List] Response data:', JSON.stringify(data));
            showError('Failed to load warehouses: ' + (data.message || 'No data returned'));
        }
    } catch (error) {
        console.error('💥 [Warehouse List] Error loading warehouses:', error);
        console.error('💥 [Warehouse List] Error name:', error.name);
        console.error('💥 [Warehouse List] Error message:', error.message);
        console.error('💥 [Warehouse List] Error stack:', error.stack);
        showError('Error loading warehouses: ' + error.message);
    }
}

// Display warehouses as cards
function displayWarehouses(warehouses) {
    const grid = document.getElementById('warehousesGrid');
    
    if (!warehouses || warehouses.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="bi bi-building fs-1 text-muted"></i>
                <p class="text-muted mt-3">No warehouses found</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = warehouses.map(warehouse => {
        // Build location string from location object
        const locationStr = `${warehouse.location.city}, ${warehouse.location.state}`;
        const locationSearch = locationStr.toLowerCase();
        
        return `
        <div class="col-xl-3 col-lg-4 col-md-6 warehouse-card" data-warehouse-name="${warehouse.name.toLowerCase()}" data-warehouse-location="${locationSearch}">
            <div class="card border-0 shadow-sm h-100 hover-card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="flex-grow-1">
                            <h5 class="card-title mb-1 fw-bold">${warehouse.name}</h5>
                            <p class="text-muted small mb-0">
                                <i class="bi bi-geo-alt me-1"></i>${locationStr}
                            </p>
                        </div>
                        <span class="badge ${warehouse.status === 'active' ? 'bg-success' : 'bg-secondary'} rounded-pill">
                            ${warehouse.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                    </div>

                    <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <small class="text-muted">Capacity</small>
                            <small class="fw-semibold">${warehouse.capacity ? warehouse.capacity.toLocaleString() + ' sq ft' : 'N/A'}</small>
                        </div>
                        ${warehouse.manager ? `
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">Manager</small>
                            <small class="fw-semibold">${warehouse.manager.name || warehouse.manager}</small>
                        </div>
                        ` : ''}
                    </div>

                    ${warehouse.description ? `
                    <p class="card-text small text-muted mb-3" style="max-height: 40px; overflow: hidden;">
                        ${warehouse.description}
                    </p>
                    ` : ''}

                    <div class="d-grid gap-2">
                        <button class="btn btn-primary btn-sm" onclick="viewWarehouseProducts('${warehouse._id}', '${warehouse.name.replace(/'/g, "\\'")}')">
                            <i class="bi bi-eye me-2"></i>View Products
                        </button>
                    </div>
                </div>

                ${warehouse.phone ? `
                <div class="card-footer bg-light border-0">
                    <small class="text-muted">
                        <i class="bi bi-telephone me-1"></i>${warehouse.phone}
                    </small>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    }).join('');
}

// View products in a warehouse
function viewWarehouseProducts(warehouseId, warehouseName) {
    // Navigate to warehouse products page
    window.location.href = `warehouse-products.html?id=${warehouseId}&name=${encodeURIComponent(warehouseName)}`;
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchWarehouse');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const warehouseCards = document.querySelectorAll('.warehouse-card');
            
            warehouseCards.forEach(card => {
                const name = card.dataset.warehouseName;
                const location = card.dataset.warehouseLocation;
                
                if (name.includes(searchTerm) || location.includes(searchTerm)) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }
}

// Show error message
function showError(message) {
    const grid = document.getElementById('warehousesGrid');
    grid.innerHTML = `
        <div class="col-12">
            <div class="alert alert-danger" role="alert">
                <i class="bi bi-exclamation-triangle me-2"></i>${message}
            </div>
        </div>
    `;
}

// Add hover effect styles
const style = document.createElement('style');
style.textContent = `
    .hover-card {
        transition: all 0.3s ease;
    }
    .hover-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
    }
`;
document.head.appendChild(style);
