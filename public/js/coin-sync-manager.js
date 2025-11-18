// =====================================
// COIN SYNC MANAGER
// Real-time coin balance synchronization across all tabs/windows
// Automatically updates when bills are completed
// =====================================

class CoinSyncManager {
    constructor() {
        this.currentCoinBalance = 0;
        this.firestoreListener = null;
        this.isInitialized = false;
        console.log('💰 Coin Sync Manager initialized');
    }

    // Start monitoring user's coin balance
    startMonitoring(userId) {
        if (!userId) {
            console.warn('⚠️ No userId provided for coin monitoring');
            return;
        }

        console.log('👀 Starting coin balance monitoring for user:', userId);

        // Stop any existing listener
        this.stopMonitoring();

        // Check if Firebase is available
        if (!window.firebase || !window.firebase.firestore) {
            console.error('❌ Firebase Firestore not available');
            return;
        }

        try {
            const db = window.firebase.firestore();

            // Listen to user document changes for coin updates
            this.firestoreListener = db.collection('users').doc(userId)
                .onSnapshot((doc) => {
                    if (!doc.exists) {
                        console.warn('⚠️ User document does not exist');
                        return;
                    }

                    const userData = doc.data();
                    const newCoinBalance = userData.coin || 0;
                    
                    // Check if coin balance changed
                    if (this.isInitialized && this.currentCoinBalance !== newCoinBalance) {
                        const difference = newCoinBalance - this.currentCoinBalance;
                        
                        console.log('💰 COIN BALANCE CHANGED!');
                        console.log(`   Old: ${this.currentCoinBalance.toLocaleString('vi-VN')} → New: ${newCoinBalance.toLocaleString('vi-VN')}`);
                        console.log(`   Difference: ${difference > 0 ? '+' : ''}${difference.toLocaleString('vi-VN')}`);
                        
                        // Show notification about coin change
                        if (difference > 0) {
                            this.showCoinEarnedNotification(difference, userData);
                        } else if (difference < 0) {
                            this.showCoinSpentNotification(Math.abs(difference));
                        }
                        
                        // Update all coin displays on the page
                        this.updateCoinDisplays(newCoinBalance);
                        
                        // Broadcast to other tabs via localStorage
                        this.broadcastCoinUpdate(newCoinBalance);
                    }

                    // Update current balance
                    this.currentCoinBalance = newCoinBalance;
                    this.isInitialized = true;
                    
                    // Initial update of all displays
                    this.updateCoinDisplays(newCoinBalance);
                }, (error) => {
                    console.error('❌ Error monitoring coin balance:', error);
                    // If connection error, try to reconnect after delay
                    if (error.code === 'unavailable' || error.code === 'permission-denied') {
                        console.log('🔄 Will retry coin monitoring in 5 seconds...');
                        setTimeout(() => this.startMonitoring(userId), 5000);
                    }
                });

            // Listen for updates from other tabs via localStorage
            window.addEventListener('storage', (e) => {
                if (e.key === 'coin_balance_update' && e.newValue) {
                    const newBalance = parseInt(e.newValue);
                    if (!isNaN(newBalance)) {
                        console.log('📡 Received coin update from another tab:', newBalance);
                        this.currentCoinBalance = newBalance;
                        this.updateCoinDisplays(newBalance);
                    }
                }
            });
        } catch (error) {
            console.error('❌ Failed to start coin monitoring:', error);
        }
    }

    // Stop monitoring
    stopMonitoring() {
        if (this.firestoreListener) {
            console.log('🛑 Stopping coin balance monitoring');
            this.firestoreListener();
            this.firestoreListener = null;
        }
        this.currentCoinBalance = 0;
        this.isInitialized = false;
    }

    // Update all coin displays on the page
    updateCoinDisplays(coinBalance) {
        console.log('🔄 Updating coin displays to:', coinBalance.toLocaleString('vi-VN'));
        
        // Update coin balance display in membership panel
        const coinBalanceElements = document.querySelectorAll('#coinBalance, .coin-balance, [data-coin-balance]');
        coinBalanceElements.forEach(element => {
            element.textContent = coinBalance.toLocaleString('vi-VN');
        });
        
        // Update coin value display (1 coin = 1 VND)
        const coinValueElements = document.querySelectorAll('#coinValue, .coin-value, [data-coin-value]');
        coinValueElements.forEach(element => {
            element.textContent = coinBalance.toLocaleString('vi-VN');
        });
        
        // Dispatch custom event for other components to listen
        window.dispatchEvent(new CustomEvent('coinBalanceUpdated', { 
            detail: { coinBalance } 
        }));
    }

