// =====================================
// SHOPPING CART GLOBAL STATE
// =====================================
let cartItems = JSON.parse(localStorage.getItem('techHavenCart')) || [];
let cartCount = parseInt(localStorage.getItem('techHavenCartCount')) || 0;

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
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
    
    // Thêm class loading cho body và html ngay lập tức
    document.body.classList.add('loading');
    document.documentElement.classList.add('loading');
    
    // Ẩn tất cả nội dung khác ngay lập tức
    const allElements = document.querySelectorAll('body > *:not(.loading-screen)');
    allElements.forEach(element => {
        element.style.display = 'none';
        element.style.visibility = 'hidden';
    });
    
    // Đảm bảo loading screen hiển thị trên cùng
    if (loadingScreen) {
        loadingScreen.style.zIndex = '999999';
        loadingScreen.style.position = 'fixed';
        loadingScreen.style.top = '0';
        loadingScreen.style.left = '0';
        loadingScreen.style.width = '100%';
        loadingScreen.style.height = '100%';
        loadingScreen.style.display = 'flex';
    }
    
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
    
    function updateCuteProgress() {
        // Tăng progress một cách tự nhiên
        progress += Math.random() *75 + 5; 
        
        if (progress >= 100) {
            progress = 100;
            progressFill.style.width = '100%';
            progressPercentage.textContent = '100%';
            progressText.textContent = cuteMessages[5];
            
            // Animation vui nhộn khi hoàn thành
            setTimeout(() => {
                loadingScreen.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    // Hiện lại tất cả nội dung web
                    document.body.classList.remove('loading');
                    document.documentElement.classList.remove('loading');
                    
                    // Khôi phục visibility của body
                    document.body.style.visibility = 'visible';
                    
                    // Hiện lại tất cả element với display phù hợp
                    allElements.forEach(element => {
                        element.style.display = '';
                        element.style.visibility = '';
                        element.style.opacity = '';
                        
                        // Khôi phục display phù hợp cho các element khác nhau
                        if (element.tagName === 'HEADER' || element.tagName === 'SECTION' || element.tagName === 'FOOTER') {
                            element.style.display = 'block';
                        }
                    });
                    
                    // Ẩn loading screen
                    loadingScreen.classList.add('hidden');
                    document.body.style.overflow = 'auto';
                    document.documentElement.style.overflow = 'auto';
                    
                    // Dọn dẹp DOM
                    setTimeout(() => {
                        if (loadingScreen && loadingScreen.parentNode) {
                            loadingScreen.parentNode.removeChild(loadingScreen);
                        }
                    }, 800);
                }, 300);
            }, 500);
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
            
            // Cute bounce effect khi đổi message
            progressText.style.transform = 'scale(1.1)';
            setTimeout(() => {
                progressText.style.transform = 'scale(1)';
            }, 200);
        }
        
        // Tiếp tục với timing ngẫu nhiên
        setTimeout(updateCuteProgress, Math.random() * 500 + 400);
    }
    
    // Bắt đầu loading với delay để tạo cảm giác tự nhiên
    setTimeout(() => {
        updateCuteProgress();
    }, 800);
    
    // Safety fallback - force hide sau 8 giây
    setTimeout(() => {
        if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
            // Hiện lại tất cả nội dung web
            document.body.classList.remove('loading');
            document.documentElement.classList.remove('loading');
            document.body.style.visibility = 'visible';
            
            allElements.forEach(element => {
                element.style.display = '';
                element.style.visibility = '';
                element.style.opacity = '';
                
                if (element.tagName === 'HEADER' || element.tagName === 'SECTION' || element.tagName === 'FOOTER') {
                    element.style.display = 'block';
                }
            });
            
            loadingScreen.classList.add('hidden');
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
            
            setTimeout(() => {
                if (loadingScreen && loadingScreen.parentNode) {
                    loadingScreen.parentNode.removeChild(loadingScreen);
                }
            }, 800);
        }
    }, 8000);

    // Mobile Menu Toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (mobileMenuToggle && navMenu) {
        mobileMenuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            
            // Change hamburger icon
            const icon = this.querySelector('i');
            if (navMenu.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });

        // Close menu when clicking on menu items
        const menuItems = navMenu.querySelectorAll('a');
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                navMenu.classList.remove('active');
                const icon = mobileMenuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            });
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
            }
        });
    }

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

    // Add to cart functionality
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

    // Search functionality (placeholder)
    const searchIcon = document.querySelector('.fa-search');
    if (searchIcon) {
        searchIcon.addEventListener('click', function() {
            alert('Search functionality coming soon!');
        });
    }

    // Cart functionality (placeholder)
    const cartIcon = document.querySelector('.fa-shopping-cart');
    if (cartIcon) {
        cartIcon.addEventListener('click', function() {
            alert('Cart functionality coming soon!');
        });
    }

    // User account functionality (placeholder)
    const userIcon = document.querySelector('.fa-user');
    if (userIcon) {
        userIcon.addEventListener('click', function() {
            alert('User account functionality coming soon!');
        });
    }

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
    // SHOPPING CART FUNCTIONALITY
    // =====================================

    // Add to cart function
    function addToCart(productName, productPrice, productId = null) {
        // Clean price string to get numeric value
        const cleanPrice = productPrice.replace(/[^\d]/g, '');
        const numericPrice = parseInt(cleanPrice);
        
        // Use product name as ID if no productId provided (for index page)
        // Ensure ID is always a string for consistency
        const itemId = productId ? String(productId) : productName;
        
        console.log('Adding to cart - Product ID:', itemId, 'Name:', productName);
        
        const existingItem = cartItems.find(item => String(item.id) === String(itemId));
        
        if (existingItem) {
            existingItem.quantity += 1;
            console.log('Updated existing item quantity to:', existingItem.quantity);
        } else {
            const newItem = {
                id: itemId,
                name: productName,
                price: productPrice,
                numericPrice: numericPrice,
                quantity: 1,
                image: getProductIcon(productName)
            };
            cartItems.push(newItem);
            console.log('Added new item:', newItem);
        }
        
        cartCount++;
        updateCartUI();
        saveCartToStorage();
        showCartNotification(productName);
    }

    // Remove from cart
    function removeFromCart(productId) {
        // Ensure productId is string for consistency
        const stringId = String(productId);
        console.log('Attempting to remove product with ID:', stringId);
        console.log('Current cart items:', cartItems.map(item => ({id: item.id, name: item.name})));
        
        const itemIndex = cartItems.findIndex(item => String(item.id) === stringId);
        console.log('Found item at index:', itemIndex);
        
        if (itemIndex > -1) {
            const item = cartItems[itemIndex];
            console.log('Removing item:', item);
            cartCount -= item.quantity;
            cartItems.splice(itemIndex, 1);
            updateCartUI();
            saveCartToStorage();
            console.log('Item removed successfully');
            console.log('Remaining cart items:', cartItems.length);
        } else {
            console.error('Item not found with ID:', stringId);
            console.error('Available IDs:', cartItems.map(item => String(item.id)));
        }
    }

    // Update quantity
    function updateCartQuantity(productId, newQuantity) {
        // Ensure productId is string for consistency
        const stringId = String(productId);
        console.log('Updating quantity for product ID:', stringId, 'to quantity:', newQuantity);
        
        if (newQuantity <= 0) {
            // If quantity is 0 or less, remove the item
            removeFromCart(stringId);
            return;
        }
        
        const item = cartItems.find(item => String(item.id) === stringId);
        if (item) {
            const oldQuantity = item.quantity;
            item.quantity = newQuantity;
            cartCount += (item.quantity - oldQuantity);
            updateCartUI();
            saveCartToStorage();
            console.log('Quantity updated successfully');
        } else {
            console.error('Item not found with ID:', stringId);
            console.error('Available IDs:', cartItems.map(item => String(item.id)));
        }
    }

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
        // Update cart badge
        const cartBadge = document.getElementById('cartBadge');
        const cartCountSpan = document.getElementById('cartCount');
        
        if (cartBadge) {
            cartBadge.textContent = cartCount;
            cartBadge.style.display = cartCount > 0 ? 'flex' : 'none';
        }
        
        if (cartCountSpan) {
            cartCountSpan.textContent = cartCount;
        }

        // Update cart items display
        const cartItemsContainer = document.getElementById('cartItems');
        if (cartItemsContainer) {
            if (cartItems.length === 0) {
                cartItemsContainer.innerHTML = `
                    <div class="empty-cart">
                        <i class="fas fa-shopping-cart" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                        <p>Giỏ hàng của bạn đang trống</p>
                        <small>Thêm sản phẩm để bắt đầu mua sắm</small>
                    </div>
                `;
            } else {
                cartItemsContainer.innerHTML = cartItems.map(item => `
                    <div class="cart-item" data-product-id="${item.id}">
                        <div class="cart-item-image">
                            <i class="${item.image}" style="color: ${item.imageColor || '#667eea'};"></i>
                        </div>
                        <div class="cart-item-details">
                            <div class="cart-item-name">${item.name}</div>
                            <div class="cart-item-price">${item.price}</div>
                            <div class="cart-item-controls">
                                <button class="quantity-btn decrease-qty" data-product-id="${item.id}" data-quantity="${item.quantity - 1}">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <span class="cart-item-quantity">${item.quantity}</span>
                                <button class="quantity-btn increase-qty" data-product-id="${item.id}" data-quantity="${item.quantity + 1}">
                                    <i class="fas fa-plus"></i>
                                </button>
                                <button class="remove-item" data-product-id="${item.id}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
                
                // Add event listeners for cart controls
                setupCartEventListeners();
            }
        }

        // Update cart total
        const total = calculateCartTotal();
        const cartTotalElement = document.getElementById('cartTotal');
        if (cartTotalElement) {
            cartTotalElement.textContent = formatPrice(total) + ' VNĐ';
        }

        // Update checkout button
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) {
            checkoutBtn.disabled = cartItems.length === 0;
        }
    }

    // Calculate cart total
    function calculateCartTotal() {
        return cartItems.reduce((total, item) => {
            const price = item.numericPrice || parseInt(item.price.replace(/[^\d]/g, ''));
            return total + (price * item.quantity);
        }, 0);
    }

    // Format price
    function formatPrice(price) {
        return new Intl.NumberFormat('vi-VN').format(price);
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

    // Setup cart event listeners
    function setupCartEventListeners() {
        // Remove item buttons
        const removeButtons = document.querySelectorAll('.remove-item');
        removeButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const productId = this.getAttribute('data-product-id');
                console.log('Remove button clicked for product ID:', productId);
                removeFromCart(productId);
            });
        });
        
        // Decrease quantity buttons
        const decreaseButtons = document.querySelectorAll('.decrease-qty');
        decreaseButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const productId = this.getAttribute('data-product-id');
                const newQuantity = parseInt(this.getAttribute('data-quantity'));
                console.log('Decrease quantity for product ID:', productId, 'to', newQuantity);
                updateCartQuantity(productId, newQuantity);
            });
        });
        
        // Increase quantity buttons
        const increaseButtons = document.querySelectorAll('.increase-qty');
        increaseButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const productId = this.getAttribute('data-product-id');
                const newQuantity = parseInt(this.getAttribute('data-quantity'));
                console.log('Increase quantity for product ID:', productId, 'to', newQuantity);
                updateCartQuantity(productId, newQuantity);
            });
        });
    }

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

    // Proceed to checkout
    function proceedToCheckout() {
        if (cartItems.length === 0) return;
        
        const checkoutModal = document.getElementById('checkoutModal');
        if (checkoutModal) {
            checkoutModal.classList.add('active');
            updateOrderSummary();
        }
    }

    // Close checkout modal
    function closeCheckoutModal() {
        const checkoutModal = document.getElementById('checkoutModal');
        if (checkoutModal) {
            checkoutModal.classList.remove('active');
        }
    }

    // Update order summary
    function updateOrderSummary() {
        const orderSummaryItems = document.getElementById('orderSummaryItems');
        const subtotalAmount = document.getElementById('subtotalAmount');
        const finalTotal = document.getElementById('finalTotal');
        
        if (orderSummaryItems) {
            orderSummaryItems.innerHTML = cartItems.map(item => `
                <div class="order-item">
                    <span class="order-item-name">${item.name} x${item.quantity}</span>
                    <span class="order-item-price">${formatPrice((item.numericPrice || parseInt(item.price.replace(/[^\d]/g, ''))) * item.quantity)} VNĐ</span>
                </div>
            `).join('');
        }
        
        const subtotal = calculateCartTotal();
        const shipping = subtotal > 0 ? 50000 : 0;
        const total = subtotal + shipping;
        
        if (subtotalAmount) subtotalAmount.textContent = formatPrice(subtotal) + ' VNĐ';
        if (finalTotal) finalTotal.textContent = formatPrice(total) + ' VNĐ';
        
        // Update shipping amount
        const shippingAmount = document.getElementById('shippingAmount');
        if (shippingAmount) shippingAmount.textContent = formatPrice(shipping) + ' VNĐ';
    }

    // Complete order
    function completeOrder() {
        const customerName = document.getElementById('customerName').value;
        const customerPhone = document.getElementById('customerPhone').value;
        const customerEmail = document.getElementById('customerEmail').value;
        const shippingAddress = document.getElementById('shippingAddress').value;
        const shippingCity = document.getElementById('shippingCity').value;
        const shippingDistrict = document.getElementById('shippingDistrict').value;
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
        
        // Validate form
        if (!customerName || !customerPhone || !customerEmail || !shippingAddress || !shippingCity || !shippingDistrict) {
            alert('Vui lòng điền đầy đủ thông tin!');
            return;
        }
        
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
        setTimeout(() => {
            document.body.removeChild(loadingOverlay);
            document.head.removeChild(style);
            
            // Show success message
            alert(`🎉 Đơn hàng đã được đặt thành công!\n\nMã đơn hàng: TH${Date.now()}\nTổng tiền: ${formatPrice(calculateCartTotal() + 50000)} VNĐ\n\nChúng tôi sẽ liên hệ với bạn trong vòng 24h để xác nhận đơn hàng.`);
            
        // Reset cart and close modal
        cartItems = [];
        cartCount = 0;
        updateCartUI();
        saveCartToStorage();
        closeCheckoutModal();
        toggleCart();            // Reset form
            document.getElementById('customerName').value = '';
            document.getElementById('customerPhone').value = '';
            document.getElementById('customerEmail').value = '';
            document.getElementById('shippingAddress').value = '';
            document.getElementById('shippingCity').value = '';
            document.getElementById('shippingDistrict').value = '';
        }, 2000);
    }

    // Build PC function
    function proceedToBuild() {
        alert('🔧 Tính năng xây dựng PC sẽ sớm có mặt!\n\nBạn có thể liên hệ hotline 1800-1234 để được tư vấn trực tiếp từ chuyên gia của chúng tôi.');
    }

    // Search function
    function toggleSearch() {
        const searchOverlay = document.getElementById('searchOverlay');
        const searchInput = document.getElementById('searchInput');
        
        if (searchOverlay) {
            searchOverlay.classList.toggle('active');
            if (searchOverlay.classList.contains('active') && searchInput) {
                searchInput.focus();
            }
        }
    }

    // Search functionality
    let searchProducts = [
        { id: 1, name: "RTX 4070 Graphics Card", price: "18.990.000", category: "VGA", image: "/images/gpu1.jpg" },
        { id: 2, name: "MSI Katana 17 B13V", price: "28.990.000", category: "Laptop", image: "/images/laptop.jpg" },
        { id: 3, name: "Acer Predator Helios 300", price: "32.990.000", category: "Laptop", image: "/images/laptop.jpg" },
        { id: 4, name: "HP Omen 16-k0000", price: "26.990.000", category: "Laptop", image: "/images/laptop.jpg" },
        { id: 5, name: "Gaming Desktop PC", price: "45.990.000", category: "PC", image: "/images/pc-hero.png" },
        { id: 6, name: "Mechanical Gaming Keyboard", price: "2.490.000", category: "Phụ kiện", image: "/images/keyboard.jpg" },
        { id: 7, name: "Gaming Mouse Pro", price: "1.990.000", category: "Phụ kiện", image: "/images/keyboard.jpg" },
        { id: 8, name: "RTX 4080 Graphics Card", price: "24.990.000", category: "VGA", image: "/images/gpu2.jpg" }
    ];

    function performSearch() {
        const query = document.getElementById('searchInput').value.toLowerCase().trim();
        const suggestionsContainer = document.getElementById('searchSuggestions');
        
        if (!query) {
            suggestionsContainer.innerHTML = '';
            return;
        }

        const filteredProducts = searchProducts.filter(product => 
            product.name.toLowerCase().includes(query) ||
            product.category.toLowerCase().includes(query)
        );

        displaySearchSuggestions(filteredProducts);
    }

    function displaySearchSuggestions(products) {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        
        if (products.length === 0) {
            suggestionsContainer.innerHTML = `
                <div class="suggestion-item">
                    <i class="fas fa-search"></i>
                    <div class="suggestion-text">
                        <h4>Không tìm thấy sản phẩm</h4>
                        <p>Thử từ khóa khác hoặc duyệt danh mục sản phẩm</p>
                    </div>
                </div>
            `;
            return;
        }

        const suggestionsHTML = products.map(product => `
            <div class="suggestion-item" onclick="selectProduct(${product.id})">
                <i class="fas fa-${getProductIcon(product.category)}"></i>
                <div class="suggestion-text">
                    <h4>${product.name}</h4>
                    <p>${new Intl.NumberFormat('vi-VN').format(product.price)} VNĐ - ${product.category}</p>
                </div>
            </div>
        `).join('');

        suggestionsContainer.innerHTML = suggestionsHTML;
    }

    function getProductIcon(category) {
        const icons = {
            'Laptop': 'laptop',
            'VGA': 'memory',
            'PC': 'desktop',
            'Phụ kiện': 'keyboard'
        };
        return icons[category] || 'cube';
    }

    function selectProduct(productId) {
        // Navigate to product detail page or add to cart
        window.location.href = `/product/${productId}`;
    }

    // Initialize search event listeners
    function initializeSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.querySelector('.search-btn');
        const searchOverlay = document.getElementById('searchOverlay');

        if (searchInput) {
            searchInput.addEventListener('input', performSearch);
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', performSearch);
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

    // Save cart to localStorage
    function saveCartToStorage() {
        localStorage.setItem('techHavenCart', JSON.stringify(cartItems));
        localStorage.setItem('techHavenCartCount', cartCount.toString());
    }

    // Clear cart function (for testing)
    function clearCart() {
        cartItems = [];
        cartCount = 0;
        updateCartUI();
        saveCartToStorage();
        console.log('Cart cleared');
    }

    // Load cart from localStorage
    function loadCartFromStorage() {
        const savedCart = localStorage.getItem('techHavenCart');
        const savedCount = localStorage.getItem('techHavenCartCount');
        
        if (savedCart) {
            cartItems = JSON.parse(savedCart);
        }
        
        if (savedCount) {
            cartCount = parseInt(savedCount);
        }
        
        updateCartUI();
    }

    // Function for non-index pages
    function setupNonIndexPage() {
        // Load cart from storage
        loadCartFromStorage();
        
        // Setup common functionality
        setupProductNavigation();
        
        // Make functions global
        window.addToCart = addToCart;
        window.removeFromCart = removeFromCart;
        window.updateCartQuantity = updateCartQuantity;
        window.toggleCart = toggleCart;
        window.toggleSearch = toggleSearch;
        window.proceedToCheckout = proceedToCheckout;
        window.closeCheckoutModal = closeCheckoutModal;
        window.completeOrder = completeOrder;
        window.proceedToBuild = proceedToBuild;
        window.saveCartToStorage = saveCartToStorage;
        window.selectProduct = selectProduct;
        window.performSearch = performSearch;
        window.loadCartFromStorage = loadCartFromStorage;
        
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
    }

    // Initialize all functions (only for index page)
    if (document.body.classList.contains('index-page')) {
        // Load cart from storage
        loadCartFromStorage();
        
        setupProductNavigation();
        setupCommonEventListeners();
        initializeSearch();
    } else {
        // Initialize search for other pages too
        setTimeout(initializeSearch, 100);
    }
    
    // Make functions global for all pages
    window.addToCart = addToCart;
    window.removeFromCart = removeFromCart;
    window.updateCartQuantity = updateCartQuantity;
    window.toggleCart = toggleCart;
    window.toggleSearch = toggleSearch;
    window.proceedToCheckout = proceedToCheckout;
    window.closeCheckoutModal = closeCheckoutModal;
    window.completeOrder = completeOrder;
    window.proceedToBuild = proceedToBuild;
    window.saveCartToStorage = saveCartToStorage;
    window.loadCartFromStorage = loadCartFromStorage;
    window.clearCart = clearCart;

    // Initialize mobile menu toggle for all pages
    setupCommonEventListeners();
});

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
});

// Make navigation function globally available
window.goToProductDetail = goToProductDetail;

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
    const registerPassword = document.getElementById('registerPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const agreeTerms = document.getElementById('agreeTerms');
    
    if (registerName) registerName.value = '';
    if (registerEmail) registerEmail.value = '';
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
        alert('Vui lòng nhập đầy đủ email và mật khẩu!');
        return;
    }
    
    if (!isValidEmail(email)) {
        alert('Email không hợp lệ!');
        return;
    }
    
    // Here you would normally send to your backend/Firebase
    console.log('Login attempt:', { email, password, rememberMe });
    
    // For demo purposes, show success message
    showNotification('Đang đăng nhập...', 'info');
    
    // Simulate login process
    setTimeout(() => {
        showNotification('Đăng nhập thành công!', 'success');
        closeLoginModal();
        // Update UI to show logged in state
        updateUIForLoggedInUser({ email, name: email.split('@')[0] });
    }, 1500);
}

// Handle register
function handleRegister() {
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    // Basic validation
    if (!name || !email || !password || !confirmPassword) {
        alert('Vui lòng điền đầy đủ thông tin!');
        return;
    }
    
    if (!isValidEmail(email)) {
        alert('Email không hợp lệ!');
        return;
    }
    
    if (password.length < 6) {
        alert('Mật khẩu phải có ít nhất 6 ký tự!');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('Mật khẩu xác nhận không khớp!');
        return;
    }
    
    if (!agreeTerms) {
        alert('Vui lòng đồng ý với điều khoản dịch vụ!');
        return;
    }
    
    // Here you would normally send to your backend/Firebase
    console.log('Register attempt:', { name, email, password });
    
    showNotification('Đang tạo tài khoản...', 'info');
    
    // Simulate registration process
    setTimeout(() => {
        showNotification('Đăng ký thành công!', 'success');
        closeLoginModal();
        // Update UI to show logged in state
        updateUIForLoggedInUser({ email, name });
    }, 1500);
}

// Email validation helper
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Update UI for logged in user
function updateUIForLoggedInUser(user) {
    // Update user icon to show logged in state
    const userIcons = document.querySelectorAll('.fas.fa-user');
    userIcons.forEach(icon => {
        icon.parentElement.innerHTML = `<i class="fas fa-user-circle"></i> ${user.name}`;
        icon.parentElement.style.color = '#667eea';
    });
    
    // Update mobile nav
    const mobileUserLink = document.querySelector('.mobile-nav-icons a[href="#"] i.fa-user');
    if (mobileUserLink) {
        mobileUserLink.parentElement.innerHTML = `<i class="fas fa-user-circle"></i> ${user.name}`;
    }
    
    console.log('User logged in:', user);
}

// Show notification (reuse existing function or create new one)
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 500;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
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

// Make functions globally available
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.toggleAuthMode = toggleAuthMode;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;

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

// Enhanced updateUIForLoggedInUser to handle Google profile pictures
function updateUIForLoggedInUser(user) {
    // Update user icon to show logged in state
    const userIcons = document.querySelectorAll('.fas.fa-user');
    userIcons.forEach(icon => {
        if (user.picture) {
            // Show profile picture for Google users
            icon.parentElement.innerHTML = `
                <img src="${user.picture}" alt="${user.name}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px; vertical-align: middle;">
                <span>${user.name}</span>
            `;
        } else {
            icon.parentElement.innerHTML = `<i class="fas fa-user-circle"></i> ${user.name}`;
        }
        icon.parentElement.style.color = '#667eea';
        icon.parentElement.style.cursor = 'pointer';
        icon.parentElement.style.display = 'flex';
        icon.parentElement.style.alignItems = 'center';
    });
    
    // Update mobile nav
    const mobileUserLink = document.querySelector('.mobile-nav-icons a[href="#"] i.fa-user');
    if (mobileUserLink && user.picture) {
        mobileUserLink.parentElement.innerHTML = `
            <img src="${user.picture}" alt="${user.name}" style="width: 20px; height: 20px; border-radius: 50%; margin-right: 5px;">
            ${user.name}
        `;
    } else if (mobileUserLink) {
        mobileUserLink.parentElement.innerHTML = `<i class="fas fa-user-circle"></i> ${user.name}`;
    }
    
    // Store user info in localStorage for persistence
    localStorage.setItem('techHavenUser', JSON.stringify(user));
    
    console.log('User logged in:', user);
}

// =====================================
// SERVER-SIDE AUTHENTICATION SUPPORT
// =====================================

// Hàm đăng nhập với Google (server-side)
window.handleGoogleLogin = function() {
    console.log('� Đăng nhập với Google (server-side)');
    window.location.href = '/auth/google';
};

// Hàm đăng xuất
window.handleLogout = function() {
    console.log('� Đăng xuất');
    window.location.href = '/logout';
};

// Khởi tạo đơn giản khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded - Thiết lập login modal...');
    
    // Setup user icons để mở modal
    const userIcons = document.querySelectorAll('.fas.fa-user');
    console.log('Tìm thấy', userIcons.length, 'user icons');
    
    userIcons.forEach((icon, index) => {
        icon.style.cursor = 'pointer';
        icon.addEventListener('click', function(e) {
            e.preventDefault();
            console.log(`User icon ${index + 1} được nhấn`);
            openLoginModal();
        });
    });
    
    console.log('✅ User icons đã được thiết lập');
    
    // Thiết lập login modal sau khi DOM load
    setTimeout(() => {
        setupLoginModal();
    }, 1000);
});

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
