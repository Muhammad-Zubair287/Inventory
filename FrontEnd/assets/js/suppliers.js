// Suppliers Management JavaScript
// API_BASE_URL is provided by navbar.js

// Note: getToken() and checkAuth() are provided by navbar.js

// API Headers with token
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

// DOM Elements
let suppliersTableBody;
let addSupplierForm;
let editSupplierForm;
let searchInput;
let currentEditId = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Get DOM elements
  suppliersTableBody = document.getElementById('suppliersTableBody');
  addSupplierForm = document.getElementById('addSupplierForm');
  editSupplierForm = document.getElementById('editSupplierForm');
  searchInput = document.getElementById('searchInput');

  // Load initial data
  loadSuppliers();

  // Event listeners
  if (addSupplierForm) {
    addSupplierForm.addEventListener('submit', handleAddSupplier);
  }
  if (editSupplierForm) {
    editSupplierForm.addEventListener('submit', handleEditSupplier);
  }
  if (searchInput) {
    searchInput.addEventListener('input', debounce(loadSuppliers, 500));
  }

  // Logout functionality
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', handleLogout);
  });
});

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

// Load all suppliers
async function loadSuppliers() {
  try {
    console.log('Loading suppliers...');
    console.log('Token:', getToken() ? 'exists' : 'missing');
    
    const params = new URLSearchParams();
    params.append('limit', '1000');
    
    if (searchInput && searchInput.value) {
      params.append('search', searchInput.value);
    }

    const url = `${API_BASE_URL}/suppliers?${params.toString()}`;
    console.log('Fetching from:', url);

    const response = await fetch(url, {
      headers: getHeaders()
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error:', errorData);
      throw new Error(errorData.message || 'Failed to fetch suppliers');
    }

    const data = await response.json();
    console.log('API Response:', data);
    console.log('Suppliers received:', data.data?.suppliers?.length || 0);
    
    displaySuppliers(data.data.suppliers);
  } catch (error) {
    console.error('Error loading suppliers:', error);
    if (suppliersTableBody) {
      suppliersTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error: ${error.message}</td></tr>`;
    }
    showAlert('Failed to load suppliers: ' + error.message, 'danger');
  }
}

// Display suppliers in table
function displaySuppliers(suppliers) {
  console.log('displaySuppliers called with:', suppliers);
  
  if (!suppliersTableBody) {
    console.error('suppliersTableBody element not found!');
    return;
  }

  if (!suppliers || suppliers.length === 0) {
    console.log('No suppliers to display');
    suppliersTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No suppliers found</td></tr>';
    return;
  }

  console.log(`Displaying ${suppliers.length} suppliers`);
  
  suppliersTableBody.innerHTML = suppliers.map(supplier => `
    <tr>
      <td>${supplier.code}</td>
      <td>${supplier.name}</td>
      <td>${supplier.contactPerson || 'N/A'}</td>
      <td>${supplier.email}</td>
      <td>${supplier.phone}</td>
      <td>
        <span class="badge ${supplier.status === 'active' ? 'bg-success' : 'bg-secondary'}">
          ${supplier.status}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="showEditModal('${supplier._id}')">
          <i class="bi bi-pencil-square"></i> Edit
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteSupplier('${supplier._id}')">
          <i class="bi bi-trash"></i> Delete
        </button>
      </td>
    </tr>
  `).join('');
}

// Handle add supplier
async function handleAddSupplier(e) {
  e.preventDefault();

  const formData = new FormData(addSupplierForm);
  const supplierData = {
    code: formData.get('code'),
    name: formData.get('name'),
    contactPerson: formData.get('contactPerson') || '',
    email: formData.get('email'),
    phone: formData.get('phone'),
    address: formData.get('address') || '',
    status: formData.get('status') || 'active'
  };

  try {
    const response = await fetch(`${API_BASE_URL}/suppliers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(supplierData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to add supplier');
    }

    showAlert('Supplier added successfully!', 'success');
    addSupplierForm.reset();
    
    // Close modal
    const modalElement = document.getElementById('addSupplierModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();
    
    // Reload suppliers
    loadSuppliers();
  } catch (error) {
    console.error('Error adding supplier:', error);
    showAlert(error.message || 'Failed to add supplier', 'danger');
  }
}

// Show edit modal
async function showEditModal(supplierId) {
  currentEditId = supplierId;

  try {
    const response = await fetch(`${API_BASE_URL}/suppliers/${supplierId}`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch supplier details');
    }

    const data = await response.json();
    console.log('Supplier API response:', data);
    
    // The supplier is directly in data.data (not data.data.supplier)
    const supplier = data.data;
    
    console.log('Supplier object:', supplier);
    
    if (!supplier) {
      throw new Error('No supplier data received');
    }

    // Populate form with safe access
    document.getElementById('editCode').value = supplier.code || '';
    document.getElementById('editName').value = supplier.name || '';
    document.getElementById('editContactPerson').value = supplier.contactPerson || '';
    document.getElementById('editEmail').value = supplier.email || '';
    document.getElementById('editPhone').value = supplier.phone || '';
    
    // Handle address - could be string or object
    if (typeof supplier.address === 'string') {
      document.getElementById('editAddress').value = supplier.address;
    } else if (supplier.address && supplier.address.street) {
      document.getElementById('editAddress').value = supplier.address.street;
    } else {
      document.getElementById('editAddress').value = '';
    }
    
    document.getElementById('editStatus').value = supplier.status || 'active';

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('editSupplierModal'));
    modal.show();
  } catch (error) {
    console.error('Error loading supplier:', error);
    showAlert(error.message, 'danger');
  }
}

// Handle edit supplier
async function handleEditSupplier(e) {
  e.preventDefault();

  if (!currentEditId) return;

  const formData = new FormData(editSupplierForm);
  const supplierData = {
    code: formData.get('code'),
    name: formData.get('name'),
    contactPerson: formData.get('contactPerson'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    status: formData.get('status')
  };

  try {
    const response = await fetch(`${API_BASE_URL}/suppliers/${currentEditId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(supplierData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update supplier');
    }

    showAlert('Supplier updated successfully', 'success');
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('editSupplierModal'));
    if (modal) modal.hide();
    
    currentEditId = null;
    loadSuppliers();
  } catch (error) {
    console.error('Error updating supplier:', error);
    showAlert(error.message, 'danger');
  }
}

// Delete supplier
async function deleteSupplier(supplierId) {
  if (!confirm('Are you sure you want to delete this supplier?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/suppliers/${supplierId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete supplier');
    }

    showAlert('Supplier deleted successfully', 'success');
    loadSuppliers();
  } catch (error) {
    console.error('Error deleting supplier:', error);
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

// Note: handleLogout() is provided by navbar.js
