/**
 * API Configuration
 * Automatically detects environment and uses appropriate API URL
 */

// Detect environment and set API base URL
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '';

const API_BASE_URL = isLocalhost
  ? 'http://localhost:3001/api'
  : 'https://inventory-management-system-production-1c99.up.railway.app/api';

// Set globally for all scripts to use
window.API_BASE_URL = API_BASE_URL;

console.log('🌐 Environment:', isLocalhost ? 'Development' : 'Production');
console.log('🔗 API Base URL:', window.API_BASE_URL);
