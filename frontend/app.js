// Configuration
const CONFIG = {
    BACKEND_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000' 
        : window.location.origin.replace(/:\d+$/, ':3000'),
    PAGE_SIZE: 20,
    WEBSOCKET_ENABLED: false,
    AUTO_REFRESH_INTERVAL: 30000, // 30 seconds
};

// State
let state = {
    alerts: [],
    symbols: [],
    currentPage: 1,
    totalPages: 1,
    totalAlerts: 0,
    activeSymbol: null,
    wsConnection: null,
    autoRefreshTimer: null,
    isConnected: false,
};

// DOM Elements
const elements = {
    totalAlerts: document.getElementById('totalAlerts'),
    activeSymbols: document.getElementById('activeSymbols'),
    lastUpdate: document.getElementById('lastUpdate'),
    apiStatus: document.getElementById('apiStatus'),
    wsStatus: document.getElementById('wsStatus'),
    lastAlertTime: document.getElementById('lastAlertTime'),
    backendUrl: document.getElementById('backendUrl'),
    connectionStatus: document.getElementById('connectionStatus'),
    
    refreshBtn: document.getElementById('refreshBtn'),
    clearBtn: document.getElementById('clearBtn'),
    toggleWsBtn: document.getElementById('toggleWsBtn'),
    
    symbolFilter: document.getElementById('symbolFilter'),
    applyFilterBtn: document.getElementById('applyFilterBtn'),
    clearFilterBtn: document.getElementById('clearFilterBtn'),
    symbolList: document.getElementById('symbolList'),
    
    currentPage: document.getElementById('currentPage'),
    totalPages: document.getElementById('totalPages'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    
    alertsTableBody: document.getElementById('alertsTableBody'),
    emptyState: document.getElementById('emptyState'),
    alertsTable: document.getElementById('alertsTable'),
    
    alertDetailModal: document.getElementById('alertDetailModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    modalBody: document.getElementById('modalBody'),
    
    newAlertNotification: document.getElementById('newAlertNotification'),
    notificationMessage: document.getElementById('notificationMessage'),
    closeNotificationBtn: document.getElementById('closeNotificationBtn'),
};

// Initialize the application
async function init() {
    console.log('Initializing Trading Alerts Dashboard...');
    console.log('Backend URL:', CONFIG.BACKEND_URL);
    
    // Update UI elements
    elements.backendUrl.textContent = CONFIG.BACKEND_URL;
    
    // Set up event listeners
    setupEventListeners();
    
    // Test backend connection
    await testBackendConnection();
    
    // Load initial data
    await loadAlerts();
    await loadSymbols();
    
    // Start auto-refresh
    startAutoRefresh();
    
    // Update status
    updateStatus();
}

// Test backend connection
async function testBackendConnection() {
    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}/health`);
        if (response.ok) {
            const data = await response.json();
            state.isConnected = true;
            elements.apiStatus.textContent = 'Healthy';
            elements.apiStatus.className = 'status-value status-healthy';
            elements.connectionStatus.textContent = 'Connected';
            elements.connectionStatus.style.color = '';
        } else {
            throw new Error('Health check failed');
        }
    } catch (error) {
        console.error('Backend connection failed:', error);
        state.isConnected = false;
        elements.apiStatus.textContent = 'Unreachable';
        elements.apiStatus.className = 'status-value status-error';
        elements.connectionStatus.textContent = 'Disconnected';
        elements.connectionStatus.style.color = 'var(--danger-color)';
    }
}

// Load alerts from backend
async function loadAlerts(page = 1) {
    if (!state.isConnected) {
        showError('Cannot connect to backend server');
        return;
    }
    
    // Show loading state
    elements.alertsTableBody.innerHTML = `
        <tr class="loading-row">
            <td colspan="6">
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i> Loading alerts...
                </div>
            </td>
        </tr>
    `;
    
    try {
        const offset = (page - 1) * CONFIG.PAGE_SIZE;
        let url = `${CONFIG.BACKEND_URL}/api/alerts?limit=${CONFIG.PAGE_SIZE}&offset=${offset}`;
        
        if (state.activeSymbol) {
            url = `${CONFIG.BACKEND_URL}/api/alerts/${state.activeSymbol}?limit=${CONFIG.PAGE_SIZE}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update state
        state.alerts = data.alerts || [];
        state.totalAlerts = data.total || state.alerts.length;
        state.currentPage = page;
        state.totalPages = Math.ceil(state.totalAlerts / CONFIG.PAGE_SIZE);
        
        // Update UI
        updateAlertsTable();
        updatePagination();
        updateStats();
        
        // Show/hide empty state
        if (state.alerts.length === 0) {
            elements.emptyState.style.display = 'flex';
            elements.alertsTable.style.display = 'none';
        } else {
            elements.emptyState.style.display = 'none';
            elements.alertsTable.style.display = 'table';
        }
        
        // Update last update time
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('Failed to load alerts:', error);
        showError('Failed to load alerts. Check backend connection.');
        
        elements.alertsTableBody.innerHTML = `
            <tr class="error-row">
                <td colspan="6" style="text-align: center; color: var(--danger-color); padding: 2rem;">
                    <i class="fas fa-exclamation-triangle"></i> Failed to load alerts
                </td>
            </tr>
        `;
    }
}

