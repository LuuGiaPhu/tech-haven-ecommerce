// =====================================
// SHOPPING CART GLOBAL STATE
// =====================================
let cartItems = JSON.parse(localStorage.getItem('techHavenCart')) || [];
let cartCount = parseInt(localStorage.getItem('techHavenCartCount')) || 0;

// Firebase Firestore listener variables
let cartListener = null;
let isUpdatingFromFirestore = false; // Flag to prevent infinite loops
let pendingQuantityUpdates = new Map(); // Track pending quantity updates per cart item
let quantityUpdateDebounce = new Map(); // Debounce timers for quantity updates

// =====================================
// WISHLIST GLOBAL STATE
// =====================================
let wishlistItems = [];
let wishlistListener = null;
let isUpdatingWishlistFromFirestore = false; // Flag to prevent infinite loops

// Initialize wishlist on page load
async function initializeWishlist() {
    if (window.currentUser) {
        console.log('🔄 Initializing wishlist for authenticated user');
        // Load wishlist data first, then start the listener
        await loadWishlistFromFirestore();
        startWishlistListener();
    } else {
        console.log('🔄 Initializing wishlist for guest user');
        // For non-logged in users, load from localStorage
        wishlistItems = JSON.parse(localStorage.getItem('techHavenWishlist')) || [];
        updateWishlistUI();
    }
}

// Helper function to sync cart data across all systems
function syncAllCartSystems() {
    try {
        // Update window.cartItems
        if (!window.cartItems) {
            window.cartItems = [];
        }
        window.cartItems.length = 0;
        window.cartItems.push(...cartItems);
        
        // Update window.cart for index.ejs compatibility
        if (!window.cart) {
            window.cart = [];
        }
        window.cart.length = 0;
        window.cart.push(...cartItems);
        
        // Update cartCount
        const totalCount = cartItems.reduce((total, item) => total + (item.quantity || 1), 0);
        cartCount = totalCount;
        window.cartCount = totalCount;
        
        console.log('🔄 Synced all cart systems:', {
            cartItems: cartItems.length,
            totalCount: totalCount,
            windowCartItems: window.cartItems.length,
            windowCart: window.cart.length,
            windowCartCount: window.cartCount
        });
    } catch (error) {
        console.error('❌ Error syncing cart systems:', error);
    }
}

// =====================================
// WISHLIST FUNCTIONS
// =====================================

// Load wishlist from Firestore for authenticated users
async function loadWishlistFromFirestore() {
    if (!window.currentUser || !window.firebase?.firestore) {
        console.warn('❌ Cannot load wishlist: User not authenticated or Firestore not available');
        return;
    }

    try {
        const db = window.firebase.firestore();
        const userId = window.currentUser.uid;
        
        console.log('📋 Loading wishlist from Firestore for user:', userId);
        
        const wishlistSnapshot = await db.collection('wishlists')
            .where('userId', '==', userId)
            .get();
        
        wishlistItems = [];
        wishlistSnapshot.forEach(doc => {
            const item = doc.data();
            wishlistItems.push({
                id: doc.id,
                firebaseDocId: doc.id,
                productId: item.productId,
                name: item.name || item.productName,
                price: item.price || item.productPrice,
                image: item.image || item.productImage,
                userId: item.userId,
                createdAt: item.createdAt
            });
        });
        
        console.log('✅ Loaded wishlist from Firestore:', wishlistItems.length, 'items');
        console.log('📋 Wishlist items:', wishlistItems.map(item => item.productId));
        
        // Update UI immediately after loading
        updateWishlistUI();
        
        // Broadcast to other tabs
        broadcastWishlistUpdate();
        
    } catch (error) {
        console.error('❌ Error loading wishlist from Firestore:', error);
    }
}

// Start real-time wishlist listener for cross-tab synchronization
function startWishlistListener() {
    if (!window.currentUser || !window.firebase?.firestore) {
        console.warn('❌ Cannot start wishlist listener: User not authenticated or Firestore not available');
        return;
    }

    // Stop existing listener if any
    if (wishlistListener) {
        console.log('🔄 Stopping existing wishlist listener');
        wishlistListener();
        wishlistListener = null;
    }

    const db = window.firebase.firestore();
    const userId = window.currentUser.uid;
    
    console.log('🎧 Starting real-time wishlist listener for user:', userId);
    
    // Listen to wishlist collection changes for this user
    wishlistListener = db.collection('wishlists')
        .where('userId', '==', userId)
        .onSnapshot((snapshot) => {
            if (isUpdatingWishlistFromFirestore) {
                console.log('🔄 Skipping wishlist update to prevent infinite loop');
                return;
            }

            console.log('🔔 Wishlist data changed in Firebase, syncing across tabs...');
            
            wishlistItems = [];
            snapshot.forEach(doc => {
                const item = doc.data();
                wishlistItems.push({
                    id: doc.id,
                    firebaseDocId: doc.id,
                    productId: item.productId,
                    name: item.name || item.productName,
                    price: item.price || item.productPrice,
                    image: item.image || item.productImage,
                    userId: item.userId,
                    createdAt: item.createdAt
                });
            });
            
            console.log('🔄 Wishlist synced from Firebase:', wishlistItems.length, 'items');
            updateWishlistUI();
            
            // Broadcast to other tabs
            broadcastWishlistUpdate();
        }, (error) => {
            console.error('❌ Wishlist listener error:', error);
        });
}