    // Broadcast coin update to other tabs
    broadcastCoinUpdate(coinBalance) {
        try {
            localStorage.setItem('coin_balance_update', coinBalance.toString());
            // Clear after a moment to allow re-triggering
            setTimeout(() => {
                localStorage.removeItem('coin_balance_update');
            }, 100);
        } catch (error) {
            console.warn('⚠️ Could not broadcast to other tabs:', error);
        }
    }

    // Show notification when coin is earned
    showCoinEarnedNotification(amount, userData) {
        console.log('🎉 Showing coin earned notification:', amount);
        
        // Create notification overlay
        const notification = document.createElement('div');
        notification.className = 'coin-notification earned';
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 30px;
            background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
            color: #333;
            padding: 20px 25px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(255, 215, 0, 0.4);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 15px;
            animation: slideInRight 0.5s ease, pulse 2s ease infinite;
            max-width: 350px;
            font-family: 'Inter', sans-serif;
        `;
        
        notification.innerHTML = `
            <div style="font-size: 2.5rem;">🪙</div>
            <div>
                <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 5px;">
                    +${amount.toLocaleString('vi-VN')} Coin
                </div>
                <div style="font-size: 0.9rem; opacity: 0.8;">
                    Tích điểm từ đơn hàng hoàn thành
                </div>
                <div style="font-size: 0.85rem; margin-top: 5px; opacity: 0.7;">
                    Tổng: ${(userData.coin || 0).toLocaleString('vi-VN')} coin
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.5s ease';
            setTimeout(() => notification.remove(), 500);
        }, 5000);
    }

    // Show notification when coin is spent
    showCoinSpentNotification(amount) {
        console.log('💸 Showing coin spent notification:', amount);
        
        const notification = document.createElement('div');
        notification.className = 'coin-notification spent';
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 30px;
            background: linear-gradient(135deg, #6c757d 0%, #858e96 100%);
            color: white;
            padding: 20px 25px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(108, 117, 125, 0.4);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 15px;
            animation: slideInRight 0.5s ease;
            max-width: 350px;
            font-family: 'Inter', sans-serif;
        `;
        
        notification.innerHTML = `
            <div style="font-size: 2.5rem;">💸</div>
            <div>
                <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 5px;">
                    -${amount.toLocaleString('vi-VN')} Coin
                </div>
                <div style="font-size: 0.9rem; opacity: 0.8;">
                    Đã sử dụng để thanh toán
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.5s ease';
            setTimeout(() => notification.remove(), 500);
        }, 4000);
    }

    // Get current coin balance
    getCoinBalance() {
        return this.currentCoinBalance;
    }
}

// Add CSS animations
const coinSyncStyle = document.createElement('style');
coinSyncStyle.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
    }
    
    .coin-notification {
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .coin-notification:hover {
        transform: scale(1.05);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
    }
`;
document.head.appendChild(coinSyncStyle);

// Create global instance
window.coinSyncManager = new CoinSyncManager();

// Initialize coin monitoring when user is authenticated
function initializeCoinMonitoring() {
    if (window.firebase && window.firebase.auth) {
        try {
            window.firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    console.log('✅ User authenticated, starting coin monitoring');
                    window.coinSyncManager.startMonitoring(user.uid);
                } else {
                    console.log('❌ User not authenticated, stopping coin monitoring');
                    window.coinSyncManager.stopMonitoring();
                }
            });
        } catch (error) {
            console.error('❌ Error setting up coin monitoring:', error);
        }
    } else {
        console.warn('⚠️ Firebase Auth not available yet, will retry...');
        setTimeout(initializeCoinMonitoring, 1000);
    }
}

// Initialize when DOM is ready or immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCoinMonitoring);
} else {
    setTimeout(initializeCoinMonitoring, 500);
}

console.log('💰 Coin Sync Manager loaded successfully');