// Load symbols from backend
async function loadSymbols() {
    if (!state.isConnected) return;
    
    try {
        // In a real implementation, you'd have a dedicated symbols endpoint
        // For now, we'll extract symbols from the alerts
        const response = await fetch(`${CONFIG.BACKEND_URL}/api/alerts?limit=1000`);
        if (!response.ok) throw new Error('Failed to load symbols');
        
        const data = await response.json();
        const symbolsMap = {};
        
        data.alerts.forEach(alert => {
            const symbol = alert.symbol.toUpperCase();
            symbolsMap[symbol] = (symbolsMap[symbol] || 0) + 1;
        });
        
        state.symbols = Object.entries(symbolsMap).map(([symbol, count]) => ({
            symbol,
            count
        })).sort((a, b) => b.count - a.count);
        
        updateSymbolList();
        
    } catch (error) {
        console.error('Failed to load symbols:', error);
    }
}

// Update alerts table
function updateAlertsTable() {
    if (state.alerts.length === 0) {
        elements.alertsTableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: var(--secondary-color);">
                    No alerts found
                </td>
            </tr>
        `;
        return;
    }
    
    const rows = state.alerts.map(alert => createAlertRow(alert));
    elements.alertsTableBody.innerHTML = rows.join('');
}

// Create a table row for an alert
function createAlertRow(alert) {
    const time = new Date(alert.timestamp || alert.created_at);
    const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedDate = time.toLocaleDateString();
    
    // Determine condition badge class
    let badgeClass = 'condition-alert';
    const condition = alert.condition.toLowerCase();
    if (condition.includes('buy') || condition.includes('long')) {
        badgeClass = 'condition-buy';
    } else if (condition.includes('sell') || condition.includes('short')) {
        badgeClass = 'condition-sell';
    } else if (condition.includes('cross') || condition.includes('break')) {
        badgeClass = 'condition-cross';
    }
    
    return `
        <tr data-alert-id="${alert.id}">
            <td>
                <div class="time-cell">
                    <div class="time">${formattedTime}</div>
                    <div class="date">${formattedDate}</div>
                </div>
            </td>
            <td>
                <strong class="symbol">${alert.symbol}</strong>
            </td>
            <td>
                <span class="price">$${parseFloat(alert.price).toFixed(2)}</span>
            </td>
            <td>
                <span class="condition-badge ${badgeClass}">${alert.condition}</span>
            </td>
            <td>
                <span class="message">${alert.message || '—'}</span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="action-btn view-btn" title="View details" onclick="viewAlertDetails(${alert.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Update symbol list in sidebar
function updateSymbolList() {
    if (state.symbols.length === 0) {
        elements.symbolList.innerHTML = `
            <div class="loading">No symbols found</div>
        `;
        return;
    }
    
    const symbolItems = state.symbols.map(symbol => `
        <div class="symbol-item ${state.activeSymbol === symbol.symbol ? 'active' : ''}" 
             data-symbol="${symbol.symbol}" 
             onclick="filterBySymbol('${symbol.symbol}')">
            <span class="symbol-name">${symbol.symbol}</span>
            <span class="symbol-count">${symbol.count}</span>
        </div>
    `).join('');
    
    elements.symbolList.innerHTML = symbolItems;
    elements.activeSymbols.textContent = state.symbols.length;
}

// Update pagination controls
function updatePagination() {
    elements.currentPage.textContent = state.currentPage;
    elements.totalPages.textContent = state.totalPages;
    
    elements.prevPageBtn.disabled = state.currentPage === 1;
    elements.nextPageBtn.disabled = state.currentPage === state.totalPages;
}

// Update statistics
function updateStats() {
    elements.totalAlerts.textContent = state.totalAlerts.toLocaleString();
    
    // Update last alert time
    if (state.alerts.length > 0) {
        const latestAlert = state.alerts[0];
        const time = new Date(latestAlert.timestamp || latestAlert.created_at);
        const formattedTime = time.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        elements.lastAlertTime.textContent = formattedTime;
    }
}

// Update last update time
function updateLastUpdateTime() {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    elements.lastUpdate.textContent = formattedTime;
}

// Update overall status
function updateStatus() {
    // Update WebSocket status
    if (state.wsConnection && state.wsConnection.readyState === WebSocket.OPEN) {
        elements.wsStatus.textContent = 'Connected';
        elements.wsStatus.className = 'status-value status-healthy';
        elements.toggleWsBtn.innerHTML = '<i class="fas fa-wifi-slash"></i> Disable Real-time';
        elements.toggleWsBtn.classList.remove('btn-success');
        elements.toggleWsBtn.classList.add('btn-secondary');
    } else {
        elements.wsStatus.textContent = 'Disabled';
        elements.wsStatus.className = 'status-value status-disconnected';
        elements.toggleWsBtn.innerHTML = '<i class="fas fa-wifi"></i> Enable Real-time';
        elements.toggleWsBtn.classList.remove('btn-secondary');
        elements.toggleWsBtn.classList.add('btn-success');
    }
}

// Set up event listeners
function setupEventListeners() {
    // Refresh button
    elements.refreshBtn.addEventListener('click', () => {
        loadAlerts(state.currentPage);
        loadSymbols();
    });
    
    // Clear old alerts button (placeholder - would need backend implementation)
    elements.clearBtn.addEventListener('click', () => {
        if (confirm('This would delete old alerts in a real implementation. Continue?')) {
            showNotification('Clear functionality would be implemented with a backend endpoint');
        }
    });
    
    // WebSocket toggle button
    elements.toggleWsBtn.addEventListener('click', toggleWebSocket);
    
    // Symbol filter
    elements.applyFilterBtn.addEventListener('click', () => {
        const symbol = elements.symbolFilter.value.trim().toUpperCase();
        if (symbol) {
            filterBySymbol(symbol);
        }
    });
    
    elements.clearFilterBtn.addEventListener('click', clearSymbolFilter);
    
    // Enter key in filter input
    elements.symbolFilter.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const symbol = elements.symbolFilter.value.trim().toUpperCase();
            if (symbol) {
                filterBySymbol(symbol);
            }
        }
    });
    
    // Pagination
    elements.prevPageBtn.addEventListener('click', () => {
        if (state.currentPage > 1) {
            loadAlerts(state.currentPage - 1);
        }
    });
    
    elements.nextPageBtn.addEventListener('click', () => {
        if (state.currentPage < state.totalPages) {
            loadAlerts(state.currentPage + 1);
        }
    });
    
    // Modal close button
    elements.closeModalBtn.addEventListener('click', () => {
        elements.alertDetailModal.classList.remove('active');
    });
    
    // Close modal when clicking outside
    elements.alertDetailModal.addEventListener('click', (e) => {
        if (e.target === elements.alertDetailModal) {
            elements.alertDetailModal.classList.remove('active');
        }
    });
    
    // Notification close button
    elements.closeNotificationBtn.addEventListener('click', () => {
        elements.newAlertNotification.classList.remove('show');
    });
}