// Add product to wishlist
async function addToWishlist(productId, productName, productPrice, productImage) {
    console.log('💖 Adding to wishlist:', productId, productName);
    
    // Check if user is logged in
    if (!window.currentUser) {
        showLoginRequiredModal();
        return false;
    }

    try {
        // Check if product already in wishlist (both local and Firebase)
        const existingItem = wishlistItems.find(item => item.productId === productId);
        if (existingItem) {
            showNotification('Sản phẩm đã có trong danh sách yêu thích!', 'info');
            return false;
        }

        // Add to Firebase
        if (window.firebase?.firestore) {
            const db = window.firebase.firestore();
            const userId = window.currentUser.uid;
            
            // Double-check in Firebase to prevent duplicates
            console.log('🔍 Checking Firebase for existing wishlist item:', productId);
            const existingQuery = await db.collection('wishlists')
                .where('userId', '==', userId)
                .where('productId', '==', productId)
                .get();
            
            if (!existingQuery.empty) {
                console.log('⚠️ Product already exists in Firebase wishlist');
                showNotification('Sản phẩm đã có trong danh sách yêu thích!', 'info');
                // Update local array with existing data
                existingQuery.forEach(doc => {
                    const item = doc.data();
                    const localItem = wishlistItems.find(i => i.productId === productId);
                    if (!localItem) {
                        wishlistItems.push({
                            id: doc.id,
                            firebaseDocId: doc.id,
                            productId: item.productId,
                            name: item.name || item.productName,
                            price: item.price || item.productPrice,
                            image: item.image || item.productImage,
                            userId: item.userId,
                            createdAt: item.createdAt
                        });
                    }
                });
                updateWishlistUI();
                return false;
            }
            
            isUpdatingWishlistFromFirestore = true;
            
            const wishlistData = {
                userId: userId,
                productId: productId,
                name: productName,
                productName: productName,
                price: productPrice,
                productPrice: productPrice,
                image: productImage,
                productImage: productImage,
                createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await db.collection('wishlists').add(wishlistData);
            console.log('✅ Added to Firebase wishlist with ID:', docRef.id);
            
            // Add to local array immediately
            wishlistItems.push({
                id: docRef.id,
                firebaseDocId: docRef.id,
                ...wishlistData
            });
            
            isUpdatingWishlistFromFirestore = false;
        } else {
            // Fallback to localStorage for non-Firebase setup
            const wishlistData = {
                id: Date.now().toString(),
                productId: productId,
                name: productName,
                price: productPrice,
                image: productImage,
                createdAt: new Date().toISOString()
            };
            
            wishlistItems.push(wishlistData);
            localStorage.setItem('techHavenWishlist', JSON.stringify(wishlistItems));
        }
        
        updateWishlistUI();
        if (typeof showNotification === 'function') {
            showNotification(`Đã thêm "${productName}" vào danh sách yêu thích!`, 'success');
        } else {
            alert(`Đã thêm "${productName}" vào danh sách yêu thích!`);
        }
        
        // Create heart animation
        const heartBtn = document.querySelector('.wishlist-btn');
        if (heartBtn) {
            createHeartAnimation(heartBtn);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Error adding to wishlist:', error);
        if (typeof showNotification === 'function') {
            showNotification('Lỗi khi thêm vào danh sách yêu thích!', 'error');
        } else {
            alert('Lỗi khi thêm vào danh sách yêu thích!');
        }
        isUpdatingWishlistFromFirestore = false;
        return false;
    }
}

// Remove product from wishlist
async function removeFromWishlist(productId) {
    console.log('💔 Removing from wishlist:', productId);
    
    if (!window.currentUser) {
        showLoginRequiredModal();
        return false;
    }

    try {
        const existingItem = wishlistItems.find(item => item.productId === productId);
        if (!existingItem) {
            console.log('❌ Product not found in wishlist:', productId);
            return false;
        }

        // Remove from Firebase
        if (window.firebase?.firestore && existingItem.firebaseDocId) {
            const db = window.firebase.firestore();
            
            isUpdatingWishlistFromFirestore = true;
            
            await db.collection('wishlists').doc(existingItem.firebaseDocId).delete();
            console.log('✅ Removed from Firebase wishlist:', existingItem.firebaseDocId);
            
            isUpdatingWishlistFromFirestore = false;
        }
        
        // Remove from local array
        wishlistItems = wishlistItems.filter(item => item.productId !== productId);
        
        // Update localStorage if not using Firebase
        if (!window.firebase?.firestore) {
            localStorage.setItem('techHavenWishlist', JSON.stringify(wishlistItems));
        }
        
        updateWishlistUI();
        if (typeof showNotification === 'function') {
            showNotification(`Đã xóa "${existingItem.name}" khỏi danh sách yêu thích!`, 'info');
        } else {
            alert(`Đã xóa "${existingItem.name}" khỏi danh sách yêu thích!`);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Error removing from wishlist:', error);
        if (typeof showNotification === 'function') {
            showNotification('Lỗi khi xóa khỏi danh sách yêu thích!', 'error');
        } else {
            alert('Lỗi khi xóa khỏi danh sách yêu thích!');
        }
        isUpdatingWishlistFromFirestore = false;
        return false;
    }
}

// Check if product is in wishlist
function isInWishlist(productId) {
    return wishlistItems.some(item => item.productId === productId);
}

// Update wishlist UI across all pages
function updateWishlistUI() {
    // Update all wishlist buttons on current page
    const wishlistButtons = document.querySelectorAll('.wishlist-btn');
    wishlistButtons.forEach(btn => {
        const productId = btn.dataset.productId || 
                         btn.closest('[data-product-id]')?.dataset.productId;
        
        if (productId) {
            updateWishlistButton(btn, isInWishlist(productId));
        }
    });
    
    // Update wishlist count if there's a counter
    const wishlistCounter = document.querySelector('.wishlist-count');
    if (wishlistCounter) {
        wishlistCounter.textContent = wishlistItems.length;
        wishlistCounter.style.display = wishlistItems.length > 0 ? 'inline' : 'none';
    }
    
    // Update user profile wishlist section if on profile page
    updateUserProfileWishlist();
}

// Update individual wishlist button
function updateWishlistButton(button, isWishlisted) {
    if (isWishlisted) {
        button.innerHTML = '<i class="fas fa-heart"></i>';
        button.style.borderColor = '#ef4444';
        button.style.color = '#ef4444';
        button.style.background = 'rgba(239, 68, 68, 0.1)';
        button.title = 'Xóa khỏi danh sách yêu thích';
        button.classList.add('wishlisted');
    } else {
        button.innerHTML = '<i class="far fa-heart"></i>';
        button.style.borderColor = '#e5e7eb';
        button.style.color = '#666';
        button.style.background = 'rgba(255, 255, 255, 0.9)';
        button.title = 'Thêm vào danh sách yêu thích';
        button.classList.remove('wishlisted');
    }
}

// Handle wishlist button clicks (delegated event)
function handleWishlistClick(event) {
    console.log('💖 Wishlist button clicked!', event.target);
    
    const button = event.target.closest('.wishlist-btn');
    if (!button) {
        console.log('❌ No wishlist button found');
        return;
    }
    
    console.log('✅ Wishlist button found:', button);
    
    event.preventDefault();
    event.stopPropagation();
    
    // Check if user is logged in
    if (!window.currentUser) {
        showLoginRequiredModal();
        return;
    }
    
    // Get product data
    const productElement = button.closest('[data-product-id]') || document.querySelector('[data-product-id]');
    if (!productElement) {
        showNotification('Không tìm thấy thông tin sản phẩm!', 'error');
        return;
    }
    
    const productId = productElement.dataset.productId;
    const productName = button.dataset.productName || 
                       productElement.querySelector('.product-title')?.textContent ||
                       document.querySelector('.product-title')?.textContent || 'Product';
    const productPrice = button.dataset.productPrice || 
                        productElement.querySelector('.current-price')?.textContent ||
                        document.querySelector('.current-price')?.textContent || '0';
    const productImage = button.dataset.productImage || 
                        productElement.querySelector('img')?.src ||
                        document.querySelector('.main-image img')?.src || '';
    
    // Add button animation
    button.style.transform = 'scale(0.8)';
    setTimeout(() => {
        button.style.transform = 'scale(1)';
    }, 200);
    
    // Toggle wishlist
    if (isInWishlist(productId)) {
        removeFromWishlist(productId);
    } else {
        addToWishlist(productId, productName, productPrice, productImage);
    }
}

// Create heart animation effect
function createHeartAnimation(button) {
    const heart = document.createElement('i');
    heart.className = 'fas fa-heart';
    heart.style.cssText = `
        position: absolute;
        color: #ef4444;
        font-size: 1.2rem;
        pointer-events: none;
        z-index: 1000;
        animation: heartFloat 2s ease-out forwards;
    `;
    
    // Add heart float animation CSS if not exists
    if (!document.getElementById('heartAnimation')) {
        const style = document.createElement('style');
        style.id = 'heartAnimation';
        style.textContent = `
            @keyframes heartFloat {
                0% {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
                50% {
                    transform: translateY(-20px) scale(1.2);
                    opacity: 0.8;
                }
                100% {
                    transform: translateY(-40px) scale(0.8);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    const rect = button.getBoundingClientRect();
    heart.style.left = (rect.left + rect.width / 2) + 'px';
    heart.style.top = (rect.top + rect.height / 2) + 'px';
    
    document.body.appendChild(heart);
    
    setTimeout(() => {
        if (heart.parentNode) {
            document.body.removeChild(heart);
        }
    }, 2000);
}

// Show login required modal
function showLoginRequiredModal() {
    // Create modal if not exists
    let modal = document.getElementById('loginRequiredModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'loginRequiredModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeLoginRequiredModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3><i class="fas fa-heart text-red-500"></i> Yêu cầu đăng nhập</h3>
                        <button onclick="closeLoginRequiredModal()" class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>Bạn cần đăng nhập để sử dụng tính năng danh sách yêu thích.</p>
                        <p>Đăng nhập để lưu và đồng bộ danh sách yêu thích trên tất cả thiết bị!</p>
                    </div>
                    <div class="modal-footer">
                        <button onclick="closeLoginRequiredModal()" class="btn-secondary">Hủy</button>
                        <button onclick="redirectToLogin()" class="btn-primary">
                            <i class="fas fa-sign-in-alt"></i> Đăng nhập
                        </button>
                    </div>
                </div>
            </div>
        `;
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            display: none;
        `;
        document.body.appendChild(modal);
        
        // Add modal styles if not exists
        if (!document.getElementById('loginModalStyles')) {
            const style = document.createElement('style');
            style.id = 'loginModalStyles';
            style.textContent = `
                .modal-overlay {
                    background: rgba(0, 0, 0, 0.5);
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .modal-content {
                    background: white;
                    border-radius: 8px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .modal-header {
                    padding: 20px;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .modal-header h3 {
                    margin: 0;
                    color: #374151;
                }
                .close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #6b7280;
                }
                .modal-body {
                    padding: 20px;
                    color: #374151;
                }
                .modal-footer {
                    padding: 20px;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
                .btn-primary, .btn-secondary {
                    padding: 8px 16px;
                    border-radius: 4px;
                    border: 1px solid;
                    cursor: pointer;
                    font-weight: 500;
                }
                .btn-primary {
                    background: #3b82f6;
                    color: white;
                    border-color: #3b82f6;
                }
                .btn-secondary {
                    background: white;
                    color: #374151;
                    border-color: #d1d5db;
                }
                .text-red-500 {
                    color: #ef4444;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    modal.style.display = 'block';
    
    // Auto close after 5 seconds
    setTimeout(() => {
        closeLoginRequiredModal();
    }, 5000);
}

// Close login required modal
function closeLoginRequiredModal() {
    const modal = document.getElementById('loginRequiredModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Redirect to login
function redirectToLogin() {
    closeLoginRequiredModal();
    // Redirect to login or trigger login modal
    window.location.href = '/';
}

// Update user profile wishlist section
function updateUserProfileWishlist() {
    const wishlistSection = document.querySelector('#wishlist-section');
    if (!wishlistSection) {
        // If no wishlist section found, try to update favorites for product detail page
        if (typeof loadFavoriteProducts === 'function') {
            console.log('💖 Calling loadFavoriteProducts from updateUserProfileWishlist');
            loadFavoriteProducts();
        }
        // Also load recently viewed products
        if (typeof loadRecentProducts === 'function') {
            console.log('👁️ Calling loadRecentProducts from updateUserProfileWishlist');
            loadRecentProducts();
        }
        return;
    }
    
    const wishlistContainer = wishlistSection.querySelector('.wishlist-items');
    if (!wishlistContainer) return;
    
    if (wishlistItems.length === 0) {
        wishlistContainer.innerHTML = `
            <div class="empty-state">
                <i class="far fa-heart text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">Chưa có sản phẩm yêu thích nào</p>
            </div>
        `;
        return;
    }
    
    wishlistContainer.innerHTML = wishlistItems.map(item => `
        <div class="wishlist-item" data-product-id="${item.productId}">
            <div class="product-image">
                <img src="${item.image || '/images/default-product.png'}" alt="${item.name}" loading="lazy">
            </div>
            <div class="product-info">
                <h4 class="product-name">${item.name}</h4>
                <p class="product-price">${item.price}</p>
                <div class="product-actions">
                    <button class="btn-cart" onclick="moveToCart('${item.productId}')">
                        <i class="fas fa-shopping-cart"></i> Thêm vào giỏ
                    </button>
                    <button class="btn-remove" onclick="removeFromWishlist('${item.productId}')">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Move product from wishlist to cart
async function moveToCart(productId) {
    const wishlistItem = wishlistItems.find(item => item.productId === productId);
    if (!wishlistItem) return;
    
    // Add to cart
    if (typeof window.addToCart === 'function') {
        await window.addToCart(wishlistItem.name, wishlistItem.price, wishlistItem.productId, wishlistItem.image, 1);
    } else if (typeof window.addToCartDirectly === 'function') {
        await window.addToCartDirectly(wishlistItem.name, wishlistItem.price, wishlistItem.productId, wishlistItem.image, 1);
    }
    
    // Remove from wishlist
    await removeFromWishlist(productId);
    
    showNotification(`Đã chuyển "${wishlistItem.name}" vào giỏ hàng!`, 'success');
}

// Broadcast wishlist update to other tabs
function broadcastWishlistUpdate() {
    // Use localStorage event for cross-tab communication
    localStorage.setItem('wishlistUpdate', JSON.stringify({
        timestamp: Date.now(),
        items: wishlistItems
    }));
}

// Listen for wishlist updates from other tabs
window.addEventListener('storage', (event) => {
    if (event.key === 'wishlistUpdate' && event.newValue) {
        try {
            const updateData = JSON.parse(event.newValue);
            
            // Update local wishlist if data is newer
            if (updateData.items && Array.isArray(updateData.items)) {
                wishlistItems = updateData.items;
                updateWishlistUI();
                console.log('🔄 Wishlist synced from other tab:', wishlistItems.length, 'items');
            }
        } catch (error) {
            console.error('❌ Error parsing wishlist update from other tab:', error);
        }
    }
});

// =====================================
// FIREBASE REAL-TIME CART SYNCHRONIZATION
// =====================================

// Start real-time cart listener for cross-tab synchronization
function startCartRealtimeListener(userId) {
    if (!userId || !window.firebase || !window.firebase.firestore) {
        console.warn('❌ Cannot start cart listener: Missing userId or Firestore');
        return;
    }

    // Stop existing listener if any
    if (cartListener) {
        console.log('🔄 Stopping existing cart listener');
        cartListener();
        cartListener = null;
    }

    console.log('🎧 Starting real-time cart listener for user:', userId);
    
    // Clear local cart data when starting Firebase listener (for fresh Google login)
    console.log('🧹 Clearing local cart data for Firebase sync...');
    localStorage.removeItem('techHavenCart');
    localStorage.removeItem('techHavenCartCount');
    
    // Reset global cart variables
    cartItems.length = 0;
    cartCount = 0;
    
    const db = window.firebase.firestore();
    
    // Listen to cart collection changes for this user
    cartListener = db.collection('carts')
        .where('userId', '==', userId)
        .onSnapshot(async (snapshot) => {
            // Only skip if currently processing a quantity update on THIS TAB
            if (isUpdatingFromFirestore && pendingQuantityUpdates.size > 0) {
                console.log('🔄 Skipping update to prevent infinite loop - pending updates:', pendingQuantityUpdates.size);
                return;
            }

            console.log('🔔 Cart data changed in Firebase, syncing across tabs...');
            console.log('📊 Firebase listener active on this tab - processing', snapshot.size, 'cart documents');
            
            let cartItems = [];
            let totalCount = 0;
            
            // First, collect all cart items with minimal data
            const cartDocs = [];
            snapshot.forEach((doc) => {
                const item = doc.data();
                cartDocs.push({
                    docId: doc.id,
                    ...item
                });
                // Use actual database quantity (don't use pending updates for cross-tab sync)
                totalCount += (item.quantity || 1);
            });

            console.log('📦 Raw cart documents from Firebase:', cartDocs);

            // Convert Firebase documents to normalized cart items
            if (cartDocs.length > 0) {
                console.log('🔄 Processing cart documents from Firebase...');
                
                // Map Firebase docs to cart items with what we have
                cartItems = cartDocs.map(item => {
                    console.log('📄 Processing Firebase doc:', item);
                    
                    // Check if there's a pending update for this item
                    const hasPendingUpdate = pendingQuantityUpdates.has(item.docId);
                    const pendingQuantity = hasPendingUpdate ? pendingQuantityUpdates.get(item.docId) : null;
                    
                    return {
                        id: item.docId,
                        cartId: item.docId,
                        firebaseDocId: item.docId,
                        productId: item.productId,
                        name: item.name || item.productName || 'Loading...',
                        productName: item.name || item.productName || 'Loading...',
                        price: item.price || item.productPrice || 'Loading...',
                        productPrice: item.price || item.productPrice || 'Loading...',
                        numericPrice: parseFloat(item.numericPrice || item.price || item.productPrice) || 0,
                        image: item.image || item.productImage,
                        productImage: item.image || item.productImage,
                        quantity: hasPendingUpdate ? pendingQuantity : (item.quantity || 1),
                        userId: item.userId,
                        createdAt: item.createdAt
                    };
                });
                
                console.log('✅ Processed cart items:', cartItems);
                
                // Fetch missing product details for items showing "Loading..."
                setTimeout(async () => {
                    console.log('🔍 Checking for cart items with missing product details...');
                    let needsUpdate = false;
                    
                    for (let i = 0; i < cartItems.length; i++) {
                        const item = cartItems[i];
                        
                        // Check if item needs product details
                        if (item.productId && (
                            item.name === 'Loading...' || 
                            item.price === 'Loading...' || 
                            !item.name || 
                            !item.price || 
                            item.numericPrice === 0
                        )) {
                            console.log('🔄 Fetching product details for:', item.productId);
                            
                            try {
                                const response = await fetch(`/api/products/${item.productId}`);
                                if (response.ok) {
                                    const apiResponse = await response.json();
                                    console.log('✅ Got product data:', apiResponse);
                                    
                                    // Extract product data from API response
                                    const productData = apiResponse.product || apiResponse;
                                    
                                    // Update cart item with product details
                                    const formattedPrice = productData.formattedPrice || 
                                                          (productData.price ? `${productData.price.toLocaleString('vi-VN')} VNĐ` : null);
                                    
                                    // Handle image - try multiple possible fields
                                    let productImage = null;
                                    if (productData.image) {
                                        productImage = productData.image;
                                    } else if (productData.images && Array.isArray(productData.images) && productData.images.length > 0) {
                                        productImage = productData.images[0]; // Take first image from array
                                    } else if (productData.imageUrl) {
                                        productImage = productData.imageUrl;
                                    }
                                    
                                    cartItems[i] = {
                                        ...item,
                                        name: productData.name || item.name,
                                        productName: productData.name || item.productName,
                                        price: formattedPrice || item.price,
                                        productPrice: formattedPrice || item.productPrice,
                                        numericPrice: productData.price || item.numericPrice,
                                        image: productImage || item.image,
                                        productImage: productImage || item.productImage
                                    };
                                    
                                    console.log('📝 Product details applied:', {
                                        productId: item.productId,
                                        originalName: item.name,
                                        newName: productData.name,
                                        originalPrice: item.price,
                                        newPrice: formattedPrice,
                                        numericPrice: productData.price,
                                        originalImage: item.image,
                                        newImage: productImage,
                                        apiImageData: {
                                            image: productData.image,
                                            images: productData.images,
                                            imageUrl: productData.imageUrl
                                        }
                                    });
                                    
                                    needsUpdate = true;
                                    console.log('✅ Updated cart item with product details:', cartItems[i]);
                                } else {
                                    console.warn('⚠️ Could not fetch product details:', response.status);
                                }
                            } catch (error) {
                                console.error('❌ Error fetching product details:', error);
                            }
                        }
                    }
                    
                    // If any items were updated, refresh the cart display
                    if (needsUpdate) {
                        console.log('🔄 Refreshing cart display with updated product details');
                        
                        // Update global variables
                        window.cartItems = cartItems;
                        
                        // Update localStorage
                        localStorage.setItem('techHavenCart', JSON.stringify(cartItems));
                        
                        // Update SmartCartManager if available
                        if (window.smartCart) {
                            window.smartCart.cartItems = cartItems;
                            window.smartCart.updateCartIcon();
                        }
                        
                        // Force update cart UI
                        if (typeof updateCartUI === 'function') {
                            updateCartUI();
                        }
                        
                        // Update cart display
                        updateCartDisplay(cartItems, totalCount);
                        
                        // Also update loading items in the main cart UI
                        setTimeout(() => {
                            refreshLoadingCartItems(cartItems);
                        }, 100);
                        
                        console.log('✅ Cart refreshed with complete product details');
                    }
                }, 500); // Small delay to let initial UI load
            }

            // Update cart display immediately with event listeners
            updateCartDisplay(cartItems, totalCount);
            
            // Update localStorage for consistency
            localStorage.setItem('techHavenCart', JSON.stringify(cartItems));
            localStorage.setItem('techHavenCartCount', totalCount.toString());
            
            // Sync all cart systems with latest data
            syncAllCartSystems();
            
            // Update SmartCartManager if available
            if (window.smartCart) {
                window.smartCart.cartItems = cartItems;
                window.smartCart.cartCount = totalCount;
                window.smartCart.updateCartIcon();
            }
            
            console.log('✅ Cart synchronized across tabs with working event listeners:', {
                items: cartItems.length,
                totalCount: totalCount,
                eventListenersSetup: 'via updateCartDisplay → updateCartUI'
            });
        }, (error) => {
            console.error('❌ Cart listener error:', error);
        });
}

// Stop cart real-time listener
function stopCartRealtimeListener() {
    if (cartListener) {
        console.log('🛑 Stopping cart real-time listener');
        cartListener();
        cartListener = null;
    }
}

// Update cart display elements
function updateCartDisplay(items, count) {
    console.log('🔄 updateCartDisplay called with', items.length, 'items and count', count);
    
    // Update global cart variables for consistency
    window.cartItems = items;
    cartItems.length = 0;
    cartItems.push(...items);
    cartCount = count;
    window.cartCount = count;
    
    // Sync localStorage with Firebase data to prevent future conflicts
    console.log('🔄 Syncing localStorage with Firebase cart data for cross-tab consistency');
    localStorage.setItem('techHavenCart', JSON.stringify(items));
    localStorage.setItem('techHavenCartCount', count.toString());
    
    // Update cart count badge
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = count;
        cartCountElement.style.display = count > 0 ? 'flex' : 'none';
    }
    
    // Always call updateCartUI to ensure proper HTML rendering with event listeners
    console.log('🔧 updateCartDisplay: Calling updateCartUI to ensure cart HTML and event listeners are properly set up');
    if (typeof updateCartUI === 'function') {
        updateCartUI();
    } else {
        console.warn('⚠️ updateCartUI function not available in updateCartDisplay');
    }
    
    // Update any other cart displays
    if (typeof updateCartIcon === 'function') {
        updateCartIcon(count);
    }
    
    console.log('✅ updateCartDisplay completed - cart should now have working event listeners');
}

// Refresh loading cart items with updated product details
function refreshLoadingCartItems(updatedItems) {
    console.log('🔄 Refreshing loading cart items with updated details...');
    
    const cartItemsContainer = document.getElementById('cartItems');
    if (!cartItemsContainer) {
        console.warn('⚠️ Cart items container not found');
        return;
    }
    
    // Find all loading cart items in the DOM
    const loadingItems = cartItemsContainer.querySelectorAll('.cart-item.loading-item');
    
    loadingItems.forEach(loadingItemElement => {
        const cartId = loadingItemElement.getAttribute('data-cart-id');
        
        // Find the updated item data
        const updatedItem = updatedItems.find(item => 
            (item.firebaseDocId === cartId) || 
            (item.cartId === cartId) || 
            (item.id === cartId)
        );
        
        if (updatedItem && updatedItem.name && updatedItem.name !== 'Loading...' && updatedItem.price && updatedItem.price !== 'Loading...') {
            console.log('✅ Updating loading item:', cartId, 'with:', updatedItem);
            
            // Update the item's content
            const nameElement = loadingItemElement.querySelector('.cart-item-name');
            const priceElement = loadingItemElement.querySelector('.cart-item-price');
            const imageElement = loadingItemElement.querySelector('.cart-item-image');
            
            if (nameElement) {
                nameElement.textContent = updatedItem.name || updatedItem.productName;
            }
            
            if (priceElement) {
                priceElement.textContent = updatedItem.price || updatedItem.productPrice;
            }
            
            if (imageElement) {
                // Update image from spinner to actual image or icon
                let imageUrl = null;
                
                // Try different image field possibilities
                if (updatedItem.image && updatedItem.image.startsWith('http')) {
                    imageUrl = updatedItem.image;
                } else if (updatedItem.productImage && updatedItem.productImage.startsWith('http')) {
                    imageUrl = updatedItem.productImage;
                } else if (updatedItem.images && Array.isArray(updatedItem.images) && updatedItem.images.length > 0) {
                    imageUrl = updatedItem.images[0];
                }
                
                if (imageUrl) {
                    console.log('🖼️ Updating cart item image with URL:', imageUrl);
                    imageElement.innerHTML = `<img src="${imageUrl}" alt="${updatedItem.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">`;
                } else {
                    console.log('⚠️ No image URL found, using default icon');
                    imageElement.innerHTML = `<i class="fas fa-cube" style="font-size: 2rem; color: #666;"></i>`;
                }
            }
            
            // Remove loading class
            loadingItemElement.classList.remove('loading-item');
            
            console.log('✅ Updated cart item display for:', updatedItem.name);
        }
    });
    
    console.log('✅ Loading cart items refresh completed');
}

// LEGACY renderCartItems function - DISABLED to prevent onclick conflicts
// All cart rendering now handled by main updateCartUI() function
/*
function renderCartItems(items) {
    const cartItemsContainer = document.getElementById('cart-items');
    if (!cartItemsContainer) {
        console.warn('Cart items container not found');
        return;
    }
    
    if (!items || items.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Giỏ hàng trống</p>';
        return;
    }
    
    let cartHTML = '';
    let totalPrice = 0;
    
    items.forEach(item => {
        const itemTotal = (item.numericPrice || 0) * (item.quantity || 1);
        totalPrice += itemTotal;
        
        cartHTML += `
            <div class="cart-item" data-cart-id="${item.firebaseDocId || item.id}">
                <img src="${item.image || '/images/default-product.jpg'}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p class="price">${item.price}</p>
                    <div class="quantity-controls">
                        <button class="quantity-btn decrease-qty" onclick="updateCartQuantityById('${item.firebaseDocId || item.id}', ${item.quantity - 1})">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="quantity-btn increase-qty" onclick="updateCartQuantityById('${item.firebaseDocId || item.id}', ${item.quantity + 1})">+</button>
                    </div>
                </div>
                <button class="remove-item" onclick="removeFromCartById('${item.firebaseDocId || item.id}')">×</button>
            </div>
        `;
    });
    
    cartItemsContainer.innerHTML = cartHTML;
    
    // Update total price if element exists
    const totalElement = document.getElementById('cart-total');
    if (totalElement) {
        totalElement.textContent = new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(totalPrice);
    }
}
*/
// END of legacy renderCartItems function - disabled to prevent conflicts

// =====================================
// EARLY CART FUNCTION DEFINITIONS 
// (to prevent overwriting by other scripts)
// =====================================

// Define addToCart function immediately to prevent overwriting
function defineAddToCartFunction() {
    // Get authentication token for API calls
    async function getAuthToken() {
        if (window.currentUser) {
            // For Firebase Auth users
            if (window.currentUser.provider === 'firebase' && window.firebase && window.firebase.auth && window.firebase.auth().currentUser) {
                try {
                    return await window.firebase.auth().currentUser.getIdToken();
                } catch (error) {
                    console.warn('⚠️ Could not get Firebase ID token:', error);
                }
            }
            
            // For manual users, create a simple token with user info
            if (window.currentUser.provider === 'manual' || !window.currentUser.provider) {
                return btoa(JSON.stringify({
                    uid: window.currentUser.uid,
                    email: window.currentUser.email,
                    provider: 'manual',
                    timestamp: Date.now()
                }));
            }
        }
        
        return null;
    }

    // Add to cart function with variant checking
    window.addToCart = async function(productName, productPrice, productId = null, productImage = null, quantity = 1) {
        // Prevent duplicate calls
        if (window.addToCartInProgress) {
            console.log('⚠️ addToCart already in progress, skipping duplicate call');
            return;
        }
        
        window.addToCartInProgress = true;
        console.log('🛒 Starting addToCart process (with variant checking)');
        
        try {
            // Validate input data
            if (!productName || productName === 'undefined' || !productPrice) {
                console.error('❌ Invalid product data:', { productName, productPrice, productId });
                if (typeof window.showCartNotification === 'function') {
                    window.showCartNotification('Lỗi: Dữ liệu sản phẩm không hợp lệ');
                }
                return;
            }
            
            // Clean price string to get numeric value
            const cleanPrice = productPrice.replace(/[^\d]/g, '');
            const numericPrice = parseInt(cleanPrice);
            
            if (isNaN(numericPrice) || numericPrice <= 0) {
                console.error('❌ Invalid price:', productPrice);
                if (typeof window.showCartNotification === 'function') {
                    window.showCartNotification('Lỗi: Giá sản phẩm không hợp lệ');
                }
                return;
            }
            
            // Use product name as ID if no productId provided (for index page)
            const itemId = productId ? String(productId) : productName;
            
            // Check if product has variants (only if productId is provided)
            if (productId) {
                console.log('🔍 Checking for product variants...');
                try {
                    const variantResponse = await fetch(`/api/products/${productId}/variants`);
                    const variantData = await variantResponse.json();
                    
                    if (variantData.success && variantData.hasVariants && variantData.variants.length > 0) {
                        console.log('🔗 Product has variants, showing selection modal');
                        console.log('📊 Main product data from API:', variantData.mainProduct);
                        window.addToCartInProgress = false; // Reset flag
                        showVariantSelectionModal(variantData.mainProduct, variantData.variants);
                        return;
                    }
                } catch (variantError) {
                    console.log('⚠️ Error checking variants, proceeding with normal add:', variantError);
                    // Continue with normal add to cart if variant check fails
                }
            }
            
            // Continue with normal add to cart
            console.log('Adding to cart - Product ID:', itemId, 'Name:', productName);
        
            // If user is logged in, work directly with database
            if (window.currentUser) {
                try {
                    let headers = {
                        'Content-Type': 'application/json'
                    };
                    
                    let body = {
                        productId: itemId,
                        productName: productName,
                        productPrice: productPrice,
                        numericPrice: numericPrice,
                        productImage: productImage,
                        quantity: quantity || 1 // Use the specified quantity
                    };
                    
                    // Add Authorization header only for Firebase Auth users
                    if (window.currentUser.provider === 'firebase') {
                        const token = await getAuthToken();
                        if (token) {
                            headers['Authorization'] = `Bearer ${token}`;
                        }
                    } else {
                        // For manual users, add userId to body
                        body.userId = window.currentUser.uid;
                    }
                    
                    // Note: Don't set isUpdatingFromFirestore flag for addToCart
                    // This flag is only for quantity updates to prevent infinite loops
                    
                    const response = await fetch('/api/cart', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(body)
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        console.log('✅ Item added to database cart:', result);
                        
                        // Store the Firebase document ID for future updates
                        if (result.cartId || result.id) {
                            const firebaseDocId = result.cartId || result.id;
                            console.log('📝 Storing Firebase document ID:', firebaseDocId);
                            
                            // Update local cart items with Firebase ID
                            const existingLocal = cartItems.find(item => String(item.id || item.productId) === String(itemId));
                            if (existingLocal) {
                                existingLocal.firebaseDocId = firebaseDocId;
                                existingLocal.cartId = firebaseDocId;
                                existingLocal.id = firebaseDocId;
                                console.log('✅ Updated local cart item with Firebase ID');
                            }
                        }
                        
                        // Show success notification
                        if (typeof window.showCartNotification === 'function') {
                            window.showCartNotification(productName);
                        } else {
                            // Fallback notification
                            console.log('✅ Added to cart:', productName);
                        }
                        // Reload cart and update UI
                        if (typeof loadCartFromDatabase === 'function') {
                            console.log('🔄 Calling loadCartFromDatabase after successful add to cart...');
                            await loadCartFromDatabase(); // This will update cartCount and call updateCartUI()
                            console.log('✅ loadCartFromDatabase completed');
                        } else if (typeof updateCartUI === 'function') {
                            console.log('⚠️ loadCartFromDatabase not found, using fallback updateCartUI');
                            // Fallback if loadCartFromDatabase doesn't exist
                            cartCount++;
                            updateCartUI();
                        } else {
                            console.log('❌ Neither loadCartFromDatabase nor updateCartUI found!');
                        }
                        
                        // No need to reset isUpdatingFromFirestore flag since we didn't set it for addToCart
                    } else {
                        throw new Error(result.error || 'Failed to add to cart');
                    }
                } catch (error) {
                    console.error('❌ Failed to add item to database cart:', error);
                    if (typeof showNotification === 'function') {
                        showNotification('Có lỗi xảy ra khi thêm vào giỏ hàng!', 'error');
                    } else {
                        alert('Có lỗi xảy ra khi thêm vào giỏ hàng!');
                    }
                }
            } else {
                // For non-logged users, work with local storage only
                console.log('👤 Guest user detected - managing cart locally');
                
                const existingItem = cartItems.find(item => String(item.id) === String(itemId));
                
                if (existingItem) {
                    existingItem.quantity += (quantity || 1);
                    if (productImage) {
                        existingItem.image = productImage;
                    }
                    console.log('🔄 Updated existing cart item:', existingItem);
                } else {
                    const newItem = {
                        id: itemId,
                        productId: productId || itemId, // Ensure productId is always set
                        name: productName,
                        price: productPrice,
                        numericPrice: numericPrice,
                        quantity: quantity || 1,
                        image: productImage || 'fas fa-cube'
                    };
                    
                    // Validate the new item before adding
                    if (newItem.id && newItem.id !== 'undefined' && 
                        newItem.name && newItem.name !== 'undefined' && 
                        !isNaN(newItem.numericPrice) && newItem.numericPrice > 0) {
                        cartItems.push(newItem);
                        console.log('✨ Added new cart item:', newItem);
                    } else {
                        console.error('❌ Invalid item data, not adding to cart:', newItem);
                        return;
                    }
                }
                
                // Recalculate cart count correctly
                cartCount = cartItems.reduce((total, item) => total + (item.quantity || 1), 0);
                console.log('🔢 Updated cart count:', cartCount, 'from', cartItems.length, 'items');
                
                // FORCE save to localStorage immediately
                localStorage.setItem('techHavenCart', JSON.stringify(cartItems));
                localStorage.setItem('techHavenCartCount', cartCount.toString());
                console.log('💾 Saved to localStorage:', {
                    items: cartItems.length,
                    count: cartCount,
                    storage: localStorage.getItem('techHavenCart')
                });
                
                // Force update UI immediately
                if (typeof updateCartUI === 'function') {
                    updateCartUI();
                } else {
                    // Fallback: manually update cart badge if updateCartUI not available yet
                    console.log('⚠️ updateCartUI not available, updating badge manually');
                    const cartBadge = document.getElementById('cartBadge');
                    const mobileCartCount = document.getElementById('mobileCartCount'); // Fixed: use 'mobileCartCount' for shop page
                    if (cartBadge) {
                        cartBadge.textContent = cartCount;
                        cartBadge.style.display = cartCount > 0 ? 'flex' : 'none';
                    }
                    if (mobileCartCount) {
                        mobileCartCount.textContent = cartCount;
                    }
                }
                
                // Also call saveCartToStorage if it exists (for consistency)
                if (typeof saveCartToStorage === 'function') {
                    saveCartToStorage();
                }
                
                // Show notification
                if (typeof window.showCartNotification === 'function') {
                    window.showCartNotification(productName);
                } else {
                    console.log('✅ Added to cart:', productName);
                }
                
                // Force trigger cart badge update
                const cartBadge = document.getElementById('cartBadge');
                const mobileCartCount = document.getElementById('mobileCartCount'); // Fixed: use 'mobileCartCount' for shop page
                if (cartBadge) {
                    cartBadge.textContent = cartCount;
                    cartBadge.style.display = cartCount > 0 ? 'flex' : 'none';
                    console.log('🏷️ Cart badge updated:', cartBadge.textContent, 'display:', cartBadge.style.display);
                }
                if (mobileCartCount) {
                    mobileCartCount.textContent = cartCount;
                    console.log('📱 Mobile cart count updated:', mobileCartCount.textContent);
                }
            }
        
        } finally {
            // Reset the flag to allow future calls
            window.addToCartInProgress = false;
            console.log('🏁 addToCart process completed (early definition)');
        }
    };
    
    console.log('🚀 Early addToCart function defined with duplicate prevention');
}

// Define early updateCartUI function to prevent undefined errors
function defineEarlyUpdateCartUI() {
    // Simple early version of updateCartUI for immediate availability
    window.updateCartUI = function() {
        console.log('🔄 Early updateCartUI called');
        
        // For guest users: Use local cart data first (cartItems), for logged users: use Firebase data (window.cartItems)
        let activeCartItems = [];
        let activeCartCount = 0;
        let dataSource = 'none';
        
        // Check if user is logged in
        const isLoggedIn = window.currentUser !== null && window.currentUser !== undefined;
        
        if (isLoggedIn && window.cartItems !== undefined) {
            // For logged users: Use Firebase sync data (window.cartItems) - even if empty
            activeCartItems = window.cartItems || [];
            activeCartCount = window.cartCount || activeCartItems.reduce((total, item) => total + (item.quantity || 1), 0);
            dataSource = 'firebase-sync';
            console.log('👤 Logged user: Using Firebase cart data:', {items: activeCartItems.length, count: activeCartCount, source: dataSource});
        } else if (cartItems && cartItems.length > 0) {
            // For guest users: Use local cart data (script.js variables) first
            activeCartItems = cartItems;
            activeCartCount = cartCount || activeCartItems.reduce((total, item) => total + (item.quantity || 1), 0);
            dataSource = 'guest-local';
            console.log('👤 Guest user: Using local script.js cart data:', {items: activeCartItems.length, count: activeCartCount, source: dataSource});
        } else {
            // Fallback to localStorage for both guest and logged users
            activeCartItems = JSON.parse(localStorage.getItem('techHavenCart')) || [];
            activeCartCount = parseInt(localStorage.getItem('techHavenCartCount')) || 0;
            dataSource = 'localStorage-fallback';
            console.log('⚠️ Fallback to localStorage cart data:', {items: activeCartItems.length, count: activeCartCount, source: dataSource});
        }
        
        // Update cart badge
        const cartBadge = document.getElementById('cartBadge');
        const mobileCartCount = document.getElementById('mobileCartCount'); // Fixed: use 'mobileCartCount' for shop page
        
        if (cartBadge) {
            cartBadge.textContent = activeCartCount;
            cartBadge.style.display = activeCartCount > 0 ? 'flex' : 'none';
            console.log('🏷️ Early cart badge updated:', activeCartCount, 'source:', dataSource);
        }
        
        if (mobileCartCount) {
            mobileCartCount.textContent = activeCartCount;
            console.log('📱 Early mobile cart count updated:', activeCartCount, 'source:', dataSource);
        }
        
        // Update cart items display if container exists
        const cartItemsContainer = document.getElementById('cartItems');
        if (cartItemsContainer) {
            if (activeCartItems.length > 0) {
                // Generate full cart item HTML to match logged-in user format
                cartItemsContainer.innerHTML = activeCartItems.map(item => {
                    const itemId = item.id || item.productId || 'unknown';
                    const itemName = item.name || item.productName || 'Product';
                    const itemPrice = item.price || '0 VNĐ';
                    const itemQuantity = item.quantity || 1;
                    const itemImage = item.image || item.productImage || '';
                    
                    // Generate image HTML
                    let imageHtml = '';
                    if (itemImage && itemImage.startsWith('http')) {
                        imageHtml = `<img src="${itemImage}" alt="${itemName}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">`;
                    } else if (itemImage && itemImage.startsWith('fas ')) {
                        imageHtml = `<i class="${itemImage}" style="font-size: 2rem; color: #666;"></i>`;
                    } else {
                        imageHtml = `<i class="fas fa-cube" style="font-size: 2rem; color: #666;"></i>`;
                    }
                    
                    // Use actual product ID, not cart ID
                    const productId = item.productId || itemId; // Fallback to itemId if productId missing
                    
                    return `
                        <div class="cart-item" data-product-id="${productId}" data-cart-id="${itemId}">
                            <div class="cart-item-image">
                                ${imageHtml}
                            </div>
                            <div class="cart-item-details">
                                <div class="cart-item-name">${itemName}</div>
                                <div class="cart-item-price">${itemPrice}</div>
                                <div class="cart-item-controls">
                                    <button class="quantity-btn decrease-qty" data-cart-id="${itemId}" data-current-quantity="${itemQuantity}">
                                        <i class="fas fa-minus"></i>
                                    </button>
                                    <span class="cart-item-quantity">${itemQuantity}</span>
                                    <button class="quantity-btn increase-qty" data-cart-id="${itemId}" data-current-quantity="${itemQuantity}">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                    <button class="remove-item" data-cart-id="${itemId}">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                console.log('📦 Early cart items updated with full UI:', activeCartItems.length, 'source:', dataSource);
            } else {
                cartItemsContainer.innerHTML = `
                    <div class="empty-cart">
                        <i class="fas fa-shopping-cart" style="font-size: 3rem; color: #ccc;"></i>
                        <p>Giỏ hàng của bạn đang trống</p>
                    </div>
                `;
                console.log('📦 Early cart items cleared (empty cart UI)', 'source:', dataSource);
            }
        }
        
                // Update cart total
        const cartTotalElement = document.getElementById('cartTotal');
        if (cartTotalElement) {
            if (activeCartItems.length > 0) {
                const total = activeCartItems.reduce((sum, item) => {
                    let price = 0;
                    // Handle different price formats
                    if (item.numericPrice) {
                        price = item.numericPrice;
                    } else if (item.price) {
                        // Extract numeric value from price string
                        price = parseInt(item.price.replace(/[^\d]/g, '')) || 0;
                    }
                    return sum + (price * (item.quantity || 1));
                }, 0);
                cartTotalElement.textContent = total.toLocaleString('vi-VN') + ' VNĐ';
                console.log('💰 Early cart total updated:', total, 'from items:', activeCartItems, 'source:', dataSource);
            } else {
                cartTotalElement.textContent = '0 VNĐ';
                console.log('💰 Early cart total set to 0 (empty cart)', 'source:', dataSource);
            }
        }
        
        // Enable/disable checkout button
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) {
            checkoutBtn.disabled = activeCartItems.length === 0;
        }
        
        // Setup event listeners for logged users (if setupCartEventListeners is available) - only once
        if (window.currentUser && typeof setupCartEventListeners === 'function' && !window.cartEventListenersSetup) {
            setTimeout(() => {
                setupCartEventListeners();
                window.cartEventListenersSetup = true;
                console.log('✅ Early cart event listeners setup completed');
            }, 100);
        }
    };
    
    console.log('✅ Early updateCartUI function defined');
}

// Define early guest cart management functions
function defineGuestCartFunctions() {
    // Update guest cart item quantity
    window.updateGuestCartQuantity = function(itemId, newQuantity) {
        console.log('🔄 Updating guest cart quantity:', itemId, newQuantity);
        
        if (newQuantity <= 0) {
            removeGuestCartItem(itemId);
            return;
        }
        
        // Update global cartItems array
        const itemIndex = cartItems.findIndex(item => String(item.id) === String(itemId));
        if (itemIndex !== -1) {
            cartItems[itemIndex].quantity = newQuantity;
            
            // Update global cartCount
            cartCount = cartItems.reduce((total, item) => total + (item.quantity || 1), 0);
            
            // Update localStorage
            localStorage.setItem('techHavenCart', JSON.stringify(cartItems));
            localStorage.setItem('techHavenCartCount', cartCount.toString());
            
            // Update UI
            if (typeof updateCartUI === 'function') {
                updateCartUI();
            }
            
            console.log('✅ Guest cart quantity updated');
        } else {
            console.error('❌ Item not found in cart:', itemId);
        }
    };
    
    // Remove guest cart item
    window.removeGuestCartItem = function(itemId) {
        console.log('🗑️ Removing guest cart item:', itemId);
        
        // Update global cartItems array
        cartItems = cartItems.filter(item => String(item.id) !== String(itemId));
        
        // Update global cartCount
        cartCount = cartItems.reduce((total, item) => total + (item.quantity || 1), 0);
        
        // Update localStorage
        localStorage.setItem('techHavenCart', JSON.stringify(cartItems));
        localStorage.setItem('techHavenCartCount', cartCount.toString());
        
        // Update UI
        if (typeof updateCartUI === 'function') {
            updateCartUI();
        }
        
        console.log('✅ Guest cart item removed');
    };
    
    console.log('✅ Guest cart functions defined');
}

// Define essential cart functions early to prevent undefined errors
function defineEssentialCartFunctions() {
    // Early placeholder for updateCartQuantityById function
    if (!window.updateCartQuantityById) {
        window.updateCartQuantityById = function(cartId, newQuantity) {
            console.log('🔄 Early updateCartQuantityById called, delegating to handler:', cartId, newQuantity);
            if (typeof handleCartQuantityUpdate === 'function') {
                return handleCartQuantityUpdate(cartId, newQuantity);
            } else {
                console.error('❌ handleCartQuantityUpdate function not available yet');
            }
        };
    }
    
    // Early placeholder for removeFromCartById function
    if (!window.removeFromCartById) {
        window.removeFromCartById = function(cartId) {
            console.log('🗑️ Early removeFromCartById called, delegating to handler:', cartId);
            if (typeof handleCartRemove === 'function') {
                return handleCartRemove(cartId);
            } else {
                console.error('❌ handleCartRemove function not available yet');
            }
        };
    }
    
    console.log('✅ Essential cart functions defined early');
}

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    // Mark that script.js has been loaded
    window.scriptJsLoaded = true;
    console.log('✅ Script.js loaded successfully');
    
    // Immediately update cart badge to prevent shop.ejs conflicts
    setTimeout(() => {
        if (typeof updateCartUI === 'function') {
            console.log('🎯 Script.js taking control of cart badge');
            updateCartUI();
        }
    }, 100);
    
    // Define addToCart IMMEDIATELY to prevent overwriting by other scripts
    defineAddToCartFunction();
    
    // Define early updateCartUI to prevent undefined errors
    defineEarlyUpdateCartUI();
    
    // Define guest cart management functions
    defineGuestCartFunctions();
    
    // Define essential cart functions early to prevent undefined errors
    defineEssentialCartFunctions();
    
    // Only run loading screen on index page
    if (!document.body.classList.contains('index-page')) {
        // Skip loading screen for non-index pages
        setupNonIndexPage();
        
        return;
    }
    
    // Cute Loading Screen Controller (only for index page)
    const loadingScreen = document.getElementById('loadingScreen');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressPercentage = document.getElementById('progressPercentage');
    
    // Debug: Check if loading elements exist
    console.log('🔍 Loading elements check:', {
        loadingScreen: !!loadingScreen,
        progressFill: !!progressFill,
        progressText: !!progressText,
        progressPercentage: !!progressPercentage
    });
    
    // If loading screen doesn't exist, skip loading animation
    if (!loadingScreen) {
        console.log('⚠️ Loading screen element not found, skipping loading animation');
        return;
    }
    
    // Định nghĩa allElements ở scope cao hơn để completeLoading có thể truy cập
    let allElements;
    
    // Thêm class loading cho body và html ngay lập tức
    document.body.classList.add('loading');
    document.documentElement.classList.add('loading');
    
    // Ẩn tất cả nội dung khác ngay lập tức
    allElements = document.querySelectorAll('body > *:not(.loading-screen)');
    console.log('📊 Found', allElements.length, 'elements to hide during loading');
    allElements.forEach(element => {
        element.style.display = 'none';
        element.style.visibility = 'hidden';
    });
    
    // Đảm bảo loading screen hiển thị trên cùng
    loadingScreen.style.zIndex = '999999';
    loadingScreen.style.position = 'fixed';
    loadingScreen.style.top = '0';
    loadingScreen.style.left = '0';
    loadingScreen.style.width = '100%';
    loadingScreen.style.height = '100%';
    loadingScreen.style.display = 'flex';
    
    // Cute loading messages với emoji
    const cuteMessages = [
        '🤖 Robot đang khởi động...',
        '🔧 Đang lắp ráp linh kiện...',
        '🎮 Chuẩn bị game gear...',
        '✨ Tạo phép màu công nghệ...',
        '🚀 Sắp sẵn sàng rồi...',
        '🎉 Chào mừng đến Tech Haven!'
    ];
    
    let progress = 0;
    let currentMessageIndex = 0;
    
    // Detect mobile device
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    function updateCuteProgress() {
        console.log('🔄 Progress update called, current progress:', progress);
        
        // Check if elements still exist before updating
        if (!progressFill || !progressText || !progressPercentage) {
            console.log('❌ Progress elements not found, stopping animation');
            completeLoading();
            return;
        }
        
        // Tăng progress nhanh hơn cho loading speed
        const progressIncrement = isMobile ? Math.random() * 12 + 8 : Math.random() * 20 + 10;
        progress += progressIncrement; 
        
        if (progress >= 100) {
            progress = 100;
            progressFill.style.width = '100%';
            progressPercentage.textContent = '100%';
            progressText.textContent = cuteMessages[5];
            
            console.log('🎯 Progress reached 100%, completing loading...');
            
            // Đơn giản hóa completion animation
            setTimeout(() => {
                completeLoading();
            }, 300);
            return;
        }
        
        // Update progress bar và percentage
        progressFill.style.width = progress + '%';
        progressPercentage.textContent = Math.round(progress) + '%';
        
        // Update cute message
        const messageIndex = Math.floor((progress / 100) * (cuteMessages.length - 1));
        if (messageIndex !== currentMessageIndex && messageIndex < cuteMessages.length - 1) {
            currentMessageIndex = messageIndex;
            progressText.textContent = cuteMessages[messageIndex];
            
            // Smooth bounce effect (reduced on mobile)
            if (!isMobile) {
                progressText.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    progressText.style.transform = 'scale(1)';
                }, 200);
            }
        }
        
        // Tiếp tục với timing nhanh hơn
        const nextInterval = isMobile ? Math.random() * 150 + 100 : Math.random() * 250 + 150;
        setTimeout(updateCuteProgress, nextInterval);
    }
    
    // Function để hoàn thành loading
    function completeLoading() {
        console.log('🎉 Completing loading...');
        
        // Hiện lại tất cả nội dung web
        document.body.classList.remove('loading');
        document.documentElement.classList.remove('loading');
        
        // Hiện lại tất cả element
        allElements.forEach(element => {
            element.style.display = '';
            element.style.visibility = '';
        });
        
        // Ẩn loading screen
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            loadingScreen.style.display = 'none';
        }
        
        document.body.style.overflow = 'auto';
        console.log('✅ Loading completed');
        
        // Initialize cart state after loading is complete (for index page)
        if (typeof updateCartUI === 'function') {
            updateCartUI();
            console.log('🔄 Initial cart UI update completed after loading');
        }
        
        // Initialize wishlist after loading is complete
        initializeWishlist();
    }
    
    // Bắt đầu loading ngay lập tức
    const initialDelay = isMobile ? 100 : 200;
    setTimeout(() => {
        updateCuteProgress();
    }, initialDelay);
    
    // Safety fallback - much shorter timeout for faster loading
    const fallbackTimeout = isMobile ? 2000 : 3000;
    setTimeout(() => {
        if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
            console.log('⚠️ Fallback timeout triggered');
            completeLoading();
        }
    }, fallbackTimeout);

    // Mobile Menu Toggle with improved touch handling
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (mobileMenuToggle && navMenu) {
        // Add both click and touch events for better tablet support
        function toggleMenu() {
            navMenu.classList.toggle('active');
            
            // Change hamburger icon
            const icon = mobileMenuToggle.querySelector('i');
            if (navMenu.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
                mobileMenuToggle.setAttribute('aria-expanded', 'true');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
            }
        }
        
        // Add click event listener only - touchend preventDefault blocks mobile onclick
        mobileMenuToggle.addEventListener('click', toggleMenu);
        
        // Add keyboard support
        mobileMenuToggle.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleMenu();
            }
        });

        // Close menu when clicking on menu items
        const menuItems = navMenu.querySelectorAll('a');
        menuItems.forEach(item => {
            function closeMenu() {
                navMenu.classList.remove('active');
                const icon = mobileMenuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
            }
            
            // Only use click event to avoid conflicts with mobile onclick
            item.addEventListener('click', closeMenu);
        });

        // Close menu when clicking outside (but not on functional buttons)
        document.addEventListener('click', function(e) {
            // Don't close menu if clicking on:
            // 1. Mobile menu toggle itself
            // 2. Nav menu container
            // 3. Mobile nav icons (search, cart, user buttons)
            // 4. Admin dropdown elements
            
            const isClickOnToggle = mobileMenuToggle.contains(e.target);
            const isClickOnNavMenu = navMenu.contains(e.target);
            const isClickOnMobileIcons = e.target.closest('.mobile-nav-icons');
            const isClickOnAdminDropdown = e.target.closest('.admin-dropdown');
            const isClickOnFunctionalButton = e.target.closest('a[onclick]') || e.target.closest('button[onclick]');
            
            // Only close menu if NOT clicking on any of the above
            if (!isClickOnToggle && !isClickOnNavMenu && !isClickOnMobileIcons && !isClickOnAdminDropdown && !isClickOnFunctionalButton) {
                navMenu.classList.remove('active');
                const icon = mobileMenuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Setup wishlist event listeners for index page
    document.addEventListener('click', function(e) {
        // console.log('🔍 Index page click detected:', e.target); // Removed debug log
        if (e.target.closest('.wishlist-btn')) {
            console.log('💖 Index page wishlist button clicked');
            handleWishlistClick(e);
        }
    });
    
    console.log('✅ Index page wishlist event listeners setup completed');

    // Test function for wishlist
    window.testWishlist = function() {
        console.log('🧪 Testing wishlist...');
        const wishlistBtn = document.querySelector('.wishlist-btn');
        console.log('🔍 Found wishlist button:', wishlistBtn);
        if (wishlistBtn) {
            console.log('📄 Button data attributes:', {
                productId: wishlistBtn.dataset.productId,
                productName: wishlistBtn.dataset.productName,
                productPrice: wishlistBtn.dataset.productPrice,
                productImage: wishlistBtn.dataset.productImage
            });
        }
        console.log('👤 Current user:', window.currentUser);
        console.log('🔥 Firebase available:', !!window.firebase);
        console.log('📋 Current wishlist items:', wishlistItems);
    };

    // Auto-run test after a short delay
    setTimeout(() => {
        console.log('🚀 Auto-running wishlist test...');
        if (typeof window.testWishlist === 'function') {
            window.testWishlist();
        }
    }, 2000);

    // Banner Carousel - Completely Rewritten
    class BannerCarousel {
        constructor() {
            this.slides = document.querySelectorAll('.banner-slide');
            this.dots = document.querySelectorAll('.banner-dot');
            this.prevBtn = document.querySelector('.banner-prev');
            this.nextBtn = document.querySelector('.banner-next');
            this.currentSlide = 0;
            this.totalSlides = this.slides.length;
            this.isAnimating = false;
            this.autoPlayInterval = null;
            
            this.init();
        }

        init() {
            if (this.slides.length === 0) return;
            
            // Set up event listeners
            this.prevBtn?.addEventListener('click', () => this.prevSlide());
            this.nextBtn?.addEventListener('click', () => this.nextSlide());
            
            this.dots.forEach((dot, index) => {
                dot.addEventListener('click', () => this.goToSlide(index));
            });

            // Keyboard navigation
            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') this.prevSlide();
                if (e.key === 'ArrowRight') this.nextSlide();
            });

            // Touch/Swipe support
            this.setupTouchEvents();

            // Auto-play
            this.startAutoPlay();

            // Pause on hover
            const bannerContainer = document.querySelector('.banner-container');
            bannerContainer?.addEventListener('mouseenter', () => this.stopAutoPlay());
            bannerContainer?.addEventListener('mouseleave', () => this.startAutoPlay());

            // Initialize first slide
            this.updateSlide();
        }

        goToSlide(index) {
            if (this.isAnimating || index === this.currentSlide) return;
            
            this.currentSlide = index;
            this.updateSlide();
            this.resetAutoPlay();
        }

        nextSlide() {
            if (this.isAnimating) return;
            
            this.currentSlide = (this.currentSlide + 1) % this.totalSlides;
            this.updateSlide();
            this.resetAutoPlay();
        }

        prevSlide() {
            if (this.isAnimating) return;
            
            this.currentSlide = (this.currentSlide - 1 + this.totalSlides) % this.totalSlides;
            this.updateSlide();
            this.resetAutoPlay();
        }

        updateSlide() {
            this.isAnimating = true;

            // Update slides
            this.slides.forEach((slide, index) => {
                slide.classList.toggle('active', index === this.currentSlide);
            });

            // Update dots
            this.dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === this.currentSlide);
            });

            // Reset animation flag after transition
            setTimeout(() => {
                this.isAnimating = false;
            }, 600);
        }

        startAutoPlay() {
            this.autoPlayInterval = setInterval(() => {
                this.nextSlide();
            }, 5000);
        }

        stopAutoPlay() {
            if (this.autoPlayInterval) {
                clearInterval(this.autoPlayInterval);
                this.autoPlayInterval = null;
            }
        }

        resetAutoPlay() {
            this.stopAutoPlay();
            this.startAutoPlay();
        }

        setupTouchEvents() {
            const container = document.querySelector('.banner-container');
            if (!container) return;

            let startX = 0;
            let endX = 0;

            container.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
            });

            container.addEventListener('touchend', (e) => {
                endX = e.changedTouches[0].clientX;
                const diff = startX - endX;
                const threshold = 50;

                if (Math.abs(diff) > threshold) {
                    if (diff > 0) {
                        this.nextSlide();
                    } else {
                        this.prevSlide();
                    }
                }
            });
        }
    }

    // Initialize banner carousel
    const bannerCarousel = new BannerCarousel();

    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Add smooth transition effect
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
    });

    // Product card hover effects
    const productCards = document.querySelectorAll('.product-card');
    productCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Add to cart functionality handled by onclick attributes in HTML
    // Removed addEventListener to prevent double calls
    /*
    const addToCartBtns = document.querySelectorAll('.add-to-cart');
    addToCartBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Animation effect
            this.style.transform = 'scale(0.9)';
            this.textContent = 'ADDED!';
            this.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            
            setTimeout(() => {
                this.style.transform = 'scale(1)';
                this.textContent = 'ADD TO CART';
                this.style.background = 'linear-gradient(135deg, #f472b6, #ec4899)';
            }, 1500);
        });
    });
    */

    // Build options functionality
    const buildOptions = document.querySelectorAll('.build-option');
    buildOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remove active class from all options
            buildOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to clicked option
            this.classList.add('active');
            
            // Add click animation
            this.style.transform = 'scale(0.9)';
            setTimeout(() => {
                this.style.transform = this.classList.contains('active') ? 'scale(1.1)' : 'scale(1)';
            }, 150);
        });
    });

    // Shop Now button functionality
    const shopBtn = document.querySelector('.shop-btn');
    if (shopBtn) {
        shopBtn.addEventListener('click', function() {
            // Scroll to featured products section
            const featuredSection = document.querySelector('.featured-products');
            if (featuredSection) {
                featuredSection.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    }

    // Header scroll effect
    const header = document.querySelector('.header');
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 100) {
            header.style.background = 'rgba(255, 255, 255, 0.98)';
            header.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.15)';
        } else {
            header.style.background = 'rgba(255, 255, 255, 0.95)';
            header.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
        }
        
        lastScrollY = currentScrollY;
    });

    // Parallax effect for hero section (disabled to prevent overlap)
    // window.addEventListener('scroll', () => {
    //     const scrolled = window.pageYOffset;
    //     const parallax = document.querySelector('.hero');
    //     if (parallax) {
    //         const speed = scrolled * 0.5;
    //         parallax.style.transform = `translateY(${speed}px)`;
    //     }
    // });

    // Animation on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.product-card, .build-option');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Mobile menu icons functionality handled by onclick attributes in HTML

    // Add loading animation
    window.addEventListener('load', function() {
        document.body.classList.add('loaded');
        
        // Remove any conflicting transforms
        const hero = document.querySelector('.hero');
        if (hero) {
            hero.style.transform = 'none';
        }
        
        // Animate elements on page load
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            heroContent.style.opacity = '0';
            heroContent.style.transform = 'translateY(50px)';
            setTimeout(() => {
                heroContent.style.transition = 'opacity 1s ease, transform 1s ease';
                heroContent.style.opacity = '1';
                heroContent.style.transform = 'translateY(0)';
            }, 300);
        }
    });

    // =====================================
    // SMART CART MANAGER CLASS
    // =====================================
    
    // Smart Cart State Manager - automatically switches between localStorage and Firebase
    class SmartCartManager {
        constructor() {
            this.isLoggedIn = false;
            this.lastUpdateSource = 'localStorage';
            this.cartData = {
                items: [],
                count: 0,
                total: 0
            };
            console.log('🧠 SmartCartManager initialized');
        }
        
        // Clear local cart for Google login
        clearCartForGoogleLogin() {
            console.log('🧹 SmartCartManager: Clearing cart for Google login...');
            
            // Clear localStorage
            localStorage.removeItem('techHavenCart');
            localStorage.removeItem('techHavenCartCount');
            
            // Reset cart data
            this.cartData = {
                items: [],
                count: 0,
                total: 0
            };
            
            // Reset global variables
            if (window.cartItems) {
                window.cartItems.length = 0;
            }
            if (typeof window.cartCount !== 'undefined') {
                window.cartCount = 0;
            }
            
            // Update UI immediately
            this.updateCartIcon();
            
            console.log('✅ SmartCartManager: Cart cleared for Google login');
        }
        
        // Update authentication status and trigger cart refresh
        setAuthStatus(isLoggedIn, user = null) {
            console.log('🔄 SmartCartManager: Auth status changed:', isLoggedIn ? 'LOGGED IN' : 'LOGGED OUT');
            const wasLoggedIn = this.isLoggedIn;
            this.isLoggedIn = isLoggedIn;
            window.currentUser = user;
            
            // If transitioning from logged out to logged in with Google, clear local cart
            if (!wasLoggedIn && isLoggedIn && user && user.provider === 'google') {
                console.log('🧹 Google login detected, clearing local cart...');
                this.clearCartForGoogleLogin();
            }
            
            if (wasLoggedIn !== isLoggedIn) {
                console.log('🔄 Auth status changed, refreshing cart...');
                this.refreshCartData();
            }
        }
        
        // Get cart data from appropriate source
        async getCartData() {
            if (this.isLoggedIn && window.currentUser) {
                console.log('👤 SmartCartManager: Getting cart from Firebase for user:', window.currentUser.uid);
                try {
                    const response = await fetch(`/api/cart?uid=${window.currentUser.uid}`);
                    if (response.ok) {
                        const data = await response.json();
                        console.log('📦 Firebase cart response:', data);
                        if (data.success) {
                            this.lastUpdateSource = 'firebase';
                            return {
                                items: data.cartItems || [],
                                count: data.itemCount || 0,
                                total: data.total || 0
                            };
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ Firebase cart load failed, falling back to localStorage:', error);
                }
            }
            
            // Fallback to localStorage
            console.log('💾 SmartCartManager: Getting cart from localStorage');
            const localItems = JSON.parse(localStorage.getItem('techHavenCart')) || [];
            const localCount = parseInt(localStorage.getItem('techHavenCartCount')) || 0;
            const localTotal = localItems.reduce((sum, item) => sum + ((item.numericPrice || 0) * (item.quantity || 1)), 0);
            
            this.lastUpdateSource = 'localStorage';
            return {
                items: localItems,
                count: localCount,
                total: localTotal
            };
        }
        
        // Refresh cart data and update UI
        async refreshCartData() {
            console.log('🔄 SmartCartManager: Refreshing cart data...');
            this.cartData = await this.getCartData();
            console.log('📊 SmartCartManager: Cart data refreshed:', this.cartData);
            this.updateCartIcon();
            return this.cartData;
        }
        
        // Update cart icon with visual indicator of data source
        updateCartIcon() {
            const cartBadge = document.getElementById('cartBadge');
            const cartIcon = document.querySelector('#cartIcon i.fas.fa-shopping-cart');
            const cartIconWrapper = document.getElementById('cartIcon');
            const cartStateTooltip = document.getElementById('cartStateTooltip');
            const mobileCartCount = document.getElementById('mobileCartCount'); // Fixed: use 'mobileCartCount' for shop page
            
            console.log('🎨 SmartCartManager: Updating cart icon:', {
                count: this.cartData.count,
                source: this.lastUpdateSource,
                isLoggedIn: this.isLoggedIn,
                elements: {
                    cartBadge: !!cartBadge,
                    cartIcon: !!cartIcon,
                    cartIconWrapper: !!cartIconWrapper,
                    cartStateTooltip: !!cartStateTooltip
                }
            });
            
            // Update cart badge
            if (cartBadge) {
                cartBadge.textContent = this.cartData.count;
                cartBadge.style.display = this.cartData.count > 0 ? 'flex' : 'none';
                
                // Add visual indicator for data source
                cartBadge.classList.remove('firebase-data', 'local-data');
                cartBadge.classList.add(this.lastUpdateSource === 'firebase' ? 'firebase-data' : 'local-data');
                cartBadge.title = this.lastUpdateSource === 'firebase' ? 'Dữ liệu từ Cloud' : 'Dữ liệu cục bộ';
            }
            
            // Update cart icon wrapper classes
            if (cartIconWrapper) {
                cartIconWrapper.classList.remove('has-firebase-data', 'has-local-data');
                cartIconWrapper.classList.add(this.lastUpdateSource === 'firebase' ? 'has-firebase-data' : 'has-local-data');
            }
            
            // Update tooltip
            if (cartStateTooltip) {
                const tooltip = this.lastUpdateSource === 'firebase' 
                    ? `☁️ Dữ liệu Cloud (${this.cartData.count} sản phẩm)`
                    : `💾 Dữ liệu cục bộ (${this.cartData.count} sản phẩm)`;
                cartStateTooltip.textContent = tooltip;
            }
            
            // Update mobile cart count
            if (mobileCartCount) {
                mobileCartCount.textContent = this.cartData.count;
                mobileCartCount.classList.remove('firebase-data', 'local-data');
                mobileCartCount.classList.add(this.lastUpdateSource === 'firebase' ? 'firebase-data' : 'local-data');
            }
            
            // Update cart icon color to indicate data source
            if (cartIcon) {
                cartIcon.classList.remove('firebase-data', 'local-data');
                cartIcon.classList.add(this.lastUpdateSource === 'firebase' ? 'firebase-data' : 'local-data');
                cartIcon.title = this.lastUpdateSource === 'firebase' ? 'Giỏ hàng Cloud' : 'Giỏ hàng cục bộ';
            }
            
            // Update global cartItems and cartCount for compatibility
            cartItems.length = 0;
            cartItems.push(...this.cartData.items);
            cartCount = this.cartData.count;
            
            console.log('✅ SmartCartManager: Cart icon updated successfully');
        }
        
        // Clear cart data completely
        clearCart() {
            console.log('🧹 SmartCartManager: Clearing cart data');
            
            // Reset internal cart data
            this.cartData = {
                items: [],
                count: 0,
                total: 0
            };
            
            // Clear localStorage
            localStorage.removeItem('techHavenCart');
            localStorage.removeItem('techHavenCartCount');
            
            // Update global variables
            cartItems.length = 0;
            cartCount = 0;
            
            // Clear cart UI
            this.updateCartIcon({ count: 0, source: 'local', isLoggedIn: this.isLoggedIn });
            
            console.log('✅ SmartCartManager: Cart cleared successfully');
        }
    }
    
    // Initialize Smart Cart Manager
    const smartCart = new SmartCartManager();
    window.smartCart = smartCart;
    
    console.log('🧠 SmartCartManager class created and initialized');

    // =====================================
    // SHOPPING CART FUNCTIONALITY
    // =====================================

    // Get authentication token for API calls
    async function getAuthToken() {
        if (window.currentUser) {
            // For Firebase Auth users
            if (window.currentUser.provider === 'firebase' && window.firebase && window.firebase.auth && window.firebase.auth().currentUser) {
                try {
                    return await window.firebase.auth().currentUser.getIdToken();
                } catch (error) {
                    console.warn('⚠️ Could not get Firebase ID token:', error);
                }
            }
            
            // For manual users, create a simple token with user info
            if (window.currentUser.provider === 'manual' || !window.currentUser.provider) {
                return btoa(JSON.stringify({
                    uid: window.currentUser.uid,
                    email: window.currentUser.email,
                    provider: 'manual',
                    timestamp: Date.now()
                }));
            }
        }
        
        return null;
    }

    // Note: addToCart function is defined early at the top of the file to prevent overwriting
    // This comment marks where the original function was located

    // Load cart from database (for logged users)
    async function loadCartFromDatabase() {
        if (!window.currentUser) {
            console.log('No user logged in, skipping database cart load');
            return;
        }

        try {
            console.log('🔄 Loading cart from database...');
            
            // Clear local storage before loading from database (for fresh login)
            if (window.currentUser.provider === 'google') {
                console.log('🧹 Clearing local cart for Google user before database load...');
                localStorage.removeItem('techHavenCart');
                localStorage.removeItem('techHavenCartCount');
            }
            const response = await fetch(`/api/cart?uid=${window.currentUser.uid}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.cartItems) {
                    // Filter and normalize cart items
                    const validCartItems = data.cartItems.filter(item => {
                        const isValid = item && 
                            (item.productName || item.name) && 
                            (item.productName !== 'undefined' && item.name !== 'undefined') && 
                            item.productId && 
                            item.productId !== 'undefined' && 
                            (item.numericPrice || item.price || item.productPrice) &&
                            !isNaN(parseFloat(item.numericPrice || item.price || item.productPrice)) &&
                            item.quantity > 0;
                        
                        if (!isValid) {
                            console.warn('🗑️ Filtering out invalid cart item:', item);
                        }
                        return isValid;
                    }).map(item => {
                        // Normalize the item structure for consistent frontend usage
                        return {
                            id: item.id || item.cartId,
                            cartId: item.cartId || item.id,
                            productId: item.productId,
                            name: item.productName || item.name,
                            productName: item.productName || item.name,
                            price: item.productPrice || item.price || (item.numericPrice + ' VNĐ'),
                            productPrice: item.productPrice || item.price,
                            numericPrice: parseFloat(item.numericPrice || item.price || item.productPrice) || 0,
                            image: item.productImage || item.image,
                            productImage: item.productImage || item.image,
                            quantity: item.quantity || 1
                        };
                    });
                    
                    console.log('✅ Normalized cart items:', validCartItems.length, validCartItems);
                    
                    // Update global cartItems with filtered and normalized database data
                    cartItems.length = 0; // Clear existing items
                    cartItems.push(...validCartItems);
                    
                    // Recalculate cart count
                    cartCount = cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
                    
                    console.log(`✅ Cart loaded from database: ${cartItems.length} valid items, total count: ${cartCount}`);
                    updateCartUI();
                    saveCartToStorage(); // Update localStorage with fresh data
                } else {
                    // Empty cart
                    cartItems.length = 0;
                    cartCount = 0;
                    updateCartUI();
                    saveCartToStorage();
                }
            } else {
                throw new Error('Failed to load cart from database');
            }
        } catch (error) {
            console.error('❌ Error loading cart from database:', error);
            throw error;
        }
    }
    
    // Export loadCartFromDatabase for global access
    window.loadCartFromDatabase = loadCartFromDatabase;

    // Sync cart from database API (fallback function)
    async function syncCartFromAPI() {
        if (!window.currentUser) {
            console.log('No user logged in, skipping cart sync');
            return;
        }

        try {
            console.log('🔄 Syncing cart from database API...');
            const response = await fetch(`/api/cart?uid=${window.currentUser.uid}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.cartItems) {
                    // Update global cartItems with database data
                    cartItems.length = 0; // Clear existing items
                    cartItems.push(...data.cartItems);
                    
                    // Recalculate cart count
                    cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
                    
                    console.log(`✅ Cart synced from database: ${cartItems.length} items, total count: ${cartCount}`);
                    updateCartUI();
                    saveCartToStorage(); // Update localStorage with fresh data
                }
            } else {
                throw new Error('Failed to load cart from API');
            }
        } catch (error) {
            console.error('❌ Error syncing cart from API:', error);
            throw error;
        }
    }

    // Force refresh cart from database (comprehensive cleanup)
    async function forceRefreshCart() {
        if (!window.currentUser) {
            console.log('❌ No user logged in, cannot force refresh cart');
            return;
        }

        try {
            console.log('🔃 Force refreshing cart from database...');
            
            // First cleanup invalid items in database
            await cleanupInvalidCartItems();
            
            // Then reload from database with fresh data
            await loadCartFromDatabase();
            
            // Clear localStorage to prevent conflicts
            localStorage.removeItem('techHavenCart');
            localStorage.removeItem('techHavenCartCount');
            
            console.log('✅ Cart force refresh completed');
        } catch (error) {
            console.error('❌ Error during force refresh:', error);
        }
    }
    
    // Export force refresh for external use
    window.forceRefreshCart = forceRefreshCart;

    // Synchronize cart when user logs in (merge local + database)
    async function syncCartOnLogin() {
        if (!window.currentUser) {
            console.log('❌ No user logged in, cannot sync cart');
            return;
        }

        console.log('🔄 Synchronizing cart on login for user:', window.currentUser.uid);
        
        // Get local cart items and validate them
        const rawLocalCartItems = JSON.parse(localStorage.getItem('techHavenCart')) || [];
        const localCartItems = rawLocalCartItems.filter(item => {
            const isValid = item && 
                item.id && 
                item.id !== 'undefined' &&
                item.name && 
                item.name !== 'undefined' &&
                (item.numericPrice || item.price) &&
                item.quantity > 0;
            
            if (!isValid) {
                console.warn('🗑️ Filtering out invalid local cart item:', item);
            }
            return isValid;
        });
        
        console.log('📦 Valid local cart items:', localCartItems.length, 'out of', rawLocalCartItems.length);
        
        try {
            // Load existing cart from database
            const response = await fetch(`/api/cart?uid=${window.currentUser.uid}`);
            let databaseCartItems = [];
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.cartItems) {
                    databaseCartItems = data.cartItems;
                    console.log('🗄️ Database cart items:', databaseCartItems.length);
                }
            }
            
            // If user has valid local cart items, merge them with database
            if (localCartItems.length > 0) {
                console.log('🔀 Merging valid local cart with database cart...');
                
                for (const localItem of localCartItems) {
                    // Check if item already exists in database
                    const existingItem = databaseCartItems.find(dbItem => 
                        String(dbItem.productId) === String(localItem.id)
                    );
                    
                    if (existingItem) {
                        // Update quantity (add local quantity to database quantity)
                        console.log(`📈 Updating existing item ${localItem.name}: ${existingItem.quantity} + ${localItem.quantity}`);
                        
                        await fetch('/api/cart/update-quantity', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userId: window.currentUser.uid,
                                productId: localItem.id,
                                quantity: existingItem.quantity + localItem.quantity
                            })
                        });
                    } else {
                        // Add new item to database
                        console.log(`➕ Adding new item ${localItem.name} to database`);
                        
                        await fetch('/api/cart', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userId: window.currentUser.uid,
                                productId: localItem.id,
                                productName: localItem.name,
                                productPrice: localItem.price,
                                numericPrice: localItem.numericPrice,
                                productImage: localItem.image,
                                quantity: localItem.quantity
                            })
                        });
                    }
                }
                
                // Clear local storage after successful merge
                localStorage.removeItem('techHavenCart');
                localStorage.removeItem('techHavenCartCount');
                console.log('🧹 Cleared local cart after merge');
            }
            
            // Clean up any invalid cart items first
            await cleanupInvalidCartItems();
            
            // Now load the complete cart from database
            await loadCartFromDatabase();
            
            // Force UI refresh after sync
            setTimeout(() => {
                forceCartUIRefresh();
            }, 100);
            
        } catch (error) {
            console.error('❌ Error during cart synchronization:', error);
            // Fallback: just load from database
            try {
                await loadCartFromDatabase();
                setTimeout(() => {
                    forceCartUIRefresh();
                }, 100);
            } catch (fallbackError) {
                console.error('❌ Fallback load also failed:', fallbackError);
            }
        }
    }
    
    // Force cart UI refresh to ensure synchronization
    function forceCartUIRefresh() {
        console.log('🔄 Forcing cart UI refresh...');
        
        // Ensure window.cartItems and cartItems are synchronized
        if (window.cartItems && Array.isArray(window.cartItems)) {
            cartItems.length = 0;
            cartItems.push(...window.cartItems);
        }
        
        // Force update cart UI
        updateCartUI();
        
        // Also update localStorage to ensure persistence
        if (typeof saveCartToStorage === 'function') {
            saveCartToStorage();
        }
        
        console.log('✅ Cart UI refresh completed - Items:', cartItems.length, 'Count:', cartCount);
    }
    
    // Export force refresh for external use
    window.forceCartUIRefresh = forceCartUIRefresh;

    // Clean up invalid cart items from database
    async function cleanupInvalidCartItems() {
        if (!window.currentUser) {
            return;
        }

        try {
            console.log('🧹 Cleaning up invalid cart items...');
            
            // Get current cart from database
            const response = await fetch(`/api/cart?uid=${window.currentUser.uid}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.cartItems) {
                    // Find invalid items
                    const invalidItems = data.cartItems.filter(item => 
                        !item || 
                        !item.productName || 
                        item.productName === 'undefined' || 
                        !item.productId || 
                        item.productId === 'undefined' ||
                        isNaN(item.numericPrice) ||
                        item.quantity <= 0
                    );
                    
                    // Remove invalid items
                    for (const invalidItem of invalidItems) {
                        if (invalidItem.cartId) {
                            console.log('🗑️ Removing invalid cart item:', invalidItem);
                            await fetch(`/api/cart/${invalidItem.cartId}`, {
                                method: 'DELETE'
                            });
                        }
                    }
                    
                    if (invalidItems.length > 0) {
                        console.log(`✅ Cleaned up ${invalidItems.length} invalid cart items`);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error cleaning up invalid cart items:', error);
        }
    }

    // Save cart to database
    async function saveCartToDatabase() {
        if (!window.currentUser) {
            console.log('No user logged in, skipping cart save to database');
            return;
        }

        try {
            console.log('💾 Saving cart to database...');
            const response = await fetch(`/api/cart/by-uid/${window.currentUser.uid}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cartItems: cartItems,
                    total: cartItems.reduce((total, item) => total + (item.numericPrice * item.quantity), 0)
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save cart to database');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Unknown error saving cart');
            }

            console.log('✅ Cart successfully saved to database');
        } catch (error) {
            console.error('❌ Error saving cart to database:', error);
            throw error;
        }
    }

    // Remove from cart
    async function removeFromCart(productId) {
        const stringId = String(productId);
        console.log('🗑️ Removing product with ID:', stringId);
        
        // If user is logged in, work with database
        if (window.currentUser && window.currentUser.uid) {
            try {
                let headers = {
                    'Content-Type': 'application/json'
                };
                
                // Add Authorization header only for Firebase Auth users
                if (window.currentUser.provider === 'firebase') {
                    const token = await getAuthToken();
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                    }
                }
                
                // For manual users, add userId as query parameter
                const url = window.currentUser.provider === 'manual' 
                    ? `/api/cart/product/${stringId}?userId=${window.currentUser.uid}`
                    : `/api/cart/product/${stringId}`;
                
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: headers
                });
                
                if (response.ok) {
                    console.log('✅ Item removed from database successfully');
                    // Reload cart from database to update UI
                    await loadCartFromDatabase();
                } else {
                    console.error('❌ Failed to remove item from database:', await response.text());
                    showNotification('Có lỗi xảy ra khi xóa sản phẩm!', 'error');
                }
            } catch (error) {
                console.error('❌ Error removing item from database:', error);
                showNotification('Có lỗi xảy ra khi xóa sản phẩm!', 'error');
            }
        } else {
            // For non-logged users, work with local storage
            const itemIndex = cartItems.findIndex(item => 
                String(item.id) === stringId || 
                String(item.productId) === stringId
            );
            
            if (itemIndex > -1) {
                const item = cartItems[itemIndex];
                cartCount -= item.quantity;
                cartItems.splice(itemIndex, 1);
                updateCartUI();
                saveCartToStorage();
                console.log('✅ Item removed from local cart');
            } else {
                console.error('❌ Item not found with ID:', stringId);
            }
        }
    }

    // Update quantity
    async function updateCartQuantity(productId, newQuantity) {
        const stringId = String(productId);
        console.log('Updating quantity for product ID:', stringId, 'to quantity:', newQuantity);
        
        if (newQuantity <= 0) {
            // If quantity is 0 or less, remove the item
            await removeFromCart(stringId);
            return;
        }
        
        // If user is logged in, work with database
        if (window.currentUser) {
            try {
                let headers = {
                    'Content-Type': 'application/json'
                };
                
                let body = {
                    productId: stringId,
                    quantity: newQuantity
                };
                
                // Add Authorization header only for Firebase Auth users
                if (window.currentUser.provider === 'firebase') {
                    const token = await getAuthToken();
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                    }
                } else {
                    // For manual users, add userId to body
                    body.userId = window.currentUser.uid;
                }
                
                const response = await fetch(`/api/cart/update-quantity`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(body)
                });
                
                if (response.ok) {
                    console.log('✅ Quantity updated in database');
                    // Reload cart from database to update UI
                    await loadCartFromDatabase();
                } else {
                    console.error('❌ Failed to update quantity in database');
                    showNotification('Có lỗi xảy ra khi cập nhật số lượng!', 'error');
                }
            } catch (error) {
                console.error('❌ Error updating quantity in database:', error);
                showNotification('Có lỗi xảy ra khi cập nhật số lượng!', 'error');
            }
        } else {
            // For non-logged users, work with local storage
            const item = cartItems.find(item => 
                String(item.id) === stringId || 
                String(item.productId) === stringId
            );
            if (item) {
                const oldQuantity = item.quantity;
                item.quantity = newQuantity;
                cartCount += (item.quantity - oldQuantity);
                updateCartUI();
                saveCartToStorage();
                console.log('✅ Quantity updated in local cart');
            } else {
                console.error('❌ Item not found with ID:', stringId);
            }
        }
    }

    // Remove from cart by cart ID (for database-managed carts)
    async function removeFromCartById(cartId) {
        const stringCartId = String(cartId);
        console.log('🗑️ removeFromCartById called with:', {
            cartId: stringCartId,
            currentUser: window.currentUser ? window.currentUser.uid : 'not logged in'
        });
        
        // If user is logged in, work with database
        if (window.currentUser && window.currentUser.uid) {
            try {
                // DON'T set isUpdatingFromFirestore for delete operations
                // Let Firebase listener handle the real-time sync across tabs
                console.log('🔄 Not blocking Firestore listener for delete operation');
                
                console.log('🔄 Making API request to remove cart item...');
                const apiUrl = `/api/cart/${stringCartId}`;
                console.log('📡 API URL:', apiUrl);
                
                const response = await fetch(apiUrl, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                console.log('📊 Response status:', response.status);
                console.log('📊 Response ok:', response.ok);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('❌ Response error:', errorText);
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                }

                const result = await response.json();
                console.log('📋 API Response result:', result);
                
                if (!result.success) {
                    throw new Error(result.message || 'Failed to remove item from cart');
                }

                console.log('✅ Item successfully removed from database cart');
                
                // Immediately update local UI to prevent delays
                console.log('🔄 Immediately updating local UI after successful delete');
                const itemIndex = cartItems.findIndex(item => 
                    String(item.cartId || item.id || item.firebaseDocId) === stringCartId
                );
                
                if (itemIndex !== -1) {
                    const removedItem = cartItems[itemIndex];
                    cartCount -= removedItem.quantity;
                    cartItems.splice(itemIndex, 1);
                    console.log('✅ Updated local state - removed item:', removedItem.name);
                    
                    // Sync all cart systems
                    syncAllCartSystems();
                    
                    // Update UI immediately
                    updateCartUI();
                    
                    console.log('✅ Local cart state updated immediately after delete');
                } else {
                    console.log('⚠️ Item not found in local cart, refreshing from server...');
                    await loadCartFromDatabase();
                }
                
                showNotification('Đã xóa sản phẩm khỏi giỏ hàng!', 'success');

            } catch (error) {
                console.error('❌ Error removing item from database:', error);
                console.error('❌ Error stack:', error.stack);
                showNotification('Có lỗi xảy ra khi xóa sản phẩm!', 'error');
            }
        } else {
            console.log('👤 User not logged in, working with local storage');
            // For non-logged users, work with local storage
            const itemIndex = cartItems.findIndex(item => 
                String(item.id) === stringCartId || 
                String(item.cartId) === stringCartId
            );
            if (itemIndex !== -1) {
                const removedItem = cartItems[itemIndex];
                cartCount -= removedItem.quantity;
                cartItems.splice(itemIndex, 1);
                updateCartUI();
                saveCartToStorage();
                console.log('✅ Item removed from local cart');
                showNotification('Đã xóa sản phẩm khỏi giỏ hàng!', 'success');
            } else {
                console.error('❌ Item not found with cart ID:', stringCartId);
            }
        }
    }

    // Update cart quantity by cart ID (for database-managed carts) - with race condition protection
    async function updateCartQuantityById(cartId, newQuantity) {
        const stringCartId = String(cartId);
        console.log('🔧 updateCartQuantityById called with:', {
            cartId: stringCartId,
            newQuantity: newQuantity,
            currentUser: window.currentUser ? window.currentUser.uid : 'not logged in',
            pendingUpdates: Array.from(pendingQuantityUpdates.keys())
        });
        
        // Check if there's already a pending update for this cart item
        if (pendingQuantityUpdates.has(stringCartId)) {
            console.log('⏸️ Update already in progress for cart ID:', stringCartId, '- ignoring rapid click');
            return;
        }
        
        if (newQuantity <= 0) {
            console.log('⚠️ Quantity is 0 or less, removing item');
            await removeFromCartById(stringCartId);
            return;
        }
        
        // Clear any existing debounce timer for this item
        if (quantityUpdateDebounce.has(stringCartId)) {
            clearTimeout(quantityUpdateDebounce.get(stringCartId));
        }
        
        // Set debounce timer to batch rapid clicks
        const debounceTimer = setTimeout(async () => {
            // Mark this cart item as having a pending update
            pendingQuantityUpdates.set(stringCartId, newQuantity);
            console.log('⏳ Added pending update:', stringCartId, '→', newQuantity, 'Total pending:', pendingQuantityUpdates.size);
            
            // Set a safety timeout to clear this pending update if it gets stuck
            setTimeout(() => {
                if (pendingQuantityUpdates.has(stringCartId)) {
                    console.log('⚠️ Clearing stuck pending update for:', stringCartId);
                    pendingQuantityUpdates.delete(stringCartId);
                }
            }, 10000); // 10 second safety timeout
            
            try {
                // Update UI immediately for better user experience
                const item = cartItems.find(item => 
                    String(item.cartId || item.id) === stringCartId
                );
                
                // Also find item in window.cartItems if it exists
                const windowItem = window.cartItems ? window.cartItems.find(item => 
                    String(item.cartId || item.id) === stringCartId
                ) : null;
                
                if (item) {
                    const oldQuantity = item.quantity;
                    item.quantity = newQuantity;
                    cartCount += (item.quantity - oldQuantity);
                    
                    // Also update window.cartItems for consistency
                    if (windowItem) {
                        windowItem.quantity = newQuantity;
                    }
                    
                    console.log('🎯 Immediate UI update:', {
                        cartId: stringCartId,
                        oldQuantity: oldQuantity,
                        newQuantity: newQuantity,
                        newCartCount: cartCount,
                        updatedWindowItem: !!windowItem
                    });
                    updateCartUI();
                    syncAllCartSystems(); // Ensure all cart badges are synced
                }
                
                // If user is logged in, work with database
                if (window.currentUser) {
                    // Set flag to prevent infinite loop from Firestore listener
                    isUpdatingFromFirestore = true;
                    
                    console.log('🔄 Making API request to update cart quantity...');
                    const apiUrl = `/api/cart/${stringCartId}`;
                    console.log('📡 API URL:', apiUrl);
                    
                    const requestBody = { quantity: newQuantity };
                    console.log('📦 Request body:', requestBody);
                    
                    const response = await fetch(apiUrl, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    });

                    console.log('📊 Response status:', response.status);
                    console.log('📊 Response ok:', response.ok);

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('❌ Response error:', errorText);
                        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                    }

                    const result = await response.json();
                    console.log('📋 API Response result:', result);
                    
                    if (!result.success) {
                        throw new Error(result.message || 'Failed to update cart quantity');
                    }

                    console.log('✅ Quantity successfully updated in database');
                    
                    // Verify local state matches database response
                    if (item && item.quantity !== newQuantity) {
                        console.log('� Correcting local state to match database');
                        const quantityDiff = newQuantity - item.quantity;
                        item.quantity = newQuantity;
                        cartCount += quantityDiff;
                        updateCartUI();
                    }
                    
                    // Reset flag after shorter delay to allow Firebase listener to sync
                    setTimeout(() => {
                        isUpdatingFromFirestore = false;
                        console.log('🏁 Reset isUpdatingFromFirestore flag after successful update');
                    }, 200);

                } else {
                    console.log('👤 User not logged in, working with local storage');
                    // For non-logged users, just save to storage (UI already updated)
                    saveCartToStorage();
                    console.log('✅ Quantity updated in local cart');
                }
                
            } catch (error) {
                // Reset flag on error
                isUpdatingFromFirestore = false;
                console.error('❌ Error updating quantity in database:', error);
                console.error('❌ Error stack:', error.stack);
                
                // Revert UI changes on error
                if (item) {
                    console.log('� Reverting UI changes due to error');
                    await loadCartFromDatabase(); // Reload from database to get correct state
                }
                
                showNotification('Có lỗi xảy ra khi cập nhật số lượng!', 'error');
            } finally {
                // Always remove the pending update flag
                pendingQuantityUpdates.delete(stringCartId);
                quantityUpdateDebounce.delete(stringCartId);
                console.log('🏁 Quantity update completed for cart ID:', stringCartId, 'Remaining pending:', pendingQuantityUpdates.size);
                
                // Refresh UI to remove disabled state and spinner icons
                console.log('🔄 Refreshing UI to restore button states after quantity update completion');
                updateCartUI();
            }
        }, 200); // 200ms debounce delay
        
        // Store the debounce timer
        quantityUpdateDebounce.set(stringCartId, debounceTimer);
    }

    // Helper functions for Firebase listener to update local variables
    window.updateLocalCartCount = function(newCount) {
        cartCount = newCount;
        console.log('🔄 Updated local cartCount to:', newCount);
    };
    
    window.updateLocalCartItems = function(newItems) {
        cartItems.length = 0;
        cartItems.push(...newItems);
        console.log('🔄 Updated local cartItems with', newItems.length, 'items');
    };

    // Export cart functions for use in other scripts
    window.updateCartQuantityById = updateCartQuantityById;
    window.removeFromCartById = removeFromCartById;

    // Get product icon
    function getProductIcon(productName) {
        const name = productName.toLowerCase();
        if (name.includes('cpu') || name.includes('core')) return 'fas fa-microchip';
        if (name.includes('gpu') || name.includes('rtx') || name.includes('gtx')) return 'fas fa-memory';
        if (name.includes('laptop')) return 'fas fa-laptop';
        if (name.includes('monitor') || name.includes('màn hình')) return 'fas fa-desktop';
        if (name.includes('keyboard') || name.includes('bàn phím')) return 'fas fa-keyboard';
        if (name.includes('mouse') || name.includes('chuột')) return 'fas fa-mouse';
        if (name.includes('headset') || name.includes('tai nghe')) return 'fas fa-headset';
        if (name.includes('ssd') || name.includes('nvme') || name.includes('hdd')) return 'fas fa-hdd';
        if (name.includes('ram') || name.includes('memory')) return 'fas fa-memory';
        return 'fas fa-cube';
    }

    // Update cart UI
    function updateCartUI() {
        // Check if user is logged in to determine cart data source priority
        const isLoggedIn = window.currentUser !== null && window.currentUser !== undefined;
        
        // For guest users: use local cartItems first, for logged users: use window.cartItems (Firebase sync)
        const activeCartItems = isLoggedIn ? (window.cartItems || cartItems) : cartItems;
        console.log('🔄 Updating cart UI with', activeCartItems.length, 'items (user type:', isLoggedIn ? 'logged' : 'guest', ')');
        
        // Filter out invalid items but preserve Firebase items that need to be loaded
        const validCartItems = activeCartItems.filter(item => {
            // Basic validity check
            if (!item || !item.quantity || item.quantity <= 0) {
                console.warn('🗑️ Filtering out invalid item (no item or quantity):', item);
                return false;
            }
            
            // Firebase items with document ID are valid even if name/price not loaded yet
            if (item.firebaseDocId) {
                console.log('✅ Keeping Firebase item with firebaseDocId:', item.firebaseDocId);
                return true;
            }
            
            // Guest cart items (with regular id) or local items need full data validation
            const hasValidName = (item.name || item.productName) && 
                                (item.name !== 'undefined' && item.productName !== 'undefined');
            const hasValidProductId = (item.productId || item.id) && 
                                     (item.productId !== 'undefined' && item.id !== 'undefined');
            const hasValidPrice = (item.numericPrice || item.price || item.productPrice) &&
                                 !isNaN(parseFloat(item.numericPrice || item.price || item.productPrice));
            
            const isValid = hasValidName && hasValidProductId && hasValidPrice;
            
            // Debug logging for guest items
            if (!isValid) {
                console.warn('🗑️ Filtering out invalid local item:', {
                    item: item,
                    hasValidName: hasValidName,
                    hasValidProductId: hasValidProductId,
                    hasValidPrice: hasValidPrice,
                    name: item.name || item.productName,
                    productId: item.productId || item.id,
                    price: item.numericPrice || item.price || item.productPrice
                });
            } else {
                console.log('✅ Valid guest cart item:', {
                    name: item.name || item.productName,
                    productId: item.productId || item.id,
                    price: item.numericPrice || item.price || item.productPrice
                });
            }
            return isValid;
        });
        
        // Update both cart arrays with filtered items for consistency
        if (validCartItems.length !== activeCartItems.length) {
            console.log(`🧹 Cleaned ${activeCartItems.length - validCartItems.length} invalid items from cart`);
            
            // Update local cartItems
            cartItems.length = 0;
            cartItems.push(...validCartItems);
            
            // Save cleaned cart to storage
            if (typeof saveCartToStorage === 'function') {
                saveCartToStorage();
            }
            
            // Sync all systems after cleaning
            syncAllCartSystems();
        }
        
        // Sync cartCount with valid cart items to ensure consistency
        const calculatedCartCount = validCartItems.reduce((total, item) => total + (item.quantity || 1), 0);
        
        // Only update cartCount if it's significantly different (prevents overriding pending updates)
        if (Math.abs(cartCount - calculatedCartCount) > 0) {
            console.log('🔄 Syncing cartCount from', cartCount, 'to', calculatedCartCount);
            cartCount = calculatedCartCount;
            window.cartCount = cartCount;
        }
        
        console.log('📊 Cart UI Update - Items:', validCartItems.length, 'Count:', cartCount);
        
        // Update cart badge
        const cartBadge = document.getElementById('cartBadge');
        const cartCountSpan = document.getElementById('cartCount');
        // Note: cartCountSpan and mobileCartCount both refer to the same element with ID 'cartCount'
        
        if (cartBadge) {
            cartBadge.textContent = cartCount;
            cartBadge.style.display = cartCount > 0 ? 'flex' : 'none';
        }
        
        if (cartCountSpan) {
            cartCountSpan.textContent = cartCount;
        }

        // Update cart items display using validated items
        const cartItemsContainer = document.getElementById('cartItems');
        if (cartItemsContainer) {
            if (validCartItems.length === 0) {
                cartItemsContainer.innerHTML = `
                    <div class="empty-cart">
                        <i class="fas fa-shopping-cart" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                        <p>Giỏ hàng của bạn đang trống</p>
                        <small>Thêm sản phẩm để bắt đầu mua sắm</small>
                    </div>
                `;
            } else {
                cartItemsContainer.innerHTML = validCartItems.map(item => {
                    // Use cart ID (Firebase document ID) for cart operations
                    const itemId = item.cartId || item.firebaseDocId || item.id;
                    // Use product ID for product-related operations (API calls, product details)
                    let productId = item.productId; // Don't fallback to cart ID!
                    
                    // If productId is missing, this is a problem - log and use itemId as last resort
                    if (!productId) {
                        console.warn('⚠️ Missing productId for cart item:', item);
                        productId = itemId; // Last resort fallback
                    }
                    
                    // Debug log to track productId
                    console.log('🔍 Cart HTML generation debug:', {
                        itemName: item.name,
                        cartId: itemId,
                        productId: productId,
                        originalProductId: item.productId,
                        fallbackId: item.id
                    });
                    
                    // Debug data attributes
                    console.log('🔍 Cart item data attributes:', {
                        itemName: item.name,
                        itemId: itemId,
                        productId: productId,
                        originalItem: item
                    });
                    
                    console.log('🎯 Generating cart item HTML:', {
                        itemId: itemId,
                        productId: productId,
                        originalProductId: item.productId,
                        quantity: item.quantity,
                        name: item.name || item.productName,
                        firebaseDocId: item.firebaseDocId,
                        cartIdFromFirebase: item.firebaseDocId,
                        rawItem: item
                    });
                    
                    // Ensure productId is not undefined
                    if (!productId) {
                        console.error('❌ ProductId is missing for cart item:', item);
                    }
                    
                    // Check if this is a Firebase item that needs data loading
                    const hasName = item.name && item.name !== 'Loading...';
                    const hasProductName = item.productName && item.productName !== 'Loading...';
                    const hasPrice = item.price && item.price !== 'Loading...' && item.numericPrice > 0;
                    
                    const isFirebaseItem = item.firebaseDocId && (!hasName && !hasProductName);
                    const isLoadingItem = (item.name === 'Loading...' || item.price === 'Loading...' || (!hasName && !hasProductName) || !hasPrice);
                    
                    const displayName = hasName ? item.name : (hasProductName ? item.productName : (isLoadingItem ? '<span style="color: #ff6b6b;">Loading...</span>' : 'Unknown Product'));
                    const displayPrice = hasPrice ? getProductPriceDisplay(item) : '<span style="color: #ff6b6b;">Loading...</span>';
                    
                    return `
                        <div class="cart-item ${isLoadingItem ? 'loading-item' : ''}" data-product-id="${productId}" data-cart-id="${itemId}">
                            <div class="cart-item-image">
                                ${isLoadingItem ? '<i class="fas fa-spinner fa-spin" style="color: #667eea; font-size: 24px;"></i>' : getCartItemImage(item)}
                            </div>
                            <div class="cart-item-details">
                                <div class="cart-item-name">${displayName.toString()}</div>
                                <div class="cart-item-price">${displayPrice}</div>
                                <div class="cart-item-controls">
                                    <button class="quantity-btn decrease-qty" data-cart-id="${itemId}" data-current-quantity="${item.quantity}"${pendingQuantityUpdates.has(String(itemId)) ? ' disabled' : ''}>
                                        ${pendingQuantityUpdates.has(String(itemId)) ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-minus"></i>'}
                                    </button>
                                    <span class="cart-item-quantity">${item.quantity}</span>
                                    <button class="quantity-btn increase-qty" data-cart-id="${itemId}" data-current-quantity="${item.quantity}"${pendingQuantityUpdates.has(String(itemId)) ? ' disabled' : ''}>
                                        ${pendingQuantityUpdates.has(String(itemId)) ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-plus"></i>'}
                                    </button>
                                    <button class="remove-item" data-cart-id="${itemId}"${pendingQuantityUpdates.has(String(itemId)) ? ' disabled' : ''}>
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                // Always add event listeners for cart controls (works for both guest and logged users)
                console.log('🔧 updateCartUI: Setting up cart event listeners for', validCartItems.length, 'cart items');
                setupCartEventListeners();
            }
        }

        // Update cart total
        const total = calculateCartTotal();
        const cartTotalElement = document.getElementById('cartTotal');
        if (cartTotalElement) {
            cartTotalElement.textContent = formatPrice(total) + ' VNĐ';
        }

        // Update checkout button using validated cart items
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) {
            checkoutBtn.disabled = validCartItems.length === 0;
        }
        
        console.log('✅ Cart UI updated - Badge:', cartCount, 'Items:', validCartItems.length, 'Total:', formatPrice(calculateCartTotal()));
    }

    // Calculate cart total
    function calculateCartTotal() {
        // Use window.cartItems (synced from shop.ejs) if available, fallback to local cartItems
        let activeCartItems = window.cartItems || cartItems;
        
        console.log('💰 calculateCartTotal called with:', {
            windowCartItems: window.cartItems ? window.cartItems.length : 'undefined',
            localCartItems: cartItems.length,
            using: activeCartItems.length + ' items'
        });
        
        // Ensure activeCartItems is always an array
        if (!Array.isArray(activeCartItems)) {
            console.warn('⚠️ activeCartItems is not an array, defaulting to empty array');
            activeCartItems = [];
        }
        
        const total = activeCartItems.reduce((total, item) => {
            let price = 0;
            
            // Handle different price field names from different sources
            if (item.numericPrice && typeof item.numericPrice === 'number') {
                price = item.numericPrice;
            } else if (item.productPrice && typeof item.productPrice === 'number') {
                price = item.productPrice;
            } else if (item.price && typeof item.price === 'number') {
                price = item.price;
            } else if (item.price && typeof item.price === 'string') {
                price = parseInt(item.price.replace(/[^\d]/g, '')) || 0;
            } else if (item.productPrice && typeof item.productPrice === 'string') {
                price = parseInt(item.productPrice.replace(/[^\d]/g, '')) || 0;
            } else {
                // If item has firebaseDocId but no price, it might be loading
                if (item.firebaseDocId && (!item.name || !item.price)) {
                    console.log('⏳ Cart item is still loading from Firebase:', item.firebaseDocId);
                    price = 0; // Don't include in total while loading
                } else {
                    console.warn('❌ No valid price found for cart item:', item);
                    price = 0;
                }
            }
            
            const itemQuantity = item.quantity || 1;
            const itemTotal = price * itemQuantity;
            
            console.log(`💰 Item: ${item.name}, Price: ${price}, Quantity: ${itemQuantity}, Total: ${itemTotal}`);
            
            return total + itemTotal;
        }, 0);
        
        console.log('💰 calculateCartTotal result:', total);
        return total;
    }

    // Get cart item image HTML safely
    function getCartItemImage(item) {
        console.log('🖼️ Getting image for cart item:', {
            id: item.id,
            productImage: item.productImage,
            image: item.image,
            imageUrl: item.imageUrl,
            images: item.images,
            name: item.name,
            productName: item.productName
        });
        
        // Try to get image URL from different possible fields
        let imageUrl = null;
        
        // Check various image field possibilities
        if (item.image && (item.image.startsWith('http') || item.image.startsWith('/'))) {
            imageUrl = item.image;
        } else if (item.productImage && (item.productImage.startsWith('http') || item.productImage.startsWith('/'))) {
            imageUrl = item.productImage;
        } else if (item.images && Array.isArray(item.images) && item.images.length > 0) {
            imageUrl = item.images[0]; // Take first image from array
        } else if (item.imageUrl && (item.imageUrl.startsWith('http') || item.imageUrl.startsWith('/'))) {
            imageUrl = item.imageUrl;
        }
        
        if (imageUrl) {
            console.log('✅ Found image URL:', imageUrl);
            return `<img src="${imageUrl}" alt="${item.name || item.productName || 'Product'}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">`;
        } else {
            // Fallback to default cube icon
            console.log('⚠️ No image found, using default icon for item:', item);
            return `<i class="fas fa-cube" style="font-size: 2rem; color: #666;"></i>`;
        }
    }

    // Get product price display text safely
    function getProductPriceDisplay(item) {
        // Try multiple price fields in order of preference
        const priceValue = item.numericPrice || item.productPrice || item.price;
        
        if (priceValue && !isNaN(parseFloat(priceValue))) {
            return new Intl.NumberFormat('vi-VN').format(parseFloat(priceValue)) + ' VNĐ';
        } else if (typeof item.price === 'string' && item.price !== 'undefined' && item.price !== 'NaN ₫' && item.price !== 'NaN VNĐ') {
            return item.price;
        } else if (typeof item.productPrice === 'string' && item.productPrice !== 'undefined' && item.productPrice !== 'NaN ₫' && item.productPrice !== 'NaN VNĐ') {
            return item.productPrice;
        } else {
            console.warn('⚠️ No valid price found for item:', item);
            return '0 VNĐ';
        }
    }

    // Format price
    function formatPrice(price) {
        return new Intl.NumberFormat('vi-VN').format(price);
    }

    // ============================================================================
    // UNIFIED CART SYNCHRONIZATION FUNCTIONS
    // ============================================================================

    /**
     * Sync all cart badge displays across all systems
     */
    function syncAllCartSystems() {
        try {
            console.log('🔄 Syncing all cart systems with count:', cartCount);
            
            // Update all cart count elements
            const cartCountElements = [
                document.getElementById('cart-count'),
                document.getElementById('cartCount'),
                document.querySelector('.cart-badge'),
                document.querySelector('#cartBadge'),
                document.querySelector('.badge.bg-dark.text-white.ms-1.rounded-pill')
            ];
            
            cartCountElements.forEach((element, index) => {
                if (element) {
                    element.textContent = cartCount.toString();
                    // Show/hide badge based on count
                    if (cartCount > 0) {
                        element.style.display = 'inline';
                        element.classList.remove('d-none');
                    } else {
                        element.style.display = 'none';
                        element.classList.add('d-none');
                    }
                    console.log(`✅ Updated cart element ${index + 1}`);
                }
            });
            
            // Update navbar cart count specifically  
            const navbarCartCount = document.querySelector('#cart-count');
            if (navbarCartCount) {
                navbarCartCount.textContent = cartCount;
                console.log('✅ Updated navbar cart count');
            }
            
            // Trigger cart change notification for other systems
            if (typeof notifyCartChange === 'function') {
                notifyCartChange();
                console.log('✅ Triggered notifyCartChange');
            }
            
            console.log('✅ All cart systems synced successfully - count:', cartCount);
            
        } catch (error) {
            console.error('❌ Error syncing cart systems:', error);
        }
    }

    // Guest cart management functions
    window.updateGuestCartQuantity = function(itemId, newQuantity) {
        console.log('🔄 Updating guest cart quantity:', itemId, newQuantity);
        
        if (newQuantity <= 0) {
            removeGuestCartItem(itemId);
            return;
        }
        
        const itemIndex = cartItems.findIndex(item => String(item.id) === String(itemId));
        if (itemIndex !== -1) {
            cartItems[itemIndex].quantity = newQuantity;
            cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
            
            // Save to localStorage
            localStorage.setItem('techHavenCart', JSON.stringify(cartItems));
            localStorage.setItem('techHavenCartCount', cartCount.toString());
            
            // Update cart badge
            const cartBadge = document.getElementById('cartBadge');
            const mobileCartCount = document.getElementById('mobileCartCount');
            
            if (cartBadge) {
                cartBadge.textContent = cartCount;
                cartBadge.style.display = cartCount > 0 ? 'flex' : 'none';
            }
            
            if (mobileCartCount) {
                mobileCartCount.textContent = cartCount;
            }
            
            // Update the specific cart item's quantity display in UI
            const cartItemElement = document.querySelector(`[data-cart-id="${itemId}"]`).closest('.cart-item');
            if (cartItemElement) {
                const cartItemQuantitySpan = cartItemElement.querySelector('.cart-item-quantity');
                if (cartItemQuantitySpan) {
                    cartItemQuantitySpan.textContent = newQuantity;
                    console.log('🔢 Updated quantity display to:', newQuantity);
                }
                
                // Update all button data-current-quantity attributes for this item
                const cartItemButtons = cartItemElement.querySelectorAll('[data-cart-id]');
                cartItemButtons.forEach(button => {
                    if (button.hasAttribute('data-current-quantity')) {
                        button.setAttribute('data-current-quantity', newQuantity);
                        console.log('🔄 Updated button data-current-quantity to:', newQuantity, 'for button:', button.className);
                    }
                });
            }
            
            // Update cart total
            const cartTotalElement = document.getElementById('cartTotal');
            if (cartTotalElement) {
                const total = cartItems.reduce((sum, item) => {
                    let price = item.numericPrice || parseInt(item.price?.replace(/[^\d]/g, '')) || 0;
                    return sum + (price * item.quantity);
                }, 0);
                cartTotalElement.textContent = total.toLocaleString('vi-VN') + ' VNĐ';
                console.log('💰 Updated cart total:', total);
            }
            
            // Update checkout button state
            const checkoutBtn = document.getElementById('checkoutBtn');
            if (checkoutBtn) {
                checkoutBtn.disabled = cartItems.length === 0;
            }
            
            console.log('✅ Guest cart quantity updated - Items:', cartItems.length, 'Count:', cartCount);
        } else {
            console.error('❌ Item not found in cart:', itemId);
        }
    };

    window.removeGuestCartItem = function(itemId) {
        console.log('🗑️ Removing guest cart item:', itemId);
        
        const itemIndex = cartItems.findIndex(item => String(item.id) === String(itemId));
        if (itemIndex !== -1) {
            cartItems.splice(itemIndex, 1);
            cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
            
            // Save to localStorage
            localStorage.setItem('techHavenCart', JSON.stringify(cartItems));
            localStorage.setItem('techHavenCartCount', cartCount.toString());
            
            // Update cart badge
            const cartBadge = document.getElementById('cartBadge');
            const mobileCartCount = document.getElementById('mobileCartCount');
            
            if (cartBadge) {
                cartBadge.textContent = cartCount;
                cartBadge.style.display = cartCount > 0 ? 'flex' : 'none';
            }
            
            if (mobileCartCount) {
                mobileCartCount.textContent = cartCount;
            }
            
            // Remove the cart item from UI
            const cartItemElement = document.querySelector(`[data-cart-id="${itemId}"]`);
            if (cartItemElement) {
                const cartItem = cartItemElement.closest('.cart-item');
                if (cartItem) {
                    cartItem.remove();
                    console.log('🗑️ Removed cart item from UI:', itemId);
                }
            }
            
            // Update cart total
            const cartTotalElement = document.getElementById('cartTotal');
            if (cartTotalElement) {
                if (cartItems.length > 0) {
                    const total = cartItems.reduce((sum, item) => {
                        let price = item.numericPrice || parseInt(item.price?.replace(/[^\d]/g, '')) || 0;
                        return sum + (price * item.quantity);
                    }, 0);
                    cartTotalElement.textContent = total.toLocaleString('vi-VN') + ' VNĐ';
                } else {
                    cartTotalElement.textContent = '0 VNĐ';
                }
            }
            
            // Update checkout button state
            const checkoutBtn = document.getElementById('checkoutBtn');
            if (checkoutBtn) {
                checkoutBtn.disabled = cartItems.length === 0;
            }
            
            // If cart is now empty, show empty cart message
            const cartItemsContainer = document.getElementById('cartItems');
            if (cartItems.length === 0 && cartItemsContainer) {
                cartItemsContainer.innerHTML = `
                    <div class="empty-cart">
                        <i class="fas fa-shopping-cart" style="font-size: 3rem; color: #ccc;"></i>
                        <p>Giỏ hàng của bạn đang trống</p>
                    </div>
                `;
                console.log('📦 Displayed empty cart message');
            }
            
            console.log('✅ Guest cart item removed - Items:', cartItems.length, 'Count:', cartCount);
        } else {
            console.error('❌ Item not found in cart:', itemId);
        }
    };

    // Toggle cart sidebar
    function toggleCart() {
        const cartSidebar = document.getElementById('cartSidebar');
        const cartOverlay = document.getElementById('cartOverlay');
        
        if (cartSidebar && cartOverlay) {
            cartSidebar.classList.toggle('active');
            cartOverlay.classList.toggle('active');
        }
    }
    
    // Only export toggleCart if no enhanced version exists (shop.ejs may have better version)
    if (!window.toggleCart || window.toggleCart.toString().length < 200) {
        window.toggleCart = toggleCart;
    }

    // Setup cart event listeners using event delegation
    function setupCartEventListeners() {
        console.log('🔧 Setting up cart event listeners');
        
        // Remove any existing cart event listener to prevent duplicates
        const cartItemsContainer = document.getElementById('cartItems');
        if (cartItemsContainer) {
            // Always reset the event listener flag when updating UI to ensure fresh setup
            const wasAlreadyAttached = cartItemsContainer.hasAttribute('data-cart-listeners-attached');
            
            if (wasAlreadyAttached) {
                console.log('🔄 Cart event listeners already exist - will verify they work');
                
                // Verify that the existing listeners work by checking if buttons have proper data attributes
                const buttonsWithCartId = cartItemsContainer.querySelectorAll('[data-cart-id]');
                if (buttonsWithCartId.length === 0) {
                    console.log('⚠️ No buttons with data-cart-id found - forcing listener re-setup');
                    cartItemsContainer.removeAttribute('data-cart-listeners-attached');
                } else {
                    console.log('✅ Event listeners appear to be working - found', buttonsWithCartId.length, 'buttons with cart IDs');
                    return;
                }
            }
            
            console.log('✅ Setting up NEW cart event listeners with delegation');
            console.log('📊 Current cart items in container:', cartItemsContainer.children.length);
            
            // Count buttons to track what we're attaching listeners to
            const decreaseButtons = cartItemsContainer.querySelectorAll('.decrease-qty');
            const increaseButtons = cartItemsContainer.querySelectorAll('.increase-qty');
            const removeButtons = cartItemsContainer.querySelectorAll('.remove-item');
            
            console.log('🎯 Cart buttons found:', {
                decreaseButtons: decreaseButtons.length,
                increaseButtons: increaseButtons.length,
                removeButtons: removeButtons.length,
                totalCartItems: cartItemsContainer.querySelectorAll('.cart-item').length
            });
            
            // Add single event listener using event delegation
            cartItemsContainer.addEventListener('click', function(e) {
                console.log('🖱️ Cart button clicked:', e.target);
                e.preventDefault();
                e.stopPropagation();
                
                const target = e.target.closest('button');
                if (!target) {
                    console.log('❌ No button target found');
                    return;
                }
                
                // Check if button is disabled
                if (target.disabled) {
                    console.log('⏸️ Button is disabled, ignoring click');
                    return;
                }
                
                const cartId = target.getAttribute('data-cart-id');
                const productId = target.getAttribute('data-product-id') || target.closest('.cart-item').getAttribute('data-product-id');
                
                console.log('🎯 Button data:', {
                    cartId: cartId,
                    productId: productId,
                    buttonClass: target.className,
                    userType: window.currentUser ? 'logged' : 'guest',
                    tabInfo: {
                        hasPendingUpdates: pendingQuantityUpdates.size,
                        isUpdatingFromFirestore: isUpdatingFromFirestore
                    }
                });
                
                if (target.classList.contains('remove-item')) {
                    console.log('🗑️ Remove button clicked for cart ID:', cartId);
                    handleCartRemove(cartId);
                } else if (target.classList.contains('decrease-qty')) {
                    const currentQuantity = parseInt(target.getAttribute('data-current-quantity'));
                    const newQuantity = Math.max(0, currentQuantity - 1);
                    console.log('🔽 Decrease quantity clicked:');
                    console.log('  - Cart ID:', cartId);
                    console.log('  - Current quantity:', currentQuantity);
                    console.log('  - New quantity:', newQuantity);
                    
                    if (newQuantity <= 0) {
                        console.log('⚠️ Quantity is 0, removing item');
                        handleCartRemove(cartId);
                    } else {
                        console.log('📉 Updating quantity to:', newQuantity);
                        handleCartQuantityUpdate(cartId, newQuantity);
                    }
                } else if (target.classList.contains('increase-qty')) {
                    const currentQuantity = parseInt(target.getAttribute('data-current-quantity'));
                    const newQuantity = currentQuantity + 1;
                    console.log('🔼 Increase quantity clicked:');
                    console.log('  - Cart ID:', cartId);
                    console.log('  - Current quantity:', currentQuantity);
                    console.log('  - New quantity:', newQuantity);
                    console.log('📈 Updating quantity to:', newQuantity);
                    handleCartQuantityUpdate(cartId, newQuantity);
                } else {
                    console.log('❓ Unknown button clicked:', target.className);
                }
            });
            
            // Mark container as having listeners attached
            cartItemsContainer.setAttribute('data-cart-listeners-attached', 'true');
            console.log('✅ Cart event listeners attached successfully');
            console.log('🔧 Event delegation setup complete - all cart buttons should now work across tabs');
        } else {
            console.error('❌ Cart items container not found!');
        }
    }
    
    // Export setupCartEventListeners for use in other scripts
    window.setupCartEventListeners = setupCartEventListeners;
    
    // Export setupCartEventListeners for use in other scripts
    window.setupCartEventListeners = setupCartEventListeners;
    
    // Force re-setup of cart event listeners (useful for debugging cross-tab issues)
    window.forceCartEventListenersSetup = function() {
        console.log('🔧 Forcing cart event listeners re-setup...');
        const cartItemsContainer = document.getElementById('cartItems');
        if (cartItemsContainer) {
            cartItemsContainer.removeAttribute('data-cart-listeners-attached');
            setupCartEventListeners();
            console.log('✅ Cart event listeners force re-setup completed');
        } else {
            console.error('❌ Cart items container not found for force re-setup');
        }
    };

    // Show cart notification
    function showCartNotification(productName) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'cart-notification';
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>Đã thêm "${productName}" vào giỏ hàng!</span>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            z-index: 10000;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            max-width: 300px;
            font-weight: 500;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    // Export showCartNotification globally
    window.showCartNotification = showCartNotification;

    // Proceed to checkout
    function proceedToCheckout() {
        console.log('🛒 proceedToCheckout called from script.js');
        
        // Sync cart state from localStorage if needed (for guest users)
        if (!window.currentUser) {
            const savedCart = localStorage.getItem('techHavenCart');
            if (savedCart) {
                try {
                    const parsedCart = JSON.parse(savedCart);
                    cartItems = parsedCart;
                    cartCount = cartItems.reduce((total, item) => total + (item.quantity || 1), 0);
                    console.log('🔄 Synced cart from localStorage:', cartItems.length, 'items');
                } catch (e) {
                    console.error('❌ Failed to sync cart from localStorage:', e);
                }
            }
        }
        
        // Use window.cartItems (synced from shop.ejs) if available, fallback to local cartItems
        const activeCartItems = window.cartItems || cartItems;
        console.log('🛒 local cartItems.length:', cartItems.length);
        console.log('🛒 window.cartItems.length:', window.cartItems ? window.cartItems.length : 'undefined');
        console.log('🛒 using activeCartItems.length:', activeCartItems.length);
        
        if (activeCartItems.length === 0) {
            console.log('❌ Cart is empty, checkout aborted');
            alert('Giỏ hàng của bạn đang trống!');
            return;
        }
        
        // Close cart sidebar and overlay completely to avoid overlapping
        const cartSidebar = document.getElementById('cartSidebar');
        const cartOverlay = document.getElementById('cartOverlay');
        if (cartSidebar) {
            cartSidebar.classList.remove('active');
            console.log('🔄 Cart sidebar closed before opening checkout');
        }
        if (cartOverlay) {
            cartOverlay.classList.remove('active');
            console.log('🔄 Cart overlay closed before opening checkout');
        }
        
        const checkoutModal = document.getElementById('checkoutModal');
        console.log('🔍 checkoutModal element:', checkoutModal);
        
        if (checkoutModal) {
            console.log('✅ Modal found, adding active class');
            checkoutModal.classList.add('active');
            console.log('🔍 Modal classes after add:', checkoutModal.className);
            console.log('🔍 Modal style display:', checkoutModal.style.display);
            console.log('🔍 Modal computed display:', window.getComputedStyle(checkoutModal).display);
            
            updateOrderSummary();
            // Auto-fill user information if logged in
            fillUserInformationIfLoggedIn();
            
            // Load addresses (including guest temp address)
            if (typeof window.loadUserAddresses === 'function') {
                console.log('📍 Loading user addresses (including guest temp)');
                window.loadUserAddresses();
            }
        } else {
            console.error('❌ checkoutModal element not found in DOM!');
        }
    }

    // Close checkout modal
    function closeCheckoutModal() {
        const checkoutModal = document.getElementById('checkoutModal');
        if (checkoutModal) {
            checkoutModal.classList.remove('active');
            console.log('🔄 Checkout modal closed');
        }
        
        // Also remove any remaining overlay effects
        const overlays = document.querySelectorAll('.modal-overlay.active');
        overlays.forEach(overlay => {
            if (overlay.id === 'checkoutModal') {
                overlay.classList.remove('active');
                console.log('🔄 Checkout modal overlay removed');
            }
        });
        
        // Ensure body scroll is restored
        document.body.style.overflow = '';
    }

    // Update order summary
    function updateOrderSummary() {
        const orderSummaryItems = document.getElementById('orderSummaryItems');
        const subtotalAmount = document.getElementById('subtotalAmount');
        const finalTotal = document.getElementById('finalTotal');
        
        // Use window.cartItems (synced from shop.ejs) if available, fallback to local cartItems
        const activeCartItems = window.cartItems || cartItems;
        console.log('📋 updateOrderSummary - using activeCartItems.length:', activeCartItems.length);
        
        if (orderSummaryItems) {
            console.log('📦 Cart items for order summary:', activeCartItems);
            orderSummaryItems.innerHTML = activeCartItems.map(item => {
                console.log('🛒 Processing cart item:', item);
                
                // Get safe price value
                let priceValue = 0;
                if (item.numericPrice && typeof item.numericPrice === 'number') {
                    priceValue = item.numericPrice;
                } else if (item.productPrice && typeof item.productPrice === 'number') {
                    priceValue = item.productPrice;
                } else if (item.price && typeof item.price === 'string') {
                    priceValue = parseInt(item.price.replace(/[^\d]/g, '')) || 0;
                } else if (item.price && typeof item.price === 'number') {
                    priceValue = item.price;
                } else if (item.productPrice && typeof item.productPrice === 'string') {
                    priceValue = parseInt(item.productPrice.replace(/[^\d]/g, '')) || 0;
                } else {
                    console.warn('❌ No valid price found for item:', item);
                    priceValue = 0;
                }
                
                const quantity = item.quantity || 1;
                const itemTotal = priceValue * quantity;
                
                console.log(`💰 Item: ${item.name}, Price: ${priceValue}, Quantity: ${quantity}, Total: ${itemTotal}`);
                
                return `
                    <div class="order-item">
                        <span class="order-item-name">${item.name || 'Unknown Product'} x${quantity}</span>
                        <span class="order-item-price">${formatPrice(itemTotal)} VNĐ</span>
                    </div>
                `;
            }).join('');
        }
        
        const subtotal = calculateCartTotal();
        const shipping = subtotal > 0 ? 50000 : 0;
        const total = subtotal + shipping;
        
        console.log('📊 Order Summary calculations:', {
            subtotal: subtotal,
            shipping: shipping,
            total: total,
            formattedSubtotal: formatPrice(subtotal),
            formattedTotal: formatPrice(total)
        });
        
        if (subtotalAmount) {
            subtotalAmount.textContent = formatPrice(subtotal) + ' VNĐ';
            console.log('✅ Updated subtotalAmount element');
        } else {
            console.warn('❌ subtotalAmount element not found');
        }
        
        if (finalTotal) {
            finalTotal.textContent = formatPrice(total) + ' VNĐ';
            console.log('✅ Updated finalTotal element');
        } else {
            console.warn('❌ finalTotal element not found');
        }
        
        // Update shipping amount
        const shippingAmount = document.getElementById('shippingAmount');
        if (shippingAmount) shippingAmount.textContent = formatPrice(shipping) + ' VNĐ';
        
        console.log('📊 Order summary updated - Subtotal:', formatPrice(subtotal), 'Total:', formatPrice(total));
    }
    
    // Expose functions globally for shop.ejs
    window.updateOrderSummary = updateOrderSummary;
    window.calculateCartTotal = calculateCartTotal;

    // Complete order
    async function completeOrder() {
        try {
            console.log('🛒 Completing order...');
            
            // Set flag to prevent cart clearing during checkout
            window.checkoutInProgress = true;
            
            // Check if user is logged in or needs OTP verification
        if (!window.currentUser) {
            console.log('🔐 Guest user detected - checking OTP verification');
            
            // Get customer email from form
            const customerEmailEl = document.getElementById('customerEmail');
            const customerEmail = customerEmailEl ? customerEmailEl.value : '';
            
            if (!customerEmail) {
                alert('Vui lòng nhập email để tiếp tục');
                customerEmailEl?.focus();
                return;
            }
            
            // Check if OTP is verified for this specific email and still valid
            const isOtpValid = window.otpVerificationResult && 
                               window.otpVerificationResult.email === customerEmail &&
                               window.otpVerificationResult.success === true &&
                               window.otpVerificationResult.validUntil &&
                               Date.now() < window.otpVerificationResult.validUntil;
            
            if (!isOtpValid) {
                // Clear expired OTP verification
                if (window.otpVerificationResult && Date.now() >= window.otpVerificationResult.validUntil) {
                    console.log('🕒 OTP verification expired, clearing...');
                    window.otpVerificationResult = null;
                }
                console.log('🔐 OTP verification required for email:', customerEmail);
                
                // Show OTP modal for guest checkout
                if (typeof window.showOtpModal === 'function') {
                    window.showOtpModal(customerEmail);
                } else {
                    alert('Tính năng xác thực OTP không khả dụng');
                }
                return;
            } else {
                console.log('✅ OTP already verified for email:', customerEmail);
            }
        }
        
        // Get form elements with error handling
        const customerNameEl = document.getElementById('customerName');
        const customerPhoneEl = document.getElementById('customerPhone');
        const customerEmailEl = document.getElementById('customerEmail');
        const paymentMethodEl = document.querySelector('input[name="paymentMethod"]:checked');

        // Check if basic elements exist
        if (!customerNameEl || !customerPhoneEl || !customerEmailEl) {
            console.error('Basic form elements are missing!');
            alert('Có lỗi xảy ra với form. Vui lòng thử lại!');
            return;
        }

        // Get basic values
        const customerName = customerNameEl.value;
        const customerPhone = customerPhoneEl.value;
        const customerEmail = customerEmailEl.value;
        const paymentMethod = paymentMethodEl ? paymentMethodEl.value : 'cash';
        
        // Check shipping address - either selected or new input
        const selectedAddressDisplay = document.getElementById('selectedAddressDisplay');
        const isUsingSelectedAddress = selectedAddressDisplay && selectedAddressDisplay.style.display !== 'none';
        
        let shippingAddress, shippingCity, shippingDistrict, shippingCoordinates = null;
        
        if (isUsingSelectedAddress) {
            // User is using a pre-selected address
            const selectedAddressText = document.getElementById('selectedAddressText');
            if (selectedAddressText) {
                const addressText = selectedAddressText.textContent || selectedAddressText.innerText;
                // Extract address info from the display text
                const addressLines = addressText.split('\n').map(line => line.trim()).filter(line => line);
                if (addressLines.length >= 2) {
                    shippingAddress = addressLines[0].replace(/<\/?strong>/g, '');
                    const cityDistrict = addressLines[1];
                    const parts = cityDistrict.split(',').map(part => part.trim());
                    if (parts.length >= 2) {
                        shippingDistrict = parts[0];
                        shippingCity = parts[1];
                    } else {
                        shippingCity = cityDistrict;
                        shippingDistrict = '';
                    }
                } else {
                    shippingAddress = addressText.replace(/<\/?strong>/g, '');
                    shippingCity = 'N/A';
                    shippingDistrict = 'N/A';
                }
                
                // Get coordinates from selected address
                if (window.selectedAddress !== null && window.userAddresses && window.userAddresses[window.selectedAddress]) {
                    const selectedAddr = window.userAddresses[window.selectedAddress];
                    if (selectedAddr.coordinates) {
                        shippingCoordinates = selectedAddr.coordinates;
                        console.log('📍 Using coordinates from selected address:', shippingCoordinates);
                    } else {
                        console.log('⚠️ Selected address has no coordinates');
                    }
                }
                
                console.log('📍 Using selected address:', { shippingAddress, shippingCity, shippingDistrict, coordinates: shippingCoordinates });
            } else {
                alert('Không thể lấy thông tin địa chỉ đã chọn. Vui lòng thử lại!');
                return;
            }
        } else {
            // User is entering new address OR no address selected
            const shippingAddressEl = document.getElementById('newShippingAddress');
            const shippingCityEl = document.getElementById('newShippingCity');
            const shippingDistrictEl = document.getElementById('newShippingDistrict');
            
            // For guest users, check if temp address exists in localStorage
            if (!window.currentUser) {
                const tempAddressStr = localStorage.getItem('guestTempAddress');
                if (tempAddressStr) {
                    try {
                        const tempAddress = JSON.parse(tempAddressStr);
                        shippingAddress = tempAddress.address;
                        shippingCity = tempAddress.city;
                        shippingDistrict = tempAddress.district;
                        shippingCoordinates = tempAddress.coordinates || null;
                        console.log('📍 Using guest temp address from localStorage:', { shippingAddress, shippingCity, shippingDistrict, coordinates: shippingCoordinates });
                    } catch (e) {
                        console.error('❌ Error parsing guest temp address:', e);
                    }
                }
            }
            
            // If temp address not loaded, get from form fields
            if (!shippingAddress) {
                if (!shippingAddressEl || !shippingCityEl || !shippingDistrictEl) {
                    console.error('New address form elements are missing!');
                    alert('Có lỗi xảy ra với form địa chỉ. Vui lòng thử lại!');
                    return;
                }
                
                shippingAddress = shippingAddressEl.value;
                shippingCity = shippingCityEl.value;
                shippingDistrict = shippingDistrictEl.value;
                
                // Get coordinates from verified address (if user verified before checkout)
                if (window.verifiedCoordinates) {
                    shippingCoordinates = window.verifiedCoordinates;
                    console.log('📍 Using verified coordinates from new address:', shippingCoordinates);
                } else {
                    console.log('⚠️ New address has no verified coordinates');
                }
                
                console.log('📝 Using new address:', { shippingAddress, shippingCity, shippingDistrict, coordinates: shippingCoordinates });
            }
        }
        
        // Validate required fields
        if (!customerName || !customerPhone || !customerEmail || !shippingAddress || !shippingCity) {
            alert('Vui lòng điền đầy đủ thông tin!');
            return;
        }
        
        // Check if payment method is VNPay
        if (paymentMethod === 'vnpay') {
            console.log('💳 Processing VNPay payment');
            
            // For guest users, verify OTP before proceeding with VNPay
            if (!window.currentUser) {
                console.log('👤 Guest user detected for VNPay, checking OTP verification');
                
                // Check if OTP has been verified for this email
                try {
                    const otpResponse = await fetch(`/api/guest-checkout/otp-status/${encodeURIComponent(customerEmail)}`);
                    const otpResult = await otpResponse.json();
                    
                    if (!otpResult.success || !otpResult.verified) {
                        alert('Vui lòng xác thực OTP trước khi sử dụng VNPay. Nhấn "Xác thực OTP" để tiếp tục.');
                        return;
                    }
                    
                    console.log('✅ Guest OTP verified, proceeding with VNPay');
                } catch (error) {
                    console.error('❌ Error checking OTP status:', error);
                    alert('Có lỗi xảy ra khi kiểm tra xác thực. Vui lòng thử lại.');
                    return;
                }
            } else {
                console.log('💳 Processing VNPay payment for logged user');
            }
            
            // Prepare order data for VNPay
            const orderTotal = calculateCartTotal() + 50000; // Include shipping
            const activeCartItems = window.cartItems || cartItems;
            
            if (activeCartItems.length === 0) {
                alert('Giỏ hàng trống!');
                return;
            }
            
            const orderInfo = `Thanh toan don hang Tech Haven - ${customerName}`;
            
            const paymentData = {
                amount: orderTotal,
                orderInfo: orderInfo,
                orderType: 'billpayment',
                userId: window.currentUser ? window.currentUser.uid : null,
                isGuest: !window.currentUser,
                cartData: activeCartItems.map(item => ({
                    productId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity || 1,
                    image: item.image || item.imageUrl
                })),
                customerInfo: {
                    name: customerName,
                    phone: customerPhone,
                    email: customerEmail,
                    address: shippingAddress,
                    city: shippingCity,
                    district: shippingDistrict
                }
            };
            
            try {
                console.log('🔄 Creating VNPay payment URL...');
                
                // Show loading
                const loadingOverlay = document.createElement('div');
                loadingOverlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10001;
                    color: white;
                    font-size: 1.2rem;
                `;
                loadingOverlay.innerHTML = `
                    <div style="text-align: center;">
                        <div style="width: 50px; height: 50px; border: 3px solid #fff; border-top: 3px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
                        <div>Đang chuyển đến VNPay...</div>
                    </div>
                `;
                
                // Add spin animation
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
                document.body.appendChild(loadingOverlay);
                
                const response = await fetch('/api/vnpay/create-payment', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(paymentData)
                });
                
                const result = await response.json();
                
                // Remove loading
                document.body.removeChild(loadingOverlay);
                document.head.removeChild(style);
                
                if (result.success) {
                    console.log('✅ VNPay URL created, redirecting...');
                    // Clear checkout flag before redirect (page will reload)
                    window.checkoutInProgress = false;
                    // Close checkout modal before redirect
                    closeCheckoutModal();
                    // Redirect to VNPay
                    window.location.href = result.paymentUrl;
                    return;
                } else {
                    console.error('❌ VNPay payment creation failed:', result);
                    alert('Lỗi tạo thanh toán VNPay: ' + (result.message || 'Unknown error'));
                    return;
                }
            } catch (error) {
                console.error('❌ VNPay payment error:', error);
                // Clear checkout flag on error
                window.checkoutInProgress = false;
                // Remove loading on error
                const loadingOverlay = document.querySelector('[style*="rgba(0,0,0,0.8)"]');
                if (loadingOverlay) {
                    try {
                        document.body.removeChild(loadingOverlay);
                    } catch (e) {
                        // Ignore if already removed
                    }
                }
                alert('Lỗi kết nối VNPay: ' + error.message);
                return;
            }
        }
        
        // Continue with normal payment flow for cash or guest users
        console.log('💰 Processing normal payment flow');
        
        // Simulate order processing
        const loadingOverlay = document.createElement('div');
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            color: white;
            font-size: 1.2rem;
        `;
        loadingOverlay.innerHTML = `
            <div style="text-align: center;">
                <div style="width: 50px; height: 50px; border: 3px solid #fff; border-top: 3px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
                <div>Đang xử lý đơn hàng...</div>
            </div>
        `;
        
        // Add spin animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(loadingOverlay);
        
        // Simulate processing time
        setTimeout(async () => {
            document.body.removeChild(loadingOverlay);
            document.head.removeChild(style);

            // Track coupon usage if coupon was applied
            const appliedCoupon = window.currentAppliedCoupon;
            if (appliedCoupon) {
                try {
                    // Get user token and user ID from current user or OTP verification
                    let token = null;
                    let userId = null;
                    
                    if (window.currentUser && window.currentUser.uid) {
                        userId = window.currentUser.uid;
                        
                        // Try to get Firebase ID token if available
                        if (window.getIdToken && typeof window.getIdToken === 'function') {
                            try {
                                token = await window.getIdToken();
                            } catch (error) {
                                console.warn('Could not get Firebase token, using fallback auth');
                            }
                        }
                        
                        // Fallback to stored auth tokens
                        if (!token) {
                            token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || 'fallback-token';
                        }
                    } else if (window.otpVerificationResult && window.otpVerificationResult.userId) {
                        // Use OTP verified user
                        userId = window.otpVerificationResult.userId;
                        token = window.otpVerificationResult.customToken || 'otp-verified-token';
                        console.log('💾 Using OTP verified user for coupon:', userId);
                    }
                    
                    if (token && userId) {
                        console.log('💾 Saving coupon usage for user:', userId);
                        
                        // Use window.cartItems (synced from shop.ejs) if available, fallback to local cartItems
                        const activeCartItems = window.cartItems || cartItems;
                        console.log('📝 completeOrder - using activeCartItems.length:', activeCartItems.length);
                        
                        const orderData = {
                            customerName,
                            customerPhone,
                            customerEmail,
                            shippingAddress,
                            shippingCity,
                            shippingDistrict,
                            paymentMethod,
                            cartItems: activeCartItems,
                            orderTotal: calculateCartTotal() + 50000,
                            orderDate: new Date().toISOString()
                        };
                        
                        const response = await fetch('/api/coupon-usage', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                couponId: appliedCoupon.id,
                                userId: userId,
                                orderData: orderData
                            })
                        });

                        if (response.ok) {
                            const usageResult = await response.json();
                            console.log('✅ Coupon usage saved successfully:', usageResult);
                            
                            // Store couponUserId for bill creation
                            if (usageResult.couponUserId) {
                                window.currentCouponUserId = usageResult.couponUserId;
                                console.log('💾 Stored couponUserId:', usageResult.couponUserId);
                            }
                        } else {
                            const errorData = await response.json();
                            console.warn('⚠️ Failed to save coupon usage:', errorData.error);
                        }
                    } else {
                        console.warn('⚠️ No user token or ID found, cannot save coupon usage');
                    }
                } catch (error) {
                    console.warn('⚠️ Error saving coupon usage:', error);
                }

                // Clear applied coupon
                window.currentAppliedCoupon = null;
            }
            
            // Create bill BEFORE processing order completion (which clears cart)
            // Get final total from UI (includes discount calculation)
            const finalTotalElement = document.getElementById('finalTotal');
            let finalOrderTotal = calculateCartTotal() + 50000; // Default fallback
            
            if (finalTotalElement) {
                const finalTotalText = finalTotalElement.textContent || finalTotalElement.innerText;
                // Extract number from text like "80.000 VNĐ"
                const totalMatch = finalTotalText.match(/([\d.,]+)/);
                if (totalMatch) {
                    const uiTotal = parseFloat(totalMatch[1].replace(/[.,]/g, ''));
                    if (uiTotal > 0) {
                        finalOrderTotal = uiTotal;
                        console.log('💰 Using UI final total for bill:', {
                            uiTotal: uiTotal,
                            calculatedTotal: calculateCartTotal() + 50000,
                            finalTotalText: finalTotalText
                        });
                    }
                }
            }
            
            // Use window.cartItems (synced from shop.ejs) if available, fallback to local cartItems
            const activeCartItemsForBill = window.cartItems || cartItems;
            console.log('📝 createBill - Debug info (BEFORE order completion):');
            console.log('  - activeCartItemsForBill.length:', activeCartItemsForBill.length);
            console.log('  - calculateCartTotal():', calculateCartTotal());
            console.log('  - finalOrderTotal (from UI):', finalOrderTotal);
            console.log('  - currentUser:', window.currentUser);
            console.log('  - otpVerificationResult:', window.otpVerificationResult);
            console.log('  - activeCartItemsForBill full data:', JSON.stringify(activeCartItemsForBill, null, 2));
            console.log('  - cartItems (local):', JSON.stringify(cartItems, null, 2));
            console.log('  - window.cartItems:', window.cartItems ? JSON.stringify(window.cartItems, null, 2) : 'undefined');
            console.log('  - appliedCoupon:', appliedCoupon);
            
            // Only create bill if we have products and valid total
            if (activeCartItemsForBill.length > 0 && finalOrderTotal > 0) {
                // Robust userId determination
                let billUserId = 'guest';
                if (window.currentUser && window.currentUser.uid) {
                    billUserId = window.currentUser.uid;
                } else if (window.otpVerificationResult && window.otpVerificationResult.userId) {
                    billUserId = window.otpVerificationResult.userId;
                } else if (window.currentUser && typeof window.currentUser === 'string') {
                    billUserId = window.currentUser;
                }
                
                // Ensure userId is valid
                if (!billUserId || billUserId === 'undefined' || billUserId === '') {
                    billUserId = 'guest';
                }
                
                // Robust products mapping with extensive validation
                const billProducts = activeCartItemsForBill.map((item, index) => {
                    console.log(`📦 Processing product ${index}:`, item);
                    
                    // Extract product ID - PRIORITIZE productId field (actual product ID) over id field (cart document ID)
                    let productId = item.productId || item.id || item._id || item.docId;
                    if (!productId && item.data && item.data.productId) productId = item.data.productId;
                    if (!productId && item.data && item.data.id) productId = item.data.id;
                    
                    // Extract product name
                    let productName = item.name || item.productName || item.title;
                    if (!productName && item.data && item.data.name) productName = item.data.name;
                    
                    // Extract product price with multiple fallbacks
                    let productPrice = 0;
                    if (item.price) {
                        if (typeof item.price === 'string') {
                            productPrice = parseFloat(item.price.replace(/[^\d]/g, ''));
                        } else if (typeof item.price === 'number') {
                            productPrice = item.price;
                        }
                    } else if (item.productPrice) {
                        if (typeof item.productPrice === 'string') {
                            productPrice = parseFloat(item.productPrice.replace(/[^\d]/g, ''));
                        } else if (typeof item.productPrice === 'number') {
                            productPrice = item.productPrice;
                        }
                    } else if (item.numericPrice) {
                        productPrice = item.numericPrice;
                    } else if (item.data && item.data.price) {
                        if (typeof item.data.price === 'string') {
                            productPrice = parseFloat(item.data.price.replace(/[^\d]/g, ''));
                        } else if (typeof item.data.price === 'number') {
                            productPrice = item.data.price;
                        }
                    }
                    
                    // Extract quantity
                    let productQuantity = item.quantity || 1;
                    if (typeof productQuantity !== 'number' || productQuantity <= 0) {
                        productQuantity = 1;
                    }
                    
                    console.log(`📦 Mapped product ${index}:`, {
                        id: productId,
                        name: productName,
                        price: productPrice,
                        quantity: productQuantity
                    });
                    
                    return {
                        id: productId || `unknown-${index}`,
                        name: productName || 'Unknown Product',
                        price: productPrice,
                        quantity: productQuantity
                    };
                }).filter(product => {
                    // Filter out invalid products
                    const isValid = product.id && product.name && product.price > 0 && product.quantity > 0;
                    if (!isValid) {
                        console.warn('⚠️ Filtering out invalid product:', product);
                    }
                    return isValid;
                });
                
                // Ensure totalAmount is a number
                let billTotalAmount = finalOrderTotal;
                if (typeof billTotalAmount !== 'number' || billTotalAmount <= 0) {
                    billTotalAmount = calculateCartTotal() + 50000;
                    console.log('🔄 Using fallback total amount:', billTotalAmount);
                }
                
                // Check for guest temp address in localStorage
                let guestTempAddress = null;
                try {
                    const tempAddressStr = localStorage.getItem('guestTempAddress');
                    if (tempAddressStr) {
                        guestTempAddress = JSON.parse(tempAddressStr);
                        console.log('📍 Found guestTempAddress in localStorage for bill:', guestTempAddress);
                    }
                } catch (error) {
                    console.error('❌ Error parsing guestTempAddress:', error);
                }
                
                // Get coin usage data if available
                let coinUsed = 0;
                if (typeof getCoinUsageData === 'function') {
                    try {
                        const coinData = getCoinUsageData();
                        coinUsed = coinData?.coinUsed || 0;
                        console.log('💰 Coin usage data:', coinData);
                    } catch (error) {
                        console.warn('⚠️ Error getting coin usage data:', error);
                    }
                }
                
                const billData = {
                    userId: billUserId,
                    products: billProducts,
                    totalAmount: billTotalAmount,
                    coinUsed: coinUsed, // Add coin usage to bill
                    couponUserId: appliedCoupon ? (window.currentCouponUserId || appliedCoupon.couponUserId) : null,
                    guestTempAddress: guestTempAddress, // Add guest temp address to bill
                    customerInfo: {
                        name: customerName,
                        phone: customerPhone,
                        email: customerEmail,
                        address: shippingAddress,
                        city: shippingCity,
                        district: shippingDistrict,
                        paymentMethod: paymentMethod
                    },
                    // Add individual customer fields for easier access
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone,
                    address: `${shippingAddress}, ${shippingDistrict}, ${shippingCity}`,
                    coordinates: shippingCoordinates // Add coordinates to bill
                };
                
                console.log('📋 Final bill data to send (BEFORE order completion):', billData);
                console.log('📋 Bill validation summary:');
                console.log('  - userId:', billData.userId);
                console.log('  - products count:', billData.products.length);
                console.log('  - totalAmount:', billData.totalAmount);
                console.log('  - coordinates:', shippingCoordinates ? `(${shippingCoordinates.lat}, ${shippingCoordinates.lng})` : 'None');
                console.log('  - guestTempAddress:', billData.guestTempAddress ? 'YES ✅' : 'NO ❌');
                
                // Only proceed if we have valid data
                if (billData.userId && billData.products.length > 0 && billData.totalAmount > 0) {
                    await createBill(billData);
                } else {
                    console.error('❌ Invalid bill data, skipping bill creation:', billData);
                }
            } else {
                console.warn('⚠️ Skipping bill creation - no products or invalid total');
                console.log('  - activeCartItemsForBill.length:', activeCartItemsForBill.length);
                console.log('  - finalOrderTotal:', finalOrderTotal);
            }
            
            // THEN process order completion (which will clear cart)
            try {
                const userId = window.currentUser?.uid;
                if (userId && cartItems.length > 0) {
                    console.log('🛒 Processing order completion...');
                    
                    // Prepare order items with product IDs and quantities
                    const orderItems = cartItems.map(item => ({
                        productId: item.productId || item.id, // PRIORITIZE productId (actual product) over id (cart doc)
                        quantity: item.quantity || 1,
                        name: item.name,
                        price: item.price
                    }));
                    
                    const response = await fetch('/api/order/complete', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userId: userId,
                            orderItems: orderItems
                        })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log('✅ Order completion processed:', result.message);
                        console.log(`📦 Processed ${result.itemsProcessed} items`);
                    } else {
                        const errorData = await response.json();
                        console.warn('⚠️ Failed to process order completion:', errorData.error);
                    }
                } else {
                    console.log('ℹ️ Skipping order completion: no user or empty cart');
                }
            } catch (error) {
                console.warn('⚠️ Error processing order completion:', error);
            }
            
            // Show Lottie congratulations animation for normal payment
            console.log('🎉 Showing congratulation animation for normal payment (script.js)');
            
            // Use the same finalOrderTotal that was used for bill creation (includes discount)
            const orderNumber = `TH${Date.now()}`;
            
            // Check if showCongratulationAnimation function is available from shop.ejs
            if (typeof window.showCongratulationAnimation === 'function') {
                try {
                    window.showCongratulationAnimation(() => {
                        console.log('✅ Normal payment congratulation animation completed (script.js)');
                        // Show success notification after animation
                        showSuccessNotification(finalOrderTotal, orderNumber);
                    });
                } catch (error) {
                    console.error('❌ Error showing congratulation animation (script.js):', error);
                    // Fallback: show notification without animation
                    showSuccessNotification(finalOrderTotal, orderNumber);
                }
            } else {
                console.warn('⚠️ showCongratulationAnimation function not available, showing notification directly');
                // Fallback: show notification without animation
                showSuccessNotification(finalOrderTotal, orderNumber);
            }
            
            // Function to show success notification
            function showSuccessNotification(orderTotal, orderNumber) {
                const successNotification = document.createElement('div');
                successNotification.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: linear-gradient(135deg, #4CAF50, #45a049);
                    color: white;
                    padding: 30px 40px;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    z-index: 10002;
                    text-align: center;
                    font-family: 'Inter', sans-serif;
                    max-width: 400px;
                    width: 90%;
                `;
                
                successNotification.innerHTML = `
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
                    <h3 style="margin: 0 0 1rem 0; font-size: 1.5rem; font-weight: 600;">Thanh toán thành công!</h3>
                    <p style="margin: 0.5rem 0; opacity: 0.9;">Mã đơn hàng: <strong>${orderNumber}</strong></p>
                    <p style="margin: 0.5rem 0; opacity: 0.9;">Tổng tiền: <strong>${formatPrice(orderTotal)} VNĐ</strong></p>
                    <p style="margin: 1rem 0 0 0; font-size: 0.9rem; opacity: 0.8;">Chúng tôi sẽ liên hệ với bạn trong vòng 24h để xác nhận đơn hàng.</p>
                    <button onclick="this.parentElement.remove()" style="
                        margin-top: 1.5rem;
                        padding: 10px 20px;
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.3);
                        border-radius: 8px;
                        color: white;
                        cursor: pointer;
                        font-size: 0.9rem;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                        Đóng
                    </button>
                `;
                
                document.body.appendChild(successNotification);
                
                // Auto remove after 5 seconds
                setTimeout(() => {
                    if (successNotification.parentElement) {
                        successNotification.remove();
                    }
                }, 5000);
            }
            
            // Reset cart and close modal
            cartItems = [];
            cartCount = 0;
            
            // Also clear synced cart data
            if (window.cartItems) {
                window.cartItems = [];
            }
            if (window.cart) {
                window.cart = [];
            }
            
            // Clear cart in Firebase if user is logged in
            if (window.currentUser) {
                try {
                    // Try to get Firebase ID token for Google users
                    let token = null;
                    if (window.getIdToken) {
                        try {
                            token = await window.getIdToken();
                        } catch (error) {
                            console.log('⚠️ Could not get Firebase ID token, using fallback');
                        }
                    }
                    
                    if (token) {
                        // Google user - use Firebase auth endpoint
                        await window.clearCartInFirebase(token);
                        console.log('🔥 Firebase cart cleared (Google user)');
                    } else if (window.currentUser.uid) {
                        // Manual user - use UID endpoint
                        const response = await fetch(`/api/cart/by-uid/${encodeURIComponent(window.currentUser.uid)}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (response.ok) {
                            console.log('🔥 Firebase cart cleared (Manual user)');
                        } else {
                            console.log('ℹ️ Could not clear Firebase cart (maybe empty)');
                        }
                    }
                } catch (error) {
                    console.error('❌ Error clearing cart in Firebase:', error);
                }
            }
            
            // Clear localStorage cart data and set to empty
            cartItems = [];  // Clear global cart array FIRST
            cartCount = 0;
            localStorage.setItem('techHavenCart', JSON.stringify([]));  // Set empty array
            localStorage.setItem('techHavenCartCount', '0');
            
            updateCartUI();
            // DON'T call saveCartToStorage() here - it would trigger saveCartToFirebase() with stale data!
            
            // Sync cart everywhere to ensure all systems are updated
            if (window.syncCartEverywhere) {
                window.syncCartEverywhere();
            }
            
            // Force refresh cart UI from shop.ejs if available
            if (window.forceUpdateCartUI) {
                window.forceUpdateCartUI();
            }
            
            // Also refresh cart from Firebase to double-check it's empty
            if (window.loadCart) {
                await window.loadCart();
            }
            
            closeCheckoutModal();
            
            // Reset form
            if (document.getElementById('customerName')) document.getElementById('customerName').value = '';
            if (document.getElementById('customerPhone')) document.getElementById('customerPhone').value = '';
            if (document.getElementById('customerEmail')) document.getElementById('customerEmail').value = '';
            
            // Reset new address form if exists
            if (document.getElementById('newShippingAddress')) document.getElementById('newShippingAddress').value = '';
            if (document.getElementById('newShippingCity')) document.getElementById('newShippingCity').value = '';
            if (document.getElementById('newShippingDistrict')) document.getElementById('newShippingDistrict').value = '';
            
            // Clear OTP verification result after successful order completion
            // This ensures each order requires fresh OTP verification for security
            if (window.otpVerificationResult) {
                console.log('🔐 Clearing OTP verification for email:', window.otpVerificationResult.email);
                window.otpVerificationResult = null;
                console.log('✅ OTP verification cleared - next order will require new OTP verification');
            }
            
            // Clear checkout flag after successful completion
            window.checkoutInProgress = false;
            console.log('✅ Checkout completed successfully');
            
        }, 2000);
        
    } catch (error) {
        console.error('❌ Checkout error:', error);
        // Clear checkout flag on any error
        window.checkoutInProgress = false;
        alert('Có lỗi xảy ra trong quá trình thanh toán: ' + error.message);
    }
    }

    // Create bill function
    async function createBill(billData) {
        try {
            console.log('📋 Creating bill with data:', billData);
            console.log('📝 Bill validation check:');
            console.log('  - userId exists:', !!billData.userId);
            console.log('  - userId value:', billData.userId);
            console.log('  - products is array:', Array.isArray(billData.products));
            console.log('  - products length:', billData.products?.length || 0);
            console.log('  - products data:', billData.products);
            console.log('  - totalAmount exists:', !!billData.totalAmount);
            console.log('  - totalAmount value:', billData.totalAmount);
            console.log('  - totalAmount type:', typeof billData.totalAmount);
            
            // Validate data before sending
            if (!billData.userId || billData.userId === 'undefined' || billData.userId === '') {
                console.error('❌ Invalid userId for bill creation:', billData.userId);
                throw new Error('Invalid userId for bill creation');
            }
            
            if (!Array.isArray(billData.products) || billData.products.length === 0) {
                console.error('❌ Invalid products array for bill creation:', billData.products);
                throw new Error('Invalid products array for bill creation');
            }
            
            if (!billData.totalAmount || billData.totalAmount <= 0 || typeof billData.totalAmount !== 'number') {
                console.error('❌ Invalid totalAmount for bill creation:', billData.totalAmount);
                throw new Error('Invalid totalAmount for bill creation');
            }
            
            // Validate each product
            for (let i = 0; i < billData.products.length; i++) {
                const product = billData.products[i];
                if (!product.id || !product.name || !product.price || !product.quantity) {
                    console.error(`❌ Invalid product at index ${i}:`, product);
                    throw new Error(`Invalid product data at index ${i}`);
                }
            }
            
            console.log('✅ Bill data validation passed, sending to server...');
            
            const response = await fetch('/api/bills', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(billData)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Bill created successfully with ID:', result.billId);
                
                // Clear guest temp address after successful bill creation
                if (billData.guestTempAddress) {
                    try {
                        localStorage.removeItem('guestTempAddress');
                        console.log('🧹 Cleared guestTempAddress from localStorage after bill creation');
                    } catch (error) {
                        console.error('❌ Error clearing guestTempAddress:', error);
                    }
                }
                
                return result;
            } else {
                console.error('❌ Failed to create bill:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('Full error response:', errorText);
                
                // Try to parse error details
                try {
                    const errorData = JSON.parse(errorText);
                    console.error('Parsed error data:', errorData);
                } catch (parseError) {
                    console.error('Could not parse error as JSON:', parseError);
                }
                
                return null;
            }
        } catch (error) {
            console.error('❌ Error creating bill:', error);
            // Don't throw error to prevent breaking checkout flow
            // Just log the error and continue
            return null;
        }
    }

    // Build PC function
    function proceedToBuild() {
        alert('🔧 Tính năng xây dựng PC sẽ sớm có mặt!\n\nBạn có thể liên hệ hotline 1800-1234 để được tư vấn trực tiếp từ chuyên gia của chúng tôi.');
    }

    // Search function
    // Enhanced search toggle function - integrated from shop.js
    function toggleSearch() {
        console.log('🔍 toggleSearch called from script.js');
        const searchOverlay = document.getElementById('searchOverlay');
        const searchInput = document.getElementById('searchInput');
        const searchSuggestions = document.getElementById('searchSuggestions');
        
        console.log('Search elements found:', {
            overlay: !!searchOverlay,
            input: !!searchInput,
            suggestions: !!searchSuggestions
        });
        
        if (searchOverlay) {
            searchOverlay.classList.toggle('active');
            console.log('Search overlay active:', searchOverlay.classList.contains('active'));
            
            if (searchOverlay.classList.contains('active')) {
                if (searchInput) {
                    searchInput.focus();
                    console.log('Search input focused');
                    // Show default suggestions when search is opened
                    showDefaultSearchSuggestions();
                    console.log('Default suggestions shown');
                }
            } else {
                hideSearchSuggestions();
                console.log('Search suggestions hidden');
            }
        } else {
            console.log('❌ Search overlay not found!');
        }
    }

    // Enhanced search functionality - integrated from shop.js
    function handleSearch() {
        console.log('🔍 handleSearch called from script.js');
        
        const searchInput = document.getElementById('searchInput');
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        
        console.log('🔍 Search query:', query);
        console.log('🔍 Search input element:', !!searchInput);
        
        if (query) {
            // Perform product search with the query
            console.log('🔍 Calling performProductSearch with query:', query);
            performProductSearch(query);
            // Don't hide suggestions here - let displaySearchResults handle the showing
        } else {
            // Show default suggestions when search is empty
            console.log('🔍 Empty query, showing default suggestions');
            showSearchSuggestions(); // This already calls showDefaultSearchSuggestions internally
        }
    }

    async function performProductSearch(query) {
        console.log('🔍 performProductSearch called with query:', query);
        
        try {
            // Show loading state
            const searchSuggestions = document.getElementById('searchSuggestions');
            if (searchSuggestions) {
                searchSuggestions.innerHTML = `
                    <div class="suggestion-item loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <div class="suggestion-text">
                            <h4>Đang tìm kiếm...</h4>
                            <p>Vui lòng chờ trong giây lát</p>
                        </div>
                    </div>
                `;
                searchSuggestions.classList.add('show');
            }

            // Try Elasticsearch search first
            console.log('🔍 Using Elasticsearch search API...');
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&size=20`);
            
            if (!response.ok) {
                throw new Error(`Search API failed: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('🔍 Elasticsearch response:', data);
            
            if (data.success && data.hits) {
                // Use Elasticsearch results
                const products = data.hits;
                console.log('✅ Found', products.length, 'products via Elasticsearch');
                
                // Display search statistics
                if (searchSuggestions && data.took) {
                    const statsDiv = document.createElement('div');
                    statsDiv.className = 'search-stats';
                    statsDiv.style.cssText = 'padding: 8px 15px; background: #f0f9ff; border-bottom: 1px solid #e0e0e0; font-size: 12px; color: #666;';
                    statsDiv.innerHTML = `
                        <i class="fas fa-bolt" style="color: #3b82f6;"></i>
                        Tìm thấy <strong>${data.total}</strong> kết quả trong <strong>${data.took}ms</strong>
                        ${data.fallback ? ' <span style="color: #f59e0b;">(Fallback mode)</span>' : ' <span style="color: #10b981;">(Elasticsearch)</span>'}
                    `;
                    searchSuggestions.prepend(statsDiv);
                }
                
                displaySearchResults(products, query);
                
                // Log facets if available
                if (data.facets) {
                    console.log('📊 Search facets:', data.facets);
                }
            } else {
                throw new Error('Invalid response format from search API');
            }
            
        } catch (error) {
            console.error('❌ Elasticsearch search failed, falling back to Firestore:', error);
            
            // Fallback to Firestore direct query
            try {
                const response = await fetch('/api/products');
                if (!response.ok) {
                    throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('🔍 Firestore fallback response:', data);
                
                // Handle different response formats
                let products = [];
                if (Array.isArray(data)) {
                    products = data;
                } else if (data && Array.isArray(data.products)) {
                    products = data.products;
                } else if (data && typeof data === 'object') {
                    products = Object.keys(data).map(id => ({
                        id: id,
                        ...data[id]
                    }));
                } else {
                    console.warn('⚠️ Unexpected data format:', data);
                    throw new Error('Invalid products data format');
                }
                
                console.log('🔍 Processed products:', products.length);
                
                // Filter products based on search query
                const filteredProducts = products.filter(product => {
                    const name = (product.name || '').toLowerCase();
                    const category = (product.category || '').toLowerCase();
                    const brand = (product.brand || '').toLowerCase();
                    const description = (product.description || '').toLowerCase();
                    
                    return name.includes(query) ||
                           category.includes(query) ||
                           brand.includes(query) ||
                           description.includes(query);
                });
                
                console.log('🔍 Filtered products:', filteredProducts.length, 'found for query:', query);
                displaySearchResults(filteredProducts, query);
                
            } catch (fallbackError) {
                console.error('❌ Firestore fallback also failed:', fallbackError);
                
                // Show error message
                const searchSuggestions = document.getElementById('searchSuggestions');
                if (searchSuggestions) {
                    searchSuggestions.innerHTML = `
                        <div class="suggestion-item error">
                            <i class="fas fa-exclamation-triangle"></i>
                            <div class="suggestion-text">
                                <h4>Lỗi tìm kiếm</h4>
                                <p>Không thể kết nối đến server. Vui lòng thử lại sau.</p>
                            </div>
                        </div>
                    `;
                    searchSuggestions.classList.add('show');
                }
            }
        }
    }

    function displaySearchResults(products, query) {
        console.log('🔍 displaySearchResults called with', products.length, 'products');
        
        const searchSuggestions = document.getElementById('searchSuggestions');
        console.log('🔍 searchSuggestions element:', !!searchSuggestions);
        
        if (!searchSuggestions) return;
        
        if (products.length === 0) {
            console.log('🔍 No products found, showing no results message');
            searchSuggestions.innerHTML = `
                <div class="suggestion-item no-results">
                    <i class="fas fa-search"></i>
                    <div class="suggestion-text">
                        <h4>Không tìm thấy sản phẩm cho "${query}"</h4>
                        <p>Thử từ khóa khác hoặc duyệt theo danh mục</p>
                    </div>
                </div>
                <div class="suggestion-item" onclick="clearSearchAndShowAll()">
                    <i class="fas fa-store"></i>
                    <div class="suggestion-text">
                        <h4>Xem tất cả sản phẩm</h4>
                        <p>Khám phá toàn bộ cửa hàng của chúng tôi</p>
                    </div>
                </div>
            `;
            searchSuggestions.classList.add('show');
            console.log('🔍 Added show class to searchSuggestions');
            return;
        }
        
        console.log('🔍 Found', products.length, 'products, displaying first', Math.min(products.length, 6));
        
        const maxResults = 6;
        const displayedProducts = products.slice(0, maxResults);
        
        let resultsHTML = displayedProducts.map(product => {
            // Handle different price formats from Firebase
            let displayPrice = product.price;
            if (typeof product.price === 'number') {
                displayPrice = formatPrice(product.price);
            } else if (typeof product.price === 'string') {
                // If price is already formatted, use as is
                if (product.price.includes('.')) {
                    displayPrice = formatPrice(parseInt(product.price.replace(/\./g, '')));
                } else {
                    displayPrice = formatPrice(parseInt(product.price));
                }
            }
            
            return `
                <div class="suggestion-item" data-product-id="${product.id}">
                    <i class="fas fa-${getProductIcon(product.category)}"></i>
                    <div class="suggestion-text">
                        <h4>${highlightSearchTerm(product.name, query)}</h4>
                        <p>${displayPrice} - ${product.category}</p>
                    </div>
                </div>
            `;
        }).join('');
        
        if (products.length > maxResults) {
            resultsHTML += `
                <div class="suggestion-item view-all" onclick="searchAndNavigateToShop('${query}')">
                    <i class="fas fa-eye"></i>
                    <div class="suggestion-text">
                        <h4>Xem tất cả ${products.length} kết quả</h4>
                        <p>Tìm kiếm cho "${query}"</p>
                    </div>
                </div>
            `;
        }
        
        console.log('🔍 Setting search results HTML, length:', resultsHTML.length);
        searchSuggestions.innerHTML = resultsHTML;
        searchSuggestions.classList.add('show');
        
        // Add click event listeners for product navigation
        const productItems = searchSuggestions.querySelectorAll('[data-product-id]');
        productItems.forEach(item => {
            item.addEventListener('click', function() {
                const productId = this.getAttribute('data-product-id');
                console.log('🔍 Product clicked:', productId);
                navigateToProductDetail(productId);
            });
            // Add hover effect and pointer cursor
            item.style.cursor = 'pointer';
            item.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#f0f0f0';
            });
            item.addEventListener('mouseleave', function() {
                this.style.backgroundColor = '';
            });
        });
        
        console.log('🔍 Added show class, element visible:', searchSuggestions.classList.contains('show'));
    }

    function hideSearchSuggestions() {
        const searchSuggestions = document.getElementById('searchSuggestions');
        if (searchSuggestions) {
            searchSuggestions.classList.remove('show');
        }
    }

    function selectCategoryFromSearch(category) {
        console.log('🏷️ Category selected from search:', category);
        const searchInput = document.getElementById('searchInput');
        
        // Clear search input
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Hide search suggestions and close search overlay
        hideSearchSuggestions();
        
        // Force close search overlay
        const searchOverlay = document.getElementById('searchOverlay');
        if (searchOverlay) {
            searchOverlay.classList.remove('active');
            console.log('🔒 Search overlay forced to close');
        }
        
        // Show notification
        if (typeof showNotification === 'function') {
            showNotification(`Lọc theo danh mục: ${category.toUpperCase()}`, 'info');
        }
        
        // Check if we're on shop page or index page
        const isShopPage = document.body.classList.contains('shop-page') || 
                          window.location.pathname.includes('/shop');
        
        if (isShopPage) {
            // On shop page: use server-side filtering via checkbox
            console.log('📍 On shop page - applying server-side filtering');
            
            // Try to find applyCategoryFilter with retry mechanism
            const tryApplyCategoryFilter = (attempts = 0) => {
                console.log('🔍 Checking available functions:', {
                    applyCategoryFilter: typeof window.applyCategoryFilter,
                    filterProductsByCategory: typeof window.filterProductsByCategory,
                    loadProducts: typeof window.loadProducts,
                    applyFilters: typeof window.applyFilters
                });
                
                if (typeof window.applyCategoryFilter === 'function') {
                    console.log('✅ applyCategoryFilter function found, calling it');
                    window.applyCategoryFilter(category);
                } else if (attempts < 5) {
                    // Retry after short delay (shop.ejs might still be loading)
                    console.log(`⏳ applyCategoryFilter not ready, retrying... (attempt ${attempts + 1}/5)`);
                    setTimeout(() => tryApplyCategoryFilter(attempts + 1), 100);
                } else {
                    console.log('❌ applyCategoryFilter function not found after retries, fallback to client-side filtering');
                    if (typeof window.filterProductsByCategory === 'function') {
                        window.filterProductsByCategory(category);
                    } else {
                        console.error('❌ Both applyCategoryFilter and filterProductsByCategory functions not found');
                    }
                }
            };
            
            tryApplyCategoryFilter();
        } else {
            // On other pages (like index): navigate to shop with category filter
            console.log('📍 Not on shop page - navigating to shop with category filter');
            window.location.href = `/shop?category=${category}`;
        }
    }
    
    // Export immediately to make available for other functions
    window.selectCategoryFromSearch = selectCategoryFromSearch;

    function showDefaultSearchSuggestions() {
        console.log('🔍 showDefaultSearchSuggestions called');
        const searchSuggestions = document.getElementById('searchSuggestions');
        if (!searchSuggestions) {
            console.log('❌ searchSuggestions element not found!');
            return;
        }
        
        console.log('✅ searchSuggestions element found, populating content...');
        searchSuggestions.innerHTML = `
            <div class="suggestion-item" data-category="laptop">
                <i class="fas fa-laptop"></i>
                <div class="suggestion-text">
                    <h4>Laptop Gaming</h4>
                    <p>ASUS, MSI, Acer, Alienware</p>
                </div>
            </div>
            <div class="suggestion-item" data-category="cpu">
                <i class="fas fa-microchip"></i>
                <div class="suggestion-text">
                    <h4>CPU</h4>
                    <p>Intel Core, AMD Ryzen</p>
                </div>
            </div>
            <div class="suggestion-item" data-category="vga">
                <i class="fas fa-memory"></i>
                <div class="suggestion-text">
                    <h4>Card đồ họa</h4>
                    <p>RTX 4080, RTX 4070, RTX 4060</p>
                </div>
            </div>
            <div class="suggestion-item" data-category="monitor">
                <i class="fas fa-desktop"></i>
                <div class="suggestion-text">
                    <h4>Màn hình</h4>
                    <p>Gaming, 4K, Ultrawide</p>
                </div>
            </div>
            <div class="suggestion-item" data-category="keyboard">
                <i class="fas fa-keyboard"></i>
                <div class="suggestion-text">
                    <h4>Bàn phím</h4>
                    <p>Mechanical, Gaming, Wireless</p>
                </div>
            </div>
            <div class="suggestion-item" data-category="mouse">
                <i class="fas fa-mouse"></i>
                <div class="suggestion-text">
                    <h4>Chuột gaming</h4>
                    <p>Wireless, Pro, RGB</p>
                </div>
            </div>
        `;
        
        // Only add event listener if not already added
        if (!searchSuggestions.hasAttribute('data-listeners-added')) {
            searchSuggestions.addEventListener('click', function(e) {
                const suggestionItem = e.target.closest('.suggestion-item');
                if (suggestionItem) {
                    const category = suggestionItem.getAttribute('data-category');
                    if (category) {
                        console.log('🏷️ Suggestion clicked:', category);
                        selectCategoryFromSearch(category);
                    }
                }
            });
            searchSuggestions.setAttribute('data-listeners-added', 'true');
            console.log('✅ Event listener added to search suggestions');
        } else {
            console.log('⚠️ Event listener already exists, skipping');
        }
        
        // Add the show class to make suggestions visible
        searchSuggestions.classList.add('show');
        console.log('✅ Default suggestions populated and show class added');
    }

    function showSearchSuggestions() {
        const searchInput = document.getElementById('searchInput');
        const searchSuggestions = document.getElementById('searchSuggestions');
        
        if (searchInput && searchInput.value.trim() === '' && searchSuggestions) {
            showDefaultSearchSuggestions();
            searchSuggestions.classList.add('show');
        }
    }

    // Legacy function name for backward compatibility
    function performSearch() {
        handleSearch();
    }

    function displaySearchSuggestions(products) {
        // Legacy function - redirect to new implementation
        if (products && products.length > 0) {
            const query = document.getElementById('searchInput')?.value?.toLowerCase()?.trim() || '';
            displaySearchResults(products, query);
        }
    }

    // Search helper functions
    function getProductIcon(category) {
        const iconMap = {
            'Laptop': 'laptop',
            'CPU': 'microchip', 
            'VGA': 'memory',
            'RAM': 'memory',
            'Storage': 'hdd',
            'Monitor': 'desktop',
            'Keyboard': 'keyboard',
            'Mouse': 'mouse',
            'Headset': 'headphones',
            'PC': 'desktop',
            'Phụ kiện': 'gamepad'
        };
        return iconMap[category] || 'cube';
    }

    function highlightSearchTerm(text, term) {
        if (!term) return text;
        const regex = new RegExp(`(${term})`, 'gi');
        return text.replace(regex, '<mark style="background: #fbbf24; color: #92400e; padding: 0 2px; border-radius: 2px;">$1</mark>');
    }

    function navigateToProductDetail(productId) {
        console.log('🔍 Navigating to product detail for ID:', productId);
        
        // Validate productId
        if (!productId) {
            console.error('❌ Invalid product ID:', productId);
            return;
        }
        
        // Hide search suggestions and close search overlay
        hideSearchSuggestions();
        const searchOverlay = document.getElementById('searchOverlay');
        if (searchOverlay) {
            searchOverlay.classList.remove('active');
        }
        
        // Clear search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Navigate to product detail page with correct URL format
        const targetUrl = `/product/${productId}`;
        console.log('🔍 Navigating to:', targetUrl);
        window.location.href = targetUrl;
    }
    
    // Export immediately for global access
    window.navigateToProductDetail = navigateToProductDetail;
    
    // Test function for debugging
    window.testNavigation = function(productId) {
        console.log('🧪 Testing navigation with product ID:', productId);
        navigateToProductDetail(productId || 'K8lbqOj5YyhYOBc5A52A');
    };

    function selectProductFromSearch(productId, productName) {
        console.log('🔍 Product selected from search:', productName);
        const searchInput = document.getElementById('searchInput');
        
        // Set search input to product name
        if (searchInput) {
            searchInput.value = productName;
        }
        
        // Hide search suggestions
        hideSearchSuggestions();
        toggleSearch();
        
        // Show notification
        if (typeof showNotification === 'function') {
            showNotification(`Tìm kiếm sản phẩm: ${productName}`, 'info');
        }
        
        // Navigate to shop page with search
        window.location.href = `/shop?search=${encodeURIComponent(productName)}`;
    }

    function clearSearchAndShowAll() {
        console.log('🔍 Clearing search and showing all products');
        const searchInput = document.getElementById('searchInput');
        
        // Clear search input
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Hide search suggestions
        hideSearchSuggestions();
        toggleSearch();
        
        // Show notification
        if (typeof showNotification === 'function') {
            showNotification('Hiển thị tất cả sản phẩm', 'info');
        }
        
        // Navigate to shop page
        window.location.href = '/shop';
    }

    function searchAllProducts(query) {
        console.log('🔍 Searching all products for:', query);
        const searchInput = document.getElementById('searchInput');
        
        // Set search input
        if (searchInput) {
            searchInput.value = query;
        }
        
        // Hide search suggestions
        hideSearchSuggestions();
        toggleSearch();
        
        // Show notification
        if (typeof showNotification === 'function') {
            showNotification(`Tìm kiếm: ${query}`, 'info');
        }
        
        // Navigate to shop page with search
        window.location.href = `/shop?search=${encodeURIComponent(query)}`;
    }

    function selectProduct(productId) {
        console.log('Selected product:', productId);
        // Navigate to product detail page
        window.location.href = `/product/${productId}`;
    }

    // Initialize search event listeners
    function initializeSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.querySelector('.search-btn');
        const searchOverlay = document.getElementById('searchOverlay');

        if (searchInput) {
            searchInput.addEventListener('input', handleSearch);
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    handleSearch();
                }
            });
            searchInput.addEventListener('focus', showSearchSuggestions);
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', handleSearch);
        }

        // Close search when clicking outside
        if (searchOverlay) {
            searchOverlay.addEventListener('click', function(e) {
                if (e.target === searchOverlay) {
                    toggleSearch();
                }
            });
        }

        // Close search with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && searchOverlay && searchOverlay.classList.contains('active')) {
                toggleSearch();
            }
        });
    }

    // Save cart to localStorage and Firebase (if user is logged in)
    function saveCartToStorage() {
        // Always save to localStorage
        localStorage.setItem('techHavenCart', JSON.stringify(cartItems));
        localStorage.setItem('techHavenCartCount', cartCount.toString());
        
        // Also save to Firebase if user is authenticated
        saveCartToFirebase();
    }
    
    // Save cart to Firebase Firestore
    async function saveCartToFirebase() {
        if (!window.currentUser) {
            console.log('👤 No authenticated user - cart saved locally only');
            return;
        }
        
        // SKIP saving if cart is empty (after order completion or cart clear)
        if (!cartItems || cartItems.length === 0) {
            console.log('🔄 Cart is empty - skipping Firebase save (cart already cleared)');
            return;
        }
        
        try {
            console.log('🔄 Saving cart to Firebase...');
            console.log('Cart items to save:', cartItems);
            
            // Check if user is manual (no Firebase ID token) or Google user
            let idToken = null;
            let isManualUser = false;
            
            if (window.getIdToken) {
                try {
                    idToken = await window.getIdToken();
                } catch (error) {
                    console.log('⚠️ Could not get Firebase ID token, treating as manual user');
                }
            }
            
            if (!idToken && window.currentUser.provider === 'manual') {
                isManualUser = true;
                console.log('🔑 Using manual user cart endpoint for user:', window.currentUser.uid);
            } else if (!idToken) {
                console.warn('⚠️ No ID token available and not manual user');
                return;
            }
            
            if (isManualUser) {
                // Use manual user cart endpoint
                const response = await fetch(`/api/cart/by-uid/${window.currentUser.uid}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        items: cartItems.map(item => ({
                            productId: String(item.id),
                            quantity: item.quantity
                        }))
                    })
                });
                
                if (response.ok) {
                    console.log('✅ Cart saved to Firebase (manual user)');
                } else {
                    const error = await response.text();
                    console.error('❌ Failed to save cart (manual user):', error);
                }
            } else {
                // Update or create each item individually to Firebase (Google user)
                for (const item of cartItems) {
                    // Double-check cart wasn't cleared during async operations
                    if (!cartItems || cartItems.length === 0) {
                        console.log('🛑 Cart was cleared during save operation - aborting remaining updates');
                        break;
                    }
                    
                    // Check if item has Firebase document ID for update
                    const method = item.firebaseDocId || item.cartId ? 'PUT' : 'POST';
                    const url = item.firebaseDocId || item.cartId ? 
                        `/api/cart/${item.firebaseDocId || item.cartId}` : 
                        '/api/cart';
                    
                    console.log(`🔄 ${method === 'PUT' ? 'Updating' : 'Creating'} cart item:`, {
                        id: item.firebaseDocId || item.cartId,
                        productId: item.productId || item.id,
                        name: item.name
                    });
                    
                    const response = await fetch(url, {
                        method: method,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`
                        },
                        body: JSON.stringify({
                            userId: window.currentUser.uid,
                            productId: String(item.productId || item.id),
                            productName: item.name,
                            productPrice: item.numericPrice,
                            productImage: item.image,
                            quantity: item.quantity
                        })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log(`✅ ${method === 'PUT' ? 'Updated' : 'Saved'} item "${item.name}" to Firebase:`, result);
                        
                        // Update item with Firebase document ID if it's a new item
                        if (method === 'POST' && result.id) {
                            item.firebaseDocId = result.id;
                            item.cartId = result.id;
                            item.id = result.id;
                        }
                    } else if (response.status === 404 || response.status === 500) {
                        // Item was deleted (cart cleared) - this is expected during checkout
                        console.log(`ℹ️ Skipping item "${item.name}" - already removed from database (checkout completed)`);
                    } else {
                        const error = await response.text();
                        console.error(`❌ Failed to ${method === 'PUT' ? 'update' : 'save'} item "${item.name}":`, error);
                    }
                }
                
                console.log('✅ All cart items saved to Firebase');
            }
        } catch (error) {
            console.error('❌ Error saving cart to Firebase:', error);
        }
    }

    // Clear cart function (for testing)
    function clearCart() {
        cartItems = [];
        cartCount = 0;
        updateCartUI();
        saveCartToStorage();
        console.log('Cart cleared');
    }

    // Load cart from localStorage and Firebase (if user is logged in)
    function loadCartFromStorage() {
        // First load from localStorage (immediate)
        const savedCart = localStorage.getItem('techHavenCart');
        const savedCount = localStorage.getItem('techHavenCartCount');
        
        console.log('📦 Loading cart from storage:', {
            savedCart: savedCart,
            savedCount: savedCount,
            currentItems: cartItems.length,
            currentCount: cartCount
        });
        
        if (savedCart) {
            try {
                cartItems = JSON.parse(savedCart);
                console.log('✅ Parsed cart items:', cartItems);
            } catch (e) {
                console.error('❌ Failed to parse saved cart:', e);
                cartItems = [];
            }
        }
        
        if (savedCount) {
            cartCount = parseInt(savedCount) || 0;
        } else {
            // Recalculate count from items if no saved count
            cartCount = cartItems.reduce((total, item) => total + (item.quantity || 1), 0);
        }
        
        console.log('📊 Final cart state after loading:', {
            items: cartItems.length,
            count: cartCount,
            itemsArray: cartItems
        });
        
        // Force update UI
        updateCartUI();
        
        // Then try to load from Firebase (if user is authenticated)
        if (typeof loadCartFromFirebase === 'function') {
            loadCartFromFirebase();
        }
    }
    
    // clearCartInFirebase function moved outside DOMContentLoaded for global access
    
    // Load cart from Firebase Firestore
    async function loadCartFromFirebase() {
        if (!window.currentUser) {
            console.log('👤 No authenticated user - using local cart only');
            return;
        }
        
        try {
            console.log('🔄 Loading cart from Firebase...');
            
            // Check if user is manual (no Firebase ID token) or Google user
            let idToken = null;
            let isManualUser = false;
            
            if (window.getIdToken) {
                try {
                    idToken = await window.getIdToken();
                } catch (error) {
                    console.log('⚠️ Could not get Firebase ID token, treating as manual user');
                }
            }
            
            if (!idToken && window.currentUser.provider === 'manual') {
                isManualUser = true;
                console.log('🔑 Using manual user cart endpoint for user:', window.currentUser.uid);
            } else if (!idToken) {
                console.warn('⚠️ No ID token available and not manual user');
                return;
            }
            
            let response;
            if (isManualUser) {
                // Use manual user cart endpoint
                response = await fetch(`/api/cart/by-uid/${window.currentUser.uid}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            } else {
                // Use regular cart endpoint
                response = await fetch(`/api/cart?uid=${encodeURIComponent(window.currentUser.uid)}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${idToken}`
                    }
                });
            }
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Cart loaded from Firebase:', result);
                
                let firebaseCartItems = [];
                
                if (isManualUser && result.success && result.cart && result.cart.items) {
                    // Manual user cart format
                    firebaseCartItems = result.cart.items;
                } else if (result.cartItems && result.cartItems.length > 0) {
                    // Google user cart format
                    firebaseCartItems = result.cartItems;
                }
                
                if (firebaseCartItems.length > 0) {
                    // Firebase cart now only contains productId and quantity
                    // We need to fetch product details for each item
                    const enrichedCartItems = [];
                    
                    for (const item of firebaseCartItems) {
                        try {
                            // Try to fetch product details from API
                            const productResponse = await fetch(`/api/products/${item.productId}`);
                            let productData = null;
                            
                            if (productResponse.ok) {
                                const productResult = await productResponse.json();
                                if (productResult.success && productResult.product) {
                                    productData = productResult.product;
                                }
                            }
                            
                            // Create cart item with fetched product data or fallback
                            enrichedCartItems.push({
                                id: item.productId,
                                name: productData?.name || `Product ${item.productId}`,
                                price: formatPrice(productData?.price || 0),
                                numericPrice: productData?.price || 0,
                                quantity: item.quantity,
                                image: productData?.images?.[0] || productData?.imageUrl || getProductIcon(productData?.name || 'product'),
                                imageColor: '#667eea' // Default color for Firebase items
                            });
                            
                        } catch (productError) {
                            console.warn('⚠️ Could not fetch product details for', item.productId, '- using fallback data');
                            // Use fallback data if product fetch fails
                            enrichedCartItems.push({
                                id: item.productId,
                                name: `Product ${item.productId}`,
                                price: formatPrice(0),
                                numericPrice: 0,
                                quantity: item.quantity,
                                image: getProductIcon('product'),
                                imageColor: '#667eea'
                            });
                        }
                    }
                    
                    cartItems = enrichedCartItems;
                    cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
                    
                    // Update UI and save to localStorage
                    updateCartUI();
                    localStorage.setItem('techHavenCart', JSON.stringify(cartItems));
                    localStorage.setItem('techHavenCartCount', cartCount.toString());
                    
                    console.log('🔄 Cart synced from Firebase to local storage with', cartItems.length, 'items');
                }
            } else {
                const errorText = await response.text();
                console.log('ℹ️ No cart found in Firebase or error loading:', errorText);
            }
        } catch (error) {
            console.error('❌ Error loading cart from Firebase:', error);
        }
    }

    // Function for non-index pages
    function setupNonIndexPage() {
        // Load cart from storage
        loadCartFromStorage();
        
        // Initialize wishlist
        initializeWishlist();
        
        // Force initial cart UI update for guest users
        setTimeout(() => {
            console.log('🔄 Forcing initial cart UI update for guest users');
            updateCartUI();
        }, 100);
        
        // Setup common functionality
        setupProductNavigation();
        
        // Initialize search functionality for non-index pages
        initializeSearch();
        
        // Make functions global
        window.addToCart = addToCart;
        window.removeFromCart = removeFromCart;
        window.updateCartQuantity = updateCartQuantity;
        // Export the essential cart functions for all pages
        window.updateCartQuantityById = updateCartQuantityById;
        window.removeFromCartById = removeFromCartById;
        // Only export if enhanced version doesn't exist
        if (!window.toggleCart || window.toggleCart.toString().length < 200) {
            window.toggleCart = toggleCart;
        }
        window.toggleSearch = toggleSearch;
        window.proceedToCheckout = proceedToCheckout;
        window.closeCheckoutModal = closeCheckoutModal;
        window.completeOrder = completeOrder;
        window.proceedToBuild = proceedToBuild;
        window.saveCartToStorage = saveCartToStorage;
        window.selectProduct = selectProduct;
        window.performSearch = performSearch;
        window.loadCartFromStorage = loadCartFromStorage;
        window.loadCartFromFirebase = loadCartFromFirebase;
        window.saveCartToFirebase = saveCartToFirebase;
        
        // Export wishlist functions globally
        window.addToWishlist = addToWishlist;
        window.removeFromWishlist = removeFromWishlist;
        window.isInWishlist = isInWishlist;
        window.moveToCart = moveToCart;
        
        // Setup event listeners for common elements
        setupCommonEventListeners();
    }

    // Product section navigation
    function setupProductNavigation() {
        const navArrows = document.querySelectorAll('.nav-arrow');
        
        navArrows.forEach(arrow => {
            arrow.addEventListener('click', function() {
                const section = this.dataset.section;
                const container = document.getElementById(`${section}-container`);
                const scrollAmount = 300;
                
                if (container) {
                    if (this.classList.contains('prev')) {
                        container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
                    } else {
                        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
                    }
                }
            });
        });
    }

    // Common event listeners
    function setupCommonEventListeners() {
        // Close cart when clicking overlay
        document.addEventListener('click', function(e) {
            if (e.target.id === 'cartOverlay') {
                toggleCart();
            }
        });

        // Close modal when clicking overlay
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-overlay')) {
                closeCheckoutModal();
            }
        });

        // Mobile menu toggle
        const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', function() {
                const navMenu = document.querySelector('.nav-menu');
                if (navMenu) {
                    navMenu.classList.toggle('active');
                }
            });
        }
        
        // Setup wishlist event listeners (delegated)
        document.addEventListener('click', function(e) {
            // console.log('🔍 Document click detected:', e.target); // Removed debug log
            if (e.target.closest('.wishlist-btn')) {
                console.log('💖 Wishlist button clicked');
                handleWishlistClick(e);
            }
        });
        
        console.log('✅ Wishlist event listeners setup completed');
        
        // Setup cart event listeners for all pages
        console.log('🔧 Setting up cart event listeners for', document.body.className);
        if (typeof setupCartEventListeners === 'function') {
            setupCartEventListeners();
        }
    }

    // Add enhanced updateCartIcon method to SmartCartManager if it exists
    if (window.smartCart && window.smartCart.updateCartIcon) {
        const originalUpdateCartIcon = window.smartCart.updateCartIcon;
        window.smartCart.updateCartIcon = function() {
            const cartBadge = document.getElementById('cartBadge');
            const cartIcon = document.querySelector('#cartIcon i.fas.fa-shopping-cart');
            const cartIconWrapper = document.getElementById('cartIcon');
            const cartStateTooltip = document.getElementById('cartStateTooltip');
            const mobileCartCount = document.getElementById('cartCount'); // Fixed: use 'cartCount' for mobile
            
            console.log('🎨 Enhanced SmartCartManager: Updating cart icon:', {
                count: this.cartData.count,
                source: this.lastUpdateSource,
                isLoggedIn: this.isLoggedIn
            });
            
            // Update cart badge
            if (cartBadge) {
                cartBadge.textContent = this.cartData.count;
                cartBadge.style.display = this.cartData.count > 0 ? 'flex' : 'none';
                
                // Add visual indicator for data source
                cartBadge.classList.remove('firebase-data', 'local-data');
                cartBadge.classList.add(this.lastUpdateSource === 'firebase' ? 'firebase-data' : 'local-data');
                cartBadge.title = this.lastUpdateSource === 'firebase' ? 'Dữ liệu từ Cloud' : 'Dữ liệu cục bộ';
            }
            
            // Update cart icon wrapper classes
            if (cartIconWrapper) {
                cartIconWrapper.classList.remove('has-firebase-data', 'has-local-data');
                cartIconWrapper.classList.add(this.lastUpdateSource === 'firebase' ? 'has-firebase-data' : 'has-local-data');
            }
            
            // Update tooltip
            if (cartStateTooltip) {
                const tooltip = this.lastUpdateSource === 'firebase' 
                    ? `☁️ Dữ liệu Cloud (${this.cartData.count} sản phẩm)`
                    : `💾 Dữ liệu cục bộ (${this.cartData.count} sản phẩm)`;
                cartStateTooltip.textContent = tooltip;
            }
            
            // Update mobile cart count
            if (mobileCartCount) {
                mobileCartCount.textContent = this.cartData.count;
                mobileCartCount.classList.remove('firebase-data', 'local-data');
                mobileCartCount.classList.add(this.lastUpdateSource === 'firebase' ? 'firebase-data' : 'local-data');
            }
            
            // Update cart icon color to indicate data source
            if (cartIcon) {
                cartIcon.classList.remove('firebase-data', 'local-data');
                cartIcon.classList.add(this.lastUpdateSource === 'firebase' ? 'firebase-data' : 'local-data');
                cartIcon.title = this.lastUpdateSource === 'firebase' ? 'Giỏ hàng Cloud' : 'Giỏ hàng cục bộ';
            }
            
            // Update global cartItems and cartCount for compatibility
            cartItems.length = 0;
            cartItems.push(...this.cartData.items);
            cartCount = this.cartData.count;
        };
    }

    // Initialize SmartCartManager on page load
    setTimeout(async () => {
        if (window.smartCart) {
            // Check if user is already logged in
            const storedUser = localStorage.getItem('techHavenUser');
            if (storedUser) {
                try {
                    const user = JSON.parse(storedUser);
                    console.log('🔄 Found stored user, updating SmartCartManager:', user.name);
                    window.smartCart.setAuthStatus(true, user);
                } catch (error) {
                    console.warn('⚠️ Invalid stored user data');
                }
            } else {
                console.log('🔄 No stored user, refreshing cart from localStorage');
                await window.smartCart.refreshCartData();
            }
        }
    }, 1000);
    
    // Initialize all functions (only for index page)
    if (document.body.classList.contains('index-page')) {
        // Load cart from storage
        loadCartFromStorage();
        
        setupProductNavigation();
        setupCommonEventListeners();
        initializeSearch();
    } else {
        // Initialize search for other pages too - with longer delay for shop page
        setTimeout(initializeSearch, 500);
        
        // Ensure cart functions are properly set up for all pages
        setupCommonEventListeners();
        
        // Also ensure search works after shop.js finishes loading
        setTimeout(() => {
            console.log('🔍 Re-initializing search after shop.js load...');
            initializeSearch();
        }, 1000);
        
    }
    
    // Make functions global for all pages
    window.addToCart = addToCart;
    window.removeFromCart = removeFromCart;
    window.updateCartQuantity = updateCartQuantity;
    // Only export if enhanced version doesn't exist
    if (!window.toggleCart || window.toggleCart.toString().length < 200) {
        window.toggleCart = toggleCart;
    }
    window.toggleSearch = toggleSearch;
    window.proceedToCheckout = proceedToCheckout;
    window.closeCheckoutModal = closeCheckoutModal;
    window.completeOrder = completeOrder;
    window.proceedToBuild = proceedToBuild;
    window.saveCartToStorage = saveCartToStorage;
    window.loadCartFromStorage = loadCartFromStorage;
    window.loadCartFromFirebase = loadCartFromFirebase;
    window.saveCartToFirebase = saveCartToFirebase;
    window.clearCart = clearCart;
    // clearCartInFirebase exported globally outside DOMContentLoaded
    
    // Export Firebase cart real-time listener functions
    window.startCartRealtimeListener = startCartRealtimeListener;
    window.stopCartRealtimeListener = stopCartRealtimeListener;

    // Make search functions globally available for other scripts
    window.handleSearch = handleSearch;
    window.performProductSearch = performProductSearch;
    window.displaySearchResults = displaySearchResults;
    window.showDefaultSearchSuggestions = showDefaultSearchSuggestions;
    window.showSearchSuggestions = showSearchSuggestions;
    window.hideSearchSuggestions = hideSearchSuggestions;
    window.getProductIcon = getProductIcon;
    window.highlightSearchTerm = highlightSearchTerm;
    window.navigateToProductDetail = navigateToProductDetail;
    window.selectProductFromSearch = selectProductFromSearch;
    window.selectCategoryFromSearch = selectCategoryFromSearch;
    window.clearSearchAndShowAll = clearSearchAndShowAll;
    window.searchAllProducts = searchAllProducts;
    window.selectProduct = selectProduct;

    // Initialize mobile menu toggle for all pages
    setupCommonEventListeners();
});

