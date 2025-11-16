// =====================================
// TIER PROMOTION MANAGER
// Global script to handle tier promotion animations across all pages
// =====================================

// Monitor membership level changes and show Trophy animation
class TierPromotionManager {
    constructor() {
        this.lastKnownLevel = null;
        this.isAnimationPlaying = false;
        this.firestoreListener = null;
        console.log('🏆 Tier Promotion Manager initialized');
    }

    // Start monitoring user's membership level
    startMonitoring(userId) {
        if (!userId) {
            console.warn('⚠️ No userId provided for tier monitoring');
            return;
        }

        console.log('👀 Starting tier promotion monitoring for user:', userId);

        // Stop any existing listener
        this.stopMonitoring();

        // Check if Firebase is available
        if (!window.firebase || !window.firebase.firestore) {
            console.error('❌ Firebase Firestore not available');
            return;
        }

        try {
            const db = window.firebase.firestore();

            // Listen to user document changes
            this.firestoreListener = db.collection('users').doc(userId)
                .onSnapshot((doc) => {
                    if (!doc.exists) {
                        console.warn('⚠️ User document does not exist');
                        return;
                    }

                    const userData = doc.data();
                    const currentLevel = userData.membershipLevel || 'standard';
                    
                    console.log('📊 Membership data updated:', {
                        currentLevel,
                        lastKnownLevel: this.lastKnownLevel,
                        points: userData.membershipPoints
                    });

                    // Check for tier promotion
                    if (this.lastKnownLevel && this.lastKnownLevel !== currentLevel) {
                        console.log('🎉 TIER PROMOTION DETECTED!');
                        console.log(`   From: ${this.lastKnownLevel} → To: ${currentLevel}`);
                        
                        // Calculate points from completed bills
                        this.calculateMembershipPoints(userId).then(calculatedPoints => {
                            // Show animation with calculated points
                            const membership = {
                                level: currentLevel,
                                name: this.getTierName(currentLevel),
                                icon: this.getTierIcon(currentLevel),
                                points: calculatedPoints
                            };
                            
                            console.log('💰 Calculated membership points:', calculatedPoints);
                            this.showTierPromotionAnimation(membership);
                        }).catch(error => {
                            console.error('❌ Error calculating points:', error);
                            // Fallback to stored points
                            const membership = {
                                level: currentLevel,
                                name: this.getTierName(currentLevel),
                                icon: this.getTierIcon(currentLevel),
                                points: userData.membershipPoints || 0
                            };
                            this.showTierPromotionAnimation(membership);
                        });
                    }

                    // Update last known level
                    this.lastKnownLevel = currentLevel;
                }, (error) => {
                    console.error('❌ Error monitoring tier changes:', error);
                    // If connection error, try to reconnect after delay
                    if (error.code === 'unavailable' || error.code === 'permission-denied') {
                        console.log('🔄 Will retry tier monitoring in 5 seconds...');
                        setTimeout(() => this.startMonitoring(userId), 5000);
                    }
                });
        } catch (error) {
            console.error('❌ Failed to start tier monitoring:', error);
        }
    }

    // Stop monitoring
    stopMonitoring() {
        if (this.firestoreListener) {
            console.log('🛑 Stopping tier promotion monitoring');
            this.firestoreListener();
            this.firestoreListener = null;
        }
        this.lastKnownLevel = null;
    }

    // Calculate membership points from completed bills
    async calculateMembershipPoints(userId) {
        try {
            console.log('💰 Calculating membership points for user:', userId);
            
            if (!window.firebase || !window.firebase.firestore) {
                console.error('❌ Firebase Firestore not available');
                return 0;
            }

            const db = window.firebase.firestore();
            
            // Query all bills with status "completed" for this user
            const billsQuery = await db.collection('bills')
                .where('userId', '==', userId)
                .where('status', '==', 'completed')
                .get();
            
            console.log(`📦 Found ${billsQuery.size} completed bills`);
            
            if (billsQuery.empty) {
                console.log('ℹ️ No completed bills found');
                return 0;
            }

            // Calculate total spending from all completed orders
            let totalSpending = 0;
            billsQuery.forEach(doc => {
                const bill = doc.data();
                // Try both totalAmount and total fields
                const billTotal = bill.totalAmount || bill.total || 0;
                totalSpending += billTotal;
                console.log(`  📄 Bill ${doc.id}: ${billTotal.toLocaleString('vi-VN')}đ`);
            });

            // Membership points = 10% of total spending
            const membershipPoints = Math.floor(totalSpending * 0.1);
            
            console.log('💵 Total spending:', totalSpending.toLocaleString('vi-VN'), 'đ');
            console.log('⭐ Membership points (10%):', membershipPoints.toLocaleString('vi-VN'));
            
            return membershipPoints;
        } catch (error) {
            console.error('❌ Error calculating membership points:', error);
            return 0;
        }
    }

