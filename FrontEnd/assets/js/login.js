/**
 * Login Form Handler
 * Handles form validation and submission for user login
 */

// Use API_BASE_URL from config.js or window object
// Fallback to localhost for development
window.API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001/api';

// Get form elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const togglePasswordButton = document.getElementById('togglePassword');
const eyeIcon = document.getElementById('eyeIcon');
const eyeSlashIcon = document.getElementById('eyeSlashIcon');

// Toggle password visibility
togglePasswordButton.addEventListener('click', () => {
  const type = passwordInput.type === 'password' ? 'text' : 'password';
  passwordInput.type = type;
  
  // Toggle icons
  eyeIcon.classList.toggle('d-none');
  eyeSlashIcon.classList.toggle('d-none');
});


// Error display helper
function showError(input, message) {
  // Remove any existing error
  clearError(input);
  
  // Create error element
  const errorDiv = document.createElement('div');
  errorDiv.className = 'invalid-feedback d-block';
  errorDiv.textContent = message;
  
  // Add error class to input
  input.classList.add('is-invalid');
  
  // Insert error message after input
  input.parentElement.appendChild(errorDiv);
}

// Clear error helper
function clearError(input) {
  input.classList.remove('is-invalid');
  const errorDiv = input.parentElement.querySelector('.invalid-feedback');
  if (errorDiv) {
    errorDiv.remove();
  }
}

// Clear all errors
function clearAllErrors() {
  [emailInput, passwordInput].forEach(input => clearError(input));
}

// Validate email format
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate form
function validateForm() {
  let isValid = true;
  clearAllErrors();

  // Validate email
  const email = emailInput.value.trim();
  if (!email) {
    showError(emailInput, 'Email is required');
    isValid = false;
  } else if (!validateEmail(email)) {
    showError(emailInput, 'Please enter a valid email address');
    isValid = false;
  }

  // Validate password
  const password = passwordInput.value;
  if (!password) {
    showError(passwordInput, 'Password is required');
    isValid = false;
  } else if (password.length < 6) {
    showError(passwordInput, 'Password must be at least 6 characters');
    isValid = false;
  }

  return isValid;
}

// Show loading state
function setLoading(isLoading) {
  const submitButton = loginForm.querySelector('button[type="submit"]');
  
  if (isLoading) {
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';
  } else {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Login';
  }
}

// Show alert message
function showAlert(message, type = 'danger') {
  // Remove any existing alerts
  const existingAlert = document.querySelector('.alert');
  if (existingAlert) {
    existingAlert.remove();
  }

  // Create alert element
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

  // Insert alert before form
  loginForm.insertBefore(alertDiv, loginForm.firstChild);

  // Auto dismiss after 5 seconds
  setTimeout(() => {
    if (alertDiv.parentElement) {
      alertDiv.remove();
    }
  }, 5000);
}

// Handle form submission
async function handleLogin(event) {
  event.preventDefault();

  // Validate form
  if (!validateForm()) {
    return;
  }

  // Get form data
  const formData = {
    email: emailInput.value.trim(),
    password: passwordInput.value,
  };

  try {
    setLoading(true);

    // Send login request
    // This tells the browser to send data to your BACKEND login route
// const response = await fetch('/api/auth/login', { 
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(formData)
// });
    const response = await fetch(`${window.API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    const { user, token } = data.data;

    // Check if user is active
    if (user.status !== 'active') {
      throw new Error(`Your account is ${user.status}. Please contact administrator.`);
    }

    // Store token and core user data in localStorage
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Mark as active session — stored in sessionStorage so it is cleared when the browser closes.
    // admin-auth.js checks this marker to prevent auto-login from a stale localStorage token.
    sessionStorage.setItem('sessionActive', 'true');
    localStorage.setItem('userId', user._id);
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userRole', user.role);

    // Show success message
    showAlert('Login successful! Redirecting...', 'success');

    // Redirect based on user role
    setTimeout(() => {
      if (user.role === 'admin') {
        // Admin users go to admin dashboard
        window.location.href = '/pages/admin.html';
      } else if (user.role === 'manager' && user.warehouses && user.warehouses.length > 1) {
        // Manager with multiple warehouses — let them choose
        localStorage.setItem('managerWarehouses', JSON.stringify(user.warehouses));
        window.location.href = '/pages/manager-warehouse-select.html';
      } else {
        // Operational users (staff, viewer, single-warehouse manager) go to user dashboard
        if (!user.warehouse) {
          throw new Error('No warehouse assigned. Please contact administrator.');
        }
        localStorage.setItem('warehouseId', user.warehouse._id || user.warehouse);
        localStorage.setItem('warehouseName', user.warehouse.name || '');
        localStorage.setItem('warehouseCode', user.warehouse.code || '');
        window.location.href = '/pages/user-dashboard.html';
      }
    }, 1000);

  } catch (error) {
    console.error('Login error:', error);
    showAlert(error.message || 'An error occurred. Please try again.');
  } finally {
    setLoading(false);
  }
}

// Add real-time validation
emailInput.addEventListener('blur', () => {
  const email = emailInput.value.trim();
  if (email && !validateEmail(email)) {
    showError(emailInput, 'Please enter a valid email address');
  } else {
    clearError(emailInput);
  }
});

passwordInput.addEventListener('blur', () => {
  const password = passwordInput.value;
  if (password && password.length < 6) {
    showError(passwordInput, 'Password must be at least 6 characters');
  } else {
    clearError(passwordInput);
  }
});

// Clear errors on input
emailInput.addEventListener('input', () => clearError(emailInput));
passwordInput.addEventListener('input', () => clearError(passwordInput));

// Attach event listener to form
loginForm.addEventListener('submit', handleLogin);

// Check if already logged in (requires both a token AND an active session marker).
// sessionActive is stored in sessionStorage so it clears on browser close,
// preventing auto-login from a stale localStorage token.
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');
  const sessionActive = sessionStorage.getItem('sessionActive');
  
  if (token && userRole && sessionActive) {
    // Redirect to appropriate page based on role
    if (userRole === 'admin') {
      window.location.href = '/pages/admin.html';
    } else if (userRole === 'manager' && localStorage.getItem('managerWarehouses') && !localStorage.getItem('warehouseId')) {
      window.location.href = '/pages/manager-warehouse-select.html';
    } else {
      window.location.href = '/pages/user-dashboard.html';
    }
  }
});