// =====================================
// UNIVERSAL CART HANDLERS (OUTSIDE DOMContentLoaded)
// =====================================

// Universal cart remove handler (works for both guest and logged users)
function handleCartRemove(cartId) {
    console.log('🎯 handleCartRemove called with cartId:', cartId);
    
    if (!window.currentUser) {
        console.log('👤 Guest user: Using guest cart remove');
        
        // Double check that the item exists before trying to remove
        const itemExists = cartItems.findIndex(item => String(item.id) === String(cartId));
        console.log('🔍 Item exists in cart before remove:', itemExists !== -1, 'at index:', itemExists);
        console.log('📦 Current cart items:', cartItems.map(item => ({id: item.id, name: item.name, quantity: item.quantity})));
        
        if (typeof window.removeGuestCartItem === 'function') {
            window.removeGuestCartItem(cartId);
        } else {
            console.error('❌ removeGuestCartItem function not found');
        }
    } else {
        console.log('👥 Logged user: Using database cart remove');
        if (typeof removeFromCartById === 'function') {
            removeFromCartById(cartId);
        } else {
            console.error('❌ removeFromCartById function not found');
        }
    }
}

// Universal cart quantity update handler (works for both guest and logged users)
function handleCartQuantityUpdate(cartId, newQuantity) {
    console.log('🎯 handleCartQuantityUpdate called with cartId:', cartId, 'newQuantity:', newQuantity);
    
    if (!window.currentUser) {
        console.log('👤 Guest user: Using guest cart update');
        
        // Double check that the item exists before trying to update
        const itemIndex = cartItems.findIndex(item => String(item.id) === String(cartId));
        console.log('🔍 Item exists in cart before update:', itemIndex !== -1, 'at index:', itemIndex);
        
        if (typeof window.updateGuestCartQuantity === 'function') {
            window.updateGuestCartQuantity(cartId, newQuantity);
        } else {
            console.error('❌ updateGuestCartQuantity function not found');
        }
    } else {
        console.log('👥 Logged user: Using database cart update');
        if (typeof updateCartQuantityById === 'function') {
            updateCartQuantityById(cartId, newQuantity);
        } else {
            console.error('❌ updateCartQuantityById function not found');
        }
    }
}