// Filter alerts by symbol
function filterBySymbol(symbol) {
    state.activeSymbol = symbol;
    elements.symbolFilter.value = symbol;
    loadAlerts(1);
    updateSymbolList();
}

// Clear symbol filter
function clearSymbolFilter() {
    state.activeSymbol = null;
    elements.symbolFilter.value = '';
    loadAlerts(1);
    updateSymbolList();
}

// View alert details
async function viewAlertDetails(alertId) {
    if (!state.isConnected) {
        showError('Cannot connect to backend server');
        return;
    }
    
    // Show loading state in modal
    elements.modalBody.innerHTML = `
        <div class="detail-loading">
            <i class="fas fa-spinner fa-spin"></i> Loading alert details...
        </div>
    `;
    
    // Show modal
    elements.alertDetailModal.classList.add('active');
    
    try {
        // In a real implementation, you'd have a dedicated endpoint for single alert
        // For now, find the alert in our current data
        const alert = state.alerts.find(a => a.id === alertId) || 
                     state.alerts.find(a => a.id === parseInt(alertId));
        
        if (alert) {
            showAlertDetails(alert);
        } else {
            // Fallback: try to fetch from API
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/alerts?limit=1000`);
            if (!response.ok) throw new Error('Failed to fetch alerts');
            
            const data = await response.json();
            const foundAlert = data.alerts.find(a => a.id === alertId);
            
            if (foundAlert) {
                showAlertDetails(foundAlert);
            } else {
                throw new Error('Alert not found');
            }
        }
    } catch (error) {
        console.error('Failed to load alert details:', error);
        elements.modalBody.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--danger-color);">
                <i class="fas fa-exclamation-triangle"></i><br>
                Failed to load alert details
            </div>
        `;
    }
}

// Show alert details in modal
function showAlertDetails(alert) {
    const time = new Date(alert.timestamp || alert.created_at);
    const formattedTime = time.toLocaleString();
    
    // Format price with proper currency
    const price = parseFloat(alert.price).toFixed(2);
    
    // Determine condition badge class
    let badgeClass = 'condition-alert';
    const condition = alert.condition.toLowerCase();
    if (condition.includes('buy') || condition.includes('long')) {
        badgeClass = 'condition-buy';
    } else if (condition.includes('sell') || condition.includes('short')) {
        badgeClass = 'condition-sell';
    } else if (condition.includes('cross') || condition.includes('break')) {
        badgeClass = 'condition-cross';
    }
    
    elements.modalBody.innerHTML = `
        <div class="alert-detail">
            <div class="detail-row">
                <div class="detail-label">Symbol</div>
                <div class="detail-value">
                    <strong style="font-size: 1.2rem;">${alert.symbol}</strong>
                </div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Price</div>
                <div class="detail-value">
                    <span style="font-size: 1.2rem; font-weight: 600; color: var(--primary-color);">
                        $${price}
                    </span>
                </div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Condition</div>
                <div class="detail-value">
                    <span class="condition-badge ${badgeClass}" style="font-size: 0.9rem;">
                        ${alert.condition}
                    </span>
                </div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Time</div>
                <div class="detail-value">${formattedTime}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Message</div>
                <div class="detail-value">${alert.message || '—'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Source</div>
                <div class="detail-value">${alert.source || 'TradingView'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Alert ID</div>
                <div class="detail-value"><code>${alert.id}</code></div>
            </div>
        </div>
    `;
}

// Toggle WebSocket connection
function toggleWebSocket() {
    if (state.wsConnection && state.wsConnection.readyState === WebSocket.OPEN) {
        // Disconnect
        state.wsConnection.close();
        state.wsConnection = null;
        showNotification('Real-time updates disabled');
    } else {
        // Connect
        connectWebSocket();
    }
    updateStatus();
}

// Connect to WebSocket
function connectWebSocket() {
    if (!state.isConnected) {
        showError('Cannot connect to WebSocket: Backend unavailable');
        return;
    }
    
    try {
        const wsUrl = CONFIG.BACKEND_URL.replace('http', 'ws') + '/';
        state.wsConnection = new WebSocket(wsUrl);
        
        state.wsConnection.onopen = () => {
            console.log('WebSocket connected');
            showNotification('Real-time updates enabled');
            updateStatus();
        };
        
        state.wsConnection.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'NEW_ALERT') {
                    handleNewAlert(data.data);
                }
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };
        
        state.wsConnection.onclose = () => {
            console.log('WebSocket disconnected');
            updateStatus();
        };
        
        state.wsConnection.onerror = (error) => {
            console.error('WebSocket error:', error);
            showError('WebSocket connection failed');
            updateStatus();
        };
        
    } catch (error) {
        console.error('Failed to create WebSocket:', error);
        showError('WebSocket not supported or backend unavailable');
    }
}

