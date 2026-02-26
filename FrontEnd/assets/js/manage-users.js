// User Management JavaScript
// API_BASE_URL is provided by navbar.js

// Note: getToken() and checkAuth() are provided by navbar.js

// API Headers with token
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

// DOM Elements
let usersTableBody;
let addUserModal;
let editUserModal;
let changePasswordModal;
let addUserForm;
let editUserForm;
let changePasswordForm;
let searchInput;
let currentEditId = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Get DOM elements
  usersTableBody = document.getElementById('usersTableBody');
  addUserForm = document.getElementById('addUserForm');
  editUserForm = document.getElementById('editUserForm');
  changePasswordForm = document.getElementById('changePasswordForm');
  searchInput = document.getElementById('searchInput');
  roleFilter = document.getElementById('roleFilter');

  // Load initial data
  loadUsers();
  loadWarehouses(); // Load warehouses for dropdown

  // Role change → toggle warehouse section
  const addRoleSelect = document.getElementById('addRole');
  if (addRoleSelect) {
    addRoleSelect.addEventListener('change', handleRoleChange);
  }

  // Reset warehouse section when modal closes
  const addModalEl = document.getElementById('addUserModal');
  if (addModalEl) {
    addModalEl.addEventListener('hidden.bs.modal', () => {
      handleRoleChange(); // reset to single mode
    });
  }

  // Event listeners
  if (addUserForm) {
    addUserForm.addEventListener('submit', handleAddUser);
  }
  if (editUserForm) {
    editUserForm.addEventListener('submit', handleEditUser);
  }
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', handleChangePassword);
  }
  if (searchInput) {
    searchInput.addEventListener('input', debounce(loadUsers, 500));
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

// Load all users
async function loadUsers() {
  try {
    const params = new URLSearchParams();
    
    if (searchInput && searchInput.value) {
      params.append('search', searchInput.value);
    }

    const response = await fetch(`${API_BASE_URL}/users?${params.toString()}`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    const data = await response.json();
    displayUsers(data.data.users);
  } catch (error) {
    console.error('Error loading users:', error);
    showAlert('Failed to load users', 'danger');
  }
}

// Display users in table
function displayUsers(users) {
  if (!usersTableBody) return;

  // Filter out admin users
  const filteredUsers = users.filter(user => user.role !== 'admin');

  if (!filteredUsers || filteredUsers.length === 0) {
    usersTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No users found</td></tr>';
    return;
  }

  usersTableBody.innerHTML = filteredUsers.map(user => {
    // Set badge color based on role
    let roleBadgeClass = 'secondary';
    if (user.role === 'manager') {
      roleBadgeClass = 'warning';
    } else if (user.role === 'staff') {
      roleBadgeClass = 'info';
    } else if (user.role === 'viewer') {
      roleBadgeClass = 'secondary';
    }
    
    const warehouse = user.warehouses && user.warehouses.length > 0
      ? user.warehouses.map(wh => `${wh.code || ''} — ${wh.name || ''}`).join(', ')
      : user.warehouse
        ? `${user.warehouse.code || ''} — ${user.warehouse.name || ''}`
        : '<span class="text-muted">N/A</span>';
    const statusClass = user.status === 'active' ? 'success' : user.status === 'inactive' ? 'secondary' : 'warning';
    const statusText = user.status || 'active';
    
    // Capitalize role for display
    const roleDisplay = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    
    return `
      <tr>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td><span class="badge bg-${roleBadgeClass}">${roleDisplay}</span></td>
        <td>${warehouse}</td>
        <td>
          <span class="badge bg-${statusClass}">
            ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="showEditModal('${user._id}')" title="Edit User">
            <i class="bi bi-pencil-square"></i> Edit
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${user._id}')" title="Delete User">
            <i class="bi bi-trash"></i> Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Load warehouses for dropdown and checklist
async function loadWarehouses() {
  try {
    const response = await fetch(`${API_BASE_URL}/warehouses`, {
      headers: getHeaders()
    });

    const data = await response.json();

    if (data.success && data.data && data.data.warehouses) {
      const warehouses = data.data.warehouses;

      // Single-select dropdown (Staff / Viewer)
      const warehouseSelect = document.getElementById('addWarehouse');
      if (warehouseSelect) {
        warehouseSelect.innerHTML = warehouses.length === 0
          ? '<option value="">No warehouses available</option>'
          : '<option value="">Select Warehouse</option>' +
            warehouses.map(wh =>
              `<option value="${wh._id}">${wh.code} - ${wh.name}</option>`
            ).join('');
      }

      // Checklist (Manager)
      const checklist = document.getElementById('addWarehouseChecklist');
      if (checklist) {
        if (warehouses.length === 0) {
          checklist.innerHTML = '<div class="text-muted small">No warehouses available.</div>';
        } else {
          checklist.innerHTML = `
            <div class="form-check mb-1 pb-1 border-bottom">
              <input class="form-check-input" type="checkbox" id="mwh_select_all">
              <label class="form-check-label fw-semibold" for="mwh_select_all">Select All</label>
            </div>
          ` + warehouses.map(wh => `
            <div class="form-check mb-1">
              <input class="form-check-input wh-manager-cb" type="checkbox"
                id="mwh_${wh._id}" value="${wh._id}">
              <label class="form-check-label" for="mwh_${wh._id}">
                <span class="fw-semibold">${wh.code}</span>
                <span class="text-muted"> — ${wh.name}</span>
              </label>
            </div>
          `).join('');

          // Bind Select All
          const selectAllCb = checklist.querySelector('#mwh_select_all');
          if (selectAllCb) {
            selectAllCb.addEventListener('change', function () {
              checklist.querySelectorAll('.wh-manager-cb').forEach(cb => {
                cb.checked = this.checked;
              });
            });
            checklist.querySelectorAll('.wh-manager-cb').forEach(cb => {
              cb.addEventListener('change', function () {
                const allCbs = checklist.querySelectorAll('.wh-manager-cb');
                const allChecked = Array.from(allCbs).every(c => c.checked);
                const noneChecked = Array.from(allCbs).every(c => !c.checked);
                selectAllCb.checked = allChecked;
                selectAllCb.indeterminate = !allChecked && !noneChecked;
              });
            });
          }
        }
      }

      console.log(`Loaded ${warehouses.length} warehouses`);
    }
  } catch (error) {
    console.error('Error loading warehouses:', error);
    showAlert('Failed to load warehouses. Please refresh the page.', 'danger');
  }
}

// Toggle warehouse section based on selected role
function handleRoleChange() {
  const role = document.getElementById('addRole')?.value;
  const singleSection = document.getElementById('singleWarehouseSection');
  const multiSection = document.getElementById('multiWarehouseSection');
  const singleSelect = document.getElementById('addWarehouse');

  if (role === 'manager') {
    singleSection.style.display = 'none';
    multiSection.style.display = 'block';
    singleSelect.removeAttribute('required');
  } else {
    singleSection.style.display = 'block';
    multiSection.style.display = 'none';
    singleSelect.setAttribute('required', 'required');
    // Uncheck all manager checkboxes
    document.querySelectorAll('#addWarehouseChecklist .wh-manager-cb').forEach(cb => {
      cb.checked = false;
    });
    const errEl = document.getElementById('addWarehouseError');
    if (errEl) errEl.style.display = 'none';
  }
}

// Show add user modal
function showAddUserModal() {
  const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
  if (addUserForm) {
    addUserForm.reset();
  }
  modal.show();
}

// Handle add user
async function handleAddUser(e) {
  e.preventDefault();

  const formData = new FormData(addUserForm);
  const role = formData.get('role');

  // Validate role selection
  if (!role || role === '') {
    showAlert('Please select a user role', 'danger');
    return;
  }

  const userData = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: role,
    status: formData.get('isActive') === 'true' ? 'active' : 'inactive',
  };

  // Validate password confirmation
  const confirmPassword = formData.get('confirmPassword');
  if (userData.password !== confirmPassword) {
    showAlert('Passwords do not match', 'danger');
    return;
  }

  if (role === 'manager') {
    // Collect all checked warehouses
    const checkedWarehouses = [];
    document.querySelectorAll('#addWarehouseChecklist .wh-manager-cb:checked').forEach(cb => {
      checkedWarehouses.push(cb.value);
    });

    if (checkedWarehouses.length === 0) {
      const errEl = document.getElementById('addWarehouseError');
      if (errEl) errEl.style.display = 'block';
      showAlert('Please select at least one warehouse for the manager.', 'danger');
      return;
    }

    const errEl = document.getElementById('addWarehouseError');
    if (errEl) errEl.style.display = 'none';
    userData.warehouses = checkedWarehouses;
  } else {
    // Single warehouse for staff / viewer
    const warehouse = formData.get('warehouse');
    if (!warehouse || warehouse === '') {
      showAlert('Please select a warehouse', 'danger');
      return;
    }
    userData.warehouse = warehouse.trim();
  }

  console.log('Sending user data:', userData);

  try {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });

    const data = await response.json();
    console.log('Response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to add user');
    }

    showAlert('User added successfully', 'success');
    addUserForm.reset();
    handleRoleChange(); // reset warehouse section UI

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('addUserModal'));
    if (modal) modal.hide();

    loadUsers();
  } catch (error) {
    console.error('Error adding user:', error);
    showAlert(error.message, 'danger');
  }
}

// Show edit modal
async function showEditModal(userId) {
  currentEditId = userId;

  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user details');
    }

    const data = await response.json();
    const user = data.data.user;

    // Populate form
    document.getElementById('editName').value = user.name;
    document.getElementById('editEmail').value = user.email;
    document.getElementById('editRole').value = user.role;
    document.getElementById('editIsActive').value = user.isActive.toString();

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
    modal.show();
  } catch (error) {
    console.error('Error loading user:', error);
    showAlert(error.message, 'danger');
  }
}

// Handle edit user
async function handleEditUser(e) {
  e.preventDefault();

  if (!currentEditId) return;

  const formData = new FormData(editUserForm);
  const userData = {
    name: formData.get('name'),
    email: formData.get('email'),
    role: formData.get('role'),
    isActive: formData.get('isActive') === 'true'
  };

  try {
    const response = await fetch(`${API_BASE_URL}/users/${currentEditId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update user');
    }

    showAlert('User updated successfully', 'success');
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
    if (modal) modal.hide();
    
    currentEditId = null;
    loadUsers();
  } catch (error) {
    console.error('Error updating user:', error);
    showAlert(error.message, 'danger');
  }
}

// Toggle user active status
async function toggleUserStatus(userId, newStatus) {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ isActive: newStatus })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update user status');
    }

    showAlert(`User ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
    loadUsers();
  } catch (error) {
    console.error('Error updating user status:', error);
    showAlert(error.message, 'danger');
  }
}

// Delete user
async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete user');
    }

    showAlert('User deleted successfully', 'success');
    loadUsers();
  } catch (error) {
    console.error('Error deleting user:', error);
    showAlert(error.message, 'danger');
  }
}

// Show change password modal
function showChangePasswordModal(userId) {
  currentEditId = userId;
  
  if (changePasswordForm) {
    changePasswordForm.reset();
  }
  
  const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
  modal.show();
}

// Handle change password
async function handleChangePassword(e) {
  e.preventDefault();

  const formData = new FormData(changePasswordForm);
  const newPassword = formData.get('newPassword');
  const confirmPassword = formData.get('confirmPassword');

  if (newPassword !== confirmPassword) {
    showAlert('Passwords do not match', 'danger');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        currentPassword: formData.get('currentPassword'),
        newPassword: newPassword
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to change password');
    }

    showAlert('Password changed successfully', 'success');
    changePasswordForm.reset();
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
    if (modal) modal.hide();
  } catch (error) {
    console.error('Error changing password:', error);
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

// Logout handler
async function handleLogout() {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'Post',
      headers: getHeaders()
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    localStorage.clear();
    window.location.href = 'login.html';
  }
}
