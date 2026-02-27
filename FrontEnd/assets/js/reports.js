// Reports JavaScript - Fully Functional with Backend Integration
// API_BASE_URL is provided by navbar.js or admin-auth.js

console.log('📊 [Reports] Script loaded');

// API Headers with token (using localStorage)
const getReportHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

// Format price with currency (uses global function from currency.js)
const formatPrice = (amount) => {
  if (typeof window.formatPrice === 'function') {
    return window.formatPrice(amount);
  }
  // Fallback to PKR
  return 'Rs ' + new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Current report configuration
let currentReport = 'inventory';
let currentFilters = {};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📊 [Reports] DOM loaded, initializing...');

  // Report type navigation
  const reportButtons = document.querySelectorAll('[data-report]');
  reportButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const reportType = e.currentTarget.getAttribute('data-report');
      switchReport(reportType);
    });
  });

  // Add change event listeners to filters for auto-apply
  const categoryFilter = document.getElementById('categoryFilter');
  const statusFilter = document.getElementById('statusFilter');
  const dateRangeFilter = document.getElementById('dateRangeFilter');

  if (categoryFilter) {
    categoryFilter.addEventListener('change', applyCurrentReport);
  }
  if (statusFilter) {
    statusFilter.addEventListener('change', applyCurrentReport);
  }
  if (dateRangeFilter) {
    dateRangeFilter.addEventListener('change', applyCurrentReport);
  }

  // Refresh button
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      applyCurrentReport();
    });
  }

  // Export button
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportReport);
  }

  // Load categories for filter
  await loadCategories();

  // Load default report
  try {
    await switchReport('inventory');
  } catch (err) {
    console.error('❌ [Reports] Failed to load initial report:', err);
    const reportContainer = document.getElementById('reportContent');
    if (reportContainer) {
      showError(reportContainer, `Failed to initialize reports: ${err.message}`);
    }
  }

  console.log('✅ [Reports] Initialization complete');
});

