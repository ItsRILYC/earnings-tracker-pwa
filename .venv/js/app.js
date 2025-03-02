/**
 * Real-Time Earnings Visualization PWA
 * Core application logic for earnings calculation and visualization
 */

// Application state
const appState = {
    authenticated: false,
    settings: {
        grossWage: 0,
        age: 30,
        netWage: 0,
        startDate: null
    },
    earnings: {
        current: 0,
        total: 0
    },
    history: [],
    animation: null
};

// DOM Elements
const elements = {
    screens: {
        auth: document.getElementById('auth-screen'),
        earnings: document.getElementById('earnings-screen'),
        settings: document.getElementById('settings-screen'),
        history: document.getElementById('history-screen'),
        pinChange: document.getElementById('pin-change-screen')
    },
    auth: {
        pinInput: document.getElementById('pin-input'),
        loginButton: document.getElementById('login-button'),
        createPinButton: document.getElementById('create-pin-button')
    },
    earnings: {
        counter: document.getElementById('earnings-counter'),
        hourlyRate: document.getElementById('hourly-rate'),
        startDate: document.getElementById('start-date'),
        currentRate: document.getElementById('current-rate'),
        settingsButton: document.getElementById('settings-button'),
        historyButton: document.getElementById('history-button')
    },
    settings: {
        grossWageInput: document.getElementById('gross-wage'),
        ageInput: document.getElementById('age'),
        netWageDisplay: document.getElementById('net-wage-display'),
        saveButton: document.getElementById('save-settings'),
        backButton: document.getElementById('back-from-settings')
    },
    history: {
        historyList: document.getElementById('history-list'),
        backButton: document.getElementById('back-from-history'),
        resetButton: document.getElementById('reset-history'),
        changePinButton: document.getElementById('change-pin')
    },
    pinChange: {
        currentPin: document.getElementById('current-pin'),
        newPin: document.getElementById('new-pin'),
        confirmPin: document.getElementById('confirm-pin'),
        saveButton: document.getElementById('save-pin'),
        backButton: document.getElementById('back-from-pin-change')
    },
    dialog: {
        container: document.getElementById('confirmation-dialog'),
        title: document.getElementById('dialog-title'),
        message: document.getElementById('dialog-message'),
        confirmButton: document.getElementById('dialog-confirm'),
        cancelButton: document.getElementById('dialog-cancel')
    }
};

/**
 * Dutch Tax Calculator Function
 * Calibrated to match exact examples with 5% adjustment at the end
 * 
 * @param {number} grossHourlyWage - The gross hourly wage in euros
 * @param {number} age - The age of the employee (not used in current implementation)
 * @return {number} The net hourly wage in euros with 5% adjustment
 */
function calculateNetWage(grossHourlyWage, age) {
    // Based on concrete examples:
    // €16.01 gross → €13.44 net (without 5% adjustment: €12.80)
    // €35.00 gross → €22.81 net (without 5% adjustment: €21.72)
    
    const sampleLow = {gross: 16.01, net: 13.44};
    const sampleHigh = {gross: 35.00, net: 22.81};
    
    let netHourlyWage;
    
    if (grossHourlyWage <= sampleLow.gross) {
        // For wages at or below the lower sample point
        const ratio = sampleLow.net / sampleLow.gross;
        netHourlyWage = grossHourlyWage * ratio;
    } else if (grossHourlyWage >= sampleHigh.gross) {
        // For wages at or above the higher sample point
        const ratio = sampleHigh.net / sampleHigh.gross;
        netHourlyWage = grossHourlyWage * ratio;
    } else {
        // For wages between the sample points, use linear interpolation
        const grossRange = sampleHigh.gross - sampleLow.gross;
        const netRange = sampleHigh.net - sampleLow.net;
        const position = (grossHourlyWage - sampleLow.gross) / grossRange;
        netHourlyWage = sampleLow.net + (position * netRange);
    }
    
    // Apply the 5% adjustment
    netHourlyWage = netHourlyWage * 1.05;
    
    return netHourlyWage;
}

// Navigation functions
function showScreen(screenId) {
    Object.values(elements.screens).forEach(screen => {
        screen.classList.add('hidden');
    });
    elements.screens[screenId].classList.remove('hidden');
    
    // Hide any open dialogs when changing screens
    hideConfirmationDialog();
}

