/**
 * Settings Page Functionality
 * Handles profile updates and password changes
 */

// Ensure API_BASE_URL is available on window object (don't redeclare as const)
window.API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001/api';

// Use window.API_BASE_URL throughout this file to avoid conflicts
const UPLOAD_BASE_URL = window.API_BASE_URL ? window.API_BASE_URL.replace('/api', '') : 'http://localhost:3001';

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication - use sessionStorage (per-tab session)
    const token = sessionStorage.getItem('token');
    if (!token) {
      window.location.href = '../login.html';
      return;
    }

    // Load user data
    loadUserProfile();

    // Handle profile image preview
    const profileImageInput = document.getElementById('profileImage');
    const profilePreviewImg = document.getElementById('profile-preview-img');

    profileImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                profilePreviewImg.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Handle profile form submission
    const profileForm = document.getElementById('profile-form');
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const token = sessionStorage.getItem('token');
        const formData = new FormData();
        formData.append('name', document.getElementById('profile-name').value);
        
        const imageFile = profileImageInput.files[0];
        if (imageFile) {
            formData.append('profileImage', imageFile);
        }

        try {
            showToast('Saving changes...', 'info');
            
            const response = await fetch(`${window.API_BASE_URL}/users/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                showToast('Profile updated successfully!', 'success');
                // Update session storage
                const user = data.data?.user || data.user || data.data;
                sessionStorage.setItem('user', JSON.stringify(user));
                
                // Update UI elements immediately
                updateProfileDisplay(user);
            } else {
                showToast(data.message || 'Error updating profile', 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Network error while updating profile', 'danger');
        }
    });

    // Handle password form submission
    const passwordForm = document.getElementById('password-form');
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const token = sessionStorage.getItem('token');
        const currentPassword = passwordForm.querySelector('[name="currentPassword"]').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match!', 'warning');
            return;
        }

        if (newPassword.length < 6) {
            showToast('Password must be at least 6 characters!', 'warning');
            return;
        }

        try {
            showToast('Updating password...', 'info');
            
            const response = await fetch(`${window.API_BASE_URL}/users/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                showToast('Password updated successfully!', 'success');
                passwordForm.reset();
            } else {
                showToast(data.message || 'Error updating password', 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Network error while updating password', 'danger');
        }
    });
});

// Toast notification helper - updated to match usage pattern
function showToast(message, type = 'info') {
  const toastEl = document.getElementById('liveToast');
  
  // Check if toast element exists, if not, use alert as fallback
  if (!toastEl) {
    alert(message);
    return;
  }
  
  const toastIcon = document.getElementById('toast-icon');
  const toastTitle = document.getElementById('toast-title');
  const toastMessage = document.getElementById('toast-message');
  
  const icons = {
    success: 'bi-check-circle-fill text-success',
    danger: 'bi-x-circle-fill text-danger',
    warning: 'bi-exclamation-triangle-fill text-warning',
    info: 'bi-info-circle-fill text-primary'
  };
  
  const titles = {
    success: 'Success',
    danger: 'Error',
    warning: 'Warning',
    info: 'Info'
  };
  
  if (toastIcon) toastIcon.className = `bi me-2 ${icons[type] || icons.info}`;
  if (toastTitle) toastTitle.textContent = titles[type] || titles.info;
  if (toastMessage) toastMessage.textContent = message;
  
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
}

// Update all profile displays consistently
function updateProfileDisplay(user) {
  console.log('Updating profile display with:', user);
  
  const name = user.name || 'Admin User';
  const email = user.email || '';
  const role = user.role || 'Administrator';
  const profileImage = user.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

  // Update sessionStorage
  sessionStorage.setItem('user', JSON.stringify(user));

  // Update all name displays
  document.querySelectorAll('.user-display-name, .admin-name').forEach(el => {
    el.textContent = name;
  });

  // Update all email displays
  document.querySelectorAll('.user-display-email').forEach(el => {
    el.textContent = email;
  });

  // Update all role displays
  document.querySelectorAll('.user-display-role').forEach(el => {
    el.textContent = role;
  });

  // Update profile images
  const profileImg = document.getElementById('profile-preview-img');
  const navbarImg = document.getElementById('navbar-profile-img');
  
  if (profileImg) profileImg.src = profileImage;
  if (navbarImg) navbarImg.src = profileImage;
  
  // Also update any other profile images
  document.querySelectorAll('.navbar-profile-img').forEach(img => {
    img.src = profileImage;
  });
  
  // Trigger custom event for same-page updates
  window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: user }));
  
  // Call navbar update function if available
  if (typeof window.updateAdminName === 'function') {
    window.updateAdminName();
  }
}