    // Get tier name in Vietnamese
    getTierName(level) {
        const tierNames = {
            'standard': 'Tiêu Chuẩn',
            'silver': 'Bạc',
            'gold': 'Vàng',
            'diamond': 'Kim Cương'
        };
        return tierNames[level] || 'Tiêu Chuẩn';
    }

    // Get tier icon
    getTierIcon(level) {
        const tierIcons = {
            'standard': '⭐',
            'silver': '🥈',
            'gold': '🥇',
            'diamond': '💎'
        };
        return tierIcons[level] || '⭐';
    }

    // Get tier color
    getTierColor(level) {
        const tierColors = {
            'standard': '#6c757d',
            'silver': '#c0c0c0',
            'gold': '#ffd700',
            'diamond': '#00d4ff'
        };
        return tierColors[level] || '#6c757d';
    }

    // Show tier promotion animation with Trophy Lottie
    showTierPromotionAnimation(membership) {
        if (this.isAnimationPlaying) {
            console.log('⏳ Animation already playing, skipping...');
            return;
        }

        this.isAnimationPlaying = true;
        console.log('🏆 Showing tier promotion animation for:', membership);
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'tier-promotion-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            animation: fadeIn 0.3s ease;
        `;
        
        // Create animation container
        const animationContainer = document.createElement('div');
        animationContainer.id = 'tierPromotionAnimation';
        animationContainer.style.cssText = `
            width: 400px;
            height: 400px;
            margin-bottom: 20px;
        `;
        
        // Create message container
        const messageContainer = document.createElement('div');
        messageContainer.style.cssText = `
            text-align: center;
            color: white;
            animation: slideInUp 0.5s ease 0.5s both;
        `;
        
        const tierColor = this.getTierColor(membership.level);
        
        messageContainer.innerHTML = `
            <h2 style="font-size: 2.5rem; margin-bottom: 15px; color: ${tierColor}; text-shadow: 0 0 20px ${tierColor};">
                CHÚC MỪNG! 🎉
            </h2>
            <p style="font-size: 1.8rem; margin-bottom: 10px; font-weight: bold;">
                ${membership.icon} ${membership.name}
            </p>
            <p style="font-size: 1.2rem; color: #ddd; margin-bottom: 20px;">
                Bạn đã thăng hạng thành viên!
            </p>
            <p style="font-size: 1rem; color: #aaa;">
                Điểm tích lũy: <span style="color: ${tierColor}; font-weight: bold;">${membership.points.toLocaleString('vi-VN')}</span>
            </p>
        `;
        
        // Create continue button
        const continueBtn = document.createElement('button');
        continueBtn.textContent = 'Tiếp Tục';
        continueBtn.style.cssText = `
            margin-top: 30px;
            padding: 12px 40px;
            font-size: 1.1rem;
            background: linear-gradient(135deg, ${tierColor}, ${this.adjustColor(tierColor, -20)});
            color: white;
            border: none;
            border-radius: 30px;
            cursor: pointer;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
            animation: bounce 1s ease infinite;
        `;
        
        continueBtn.onmouseover = () => {
            continueBtn.style.transform = 'scale(1.05)';
            continueBtn.style.boxShadow = `0 6px 20px ${tierColor}`;
        };
        
        continueBtn.onmouseout = () => {
            continueBtn.style.transform = 'scale(1)';
            continueBtn.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
        };
        
        continueBtn.onclick = () => {
            overlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                overlay.remove();
                this.isAnimationPlaying = false;
            }, 300);
        };
        
        messageContainer.appendChild(continueBtn);
        overlay.appendChild(animationContainer);
        overlay.appendChild(messageContainer);
        document.body.appendChild(overlay);
        
        // Load and play Lottie animation
        console.log('🎬 Checking Lottie availability:', typeof lottie);
        
        if (typeof lottie !== 'undefined') {
            console.log('🎬 Lottie is available, loading Trophy.json...');
            
            // Load Trophy.json
            fetch('/Trophy.json')
                .then(response => {
                    console.log('📥 Trophy.json response status:', response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(animationData => {
                    console.log('📦 Trophy animation data loaded:', animationData);
                    
                    const animation = lottie.loadAnimation({
                        container: animationContainer,
                        renderer: 'svg',
                        loop: true,
                        autoplay: true,
                        animationData: animationData
                    });
                    
                    console.log('🏆 Trophy animation loaded successfully!');
                    
                    // Play sound effect
                    this.playPromotionSound();
                })
                .catch(error => {
                    console.error('❌ Error loading Trophy animation:', error);
                    // Fallback to emoji if Lottie fails
                    animationContainer.innerHTML = `
                        <div style="font-size: 15rem; animation: bounce 1s ease infinite;">
                            🏆
                        </div>
                    `;
                });
        } else {
            console.warn('⚠️ Lottie library not available, using fallback emoji');
            animationContainer.innerHTML = `
                <div style="font-size: 15rem; animation: bounce 1s ease infinite;">
                    🏆
                </div>
            `;
        }
    }

    // Helper function to adjust color brightness
    adjustColor(color, amount) {
        const clamp = (num) => Math.min(255, Math.max(0, num));
        const num = parseInt(color.replace('#', ''), 16);
        const r = clamp((num >> 16) + amount);
        const g = clamp(((num >> 8) & 0x00FF) + amount);
        const b = clamp((num & 0x0000FF) + amount);
        return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // Play promotion sound effect
    playPromotionSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.warn('⚠️ Could not play promotion sound:', error);
        }
    }

    // Test function for manual testing
    async testAnimation() {
        console.log('🧪 Testing tier promotion animation...');
        
        // Try to get real user points if authenticated
        let points = 1500000; // Default test value
        
        if (window.firebase && window.firebase.auth) {
            const currentUser = window.firebase.auth().currentUser;
            if (currentUser) {
                console.log('👤 User authenticated, calculating real points...');
                try {
                    points = await this.calculateMembershipPoints(currentUser.uid);
                    console.log('💰 Using real calculated points:', points);
                } catch (error) {
                    console.warn('⚠️ Could not calculate real points, using default:', error);
                }
            }
        }
        
        const testMembership = {
            level: 'gold',
            name: 'Vàng',
            icon: '🥇',
            points: points
        };
        this.showTierPromotionAnimation(testMembership);
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    @keyframes slideInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
    }
`;
document.head.appendChild(style);

// Create global instance
window.tierPromotionManager = new TierPromotionManager();

// Wait for Firebase to be ready before starting
function initializeTierMonitoring() {
    if (window.firebase && window.firebase.auth) {
        try {
            window.firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    console.log('✅ User authenticated, starting tier monitoring');
                    window.tierPromotionManager.startMonitoring(user.uid);
                } else {
                    console.log('❌ User not authenticated, stopping tier monitoring');
                    window.tierPromotionManager.stopMonitoring();
                }
            });
        } catch (error) {
            console.error('❌ Error setting up tier monitoring:', error);
        }
    } else {
        console.warn('⚠️ Firebase Auth not available yet, will retry...');
        // Retry after a short delay
        setTimeout(initializeTierMonitoring, 1000);
    }
}

// Initialize when DOM is ready or immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTierMonitoring);
} else {
    // DOM already loaded, wait a bit for Firebase to initialize
    setTimeout(initializeTierMonitoring, 500);
}

// Export test function globally
window.testTierPromotion = () => {
    if (window.tierPromotionManager) {
        window.tierPromotionManager.testAnimation();
    } else {
        console.error('❌ Tier Promotion Manager not initialized');
    }
};

console.log('🧪 To test trophy animation, run: testTierPromotion()');