// Initialize application
function initApp() {
    attachEventListeners();
    loadDataFromStorage();
    checkAuthentication();
    
    // Initialize dialog state
    window.dialogCallback = null;
}

// Event listeners
function attachEventListeners() {
    // Auth screen
    elements.auth.loginButton.addEventListener('click', handleLogin);
    elements.auth.createPinButton.addEventListener('click', handleCreatePin);
    
    // Earnings screen
    elements.earnings.settingsButton.addEventListener('click', () => showScreen('settings'));
    elements.earnings.historyButton.addEventListener('click', () => {
        populateHistoryList();
        showScreen('history');
    });
    
    // Settings screen
    elements.settings.grossWageInput.addEventListener('input', updateNetWageDisplay);
    elements.settings.ageInput.addEventListener('input', updateNetWageDisplay);
    elements.settings.saveButton.addEventListener('click', saveSettings);
    elements.settings.backButton.addEventListener('click', () => showScreen('earnings'));
    
    // History screen
    elements.history.backButton.addEventListener('click', () => showScreen('earnings'));
    elements.history.resetButton.addEventListener('click', confirmResetHistory);
    elements.history.changePinButton.addEventListener('click', () => showScreen('pinChange'));
    
    // PIN Change screen
    elements.pinChange.saveButton.addEventListener('click', changePin);
    elements.pinChange.backButton.addEventListener('click', () => showScreen('history'));
    
    // Confirmation dialog
    elements.dialog.confirmButton.addEventListener('click', handleDialogConfirm);
    elements.dialog.cancelButton.addEventListener('click', hideConfirmationDialog);
    
    // Input validation - numeric only for PIN inputs
    const numericInputs = [
        elements.auth.pinInput,
        elements.pinChange.currentPin,
        elements.pinChange.newPin,
        elements.pinChange.confirmPin
    ];
    
    numericInputs.forEach(input => {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    });
}

// Authentication functions
function checkAuthentication() {
    const pin = localStorage.getItem('userPin');
    
    if (!pin) {
        // First time user, show create PIN screen
        elements.auth.pinInput.placeholder = 'Create 4-digit PIN';
        elements.auth.loginButton.style.display = 'none';
        elements.auth.createPinButton.style.display = 'block';
    } else {
        // Returning user, show login screen
        elements.auth.pinInput.placeholder = 'Enter PIN';
        elements.auth.loginButton.style.display = 'block';
        elements.auth.createPinButton.style.display = 'none';
    }
    
    if (appState.authenticated) {
        showScreen('earnings');
        startEarningsCalculation();
    } else {
        showScreen('auth');
    }
}

function handleLogin() {
    const enteredPin = elements.auth.pinInput.value;
    const storedPin = localStorage.getItem('userPin');
    
    if (enteredPin === storedPin) {
        appState.authenticated = true;
        elements.auth.pinInput.value = '';
        showScreen('earnings');
        startEarningsCalculation();
    } else {
        showNotification('Incorrect PIN. Please try again.');
        elements.auth.pinInput.value = '';
        elements.auth.pinInput.focus();
    }
}

function handleCreatePin() {
    const newPin = elements.auth.pinInput.value;
    
    if (newPin.length !== 4 || isNaN(newPin)) {
        showNotification('Please enter a 4-digit PIN.');
        return;
    }
    
    localStorage.setItem('userPin', newPin);
    appState.authenticated = true;
    elements.auth.pinInput.value = '';
    
    // First-time user, show settings
    showScreen('settings');
}

// Settings functions
function updateNetWageDisplay() {
    const grossWage = parseFloat(elements.settings.grossWageInput.value) || 0;
    const age = parseInt(elements.settings.ageInput.value) || 30;
    
    if (grossWage > 0) {
        const netWage = calculateNetWage(grossWage, age);
        elements.settings.netWageDisplay.textContent = `€${netWage.toFixed(2)}`;
    } else {
        elements.settings.netWageDisplay.textContent = '€0.00';
    }
}

