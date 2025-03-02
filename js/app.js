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
        hoursPerWeek: 40,
        secondRate: 0,
        startDate: null,
        lastSavedEarnings: 0,
        lastSavedTimestamp: null
    },
    earnings: {
        current: 0,
        total: 0
    },
    history: [],
    updateTimer: null,
    updateInterval: 1000 // Update interval in milliseconds
};

// Check if running on iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

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
        secondRate: document.getElementById('second-rate'),
        startDate: document.getElementById('start-date'),
        netRate: document.getElementById('net-rate'),
        hoursPerWeek: document.getElementById('hours-per-week'),
        settingsButton: document.getElementById('settings-button'),
        historyButton: document.getElementById('history-button')
    },
    settings: {
        grossWageInput: document.getElementById('gross-wage'),
        hoursPerWeekInput: document.getElementById('hours-per-week-input'),
        ageInput: document.getElementById('age'),
        netWageDisplay: document.getElementById('net-wage-display'),
        secondWageDisplay: document.getElementById('second-wage-display'),
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
 * Parse a number with either period or comma as decimal separator
 */
function parseLocalizedNumber(stringNumber) {
    if (typeof stringNumber !== 'string') {
        return parseFloat(stringNumber) || 0;
    }
    
    // Replace any comma with period for standard parsing
    const standardized = stringNumber.replace(/,/g, '.');
    
    // Parse and return, default to 0 if NaN
    const parsed = parseFloat(standardized);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format a number to string with 2 decimal places
 */
function formatCurrency(value) {
    return `€${parseFloat(value).toFixed(2)}`;
}

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

/**
 * Calculate earnings per second based on hourly wage and hours per week
 * 
 * @param {number} netHourlyWage - The net hourly wage in euros
 * @param {number} hoursPerWeek - The number of hours worked per week
 * @return {number} The earnings per second in euros
 */
function calculateEarningsPerSecond(netHourlyWage, hoursPerWeek) {
    // Calculate weekly earnings
    const weeklyEarnings = netHourlyWage * hoursPerWeek;
    
    // Calculate seconds in a week
    const secondsInWeek = 7 * 24 * 60 * 60; // days * hours * minutes * seconds
    
    // Calculate earnings per second
    return weeklyEarnings / secondsInWeek;
}

/**
 * Calculate accumulated earnings since a specific date
 * 
 * @param {Date} startDate - The starting date for calculations
 * @param {number} secondRate - The earnings per second rate
 * @param {number} lastSavedEarnings - Previously accumulated earnings
 * @param {Date} lastSavedTimestamp - When the last earnings were saved
 * @return {number} The total accumulated earnings
 */
function calculateAccumulatedEarnings(startDate, secondRate, lastSavedEarnings = 0, lastSavedTimestamp = null) {
    const now = new Date();
    
    // If we have saved earnings, calculate from the last save point
    if (lastSavedEarnings > 0 && lastSavedTimestamp) {
        const secondsSinceLastSave = (now - new Date(lastSavedTimestamp)) / 1000;
        return lastSavedEarnings + (secondRate * secondsSinceLastSave);
    }
    
    // Otherwise calculate from the start date
    const secondsElapsed = (now - new Date(startDate)) / 1000;
    return secondRate * secondsElapsed;
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
    elements.settings.hoursPerWeekInput.addEventListener('input', updateNetWageDisplay);
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
    // Get the input values directly from the form
    const grossWageInput = elements.settings.grossWageInput.value;
    const hoursPerWeekInput = elements.settings.hoursPerWeekInput.value;
    const ageInput = elements.settings.ageInput.value;
    
    // Parse inputs with proper localization handling
    const grossWage = parseLocalizedNumber(grossWageInput);
    const hoursPerWeek = parseInt(hoursPerWeekInput) || 40;
    const age = parseInt(ageInput) || 30;
    
    if (grossWage > 0) {
        const netWage = calculateNetWage(grossWage, age);
        elements.settings.netWageDisplay.textContent = formatCurrency(netWage);
        
        // Calculate and display earnings per second
        const secondRate = calculateEarningsPerSecond(netWage, hoursPerWeek);
        elements.settings.secondWageDisplay.textContent = `€${secondRate.toFixed(5)}`;
    } else {
        elements.settings.netWageDisplay.textContent = '€0.00';
        elements.settings.secondWageDisplay.textContent = '€0.00000';
    }
}

function saveSettings() {
    // Get the input values directly from the form
    const grossWageInput = elements.settings.grossWageInput.value;
    const hoursPerWeekInput = elements.settings.hoursPerWeekInput.value;
    const ageInput = elements.settings.ageInput.value;
    
    // Parse inputs with proper localization handling
    const grossWage = parseLocalizedNumber(grossWageInput);
    const hoursPerWeek = parseInt(hoursPerWeekInput) || 40;
    const age = parseInt(ageInput) || 30;
    
    if (!grossWage || grossWage <= 0) {
        showNotification('Please enter a valid gross wage.');
        return;
    }
    
    if (!hoursPerWeek || hoursPerWeek <= 0 || hoursPerWeek > 168) {
        showNotification('Please enter valid hours per week (1-168).');
        return;
    }
    
    if (!age || age < 15 || age > 100) {
        showNotification('Please enter a valid age between 15 and 100.');
        return;
    }
    
    // Calculate net wage using our tax calculator
    const netWage = calculateNetWage(grossWage, age);
    
    // Calculate earnings per second
    const secondRate = calculateEarningsPerSecond(netWage, hoursPerWeek);
    
    // Capture exact current time for timestamps
    const currentTime = new Date();
    
    // If settings are changed, add previous settings to history
    if (appState.settings.grossWage > 0) {
        const historyEntry = {
            startDate: appState.settings.startDate,
            endDate: currentTime,
            grossWage: appState.settings.grossWage,
            netWage: appState.settings.netWage,
            hoursPerWeek: appState.settings.hoursPerWeek,
            age: appState.settings.age,
            lastSavedEarnings: appState.earnings.current,
            lastSavedTimestamp: currentTime
        };
        
        appState.history.unshift(historyEntry);
    }
    
    // Update settings with exact timestamp
    appState.settings.grossWage = grossWage;
    appState.settings.hoursPerWeek = hoursPerWeek;
    appState.settings.age = age;
    appState.settings.netWage = netWage;
    appState.settings.secondRate = secondRate;
    appState.settings.startDate = currentTime;
    appState.settings.lastSavedEarnings = 0;
    appState.settings.lastSavedTimestamp = currentTime;
    
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

// Earnings calculation and display using simple interval timer
function startEarningsCalculation() {
    // Stop any existing timer
    stopEarningsCalculation();
    
    // Calculate accumulated earnings since start date
    if (appState.settings.startDate && appState.settings.secondRate > 0) {
        appState.earnings.current = calculateAccumulatedEarnings(
            appState.settings.startDate,
            appState.settings.secondRate,
            appState.settings.lastSavedEarnings,
            appState.settings.lastSavedTimestamp
        );
    }
    
    // Update display immediately
    updateEarningsDisplay();
    
    // Create a simple update function
    function updateEarningsTick() {
        if (appState.settings.secondRate > 0) {
            // Update current earnings amount based on real-time calculation
            appState.earnings.current = calculateAccumulatedEarnings(
                appState.settings.startDate,
                appState.settings.secondRate,
                appState.settings.lastSavedEarnings,
                appState.settings.lastSavedTimestamp
            );
            
            // Update earnings display directly
            if (elements.earnings.counter) {
                elements.earnings.counter.textContent = formatCurrency(appState.earnings.current);
            }
        }
    }
    
    // Use simple setInterval for all platforms
    appState.updateTimer = setInterval(updateEarningsTick, appState.updateInterval);
    
    // Run once immediately to ensure display is updated
    updateEarningsTick();
}

// Stop the earnings calculation timer
function stopEarningsCalculation() {
    if (appState.updateTimer) {
        clearInterval(appState.updateTimer);
        appState.updateTimer = null;
    }
}

function updateEarningsDisplay() {
    // Update counter
    elements.earnings.counter.textContent = formatCurrency(appState.earnings.current);
    
    // Update second rate (5 decimal places)
    elements.earnings.secondRate.textContent = `€${appState.settings.secondRate.toFixed(5)}/second`;
    
    // Update net rate
    elements.earnings.netRate.textContent = `€${appState.settings.netWage.toFixed(2)}/hour net`;
    
    // Update hours per week
    elements.earnings.hoursPerWeek.textContent = `${appState.settings.hoursPerWeek}`;
    
    // Update start date with timestamp
    if (appState.settings.startDate) {
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };
        elements.earnings.startDate.textContent = new Date(appState.settings.startDate).toLocaleDateString('en-NL', options);
    } else {
        elements.earnings.startDate.textContent = 'N/A';
    }
    
    // Update form fields
    elements.settings.grossWageInput.value = appState.settings.grossWage || '';
    elements.settings.hoursPerWeekInput.value = appState.settings.hoursPerWeek || 40;
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
            minute: '2-digit',
            second: '2-digit'
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
                    <span class="label">Hours/Week:</span>
                    <span class="value">${entry.hoursPerWeek || 40}</span>
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
        // Save current earnings state for 24/7 tracking
        appState.settings.lastSavedEarnings = appState.earnings.current;
        appState.settings.lastSavedTimestamp = new Date();
        
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
            
            // Ensure date objects are properly reconstituted
            if (appState.settings.startDate) {
                appState.settings.startDate = new Date(appState.settings.startDate);
            }
            
            if (appState.settings.lastSavedTimestamp) {
                appState.settings.lastSavedTimestamp = new Date(appState.settings.lastSavedTimestamp);
            }
            
            // Restore history
            appState.history = parsedData.history || [];
            
            // Convert date strings to date objects in history
            appState.history.forEach(entry => {
                entry.startDate = new Date(entry.startDate);
                entry.endDate = new Date(entry.endDate);
                if (entry.lastSavedTimestamp) {
                    entry.lastSavedTimestamp = new Date(entry.lastSavedTimestamp);
                }
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
        stopEarningsCalculation();
        saveDataToStorage();
    }
});

// Save data periodically to ensure 24/7 tracking
setInterval(saveDataToStorage, 60000); // Save every minute

// Save data before unloading
window.addEventListener('beforeunload', function() {
    stopEarningsCalculation();
    saveDataToStorage();
});

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);