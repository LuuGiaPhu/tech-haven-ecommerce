// =====================================
// PRODUCT DETAIL PAGE FUNCTIONALITY
// =====================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Product detail page loaded');
    
    // Initialize all functionality
    initializeProductDetail();
    initializeImageGallery();
    initializeProductTabs();
    initializeQuantityControls();
    initializeActions();
    initializeRelatedProducts();
    
    // Note: Cart functionality is handled by the main EJS script
    // We don't need to load cart here to avoid conflicts
    
    setupEventListeners();
});

function initializeProductDetail() {
    // Setup mobile menu with more robust selector
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    console.log('Mobile menu elements found:', { 
        toggle: !!mobileMenuToggle, 
        menu: !!navMenu 
    });
    
    if (mobileMenuToggle && navMenu) {
        // Remove any existing event listeners
        mobileMenuToggle.replaceWith(mobileMenuToggle.cloneNode(true));
        const newToggle = document.querySelector('.mobile-menu-toggle');
        
        newToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Mobile menu toggle clicked');
            navMenu.classList.toggle('active');
            
            // Toggle hamburger animation
            const icon = newToggle.querySelector('i');
            if (icon) {
                if (navMenu.classList.contains('active')) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-times');
                } else {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
            
            console.log('Menu active state:', navMenu.classList.contains('active'));
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!navMenu.contains(e.target) && !newToggle.contains(e.target)) {
                navMenu.classList.remove('active');
                const icon = newToggle.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
        });
        
        // Close menu when window is resized to desktop
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                navMenu.classList.remove('active');
                const icon = newToggle.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
        });
    }
    
    // Cart functionality is handled by the main EJS script
    // We don't setup cart handlers here to avoid conflicts
    console.log('Cart functionality delegated to main EJS script');
    
    console.log('Product detail initialized');
}

function initializeImageGallery() {
    const thumbnails = document.querySelectorAll('.thumbnail');
    const mainImage = document.querySelector('.main-image');
    
    if (thumbnails.length > 0 && mainImage) {
        // Set first thumbnail as active
        thumbnails[0].classList.add('active');
        
        thumbnails.forEach((thumbnail, index) => {
            thumbnail.addEventListener('click', function() {
                // Remove active class from all thumbnails
                thumbnails.forEach(t => t.classList.remove('active'));
                
                // Add active class to clicked thumbnail
                this.classList.add('active');
                
                // Update main image with animation
                mainImage.style.opacity = '0.5';
                
                setTimeout(() => {
                    // In a real app, you would change the image source here
                    // mainImage.innerHTML = '<img src="' + newImageSrc + '" alt="Product Image">';
                    mainImage.style.opacity = '1';
                }, 200);
                
                console.log('Image changed to thumbnail', index + 1);
            });
        });
    }
}