// Handle new alert from WebSocket
function handleNewAlert(alert) {
    console.log('New alert received:', alert);
    
    // Add to beginning of alerts array
    state.alerts.unshift(alert);
    
    // Keep array at reasonable size
    if (state.alerts.length > 100) {
        state.alerts = state.alerts.slice(0, 100);
    }
    
    // Update total count
    state.totalAlerts++;
    
    // Update UI
    updateAlertsTable();
    updateStats();
    updateLastUpdateTime();
    
    // Show notification
    showNewAlertNotification(alert);
    
    // Highlight the new row
    const newRow = document.querySelector(`tr[data-alert-id="${alert.id}"]`);
    if (newRow) {
        newRow.classList.add('new-alert');
        setTimeout(() => {
            newRow.classList.remove('new-alert');
        }, 2000);
    }
}

// Show new alert notification
function showNewAlertNotification(alert) {
    elements.notificationMessage.textContent = `${alert.symbol} ${alert.condition} at $${parseFloat(alert.price).toFixed(2)}`;
    elements.newAlertNotification.classList.add('show');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        elements.newAlertNotification.classList.remove('show');
    }, 5000);
}

// Start auto-refresh timer
function startAutoRefresh() {
    if (state.autoRefreshTimer) {
        clearInterval(state.autoRefreshTimer);
    }
    
    state.autoRefreshTimer = setInterval(() => {
        if (!state.wsConnection || state.wsConnection.readyState !== WebSocket.OPEN) {
            loadAlerts(state.currentPage);
            updateStatus();
        }
    }, CONFIG.AUTO_REFRESH_INTERVAL);
}

// Show error message
function showError(message) {
    console.error('Error:', message);
    // In a real implementation, you might show a toast or modal
    alert(`Error: ${message}`);
}

// Show notification
function showNotification(message) {
    console.log('Notification:', message);
    // In a real implementation, you might show a toast
    alert(`Info: ${message}`);
}

// Make functions available globally for inline event handlers
window.viewAlertDetails = viewAlertDetails;
window.filterBySymbol = filterBySymbol;
window.clearSymbolFilter = clearSymbolFilter;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);