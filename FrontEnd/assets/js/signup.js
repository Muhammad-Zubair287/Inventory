/**
 * Signup Form Handler
 * Handles form validation and submission for user registration
 */

// API base URL
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001/api';

// Get form elements
const signupForm = document.getElementById('signupForm');
const fullNameInput = document.getElementById('full-name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');

// Toggle password visibility for password field
const togglePasswordButton = document.getElementById('togglePassword');
const eyeIcon = document.getElementById('eyeIcon');
const eyeSlashIcon = document.getElementById('eyeSlashIcon');

togglePasswordButton.addEventListener('click', () => {
  const type = passwordInput.type === 'password' ? 'text' : 'password';
  passwordInput.type = type;
  
  // Toggle icons
  eyeIcon.classList.toggle('d-none');
  eyeSlashIcon.classList.toggle('d-none');
});

// Toggle password visibility for confirm password field
const toggleConfirmPasswordButton = document.getElementById('toggleConfirmPassword');
const eyeIconConfirm = document.getElementById('eyeIconConfirm');
const eyeSlashIconConfirm = document.getElementById('eyeSlashIconConfirm');

toggleConfirmPasswordButton.addEventListener('click', () => {
  const type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
  confirmPasswordInput.type = type;
  
  // Toggle icons
  eyeIconConfirm.classList.toggle('d-none');
  eyeSlashIconConfirm.classList.toggle('d-none');
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
  [fullNameInput, emailInput, passwordInput, confirmPasswordInput].forEach(input => clearError(input));
}

// Validate email format
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate full name
function validateFullName(name) {
  return name.trim().length >= 2;
}

// Validate form
function validateForm() {
  let isValid = true;
  clearAllErrors();

  // Validate full name
  const fullName = fullNameInput.value.trim();
  if (!fullName) {
    showError(fullNameInput, 'Full name is required');
    isValid = false;
  } else if (!validateFullName(fullName)) {
    showError(fullNameInput, 'Full name must be at least 2 characters');
    isValid = false;
  }

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

  // Validate confirm password
  const confirmPassword = confirmPasswordInput.value;
  if (!confirmPassword) {
    showError(confirmPasswordInput, 'Please confirm your password');
    isValid = false;
  } else if (password !== confirmPassword) {
    showError(confirmPasswordInput, 'Passwords do not match');
    isValid = false;
  }

  return isValid;
}

// Show loading state
function setLoading(isLoading) {
  const submitButton = signupForm.querySelector('button[type="submit"]');
  
  if (isLoading) {
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating account...';
  } else {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Register';
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
  signupForm.insertBefore(alertDiv, signupForm.firstChild);

  // Auto dismiss after 5 seconds
  setTimeout(() => {
    if (alertDiv.parentElement) {
      alertDiv.remove();
    }
  }, 5000);
}

// Handle form submission
async function handleSignup(event) {
  event.preventDefault();

  // Validate form
  if (!validateForm()) {
    return;
  }

  // Get form data
  const formData = {
    name: fullNameInput.value.trim(),
    email: emailInput.value.trim(),
    password: passwordInput.value,
    role: 'staff', // Default role, can be changed by admin later
  };

  try {
    setLoading(true);

    // Send registration request
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    // Store token and user data
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));

    // Show success message
    showAlert('Account created successfully! Redirecting...', 'success');

    // Redirect to dashboard
    setTimeout(() => {
      const user = data.data.user;
      if (user.role === 'admin' || user.role === 'manager') {
        window.location.href = '/pages/admin.html';
      } else {
        window.location.href = '/pages/dashboard.html';
      }
    }, 1500);

  } catch (error) {
    console.error('Signup error:', error);
    showAlert(error.message || 'An error occurred. Please try again.');
  } finally {
    setLoading(false);
  }
}

// Add real-time validation
fullNameInput.addEventListener('blur', () => {
  const fullName = fullNameInput.value.trim();
  if (fullName && !validateFullName(fullName)) {
    showError(fullNameInput, 'Full name must be at least 2 characters');
  } else {
    clearError(fullNameInput);
  }
});

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

confirmPasswordInput.addEventListener('blur', () => {
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  if (confirmPassword && password !== confirmPassword) {
    showError(confirmPasswordInput, 'Passwords do not match');
  } else {
    clearError(confirmPasswordInput);
  }
});

// Clear errors on input
fullNameInput.addEventListener('input', () => clearError(fullNameInput));
emailInput.addEventListener('input', () => clearError(emailInput));
passwordInput.addEventListener('input', () => clearError(passwordInput));
confirmPasswordInput.addEventListener('input', () => clearError(confirmPasswordInput));

// Attach event listener to form
signupForm.addEventListener('submit', handleSignup);

// Check if already logged in
window.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('token');
  const user = sessionStorage.getItem('user');
  
  if (token && user) {
    const userData = JSON.parse(user);
    // Redirect to appropriate page
    if (userData.role === 'admin' || userData.role === 'manager') {
      window.location.href = '/pages/admin.html';
    } else {
      window.location.href = '/pages/dashboard.html';
    }
  }
});
