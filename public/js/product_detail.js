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
    
    // Load cart from localStorage and setup cart functionality
    if (typeof window.loadCartFromStorage === 'function') {
        window.loadCartFromStorage();
    }
    
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
    
    // Setup cart icon click
    const cartIcon = document.querySelector('.cart-icon-wrapper');
    if (cartIcon) {
        cartIcon.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Cart icon clicked in product detail');
            if (typeof window.toggleCart === 'function') {
                window.toggleCart();
            } else {
                console.error('toggleCart function not available');
            }
        });
    }
    
    // Also setup mobile cart link
    const mobileCartLink = document.querySelector('.mobile-cart-link');
    if (mobileCartLink) {
        mobileCartLink.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Mobile cart link clicked');
            if (typeof window.toggleCart === 'function') {
                window.toggleCart();
            }
        });
    }
    
    // Setup cart close button
    const cartClose = document.querySelector('.cart-close');
    if (cartClose) {
        cartClose.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Cart close button clicked');
            if (typeof window.toggleCart === 'function') {
                window.toggleCart();
            }
        });
    }
    
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
    const wishlistBtn = document.querySelector('.wishlist-btn');
    
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', function() {
            const productName = document.querySelector('.product-title')?.textContent || 'Product';
            const productPrice = document.querySelector('.current-price')?.textContent || '0';
            const productId = document.querySelector('[data-product-id]')?.dataset.productId || '1';
            const quantityInput = document.querySelector('.quantity-input');
            const quantity = parseInt(quantityInput?.value) || 1;
            
            console.log('Adding to cart:', { productName, productPrice, productId, quantity });
            
            // Validate quantity
            if (quantity < 1 || quantity > 99) {
                showNotification('Số lượng không hợp lệ! (1-99)', 'error');
                return;
            }
            
            // Check availability
            const availability = document.querySelector('.availability');
            if (availability && availability.classList.contains('out-of-stock')) {
                showNotification('Sản phẩm hiện đang hết hàng!', 'error');
                return;
            }
            
            // Get product info for consistent cart management
            const productInfo = {
                id: productId,
                name: productName,
                price: productPrice,
                image: getProductIcon(productName),
                quantity: quantity
            };
            
            // Add to cart using global function with proper quantity handling
            if (typeof window.addToCart === 'function') {
                // Add items one by one to properly update cart count
                for (let i = 0; i < quantity; i++) {
                    window.addToCart(productName, productPrice, productId);
                }
            } else {
                console.error('Global addToCart function not available');
                showNotification('Lỗi hệ thống! Vui lòng làm mới trang.', 'error');
                return;
            }
            
            // Visual feedback with improved animation
            const originalText = this.innerHTML;
            const originalBg = this.style.background;
            
            this.innerHTML = '<i class="fas fa-check"></i> Đã thêm vào giỏ!';
            this.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            this.style.transform = 'scale(0.95)';
            this.disabled = true;
            
            // Animation sequence
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
            
            setTimeout(() => {
                this.innerHTML = originalText;
                this.style.background = originalBg || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                this.disabled = false;
                this.style.transform = '';
            }, 2500);
            
            // Show success notification
            showNotification(`Đã thêm ${quantity}x ${productName} vào giỏ hàng!`, 'success');
            
            // Reset quantity to 1 after adding
            if (quantityInput) {
                quantityInput.value = 1;
                updateQuantityDisplay();
            }
            
            console.log(`Successfully added ${quantity}x ${productName} to cart`);
        });
    }
    
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', function() {
            const productName = document.querySelector('.product-title')?.textContent || 'Product';
            const availability = document.querySelector('.availability');
            
            // Check availability first
            if (availability && availability.classList.contains('out-of-stock')) {
                showNotification('Sản phẩm hiện đang hết hàng!', 'error');
                return;
            }
            
            // Disable button during process
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
            this.disabled = true;
            
            // First add to cart if not already added
            const addToCartBtn = document.querySelector('.add-to-cart-btn');
            if (addToCartBtn && !addToCartBtn.disabled) {
                addToCartBtn.click();
            }
            
            // Then open cart and proceed to checkout
            setTimeout(() => {
                if (typeof window.toggleCart === 'function') {
                    window.toggleCart();
                    
                    // Show loading state
                    showNotification('Đang chuẩn bị thanh toán...', 'info');
                    
                    // Proceed to checkout after cart is opened
                    setTimeout(() => {
                        if (typeof window.proceedToCheckout === 'function') {
                            window.proceedToCheckout();
                        } else {
                            console.warn('proceedToCheckout function not available');
                            showNotification('Vui lòng nhấn "Thanh toán" trong giỏ hàng!', 'info');
                        }
                    }, 800);
                } else {
                    console.error('toggleCart function not available');
                    showNotification('Lỗi hệ thống! Vui lòng thử lại.', 'error');
                }
                
                // Restore button
                this.innerHTML = originalText;
                this.disabled = false;
            }, 1000);
            
            console.log('Buy now initiated for:', productName);
        });
    }
    
    if (wishlistBtn) {
        let isWishlisted = localStorage.getItem(`wishlist_${document.querySelector('[data-product-id]')?.dataset.productId}`) === 'true';
        
        // Set initial state
        updateWishlistButton(isWishlisted);
        
        wishlistBtn.addEventListener('click', function() {
            const productId = document.querySelector('[data-product-id]')?.dataset.productId;
            const productName = document.querySelector('.product-title')?.textContent || 'Product';
            
            isWishlisted = !isWishlisted;
            
            // Save to localStorage
            if (productId) {
                localStorage.setItem(`wishlist_${productId}`, isWishlisted.toString());
            }
            
            updateWishlistButton(isWishlisted);
            
            // Add animation effect
            this.style.transform = 'scale(0.8)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 200);
            
            if (isWishlisted) {
                showNotification(`Đã thêm "${productName}" vào danh sách yêu thích!`, 'success');
                
                // Add heart float animation
                createHeartAnimation(this);
            } else {
                showNotification(`Đã xóa "${productName}" khỏi danh sách yêu thích!`, 'info');
            }
            
            console.log('Wishlist toggled:', isWishlisted, 'for product:', productName);
        });
        
        function updateWishlistButton(wishlisted) {
            if (wishlisted) {
                wishlistBtn.innerHTML = '<i class="fas fa-heart"></i>';
                wishlistBtn.style.borderColor = '#ef4444';
                wishlistBtn.style.color = '#ef4444';
                wishlistBtn.style.background = 'rgba(239, 68, 68, 0.1)';
                wishlistBtn.title = 'Xóa khỏi danh sách yêu thích';
            } else {
                wishlistBtn.innerHTML = '<i class="far fa-heart"></i>';
                wishlistBtn.style.borderColor = '#e5e7eb';
                wishlistBtn.style.color = '#666';
                wishlistBtn.style.background = 'rgba(255, 255, 255, 0.9)';
                wishlistBtn.title = 'Thêm vào danh sách yêu thích';
            }
        }
        
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
            
            // Add heart float animation CSS
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

function performProductSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchSuggestions = document.getElementById('searchSuggestions');
    
    if (!searchInput || !searchSuggestions) return;
    
    const query = searchInput.value.toLowerCase().trim();
    
    if (!query) {
        showDefaultSearchSuggestions();
        return;
    }
    
    // Sample product data for search (in a real app, this would come from an API)
    const searchProducts = [
        { id: 1, name: "ASUS ROG Strix G15 Gaming Laptop", price: "35.990.000", category: "Laptop", brand: "ASUS" },
        { id: 2, name: "MSI Katana 17 B13V", price: "28.990.000", category: "Laptop", brand: "MSI" },
        { id: 3, name: "Acer Predator Helios 300", price: "32.990.000", category: "Laptop", brand: "Acer" },
        { id: 4, name: "Intel Core i9-14900K", price: "15.990.000", category: "CPU", brand: "Intel" },
        { id: 5, name: "AMD Ryzen 9 7950X", price: "18.990.000", category: "CPU", brand: "AMD" },
        { id: 6, name: "ASUS ROG Strix RTX 4080", price: "29.990.000", category: "VGA", brand: "ASUS" },
        { id: 7, name: "MSI RTX 4070 Ti SUPER", price: "22.990.000", category: "VGA", brand: "MSI" },
        { id: 8, name: "Samsung 980 PRO 2TB NVMe", price: "6.490.000", category: "Storage", brand: "Samsung" },
        { id: 9, name: "Corsair Dominator 32GB DDR5", price: "8.990.000", category: "RAM", brand: "Corsair" },
        { id: 10, name: "ASUS TUF VG27AQ 27\" 144Hz", price: "7.990.000", category: "Monitor", brand: "ASUS" }
    ];
    
    // Filter products based on search query
    const filteredProducts = searchProducts.filter(product => 
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.brand.toLowerCase().includes(query)
    );
    
    displaySearchResults(filteredProducts, query);
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
    
    let resultsHTML = displayedProducts.map(product => `
        <div class="suggestion-item" onclick="navigateToProduct(${product.id})">
            <i class="fas fa-${getProductSearchIcon(product.category)}"></i>
            <div class="suggestion-text">
                <h4>${highlightSearchTerm(product.name, query)}</h4>
                <p>${formatPrice(parseInt(product.price.replace(/\./g, '')))} - ${product.category}</p>
            </div>
        </div>
    `).join('');
    
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