function initializeProductTabs() {
    const tabHeaders = document.querySelectorAll('.tab-header');
    const tabContents = document.querySelectorAll('.tab-content');
    
    if (tabHeaders.length > 0 && tabContents.length > 0) {
        // Set first tab as active
        tabHeaders[0].classList.add('active');
        tabContents[0].classList.add('active');
        
        tabHeaders.forEach((header, index) => {
            header.addEventListener('click', function() {
                // Remove active class from all headers and contents
                tabHeaders.forEach(h => h.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked header and corresponding content
                this.classList.add('active');
                if (tabContents[index]) {
                    tabContents[index].classList.add('active');
                }
                
                console.log('Tab switched to:', this.textContent);
            });
        });
    }
}

function initializeQuantityControls() {
    const quantityInput = document.querySelector('.quantity-input');
    const decreaseBtn = document.querySelector('.quantity-btn.decrease');
    const increaseBtn = document.querySelector('.quantity-btn.increase');
    
    if (quantityInput && decreaseBtn && increaseBtn) {
        let currentQuantity = parseInt(quantityInput.value) || 1;
        const minQuantity = 1;
        const maxQuantity = 99; // Can be made dynamic based on stock
        
        // Initialize quantity display
        updateQuantityDisplay();
        
        decreaseBtn.addEventListener('click', function() {
            if (currentQuantity > minQuantity) {
                currentQuantity--;
                quantityInput.value = currentQuantity;
                updateQuantityDisplay();
                
                // Add click animation
                this.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 150);
            } else {
                // Show feedback when at minimum
                this.style.background = '#ef4444';
                this.style.color = 'white';
                setTimeout(() => {
                    this.style.background = '';
                    this.style.color = '';
                }, 200);
                
                showNotification('Số lượng tối thiểu là 1!', 'warning');
            }
        });
        
        increaseBtn.addEventListener('click', function() {
            // Check stock availability
            const availability = document.querySelector('.availability');
            if (availability && availability.classList.contains('out-of-stock')) {
                showNotification('Sản phẩm hiện đang hết hàng!', 'error');
                return;
            }
            
            if (currentQuantity < maxQuantity) {
                currentQuantity++;
                quantityInput.value = currentQuantity;
                updateQuantityDisplay();
                
                // Add click animation
                this.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 150);
                
                // Show warning when approaching max
                if (currentQuantity >= maxQuantity - 5) {
                    showNotification(`Chỉ có thể mua tối đa ${maxQuantity} sản phẩm!`, 'warning');
                }
            } else {
                // Show feedback when at maximum
                this.style.background = '#f59e0b';
                this.style.color = 'white';
                setTimeout(() => {
                    this.style.background = '';
                    this.style.color = '';
                }, 200);
                
                showNotification(`Số lượng tối đa là ${maxQuantity}!`, 'warning');
            }
        });
        
        quantityInput.addEventListener('input', function() {
            let newQuantity = parseInt(this.value);
            
            // Handle empty or invalid input
            if (isNaN(newQuantity) || newQuantity < 1) {
                newQuantity = minQuantity;
            } else if (newQuantity > maxQuantity) {
                newQuantity = maxQuantity;
                showNotification(`Số lượng tối đa là ${maxQuantity}!`, 'warning');
            }
            
            currentQuantity = newQuantity;
            this.value = currentQuantity;
            updateQuantityDisplay();
        });
        
        quantityInput.addEventListener('blur', function() {
            // Final validation on blur
            if (this.value === '' || parseInt(this.value) < minQuantity) {
                currentQuantity = minQuantity;
                this.value = currentQuantity;
                updateQuantityDisplay();
            }
        });
        
        // Handle keyboard input
        quantityInput.addEventListener('keydown', function(e) {
            // Allow: backspace, delete, tab, escape, enter, home, end, left, right, up, down
            if ([8, 9, 27, 13, 35, 36, 37, 39, 38, 40].includes(e.keyCode) ||
                // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                (e.keyCode === 65 && e.ctrlKey === true) ||
                (e.keyCode === 67 && e.ctrlKey === true) ||
                (e.keyCode === 86 && e.ctrlKey === true) ||
                (e.keyCode === 88 && e.ctrlKey === true)) {
                return;
            }
            
            // Ensure that it is a number and stop the keypress
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                e.preventDefault();
            }
        });
        
        function updateQuantityDisplay() {
            console.log('Quantity updated to:', currentQuantity);
            
            // Update button states
            decreaseBtn.disabled = currentQuantity <= minQuantity;
            increaseBtn.disabled = currentQuantity >= maxQuantity;
            
            // Update button styles based on state
            if (decreaseBtn.disabled) {
                decreaseBtn.style.opacity = '0.5';
                decreaseBtn.style.cursor = 'not-allowed';
            } else {
                decreaseBtn.style.opacity = '1';
                decreaseBtn.style.cursor = 'pointer';
            }
            
            if (increaseBtn.disabled) {
                increaseBtn.style.opacity = '0.5';
                increaseBtn.style.cursor = 'not-allowed';
            } else {
                increaseBtn.style.opacity = '1';
                increaseBtn.style.cursor = 'pointer';
            }
            
            // Update total price display if exists
            updateTotalPriceDisplay();
            
            // Save current quantity to session storage for persistence
            const productId = document.querySelector('[data-product-id]')?.dataset.productId;
            if (productId) {
                sessionStorage.setItem(`quantity_${productId}`, currentQuantity.toString());
            }
        }
        
        function updateTotalPriceDisplay() {
            const currentPriceElement = document.querySelector('.current-price');
            const totalPriceElement = document.querySelector('.total-price');
            
            if (currentPriceElement && currentQuantity > 1) {
                const priceText = currentPriceElement.textContent;
                const numericPrice = parseInt(priceText.replace(/[^\d]/g, ''));
                const totalPrice = numericPrice * currentQuantity;
                
                // Create or update total price display
                if (!totalPriceElement) {
                    const totalDiv = document.createElement('div');
                    totalDiv.className = 'total-price';
                    totalDiv.style.cssText = `
                        font-size: 1.1rem;
                        font-weight: 600;
                        color: #10b981;
                        margin-top: 0.5rem;
                        padding: 0.5rem;
                        background: rgba(16, 185, 129, 0.1);
                        border-radius: 8px;
                        border-left: 3px solid #10b981;
                    `;
                    currentPriceElement.parentNode.appendChild(totalDiv);
                }
                
                const displayElement = totalPriceElement || document.querySelector('.total-price');
                if (displayElement) {
                    displayElement.innerHTML = `
                        <i class="fas fa-calculator"></i> 
                        Tổng tiền: ${formatPrice(totalPrice)}
                    `;
                    displayElement.style.display = 'block';
                }
            } else if (totalPriceElement) {
                totalPriceElement.style.display = 'none';
            }
        }
        
        // Load saved quantity from session storage
        const productId = document.querySelector('[data-product-id]')?.dataset.productId;
        if (productId) {
            const savedQuantity = sessionStorage.getItem(`quantity_${productId}`);
            if (savedQuantity && !isNaN(parseInt(savedQuantity))) {
                const qty = parseInt(savedQuantity);
                if (qty >= minQuantity && qty <= maxQuantity) {
                    currentQuantity = qty;
                    quantityInput.value = currentQuantity;
                    updateQuantityDisplay();
                }
            }
        }
    }
}

// Make updateQuantityDisplay globally available
window.updateQuantityDisplay = function() {
    const quantityInput = document.querySelector('.quantity-input');
    if (quantityInput) {
        quantityInput.dispatchEvent(new Event('input'));
    }
};