function saveSettings() {
    const grossWage = parseFloat(elements.settings.grossWageInput.value);
    const age = parseInt(elements.settings.ageInput.value);
    
    if (!grossWage || grossWage <= 0) {
        showNotification('Please enter a valid gross wage.');
        return;
    }
    
    if (!age || age < 15 || age > 100) {
        showNotification('Please enter a valid age between 15 and 100.');
        return;
    }
    
    // Calculate net wage using our tax calculator
    const netWage = calculateNetWage(grossWage, age);
    
    // If settings are changed, add previous settings to history
    if (appState.settings.grossWage > 0) {
        const historyEntry = {
            startDate: appState.settings.startDate,
            endDate: new Date(),
            grossWage: appState.settings.grossWage,
            netWage: appState.settings.netWage,
            age: appState.settings.age
        };
        
        appState.history.unshift(historyEntry);
    }
    
    // Update settings
    appState.settings.grossWage = grossWage;
    appState.settings.age = age;
    appState.settings.netWage = netWage;
    appState.settings.startDate = new Date();
    
    // Reset earnings counter
    appState.earnings.current = 0;
    
    // Update UI
    updateEarningsDisplay();
    
    // Save to storage
    saveDataToStorage();
    
    // Return to earnings screen
    showScreen('earnings');
    showNotification('Settings saved successfully!');
}

// Earnings calculation and display
function startEarningsCalculation() {
    if (appState.animation) {
        cancelAnimationFrame(appState.animation);
    }
    
    // Calculate accumulated earnings since start date
    if (appState.settings.startDate && appState.settings.netWage > 0) {
        const now = new Date();
        const startDate = new Date(appState.settings.startDate);
        
        // Calculate seconds elapsed since start date
        const secondsElapsed = (now - startDate) / 1000;
        
        // Calculate earnings based on elapsed time
        const earningsPerSecond = appState.settings.netWage / 3600;
        appState.earnings.current = earningsPerSecond * secondsElapsed;
    }
    
    // Update display immediately
    updateEarningsDisplay();
    
    // Set up continuous calculation
    let lastTimestamp = Date.now();
    
    function updateFrame() {
        const now = Date.now();
        const elapsed = (now - lastTimestamp) / 1000; // seconds since last frame
        lastTimestamp = now;
        
        if (appState.settings.netWage > 0) {
            // Calculate earnings per second (hourly wage to per-second)
            const earningsPerSecond = appState.settings.netWage / 3600;
            
            // Update current earnings amount
            appState.earnings.current += earningsPerSecond * elapsed;
            
            // Update earnings display
            elements.earnings.counter.textContent = `€${appState.earnings.current.toFixed(2)}`;
        }
        
        appState.animation = requestAnimationFrame(updateFrame);
    }
    
    // Start the animation loop
    appState.animation = requestAnimationFrame(updateFrame);
}

function updateEarningsDisplay() {
    // Update counter
    elements.earnings.counter.textContent = `€${appState.earnings.current.toFixed(2)}`;
    
    // Update hourly rate
    elements.earnings.hourlyRate.textContent = `€${appState.settings.netWage.toFixed(2)}/hour net`;
    
    // Update current rate
    elements.earnings.currentRate.textContent = `€${appState.settings.grossWage.toFixed(2)}/hour gross`;
    
    // Update start date with timestamp
    if (appState.settings.startDate) {
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        elements.earnings.startDate.textContent = new Date(appState.settings.startDate).toLocaleDateString('en-NL', options);
    } else {
        elements.earnings.startDate.textContent = 'N/A';
    }
    
    // Update form fields
    elements.settings.grossWageInput.value = appState.settings.grossWage || '';
    elements.settings.ageInput.value = appState.settings.age || '';
}

// History functions
function populateHistoryList() {
    elements.history.historyList.innerHTML = '';
    
    if (appState.history.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-state';
        emptyMessage.textContent = 'No history available yet.';
        elements.history.historyList.appendChild(emptyMessage);
        return;
    }
    
    appState.history.forEach((entry, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const dateOptions = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        const startDate = new Date(entry.startDate).toLocaleDateString('en-NL', dateOptions);
        const endDate = new Date(entry.endDate).toLocaleDateString('en-NL', dateOptions);
        
        historyItem.innerHTML = `
            <div class="history-item-header">
                <span class="history-item-date">${startDate}</span>
                <span class="history-item-wage">€${entry.grossWage.toFixed(2)}/h</span>
            </div>
            <div class="history-item-details">
                <div class="detail-item">
                    <span class="label">End:</span>
                    <span class="value">${endDate}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Net Rate:</span>
                    <span class="value">€${entry.netWage.toFixed(2)}/hour</span>
                </div>
                <div class="detail-item">
                    <span class="label">Age:</span>
                    <span class="value">${entry.age} years</span>
                </div>
            </div>
        `;
        
        elements.history.historyList.appendChild(historyItem);
    });
}