// Export universal cart handlers immediately for early access
window.handleCartRemove = handleCartRemove;
window.handleCartQuantityUpdate = handleCartQuantityUpdate;

// Clear cart in Firebase (moved outside DOMContentLoaded for global access)
async function clearCartInFirebase(idToken) {
    try {
        const response = await fetch(`/api/cart/user/${encodeURIComponent(window.currentUser.uid)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });
        
        if (response.ok) {
            console.log('✅ Firebase cart cleared');
        } else {
            console.log('ℹ️ Could not clear Firebase cart (maybe empty)');
        }
    } catch (error) {
        console.error('❌ Error clearing Firebase cart:', error);
    }
}

// Export clearCartInFirebase globally
window.clearCartInFirebase = clearCartInFirebase;

// Debug function to check cart state
window.debugCartState = function() {
    console.log('🔍 Cart State Debug:', {
        'window.cartItems': window.cartItems,
        'cartItems (local)': cartItems,
        'cartCount': cartCount,
        'localStorage cart': JSON.parse(localStorage.getItem('techHavenCart') || '[]'),
        'localStorage count': localStorage.getItem('techHavenCartCount'),
        'smartCart state': window.smartCart ? {
            items: window.smartCart.cartItems,
            count: window.smartCart.cartCount
        } : 'not available'
    });
};

// Debug function to check Firebase IDs
window.debugFirebaseIds = function() {
    console.log('🔍 Firebase IDs Debug:');
    cartItems.forEach((item, index) => {
        console.log(`Item ${index}:`, {
            id: item.id,
            cartId: item.cartId,
            firebaseDocId: item.firebaseDocId,
            productId: item.productId,
            name: item.name
        });
    });
};

// Navigate to product detail page
function goToProductDetail(productId) {
    console.log('Navigating to product detail:', productId);
    window.location.href = `/product/${productId}`;
}

// Admin Dropdown Functionality
function initializeAdminDropdown() {
    const adminDropdown = document.querySelector('.admin-dropdown');
    if (!adminDropdown) return;

    const dropdownToggle = adminDropdown.querySelector('.dropdown-toggle');
    const dropdownMenu = adminDropdown.querySelector('.dropdown-menu');

    if (!dropdownToggle || !dropdownMenu) return;
    
    console.log('🔧 Initializing admin dropdown...');

    // Remove any existing event listeners by cloning the element
    const newToggle = dropdownToggle.cloneNode(true);
    dropdownToggle.parentNode.replaceChild(newToggle, dropdownToggle);
    
    // Get the new toggle reference
    const toggle = adminDropdown.querySelector('.dropdown-toggle');

    // Handle click/touch events for dropdown toggle
    function toggleDropdown(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('📱 Admin dropdown toggle activated');
        
        // Close other dropdowns
        document.querySelectorAll('.admin-dropdown.active').forEach(dropdown => {
            if (dropdown !== adminDropdown) {
                dropdown.classList.remove('active');
            }
        });
        
        // Toggle current dropdown
        const isActive = adminDropdown.classList.contains('active');
        adminDropdown.classList.toggle('active');
        
        console.log(`Dropdown ${isActive ? 'closed' : 'opened'}`);
    }

    // Add both click and touch events for better mobile support
    toggle.addEventListener('click', toggleDropdown);
    toggle.addEventListener('touchend', function(e) {
        // Prevent both touchend and click from firing
        e.preventDefault();
        toggleDropdown(e);
    });
    
    // Add visual feedback for touch devices
    toggle.addEventListener('touchstart', function(e) {
        e.preventDefault();
        toggle.style.transform = 'scale(0.95)';
        toggle.style.opacity = '0.8';
    });
    
    toggle.addEventListener('touchend', function() {
        setTimeout(() => {
            toggle.style.transform = '';
            toggle.style.opacity = '';
        }, 150);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!adminDropdown.contains(e.target)) {
            adminDropdown.classList.remove('active');
        }
    });
    
    // Handle touch outside for mobile
    document.addEventListener('touchend', function(e) {
        if (!adminDropdown.contains(e.target)) {
            adminDropdown.classList.remove('active');
        }
    });

    // Close dropdown on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            adminDropdown.classList.remove('active');
        }
    });

    // Handle dropdown menu clicks
    dropdownMenu.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (link && link.getAttribute('href') !== '#') {
            // Allow normal navigation for actual links
            adminDropdown.classList.remove('active');
        }
    });
    
    // Add touch support for menu items
    const menuLinks = dropdownMenu.querySelectorAll('a');
    menuLinks.forEach(link => {
        link.addEventListener('touchstart', function() {
            this.style.transform = 'translateX(10px)';
            this.style.background = 'rgba(107, 70, 193, 0.1)';
        });
        
        link.addEventListener('touchend', function() {
            setTimeout(() => {
                this.style.transform = '';
                this.style.background = '';
            }, 200);
        });
    });
    
    console.log('✅ Admin dropdown initialized with mobile support');
}

// Initialize admin dropdown after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add small delay to ensure all elements are rendered
    setTimeout(initializeAdminDropdown, 100);
    
    // Check for VNPay payment result
    checkVNPayResult();
});

// Check VNPay payment result from URL parameters
function checkVNPayResult() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const orderId = urlParams.get('orderId');
    const amount = urlParams.get('amount');
    const error = urlParams.get('error');
    
    if (paymentStatus) {
        // Clear URL parameters
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        if (paymentStatus === 'success') {
            showVNPaySuccess(orderId, amount);
        } else if (paymentStatus === 'failed') {
            showVNPayFailure(orderId, error);
        } else if (paymentStatus === 'error') {
            showVNPayError(urlParams.get('message'));
        }
    }
}

// Show VNPay success notification
function showVNPaySuccess(orderId, amount) {
    const successNotification = document.createElement('div');
    successNotification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white;
        padding: 30px 40px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10002;
        text-align: center;
        font-family: 'Inter', sans-serif;
        max-width: 400px;
        width: 90%;
    `;
    
    const formattedAmount = parseFloat(amount).toLocaleString('vi-VN');
    
    successNotification.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
        <h3 style="margin: 0 0 1rem 0; font-size: 1.5rem; font-weight: 600;">Thanh toán thành công!</h3>
        <p style="margin: 0.5rem 0; opacity: 0.9;">Mã đơn hàng: <strong>${orderId}</strong></p>
        <p style="margin: 0.5rem 0; opacity: 0.9;">Số tiền: <strong>${formattedAmount} VNĐ</strong></p>
        <p style="margin: 0.5rem 0; opacity: 0.9; color: #90EE90;">✅ Đã thanh toán qua VNPay</p>
        <p style="margin: 1rem 0 0 0; font-size: 0.9rem; opacity: 0.8;">Chúng tôi sẽ liên hệ với bạn trong vòng 24h để xác nhận đơn hàng.</p>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 1.5rem;
            padding: 10px 20px;
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.3s ease;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
            Đóng
        </button>
    `;
    
    document.body.appendChild(successNotification);
    
    // Auto remove after 8 seconds
    setTimeout(() => {
        if (successNotification.parentElement) {
            successNotification.remove();
        }
    }, 8000);
    
    // Clear cart after successful payment
    if (window.cartItems) {
        window.cartItems = [];
    }
    if (typeof updateCartUI === 'function') {
        updateCartUI();
    }
}

// Show VNPay failure notification
function showVNPayFailure(orderId, errorCode) {
    const failureNotification = document.createElement('div');
    failureNotification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #f44336, #d32f2f);
        color: white;
        padding: 30px 40px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10002;
        text-align: center;
        font-family: 'Inter', sans-serif;
        max-width: 400px;
        width: 90%;
    `;
    
    let errorMessage = 'Thanh toán không thành công';
    switch(errorCode) {
        case '24':
            errorMessage = 'Giao dịch bị hủy bởi khách hàng';
            break;
        case '51':
            errorMessage = 'Tài khoản không đủ số dư';
            break;
        case '65':
            errorMessage = 'Tài khoản bị hạn chế giao dịch';
            break;
        default:
            errorMessage = `Thanh toán thất bại (Mã lỗi: ${errorCode || 'Unknown'})`;
    }
    
    failureNotification.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
        <h3 style="margin: 0 0 1rem 0; font-size: 1.5rem; font-weight: 600;">Thanh toán thất bại!</h3>
        <p style="margin: 0.5rem 0; opacity: 0.9;">${errorMessage}</p>
        ${orderId ? `<p style="margin: 0.5rem 0; opacity: 0.7; font-size: 0.9rem;">Mã giao dịch: ${orderId}</p>` : ''}
        <p style="margin: 1rem 0 0 0; font-size: 0.9rem; opacity: 0.8;">Vui lòng thử lại hoặc chọn phương thức thanh toán khác.</p>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 1.5rem;
            padding: 10px 20px;
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.3s ease;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
            Đóng
        </button>
    `;
    
    document.body.appendChild(failureNotification);
    
    // Auto remove after 10 seconds
    setTimeout(() => {
        if (failureNotification.parentElement) {
            failureNotification.remove();
        }
    }, 10000);
}

// Show VNPay error notification
function showVNPayError(message) {
    const errorNotification = document.createElement('div');
    errorNotification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #ff9800, #f57c00);
        color: white;
        padding: 30px 40px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10002;
        text-align: center;
        font-family: 'Inter', sans-serif;
        max-width: 400px;
        width: 90%;
    `;
    
    errorNotification.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <h3 style="margin: 0 0 1rem 0; font-size: 1.5rem; font-weight: 600;">Lỗi hệ thống!</h3>
        <p style="margin: 0.5rem 0; opacity: 0.9;">${message || 'Có lỗi xảy ra trong quá trình xử lý'}</p>
        <p style="margin: 1rem 0 0 0; font-size: 0.9rem; opacity: 0.8;">Vui lòng liên hệ bộ phận hỗ trợ.</p>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 1.5rem;
            padding: 10px 20px;
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.3s ease;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
            Đóng
        </button>
    `;
    
    document.body.appendChild(errorNotification);
    
    // Auto remove after 10 seconds
    setTimeout(() => {
        if (errorNotification.parentElement) {
            errorNotification.remove();
        }
    }, 10000);
}

// Make navigation function globally available
window.goToProductDetail = goToProductDetail;

// =====================================
// PRODUCT VIEW TOGGLE FUNCTIONALITY
// =====================================

// Initialize view toggle functionality
function initializeViewToggle() {
    const viewButtons = document.querySelectorAll('.view-btn');
    const productsGrid = document.querySelector('.products-grid');
    
    if (!viewButtons.length || !productsGrid) return;
    
    viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            const viewType = this.getAttribute('data-view');
            
            // Remove active class from all buttons
            viewButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Toggle grid classes
            if (viewType === 'list') {
                productsGrid.classList.add('list-view');
                // Store user preference
                localStorage.setItem('productViewMode', 'list');
            } else {
                productsGrid.classList.remove('list-view');
                // Store user preference
                localStorage.setItem('productViewMode', 'grid');
            }
            
            console.log(`📊 Switched to ${viewType} view`);
        });
    });
    
    // Load saved view preference
    const savedView = localStorage.getItem('productViewMode') || 'grid';
    if (savedView === 'list') {
        const listButton = document.querySelector('.view-btn[data-view="list"]');
        const gridButton = document.querySelector('.view-btn[data-view="grid"]');
        
        if (listButton && gridButton) {
            gridButton.classList.remove('active');
            listButton.classList.add('active');
            productsGrid.classList.add('list-view');
        }
    }
}

// Initialize view toggle when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initializeViewToggle, 100); // Small delay to ensure all elements are rendered
});

// =====================================
// LOGIN MODAL FUNCTIONALITY
// =====================================

let isLoginMode = true;

// Open login modal
function openLoginModal() {
    console.log('🔓 Mở login modal...');
    
    // Wait for DOM to be ready if it's not yet
    if (document.readyState === 'loading') {
        console.log('⏳ DOM đang load, đợi...');
        document.addEventListener('DOMContentLoaded', openLoginModal);
        return;
    }
    
    // Ensure modal exists (create if needed)
    const modal = ensureModalExists();
    
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Reset to login mode
        isLoginMode = true;
        showLoginForm();
        
        console.log('✅ Login modal đã mở');
        
        // Setup modal sau khi mở
        setTimeout(() => {
            setupLoginModal();
        }, 300);
        
    } else {
        console.error('❌ Không thể tạo login modal!');
        alert('Lỗi: Không thể mở modal đăng nhập!');
    }
}

// Close login modal
function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        // Clear form data
        clearForms();
    }
}

// Toggle between login and register
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        showLoginForm();
    } else {
        showRegisterForm();
    }
}

// Show login form
function showLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const modalTitle = document.getElementById('modalTitle');
    const toggleText = document.getElementById('toggleText');
    
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    if (modalTitle) modalTitle.textContent = 'Đăng Nhập';
    if (toggleText) {
        toggleText.innerHTML = 'Chưa có tài khoản? <a href="#" onclick="toggleAuthMode()">Đăng ký ngay</a>';
    }
    
    isLoginMode = true;
}

// Show register form
function showRegisterForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const modalTitle = document.getElementById('modalTitle');
    const toggleText = document.getElementById('toggleText');
    
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    if (modalTitle) modalTitle.textContent = 'Đăng Ký';
    if (toggleText) {
        toggleText.innerHTML = 'Đã có tài khoản? <a href="#" onclick="toggleAuthMode()">Đăng nhập ngay</a>';
    }
    
    isLoginMode = false;
}

// Handle forgot password
function handleForgotPassword() {
    const email = document.getElementById('loginEmail').value;
    
    if (!email) {
        showNotification('Vui lòng nhập email trước khi reset mật khẩu', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showNotification('Email không hợp lệ', 'error');
        return;
    }
    
    // Show loading message
    showNotification('Đang gửi email reset mật khẩu...', 'info');
    
    // Send password reset email using Firebase Auth
    firebase.auth().sendPasswordResetEmail(email)
        .then(() => {
            console.log('✅ Password reset email sent to:', email);
            showNotification('Email reset mật khẩu đã được gửi! Vui lòng kiểm tra hộp thư của bạn.', 'success');
            showForgotPasswordModal(email);
        })
        .catch((error) => {
            console.error('❌ Password reset error:', error);
            let errorMessage = 'Có lỗi xảy ra khi gửi email reset mật khẩu';
            
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'Không tìm thấy tài khoản với email này';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Email không hợp lệ';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Quá nhiều yêu cầu. Vui lòng thử lại sau';
            }
            
            showNotification(errorMessage, 'error');
        });
}

// Show forgot password confirmation modal
function showForgotPasswordModal(email) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'forgot-password-modal';
    modal.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        max-width: 500px;
        margin: 20px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    `;
    
    modal.innerHTML = `
        <div style="font-size: 60px; margin-bottom: 20px;">🔒</div>
        <h3 style="color: #333; margin-bottom: 15px;">Email Reset Mật Khẩu Đã Gửi</h3>
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            Chúng tôi đã gửi email chứa liên kết reset mật khẩu đến <strong>${email}</strong>. 
            Vui lòng kiểm tra hộp thư và click vào liên kết để đặt lại mật khẩu mới.
        </p>
        <div style="margin: 20px 0;">
            <button onclick="resendPasswordReset('${email}')" style="
                background: #007bff; 
                color: white; 
                border: none; 
                padding: 10px 20px; 
                border-radius: 5px; 
                cursor: pointer;
                margin-right: 10px;
            ">
                📧 Gửi Lại Email
            </button>
            <button onclick="closeForgotPasswordModal()" style="
                background: #6c757d; 
                color: white; 
                border: none; 
                padding: 10px 20px; 
                border-radius: 5px; 
                cursor: pointer;
            ">
                Đóng
            </button>
        </div>
        <p style="font-size: 12px; color: #999; margin-top: 15px;">
            Không thấy email? Kiểm tra thư mục spam hoặc click "Gửi Lại Email"
        </p>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Make close function global
    window.closeForgotPasswordModal = function() {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    };
    
    // Make resend function global
    window.resendPasswordReset = function(email) {
        handleForgotPassword();
    };
    
    // Close on overlay click
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeForgotPasswordModal();
        }
    });
}

// Clear all form data
function clearForms() {
    // Clear login form
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const rememberMe = document.getElementById('rememberMe');
    
    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';
    if (rememberMe) rememberMe.checked = false;
    
    // Clear register form
    const registerName = document.getElementById('registerName');
    const registerEmail = document.getElementById('registerEmail');
    const registerPhone = document.getElementById('registerPhone');
    const registerPassword = document.getElementById('registerPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const agreeTerms = document.getElementById('agreeTerms');
    
    if (registerName) registerName.value = '';
    if (registerEmail) registerEmail.value = '';
    if (registerPhone) registerPhone.value = '';
    if (registerPassword) registerPassword.value = '';
    if (confirmPassword) confirmPassword.value = '';
    if (agreeTerms) agreeTerms.checked = false;
}

// Handle login
function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    // Basic validation
    if (!email || !password) {
        showNotification('Vui lòng nhập đầy đủ email và mật khẩu!', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showNotification('Email không hợp lệ!', 'error');
        return;
    }
    
    // Show loading message
    showNotification('Đang đăng nhập...', 'info');
    
    // Send login request to backend
    fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: email,
            password: password
        })
    })
    .then(response => response.json())
    .then(async data => {
        // Check if user is banned (can come from error or is_banned field)
        if (data.is_banned === true || data.banned_reason) {
            const banMessage = data.banned_reason || 'Tài khoản đã bị khóa';
            showNotification(`🚫 Tài khoản bị khóa: ${banMessage}`, 'error');
            closeLoginModal();
            clearForms();
            return;
        }
        
        if (data.success) {
            showNotification('Đăng nhập thành công!', 'success');
            closeLoginModal();
            clearForms();
            
            // Store user data in localStorage
            localStorage.setItem('techHavenUser', JSON.stringify(data.user));
            
            // Also save with standard key for cross-page access (e.g. bill_detail page)
            localStorage.setItem('userData', JSON.stringify({
                uid: data.user.uid || data.user.userId,
                name: data.user.name || data.user.displayName,
                email: data.user.email,
                photo: data.user.photo || data.user.photoURL,
                provider: 'manual'
            }));
            console.log('💾 User data saved to localStorage for cross-page access');
            
            // If remember me is checked, store longer
            if (rememberMe) {
                localStorage.setItem('techHavenRememberMe', 'true');
            }
            
            // IMPORTANT: Sign in user to Firebase Auth client-side for manual users
            // This enables getIdToken() to work properly for address management
            try {
                console.log('🔐 Attempting to sign in manual user to Firebase Auth client-side...');
                if (window.signInWithEmailAndPassword) {
                    console.log('🔐 Using window.signInWithEmailAndPassword...');
                    await window.signInWithEmailAndPassword(email, password);
                    console.log('✅ Manual user signed in to Firebase Auth client-side via window function');
                } else if (window.firebase && window.firebase.auth) {
                    console.log('🔐 Using Firebase v8 to sign in manual user...');
                    const userCredential = await window.firebase.auth().signInWithEmailAndPassword(email, password);
                    console.log('✅ Manual user signed in to Firebase Auth v8:', userCredential.user.uid);
                    
                    // Get and log the ID token to verify it works
                    const idToken = await userCredential.user.getIdToken();
                    console.log('🎫 Firebase ID token obtained successfully for manual user');
                    
                    // Store the token for immediate use
                    localStorage.setItem('firebaseIdToken', idToken);
                } else {
                    console.error('❌ No Firebase Auth methods available');
                }
            } catch (authError) {
                console.error('❌ Could not sign in to Firebase Auth client-side:', authError);
                console.error('❌ Auth error details:', {
                    code: authError.code,
                    message: authError.message,
                    email: email
                });
                // Don't fail the whole login, just log warning
            }
            
            // Update UI to show logged in state
            updateUIForLoggedInUser(data.user);
            
            // IMMEDIATE CART SYNC: Load cart from Firebase immediately after login
            console.log('🛒 Loading cart immediately after manual login...');
            if (window.loadCartFromDatabase) {
                try {
                    await window.loadCartFromDatabase();
                    console.log('✅ Cart loaded immediately after manual login');
                } catch (cartError) {
                    console.warn('⚠️ Could not load cart after login:', cartError);
                }
            }
            
            // Force refresh the entire cart system to ensure synchronization
            if (window.forceRefreshCart) {
                try {
                    await window.forceRefreshCart();
                    console.log('✅ Cart force refreshed after manual login');
                } catch (refreshError) {
                    console.warn('⚠️ Could not force refresh cart:', refreshError);
                }
            }
            
            // Check and show welcome modal for users who haven't seen it yet (after 1 second)
            console.log('⏱️ Scheduling welcome modal check after manual login...');
            setTimeout(() => {
                if (typeof checkAndShowWelcomeModal === 'function') {
                    console.log('🎉 Calling checkAndShowWelcomeModal after manual login for user:', data.user?.email);
                    checkAndShowWelcomeModal(data.user);
                } else {
                    console.warn('⚠️ checkAndShowWelcomeModal function not found');
                }
            }, 1000);
            
            console.log('✅ Login successful:', data.user);
        } else {
            if (data.requiresVerification) {
                // Email not verified - show loading screen
                closeLoginModal();
                clearForms();
                showEmailVerificationLoadingScreen(data.email || email, { email: data.email || email });
                showNotification('Email chưa được xác thực. Vui lòng kiểm tra email và click vào link xác thực.', 'warning');
            } else {
                showNotification(data.error || 'Đăng nhập thất bại!', 'error');
            }
        }
    })
    .catch(error => {
        console.error('❌ Login error:', error);
        showNotification('Có lỗi xảy ra. Vui lòng thử lại!', 'error');
    });
}

// Handle register
function handleRegister() {
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    // Basic validation
    if (!name || !email || !phone || !password || !confirmPassword) {
        showNotification('Vui lòng điền đầy đủ thông tin!', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showNotification('Email không hợp lệ!', 'error');
        return;
    }
    
    if (!isValidPhone(phone)) {
        showNotification('Số điện thoại không hợp lệ! Vui lòng nhập số điện thoại Việt Nam (VD: 0901234567)', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Mật khẩu phải có ít nhất 6 ký tự!', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Mật khẩu xác nhận không khớp!', 'error');
        return;
    }
    
    if (!agreeTerms) {
        showNotification('Vui lòng đồng ý với điều khoản dịch vụ!', 'error');
        return;
    }
    
    // Show loading message
    showNotification('Đang tạo tài khoản...', 'info');
    
    // Send registration request to backend
    fetch('/api/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: name,
            email: email,
            phone: phone,
            password: password
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('📋 Registration API Response:', data);
        if (data.success) {
            if (data.requiresVerification) {
                // User created but needs email verification
                console.log('✅ Registration successful:', data.user);
                
                // Close login modal and clear forms first
                closeLoginModal();
                clearForms();
                
                // Show email verification loading screen
                const userData = data.user || { email: email, uid: data.uid };
                showEmailVerificationLoadingScreen(email, userData);
                
                // Send email verification using Firebase client SDK
                sendEmailVerificationToUser(email, password)
                    .then(() => {
                        console.log('📧 Email verification sent successfully');
                        showNotification('Email xác thực đã được gửi thành công!', 'success');
                    })
                    .catch((error) => {
                        console.error('❌ Error sending email verification:', error);
                        showNotification('Có lỗi khi gửi email xác thực. Vui lòng thử lại.', 'warning');
                    });
                
            } else {
                // Old flow for backward compatibility
                showNotification('Đăng ký thành công!', 'success');
                closeLoginModal();
                clearForms();
                
                // Store user data in localStorage
                localStorage.setItem('techHavenUser', JSON.stringify(data.user));
                
                // Update UI to show logged in state
                updateUIForLoggedInUser(data.user);
            }
            
            console.log('✅ Registration successful:', data.user || data);
        } else {
            console.error('❌ Registration failed:', data);
            showNotification(data.error || data.message || 'Đăng ký thất bại!', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Registration error:', error);
        showNotification('Có lỗi xảy ra. Vui lòng thử lại!', 'error');
    });
}

// Show email verification modal
// Send email verification using Firebase client SDK
async function sendEmailVerificationToUser(email, password) {
    try {
        console.log('🔐 Attempting to sign in user to send verification email...');
        
        // Sign in with the newly created user credentials using Firebase v8
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log('✅ User signed in, now sending verification email...');
        
        // Send verification email using Firebase v8 with default settings
        await user.sendEmailVerification();
        console.log('📧 Email verification sent successfully to:', email, '(using Firebase default settings)');
        
        // Keep user signed in so we can check verification status
        console.log('✅ User remains signed in for verification checking');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error in sendEmailVerificationToUser:', error);
        throw error;
    }
}

function showEmailVerificationModal(verificationLink, email) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'verification-modal';
    modal.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        max-width: 500px;
        margin: 20px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    `;
    
    modal.innerHTML = `
        <div style="font-size: 60px; margin-bottom: 20px;">📧</div>
        <h3 style="color: #333; margin-bottom: 15px;">Xác Thực Email</h3>
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            Chúng tôi đã gửi một email xác thực đến <strong>${email}</strong>. Vui lòng kiểm tra hộp thư và click vào link xác thực để kích hoạt tài khoản.
        </p>
        <div style="margin: 20px 0;">
            <button onclick="resendVerificationEmail('${email}')" style="
                background: #007bff; 
                color: white; 
                border: none; 
                padding: 10px 20px; 
                border-radius: 5px; 
                cursor: pointer;
                margin-right: 10px;
            ">
                📧 Gửi Lại Email
            </button>
            <button onclick="closeVerificationModal()" style="
                background: #6c757d; 
                color: white; 
                border: none; 
                padding: 10px 20px; 
                border-radius: 5px; 
                cursor: pointer;
            ">
                Đóng
            </button>
        </div>
        <p style="font-size: 12px; color: #999; margin-top: 15px;">
            Không thấy email? Kiểm tra thư mục spam hoặc click "Gửi Lại Email"
        </p>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Make close function global
    window.closeVerificationModal = function() {
        document.body.removeChild(overlay);
        delete window.closeVerificationModal;
        delete window.resendVerificationEmail;
    };
    
    // Make resend function global
    window.resendVerificationEmail = async function(email) {
        try {
            console.log('📧 Resending verification email to:', email);
            
            const response = await fetch('/api/resend-verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: email })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification(data.message || 'Email xác thực đã được gửi lại!', 'success');
            } else {
                showNotification(data.message || 'Có lỗi khi gửi lại email!', 'error');
            }
        } catch (error) {
            console.error('❌ Error resending email:', error);
            showNotification('Có lỗi xảy ra khi gửi lại email!', 'error');
        }
    };
    
    // Close on overlay click
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            window.closeVerificationModal();
        }
    });
}

// Email validation helper
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Phone validation helper (Vietnamese phone numbers)
function isValidPhone(phone) {
    // Remove all spaces and special characters
    const cleanPhone = phone.replace(/\s+/g, '').replace(/[-().]/g, '');
    
    // Vietnamese phone number patterns:
    // Mobile: 09xxxxxxxx, 08xxxxxxxx, 07xxxxxxxx, 05xxxxxxxx, 03xxxxxxxx
    // Or with +84: +849xxxxxxxx, +848xxxxxxxx, etc.
    const phoneRegex = /^(\+84|84|0)?(3[2-9]|5[689]|7[06-9]|8[1-689]|9[0-46-9])[0-9]{7}$/;
    
    return phoneRegex.test(cleanPhone);
}

// Update UI for logged in user
function updateUIForLoggedInUser(user) {
    console.log('🔄 Updating UI for logged in user:', user);
    
    // Store user info in localStorage for persistence FIRST
    localStorage.setItem('techHavenUser', JSON.stringify(user));
    
    // Also save with standard key for cross-page access (e.g. bill_detail page)
    localStorage.setItem('userData', JSON.stringify({
        uid: user.uid || user.userId,
        name: user.name || user.displayName,
        email: user.email,
        photo: user.photo || user.picture || user.photoURL,
        provider: user.provider || 'manual'
    }));
    console.log('💾 User data saved to localStorage for cross-page access');
    
    // Update global currentUser variable for other scripts BEFORE UI updates
    window.currentUser = user;
    
    // Check if this is a new user (no addresses) and show welcome modal
    checkAndShowWelcomeModal(user);
    
    // Update SmartCartManager with login status
    if (window.smartCart) {
        window.smartCart.setAuthStatus(true, user);
    }

    // Start real-time cart listener for cross-tab synchronization
    startCartRealtimeListener(user.uid);
    
    // Start real-time wishlist listener for cross-tab synchronization  
    startWishlistListener();
    
    // Load wishlist from Firestore
    loadWishlistFromFirestore();
    
    // Update user icon container in header
    const userIconContainer = document.getElementById('userIconContainer');
    if (userIconContainer) {
        const isAdmin = user.is_admin ? ' 👑' : '';
        const avatar = user.picture || user.photo;
        
        if (avatar) {
            // Google user with avatar
            userIconContainer.innerHTML = `
                <div class="user-icon-authenticated" onclick="openUserProfile()">
                    <img src="${avatar}" alt="${user.name}" class="user-avatar-small">
                    <span class="user-name-display">${user.name}${isAdmin}</span>
                </div>
            `;
        } else {
            // Manual user without avatar
            userIconContainer.innerHTML = `
                <div class="user-icon-authenticated" onclick="openUserProfile()">
                    <i class="fas fa-user-circle" style="margin-right: 8px; font-size: 20px;"></i>
                    <span class="user-name-display">${user.name}${isAdmin}</span>
                </div>
            `;
        }
    }
    
    // Also call the updateUserIcons function from EJS if it exists
    if (typeof updateUserIcons === 'function') {
        console.log('🔄 Calling updateUserIcons() from EJS template');
        updateUserIcons();
    }
    
    // Update all other user icons that might exist (fallback for old structure)
    const allUserIcons = document.querySelectorAll('.fas.fa-user[onclick*="openLoginModal"]');
    allUserIcons.forEach(icon => {
        const isAdmin = user.is_admin ? ' 👑' : '';
        const avatar = user.picture || user.photo;
        
        if (avatar) {
            // Replace with avatar and name
            icon.parentElement.innerHTML = `
                <div class="user-icon-authenticated" onclick="openUserProfile()" style="display: flex; align-items: center; cursor: pointer;">
                    <img src="${avatar}" alt="${user.name}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">
                    <span>${user.name}${isAdmin}</span>
                </div>
            `;
        } else {
            // Replace with user circle icon and name
            icon.parentElement.innerHTML = `
                <div class="user-icon-authenticated" onclick="openUserProfile()" style="display: flex; align-items: center; cursor: pointer; color: #667eea;">
                    <i class="fas fa-user-circle" style="margin-right: 8px; font-size: 20px;"></i>
                    <span>${user.name}${isAdmin}</span>
                </div>
            `;
        }
    });
    
    // Update mobile nav user link
    const mobileUserLink = document.getElementById('mobileUserLink');
    if (mobileUserLink) {
        const isAdmin = user.is_admin ? ' 👑' : '';
        const avatar = user.picture || user.photo;
        
        if (avatar) {
            mobileUserLink.innerHTML = `
                <img src="${avatar}" alt="${user.name}" style="width: 20px; height: 20px; border-radius: 50%; margin-right: 8px;">
                ${user.name}${isAdmin}
            `;
        } else {
            mobileUserLink.innerHTML = `<i class="fas fa-user-circle"></i> ${user.name}${isAdmin}`;
        }
        
        // Update onclick to open profile instead of login
        mobileUserLink.onclick = function(e) {
            e.preventDefault();
            openUserProfile();
            return false;
        };
    }
    
    // Update global currentUser variable for other scripts
    window.currentUser = user;
    
    // Update user profile panel if it exists
    if (typeof updateUserProfilePanel === 'function') {
        updateUserProfilePanel();
    }
    
    // IMMEDIATE cart sync for faster response
    if (window.loadCartFromDatabase) {
        window.loadCartFromDatabase().then(() => {
            console.log('✅ Immediate cart loaded in updateUIForLoggedInUser');
        }).catch(error => {
            console.warn('⚠️ Immediate cart load failed:', error);
        });
    }
    
    // Sync cart after user login - merge local cart with database cart
    setTimeout(async () => {
        try {
            console.log('🔄 Starting cart synchronization after user login...');
            await syncCartOnLogin();
            console.log('✅ Cart synchronization completed');
        } catch (error) {
            console.error('❌ Cart synchronization failed:', error);
        }
    }, 500); // Small delay to ensure all auth processes complete
    
    console.log('✅ UI updated successfully for:', user.name, user.provider === 'manual' ? '(Manual)' : '(Google)');
}

// Show notification (reuse existing function or create new one)
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const getIcon = (type) => {
        switch(type) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-circle';
            case 'warning': return 'exclamation-triangle';
            default: return 'info-circle';
        }
    };
    
    const getColor = (type) => {
        switch(type) {
            case 'success': return '#4CAF50';
            case 'error': return '#f44336';
            case 'warning': return '#ff9800';
            default: return '#2196F3';
        }
    };
    
    notification.innerHTML = `
        <i class="fas fa-${getIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    // Calculate position based on existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    const topOffset = 20 + (existingNotifications.length * 80); // Stack notifications
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: ${topOffset}px;
        right: 20px;
        background: ${getColor(type)};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 500;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 400px;
        word-wrap: break-word;
        pointer-events: auto;
        cursor: pointer;
    `;
    
    document.body.appendChild(notification);
    
    // Add click to dismiss
    notification.addEventListener('click', function() {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    });
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Edit user profile
function editUserProfile() {
    console.log('📝 Redirecting to edit profile page...');
    
    // Get current user data
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('techHavenUser'));
    
    if (!currentUser) {
        showNotification('Vui lòng đăng nhập để chỉnh sửa hồ sơ!', 'error');
        return;
    }
    
    // Redirect to dedicated edit profile page
    window.location.href = '/edit-profile';
}

// =====================================
// WELCOME ADDRESS MODAL FOR NEW USERS
// =====================================

// Check if user is new and show welcome modal
async function checkAndShowWelcomeModal(user, retryCount = 0) {
    // Safety check: Only proceed if user is logged in
    if (!user || !user.uid) {
        console.log('⚠️ No user logged in, skipping welcome modal check');
        return;
    }
    
    try {
        // Check Firestore to see if user has seen welcome modal before
        if (!window.db) {
            console.warn('⚠️ Firestore not available, skipping welcome modal check');
            return;
        }
        
        const userDocRef = window.firebase.firestore().doc(`users/${user.uid}`);
        const userDoc = await userDocRef.get();
        
        if (!userDoc.exists) {
            console.log('🆕 User document does not exist yet');
            
            // Retry up to 3 times with exponential backoff
            if (retryCount < 3) {
                const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                console.log(`⏳ Retrying in ${waitTime}ms (attempt ${retryCount + 1}/3)...`);
                setTimeout(async () => {
                    await checkAndShowWelcomeModal(user, retryCount + 1);
                }, waitTime);
            } else {
                console.warn('⚠️ Max retries reached, user document still does not exist');
            }
            return;
        }
        
        const userData = userDoc.data();
        
        // Check if user has already seen the welcome modal
        if (userData.hasSeenWelcomeModal === true) {
            console.log('✅ User has already seen welcome modal, skipping');
            return;
        }
        
        // Check if user already has addresses
        const hasAddresses = userData.addresses && userData.addresses.length > 0;
        
        console.log('📍 User status check:', {
            hasAddresses,
            hasSeenModal: userData.hasSeenWelcomeModal === true,
            uid: user.uid
        });
        
        // If user has no addresses AND hasn't seen modal, show it
        if (!hasAddresses && userData.hasSeenWelcomeModal !== true) {
            console.log('🎉 First time user without addresses - showing welcome modal');
            
            // Mark as seen in Firestore BEFORE showing modal to prevent duplicate shows
            await userDocRef.update({
                hasSeenWelcomeModal: true,
                welcomeModalShownAt: window.firebase.firestore.FieldValue.serverTimestamp()
            });
            
            setTimeout(() => {
                showWelcomeAddressModal();
            }, 500); // Delay to let login modal close first
        } else {
            console.log('ℹ️ User either has addresses or has seen modal before');
        }
    } catch (error) {
        console.error('❌ Error checking user welcome modal status:', error);
    }
}

// Show welcome address modal
function showWelcomeAddressModal() {
    // Double check user is still logged in before showing modal
    if (!window.currentUser || !window.currentUser.uid) {
        console.log('⚠️ User not logged in, cannot show welcome modal');
        return;
    }
    
    const modal = document.getElementById('welcomeAddressModal');
    if (modal) {
        modal.classList.add('active');
        console.log('🏠 Welcome address modal opened');
    }
}

// Skip welcome address
async function skipWelcomeAddress() {
    // Ensure user is logged in
    if (!window.currentUser || !window.currentUser.uid) {
        console.log('⚠️ User not logged in, cannot skip welcome modal');
        return;
    }
    
    try {
        // Update Firestore to mark modal as handled (skipped)
        if (window.firebase && window.firebase.firestore) {
            const userDocRef = window.firebase.firestore().doc(`users/${window.currentUser.uid}`);
            await userDocRef.update({
                hasSeenWelcomeModal: true,
                welcomeModalSkippedAt: window.firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Marked welcome modal as skipped in Firestore');
        }
    } catch (error) {
        console.error('❌ Error updating Firestore:', error);
    }
    
    const modal = document.getElementById('welcomeAddressModal');
    if (modal) {
        modal.classList.remove('active');
        showNotification('Bạn có thể thêm địa chỉ sau trong Hồ sơ của mình', 'info');
    }
}

// Save welcome address
async function saveWelcomeAddress() {
    if (!window.currentUser) {
        alert('Vui lòng đăng nhập để lưu địa chỉ');
        return;
    }
    
    // Check if address is verified
    if (!window.welcomeAddressVerified) {
        alert('⚠️ Vui lòng xác thực địa chỉ trước khi lưu!');
        return;
    }
    
    // Get form values
    const address = document.getElementById('welcomeAddress')?.value.trim();
    const city = document.getElementById('welcomeCity')?.value;
    const district = document.getElementById('welcomeDistrict')?.value.trim();
    const setAsDefault = document.getElementById('welcomeSetDefault')?.checked || false;
    
    // Validation
    if (!address || !city || !district) {
        alert('Vui lòng điền đầy đủ thông tin địa chỉ');
        return;
    }
    
    try {
        const addressData = {
            address,
            city,
            district,
            isDefault: setAsDefault,
            coordinates: window.welcomeVerifiedCoordinates || null
        };
        
        let response;
        
        // Check if user is manual login or Google login
        const isManualUser = window.currentUser.provider === 'manual';
        
        if (isManualUser) {
            response = await fetch(`/api/user/addresses/by-uid/${window.currentUser.uid}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(addressData)
            });
        } else {
            const token = await window.getIdToken();
            response = await fetch('/api/user/addresses', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(addressData)
            });
        }
        
        if (response.ok) {
            // Update Firestore to mark modal as handled (address saved)
            try {
                if (window.firebase && window.firebase.firestore) {
                    const userDocRef = window.firebase.firestore().doc(`users/${window.currentUser.uid}`);
                    await userDocRef.update({
                        hasSeenWelcomeModal: true,
                        welcomeModalCompletedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                    });
                    console.log('✅ Marked welcome modal as completed in Firestore');
                }
            } catch (firestoreError) {
                console.error('⚠️ Error updating Firestore:', firestoreError);
                // Don't fail the whole operation if Firestore update fails
            }
            
            // Close modal
            const modal = document.getElementById('welcomeAddressModal');
            if (modal) {
                modal.classList.remove('active');
            }
            
            // Reset verification status
            window.welcomeAddressVerified = false;
            window.welcomeVerifiedCoordinates = null;
            
            showNotification('✅ Địa chỉ đã được lưu thành công!', 'success');
            console.log('✅ Welcome address saved successfully');
        } else {
            const error = await response.json();
            alert(error.error || 'Có lỗi xảy ra khi lưu địa chỉ');
        }
    } catch (error) {
        console.error('❌ Error saving welcome address:', error);
        alert('Có lỗi xảy ra khi lưu địa chỉ. Vui lòng thử lại.');
    }
}

