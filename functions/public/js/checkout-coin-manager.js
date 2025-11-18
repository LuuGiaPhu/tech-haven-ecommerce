/**
 * ===================================== 
 * CHECKOUT COIN MANAGER
 * Manages coin usage in checkout modal
 * ===================================== 
 */

// Global variables for coin management
let currentCoinBalance = 0;
let coinUsed = 0;
let currentOrderTotal = 0;

/**
 * Update guest user's coin balance (called from script.js when email is entered)
 * @param {number} coinBalance - Coin balance from backend
 * @param {string} userId - Guest user's ID
 */
function updateGuestCoinBalance(coinBalance, userId) {
    currentCoinBalance = coinBalance;
    console.log('👤 Guest coin balance updated:', coinBalance.toLocaleString('vi-VN'), 'for userId:', userId);
    
    // Update currentOrderTotal from cart
    if (window.calculateCartTotal && typeof window.calculateCartTotal === 'function') {
        currentOrderTotal = window.calculateCartTotal() + 50000; // Add shipping
        console.log('💰 Current order total set to:', currentOrderTotal.toLocaleString('vi-VN'));
    }
    
    // Update all coin displays
    const checkoutCoinBalance = document.getElementById('checkoutCoinBalance');
    const checkoutCoinValue = document.getElementById('checkoutCoinValue');
    
    if (checkoutCoinBalance) {
        checkoutCoinBalance.textContent = coinBalance.toLocaleString('vi-VN');
    }
    if (checkoutCoinValue) {
        checkoutCoinValue.textContent = coinBalance.toLocaleString('vi-VN');
    }
    
    // Show/hide appropriate sections
    const noCoinMessage = document.getElementById('noCoinMessage');
    const coinInputGroup = document.getElementById('coinInputGroup');
    const useAllCoinBtn = document.getElementById('useAllCoinBtn');
    
    if (coinBalance > 0) {
        if (noCoinMessage) noCoinMessage.style.display = 'none';
        if (coinInputGroup) coinInputGroup.style.display = 'block';
        if (useAllCoinBtn) useAllCoinBtn.style.display = 'inline-flex';
        
        // Update max values based on order total
        const orderTotal = currentOrderTotal || (window.calculateCartTotal ? (window.calculateCartTotal() + 50000) : 0);
        const maxUsable = Math.min(coinBalance, orderTotal);
        
        console.log('📊 Coin calculation - Balance:', coinBalance, 'Order Total:', orderTotal, 'Max Usable:', maxUsable);
        
        const coinInput = document.getElementById('coinToUse');
        const coinSlider = document.getElementById('coinSlider');
        
        if (coinInput) {
            coinInput.max = maxUsable;
            coinInput.value = 0;
        }
        if (coinSlider) {
            coinSlider.max = maxUsable;
            coinSlider.value = 0;
            // Set step dynamically: 1 for small amounts, 1000 for large amounts
            coinSlider.step = maxUsable <= 1000 ? 1 : 1000;
            console.log('🎯 Slider configured - max:', maxUsable, 'step:', coinSlider.step);
        }
        
        console.log('✅ Guest coin UI updated - Balance:', coinBalance.toLocaleString('vi-VN'), 'Max usable:', maxUsable.toLocaleString('vi-VN'));
    } else {
        if (noCoinMessage) noCoinMessage.style.display = 'flex';
        if (coinInputGroup) coinInputGroup.style.display = 'none';
        if (useAllCoinBtn) useAllCoinBtn.style.display = 'none';
    }
}

// Export function globally
window.updateGuestCoinBalance = updateGuestCoinBalance;

/**
 * Initialize coin section when checkout modal opens
 * @param {string} userId - Current user's ID
 * @param {number} orderTotal - Current order total amount
 */