// Confirmation dialog functions
function showConfirmationDialog(title, message, callback) {
    elements.dialog.title.textContent = title;
    elements.dialog.message.textContent = message;
    window.dialogCallback = callback;
    elements.dialog.container.classList.remove('hidden');
}

function hideConfirmationDialog() {
    elements.dialog.container.classList.add('hidden');
    window.dialogCallback = null;
}

function handleDialogConfirm() {
    if (window.dialogCallback) {
        window.dialogCallback();
    }
    hideConfirmationDialog();
}

// Reset history functions
function confirmResetHistory() {
    showConfirmationDialog(
        'Reset History',
        'Are you sure you want to delete all earnings history? This action cannot be undone.',
        resetHistory
    );
}

function resetHistory() {
    appState.history = [];
    saveDataToStorage();
    populateHistoryList();
    showNotification('History has been reset.');
}

// PIN change functions
function changePin() {
    const currentPin = elements.pinChange.currentPin.value;
    const newPin = elements.pinChange.newPin.value;
    const confirmPin = elements.pinChange.confirmPin.value;
    const storedPin = localStorage.getItem('userPin');
    
    // Validate inputs
    if (currentPin !== storedPin) {
        showNotification('Current PIN is incorrect.');
        return;
    }
    
    if (newPin.length !== 4 || isNaN(newPin)) {
        showNotification('New PIN must be a 4-digit number.');
        return;
    }
    
    if (newPin !== confirmPin) {
        showNotification('New PIN and confirmation do not match.');
        return;
    }
    
    // Save new PIN
    localStorage.setItem('userPin', newPin);
    
    // Clear form
    elements.pinChange.currentPin.value = '';
    elements.pinChange.newPin.value = '';
    elements.pinChange.confirmPin.value = '';
    
    showNotification('PIN changed successfully.');
    showScreen('history');
}

// Notification function
function showNotification(message, duration = 3000) {
    // Check if a notification exists
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(255, 255, 255, 0.9);
            color: #0055ff;
            padding: 12px 20px;
            border-radius: 10px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            transition: all 0.3s ease;
            opacity: 0;
        `;
        document.body.appendChild(notification);
    }
    
    // Set the message and show the notification
    notification.textContent = message;
    notification.style.opacity = '1';
    
    // Hide after duration
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// Data persistence
function saveDataToStorage() {
    try {
        const dataToSave = {
            settings: appState.settings,
            history: appState.history
        };
        
        localStorage.setItem('earningsAppData', JSON.stringify(dataToSave));
    } catch (error) {
        console.error('Error saving data to storage:', error);
        showNotification('Error saving data. Please try again.');
    }
}

function loadDataFromStorage() {
    try {
        const savedData = localStorage.getItem('earningsAppData');
        
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            
            // Restore settings
            appState.settings = parsedData.settings || appState.settings;
            
            // Ensure date object is properly reconstituted
            if (appState.settings.startDate) {
                appState.settings.startDate = new Date(appState.settings.startDate);
            }
            
            // Restore history
            appState.history = parsedData.history || [];
            
            // Convert date strings to date objects in history
            appState.history.forEach(entry => {
                entry.startDate = new Date(entry.startDate);
                entry.endDate = new Date(entry.endDate);
            });
        }
    } catch (error) {
        console.error('Error loading data from storage:', error);
        showNotification('Error loading saved data.');
    }
}

// Handle application visibility changes
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        // Resume calculation when tab becomes visible again
        if (appState.authenticated) {
            startEarningsCalculation();
        }
    } else {
        // Pause calculation and save data when tab is hidden
        if (appState.animation) {
            cancelAnimationFrame(appState.animation);
        }
        saveDataToStorage();
    }
});

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Save data before unloading
window.addEventListener('beforeunload', saveDataToStorage);