// Verify welcome address with Google Maps
async function verifyWelcomeAddress() {
    // Get form values
    const address = document.getElementById('welcomeAddress')?.value.trim();
    const city = document.getElementById('welcomeCity')?.value;
    const district = document.getElementById('welcomeDistrict')?.value.trim();
    
    // Validation
    if (!address || !city || !district) {
        alert('⚠️ Vui lòng điền đầy đủ thông tin địa chỉ trước khi xác thực!');
        return;
    }
    
    // Get city name for search
    const cityNames = {
        'hanoi': 'Hà Nội',
        'hcm': 'TP. Hồ Chí Minh',
        'danang': 'Đà Nẵng',
        'haiphong': 'Hải Phòng',
        'cantho': 'Cần Thơ',
        'angiang': 'An Giang',
        'bacgiang': 'Bắc Giang',
        'backan': 'Bắc Kạn',
        'baclieu': 'Bạc Liêu',
        'bacninh': 'Bắc Ninh',
        'baria': 'Bà Rịa - Vũng Tàu',
        'bentre': 'Bến Tre',
        'binhdinh': 'Bình Định',
        'binhduong': 'Bình Dương',
        'binhphuoc': 'Bình Phước',
        'binhthuan': 'Bình Thuận',
        'camau': 'Cà Mau',
        'caobang': 'Cao Bằng',
        'daklak': 'Đắk Lắk',
        'daknong': 'Đắk Nông',
        'dienbien': 'Điện Biên',
        'dongnai': 'Đồng Nai',
        'dongthap': 'Đồng Tháp',
        'gialai': 'Gia Lai',
        'hagiang': 'Hà Giang',
        'hanam': 'Hà Nam',
        'hatinh': 'Hà Tĩnh',
        'haiduong': 'Hải Dương',
        'haugiang': 'Hậu Giang',
        'hoabinh': 'Hòa Bình',
        'hungyen': 'Hưng Yên',
        'khanhhoa': 'Khánh Hòa',
        'kiengiang': 'Kiên Giang',
        'kontum': 'Kon Tum',
        'laichau': 'Lai Châu',
        'lamdong': 'Lâm Đồng',
        'langson': 'Lạng Sơn',
        'laocai': 'Lào Cai',
        'longan': 'Long An',
        'namdinh': 'Nam Định',
        'nghean': 'Nghệ An',
        'ninhbinh': 'Ninh Bình',
        'ninhthuan': 'Ninh Thuận',
        'phutho': 'Phú Thọ',
        'phuyen': 'Phú Yên',
        'quangbinh': 'Quảng Bình',
        'quangnam': 'Quảng Nam',
        'quangngai': 'Quảng Ngãi',
        'quangninh': 'Quảng Ninh',
        'quangtri': 'Quảng Trị',
        'soctrang': 'Sóc Trăng',
        'sonla': 'Sơn La',
        'tayninh': 'Tây Ninh',
        'thaibinh': 'Thái Bình',
        'thainguyen': 'Thái Nguyên',
        'thanhhoa': 'Thanh Hóa',
        'thuathienhue': 'Thừa Thiên Huế',
        'tiengiang': 'Tiền Giang',
        'travinh': 'Trà Vinh',
        'tuyenquang': 'Tuyên Quang',
        'vinhlong': 'Vĩnh Long',
        'vinhphuc': 'Vĩnh Phúc',
        'yenbai': 'Yên Bái'
    };
    const cityName = cityNames[city] || city;
    const fullAddress = `${address}, ${district}, ${cityName}, Vietnam`;
    
    console.log('🗺️ Verifying welcome address:', fullAddress);
    
    // Clear previous verification status
    localStorage.removeItem('welcomeAddressVerified');
    localStorage.removeItem('welcomeVerifiedAddress');
    
    // Create verification page URL
    const encodedAddress = encodeURIComponent(fullAddress);
    const verificationUrl = `/verify-address.html?address=${encodedAddress}&return=${encodeURIComponent(window.location.href)}&mode=welcome`;
    
    // Show verification pending status
    const verifyBtn = document.querySelector('.btn-verify-welcome-address');
    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xác thực...';
    }
    
    // Open verification page in new window
    const verifyWindow = window.open(
        verificationUrl, 
        'AddressVerification',
        'width=1200,height=800,resizable=yes,scrollbars=yes'
    );
    
    // Listen for messages from verification window
    window.addEventListener('message', handleWelcomeVerificationResponse, false);
    
    // Check verification status periodically (fallback)
    const checkInterval = setInterval(() => {
        const verified = localStorage.getItem('welcomeAddressVerified');
        const verifiedAddressData = localStorage.getItem('welcomeVerifiedAddress');
        
        if (verified === 'true' && verifiedAddressData) {
            clearInterval(checkInterval);
            
            try {
                const data = JSON.parse(verifiedAddressData);
                window.welcomeVerifiedCoordinates = data.coordinates;
                handleWelcomeSuccessfulVerification();
            } catch (e) {
                console.error('Error parsing verified address:', e);
            }
        } else if (verified === 'cancelled') {
            clearInterval(checkInterval);
            handleWelcomeCancelledVerification();
        }
        
        // Check if window is closed
        if (verifyWindow && verifyWindow.closed) {
            clearInterval(checkInterval);
            if (verified !== 'true') {
                handleWelcomeCancelledVerification();
            }
        }
    }, 1000);
}

