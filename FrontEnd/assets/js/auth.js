/**
 * Authentication Utility
 * Helper functions for authentication across the application
 */

const API_BASE_URL =
  window.API_BASE_URL ||
  (window.resolveApiBaseUrl ? window.resolveApiBaseUrl() : `${window.location.origin}/api`);

// Get stored token
export function getToken() {
  return sessionStorage.getItem('token');
}

// Get stored user
export function getUser() {
  const userStr = sessionStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

// Check if user is authenticated
export function isAuthenticated() {
  return !!getToken();
}

// Check if user is admin
export function isAdmin() {
  const user = getUser();
  return user && (user.role === 'admin' || user.role === 'manager');
}

// Logout user
export function logout() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.location.href = '/pages/login.html';
}

// Verify token with backend
export async function verifyToken() {
  const token = getToken();
  
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      logout();
      return false;
    }

    return true;
  } catch (error) {
    console.error('Token verification error:', error);
    logout();
    return false;
  }
}

// Protect page (redirect to login if not authenticated)
export async function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/pages/login.html';
    return false;
  }

  // Verify token with backend
  const isValid = await verifyToken();
  if (!isValid) {
    window.location.href = '/pages/login.html';
    return false;
  }

  return true;
}

// Protect admin page (redirect if not admin)
export async function requireAdmin() {
  const isAuth = await requireAuth();
  
  if (!isAuth) {
    return false;
  }

  if (!isAdmin()) {
    window.location.href = '/pages/dashboard.html';
    return false;
  }

  return true;
}

// Make authenticated API request
export async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle unauthorized
  if (response.status === 401) {
    logout();
    throw new Error('Session expired. Please login again.');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

// Display user info in UI
export function displayUserInfo() {
  const user = getUser();
  
  if (!user) {
    return;
  }

  // Update user name if element exists
  const userNameElement = document.getElementById('user-name');
  if (userNameElement) {
    userNameElement.textContent = user.name;
  }

  // Update user email if element exists
  const userEmailElement = document.getElementById('user-email');
  if (userEmailElement) {
    userEmailElement.textContent = user.email;
  }

  // Update user role if element exists
  const userRoleElement = document.getElementById('user-role');
  if (userRoleElement) {
    userRoleElement.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  }
}
