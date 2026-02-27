/**
 * Admin Panel Authentication Guard
 * Protects admin pages and verifies user permissions
 */

// Use API_BASE_URL from navbar.js or define it if not available
window.API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001/api';

// Check authentication and authorization
async function checkAdminAccess() {
  const token = localStorage.getItem('token');
  const sessionActive = sessionStorage.getItem('sessionActive');
  
  // Check for user data
  const userStr = localStorage.getItem('user');

  // Redirect to login if no token OR no active session.
  // sessionActive is stored in sessionStorage (cleared on browser close),
  // so a stale localStorage token from a previous session cannot auto-login.
  if (!token || !sessionActive) {
    localStorage.clear();
    window.location.href = '/pages/login.html';
    return;
  }

  // Get user data
  let user;
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      console.error('Error parsing user data:', e);
      localStorage.clear();
      window.location.href = '/pages/login.html';
      return;
    }
  } else {
    // No user data found
    window.location.href = '/pages/login.html';
    return;
  }

  // Check if user is admin (only admin can access admin panel)
  if (user.role !== 'admin') {
    alert('Access denied. Admin privileges required.');
    localStorage.clear();
    window.location.href = '/pages/login.html';
    return;
  }

  try {
    // Validate token with backend
    console.log('🔐 Validating admin token with backend...');
    console.log('Token:', token.substring(0, 20) + '...');
    console.log('API URL:', `${window.API_BASE_URL}/auth/validate`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${window.API_BASE_URL}/auth/validate`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      // Token invalid or expired (e.g., server restarted)
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Admin token validation failed:', errorData);
      console.warn('🚪 Logging out and redirecting to login...');
      localStorage.clear();
      window.location.href = '/pages/login.html';
      return;
    }

    console.log('✅ Admin token validated successfully');
    
    // Display admin info
    displayAdminInfo(user);

  } catch (error) {
    // Only ignore AbortError (from timeout during rapid refresh)
    // All other errors (network errors, server down, etc.) should log out
    if (error.name === 'AbortError') {
      console.warn('⚠️ Admin auth request timeout - backend unreachable, redirecting to login');
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/pages/login.html';
      return;
    }
    
    // For ALL other errors (including network errors), log out
    // This includes: server down, server restart, connection refused, etc.
    console.error('❌ Auth check failed:', error.message || error);
    console.log('🚪 Logging out and redirecting to login...');
    localStorage.clear();
    window.location.href = '/pages/login.html';
  }
}

// Display admin information
function displayAdminInfo(user) {
  // Update welcome message
  const welcomeElements = document.querySelectorAll('.admin-name, .user-name');
  welcomeElements.forEach(el => {
    if (el) {
      el.textContent = user.name || user.email;
    }
  });

  // Update role badge
  const roleElements = document.querySelectorAll('.user-role');
  roleElements.forEach(el => {
    if (el) {
      el.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    }
  });
}

// Logout function
function handleLogout() {
  const token = localStorage.getItem('token');

  if (token) {
    // Call backend logout endpoint
    fetch(`${window.API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }).catch(err => console.error('Logout error:', err));
  }

  // Clear local and session storage
  localStorage.clear();
  sessionStorage.clear();

  // Redirect to login
  window.location.href = '/pages/login.html';
}

// Setup logout buttons
function setupLogoutButtons() {
  const logoutButtons = document.querySelectorAll('.logout-btn, [href="#logout"]');
  console.log('Setting up logout for', logoutButtons.length, 'buttons'); // Debug log
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Logout button clicked'); // Debug log
      handleLogout();
    });
  });
}

// Heartbeat mechanism for admin pages
let adminHeartbeatInterval = null;

function startAdminAuthHeartbeat() {
  // Clear any existing interval
  if (adminHeartbeatInterval) {
    clearInterval(adminHeartbeatInterval);
  }
  
  // Check immediately
  silentAdminTokenCheck();
  
  // Then check every 30 seconds
  adminHeartbeatInterval = setInterval(() => {
    silentAdminTokenCheck();
  }, 30000); // 30 seconds
  
  console.log('🔄 Admin auth heartbeat started - checking token every 30 seconds');
}

// Silent token validation for admin
async function silentAdminTokenCheck() {
  const token = localStorage.getItem('token');
  
  if (!token) {
    if (adminHeartbeatInterval) {
      clearInterval(adminHeartbeatInterval);
    }
    return;
  }
  
  try {
    const response = await fetch(`${window.API_BASE_URL}/auth/validate`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.warn('🚨 Admin token validation failed during heartbeat check');
      console.log('🔄 Server instance changed - logging out...');
      
      if (adminHeartbeatInterval) {
        clearInterval(adminHeartbeatInterval);
      }
      
      localStorage.clear();
      window.location.href = '/pages/login.html';
    } else {
      console.log('✅ Admin heartbeat: Token still valid');
    }
  } catch (error) {
    console.warn('⚠️ Admin heartbeat check failed:', error.message);
    
    // Retry once after 2 seconds
    setTimeout(async () => {
      try {
        const retryResponse = await fetch(`${window.API_BASE_URL}/auth/validate`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!retryResponse.ok) {
          console.error('🚨 Admin token invalid after server restart');
          if (adminHeartbeatInterval) clearInterval(adminHeartbeatInterval);
          localStorage.clear();
          window.location.href = '/pages/login.html';
        }
      } catch (retryError) {
        console.error('🚨 Server unreachable - logging out admin');
        if (adminHeartbeatInterval) clearInterval(adminHeartbeatInterval);
        localStorage.clear();
        window.location.href = '/pages/login.html';
      }
    }, 2000);
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  checkAdminAccess();
  setupLogoutButtons();
  
  // Start heartbeat to detect server restarts
  const token = localStorage.getItem('token');
  if (token) {
    startAdminAuthHeartbeat();
  }
});

// Export functions for use in other scripts
window.adminAuth = {
  checkAccess: checkAdminAccess,
  logout: handleLogout,
  getUser: () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        console.error('Error parsing user data:', e);
        return null;
      }
    }
    return null;
  },
  getToken: () => localStorage.getItem('token'),
};