// Switch between different reports
async function switchReport(reportType) {
  console.log(`📊 [Reports] Switching to ${reportType} report`);
  currentReport = reportType;

  // Update active button
  document.querySelectorAll('[data-report]').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector(`[data-report="${reportType}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }

  // Update filters based on report type
  updateFiltersForReport(reportType);

  // Load the appropriate report
  await applyCurrentReport();
}

// Update filter visibility based on report type
function updateFiltersForReport(reportType) {
  const categoryFilter = document.getElementById('categoryFilter');
  const statusFilter = document.getElementById('statusFilter');
  const dateRangeFilter = document.getElementById('dateRangeFilter');

  const setVisible = (el, visible) => {
    if (!el) return;
    const wrapper = el.closest('.col-md-3');
    if (wrapper) wrapper.style.display = visible ? 'block' : 'none';
  };

  // Show/hide filters based on report type
  switch (reportType) {
    case 'inventory':
      setVisible(categoryFilter, true);
      setVisible(statusFilter, true);
      setVisible(dateRangeFilter, false);
      break;
    case 'transactions':
    case 'stock-movement':
      setVisible(categoryFilter, false);
      setVisible(statusFilter, false);
      setVisible(dateRangeFilter, true);
      break;
    case 'suppliers':
      setVisible(categoryFilter, false);
      setVisible(statusFilter, false);
      setVisible(dateRangeFilter, false);
      break;
  }
}

// Apply current report with filters
async function applyCurrentReport() {
  // Gather filters
  currentFilters = {
    category: document.getElementById('categoryFilter')?.value || '',
    status: document.getElementById('statusFilter')?.value || '',
    dateRange: document.getElementById('dateRangeFilter')?.value || '30'
  };

  console.log('📊 [Reports] Applying filters:', currentFilters);

  // Load the appropriate report
  switch (currentReport) {
    case 'inventory':
      await loadInventoryReport();
      break;
    case 'transactions':
      await loadTransactionsReport();
      break;
    case 'stock-movement':
      await loadStockMovementReport();
      break;
    case 'suppliers':
      await loadSuppliersReport();
      break;
  }
}

// Load categories for filter dropdown
async function loadCategories() {
  try {
    const response = await fetch(`${window.API_BASE_URL}/products`, {
      headers: getReportHeaders()
    });

    if (!response.ok) return;

    const data = await response.json();
    const products = data.data?.products || [];

    // Extract unique categories
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    
    const categorySelect = document.getElementById('categoryFilter');
    if (categorySelect && categories.length > 0) {
      categorySelect.innerHTML = '<option value="">All Categories</option>' +
        categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
  } catch (error) {
    console.error('❌ [Reports] Error loading categories:', error);
  }
}

// ============================================================================
// INVENTORY REPORT
// ============================================================================
async function loadInventoryReport() {
  const reportContainer = document.getElementById('reportContent');
  if (!reportContainer) return;

  showLoading(reportContainer);

  try {
    const queryParams = new URLSearchParams();
    if (currentFilters.category) queryParams.append('category', currentFilters.category);
    if (currentFilters.status) queryParams.append('status', currentFilters.status);

    console.log('📊 [Reports] Fetching inventory report...');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(`${window.API_BASE_URL}/dashboard/reports/inventory?${queryParams}`, {
        headers: getReportHeaders(),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Server error ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ [Reports] Inventory data received:', data);
    displayInventoryReport(data.data);
  } catch (error) {
    console.error('❌ [Reports] Error loading inventory report:', error);
    const msg = error.name === 'AbortError'
      ? 'Request timed out — the backend may be unreachable. Please check the server and try again.'
      : `Failed to load inventory report: ${error.message}`;
    showError(reportContainer, msg);
  }
}

function displayInventoryReport(reportData) {
  const reportContainer = document.getElementById('reportContent');
  const products = reportData.products || [];
  const summary = reportData.summary || {};

  const html = `
    <!-- Summary Cards -->
    <div class="row g-3 mb-4">
      <div class="col-md-3">
        <div class="card bg-primary" style="background-color: var(--primary-base) !important;">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <h6 class="card-subtitle mb-2" style="color: #ffffff !important; opacity: 0.85;">Total Products</h6>
                <h3 class="card-title mb-0" style="color: #ffffff !important; font-weight: 700;">${summary.totalProducts || 0}</h3>
              </div>
              <i class="bi bi-box-seam fs-1" style="color: #ffffff !important; opacity: 0.5;"></i>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card bg-success" style="background-color: var(--success-base) !important;">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <h6 class="card-subtitle mb-2" style="color: #ffffff !important; opacity: 0.85;">Total Quantity</h6>
                <h3 class="card-title mb-0" style="color: #ffffff !important; font-weight: 700;">${(summary.totalQuantity || 0).toLocaleString()}</h3>
              </div>
              <i class="bi bi-stack fs-1" style="color: #ffffff !important; opacity: 0.5;"></i>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card bg-info" style="background-color: var(--info-base) !important;">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <h6 class="card-subtitle mb-2" style="color: #ffffff !important; opacity: 0.85;">Total Value</h6>
                <h3 class="card-title mb-0" style="color: #ffffff !important; font-weight: 700;">${formatPrice(summary.totalValue || 0)}</h3>
              </div>
              <i class="bi bi-currency-exchange fs-1" style="color: #ffffff !important; opacity: 0.5;"></i>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card bg-warning" style="background-color: var(--warning-base) !important;">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <h6 class="card-subtitle mb-2" style="color: #ffffff !important; opacity: 0.85;">Avg Price</h6>
                <h3 class="card-title mb-0" style="color: #ffffff !important; font-weight: 700;">${formatPrice(summary.averagePrice || 0)}</h3>
              </div>
              <i class="bi bi-graph-up fs-1" style="color: #ffffff !important; opacity: 0.5;"></i>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Inventory Table -->
    <div class="card">
      <div class="card-header bg-white">
        <h5 class="mb-0"><i class="bi bi-table me-2"></i>Inventory Details</h5>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover table-striped mb-0">
            <thead class="table-light">
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                <th class="text-end">Quantity</th>
                <th class="text-end">Min Stock</th>
                <th class="text-end">Unit Price</th>
                <th class="text-end">Total Value</th>
                <th>Status</th>
                <th>Supplier</th>
              </tr>
            </thead>
            <tbody>
              ${products.length === 0 ? `
                <tr>
                  <td colspan="9" class="text-center text-muted py-4">
                    <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                    No products found matching your criteria
                  </td>
                </tr>
              ` : products.map(product => {
                const quantity = product.quantity || 0;
                const minStock = product.minStockLevel || 0;
                const unitPrice = product.unitPrice || 0;
                const totalValue = quantity * unitPrice;
                const isLowStock = quantity <= minStock;

                let statusBadge = '';
                if (product.status === 'available') {
                  statusBadge = '<span class="badge bg-success">Available</span>';
                } else if (product.status === 'low_stock') {
                  statusBadge = '<span class="badge bg-warning">Low Stock</span>';
                } else if (product.status === 'out_of_stock') {
                  statusBadge = '<span class="badge bg-danger">Out of Stock</span>';
                } else if (product.status === 'discontinued') {
                  statusBadge = '<span class="badge bg-secondary">Discontinued</span>';
                }

                return `
                  <tr class="${isLowStock ? 'table-warning' : ''}">
                    <td><code>${product.sku}</code></td>
                    <td>
                      <div class="fw-semibold">${product.name}</div>
                      ${product.description ? `<small class="text-muted">${product.description.substring(0, 50)}</small>` : ''}
                    </td>
                    <td>${product.category || '-'}</td>
                    <td class="text-end">
                      <span class="badge ${quantity > minStock ? 'bg-success' : quantity > 0 ? 'bg-warning' : 'bg-danger'} rounded-pill">
                        ${quantity.toLocaleString()}
                      </span>
                    </td>
                    <td class="text-end">${minStock}</td>
                    <td class="text-end">${formatPrice(unitPrice)}</td>
                    <td class="text-end fw-semibold">${formatPrice(totalValue)}</td>
                    <td>${statusBadge}</td>
                    <td>${product.supplier?.name || '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  reportContainer.innerHTML = html;
}

// ============================================================================
// EXPORT FUNCTIONALITY
// ============================================================================
function exportReport() {
  console.log('📊 [Reports] Exporting report to CSV...');

  const reportContainer = document.getElementById('reportContent');
  const table = reportContainer.querySelector('table');

  if (!table) {
    alert('No data available to export');
    return;
  }

  // Extract table data
  const rows = [];
  const headers = [];
  
  // Get headers
  table.querySelectorAll('thead th').forEach(th => {
    headers.push(th.textContent.trim());
  });
  rows.push(headers);

  // Get data rows
  table.querySelectorAll('tbody tr').forEach(tr => {
    const row = [];
    tr.querySelectorAll('td').forEach(td => {
      // Clean up the text content
      const text = td.textContent.trim().replace(/\s+/g, ' ');
      row.push(text);
    });
    if (row.length > 0 && !row[0].includes('No')) {
      rows.push(row);
    }
  });

  // Convert to CSV
  const csvContent = rows.map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${currentReport}_report_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log('✅ [Reports] Export complete');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function showLoading(container) {
  container.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="text-muted mt-3">Loading report data...</p>
    </div>
  `;
}

function showError(container, message) {
  container.innerHTML = `
    <div class="alert alert-danger" role="alert">
      <i class="bi bi-exclamation-triangle me-2"></i>
      <strong>Error:</strong> ${message}
    </div>
  `;
}

console.log('✅ [Reports] Script fully loaded and ready');

// ============================================================================
// TRANSACTIONS REPORT (Placeholder - will load from backend)
// ============================================================================
async function loadTransactionsReport() {
  const reportContainer = document.getElementById('reportContent');
  if (!reportContainer) return;

  showLoading(reportContainer);
  
  try {
    // Get date range filter
    const dateRange = document.getElementById('dateRangeFilter')?.value || '30';
    const daysAgo = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    
    console.log(`📅 [Transactions Report] Filtering for last ${daysAgo} days (from ${startDate.toLocaleDateString()})`);
    
    // Build query params with date filter
    const params = new URLSearchParams({
      sort: '-createdAt',
      limit: '1000', // Increased limit
      startDate: startDate.toISOString()
    });
    
    const response = await fetch(`${window.API_BASE_URL}/transactions?${params.toString()}`, {
      headers: getReportHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch transactions data');
    }

    const result = await response.json();
    const transactions = result.data.transactions || [];

    // Filter by date range (client-side as backup)
    const filteredTransactions = transactions.filter(t => {
      const txDate = new Date(t.createdAt);
      return txDate >= startDate;
    });

    // Generate report HTML
    reportContainer.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h5 class="mb-0">
            <i class="bi bi-receipt me-2"></i>
            Transactions Report (Last ${daysAgo} days)
          </h5>
        </div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-striped table-hover">
              <thead>
                <tr>
                  <th>Transaction #</th>
                  <th style="white-space: nowrap;">Date</th>
                  <th>Type</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Warehouse</th>
                  <th style="min-width: 120px;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredTransactions.length === 0 ? `
                  <tr>
                    <td colspan="8" class="text-center text-muted py-4">
                      <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                      No transactions found in the selected period
                    </td>
                  </tr>
                ` : filteredTransactions.map(t => `
                  <tr>
                    <td><span class="badge bg-secondary">${t.transactionNumber || 'N/A'}</span></td>
                    <td style="white-space: nowrap;">${new Date(t.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</td>
                    <td>
                      ${t.type === 'stock_in' 
                        ? '<span class="badge bg-success"><i class="bi bi-plus-circle me-1"></i>Stock In</span>'
                        : t.type === 'stock_out'
                        ? '<span class="badge bg-danger"><i class="bi bi-dash-circle me-1"></i>Stock Out</span>'
                        : '<span class="badge bg-info">' + t.type + '</span>'}
                    </td>
                    <td>
                      <strong>${t.product?.name || 'N/A'}</strong><br>
                      <small class="text-muted">SKU: ${t.product?.sku || 'N/A'}</small>
                    </td>
                    <td><strong>${t.quantity}</strong></td>
                    <td>${formatPrice(t.unitPrice || 0)}</td>
                    <td>${t.warehouse?.name || 'N/A'}</td>
                    <td>
                      <span class="badge bg-success">Completed</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          ${filteredTransactions.length > 0 ? `
            <div class="row mt-4">
              <div class="col-md-4">
                <div class="card bg-primary text-white">
                  <div class="card-body">
                    <h6 class="card-title"><i class="bi bi-receipt me-2"></i>Total Transactions</h6>
                    <h3 class="mb-0">${filteredTransactions.length}</h3>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card bg-success text-white">
                  <div class="card-body">
                    <h6 class="card-title"><i class="bi bi-plus-circle me-2"></i>Stock In</h6>
                    <h3 class="mb-0">${filteredTransactions.filter(t => t.type === 'stock_in').length}</h3>
                    <small>Total Qty: ${filteredTransactions.filter(t => t.type === 'stock_in').reduce((sum, t) => sum + t.quantity, 0)}</small>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card bg-danger text-white">
                  <div class="card-body">
                    <h6 class="card-title"><i class="bi bi-dash-circle me-2"></i>Stock Out</h6>
                    <h3 class="mb-0">${filteredTransactions.filter(t => t.type === 'stock_out').length}</h3>
                    <small>Total Qty: ${filteredTransactions.filter(t => t.type === 'stock_out').reduce((sum, t) => sum + t.quantity, 0)}</small>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading transactions report:', error);
    reportContainer.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <i class="bi bi-exclamation-triangle me-2"></i>
        <strong>Error:</strong> Failed to load transactions report. ${error.message}
      </div>
    `;
  }
}

// ============================================================================
// STOCK MOVEMENT REPORT (Placeholder - will load from backend)
// ============================================================================
async function loadStockMovementReport() {
  const reportContainer = document.getElementById('reportContent');
  if (!reportContainer) return;

  showLoading(reportContainer);
  
  try {
    // Get date range filter
    const dateRange = document.getElementById('dateRangeFilter')?.value || '30';
    const daysAgo = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    
    console.log(`📅 [Stock Movement Report] Filtering for last ${daysAgo} days (from ${startDate.toLocaleDateString()})`);
    
    // Build query params with date filter
    const params = new URLSearchParams({
      sort: '-createdAt',
      limit: '1000', // Increased limit
      startDate: startDate.toISOString()
    });
    
    const response = await fetch(`${window.API_BASE_URL}/transactions?${params.toString()}`, {
      headers: getReportHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch stock movement data');
    }

    const result = await response.json();
    const transactions = result.data.transactions || [];

    // Filter by date range (client-side as backup)
    const filteredTransactions = transactions.filter(t => {
      const txDate = new Date(t.createdAt);
      return txDate >= startDate;
    });

    // Generate report HTML
    reportContainer.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h5 class="mb-0">
            <i class="bi bi-arrow-left-right me-2"></i>
            Stock Movement Report (Last ${daysAgo} days)
          </h5>
        </div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-striped table-hover">
              <thead>
                <tr>
                  <th>Transaction #</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Warehouse</th>
                  <th>Performed By</th>
                </tr>
              </thead>
              <tbody>
                ${filteredTransactions.length === 0 ? `
                  <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                      <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                      No stock movements found in the selected period
                    </td>
                  </tr>
                ` : filteredTransactions.map(t => `
                  <tr>
                    <td><span class="badge bg-secondary">${t.transactionNumber || 'N/A'}</span></td>
                    <td>${new Date(t.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</td>
                    <td>
                      ${t.type === 'stock_in' 
                        ? '<span class="badge bg-success"><i class="bi bi-plus-circle me-1"></i>Stock In</span>'
                        : '<span class="badge bg-danger"><i class="bi bi-dash-circle me-1"></i>Stock Out</span>'}
                    </td>
                    <td>${t.product?.name || 'N/A'}</td>
                    <td><strong>${t.quantity}</strong></td>
                    <td>${t.warehouse?.name || 'N/A'}</td>
                    <td>${t.performedBy?.name || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          ${filteredTransactions.length > 0 ? `
            <div class="row mt-4">
              <div class="col-md-6">
                <div class="card bg-success text-white">
                  <div class="card-body">
                    <h6 class="card-title"><i class="bi bi-plus-circle me-2"></i>Total Stock In</h6>
                    <h3 class="mb-0">${filteredTransactions.filter(t => t.type === 'stock_in').reduce((sum, t) => sum + t.quantity, 0)}</h3>
                    <small>${filteredTransactions.filter(t => t.type === 'stock_in').length} transactions</small>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="card bg-danger text-white">
                  <div class="card-body">
                    <h6 class="card-title"><i class="bi bi-dash-circle me-2"></i>Total Stock Out</h6>
                    <h3 class="mb-0">${filteredTransactions.filter(t => t.type === 'stock_out').reduce((sum, t) => sum + t.quantity, 0)}</h3>
                    <small>${filteredTransactions.filter(t => t.type === 'stock_out').length} transactions</small>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading stock movement report:', error);
    reportContainer.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <i class="bi bi-exclamation-triangle me-2"></i>
        <strong>Error:</strong> Failed to load stock movement report. ${error.message}
      </div>
    `;
  }
}

// ============================================================================
// SUPPLIER REPORT
// ============================================================================
async function loadSuppliersReport() {
  const reportContainer = document.getElementById('reportContent');
  if (!reportContainer) return;

  showLoading(reportContainer);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(`${window.API_BASE_URL}/dashboard/reports/suppliers`, {
        headers: getReportHeaders(),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Server error ${response.status}`);
    }

    const data = await response.json();
    const suppliers = data.data || [];

    reportContainer.innerHTML = `
      <div class="card">
        <div class="card-header bg-white">
          <h5 class="mb-0"><i class="bi bi-truck me-2"></i>Supplier Performance</h5>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover table-striped mb-0">
              <thead class="table-light">
                <tr>
                  <th>Supplier</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th class="text-end">Products</th>
                  <th class="text-end">Total Stock</th>
                  <th class="text-end">Total Value</th>
                </tr>
              </thead>
              <tbody>
                ${suppliers.length === 0 ? `
                  <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                      <i class="bi bi-inbox fs-1 d-block mb-2"></i>No supplier data found
                    </td>
                  </tr>
                ` : suppliers.map(s => `
                  <tr>
                    <td class="fw-semibold">${s.supplier || '-'}</td>
                    <td>${s.company || '-'}</td>
                    <td>${s.email || '-'}</td>
                    <td class="text-end">${s.totalProducts || 0}</td>
                    <td class="text-end">${(s.totalStock || 0).toLocaleString()}</td>
                    <td class="text-end fw-semibold">${formatPrice(s.totalValue || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('❌ [Reports] Error loading supplier report:', error);
    showError(reportContainer, `Failed to load supplier report: ${error.name === 'AbortError' ? 'Request timed out' : error.message}`);
  }
}