// Handle welcome verification response from popup
function handleWelcomeVerificationResponse(event) {
    if (event.data && event.data.type === 'addressVerified' && event.data.mode === 'welcome') {
        console.log('✅ Welcome address verified via postMessage:', event.data);
        
        // Store coordinates
        window.welcomeVerifiedCoordinates = event.data.coordinates;
        
        // Mark as verified
        handleWelcomeSuccessfulVerification();
        
        // Remove event listener
        window.removeEventListener('message', handleWelcomeVerificationResponse);
    }
}

// Handle successful welcome verification
function handleWelcomeSuccessfulVerification() {
    // Mark as verified
    window.welcomeAddressVerified = true;
    
    // Show save button, hide verify button
    const saveBtn = document.querySelector('.btn-save-address');
    const verifyBtn = document.querySelector('.btn-verify-welcome-address');
    
    if (saveBtn) {
        saveBtn.style.display = 'flex';
    }
    
    if (verifyBtn) {
        verifyBtn.style.display = 'none';
    }
    
    // Display coordinates if available
    if (window.welcomeVerifiedCoordinates && window.welcomeVerifiedCoordinates.lat && window.welcomeVerifiedCoordinates.lng) {
        const coordDisplay = document.querySelector('.welcome-coordinates-display');
        const coordText = document.querySelector('.welcome-coordinates-text');
        
        if (coordDisplay && coordText) {
            coordText.textContent = `Lat: ${window.welcomeVerifiedCoordinates.lat.toFixed(6)}, Lng: ${window.welcomeVerifiedCoordinates.lng.toFixed(6)}`;
            coordDisplay.style.display = 'block';
        }
    }
    
    // Clear localStorage
    setTimeout(() => {
        localStorage.removeItem('welcomeAddressVerified');
        localStorage.removeItem('welcomeVerifiedAddress');
    }, 1000);
    
    if (window.showNotification) {
        showNotification('✅ Địa chỉ đã được xác thực thành công!', 'success');
    } else {
        alert('✅ Địa chỉ đã được xác thực thành công!');
    }
}