function initializeActions() {
    const addToCartBtn = document.querySelector('.add-to-cart-btn');
    const buyNowBtn = document.querySelector('.buy-now-btn');
    
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', async function() {
            console.log('🛒 Add to Cart button clicked');
            
            // Get quantity from the quantity selector
            const quantityInput = document.querySelector('.quantity-input');
            const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;
            
            // Get product data from button attributes or DOM
            const productId = addToCartBtn.dataset.productId || document.querySelector('[data-product-id]')?.dataset.productId;
            const productName = addToCartBtn.dataset.productName || document.querySelector('.product-title')?.textContent || 'Product';
            const productPrice = addToCartBtn.dataset.productPrice || document.querySelector('.current-price')?.textContent || '0';
            const productImage = addToCartBtn.dataset.productImage || document.querySelector('.main-image img')?.src || '';
            
            // Check availability first
            const availability = document.querySelector('.availability');
            if (availability && availability.classList.contains('out-of-stock')) {
                showNotification('Sản phẩm hiện đang hết hàng!', 'error');
                return;
            }
            
            console.log('🛒 Adding to cart:', { productId, productName, productPrice, productImage, quantity });
            
            // Store quantity globally for variant selection modal
            window.selectedProductQuantity = quantity;
            console.log('🛒 Stored quantity for variant selection:', window.selectedProductQuantity);
            
            // Use the global addToCart function from script.js which handles variant checking
            if (typeof window.addToCart === 'function') {
                await window.addToCart(productName, productPrice, productId, productImage, quantity);
            } else if (typeof window.addToCartDirectly === 'function') {
                // If no variant checking function, use direct add with quantity
                await window.addToCartDirectly(productName, productPrice, productId, productImage, quantity);
                showNotification(`Đã thêm ${quantity} sản phẩm vào giỏ hàng!`, 'success');
            } else {
                console.error('❌ addToCart function not found');
                showNotification('Lỗi: Không thể thêm vào giỏ hàng!', 'error');
            }
        });
        
        console.log('✅ Add to cart event listener attached');
    }
    
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', function() {
            const productElement = document.querySelector('[data-product-id]');
            if (!productElement) {
                showNotification('Không tìm thấy thông tin sản phẩm!', 'error');
                return;
            }
            
            const productId = productElement.dataset.productId;
            const productName = document.querySelector('.product-title')?.textContent || 'Product';
            const productPrice = document.querySelector('.current-price')?.textContent?.replace(/[^\d]/g, '') || '0';
            const productImage = document.querySelector('.main-image img')?.src || '';
            const availability = document.querySelector('.availability');
            
            // Check availability first
            if (availability && availability.classList.contains('out-of-stock')) {
                showNotification('Sản phẩm hiện đang hết hàng!', 'error');
                return;
            }
            
            console.log('🛍️ Buy Now clicked for product:', productId, productName);
            
            // Call our new Buy Now function with variant checking
            handleBuyNowWithVariantCheck(productId, productName, productPrice, productImage);
        });
    }
}

// Get product icon based on name/category
function getProductIcon(productName) {
    const name = productName.toLowerCase();
    if (name.includes('laptop')) return 'fas fa-laptop';
    if (name.includes('cpu') || name.includes('core') || name.includes('ryzen')) return 'fas fa-microchip';
    if (name.includes('gpu') || name.includes('rtx') || name.includes('gtx') || name.includes('graphics')) return 'fas fa-memory';
    if (name.includes('monitor') || name.includes('màn hình')) return 'fas fa-desktop';
    if (name.includes('keyboard') || name.includes('bàn phím')) return 'fas fa-keyboard';
    if (name.includes('mouse') || name.includes('chuột')) return 'fas fa-mouse';
    if (name.includes('headset') || name.includes('tai nghe')) return 'fas fa-headphones';
    if (name.includes('ssd') || name.includes('nvme') || name.includes('hdd') || name.includes('storage')) return 'fas fa-hdd';
    if (name.includes('ram') || name.includes('memory')) return 'fas fa-memory';
    if (name.includes('motherboard') || name.includes('mainboard')) return 'fas fa-microchip';
    if (name.includes('case') || name.includes('chassis')) return 'fas fa-cube';
    if (name.includes('psu') || name.includes('power')) return 'fas fa-plug';
    return 'fas fa-cube';
}

function initializeRelatedProducts() {
    // The new slider initialization is now handled by initRelatedProductsSlider
    // This function is kept for compatibility
    console.log('Related products will be initialized by the new slider system');
}

// =====================================
// BUY NOW WITH VARIANT CHECKING
// =====================================

// Handle Buy Now with variant checking - ensures variant is selected before proceeding to checkout
async function handleBuyNowWithVariantCheck(productId, productName, productPrice, productImage) {
    console.log('🛍️ Buy Now with variant check:', { productId, productName, productPrice });
    
    // Get quantity from the quantity selector
    const quantityInput = document.querySelector('.quantity-input');
    const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;
    
    // Store quantity globally for variant selection modal
    window.selectedProductQuantity = quantity;
    
    const buyNowBtn = document.querySelector('.buy-now-btn');
    
    // Disable button during process
    const originalText = buyNowBtn.innerHTML;
    buyNowBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
    buyNowBtn.disabled = true;
    
    try {
        // Check if product has variants
        console.log('🔍 Checking for product variants...');
        const variantResponse = await fetch(`/api/products/${productId}/variants`);
        
        if (variantResponse.ok) {
            const variantData = await variantResponse.json();
            console.log('📦 Variant data received:', variantData);
            
            if (variantData.success && variantData.variants && variantData.variants.length > 0) {
                console.log('🎯 Product has variants, showing selection modal for Buy Now');
                
                // Product has variants - show selection modal
                // Store buy now intent and quantity in global variables
                window.buyNowAfterVariantSelection = true;
                window.selectedProductQuantity = quantity;
                
                if (typeof window.showVariantSelectionModal === 'function') {
                    // Use the existing variant modal but mark it as buy now
                    // Get stock information from the DOM more reliably
                    let stock = 0;
                    let availability = 'in-stock';
                    
                    // Try to get stock from meta-value (stock display)
                    const stockElements = document.querySelectorAll('.meta-item .meta-value');
                    stockElements.forEach(element => {
                        const text = element.textContent.trim();
                        if (text.includes('sản phẩm')) {
                            const match = text.match(/(\d+)\s*sản phẩm/);
                            if (match) {
                                stock = parseInt(match[1]);
                            }
                        }
                    });
                    
                    // Get availability from availability element
                    const availabilityElement = document.querySelector('.availability');
                    if (availabilityElement) {
                        if (availabilityElement.classList.contains('out-of-stock')) {
                            availability = 'out-of-stock';
                        } else if (availabilityElement.classList.contains('in-stock')) {
                            availability = 'in-stock';
                        } else if (availabilityElement.classList.contains('pre-order')) {
                            availability = 'pre-order';
                        }
                    }
                    
                    console.log('📊 Stock information extracted for Buy Now:', { stock, availability });
                    
                    const mainProduct = {
                        id: productId,
                        name: productName,
                        price: productPrice,
                        image: productImage,
                        images: productImage ? [productImage] : [], // Add images array for proper display
                        stock: stock,
                        availability: availability
                    };
                    
                    window.showVariantSelectionModal(mainProduct, variantData.variants);
                    
                    // Restore button state since modal will handle the rest
                    buyNowBtn.innerHTML = originalText;
                    buyNowBtn.disabled = false;
                    
                    return; // Exit here - variant modal will handle the rest
                } else {
                    throw new Error('Variant selection modal not available');
                }
            } else {
                console.log('📦 No variants found, proceeding with Buy Now for main product');
                // No variants - proceed directly with buy now
                await proceedToBuyNow(productId, productName, productPrice, productImage);
            }
        } else {
            console.warn('⚠️ Could not check variants, proceeding with Buy Now for main product');
            // API error - proceed with main product
            await proceedToBuyNow(productId, productName, productPrice, productImage);
        }
    } catch (error) {
        console.error('❌ Error in handleBuyNowWithVariantCheck:', error);
        showNotification('Có lỗi xảy ra! Vui lòng thử lại.', 'error');
    } finally {
        // Restore button state
        buyNowBtn.innerHTML = originalText;
        buyNowBtn.disabled = false;
    }
}

