/**
 * API Configuration
 * Single source of truth for environment URLs
 */

// Edit only these values when changing environments/domains.
window.APP_ENV = Object.freeze({
  LOCAL_API_BASE_URL: 'http://localhost:3001/api',
  PRODUCTION_API_BASE_URL: 'https://inventory-management-system-production-1c99.up.railway.app/api',
});

function resolveApiBaseUrl() {
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '';

  return isLocalhost
    ? window.APP_ENV.LOCAL_API_BASE_URL
    : window.APP_ENV.PRODUCTION_API_BASE_URL;
}

window.resolveApiBaseUrl = resolveApiBaseUrl;
window.API_BASE_URL = window.API_BASE_URL || resolveApiBaseUrl();
window.UPLOAD_BASE_URL = window.API_BASE_URL.replace('/api', '');

console.log('Environment:', window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '' ? 'Development' : 'Production');
console.log('API Base URL:', window.API_BASE_URL);