async function initializeCoinSection(userId, orderTotal) {
    currentOrderTotal = orderTotal;
    console.log('🛒 Initializing coin section with order total:', orderTotal.toLocaleString('vi-VN'), 'VNĐ');

    try {
        // Fetch user's current coin balance
        const response = await fetch(`/api/users/${userId}/coin`);
        const data = await response.json();

        if (data.success) {
            currentCoinBalance = data.coin || 0;
            console.log('💰 Current coin balance:', currentCoinBalance.toLocaleString('vi-VN'));

            // Show coin section
            const coinSection = document.getElementById('coinUsageSection');
            if (coinSection) {
                coinSection.style.display = 'block';
            }

            // Update displays
            const checkoutCoinBalance = document.getElementById('checkoutCoinBalance');
            const checkoutCoinValue = document.getElementById('checkoutCoinValue');
            
            if (checkoutCoinBalance) {
                checkoutCoinBalance.textContent = currentCoinBalance.toLocaleString('vi-VN');
            }
            if (checkoutCoinValue) {
                checkoutCoinValue.textContent = currentCoinBalance.toLocaleString('vi-VN');
            }

            // Show/hide appropriate sections
            const noCoinMessage = document.getElementById('noCoinMessage');
            const coinInputGroup = document.getElementById('coinInputGroup');
            const useAllCoinBtn = document.getElementById('useAllCoinBtn');

            if (currentCoinBalance > 0) {
                if (noCoinMessage) noCoinMessage.style.display = 'none';
                if (coinInputGroup) coinInputGroup.style.display = 'block';
                if (useAllCoinBtn) useAllCoinBtn.style.display = 'flex';

                // Set max values
                const maxUsable = Math.min(currentCoinBalance, orderTotal);
                const coinInput = document.getElementById('coinToUse');
                const coinSlider = document.getElementById('coinSlider');

                if (coinInput) {
                    coinInput.max = maxUsable;
                }
                if (coinSlider) {
                    coinSlider.max = maxUsable;
                    // Set step dynamically: 1 for amounts <= 1000, otherwise 1000
                    coinSlider.step = maxUsable <= 1000 ? 1 : 1000;
                    console.log('🎯 Logged-in user slider step set to:', coinSlider.step, 'for max:', maxUsable);
                }
            } else {
                if (noCoinMessage) noCoinMessage.style.display = 'flex';
                if (coinInputGroup) coinInputGroup.style.display = 'none';
                if (useAllCoinBtn) useAllCoinBtn.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('❌ Error fetching coin balance:', error);
    }
}

/**
 * Update coin usage when user changes input/slider
 * @param {string|number} value - Coin amount from input or slider
 */
function updateCoinUsage(value) {
    const coinAmount = parseInt(value) || 0;
    
    // Get current order total from any available source
    const orderTotal = getCurrentOrderTotal();
    
    // Validate amount
    const maxUsable = Math.min(currentCoinBalance, orderTotal);
    const validAmount = Math.max(0, Math.min(coinAmount, maxUsable));

    console.log('💳 Updating coin usage to:', validAmount, '(max:', maxUsable + ')');

    coinUsed = validAmount;

    // Sync input and slider
    const coinInput = document.getElementById('coinToUse');
    const coinSlider = document.getElementById('coinSlider');
    const discountDisplay = document.getElementById('coinDiscountDisplay');

    // Update max values to ensure slider works correctly
    if (coinInput) {
        coinInput.max = maxUsable;
        coinInput.value = validAmount;
    }
    if (coinSlider) {
        coinSlider.max = maxUsable;
        coinSlider.value = validAmount;
        // Set step dynamically: 1 for small amounts, 1000 for large amounts
        coinSlider.step = maxUsable <= 1000 ? 1 : 1000;
    }
    if (discountDisplay) {
        discountDisplay.textContent = validAmount.toLocaleString('vi-VN') + ' VNĐ';
    }

    // Update order total
    updateOrderTotalWithCoin();
}

/**
 * Get current order total from various sources
 * Priority: currentOrderTotal -> DOM subtotal -> calculateCartTotal -> 0
 */
function getCurrentOrderTotal() {
    // Try currentOrderTotal first
    if (currentOrderTotal > 0) {
        return currentOrderTotal;
    }
    
    // Try getting from DOM (subtotal in checkout modal)
    const subtotalAmount = document.getElementById('subtotalAmount');
    if (subtotalAmount) {
        const subtotalText = subtotalAmount.textContent.replace(/[^\d]/g, '');
        const subtotal = parseInt(subtotalText) || 0;
        if (subtotal > 0) {
            currentOrderTotal = subtotal + 50000; // Add shipping
            console.log('💰 Calculated order total from DOM:', currentOrderTotal.toLocaleString('vi-VN'));
            return currentOrderTotal;
        }
    }
    
    // Try window.calculateCartTotal as fallback
    if (window.calculateCartTotal && typeof window.calculateCartTotal === 'function') {
        try {
            const cartTotal = window.calculateCartTotal();
            if (cartTotal > 0) {
                currentOrderTotal = cartTotal + 50000;
                console.log('💰 Calculated order total from function:', currentOrderTotal.toLocaleString('vi-VN'));
                return currentOrderTotal;
            }
        } catch (e) {
            console.warn('⚠️ Error calling calculateCartTotal:', e);
        }
    }
    
    console.warn('⚠️ Could not determine order total, defaulting to 0');
    return 0;
}

/**
 * Use all available coin (up to order total)
 */
function useAllCoin() {
    // Get current order total from any available source
    const orderTotal = getCurrentOrderTotal();
    const maxUsable = Math.min(currentCoinBalance, orderTotal);
    
    console.log('💰 Using all available coin:', maxUsable, '(balance:', currentCoinBalance, ', order:', orderTotal + ')');
    updateCoinUsage(maxUsable);
}

/**
 * Update final order total with coin discount
 */
function updateOrderTotalWithCoin() {
    const subtotalAmount = document.getElementById('subtotalAmount');
    const finalTotal = document.getElementById('finalTotal');

    if (!subtotalAmount || !finalTotal) {
        console.warn('⚠️ Order total elements not found');
        return;
    }

    // Parse current subtotal
    const subtotalText = subtotalAmount.textContent.replace(/[^\d]/g, '');
    const subtotal = parseInt(subtotalText) || currentOrderTotal;

    // Calculate final total (subtotal - coupon discount - coin discount + shipping)
    const discountAmount = getDiscountAmount(); // From existing discount code
    const shippingFee = 50000; // Fixed shipping fee

    const finalAmount = subtotal - discountAmount - coinUsed + shippingFee;

    // Update final total display
    finalTotal.textContent = finalAmount.toLocaleString('vi-VN') + ' VNĐ';

    // Show/hide coin discount line
    let coinDiscountLine = document.getElementById('coinDiscountLine');
    
    if (!coinDiscountLine && coinUsed > 0) {
        // Create coin discount line
        const discountLineElement = document.querySelector('.discount-line');
        if (discountLineElement) {
            const coinDiscountHTML = `
                <div class="total-line coin-discount-line" id="coinDiscountLine">
                    <span>Giảm từ Coin:</span>
                    <span class="coin-discount-amount" id="coinDiscountAmountInTotal">-${coinUsed.toLocaleString('vi-VN')} VNĐ</span>
                </div>
            `;
            discountLineElement.insertAdjacentHTML('afterend', coinDiscountHTML);
        }
    } else if (coinDiscountLine) {
        // Update existing coin discount line
        coinDiscountLine.style.display = coinUsed > 0 ? 'flex' : 'none';
        const coinDiscountAmountInTotal = document.getElementById('coinDiscountAmountInTotal');
        if (coinDiscountAmountInTotal) {
            coinDiscountAmountInTotal.textContent = `-${coinUsed.toLocaleString('vi-VN')} VNĐ`;
        }
    }

    console.log('🧾 Updated order total:', {
        subtotal,
        discountAmount,
        coinUsed,
        shippingFee,
        finalAmount
    });
}

/**
 * Get current discount amount from discount code
 * @returns {number} Discount amount in VND
 */
function getDiscountAmount() {
    const discountLineElement = document.getElementById('discountLine');
    const discountAmountElement = document.getElementById('discountAmount');
    
    // If discount line is hidden, return 0
    if (discountLineElement && discountLineElement.style.display === 'none') {
        return 0;
    }
    
    if (discountAmountElement) {
        const discountText = discountAmountElement.textContent.replace(/[^\d]/g, '');
        return parseInt(discountText) || 0;
    }
    return 0;
}

/**
 * Get coin usage data for order completion
 * @returns {Object} Object containing coinUsed and discountAmount
 */
function getCoinUsageData() {
    return {
        coinUsed: coinUsed,
        discountAmount: coinUsed // 1 coin = 1 VND
    };
}

// Make getCoinUsageData available globally
window.getCoinUsageData = getCoinUsageData;
window.getCurrentOrderTotal = getCurrentOrderTotal; // Export for debugging

/**
 * Reset coin usage to zero
 */
function resetCoinUsage() {
    coinUsed = 0;
    currentOrderTotal = 0;
    const coinInput = document.getElementById('coinToUse');
    const coinSlider = document.getElementById('coinSlider');
    if (coinInput) coinInput.value = 0;
    if (coinSlider) coinSlider.value = 0;
    updateOrderTotalWithCoin();
    console.log('🔄 Coin usage reset');
}

console.log('💳 Checkout coin manager loaded successfully');