// Proceed with Buy Now after variant selection (or for products without variants)
async function proceedToBuyNow(productId, productName, productPrice, productImage) {
    console.log('🛒 Proceeding with Buy Now:', { productId, productName, productPrice });
    
    // Get quantity from the product detail page
    const quantityInput = document.querySelector('.quantity-input');
    const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;
    
    try {
        // First, add the product to cart with correct quantity
        if (typeof window.addToCartDirectly === 'function') {
            console.log('➕ Adding product to cart first with quantity:', quantity);
            
            // Add the product with the specified quantity
            await window.addToCartDirectly(productName, productPrice, productId, productImage, quantity);
            
            console.log(`✅ Added ${quantity} items to cart for Buy Now`);
        } else {
            console.warn('⚠️ addToCartDirectly not available, using fallback');
            // Fallback - use EJS function or click the add to cart button
            if (typeof window.addToCartDirectlyProduct === 'function') {
                await window.addToCartDirectlyProduct(productName, productPrice, productId, productImage, quantity);
            } else {
                const addToCartBtn = document.querySelector('.add-to-cart-btn');
                if (addToCartBtn) {
                    addToCartBtn.click();
                }
            }
        }
        
        // Wait a moment for cart to update
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // For guest users, sync cart from localStorage to window.cartItems
        if (!window.currentUser) {
            console.log('🔄 Guest user detected, syncing cart from localStorage...');
            const localCartItems = JSON.parse(localStorage.getItem('techHavenCart')) || [];
            console.log('📦 Local cart items:', localCartItems.length);
            
            // Update window.cartItems with localStorage data
            window.cartItems = localCartItems;
            
            // Force update cart UI to ensure sync
            if (typeof window.updateCartUI === 'function') {
                window.updateCartUI();
            }
            
            console.log('✅ Cart synced for guest checkout - window.cartItems:', window.cartItems.length);
        }
        
        // Then open cart and proceed to checkout
        if (typeof window.toggleCart === 'function') {
            console.log('🛍️ Opening cart...');
            window.toggleCart();
            
            // Show loading state
            showNotification('Đang chuẩn bị thanh toán...', 'info');
            
            // Proceed to checkout after cart is opened
            setTimeout(() => {
                if (typeof window.proceedToCheckout === 'function') {
                    console.log('💳 Proceeding to checkout...');
                    window.proceedToCheckout();
                } else {
                    console.warn('proceedToCheckout function not available');
                    // Try alternative checkout opening methods
                    const checkoutModal = document.getElementById('checkoutModal');
                    if (checkoutModal) {
                        checkoutModal.style.display = 'flex';
                        checkoutModal.classList.add('active');
                        console.log('✅ Checkout modal opened directly');
                    } else {
                        showNotification('Vui lòng nhấn "Thanh toán" trong giỏ hàng!', 'info');
                    }
                }
            }, 1000);
        } else {
            console.error('toggleCart function not available');
            showNotification('Lỗi hệ thống! Vui lòng thử lại.', 'error');
        }
    } catch (error) {
        console.error('❌ Error in proceedToBuyNow:', error);
        showNotification('Có lỗi xảy ra khi xử lý mua hàng!', 'error');
    }
}