// Handle cancelled welcome verification
function handleWelcomeCancelledVerification() {
    // Reset button state
    const verifyBtn = document.querySelector('.btn-verify-welcome-address');
    if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Xác thực địa chỉ';
    }
    
    // Clear localStorage
    setTimeout(() => {
        localStorage.removeItem('welcomeAddressVerified');
        localStorage.removeItem('welcomeVerifiedAddress');
    }, 1000);
    
    if (window.showNotification) {
        showNotification('❌ Xác thực địa chỉ đã bị hủy', 'error');
    }
}

// Initialize global verification flags
window.welcomeAddressVerified = false;
window.welcomeVerifiedCoordinates = null;

// Make functions globally available
window.checkAndShowWelcomeModal = checkAndShowWelcomeModal;
window.showWelcomeAddressModal = showWelcomeAddressModal;
window.skipWelcomeAddress = skipWelcomeAddress;
window.saveWelcomeAddress = saveWelcomeAddress;
window.verifyWelcomeAddress = verifyWelcomeAddress;

// Show edit profile modal
function showEditProfileModal(user) {
    console.log('🔧 Creating edit profile modal for user:', user);
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0,0,0,0.8) !important;
        z-index: 9500 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    `;
    
    console.log('📄 Modal overlay created:', overlay);
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'edit-profile-modal';
    modal.style.cssText = `
        background: white !important;
        padding: 30px !important;
        border-radius: 10px !important;
        max-width: 500px !important;
        width: 90% !important;
        margin: 20px !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2) !important;
        max-height: none !important;
        min-height: 400px !important;
        overflow: visible !important;
        z-index: 9500 !important;
        position: relative !important;
        color: #333 !important;
        font-family: Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 1.5 !important;
        display: block !important;
        visibility: visible !important;
    `;
    
    modal.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
            <h3 style="color: #333; margin: 0;">
                <i class="fas fa-edit"></i> Chỉnh Sửa Hồ Sơ
            </h3>
            <button onclick="closeEditProfileModal()" style="
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #999;
            ">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <form id="editProfileForm">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">
                    Họ và tên:
                </label>
                <input type="text" id="editName" value="${user.name || ''}" style="
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    font-size: 14px;
                    box-sizing: border-box;
                " required>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">
                    Email:
                </label>
                <input type="email" id="editEmail" value="${user.email || ''}" style="
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    font-size: 14px;
                    box-sizing: border-box;
                    background: #f5f5f5;
                " readonly>
                <small style="color: #666; font-size: 12px;">Email không thể thay đổi</small>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">
                    Số điện thoại:
                </label>
                <input type="tel" id="editPhone" value="${user.phone || ''}" style="
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    font-size: 14px;
                    box-sizing: border-box;
                " placeholder="Nhập số điện thoại">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">
                    Avatar URL (tùy chọn):
                </label>
                <input type="url" id="editAvatar" value="${user.photo || ''}" style="
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    font-size: 14px;
                    box-sizing: border-box;
                " placeholder="https://example.com/avatar.jpg">
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" onclick="closeEditProfileModal()" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                ">
                    Hủy
                </button>
                <button type="submit" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                ">
                    <i class="fas fa-save"></i> Lưu Thay Đổi
                </button>
            </div>
        </form>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Add form submit handler
    const form = modal.querySelector('#editProfileForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const name = document.getElementById('editName').value.trim();
            const phone = document.getElementById('editPhone').value.trim();
            const avatar = document.getElementById('editAvatar').value.trim();
            
            if (!name) {
                alert('Vui lòng nhập họ và tên!');
                return;
            }
            
            try {
                const response = await fetch('/api/user/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: name,
                        phone: phone,
                        avatar: avatar
                    })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // Update current user data
                    if (window.currentUser) {
                        window.currentUser.name = name;
                        window.currentUser.phone = phone;
                        window.currentUser.avatar = avatar;
                        
                        // Update localStorage for manual users
                        if (window.currentUser.provider === 'manual') {
                            localStorage.setItem('techHavenUser', JSON.stringify(window.currentUser));
                        }
                        
                        // Update UI
                        updateUIForLoggedInUser(window.currentUser);
                    }
                    
                    closeEditProfileModal();
                    alert('Cập nhật hồ sơ thành công!');
                } else {
                    alert(result.message || 'Có lỗi xảy ra khi cập nhật hồ sơ');
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                alert('Có lỗi xảy ra khi cập nhật hồ sơ');
            }
        });
    }
    
    console.log('✅ Modal appended to body. Modal should be visible now!');
    console.log('📊 Modal overlay in DOM:', document.body.contains(overlay));
    console.log('📊 Modal z-index:', overlay.style.zIndex);
    
    // Debug form elements
    const editForm = document.getElementById('editProfileForm');
    const editName = document.getElementById('editName');
    console.log('📋 Edit form found:', !!editForm);
    console.log('📋 Edit name input found:', !!editName);
    console.log('📋 Modal innerHTML length:', modal.innerHTML.length);
    
    // Debug styling issues
    console.log('📊 Body overflow:', window.getComputedStyle(document.body).overflow);
    console.log('📊 Modal display:', window.getComputedStyle(overlay).display);
    console.log('📊 Modal visibility:', window.getComputedStyle(overlay).visibility);
    console.log('📊 Modal position:', window.getComputedStyle(overlay).position);
    
    // Force modal to be visible and on top
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '9500';
    overlay.style.display = 'flex';
    overlay.style.visibility = 'visible';
    
    // Make sure body doesn't hide overflow
    document.body.style.overflow = 'hidden';
    
    console.log('🔧 Applied force styling to modal');
    
    // Handle form submission
    document.getElementById('editProfileForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('editName').value;
        const phone = document.getElementById('editPhone').value;
        const avatar = document.getElementById('editAvatar').value;
        
        // Validate
        if (!name.trim()) {
            showNotification('Vui lòng nhập họ và tên!', 'error');
            return;
        }
        
        if (phone && !isValidPhone(phone)) {
            showNotification('Số điện thoại không hợp lệ!', 'error');
            return;
        }
        
        // Show loading
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
        submitBtn.disabled = true;
        
        try {
            // Send update request
            const response = await fetch('/api/user/profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uid: user.uid,
                    name: name.trim(),
                    phone: phone.trim(),
                    photo: avatar.trim()
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Update local user data
                const updatedUser = {
                    ...user,
                    name: name.trim(),
                    phone: phone.trim(),
                    photo: avatar.trim()
                };
                
                // Update localStorage
                localStorage.setItem('techHavenUser', JSON.stringify(updatedUser));
                window.currentUser = updatedUser;
                
                // Update UI
                updateUIForLoggedInUser(updatedUser);
                
                showNotification('Cập nhật hồ sơ thành công!', 'success');
                closeEditProfileModal();
            } else {
                showNotification(data.message || 'Có lỗi xảy ra khi cập nhật hồ sơ!', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showNotification('Có lỗi xảy ra khi cập nhật hồ sơ!', 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
    
    // Close on overlay click
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeEditProfileModal();
        }
    });
    
    // Make close function global
    window.closeEditProfileModal = function() {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    };
}

// Make functions globally available
window.editUserProfile = editUserProfile;

// Debug function to check modal state
function debugModal() {
    const modal = document.getElementById('loginModal');
    console.log('=== MODAL DEBUG ===');
    console.log('Modal element:', modal);
    console.log('Modal classes:', modal ? modal.className : 'Modal not found');
    console.log('Modal style display:', modal ? modal.style.display : 'N/A');
    console.log('Modal computed styles:', modal ? window.getComputedStyle(modal) : 'N/A');
    console.log('Body overflow:', document.body.style.overflow);
    console.log('Document ready state:', document.readyState);
    console.log('All elements with loginModal ID:', document.querySelectorAll('#loginModal'));
    console.log('All elements with login-modal-overlay class:', document.querySelectorAll('.login-modal-overlay'));
    console.log('==================');
}

// Function to ensure modal exists (create if not found)
function ensureModalExists() {
    let modal = document.getElementById('loginModal');
    
    if (!modal) {
        console.log('🏗️ Creating login modal since it was not found...');
        
        // Create the modal HTML
        const modalHTML = `
        <div class="login-modal-overlay" id="loginModal">
            <div class="login-modal">
                <div class="login-modal-header">
                    <h3 id="modalTitle">Đăng Nhập</h3>
                    <button class="close-login-modal" onclick="closeLoginModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="login-modal-content">
                    <!-- Login Form -->
                    <div class="login-form" id="loginForm">
                        <div class="form-group">
                            <label for="loginEmail">Email</label>
                            <input type="email" id="loginEmail" placeholder="Nhập email của bạn" required>
                        </div>
                        <div class="form-group">
                            <label for="loginPassword">Mật khẩu</label>
                            <input type="password" id="loginPassword" placeholder="Nhập mật khẩu" required>
                        </div>
                        <div class="form-options">
                            <label class="remember-me">
                                <input type="checkbox" id="rememberMe">
                                <span>Ghi nhớ đăng nhập</span>
                            </label>
                            <a href="#" class="forgot-password">Quên mật khẩu?</a>
                        </div>
                        <button class="login-btn" onclick="handleLogin()">
                            <i class="fas fa-sign-in-alt"></i> Đăng Nhập
                        </button>
                    </div>

                    <!-- Register Form -->
                    <div class="register-form" id="registerForm" style="display: none;">
                        <div class="form-group">
                            <label for="registerName">Họ và tên</label>
                            <input type="text" id="registerName" placeholder="Nhập họ và tên" required>
                        </div>
                        <div class="form-group">
                            <label for="registerEmail">Email</label>
                            <input type="email" id="registerEmail" placeholder="Nhập email của bạn" required>
                        </div>
                        <div class="form-group">
                            <label for="registerPhone">Số điện thoại</label>
                            <input type="tel" id="registerPhone" placeholder="Nhập số điện thoại (VD: 0901234567)" required>
                        </div>
                        <div class="form-group">
                            <label for="registerPassword">Mật khẩu</label>
                            <input type="password" id="registerPassword" placeholder="Nhập mật khẩu" required>
                        </div>
                        <div class="form-group">
                            <label for="confirmPassword">Xác nhận mật khẩu</label>
                            <input type="password" id="confirmPassword" placeholder="Nhập lại mật khẩu" required>
                        </div>
                        <div class="form-options">
                            <label class="agree-terms">
                                <input type="checkbox" id="agreeTerms" required>
                                <span>Tôi đồng ý với <a href="#">Điều khoản dịch vụ</a></span>
                            </label>
                        </div>
                        <button class="register-btn" onclick="handleRegister()">
                            <i class="fas fa-user-plus"></i> Đăng Ký
                        </button>
                    </div>

                    <!-- Social Login -->
                    <div class="social-login">
                        <div class="divider">
                            <span>hoặc</span>
                        </div>
                        <a href="/auth/google" class="google-signin-btn" style="text-decoration: none; display: inline-block; width: 100%; text-align: center;">
                            <i class="fab fa-google"></i>
                            Đăng nhập với Google
                        </a>
                    </div>

                    <!-- Toggle between Login/Register -->
                    <div class="modal-footer">
                        <p id="toggleText">
                            Chưa có tài khoản? 
                            <a href="#" onclick="toggleAuthMode()">Đăng ký ngay</a>
                        </p>
                    </div>
                </div>
            </div>
        </div>`;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('loginModal');
        console.log('✅ Login modal created:', modal);
        
        showNotification('Modal đăng nhập đã được tạo!', 'success');
    }
    
    return modal;
}

// Setup login modal (đơn giản)
function setupLoginModal() {
    console.log('⚙️ Thiết lập login modal');
    // Modal sẽ được tự động tạo khi cần thiết
}

// Alternative Google Sign-In method  
function showGoogleSignInPopup() {
    console.log('🔄 Trying alternative Google Sign-In method...');
    
    if (window.googleApiLoaded && typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        try {
            // Generate OAuth URL manually
            const redirectUri = window.location.origin;
            const clientId = '442337591630-ab2m15n55vdi1700gs5qvufrpcfol58t.apps.googleusercontent.com';
            const scope = 'profile email';
            const responseType = 'code';
            
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${clientId}&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                `response_type=${responseType}&` +
                `scope=${encodeURIComponent(scope)}&` +
                `access_type=offline&` +
                `prompt=select_account`;
            
            console.log('Opening Google OAuth popup:', authUrl);
            
            // Open popup window
            const popup = window.open(
                authUrl,
                'google-signin',
                'width=500,height=600,scrollbars=yes,resizable=yes'
            );
            
            if (popup) {
                showNotification('Đang mở cửa sổ đăng nhập Google...', 'info');
                
                // Monitor popup for completion
                const checkClosed = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkClosed);
                        console.log('Google Sign-In popup closed');
                        showNotification('Cửa sổ đăng nhập đã đóng', 'info');
                    }
                }, 1000);
            } else {
                showNotification('Không thể mở cửa sổ đăng nhập. Vui lòng bật popup!', 'error');
            }
            
        } catch (error) {
            console.error('Error with alternative Google Sign-In:', error);
            showNotification('Lỗi đăng nhập Google: ' + error.message, 'error');
        }
    } else {
        console.error('Google API still not available for alternative method');
        showNotification('Google API không khả dụng', 'error');
    }
    console.log('🚀 Trying alternative Google Sign-In method...');
    
    // Create a temporary div for Google button
    const tempDiv = document.createElement('div');
    tempDiv.id = 'g_id_onload';
    tempDiv.setAttribute('data-client_id', '442337591630-ab2m15n55vdi1700gs5qvufrpcfol58t.apps.googleusercontent.com');
    tempDiv.setAttribute('data-callback', 'handleGoogleSignIn');
    tempDiv.setAttribute('data-auto_prompt', 'false');
    
    document.body.appendChild(tempDiv);
    
    // Render Google button
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.renderButton(tempDiv, {
            theme: 'outline',
            size: 'large'
        });
        
        // Trigger click on rendered button
        setTimeout(() => {
            const gButton = tempDiv.querySelector('iframe');
            if (gButton) {
                gButton.click();
            }
        }, 500);
    }
}

// Show Google One Tap
function showGoogleOneTap() {
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.prompt();
    }
}

// Handle Google Sign-In response
function handleGoogleSignIn(response) {
    try {
        // Decode the JWT token to get user information
        const userInfo = parseJwt(response.credential);
        console.log('Google Sign-In successful:', userInfo);
        
        // Show loading notification
        showNotification('Đang đăng nhập với Google...', 'info');
        
        // Simulate processing time
        setTimeout(() => {
            // Close login modal
            closeLoginModal();
            
            // Update UI with user info
            updateUIForLoggedInUser({
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                googleId: userInfo.sub
            });
            
            // Show success notification
            showNotification(`Chào mừng ${userInfo.name}!`, 'success');
            
            // Here you would typically send the token to your backend
            // to verify and create/update user account
            console.log('User info:', {
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                googleId: userInfo.sub
            });
            
        }, 1000);
        
    } catch (error) {
        console.error('Error handling Google Sign-In:', error);
        showNotification('Đăng nhập Google thất bại!', 'error');
    }
}

// Parse JWT token (simple implementation)
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error parsing JWT:', error);
        return null;
    }
}

// =====================================
// SERVER-SIDE AUTHENTICATION SUPPORT
// =====================================

// Hàm đăng nhập với Google (server-side)
window.handleGoogleLogin = function() {
    console.log('� Đăng nhập với Google (server-side)');
    window.location.href = '/auth/google';
};

// Hàm đăng xuất cho cả Google và manual users
window.handleLogout = function() {
    console.log('🚪 Đăng xuất');
    
    // Close welcome modal if it's open
    const welcomeModal = document.getElementById('welcomeAddressModal');
    if (welcomeModal) {
        welcomeModal.classList.remove('active');
    }
    
    // Clear user data from localStorage
    localStorage.removeItem('techHavenUser');
    localStorage.removeItem('techHavenRememberMe');
    localStorage.removeItem('techHavenAuthToken');
    
    // Clear cart data completely for guest mode
    localStorage.removeItem('techHavenCart');
    localStorage.removeItem('techHavenCartCount');
    
    // Stop cart real-time listener
    stopCartRealtimeListener();
    
    // Stop wishlist real-time listener
    if (wishlistListener) {
        wishlistListener();
        wishlistListener = null;
    }
    
    // Clear wishlist data
    wishlistItems = [];
    localStorage.removeItem('techHavenWishlist');

    // Update SmartCartManager with logout status
    if (window.smartCart) {
        window.smartCart.setAuthStatus(false, null);
        // Clear SmartCart internal data
        window.smartCart.clearCart();
    }
    
    // Reset global variables
    window.currentUser = null;
    cartItems = [];
    cartCount = 0;
    
    // Force clear window.cart if it exists (from index.ejs)
    if (window.cart) {
        window.cart = [];
    }
    
    // Reset UI to logged out state
    const userIcons = document.querySelectorAll('.fas.fa-user, .fa-user-circle');
    userIcons.forEach(icon => {
        if (icon.parentElement) {
            icon.parentElement.innerHTML = '<i class="fas fa-user" onclick="openLoginModal()" style="cursor: pointer;"></i>';
            icon.parentElement.style.color = '';
            icon.parentElement.style.display = '';
        }
    });
    
    // Update mobile nav
    const mobileUserLink = document.querySelector('#mobileUserLink');
    if (mobileUserLink) {
        mobileUserLink.innerHTML = '<i class="fas fa-user"></i> Tài khoản';
        mobileUserLink.onclick = function() { openLoginModal(); return false; };
    }
    
    // Update cart UI to empty state
    updateCartUI();
    
    // Force update cart badge to 0 (both desktop and mobile)
    const cartBadge = document.getElementById('cartBadge');
    const cartCount = document.getElementById('cartCount');
    // Note: cartCount is the mobile cart count element
    
    if (cartBadge) {
        cartBadge.textContent = '0';
        cartBadge.style.display = 'none';
        cartBadge.className = 'cart-badge local-data';
        cartBadge.title = 'Dữ liệu cục bộ';
    }
    
    if (cartCount) {
        cartCount.textContent = '0';
    }
    
    if (mobileCartCount) {
        mobileCartCount.textContent = '0';
    }
    
    // Call index.ejs cart badge update if available
    if (typeof window.updateCartBadge === 'function') {
        window.updateCartBadge();
    }
    
    // Call cart change notification to sync all systems
    if (typeof window.notifyCartChange === 'function') {
        window.notifyCartChange();
    }
    
    console.log('🧹 Cart completely cleared after logout');
    
    // Firebase sign out if available
    if (window.firebase && window.firebase.auth) {
        try {
            window.firebase.auth().signOut();
        } catch (error) {
            console.log('Firebase signOut not available or failed:', error);
        }
    }
    
    showNotification('Đăng xuất thành công!', 'success');
    console.log('✅ Logout completed');
};

// Khởi tạo đơn giản khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded - Thiết lập login modal...');
    
    // Check if user is already logged in from localStorage
    checkStoredUser();
    
    // Setup user icons để mở modal
    const userIcons = document.querySelectorAll('.fas.fa-user');
    console.log('Tìm thấy', userIcons.length, 'user icons');
    
    userIcons.forEach((icon, index) => {
        icon.style.cursor = 'pointer';
        icon.addEventListener('click', function(e) {
            e.preventDefault();
            console.log(`User icon ${index + 1} được nhấn`);
            
            // Check if user is already logged in
            const storedUser = localStorage.getItem('techHavenUser');
            if (storedUser) {
                // User is logged in, show user profile or menu
                console.log('User already logged in, showing profile...');
                // You can open user profile panel here instead
                openLoginModal(); // For now, still open modal
            } else {
                openLoginModal();
            }
        });
    });
    
    console.log('✅ User icons đã được thiết lập');
    
    // Thiết lập login modal sau khi DOM load
    setTimeout(() => {
        setupLoginModal();
    }, 1000);
});

// Function to check stored user in localStorage
function checkStoredUser() {
    try {
        const storedUser = localStorage.getItem('techHavenUser');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            console.log('🔄 Found stored user:', user.name);
            console.log('🔄 User provider:', user.provider);
            
            // CRITICAL: Set window.currentUser FIRST so other functions can detect it
            window.currentUser = user;
            console.log('✅ Set window.currentUser:', window.currentUser);
            
            // Update UI for logged in user (script.js function)
            updateUIForLoggedInUser(user);
            
            // Also call the EJS template updateUserIcons function if it exists
            if (typeof updateUserIcons === 'function') {
                console.log('🔄 Calling EJS updateUserIcons function...');
                updateUserIcons();
            } else {
                console.log('⚠️ EJS updateUserIcons function not found');
            }
            
            // Optionally verify with server that user is still valid
            // This is especially important for manual login users
            if (user.provider === 'manual') {
                verifyStoredUser(user);
            }
        } else {
            console.log('❌ No stored user found');
            // Make sure window.currentUser is null
            window.currentUser = null;
            
            // Call updateUserIcons to show login state
            if (typeof updateUserIcons === 'function') {
                updateUserIcons();
            }
        }
    } catch (error) {
        console.error('❌ Error checking stored user:', error);
        // Clear invalid data
        localStorage.removeItem('techHavenUser');
        localStorage.removeItem('techHavenRememberMe');
        
        // Reset currentUser
        window.currentUser = null;
        
        // Update UI to logged out state
        if (typeof updateUserIcons === 'function') {
            updateUserIcons();
        }
    }
}

// Function to verify stored user with server
function verifyStoredUser(user) {
    // For manual login users, we could ping the server to verify account is still active
    // For now, we trust localStorage data
    console.log('✅ Stored user verified:', user.name);
}

// Add Google API checker
function checkGoogleAPI() {
    console.log('=== GOOGLE API DEBUG ===');
    console.log('window.googleApiLoaded:', window.googleApiLoaded);
    console.log('typeof google:', typeof google);
    console.log('google exists:', typeof google !== 'undefined');
    
    if (typeof google !== 'undefined') {
        console.log('google.accounts:', google.accounts);
        console.log('google.accounts.id:', google.accounts ? google.accounts.id : 'N/A');
    }
    
    console.log('Google script in DOM:', document.querySelector('script[src*="gsi/client"]'));
    console.log('=======================');
    
    // Try to reinitialize
    if (window.googleApiLoaded) {
        showNotification('Google API đã được tải, thử khởi tạo lại...', 'info');
        initializeGoogleSignIn();
    } else {
        showNotification('Google API chưa được tải!', 'error');
    }
}

window.checkGoogleAPI = checkGoogleAPI;

// =====================================
// AUTO-FILL USER INFORMATION
// =====================================

// Function to auto-fill user information in checkout form if user is logged in
function fillUserInformationIfLoggedIn() {
    // Check if user is logged in
    if (!window.currentUser) {
        console.log('👤 No user logged in - form fields remain editable');
        // Make sure form fields are editable for guest users
        const customerName = document.getElementById('customerName');
        const customerPhone = document.getElementById('customerPhone');
        const customerEmail = document.getElementById('customerEmail');
        
        if (customerName) {
            customerName.disabled = false;
            customerName.placeholder = 'Nhập họ và tên';
        }
        if (customerPhone) {
            customerPhone.disabled = false;
            customerPhone.placeholder = 'Nhập số điện thoại';
        }
        if (customerEmail) {
            customerEmail.disabled = false;
            customerEmail.placeholder = 'Nhập email';
            
            // Add event listener to fetch coin when guest enters email (similar to coupon)
            if (!customerEmail.hasAttribute('data-coin-listener-attached')) {
                customerEmail.addEventListener('blur', async function() {
                    const email = this.value.trim();
                    if (email && email.includes('@')) {
                        console.log('📧 Guest email entered, fetching coin balance for:', email);
                        await fetchGuestCoinByEmail(email);
                    }
                });
                customerEmail.setAttribute('data-coin-listener-attached', 'true');
                console.log('✅ Guest email coin listener attached');
            }
        }
        return;
    }
    
    console.log('✅ User logged in - auto-filling form with user data');
    
    // Fill customer name
    const customerName = document.getElementById('customerName');
    if (customerName) {
        const userName = window.currentUser.name || window.currentUser.displayName;
        if (userName) {
            customerName.value = userName;
            customerName.disabled = true; // Disable editing for logged-in users
            customerName.style.backgroundColor = '#f8f9fa';
            customerName.style.color = '#6c757d';
            customerName.title = 'Thông tin từ tài khoản đã đăng nhập';
        } else {
            // If no name available, allow manual input but will be filled from Firestore later
            customerName.disabled = false;
            customerName.placeholder = 'Nhập họ và tên';
        }
    }
    
    // Fill customer email
    const customerEmail = document.getElementById('customerEmail');
    if (customerEmail && window.currentUser.email) {
        customerEmail.value = window.currentUser.email;
        customerEmail.disabled = true; // Disable editing for logged-in users
        customerEmail.style.backgroundColor = '#f8f9fa';
        customerEmail.style.color = '#6c757d';
        customerEmail.title = 'Thông tin từ tài khoản đã đăng nhập';
    }
    
    // For phone and name, we need to fetch from user profile since Firebase Auth doesn't always have complete info
    fetchUserDataAndFill();
}

// Function to fetch user data (name and phone) from Firestore profile
async function fetchUserDataAndFill() {
    try {
        const idToken = await window.getIdToken();
        if (!idToken) return;
        
        const response = await fetch('/api/user/profile', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const customerPhone = document.getElementById('customerPhone');
            const customerName = document.getElementById('customerName');
            
            // Fill name if available from Firestore
            if (customerName && data.user && data.user.name) {
                if (!customerName.value || customerName.value !== data.user.name) {
                    customerName.value = data.user.name;
                    customerName.disabled = true;
                    customerName.style.backgroundColor = '#f8f9fa';
                    customerName.style.color = '#6c757d';
                    customerName.title = 'Thông tin từ tài khoản đã đăng nhập';
                }
                // Update window.currentUser.name if different
                if (window.currentUser && window.currentUser.name !== data.user.name) {
                    window.currentUser.name = data.user.name;
                }
            }
            
            // Fill phone
            if (customerPhone && data.user && data.user.phone) {
                customerPhone.value = data.user.phone;
                customerPhone.disabled = true;
                customerPhone.style.backgroundColor = '#f8f9fa';
                customerPhone.style.color = '#6c757d';
                customerPhone.title = 'Thông tin từ tài khoản đã đăng nhập';
            } else if (customerPhone) {
                // Phone not found in profile - allow manual input
                customerPhone.disabled = false;
                customerPhone.placeholder = 'Nhập số điện thoại';
            }
        }
    } catch (error) {
        console.error('❌ Error fetching user data:', error);
        // If error, allow manual input
        const customerPhone = document.getElementById('customerPhone');
        const customerName = document.getElementById('customerName');
        
        if (customerPhone && !customerPhone.value) {
            customerPhone.disabled = false;
            customerPhone.placeholder = 'Nhập số điện thoại';
        }
        if (customerName && !customerName.value) {
            customerName.disabled = false;
            customerName.placeholder = 'Nhập họ và tên';
        }
    }
}

// Debug function for cart troubleshooting
window.debugCart = function() {
    console.log('🔍 CART DEBUG INFO:');
    console.log('cartItems:', cartItems);
    console.log('cartCount:', cartCount);
    console.log('localStorage cart:', localStorage.getItem('techHavenCart'));
    console.log('localStorage count:', localStorage.getItem('techHavenCartCount'));
    console.log('window.cartItems:', window.cartItems);
    console.log('Cart total:', calculateCartTotal());
    
    const cartBadge = document.getElementById('cartBadge');
    const mobileCartCount = document.getElementById('cartCount'); // Fixed: use 'cartCount' for mobile
    const cartItemsContainer = document.getElementById('cartItems');
    
    console.log('cartBadge element:', cartBadge);
    console.log('cartBadge text:', cartBadge?.textContent);
    console.log('mobileCartCount element:', mobileCartCount);
    console.log('mobileCartCount text:', mobileCartCount?.textContent);
    console.log('cartItemsContainer:', cartItemsContainer);
    console.log('cartItemsContainer HTML:', cartItemsContainer?.innerHTML.substring(0, 200) + '...');
};

// Make function globally available
window.fillUserInformationIfLoggedIn = fillUserInformationIfLoggedIn;

/**
 * Fetch guest user's coin balance by email
 * Similar to how coupons are loaded for guest users
 */
async function fetchGuestCoinByEmail(email) {
    try {
        console.log('🔍 Fetching coin balance for guest email:', email);
        
        // Call backend API to get user coin by email
        const response = await fetch(`/api/users/email/${encodeURIComponent(email)}/coin`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.log('⚠️ No user found with email:', email);
            // Reset coin display to 0
            resetCoinDisplay();
            return;
        }
        
        const data = await response.json();
        
        if (data.success && data.coin !== undefined) {
            const coinBalance = data.coin || 0;
            console.log('💰 Guest coin balance loaded:', coinBalance.toLocaleString('vi-VN'));
            
            // Update coin display (use checkout-coin-manager.js functions if available)
            if (typeof window.updateGuestCoinBalance === 'function') {
                window.updateGuestCoinBalance(coinBalance, data.userId);
            } else {
                // Fallback: directly update UI elements
                updateCoinUIElements(coinBalance);
            }
            
            // Store guest userId for later use
            window.guestUserId = data.userId;
            console.log('✅ Guest userId stored:', data.userId);
        } else {
            console.log('⚠️ No coin data returned for email:', email);
            resetCoinDisplay();
        }
    } catch (error) {
        console.error('❌ Error fetching guest coin:', error);
        resetCoinDisplay();
    }
}

/**
 * Update coin UI elements directly
 */
function updateCoinUIElements(coinBalance) {
    const checkoutCoinBalance = document.getElementById('checkoutCoinBalance');
    const checkoutCoinValue = document.getElementById('checkoutCoinValue');
    const coinSlider = document.getElementById('coinSlider');
    const coinToUse = document.getElementById('coinToUse');
    const noCoinMessage = document.getElementById('noCoinMessage');
    const coinInputGroup = document.getElementById('coinInputGroup');
    const useAllCoinBtn = document.getElementById('useAllCoinBtn');
    
    // Update balance display
    if (checkoutCoinBalance) {
        checkoutCoinBalance.textContent = coinBalance.toLocaleString('vi-VN');
    }
    if (checkoutCoinValue) {
        checkoutCoinValue.textContent = coinBalance.toLocaleString('vi-VN');
    }
    
    // Show/hide appropriate sections
    if (coinBalance > 0) {
        if (noCoinMessage) noCoinMessage.style.display = 'none';
        if (coinInputGroup) coinInputGroup.style.display = 'block';
        if (useAllCoinBtn) useAllCoinBtn.style.display = 'inline-flex';
        
        // Update slider and input max values
        const orderTotal = calculateCartTotal() + 50000; // Add shipping
        const maxCoinUsable = Math.min(coinBalance, orderTotal);
        
        if (coinSlider) {
            coinSlider.max = maxCoinUsable;
            coinSlider.value = 0;
        }
        if (coinToUse) {
            coinToUse.max = maxCoinUsable;
            coinToUse.value = 0;
        }
        
        console.log('✅ Coin UI updated for guest - Balance:', coinBalance.toLocaleString('vi-VN'));
    } else {
        resetCoinDisplay();
    }
}

/**
 * Reset coin display to default state (no coin)
 */
function resetCoinDisplay() {
    const noCoinMessage = document.getElementById('noCoinMessage');
    const coinInputGroup = document.getElementById('coinInputGroup');
    const useAllCoinBtn = document.getElementById('useAllCoinBtn');
    const checkoutCoinBalance = document.getElementById('checkoutCoinBalance');
    const checkoutCoinValue = document.getElementById('checkoutCoinValue');
    
    if (noCoinMessage) noCoinMessage.style.display = 'flex';
    if (coinInputGroup) coinInputGroup.style.display = 'none';
    if (useAllCoinBtn) useAllCoinBtn.style.display = 'none';
    if (checkoutCoinBalance) checkoutCoinBalance.textContent = '0';
    if (checkoutCoinValue) checkoutCoinValue.textContent = '0';
    
    console.log('🔄 Coin display reset to default (no coin)');
}

// Export functions
window.fetchGuestCoinByEmail = fetchGuestCoinByEmail;
window.updateCoinUIElements = updateCoinUIElements;
window.resetCoinDisplay = resetCoinDisplay;

// =====================================
// EMAIL VERIFICATION LOADING SCREEN
// =====================================

// Show email verification loading screen
function showEmailVerificationLoadingScreen(email, userData) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'emailVerificationOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease-in-out;
    `;
    
    // Create loading screen content
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 15px;
        max-width: 500px;
        width: 90%;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.4s ease-out;
    `;
    
    content.innerHTML = `
        <div style="margin-bottom: 30px;">
            <div class="email-loading-icon" style="
                width: 80px;
                height: 80px;
                border: 4px solid #e3f2fd;
                border-top: 4px solid #2196f3;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px auto;
            "></div>
            <h2 style="color: #333; margin: 0 0 15px 0; font-size: 24px;">
                🎉 Đăng Ký Thành Công!
            </h2>
        </div>
        
        <div style="margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #e3f2fd, #f3e5f5); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <p style="margin: 0 0 15px 0; color: #555; font-size: 16px; line-height: 1.6;">
                    Tài khoản của bạn đã được tạo thành công!
                </p>
                <p style="margin: 0; color: #333; font-weight: 600;">
                    📧 Email xác thực đã được gửi đến:<br>
                    <span style="color: #2196f3; font-family: 'Courier New', monospace;">${email}</span>
                </p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                    <strong>⚠️ Quan trọng:</strong> Vui lòng kiểm tra email và click vào liên kết xác thực để kích hoạt tài khoản.
                </p>
            </div>
        </div>
        
        <div style="margin-bottom: 30px;">
            <div class="verification-status" id="verificationStatus">
                <p style="color: #666; margin: 0 0 15px 0;">
                    ⏳ Đang chờ xác thực email...
                </p>
                <div class="progress-bar" style="
                    width: 100%;
                    height: 6px;
                    background: #e0e0e0;
                    border-radius: 3px;
                    overflow: hidden;
                ">
                    <div class="progress-fill" style="
                        height: 100%;
                        background: linear-gradient(90deg, #2196f3, #21cbf3);
                        border-radius: 3px;
                        animation: progress 2s ease-in-out infinite;
                    "></div>
                </div>
            </div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <button onclick="checkEmailVerification('${email}', '${userData.uid}')" style="
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                🔍 Kiểm Tra Xác Thực
            </button>
            
            <button onclick="resendVerificationEmail('${email}')" style="
                background: linear-gradient(135deg, #ff9800, #f57c00);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                📧 Gửi Lại Email
            </button>
            
            <button onclick="skipEmailVerification()" style="
                background: #6c757d;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
            " onmouseover="this.style.background='#5a6268'" onmouseout="this.style.background='#6c757d'">
                Bỏ Qua (Xác Thực Sau)
            </button>
        </div>
    `;
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideUp {
            from { transform: translateY(50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        @keyframes progress {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(100%); }
        }
    `;
    document.head.appendChild(style);
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    // Auto-check verification status every 5 seconds
    let autoCheckInterval = setInterval(() => {
        checkEmailVerificationSilent(email, userData.uid, autoCheckInterval);
    }, 5000);
    
    // Store interval ID for cleanup
    overlay.autoCheckInterval = autoCheckInterval;
}

// Check email verification status (with user feedback)
window.checkEmailVerification = async function(email, uid) {
    const btn = event.target;
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang kiểm tra...';
    
    try {
        // Check with Firebase Auth - first try to get current user
        let user = firebase.auth().currentUser;
        
        // If no current user, try to sign in with stored token or wait for auth state
        if (!user) {
            console.log('🔄 No current Firebase user, checking auth state...');
            
            // Wait for auth state to be ready
            await new Promise((resolve) => {
                const unsubscribe = firebase.auth().onAuthStateChanged((authUser) => {
                    user = authUser;
                    unsubscribe();
                    resolve();
                });
            });
        }
        
        if (user) {
            console.log('📧 Reloading Firebase user to check verification status...');
            await user.reload(); // Refresh user data
            
            console.log('✅ User verification status:', user.emailVerified);
            
            if (user.emailVerified) {
                // Email verified successfully
                showNotification('🎉 Email đã được xác thực thành công!', 'success');
                
                // Close verification screen
                closeEmailVerificationScreen();
                
                // Auto login the user
                const idToken = await user.getIdToken();
                localStorage.setItem('techHavenAuthToken', idToken);
                
                // Update UI
                window.currentUser = {
                    uid: uid,
                    email: email,
                    name: user.displayName || email.split('@')[0],
                    emailVerified: true,
                    provider: 'manual'
                };
                updateUIForLoggedInUser(window.currentUser);
                
                // Check and show welcome modal for new users (after 1 second to ensure UI is ready)
                console.log('⏱️ Scheduling welcome modal check after email verification...');
                setTimeout(() => {
                    if (typeof checkAndShowWelcomeModal === 'function') {
                        console.log('🎉 Calling checkAndShowWelcomeModal after email verification for user:', window.currentUser?.email);
                        checkAndShowWelcomeModal(window.currentUser);
                    } else {
                        console.warn('⚠️ checkAndShowWelcomeModal function not found');
                    }
                }, 1000);
                
                return;
            }
        }
        
        // Still not verified
        console.log('⚠️ Email still not verified');
        showNotification('Email chưa được xác thực. Vui lòng kiểm tra hộp thư.', 'warning');
        
    } catch (error) {
        console.error('Error checking email verification:', error);
        showNotification('Có lỗi khi kiểm tra xác thực email.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// Check email verification silently (for auto-check)
async function checkEmailVerificationSilent(email, uid, intervalId) {
    try {
        let user = firebase.auth().currentUser;
        
        // If no current user, wait for auth state
        if (!user) {
            await new Promise((resolve) => {
                const unsubscribe = firebase.auth().onAuthStateChanged((authUser) => {
                    user = authUser;
                    unsubscribe();
                    resolve();
                });
            });
        }
        
        if (user) {
            console.log('🔄 Silent check: Reloading user...');
            await user.reload();
            
            console.log('📧 Silent check: User verified?', user.emailVerified);
            
            if (user.emailVerified) {
                // Clear interval
                clearInterval(intervalId);
                
                // Auto close and login
                showNotification('🎉 Email đã được xác thực! Đăng nhập tự động...', 'success');
                
                setTimeout(() => {
                    closeEmailVerificationScreen();
                    
                    // Auto login
                    user.getIdToken().then(idToken => {
                        localStorage.setItem('techHavenAuthToken', idToken);
                        
                        window.currentUser = {
                            uid: uid,
                            email: email,
                            name: user.displayName || email.split('@')[0],
                            emailVerified: true,
                            provider: 'manual'
                        };
                        updateUIForLoggedInUser(window.currentUser);
                        
                        // Check and show welcome modal for new users (after 1 second to ensure UI is ready)
                        console.log('⏱️ Scheduling welcome modal check after auto email verification...');
                        setTimeout(() => {
                            if (typeof checkAndShowWelcomeModal === 'function') {
                                console.log('🎉 Calling checkAndShowWelcomeModal after auto verification for user:', window.currentUser?.email);
                                checkAndShowWelcomeModal(window.currentUser);
                            } else {
                                console.warn('⚠️ checkAndShowWelcomeModal function not found');
                            }
                        }, 1000);
                    });
                }, 1500);
            }
        }
    } catch (error) {
        console.error('Silent verification check error:', error);
    }
}

// Resend verification email
window.resendVerificationEmail = async function(email) {
    const btn = event.target;
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
    
    try {
        const response = await fetch('/api/resend-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('📧 Email xác thực đã được gửi lại!', 'success');
        } else {
            showNotification(data.message || 'Có lỗi khi gửi lại email.', 'error');
        }
    } catch (error) {
        console.error('Error resending verification:', error);
        showNotification('Có lỗi khi gửi lại email xác thực.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// Skip email verification
window.skipEmailVerification = function() {
    if (confirm('⚠️ Bạn có chắc muốn bỏ qua xác thực email?\n\nTài khoản chưa xác thực sẽ có một số hạn chế về tính năng.')) {
        closeEmailVerificationScreen();
        showNotification('Bạn có thể xác thực email sau trong phần cài đặt tài khoản.', 'info');
    }
};

// Close email verification screen
function closeEmailVerificationScreen() {
    const overlay = document.getElementById('emailVerificationOverlay');
    if (overlay) {
        // Clear auto-check interval
        if (overlay.autoCheckInterval) {
            clearInterval(overlay.autoCheckInterval);
        }
        
        // Fade out animation
        overlay.style.animation = 'fadeOut 0.3s ease-in-out forwards';
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
}

// Add fadeOut animation
const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
if (!document.querySelector('style[data-fadeout]')) {
    fadeOutStyle.setAttribute('data-fadeout', 'true');
    document.head.appendChild(fadeOutStyle);
}

// =====================================
// VARIANT SELECTION MODAL FUNCTIONS
// =====================================

// Show variant selection modal
window.showVariantSelectionModal = function(mainProduct, variants) {
    const modal = document.getElementById('variantSelectionModal');
    const variantOptions = document.getElementById('variantOptions');
    
    if (!modal || !variantOptions) {
        console.error('❌ Variant selection modal elements not found');
        return;
    }
    
    // Clear previous options
    variantOptions.innerHTML = '';
    
    // Add main product option
    const mainProductOption = createVariantOption(mainProduct, true);
    variantOptions.appendChild(mainProductOption);
    
    // Add variant options
    variants.forEach(variant => {
        const variantOption = createVariantOption(variant, false);
        variantOptions.appendChild(variantOption);
    });
    
    // Show modal
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
};

// Create variant option element
function createVariantOption(product, isMainProduct) {
    console.log('🏗️ Creating variant option for:', {
        name: product.name,
        isMainProduct,
        stock: product.stock,
        availability: product.availability,
        stockType: typeof product.stock
    });
    
    const option = document.createElement('div');
    option.className = `variant-option ${isMainProduct ? 'main-product' : ''}`;
    
    // Format price
    const formattedPrice = formatPriceDisplay(product.price);
    const oldPriceHtml = product.oldPrice ? 
        `<span class="old-price">${formatPriceDisplay(product.oldPrice)}</span>` : '';
    
    // Get stock status
    const stockInfo = getStockInfo(product.stock, product.availability);
    console.log('📊 Stock info result:', stockInfo);
    
    // Create product image
    const imageHtml = product.images && product.images.length > 0 ? 
        `<img src="${product.images[0]}" alt="${product.name}">` :
        `<i class="fas fa-cube"></i>`;
    
    // Create variant attributes display
    const attributesHtml = product.variant_attributes ? 
        Object.entries(product.variant_attributes)
            .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
            .join(', ') : '';
    
    option.innerHTML = `
        <div class="variant-option-image">
            ${imageHtml}
        </div>
        <div class="variant-option-info">
            <h4 class="variant-option-name">
                ${product.name}
                <span class="variant-badge ${isMainProduct ? 'main' : 'variant'}">
                    ${isMainProduct ? 'Chính' : 'Biến thể'}
                </span>
            </h4>
            <div class="variant-option-price">
                ${formattedPrice}
                ${oldPriceHtml}
            </div>
            ${attributesHtml ? `<p class="variant-option-desc">${attributesHtml}</p>` : ''}
            <span class="variant-option-stock ${stockInfo.class}">
                ${stockInfo.text}
            </span>
        </div>
        <button class="variant-select-btn" onclick="event.stopPropagation(); selectVariantAndAddToCart('${product.id}', '${product.name}', '${formatPriceDisplay(product.price)}', '${product.images?.[0] || ''}')">
            <i class="fas fa-cart-plus"></i>
            Chọn & Thêm vào giỏ
        </button>
    `;
    
    return option;
}

// Select variant and add to cart
window.selectVariantAndAddToCart = async function(productId, productName, productPrice, productImage) {
    try {
        // Close variant modal first
        closeVariantModal();
        
        // Get the quantity that was stored when the add to cart button was clicked
        const quantity = window.selectedProductQuantity || 1;
        console.log('🛒 Debugging variant quantity:', {
            storedQuantity: window.selectedProductQuantity,
            finalQuantity: quantity,
            buyNowFlag: window.buyNowAfterVariantSelection
        });
        
        // Check if this is a "Buy Now" action
        if (window.buyNowAfterVariantSelection) {
            console.log('🛍️ Buy Now flag detected, calling selectVariantAndBuyNow');
            
            // Call the Buy Now function from product_detail.js
            if (typeof window.selectVariantAndBuyNow === 'function') {
                await window.selectVariantAndBuyNow(productId, productName, productPrice, productImage);
            } else {
                console.warn('⚠️ selectVariantAndBuyNow function not available, falling back to regular add to cart then checkout');
                
                // Fallback: Add to cart then open checkout
                await addToCartDirectly(productName, productPrice, productId, productImage, quantity);
                
                // Wait a moment for cart to update
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Open cart sidebar and checkout
                if (typeof window.toggleCart === 'function') {
                    window.toggleCart();
                    setTimeout(() => {
                        if (typeof window.proceedToCheckout === 'function') {
                            window.proceedToCheckout();
                        }
                    }, 1000);
                }
                
                // Clear flags
                window.buyNowAfterVariantSelection = false;
                window.selectedProductQuantity = null;
            }
        } else {
            console.log('🛒 Regular add to cart action');
            
            // Add the selected variant to cart with the specified quantity
            await addToCartDirectly(productName, productPrice, productId, productImage, quantity);
            
            // Show success notification with quantity
            if (typeof window.showCartNotification === 'function') {
                window.showCartNotification(`Đã thêm ${quantity} sản phẩm vào giỏ hàng!`);
            }
            
            // Clear the stored quantity
            window.selectedProductQuantity = null;
            
            console.log(`✅ Successfully added ${quantity} items of variant to cart`);
        }
        
    } catch (error) {
        console.error('❌ Error selecting variant:', error);
        if (typeof window.showCartNotification === 'function') {
            window.showCartNotification('Lỗi khi thêm sản phẩm vào giỏ hàng');
        } else {
            alert('Lỗi khi thêm sản phẩm vào giỏ hàng');
        }
        
        // Clear the stored quantity and flags even on error
        window.selectedProductQuantity = null;
        window.buyNowAfterVariantSelection = false;
    }
};

// Add to cart directly (bypass variant checking) - using same logic as addToCart()
window.addToCartDirectly = async function(productName, productPrice, productId = null, productImage = null, quantity = 1) {
    // Prevent duplicate calls (same as addToCart)
    if (window.addToCartDirectlyInProgress) {
        console.log('⚠️ addToCartDirectly already in progress, skipping duplicate call');
        return;
    }
    
    window.addToCartDirectlyInProgress = true;
    console.log('🛒 Starting addToCartDirectly process (no variant checking)');
    
    try {
        // Validate input data (identical to addToCart)
        if (!productName || productName === 'undefined' || !productPrice) {
            console.error('❌ Invalid product data:', { productName, productPrice, productId });
            if (typeof window.showCartNotification === 'function') {
                window.showCartNotification('Lỗi: Dữ liệu sản phẩm không hợp lệ');
            }
            return;
        }
        
        // Clean price string to get numeric value (identical to addToCart)
        const cleanPrice = productPrice.replace(/[^\d]/g, '');
        const numericPrice = parseInt(cleanPrice);
        
        if (isNaN(numericPrice) || numericPrice <= 0) {
            console.error('❌ Invalid price:', productPrice);
            if (typeof window.showCartNotification === 'function') {
                window.showCartNotification('Lỗi: Giá sản phẩm không hợp lệ');
            }
            return;
        }
        
        // Use product name as ID if no productId provided (identical to addToCart)
        const itemId = productId ? String(productId) : productName;
        
        // Skip variant checking - this is the key difference from addToCart()
        console.log('Adding to cart directly - Product ID:', itemId, 'Name:', productName);
    
        // If user is logged in, work directly with database (identical to addToCart)
        if (window.currentUser) {
            try {
                let headers = {
                    'Content-Type': 'application/json'
                };
                
                let body = {
                    productId: itemId,
                    productName: productName,
                    productPrice: productPrice,
                    numericPrice: numericPrice,
                    productImage: productImage,
                    quantity: quantity || 1 // Use the specified quantity
                };
                
                // Add Authorization header only for Firebase Auth users (identical to addToCart)
                if (window.currentUser.provider === 'firebase') {
                    const token = await getAuthToken();
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                    }
                } else {
                    // For manual users, add userId to body
                    body.userId = window.currentUser.uid;
                }
                
                const response = await fetch('/api/cart', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(body)
                });
                
                const result = await response.json();
                if (result.success) {
                    console.log('✅ Item added to database cart');
                    // Show success notification (identical to addToCart)
                    if (typeof window.showCartNotification === 'function') {
                        window.showCartNotification(productName);
                    } else {
                        // Fallback notification
                        console.log('✅ Added to cart:', productName);
                    }
                    // Reload cart and update UI (identical to addToCart)
                    if (typeof loadCartFromDatabase === 'function') {
                        console.log('🔄 Calling loadCartFromDatabase after successful add to cart...');
                        await loadCartFromDatabase(); // This will update cartCount and call updateCartUI()
                        console.log('✅ loadCartFromDatabase completed');
                        
                        // Notify Firebase callback system from script.js (same as regular addToCart)
                        console.log('🔔 Notifying Firebase callback system from script.js...');
                        if (typeof window.onFirebaseCartOperationComplete === 'function') {
                            window.onFirebaseCartOperationComplete('addToCartDirectly', true, result);
                        }
                    } else if (typeof updateCartUI === 'function') {
                        console.log('🔄 Fallback: Calling updateCartUI directly...');
                        updateCartUI();
                    }
                } else {
                    throw new Error(result.error || 'Failed to add to cart');
                }
                
            } catch (dbError) {
                console.error('❌ Database cart error:', dbError);
                if (typeof window.showCartNotification === 'function') {
                    window.showCartNotification('Lỗi khi thêm vào giỏ hàng');
                }
            }
            
        } else {
            // Guest user - use localStorage (identical to addToCart)
            const existingItemIndex = cartItems.findIndex(item => item.id === itemId);
            
            if (existingItemIndex > -1) {
                cartItems[existingItemIndex].quantity += (quantity || 1);
                console.log('Updated existing item quantity');
            } else {
                const newItem = {
                    id: itemId,
                    name: productName,
                    price: productPrice,
                    numericPrice: numericPrice,
                    image: productImage || '',
                    quantity: quantity || 1,
                    addedAt: Date.now()
                };
                
                cartItems.push(newItem);
                console.log('Added new item to cart');
            }
            
            // Update cart count and save (identical to addToCart)
            cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
            localStorage.setItem('techHavenCart', JSON.stringify(cartItems));
            localStorage.setItem('techHavenCartCount', cartCount.toString());
            
            // Update UI (identical to addToCart)
            updateCartUI();
            if (typeof window.showCartNotification === 'function') {
                window.showCartNotification(productName);
            }
        }
        
    } catch (error) {
        console.error('❌ Error in addToCartDirectly:', error);
        if (typeof window.showCartNotification === 'function') {
            window.showCartNotification('Lỗi khi thêm sản phẩm vào giỏ hàng');
        }
    } finally {
        // Reset progress flag (same as addToCart)
        window.addToCartDirectlyInProgress = false;
        console.log('🏁 addToCartDirectly process completed');
    }
};

// Close variant modal
window.closeVariantModal = function() {
    const modal = document.getElementById('variantSelectionModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
};

// Format price for display
function formatPriceDisplay(price) {
    if (!price) return '0 ₫';
    const numPrice = typeof price === 'string' ? parseInt(price.replace(/[^\d]/g, '')) : price;
    return new Intl.NumberFormat('vi-VN').format(numPrice) + ' ₫';
}

// Get stock information
function getStockInfo(stock, availability) {
    console.log('🔍 getStockInfo called with:', { stock, availability, stockType: typeof stock });
    
    // Convert stock to number if it's a string
    const stockNumber = typeof stock === 'string' ? parseInt(stock, 10) : stock;
    
    if (stockNumber === null || stockNumber === undefined || isNaN(stockNumber) || stockNumber === 0 || availability === 'out-of-stock') {
        console.log('❌ Determined as out of stock');
        return { class: 'out-stock', text: 'Hết hàng' };
    } else if (stockNumber < 10) {
        console.log('⚠️ Determined as low stock');
        return { class: 'low-stock', text: `Còn ${stockNumber} sản phẩm` };
    } else {
        console.log('✅ Determined as in stock');
        return { class: 'in-stock', text: 'Còn hàng' };
    }
}

// =====================================
// DEBUG AND TROUBLESHOOTING FUNCTIONS
// =====================================

// Enhanced debug function for cart consistency
window.debugCartConsistency = function() {
    console.group('🐛 Cart Consistency Debug');
    
    // Check script.js cart state
    console.log('📊 Script.js Cart State:');
    console.log('- cartItems length:', cartItems ? cartItems.length : 'undefined');
    console.log('- window.cartItems length:', window.cartItems ? window.cartItems.length : 'undefined');
    console.log('- cartCount:', cartCount);
    console.log('- localStorage cart:', localStorage.getItem('techHavenCart') ? JSON.parse(localStorage.getItem('techHavenCart')).length : 'null');
    console.log('- localStorage cartCount:', localStorage.getItem('techHavenCartCount'));
    
    // Check shop.ejs cart state
    console.log('📊 Shop.ejs Cart State:');
    console.log('- window.cart length:', window.cart ? window.cart.length : 'undefined');
    
    // Check UI elements
    console.log('📊 UI State:');
    const cartBadge = document.getElementById('cartBadge');
    const cartItems_UI = document.getElementById('cartItems');
    console.log('- cartBadge text:', cartBadge ? cartBadge.textContent : 'not found');
    console.log('- cartBadge display:', cartBadge ? cartBadge.style.display : 'not found');
    console.log('- cartItems UI children:', cartItems_UI ? cartItems_UI.children.length : 'not found');
    
    // Check for inconsistencies
    const scriptJsCount = window.cartItems ? window.cartItems.length : 0;
    const shopJsCount = window.cart ? window.cart.length : 0;
    const localStorageCount = localStorage.getItem('techHavenCart') ? JSON.parse(localStorage.getItem('techHavenCart')).length : 0;
    const badgeCount = cartBadge ? parseInt(cartBadge.textContent) || 0 : 0;
    
    console.log('🔍 Consistency Check:');
    console.log('- Script.js count:', scriptJsCount);
    console.log('- Shop.js count:', shopJsCount);
    console.log('- LocalStorage count:', localStorageCount);
    console.log('- Badge count:', badgeCount);
    
    if (scriptJsCount === shopJsCount && shopJsCount === localStorageCount && localStorageCount === badgeCount) {
        console.log('✅ All systems are consistent!');
    } else {
        console.warn('⚠️ INCONSISTENCY DETECTED!');
        console.warn('Different counts found between systems');
        
        // Suggest fixes
        console.log('💡 Suggested fixes:');
        if (window.cart && window.cart.length > 0) {
            console.log('- Try: window.cartItems = [...window.cart]; updateCartUI();');
        }
        console.log('- Try: window.forceUpdateCartUI() if available');
        console.log('- Try: window.loadCart() if available');
    }
    
    console.groupEnd();
};

// Force sync all cart systems
window.forceCartSync = function() {
    console.log('🔧 Force syncing all cart systems...');
    
    // Use shop.ejs cart as the source of truth if available
    if (window.cart && Array.isArray(window.cart)) {
        console.log('📊 Using shop.ejs cart as source of truth');
        window.cartItems = [...window.cart];
        cartItems = [...window.cart];
        cartCount = window.cart.length;
        
        localStorage.setItem('techHavenCart', JSON.stringify(window.cartItems));
        localStorage.setItem('techHavenCartCount', cartCount.toString());
    } else if (window.cartItems && Array.isArray(window.cartItems)) {
        console.log('📊 Using script.js cart as source of truth');
        cartItems = [...window.cartItems];
        cartCount = window.cartItems.length;
        
        if (window.cart !== undefined) {
            window.cart = [...window.cartItems];
        }
        
        localStorage.setItem('techHavenCart', JSON.stringify(cartItems));
        localStorage.setItem('techHavenCartCount', cartCount.toString());
    }
    
    // Force update all UIs
    updateCartUI();
    
    if (typeof window.forceUpdateCartUI === 'function') {
        window.forceUpdateCartUI();
    }
    
    console.log('✅ Cart sync completed');
};

// =====================================
// GLOBAL SEARCH FUNCTIONS EXPORT
// =====================================

// =====================================
// REAL-TIME COMMENT SYNCHRONIZATION
// =====================================

// Comment synchronization state
let commentsSyncEnabled = false;
let commentsListeners = new Map(); // Track listeners by productId

// Initialize comment synchronization system
function initializeCommentSync() {
    console.log('🔄 Initializing comment synchronization system...');
    
    // Listen for cross-tab comment updates
    window.addEventListener('storage', handleCommentStorageEvent);
    
    // Listen for visibility changes to sync when tab becomes active
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    commentsSyncEnabled = true;
    console.log('✅ Comment synchronization system initialized');
}

// Handle storage events for cross-tab comment synchronization
function handleCommentStorageEvent(event) {
    if (!commentsSyncEnabled) return;
    
    if (event.key === 'commentUpdate') {
        const updateData = JSON.parse(event.newValue || '{}');
        console.log('📨 Cross-tab comment update received:', updateData);
        
        // Broadcast to comment system if available
        if (typeof window.handleCommentUpdateFromStorage === 'function') {
            window.handleCommentUpdateFromStorage(updateData);
        }
        
        // Update comment count displays
        updateCommentCounts(updateData.productId);
    }
}

// Handle visibility change for tab sync
function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && commentsSyncEnabled) {
        console.log('👁️ Tab became visible, syncing comments...');
        
        // Trigger comment sync if comment system is available
        if (typeof window.refreshCommentsOnFocus === 'function') {
            window.refreshCommentsOnFocus();
        }
    }
}

// Broadcast comment update to other tabs
function broadcastCommentUpdate(updateData) {
    if (!commentsSyncEnabled) return;
    
    console.log('📡 Broadcasting comment update:', updateData);
    
    // Use localStorage for cross-tab communication
    localStorage.setItem('commentUpdate', JSON.stringify({
        ...updateData,
        timestamp: Date.now(),
        tabId: getTabId()
    }));
    
    // Clean up old update data
    setTimeout(() => {
        try {
            localStorage.removeItem('commentUpdate');
        } catch (e) {
            // Ignore errors
        }
    }, 1000);
}

// Get unique tab ID
function getTabId() {
    if (!window.tabId) {
        window.tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    return window.tabId;
}

// Update comment counts in UI
function updateCommentCounts(productId) {
    // Update any comment count displays on the page
    const countElements = document.querySelectorAll(`[data-product-id="${productId}"] .comment-count`);
    countElements.forEach(element => {
        // This would be updated by the comment system
        if (typeof window.getCommentCount === 'function') {
            const count = window.getCommentCount(productId);
            element.textContent = count;
        }
    });
}

// Setup Firebase real-time listener for comments
function setupCommentRealtimeListener(productId, callback) {
    if (!window.firebase?.firestore || !productId) {
        console.warn('⚠️ Firebase not available or productId missing for comment listener');
        return null;
    }
    
    // Stop existing listener for this product
    const existingListener = commentsListeners.get(productId);
    if (existingListener) {
        existingListener();
        commentsListeners.delete(productId);
    }
    
    const db = window.firebase.firestore();
    
    console.log('🎧 Setting up real-time comment listener for product:', productId);
    
    // Create the listener
    const unsubscribe = db.collection('comments')
        .where('productId', '==', productId)
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            console.log('📨 Comment snapshot received:', snapshot.size, 'comments');
            
            const comments = [];
            const changes = [];
            
            snapshot.docChanges().forEach(change => {
                const data = change.doc.data();
                const comment = {
                    id: change.doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date()
                };
                
                changes.push({
                    type: change.type, // 'added', 'modified', 'removed'
                    comment: comment,
                    oldIndex: change.oldIndex,
                    newIndex: change.newIndex
                });
            });
            
            // Get all comments
            snapshot.forEach(doc => {
                const data = doc.data();
                comments.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date()
                });
            });
            
            // Call the callback with updated data
            if (typeof callback === 'function') {
                callback({
                    comments: comments,
                    changes: changes,
                    productId: productId
                });
            }
            
            // Broadcast update to other tabs
            broadcastCommentUpdate({
                productId: productId,
                commentCount: comments.length,
                type: 'realtime_update',
                changes: changes
            });
            
        }, (error) => {
            console.error('❌ Error in comment listener:', error);
        });
    
    // Store the listener
    commentsListeners.set(productId, unsubscribe);
    
    return unsubscribe;
}

// Stop comment listener for a product
function stopCommentListener(productId) {
    const listener = commentsListeners.get(productId);
    if (listener) {
        listener();
        commentsListeners.delete(productId);
        console.log('🛑 Stopped comment listener for product:', productId);
    }
}

// Stop all comment listeners
function stopAllCommentListeners() {
    commentsListeners.forEach((listener, productId) => {
        listener();
        console.log('🛑 Stopped comment listener for product:', productId);
    });
    commentsListeners.clear();
}

// WebSocket-like event system for comments
const commentEventEmitter = {
    events: {},
    
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    },
    
    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    },
    
    emit(event, data) {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in comment event callback:', error);
            }
        });
    }
};

