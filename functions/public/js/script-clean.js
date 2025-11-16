// =====================================
// SHOPPING CART GLOBAL STATE - CLEAN
// =====================================
let cartItems = [];
let cartCount = 0;

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    // Mark that script.js has been loaded
    window.scriptJsLoaded = true;
    console.log('✅ Clean Script.js loaded successfully');

    // Initialize cart from localStorage if not logged in
    if (!window.currentUser) {
        loadCartFromStorage();
    }

    // =====================================
    // SHOPPING CART FUNCTIONALITY - CLEAN
    // =====================================

    // Simple, single-responsibility cart function
    async function addToCart(productName, productPrice, productId = null, productImage = null) {
        // Prevent duplicate calls using a simple flag
        if (window.cartProcessing) {
            console.log('⚠️ Cart operation in progress, ignoring duplicate call');
            return;
        }
        
        window.cartProcessing = true;
        console.log('🛒 Adding to cart:', productName, productPrice, productId);
        
        try {
            // Clean and validate inputs
            const cleanPrice = String(productPrice || '0').replace(/[^\d]/g, '');
            const numericPrice = parseInt(cleanPrice) || 0;
            const itemId = productId || productName;
            
            // Prepare cart item data
            const cartData = {
                productId: String(itemId),
                productName: productName,
                productPrice: productPrice,
                numericPrice: numericPrice,
                productImage: productImage,
                quantity: 1
            };
            
            // If user is logged in, save to database
            if (window.currentUser) {
                await addToCartDatabase(cartData);
            } else {
                addToCartLocal(cartData);
            }
            
            showCartNotification(productName);
            
        } catch (error) {
            console.error('❌ Cart error:', error);
            showNotification('Có lỗi xảy ra khi thêm vào giỏ hàng!', 'error');
        } finally {
            window.cartProcessing = false;
        }
    }
    
    // Add to database cart for logged users
    async function addToCartDatabase(cartData) {
        const body = { ...cartData };
        const headers = { 'Content-Type': 'application/json' };
        
        // Add user identification
        if (window.currentUser.provider === 'firebase') {
            const token = await getFirebaseToken();
            if (token) headers['Authorization'] = `Bearer ${token}`;
        } else {
            body.userId = window.currentUser.uid;
        }
        
        const response = await fetch('/api/cart', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error('Failed to add to database cart');
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Database cart error');
        }
        
        console.log('✅ Added to database cart');
        await loadCartFromDatabase();
    }
    
    // Add to local cart for non-logged users
    function addToCartLocal(cartData) {
        const existingItem = cartItems.find(item => String(item.id) === String(cartData.productId));
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cartItems.push({
                id: cartData.productId,
                name: cartData.productName,
                price: cartData.productPrice,
                numericPrice: cartData.numericPrice,
                quantity: 1,
                image: cartData.productImage
            });
        }
        
        cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
        saveCartToStorage();
        updateCartUI();
        console.log('✅ Added to local cart');
    }
    
    // Get Firebase token for authenticated requests
    async function getFirebaseToken() {
        try {
            if (window.firebase?.auth()?.currentUser) {
                return await window.firebase.auth().currentUser.getIdToken();
            }
        } catch (error) {
            console.warn('Could not get Firebase token:', error);
        }
        return null;
    }
    
    // Load cart from database
    async function loadCartFromDatabase() {
        if (!window.currentUser) return;
        
        try {
            const response = await fetch(`/api/cart?uid=${window.currentUser.uid}`);
            const data = await response.json();
            
            if (data.success && data.cartItems) {
                cartItems.length = 0;
                cartItems.push(...data.cartItems);
                cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
                updateCartUI();
                console.log('✅ Cart loaded from database');
            }
        } catch (error) {
            console.error('❌ Error loading cart:', error);
        }
    }
    
    // Save cart to localStorage
    function saveCartToStorage() {
        localStorage.setItem('techHavenCart', JSON.stringify(cartItems));
        localStorage.setItem('techHavenCartCount', cartCount.toString());
    }
    
    // Load cart from localStorage  
    function loadCartFromStorage() {
        try {
            const savedCart = localStorage.getItem('techHavenCart');
            const savedCount = localStorage.getItem('techHavenCartCount');
            
            if (savedCart) {
                cartItems = JSON.parse(savedCart);
                cartCount = parseInt(savedCount) || 0;
                console.log('✅ Cart loaded from localStorage:', cartItems.length, 'items');
            }
        } catch (error) {
            console.error('❌ Error loading cart from localStorage:', error);
            cartItems = [];
            cartCount = 0;
        }
        
        updateCartUI();
    }
    
    // Update cart UI elements
    function updateCartUI() {
        const cartBadge = document.getElementById('cartBadge');
        const cartCountSpan = document.getElementById('cartCount');
        
        if (cartBadge) {
            cartBadge.textContent = cartCount;
            cartBadge.style.display = cartCount > 0 ? 'flex' : 'none';
        }
        
        if (cartCountSpan) {
            cartCountSpan.textContent = cartCount;
        }
        
        // Update cart items display if cart sidebar exists
        updateCartItemsDisplay();
    }
    
    // Update cart items display
    function updateCartItemsDisplay() {
        const cartItemsContainer = document.getElementById('cartItems');
        if (!cartItemsContainer) return;
        
        if (cartItems.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                    <p>Giỏ hàng của bạn đang trống</p>
                </div>
            `;
        } else {
            cartItemsContainer.innerHTML = cartItems.map(item => `
                <div class="cart-item">
                    <div class="cart-item-image">
                        ${getCartItemImage(item)}
                    </div>
                    <div class="cart-item-details">
                        <div class="cart-item-name">${item.name || item.productName}</div>
                        <div class="cart-item-price">${formatCartPrice(item)}</div>
                        <div class="cart-item-controls">
                            <span class="cart-item-quantity">${item.quantity}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        // Update total
        const total = cartItems.reduce((sum, item) => {
            const price = item.numericPrice || parseInt(String(item.price || '0').replace(/[^\d]/g, '')) || 0;
            return sum + (price * item.quantity);
        }, 0);
        
        const cartTotalElement = document.getElementById('cartTotal');
        if (cartTotalElement) {
            cartTotalElement.textContent = new Intl.NumberFormat('vi-VN').format(total) + ' VNĐ';
        }
    }
    
    // Get cart item image
    function getCartItemImage(item) {
        const imageUrl = item.productImage || item.image;
        if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('/'))) {
            return `<img src="${imageUrl}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            return `<i class="fas fa-cube" style="color: #667eea; font-size: 24px;"></i>`;
        }
    }
    
    // Format cart price
    function formatCartPrice(item) {
        if (item.price && typeof item.price === 'string' && item.price.includes('VNĐ')) {
            return item.price;
        }
        const price = item.numericPrice || parseInt(String(item.price || '0').replace(/[^\d]/g, '')) || 0;
        return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
    }
    
    // Toggle cart sidebar
    function toggleCart() {
        const cartSidebar = document.getElementById('cartSidebar');
        const cartOverlay = document.getElementById('cartOverlay');
        
        if (cartSidebar && cartOverlay) {
            cartSidebar.classList.toggle('active');
            cartOverlay.classList.toggle('active');
        }
    }
    
    // Show cart notification
    function showCartNotification(productName) {
        const notification = document.createElement('div');
        notification.className = 'cart-notification';
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>Đã thêm "${productName}" vào giỏ hàng!</span>
        `;
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: #10b981; color: white; padding: 12px 20px;
            border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex; align-items: center; gap: 8px;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // Make functions globally available
    window.addToCart = addToCart;
    window.toggleCart = toggleCart;
    window.updateCartUI = updateCartUI;
    window.loadCartFromDatabase = loadCartFromDatabase;
});

// Navigation function
function goToProductDetail(productId) {
    window.location.href = `/product/${productId}`;
}

// Make navigation function globally available
window.goToProductDetail = goToProductDetail;