// Global function to handle variant selection and proceed with buy now
window.selectVariantAndBuyNow = async function(productId, productName, productPrice, productImage) {
    console.log('🎯 Variant selected for Buy Now:', { productId, productName, productPrice });
    
    // Close the variant modal
    if (typeof window.closeVariantModal === 'function') {
        window.closeVariantModal();
    }
    
    // Clear the buy now flag
    window.buyNowAfterVariantSelection = false;
    
    // Get quantity from globally stored value (set when Buy Now was clicked)
    const quantity = window.selectedProductQuantity || 1;
    
    console.log('🛒 Processing Buy Now for selected variant with quantity:', quantity);
    
    try {
        // First, add the selected variant to cart with correct quantity
        if (typeof window.addToCartDirectly === 'function') {
            console.log('➕ Adding variant to cart using addToCartDirectly with quantity:', quantity);
            
            // Add the product with the specified quantity
            await window.addToCartDirectly(productName, productPrice, productId, productImage, quantity);
            
            console.log(`✅ Added ${quantity} items of variant to cart`);
        } else {
            console.warn('⚠️ addToCartDirectly not available, using fallback');
            // Fallback - use EJS function if available
            if (typeof window.addToCartDirectlyProduct === 'function') {
                await window.addToCartDirectlyProduct(productName, productPrice, productId, productImage, quantity);
            } else {
                throw new Error('No cart functions available');
            }
        }
        
        // Wait a moment for cart to update
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // For guest users, sync cart from localStorage to window.cartItems
        if (!window.currentUser) {
            console.log('🔄 Guest user detected, syncing cart from localStorage...');
            const localCartItems = JSON.parse(localStorage.getItem('techHavenCart')) || [];
            console.log('📦 Local cart items:', localCartItems.length);
            
            // Update window.cartItems with localStorage data
            window.cartItems = localCartItems;
            
            // Force update cart UI to ensure sync
            if (typeof window.updateCartUI === 'function') {
                window.updateCartUI();
            }
            
            console.log('✅ Cart synced for guest checkout - window.cartItems:', window.cartItems.length);
        }
        
        // Then open cart sidebar
        if (typeof window.toggleCart === 'function') {
            console.log('🛍️ Opening cart sidebar...');
            window.toggleCart();
            
            // Show loading state
            showNotification('Đang chuẩn bị thanh toán...', 'info');
            
            // Wait for cart to be visible, then proceed to checkout
            setTimeout(() => {
                if (typeof window.proceedToCheckout === 'function') {
                    console.log('💳 Proceeding to checkout...');
                    window.proceedToCheckout();
                } else {
                    console.warn('proceedToCheckout function not available');
                    // Try alternative checkout opening methods
                    const checkoutModal = document.getElementById('checkoutModal');
                    if (checkoutModal) {
                        checkoutModal.style.display = 'flex';
                        checkoutModal.classList.add('active');
                        console.log('✅ Checkout modal opened directly');
                    } else {
                        showNotification('Vui lòng nhấn "Thanh toán" trong giỏ hàng!', 'info');
                    }
                }
            }, 1000);
        } else {
            console.error('toggleCart function not available');
            showNotification('Lỗi: Không thể mở giỏ hàng!', 'error');
        }
    } catch (error) {
        console.error('❌ Error in selectVariantAndBuyNow:', error);
        showNotification('Có lỗi xảy ra khi xử lý mua hàng!', 'error');
    } finally {
        // Clear the stored quantity and buy now flag
        window.selectedProductQuantity = null;
        window.buyNowAfterVariantSelection = false;
    }
};

// Make functions globally available
window.handleBuyNowWithVariantCheck = handleBuyNowWithVariantCheck;
window.proceedToBuyNow = proceedToBuyNow;

function setupEventListeners() {
    // Close cart when clicking overlay
    document.addEventListener('click', function(e) {
        if (e.target.id === 'cartOverlay') {
            if (typeof window.toggleCart === 'function') {
                window.toggleCart();
            }
        }
    });
    
    // Close modals when clicking overlay
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            if (typeof window.closeCheckoutModal === 'function') {
                window.closeCheckoutModal();
            }
        }
    });
    
    // Setup search functionality
    setupSearchFunctionality();
    
    // Smooth scroll for anchor links (exclude admin dropdown)
    document.querySelectorAll('a[href^="#"]:not(.dropdown-toggle)').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href && href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
    
    // Handle breadcrumb clicks
    const breadcrumbLinks = document.querySelectorAll('.breadcrumb a');
    breadcrumbLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Add loading animation
            this.style.opacity = '0.7';
            setTimeout(() => {
                this.style.opacity = '1';
            }, 300);
        });
    });
}

// Search functionality for product detail page
function setupSearchFunctionality() {
    const searchIcon = document.querySelector('.fa-search[onclick*="toggleSearch"]');
    const mobileSearchLink = document.querySelector('a[onclick*="toggleSearch"]');
    
    // Remove onclick attributes and add proper event listeners
    if (searchIcon) {
        searchIcon.removeAttribute('onclick');
        searchIcon.addEventListener('click', toggleProductDetailSearch);
    }
    
    if (mobileSearchLink) {
        mobileSearchLink.removeAttribute('onclick');
        mobileSearchLink.addEventListener('click', function(e) {
            e.preventDefault();
            toggleProductDetailSearch();
        });
    }
    
    // Setup search overlay events
    const searchOverlay = document.getElementById('searchOverlay');
    if (searchOverlay) {
        // Close search when clicking overlay background
        searchOverlay.addEventListener('click', function(e) {
            if (e.target === searchOverlay) {
                toggleProductDetailSearch();
            }
        });
        
        // Setup search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(performProductSearch, 300));
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    performProductSearch();
                }
            });
        }
        
        // Setup search button
        const searchBtn = searchOverlay.querySelector('.search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', performProductSearch);
        }
        
        // Setup close button
        const closeBtn = searchOverlay.querySelector('.search-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', toggleProductDetailSearch);
        }
    }
    
    // Handle escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const searchOverlay = document.getElementById('searchOverlay');
            if (searchOverlay && searchOverlay.classList.contains('active')) {
                toggleProductDetailSearch();
            }
        }
    });
}

function toggleProductDetailSearch() {
    const searchOverlay = document.getElementById('searchOverlay');
    const searchInput = document.getElementById('searchInput');
    
    if (searchOverlay) {
        const isActive = searchOverlay.classList.contains('active');
        
        if (isActive) {
            // Closing search
            searchOverlay.classList.remove('active');
            document.body.style.overflow = '';
            clearSearchSuggestions();
        } else {
            // Opening search
            searchOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            if (searchInput) {
                setTimeout(() => {
                    searchInput.focus();
                    showDefaultSearchSuggestions();
                }, 300);
            }
        }
    }
}

