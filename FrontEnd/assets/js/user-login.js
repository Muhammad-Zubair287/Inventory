// User Login JavaScript
// API_BASE_URL is set by config.js

// Check if already logged in (requires both a token AND an active session marker).
// sessionActive is stored in sessionStorage so it clears on browser close,
// preventing auto-login from a stale localStorage token.
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');
  const sessionActive = sessionStorage.getItem('sessionActive');
  
  if (token && userRole && sessionActive && userRole !== 'admin') {
    window.location.href = '/pages/user-dashboard.html';
  }
});

// Handle login form submission
document.getElementById('userLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    console.log('🔐 [Login] Attempting login with:', email);
    console.log('🔐 [Login] API URL:', window.API_BASE_URL);
    
    const response = await fetch(`${window.API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    console.log('📥 [Login] Response status:', response.status);
    console.log('📦 [Login] Response data:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    const { user, token } = data.data;
    
    console.log('👤 [Login] User object:', user);
    console.log('👤 [Login] User has warehouse?', !!user.warehouse);
    console.log('👤 [Login] Warehouse data:', user.warehouse);

    // Check if user is active
    if (user.status !== 'active') {
      showAlert(`Your account is ${user.status}. Please contact administrator.`, 'danger');
      return;
    }

    // Check if user is not admin (operational user)
    if (user.role === 'admin') {
      showAlert('Admin users should use the admin login page.', 'warning');
      setTimeout(() => {
        window.location.href = '/pages/login.html';
      }, 2000);
      return;
    }

    // Check if warehouse is assigned
    if (!user.warehouse) {
      console.error('❌ [Login] No warehouse assigned to user');
      showAlert('No warehouse assigned. Please contact administrator.', 'danger');
      return;
    }

    console.log('💾 [Login] Saving to localStorage...');
    // Store user data in localStorage
    localStorage.setItem('token', token);
    // Mark as active session — sessionStorage is cleared on browser close,
    // so stale localStorage tokens cannot auto-login on next browser open.
    sessionStorage.setItem('sessionActive', 'true');
    localStorage.setItem('userId', user._id);
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userRole', user.role);
    localStorage.setItem('warehouseId', user.warehouse._id);
    localStorage.setItem('warehouseName', user.warehouse.name);
    localStorage.setItem('warehouseCode', user.warehouse.code);
    
    console.log('✅ [Login] Data saved to localStorage:', {
      token: 'saved',
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      warehouseId: user.warehouse._id,
      warehouseName: user.warehouse.name
    });

    // Show success message
    showAlert('Login successful! Redirecting...', 'success');

    // Redirect to user dashboard
    setTimeout(() => {
      window.location.href = '/pages/user-dashboard.html';
    }, 1000);

  } catch (error) {
    console.error('❌ [Login] Login error:', error);
    showAlert(error.message || 'Invalid email or password', 'danger');
  }
});

// Show alert function
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