// Initialize comment sync when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize comment synchronization
    initializeCommentSync();
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    stopAllCommentListeners();
    commentsSyncEnabled = false;
});

// Export comment synchronization functions
window.initializeCommentSync = initializeCommentSync;
window.broadcastCommentUpdate = broadcastCommentUpdate;
window.setupCommentRealtimeListener = setupCommentRealtimeListener;
window.stopCommentListener = stopCommentListener;
window.commentEventEmitter = commentEventEmitter;

// =====================================
// MEMBERSHIP LEVEL SYSTEM
// =====================================

// Function to load membership level for user
async function loadMembershipLevel() {
    console.log('🏆 Loading membership level...');
    
    if (!window.currentUser || !window.currentUser.uid) {
        console.log('❌ No user ID found');
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${window.currentUser.uid}/membership`);
        const data = await response.json();
        
        if (data.success && data.membership) {
            const membership = data.membership;
            console.log('✅ Membership loaded:', membership);
            
            // Update badge in header
            const membershipBadge = document.getElementById('membershipBadge');
            const membershipIcon = document.getElementById('membershipIcon');
            const membershipName = document.getElementById('membershipName');
            const membershipPoints = document.getElementById('membershipPoints');
            
            if (membershipBadge && membershipIcon && membershipName && membershipPoints) {
                membershipIcon.textContent = membership.icon;
                membershipName.textContent = membership.name;
                membershipPoints.textContent = `${membership.points.toLocaleString('vi-VN')} điểm`;
                membershipBadge.style.display = 'flex';
            }
            
            // Update membership section
            const membershipSection = document.getElementById('membershipSection');
            const tierIcon = document.getElementById('tierIcon');
            const tierName = document.getElementById('tierName');
            const tierPoints = document.getElementById('tierPoints');
            
            if (membershipSection && tierIcon && tierName && tierPoints) {
                tierIcon.textContent = membership.icon;
                tierName.textContent = membership.name;
                tierPoints.textContent = `${membership.points.toLocaleString('vi-VN')} điểm tích lũy`;
                membershipSection.style.display = 'block';
            }
            
            // Update progress bar if not at max tier
            if (membership.nextTier) {
                const membershipProgress = document.getElementById('membershipProgress');
                const pointsToNext = document.getElementById('pointsToNext');
                const nextTierName = document.getElementById('nextTierName');
                const progressBar = document.getElementById('progressBar');
                
                if (membershipProgress && pointsToNext && nextTierName && progressBar) {
                    pointsToNext.textContent = membership.pointsToNextTier.toLocaleString('vi-VN');
                    nextTierName.textContent = membership.nextTierName;
                    
                    // Calculate progress percentage
                    let currentTierThreshold = 0;
                    let nextTierThreshold = 0;
                    
                    switch(membership.level) {
                        case 'standard':
                            currentTierThreshold = 0;
                            nextTierThreshold = 500000;
                            break;
                        case 'silver':
                            currentTierThreshold = 500000;
                            nextTierThreshold = 1000000;
                            break;
                        case 'gold':
                            currentTierThreshold = 1000000;
                            nextTierThreshold = 2000000;
                            break;
                    }
                    
                    const progressPercent = ((membership.points - currentTierThreshold) / (nextTierThreshold - currentTierThreshold)) * 100;
                    progressBar.style.width = `${Math.min(progressPercent, 100)}%`;
                    membershipProgress.style.display = 'block';
                }
            }
            
            console.log('✅ Membership UI updated');
            return membership;
        } else {
            console.log('⚠️ No membership data returned');
            return null;
        }
    } catch (error) {
        console.error('❌ Error loading membership:', error);
        return null;
    }
}

// Make membership function globally available
window.loadMembershipLevel = loadMembershipLevel;