async function performProductSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchSuggestions = document.getElementById('searchSuggestions');
    
    if (!searchInput || !searchSuggestions) return;
    
    const query = searchInput.value.toLowerCase().trim();
    
    if (!query) {
        showDefaultSearchSuggestions();
        return;
    }

    try {
        // Show loading state
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

        // Fetch products from Firebase via API
        const response = await fetch('/api/products');
        if (!response.ok) {
            throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('🔍 Raw response from Firebase:', data);
        
        // Handle different response formats
        let products = [];
        if (Array.isArray(data)) {
            products = data;
        } else if (data && Array.isArray(data.products)) {
            products = data.products;
        } else if (data && typeof data === 'object') {
            // If data is an object with product IDs as keys
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
        
        displaySearchResults(filteredProducts, query);
        
    } catch (error) {
        console.error('❌ Error searching products:', error);
        
        // Try to use fallback data if API fails
        console.log('🔄 Attempting to use fallback product data...');
        
        // Fallback to sample data for demonstration
        const fallbackProducts = [
            { id: 'K8lbqOj5YyhYOBc5A52A', name: 'Test Product 1', price: 1000000, category: 'Laptop', brand: 'Test' },
            { id: 'sample-2', name: 'Test Product 2', price: 2000000, category: 'CPU', brand: 'Test' },
            { id: 'sample-3', name: 'Test Product 3', price: 3000000, category: 'VGA', brand: 'Test' }
        ];
        
        // Filter fallback products
        const filteredFallback = fallbackProducts.filter(product => {
            const name = (product.name || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            const brand = (product.brand || '').toLowerCase();
            
            return name.includes(query) ||
                   category.includes(query) ||
                   brand.includes(query);
        });
        
        if (filteredFallback.length > 0) {
            console.log('✅ Using fallback data with', filteredFallback.length, 'matches');
            displaySearchResults(filteredFallback, query);
        } else {
            // Show error message
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
    const searchSuggestions = document.getElementById('searchSuggestions');
    if (!searchSuggestions) return;
    
    if (products.length === 0) {
        searchSuggestions.innerHTML = `
            <div class="suggestion-item no-results">
                <i class="fas fa-search"></i>
                <div class="suggestion-text">
                    <h4>Không tìm thấy sản phẩm cho "${query}"</h4>
                    <p>Thử từ khóa khác hoặc duyệt theo danh mục</p>
                </div>
            </div>
            <div class="suggestion-item" onclick="navigateToShop()">
                <i class="fas fa-store"></i>
                <div class="suggestion-text">
                    <h4>Xem tất cả sản phẩm</h4>
                    <p>Khám phá toàn bộ cửa hàng của chúng tôi</p>
                </div>
            </div>
        `;
        return;
    }
    
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
                <i class="fas fa-${getProductSearchIcon(product.category)}"></i>
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
                <i class="fas fa-arrow-right"></i>
                <div class="suggestion-text">
                    <h4>Xem tất cả ${products.length} kết quả</h4>
                    <p>Tìm kiếm "${query}" trong cửa hàng</p>
                </div>
            </div>
        `;
    }
    
    searchSuggestions.innerHTML = resultsHTML;
    
    // Add click event listeners for product navigation
    const productItems = searchSuggestions.querySelectorAll('[data-product-id]');
    productItems.forEach(item => {
        item.addEventListener('click', function() {
            const productId = this.getAttribute('data-product-id');
            console.log('🔍 Product clicked:', productId);
            navigateToProduct(productId);
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
}

function showDefaultSearchSuggestions() {
    const searchSuggestions = document.getElementById('searchSuggestions');
    if (!searchSuggestions) return;
    
    searchSuggestions.innerHTML = `
        <div class="suggestion-item" onclick="navigateToCategory('laptop')">
            <i class="fas fa-laptop"></i>
            <div class="suggestion-text">
                <h4>Laptop Gaming</h4>
                <p>ASUS, MSI, Acer, Alienware</p>
            </div>
        </div>
        <div class="suggestion-item" onclick="navigateToCategory('cpu')">
            <i class="fas fa-microchip"></i>
            <div class="suggestion-text">
                <h4>CPU</h4>
                <p>Intel Core, AMD Ryzen</p>
            </div>
        </div>
        <div class="suggestion-item" onclick="navigateToCategory('gpu')">
            <i class="fas fa-memory"></i>
            <div class="suggestion-text">
                <h4>Card đồ họa</h4>
                <p>RTX 4080, RTX 4070, RTX 4060</p>
            </div>
        </div>
        <div class="suggestion-item" onclick="navigateToCategory('monitor')">
            <i class="fas fa-desktop"></i>
            <div class="suggestion-text">
                <h4>Màn hình</h4>
                <p>Gaming, 4K, Ultrawide</p>
            </div>
        </div>
    `;
}

function clearSearchSuggestions() {
    const searchSuggestions = document.getElementById('searchSuggestions');
    if (searchSuggestions) {
        searchSuggestions.innerHTML = '';
    }
}

function getProductSearchIcon(category) {
    const iconMap = {
        'Laptop': 'laptop',
        'CPU': 'microchip', 
        'VGA': 'memory',
        'RAM': 'memory',
        'Storage': 'hdd',
        'Monitor': 'desktop',
        'Keyboard': 'keyboard',
        'Mouse': 'mouse',
        'Headset': 'headphones'
    };
    return iconMap[category] || 'cube';
}

function highlightSearchTerm(text, term) {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<mark style="background: #fbbf24; color: #92400e; padding: 0 2px; border-radius: 2px;">$1</mark>');
}

// Navigation functions
function navigateToProduct(productId) {
    window.location.href = `/product/${productId}`;
}

function navigateToShop() {
    window.location.href = '/shop';
}

function navigateToCategory(category) {
    window.location.href = `/shop?category=${category}`;
}

function searchAndNavigateToShop(query) {
    window.location.href = `/shop?search=${encodeURIComponent(query)}`;
}

// Debounce function for search input
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make search functions globally available
window.toggleProductDetailSearch = toggleProductDetailSearch;
window.navigateToProduct = navigateToProduct;
window.navigateToShop = navigateToShop;
window.navigateToCategory = navigateToCategory;
window.searchAndNavigateToShop = searchAndNavigateToShop;

// Utility function for notifications
function showNotification(message, type = 'info') {
    // Remove any existing notifications first
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => {
        if (notif.parentNode) {
            document.body.removeChild(notif);
        }
    });
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Get appropriate icon and colors based on type
    let icon, backgroundColor, borderColor;
    
    switch (type) {
        case 'success':
            icon = 'fas fa-check-circle';
            backgroundColor = 'linear-gradient(135deg, #10b981, #059669)';
            borderColor = '#10b981';
            break;
        case 'error':
            icon = 'fas fa-exclamation-circle';
            backgroundColor = 'linear-gradient(135deg, #ef4444, #dc2626)';
            borderColor = '#ef4444';
            break;
        case 'warning':
            icon = 'fas fa-exclamation-triangle';
            backgroundColor = 'linear-gradient(135deg, #f59e0b, #d97706)';
            borderColor = '#f59e0b';
            break;
        case 'info':
        default:
            icon = 'fas fa-info-circle';
            backgroundColor = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
            borderColor = '#3b82f6';
            break;
    }
    
    notification.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add styles with improved design
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 15px 35px rgba(0,0,0,0.2);
        z-index: 10000;
        transform: translateX(400px);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        gap: 0.8rem;
        max-width: 350px;
        font-weight: 500;
        font-size: 0.9rem;
        border-left: 4px solid ${borderColor};
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    `;
    
    // Style the close button
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
        closeBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            padding: 0.3rem;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            margin-left: auto;
            transition: all 0.3s ease;
        `;
        
        closeBtn.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(255, 255, 255, 0.3)';
            this.style.transform = 'scale(1.1)';
        });
        
        closeBtn.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255, 255, 255, 0.2)';
            this.style.transform = 'scale(1)';
        });
    }
    
    document.body.appendChild(notification);
    
    // Animate in with bounce effect
    setTimeout(() => {
        notification.style.transform = 'translateX(0) scale(1.05)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0) scale(1)';
    }, 200);
    
    // Auto remove based on message length and type
    let autoRemoveTime = 4000; // Default 4 seconds
    
    if (type === 'error') {
        autoRemoveTime = 6000; // Errors stay longer
    } else if (type === 'success') {
        autoRemoveTime = 3000; // Success messages shorter
    } else if (message.length > 50) {
        autoRemoveTime = 5000; // Longer messages stay longer
    }
    
    const autoRemoveTimeout = setTimeout(() => {
        if (notification.parentNode) {
            notification.style.transform = 'translateX(400px) scale(0.95)';
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 400);
        }
    }, autoRemoveTime);
    
    // Clear timeout if manually closed
    closeBtn.addEventListener('click', () => {
        clearTimeout(autoRemoveTimeout);
    });
    
    // Add hover pause functionality
    notification.addEventListener('mouseenter', () => {
        clearTimeout(autoRemoveTimeout);
        notification.style.transform = 'translateX(0) scale(1.02)';
    });
    
    notification.addEventListener('mouseleave', () => {
        notification.style.transform = 'translateX(0) scale(1)';
        // Resume auto-remove with remaining time
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(400px) scale(0.95)';
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }
                }, 400);
            }
        }, 2000); // Give 2 more seconds after hover
    });
    
    // Make notification clickable to dismiss
    notification.addEventListener('click', (e) => {
        if (e.target !== closeBtn && !closeBtn.contains(e.target)) {
            clearTimeout(autoRemoveTimeout);
            notification.style.transform = 'translateX(400px) scale(0.95)';
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 400);
        }
    });
}

// Format price function
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
}

// Export functions for global use
window.productDetailFunctions = {
    showNotification,
    formatPrice
};

// =====================================
// SIMPLE RELATED PRODUCTS SLIDER
// =====================================

let currentIndex = 0;
let itemsPerPage = 3;
let totalItems = 0;

function initRelatedProductsSlider() {
    const track = document.getElementById('productsTrack');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (!track || !prevBtn || !nextBtn) {
        console.log('Slider elements not found:', { track: !!track, prevBtn: !!prevBtn, nextBtn: !!nextBtn });
        return;
    }
    
    const items = track.querySelectorAll('.product-item');
    totalItems = items.length;
    
    console.log('Initializing slider with', totalItems, 'items');
    
    // Calculate items per page based on screen size
    updateItemsPerPage();
    console.log('Items per page:', itemsPerPage);
    
    // Add event listeners
    prevBtn.addEventListener('click', slidePrev);
    nextBtn.addEventListener('click', slideNext);
    
    // Add click handlers to product items
    items.forEach(item => {
        item.addEventListener('click', function() {
            const productId = this.dataset.productId;
            if (productId) {
                window.location.href = `/product/${productId}`;
            }
        });
    });
    
    // Add touch/swipe support for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    let isDragging = false;
    
    track.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
        isDragging = false;
    }, { passive: true });
    
    track.addEventListener('touchmove', function(e) {
        isDragging = true;
    }, { passive: true });
    
    track.addEventListener('touchend', function(e) {
        if (!isDragging) return;
        
        touchEndX = e.changedTouches[0].screenX;
        const swipeDistance = touchStartX - touchEndX;
        const minSwipeDistance = 50;
        
        if (Math.abs(swipeDistance) > minSwipeDistance) {
            if (swipeDistance > 0) {
                // Swipe left - next
                slideNext();
            } else {
                // Swipe right - previous
                slidePrev();
            }
        }
    }, { passive: true });
    
    // Prevent scrolling when swiping on the slider
    track.addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });
    
    // Update initial state
    updateSlider();
    
    // Handle window resize
    window.addEventListener('resize', handleSliderResize);
}

function updateItemsPerPage() {
    const width = window.innerWidth;
    if (width >= 1200) {
        itemsPerPage = 3;
    } else if (width >= 768) {
        itemsPerPage = 2;
    } else {
        itemsPerPage = 1; // Show only 1 product on mobile
    }
}

function slidePrev() {
    console.log('slidePrev - currentIndex:', currentIndex);
    
    if (currentIndex > 0) {
        currentIndex--;
        updateSlider();
        console.log('Moved to index:', currentIndex);
    } else {
        console.log('Already at first item');
    }
}

function slideNext() {
    const maxIndex = Math.max(0, totalItems - itemsPerPage);
    console.log('slideNext - currentIndex:', currentIndex, 'maxIndex:', maxIndex, 'totalItems:', totalItems, 'itemsPerPage:', itemsPerPage);
    
    if (currentIndex < maxIndex) {
        currentIndex++;
        updateSlider();
        console.log('Moved to index:', currentIndex);
    } else {
        console.log('Already at last item');
    }
}

function updateSlider() {
    const track = document.getElementById('productsTrack');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (!track) return;
    
    // Calculate translate value based on viewport width
    const width = window.innerWidth;
    let translateX = 0;
    
    if (width < 768) {
        // Mobile: move by the actual product item width including margins
        const productItem = track.querySelector('.product-item');
        if (productItem) {
            const itemStyles = window.getComputedStyle(productItem);
            const itemWidth = productItem.offsetWidth;
            const marginLeft = parseFloat(itemStyles.marginLeft) || 0;
            const marginRight = parseFloat(itemStyles.marginRight) || 0;
            
            // For smaller products, calculate the center position
            const containerWidth = track.parentElement.offsetWidth - 70; // Account for nav buttons
            const totalItemWidth = itemWidth + marginLeft + marginRight;
            const centerOffset = (containerWidth - itemWidth) / 2;
            
            translateX = -currentIndex * totalItemWidth + centerOffset;
            
            console.log('Mobile slider calculation:', {
                currentIndex,
                itemWidth,
                marginLeft,
                marginRight,
                totalItemWidth,
                containerWidth,
                centerOffset,
                translateX
            });
        }
    } else {
        // Desktop/Tablet: use item width + gap
        const itemWidth = track.querySelector('.product-item')?.offsetWidth || 280;
        const gap = parseFloat(getComputedStyle(track).gap) || 24;
        translateX = -currentIndex * (itemWidth + gap);
        
        console.log('Desktop slider calculation:', {
            currentIndex,
            itemWidth,
            gap,
            translateX
        });
    }
    
    track.style.transform = `translateX(${translateX}px)`;
    console.log('Applied transform:', `translateX(${translateX}px)`);
    
    // Update button states
    const maxIndex = Math.max(0, totalItems - itemsPerPage);
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= maxIndex;
    
    // Add visual feedback for disabled buttons
    if (prevBtn.disabled) {
        prevBtn.style.opacity = '0.4';
        prevBtn.style.cursor = 'not-allowed';
    } else {
        prevBtn.style.opacity = '1';
        prevBtn.style.cursor = 'pointer';
    }
    
    if (nextBtn.disabled) {
        nextBtn.style.opacity = '0.4';
        nextBtn.style.cursor = 'not-allowed';
    } else {
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
    }
}

function handleSliderResize() {
    updateItemsPerPage();
    
    // Reset to valid position if needed
    const maxIndex = Math.max(0, totalItems - itemsPerPage);
    if (currentIndex > maxIndex) {
        currentIndex = maxIndex;
    }
    
    // Recalculate and update slider position with a small delay
    setTimeout(() => {
        updateSlider();
    }, 150); // Slightly longer delay to ensure DOM has updated
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initRelatedProductsSlider, 100);
    
    // Initialize admin dropdown with delay
    setTimeout(initializeProductDetailAdminDropdown, 300);
});

// Admin Dropdown Functionality for Product Detail
function initializeProductDetailAdminDropdown() {
    console.log('Initializing product detail admin dropdown...');
    
    // Wait for DOM to be fully ready
    const adminDropdown = document.querySelector('.admin-dropdown');
    if (!adminDropdown) {
        console.log('Admin dropdown not found, retrying in 200ms...');
        setTimeout(initializeProductDetailAdminDropdown, 200);
        return;
    }

    const dropdownToggle = adminDropdown.querySelector('.dropdown-toggle');
    const dropdownMenu = adminDropdown.querySelector('.dropdown-menu');

    if (!dropdownToggle || !dropdownMenu) {
        console.log('Dropdown elements not found:', {
            toggle: !!dropdownToggle,
            menu: !!dropdownMenu,
            dropdownHTML: adminDropdown.innerHTML
        });
        return;
    }

    console.log('Admin dropdown elements found, setting up events...');

    // Remove existing event listeners to prevent duplicates
    const newToggle = dropdownToggle.cloneNode(true);
    dropdownToggle.parentNode.replaceChild(newToggle, dropdownToggle);

    // Toggle dropdown on click
    newToggle.addEventListener('click', function(e) {
        console.log('Admin dropdown toggle clicked');
        e.preventDefault();
        e.stopPropagation();
        
        // Close other dropdowns
        document.querySelectorAll('.admin-dropdown.active').forEach(dropdown => {
            if (dropdown !== adminDropdown) {
                dropdown.classList.remove('active');
            }
        });
        
        // Toggle current dropdown
        const isActive = adminDropdown.classList.contains('active');
        if (isActive) {
            adminDropdown.classList.remove('active');
            console.log('Admin dropdown closed');
        } else {
            adminDropdown.classList.add('active');
            console.log('Admin dropdown opened');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!adminDropdown.contains(e.target)) {
            if (adminDropdown.classList.contains('active')) {
                console.log('Closing admin dropdown - clicked outside');
                adminDropdown.classList.remove('active');
            }
        }
    });

    // Close dropdown on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && adminDropdown.classList.contains('active')) {
            console.log('Closing admin dropdown - escape key');
            adminDropdown.classList.remove('active');
        }
    });

    // Handle dropdown menu clicks
    dropdownMenu.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (link && link.getAttribute('href') !== '#') {
            console.log('Admin dropdown menu item clicked:', link.getAttribute('href'));
            // Allow normal navigation for actual links
            adminDropdown.classList.remove('active');
        }
    });
    
    console.log('Product detail admin dropdown initialized successfully');
}

console.log('Product detail script loaded successfully');