// Load user profile data from backend
async function loadUserProfile() {
  console.log('Loading user profile...');
  console.log('API_BASE_URL:', window.API_BASE_URL);
  
  try {
    const token = sessionStorage.getItem('token');
    const userData = sessionStorage.getItem('user');
    
    if (!token) {
      console.error('No token found');
      window.location.href = '../login.html';
      return;
    }

    // Try to load from localStorage first as fallback
    if (userData) {
      try {
        const localUser = JSON.parse(userData);
        console.log('Using localStorage user data:', localUser);
        
        const nameInput = document.getElementById('profile-name');
        const emailInput = document.getElementById('profile-email');
        
        if (nameInput) nameInput.value = localUser.name || '';
        if (emailInput) emailInput.value = localUser.email || '';
        
        updateProfileDisplay(localUser);
      } catch (e) {
        console.error('Error parsing localStorage user:', e);
      }
    }

    // Now try to fetch from backend
    // Try multiple possible endpoints
    const possibleEndpoints = [
      '/api/users/profile',
      '/api/auth/profile', 
      '/api/auth/me',
      '/users/profile',
      '/auth/profile'
    ];

    let profileLoaded = false;

    for (const endpoint of possibleEndpoints) {
      try {
        const apiUrl = `${window.API_BASE_URL}${endpoint}`;
        console.log('Trying endpoint:', apiUrl);

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`Response from ${endpoint}:`, response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('Profile data received from API:', data);
          
          // Handle different response formats
          const user = data.user || data.data || data;

          // Save to sessionStorage for future use
          sessionStorage.setItem('user', JSON.stringify(user));

          const nameInput = document.getElementById('profile-name');
          const emailInput = document.getElementById('profile-email');
          
          if (nameInput) nameInput.value = user.name || '';
          if (emailInput) emailInput.value = user.email || '';

          updateProfileDisplay(user);
          profileLoaded = true;
          console.log('Successfully loaded profile from:', endpoint);
          break;
        }
      } catch (error) {
        console.log(`Error with ${endpoint}:`, error.message);
        continue;
      }
    }

    if (!profileLoaded && !userData) {
      console.warn('Could not load profile from any endpoint');
      showToast('Using cached profile data. Some features may be limited.', 'warning');
    }

  } catch (error) {
    console.error('Error loading profile:', error);
    showToast('Failed to load profile data: ' + error.message, 'danger');
  }
}

// Profile form submission
document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const submitBtn = document.getElementById('save-profile-btn');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Saving...';

  try {
    const token = sessionStorage.getItem('token');
    const name = document.getElementById('profile-name').value.trim();
    
    if (!name) {
      throw new Error('Name cannot be empty');
    }
    
    const userData = { name: name };
    console.log('Updating profile with:', userData);

    // Try multiple endpoints for update
    const updateEndpoints = [
      '/api/users/profile',
      '/api/auth/profile',
      '/users/profile'
    ];

    let updateSuccess = false;

    for (const endpoint of updateEndpoints) {
      try {
        const response = await fetch(`${window.API_BASE_URL}${endpoint}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(userData)
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Update response:', result);
          
          // Update localStorage
          const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
          storedUser.name = name;
          sessionStorage.setItem('user', JSON.stringify(storedUser));
          
          showToast('Your name has been updated successfully!', 'success');
          await loadUserProfile();
          updateSuccess = true;
          break;
        }
      } catch (error) {
        console.log(`Error updating via ${endpoint}:`, error.message);
        continue;
      }
    }

    if (!updateSuccess) {
      throw new Error('Could not update profile. Please check your connection.');
    }

  } catch (error) {
    console.error('Error updating profile:', error);
    showToast(error.message || 'Failed to update profile', 'danger');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
});

// Password form submission
document.getElementById('password-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match', 'warning');
    return;
  }

  if (newPassword.length < 6) {
    showToast('Password must be at least 6 characters', 'warning');
    return;
  }

  const submitBtn = document.getElementById('update-password-btn');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Updating...';

  try {
    const token = sessionStorage.getItem('token');

    const passwordData = {
      currentPassword: document.getElementById('currentPassword').value,
      newPassword: newPassword
    };

    // Try multiple endpoints
    const passwordEndpoints = [
      '/api/users/change-password',
      '/api/auth/change-password',
      '/auth/change-password'
    ];

    let passwordChanged = false;

    for (const endpoint of passwordEndpoints) {
      try {
        const response = await fetch(`${window.API_BASE_URL}${endpoint}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(passwordData)
        });

        if (response.ok) {
          showToast('Password updated successfully!', 'success');
          e.target.reset();
          passwordChanged = true;
          break;
        } else {
          const result = await response.json();
          if (response.status === 400 || response.status === 401) {
            throw new Error(result.message || 'Current password is incorrect');
          }
        }
      } catch (error) {
        if (error.message.includes('Current password')) {
          throw error;
        }
        console.log(`Error with ${endpoint}:`, error.message);
        continue;
      }
    }

    if (!passwordChanged) {
      throw new Error('Could not update password. Please try again.');
    }

  } catch (error) {
    console.error('Error updating password:', error);
    showToast(error.message || 'Failed to update password', 'danger');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
});

// Profile image preview and upload
document.getElementById('profileImage')?.addEventListener('change', async function(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'warning');
    e.target.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast('Image size should not exceed 5MB', 'warning');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    const imageSrc = event.target.result;
    const profileImg = document.getElementById('profile-preview-img');
    const navbarImg = document.getElementById('navbar-profile-img');
    
    if (profileImg) profileImg.src = imageSrc;
    if (navbarImg) navbarImg.src = imageSrc;
  };
  reader.readAsDataURL(file);

  try {
    const token = sessionStorage.getItem('token');
    const formData = new FormData();
    formData.append('profileImage', file);

    showToast('Info', 'Uploading profile picture...', 'info');

    const response = await fetch(`${window.API_BASE_URL}/api/users/upload-profile-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to upload image');
    }

    showToast('Success', 'Profile picture updated successfully!', 'success');
    await loadUserProfile();

  } catch (error) {
    console.error('Error uploading image:', error);
    showToast('Error', error.message || 'Failed to upload profile picture', 'error');
    await loadUserProfile();
  }
});

// Initialize on page load
console.log('Settings.js loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, loading profile...');
  loadUserProfile();
});

if (document.readyState !== 'loading') {
  console.log('Document already loaded, loading profile immediately...');
  loadUserProfile();
}
