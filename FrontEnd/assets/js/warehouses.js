// Warehouses Management JavaScript
// API_BASE_URL is provided by navbar.js

// Note: getToken(), checkAuth(), and handleLogout() are provided by navbar.js

// API Headers with token
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

// DOM Elements
let warehousesTableBody;
let addWarehouseForm;
let editWarehouseForm;
let searchInput;
let statusFilter;
let currentEditId = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Get DOM elements
  warehousesTableBody = document.getElementById('warehousesTableBody');
  addWarehouseForm = document.getElementById('addWarehouseForm');
  editWarehouseForm = document.getElementById('editWarehouseForm');
  searchInput = document.getElementById('searchInput');
  statusFilter = document.getElementById('statusFilter');

  // Load initial data
  loadWarehouses();

  // Event listeners
  if (addWarehouseForm) {
    addWarehouseForm.addEventListener('submit', handleAddWarehouse);
  }
  if (editWarehouseForm) {
    editWarehouseForm.addEventListener('submit', handleEditWarehouse);
  }
  if (searchInput) {
    searchInput.addEventListener('input', debounce(loadWarehouses, 500));
  }
  if (statusFilter) {
    statusFilter.addEventListener('change', loadWarehouses);
  }
  
  // Add city filter listener
  const cityFilter = document.getElementById('cityFilter');
  if (cityFilter) {
    cityFilter.addEventListener('change', loadWarehouses);
  }

  // Logout functionality
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', handleLogout);
  });
});

