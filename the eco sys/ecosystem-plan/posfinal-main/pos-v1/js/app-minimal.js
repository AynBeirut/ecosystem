// ===================================
// AYN BEIRUT POS - ULTRA MINIMAL STARTUP
// Emergency mode to bypass infinite loading
// ===================================

console.log('🚀 Starting Emergency Mode...');

function updateLoadingStatus(message) {
    const statusEl = document.getElementById('loading-status');
    if (statusEl) {
        statusEl.textContent = message;
        console.log('📱', message);
    }
}

function hideLoadingScreen() {
    console.log('🎯 Attempting to hide loading screen...');
    
    const loadingScreen = document.getElementById('loading-screen');
    const posApp = document.getElementById('pos-app');
    
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
        console.log('✅ Loading screen hidden');
    }
    if (posApp) {
        posApp.style.display = 'flex';
        console.log('✅ POS app shown');
    } else {
        console.warn('⚠️ POS app element not found');
        // Create emergency message
        document.body.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: linear-gradient(135deg, #0A0F1C, #1a1a2e);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Poppins', sans-serif;
                z-index: 10000;
            ">
                <div style="text-align: center; max-width: 500px; padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <h2 style="margin-bottom: 15px; color: #FF9800;">Loading Issue Detected</h2>
                    <p style="margin-bottom: 30px; opacity: 0.8;">
                        The POS system is experiencing startup issues. 
                        Click below to access the emergency diagnostic mode.
                    </p>
                    <button onclick="window.location.href='emergency.html'" style="
                        background: linear-gradient(135deg, #4CAF50, #45a049);
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        border-radius: 8px;
                        font-family: inherit;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 16px;
                    ">
                        Open Emergency Mode
                    </button>
                </div>
            </div>
        `;
    }
}

// Ultra-minimal startup - no database, no modules
function startEmergencyMode() {
    console.log('🆘 Starting in emergency mode...');
    updateLoadingStatus('Emergency mode active...');
    
    // Just hide loading screen immediately
    setTimeout(() => {
        hideLoadingScreen();
        
        // Show emergency notification
        setTimeout(() => {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #f44336, #d32f2f);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                max-width: 320px;
                font-family: 'Poppins', sans-serif;
                font-size: 14px;
            `;
            notification.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 8px;">🆘 Emergency Mode</div>
                <div style="opacity: 0.9;">
                    Normal startup failed. Database and modules disabled to prevent infinite loading.
                    <br><br>
                    <button onclick="window.location.href='emergency.html'" style="
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.3);
                        color: white;
                        padding: 8px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        margin-top: 8px;
                    ">Open Diagnostics</button>
                </div>
            `;
            
            if (document.body) {
                document.body.appendChild(notification);
            }
        }, 500);
        
    }, 100);
}

// Start immediately without waiting for DOM
startEmergencyMode();