// Clear all filters
function clearFilters() {
  if (searchInput) searchInput.value = '';
  if (statusFilter) statusFilter.value = '';
  const cityFilter = document.getElementById('cityFilter');
  if (cityFilter) cityFilter.value = '';
  loadWarehouses();
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

// Load all warehouses
async function loadWarehouses() {
  try {
    console.log('Loading warehouses...');
    console.log('Token:', getToken() ? 'exists' : 'missing');
    
    const params = new URLSearchParams();
    params.append('limit', '100');
    
    if (searchInput && searchInput.value) {
      params.append('search', searchInput.value);
    }

    if (statusFilter && statusFilter.value) {
      params.append('status', statusFilter.value);
    }
    
    // Add city filter
    const cityFilter = document.getElementById('cityFilter');
    if (cityFilter && cityFilter.value) {
      params.append('city', cityFilter.value);
    }

    const url = `${API_BASE_URL}/warehouses?${params.toString()}`;
    console.log('Fetching from:', url);

    const response = await fetch(url, {
      headers: getHeaders()
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error:', errorData);
      throw new Error(errorData.message || 'Failed to fetch warehouses');
    }

    const data = await response.json();
    console.log('API Response:', data);
    console.log('Warehouses received:', data.data?.warehouses?.length || 0);
    
    displayWarehouses(data.data.warehouses);
  } catch (error) {
    console.error('Error loading warehouses:', error);
    if (warehousesTableBody) {
      warehousesTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-5">Error: ${error.message}</td></tr>`;
    }
    showAlert('Failed to load warehouses: ' + error.message, 'danger');
  }
}

// Display warehouses in table
function displayWarehouses(warehouses) {
  console.log('displayWarehouses called with:', warehouses);
  
  if (!warehousesTableBody) {
    console.error('warehousesTableBody element not found!');
    return;
  }

  if (!warehouses || warehouses.length === 0) {
    console.log('No warehouses to display');
    warehousesTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">No warehouses found. Click "Add Warehouse" to create one.</td></tr>';
    updateStatistics([]); // Update stats with empty array
    return;
  }

  console.log(`Displaying ${warehouses.length} warehouses`);
  
  // Update statistics
  updateStatistics(warehouses);
  
  // Update warehouse count
  const countElement = document.getElementById('warehouseCount');
  if (countElement) {
    countElement.textContent = `${warehouses.length} warehouse${warehouses.length !== 1 ? 's' : ''}`;
  }
  
  warehousesTableBody.innerHTML = warehouses.map(warehouse => `
    <tr class="warehouse-row">
      <td class="ps-4">
        <div class="warehouse-code">${warehouse.code}</div>
      </td>
      <td>
        <div class="warehouse-name">${warehouse.name}</div>
      </td>
      <td>
        <div class="location-simple">
          ${warehouse.location?.city || 'N/A'}, ${warehouse.location?.state || ''}, ${warehouse.location?.country || ''}
        </div>
      </td>
      <td>
        <div class="contact-container">
          <div class="contact-item">
            <i class="bi bi-person-circle text-primary me-1"></i>
            <span class="fw-semibold">${warehouse.contactPerson || 'Not assigned'}</span>
          </div>
          <div class="contact-item">
            <i class="bi bi-telephone-fill text-success me-1"></i>
            <a href="tel:${warehouse.phone}" class="contact-link">${warehouse.phone}</a>
          </div>
          <div class="contact-item">
            <i class="bi bi-envelope-fill text-info me-1"></i>
            <a href="mailto:${warehouse.email}" class="contact-link">${warehouse.email}</a>
          </div>
        </div>
      </td>
      <td>
        <span class="status-badge status-${warehouse.status}">
          <i class="bi ${getStatusIcon(warehouse.status)} me-1"></i>
          <span>${capitalizeFirst(warehouse.status)}</span>
        </span>
      </td>
      <td class="text-center">
        <div class="action-buttons-vertical">
          <button type="button" class="btn btn-sm btn-outline-primary d-block w-100 mb-1" onclick="viewWarehouseDetails('${warehouse._id}')" title="View Details">
            <i class="bi bi-eye me-1"></i>View
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary d-block w-100 mb-1" onclick="showEditModal('${warehouse._id}')" title="Edit Warehouse">
            <i class="bi bi-pencil me-1"></i>Edit
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger d-block w-100" onclick="deleteWarehouse('${warehouse._id}')" title="Delete Warehouse">
            <i class="bi bi-trash me-1"></i>Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Update statistics cards
function updateStatistics(warehouses) {
  // Total warehouses
  const totalElement = document.getElementById('totalWarehouses');
  if (totalElement) {
    totalElement.textContent = warehouses.length;
  }
  
  // Active warehouses
  const activeCount = warehouses.filter(w => w.status === 'active').length;
  const activeElement = document.getElementById('activeWarehouses');
  if (activeElement) {
    activeElement.textContent = activeCount;
  }
  
  // Total capacity
  const totalCapacity = warehouses.reduce((sum, w) => sum + (w.capacity || 0), 0);
  const capacityElement = document.getElementById('totalCapacity');
  if (capacityElement) {
    capacityElement.textContent = totalCapacity > 0 ? totalCapacity.toLocaleString() : '0';
  }
  
  // Unique locations (cities)
  const uniqueCities = new Set(warehouses.map(w => w.location?.city).filter(Boolean));
  const locationsElement = document.getElementById('uniqueLocations');
  if (locationsElement) {
    locationsElement.textContent = uniqueCities.size;
  }
  
  // Maintenance warehouses
  const maintenanceCount = warehouses.filter(w => w.status === 'maintenance').length;
  const maintenanceElement = document.getElementById('maintenanceWarehouses');
  if (maintenanceElement) {
    maintenanceElement.textContent = maintenanceCount;
  }
  
  // Populate city filter
  const cityFilter = document.getElementById('cityFilter');
  if (cityFilter) {
    const currentValue = cityFilter.value;
    cityFilter.innerHTML = '<option value="">All Cities</option>';
    uniqueCities.forEach(city => {
      const option = document.createElement('option');
      option.value = city;
      option.textContent = city;
      cityFilter.appendChild(option);
    });
    cityFilter.value = currentValue; // Restore selection
  }
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Get status icon
function getStatusIcon(status) {
  const icons = {
    'active': 'bi-check-circle-fill',
    'inactive': 'bi-x-circle-fill',
    'maintenance': 'bi-wrench'
  };
  return icons[status] || 'bi-circle-fill';
}

// Get status badge class
function getStatusBadgeClass(status) {
  const statusClasses = {
    'active': 'bg-success',
    'inactive': 'bg-secondary',
    'maintenance': 'bg-warning text-dark'
  };
  return statusClasses[status] || 'bg-secondary';
}

// Handle add warehouse
async function handleAddWarehouse(e) {
  e.preventDefault();

  const formData = new FormData(addWarehouseForm);
  const warehouseData = {
    code: formData.get('code').toUpperCase(),
    name: formData.get('name'),
    location: {
      address: formData.get('address'),
      city: formData.get('city'),
      state: formData.get('state'),
      country: formData.get('country') || 'USA',
      zipCode: formData.get('zipCode')
    },
    contactPerson: formData.get('contactPerson') || '',
    phone: formData.get('phone'),
    email: formData.get('email'),
    status: formData.get('status') || 'active',
    capacity: parseInt(formData.get('capacity')) || 0
  };

  try {
    const response = await fetch(`${API_BASE_URL}/warehouses`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(warehouseData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to add warehouse');
    }

    showAlert('Warehouse added successfully!', 'success');
    addWarehouseForm.reset();
    
    // Close modal
    const modalElement = document.getElementById('addWarehouseModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();
    
    // Reload warehouses
    loadWarehouses();
  } catch (error) {
    console.error('Error adding warehouse:', error);
    showAlert(error.message, 'danger');
  }
}

// Show edit modal
async function showEditModal(warehouseId) {
  try {
    const response = await fetch(`${API_BASE_URL}/warehouses/${warehouseId}`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch warehouse details');
    }

    const data = await response.json();
    const warehouse = data.data.warehouse;

    // Populate form
    document.getElementById('editWarehouseId').value = warehouse._id;
    document.getElementById('editWarehouseCode').value = warehouse.code;
    document.getElementById('editWarehouseName').value = warehouse.name;
    document.getElementById('editWarehouseAddress').value = warehouse.location.address;
    document.getElementById('editWarehouseCity').value = warehouse.location.city;
    document.getElementById('editWarehouseState').value = warehouse.location.state;
    document.getElementById('editWarehouseCountry').value = warehouse.location.country;
    document.getElementById('editWarehouseZip').value = warehouse.location.zipCode;
    document.getElementById('editWarehouseContactPerson').value = warehouse.contactPerson || '';
    document.getElementById('editWarehousePhone').value = warehouse.phone;
    document.getElementById('editWarehouseEmail').value = warehouse.email;
    document.getElementById('editWarehouseStatus').value = warehouse.status;
    document.getElementById('editWarehouseCapacity').value = warehouse.capacity || '';

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('editWarehouseModal'));
    modal.show();
  } catch (error) {
    console.error('Error fetching warehouse details:', error);
    showAlert(error.message, 'danger');
  }
}

// Handle edit warehouse
async function handleEditWarehouse(e) {
  e.preventDefault();

  const formData = new FormData(editWarehouseForm);
  const warehouseId = formData.get('id');
  const warehouseData = {
    code: formData.get('code').toUpperCase(),
    name: formData.get('name'),
    location: {
      address: formData.get('address'),
      city: formData.get('city'),
      state: formData.get('state'),
      country: formData.get('country') || 'USA',
      zipCode: formData.get('zipCode')
    },
    contactPerson: formData.get('contactPerson') || '',
    phone: formData.get('phone'),
    email: formData.get('email'),
    status: formData.get('status'),
    capacity: parseInt(formData.get('capacity')) || 0
  };

  try {
    const response = await fetch(`${API_BASE_URL}/warehouses/${warehouseId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(warehouseData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update warehouse');
    }

    showAlert('Warehouse updated successfully!', 'success');
    
    // Close modal
    const modalElement = document.getElementById('editWarehouseModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();
    
    // Reload warehouses
    loadWarehouses();
  } catch (error) {
    console.error('Error updating warehouse:', error);
    showAlert(error.message, 'danger');
  }
}

// Delete warehouse
async function deleteWarehouse(warehouseId) {
  if (!confirm('Are you sure you want to delete this warehouse? This action cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/warehouses/${warehouseId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete warehouse');
    }

    showAlert('Warehouse deleted successfully!', 'success');
    loadWarehouses();
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    showAlert(error.message, 'danger');
  }
}

// View warehouse details
async function viewWarehouseDetails(warehouseId) {
  try {
    // Show loading state
    showAlert('Loading warehouse details...', 'info');
    
    const token = getToken(); // Use getToken() from navbar.js
    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    const response = await fetch(`${API_BASE_URL}/warehouses/${warehouseId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch warehouse details');
    }

    const data = await response.json();
    const warehouse = data.data.warehouse;

    // Create detailed view modal
    const detailsHTML = `
      <div class="modal fade" id="warehouseDetailsModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title"><i class="bi bi-building me-2"></i>Warehouse Details - ${warehouse.code}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row g-4">
                <div class="col-md-6">
                  <h6 class="text-muted mb-3"><i class="bi bi-info-circle me-1"></i>Basic Information</h6>
                  <table class="table table-sm table-borderless">
                    <tbody>
                      <tr>
                        <td class="fw-semibold text-muted" style="width: 140px;">Warehouse Code:</td>
                        <td><span class="badge bg-primary">${warehouse.code}</span></td>
                      </tr>
                      <tr>
                        <td class="fw-semibold text-muted">Warehouse Name:</td>
                        <td class="fw-semibold">${warehouse.name}</td>
                      </tr>
                      <tr>
                        <td class="fw-semibold text-muted">Status:</td>
                        <td><span class="badge bg-${warehouse.status === 'active' ? 'success' : warehouse.status === 'inactive' ? 'secondary' : 'warning'}">${warehouse.status.toUpperCase()}</span></td>
                      </tr>
                      <tr>
                        <td class="fw-semibold text-muted">Capacity:</td>
                        <td><i class="bi bi-boxes me-1 text-primary"></i>${warehouse.capacity ? warehouse.capacity.toLocaleString() + ' sq ft' : 'N/A'}</td>
                      </tr>
                      <tr>
                        <td class="fw-semibold text-muted">Created At:</td>
                        <td><i class="bi bi-calendar me-1 text-muted"></i>${new Date(warehouse.createdAt).toLocaleDateString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="col-md-6">
                  <h6 class="text-muted mb-3"><i class="bi bi-geo-alt me-1"></i>Location Details</h6>
                  <table class="table table-sm table-borderless">
                    <tbody>
                      <tr>
                        <td class="fw-semibold text-muted" style="width: 140px;">Address:</td>
                        <td>${warehouse.location?.address || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td class="fw-semibold text-muted">City:</td>
                        <td>${warehouse.location?.city || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td class="fw-semibold text-muted">State/Province:</td>
                        <td>${warehouse.location?.state || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td class="fw-semibold text-muted">Country:</td>
                        <td>${warehouse.location?.country || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td class="fw-semibold text-muted">Zip Code:</td>
                        <td>${warehouse.location?.zipCode || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="col-12">
                  <h6 class="text-muted mb-3"><i class="bi bi-person-lines-fill me-1"></i>Contact Information</h6>
                  <table class="table table-sm table-borderless">
                    <tbody>
                      <tr>
                        <td class="fw-semibold text-muted" style="width: 150px;">Contact Person:</td>
                        <td><i class="bi bi-person-circle text-primary me-1"></i>${warehouse.contactPerson || 'Not assigned'}</td>
                      </tr>
                      <tr>
                        <td class="fw-semibold text-muted">Phone Number:</td>
                        <td><i class="bi bi-telephone-fill text-success me-1"></i><a href="tel:${warehouse.phone}" class="text-decoration-none">${warehouse.phone}</a></td>
                      </tr>
                      <tr>
                        <td class="fw-semibold text-muted">Email Address:</td>
                        <td><i class="bi bi-envelope-fill text-info me-1"></i><a href="mailto:${warehouse.email}" class="text-decoration-none">${warehouse.email}</a></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                <i class="bi bi-x-circle me-1"></i>Close
              </button>
              <button type="button" class="btn btn-primary" onclick="closeDetailsAndEdit('${warehouse._id}')">
                <i class="bi bi-pencil me-1"></i>Edit Warehouse
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('warehouseDetailsModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', detailsHTML);

    // Show modal
    const modalElement = document.getElementById('warehouseDetailsModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();

    // Remove modal from DOM when hidden
    modalElement.addEventListener('hidden.bs.modal', function() {
      this.remove();
    });

  } catch (error) {
    console.error('Error viewing warehouse details:', error);
    showAlert('Failed to load warehouse details: ' + error.message, 'danger');
  }
}

// Helper function to close details modal and open edit modal
function closeDetailsAndEdit(warehouseId) {
  const detailsModal = bootstrap.Modal.getInstance(document.getElementById('warehouseDetailsModal'));
  if (detailsModal) {
    detailsModal.hide();
  }
  // Small delay to ensure smooth transition
  setTimeout(() => {
    showEditModal(warehouseId);
  }, 300);
}

// View warehouse inventory
function viewWarehouseInventory(warehouseId) {
  // Redirect to a warehouse inventory page or show modal
  window.location.href = `warehouse-inventory.html?id=${warehouseId}`;
}

// Show alert message
function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
  alertDiv.style.zIndex = '9999';
  alertDiv.style.minWidth = '300px';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(alertDiv);

  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

// Note: handleLogout() is provided by navbar.js
