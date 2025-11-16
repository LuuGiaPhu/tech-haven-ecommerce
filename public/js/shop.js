// =====================================
//    SHOP PAGE FUNCTIONALITY
// =====================================

// Use shared cart state from script.js (if available)
// If script.js is loaded first, these will be overwritten by the global variables

// Sample products data
const allProducts = [
    // Laptop Gaming
    {
        id: 1,
        name: "ASUS ROG Strix G15 Gaming",
        price: 35990000,
        oldPrice: 39990000,
        category: "laptop",
        brand: "asus",
        rating: 5,
        image: "fas fa-laptop",
        imageColor: "#3b82f6",
        badge: "HOT",
        isNew: false
    },
    {
        id: 2,
        name: "MSI Katana 17 B13V",
        price: 28990000,
        category: "laptop",
        brand: "msi",
        rating: 4,
        image: "fas fa-laptop",
        imageColor: "#dc2626",
        isNew: true
    },
    {
        id: 3,
        name: "Acer Predator Helios 300",
        price: 32990000,
        category: "laptop",
        brand: "acer",
        rating: 4,
        image: "fas fa-laptop",
        imageColor: "#059669",
        isNew: false
    },
    {
        id: 4,
        name: "Alienware m15 R7",
        price: 45990000,
        category: "laptop",
        brand: "dell",
        rating: 5,
        image: "fas fa-laptop",
        imageColor: "#7c3aed",
        badge: "PREMIUM",
        isNew: false
    },
    {
        id: 5,
        name: "HP Omen 16-k0000",
        price: 26990000,
        category: "laptop",
        brand: "hp",
        rating: 5,
        image: "fas fa-laptop",
        imageColor: "#0891b2",
        isNew: false
    },

    // CPU
    {
        id: 6,
        name: "Intel Core i9-14900K",
        price: 15990000,
        category: "cpu",
        brand: "intel",
        rating: 5,
        image: "fas fa-microchip",
        imageColor: "#a855f7",
        isNew: true
    },
    {
        id: 7,
        name: "AMD Ryzen 9 7950X",
        price: 18990000,
        category: "cpu",
        brand: "amd",
        rating: 5,
        image: "fas fa-microchip",
        imageColor: "#ef4444",
        badge: "BEST SELLER",
        isNew: false
    },
    {
        id: 8,
        name: "Intel Core i7-14700K",
        price: 12990000,
        category: "cpu",
        brand: "intel",
        rating: 4,
        image: "fas fa-microchip",
        imageColor: "#3b82f6",
        isNew: true
    },
    {
        id: 9,
        name: "AMD Ryzen 7 7700X",
        price: 10990000,
        category: "cpu",
        brand: "amd",
        rating: 4,
        image: "fas fa-microchip",
        imageColor: "#f59e0b",
        isNew: false
    },

    // GPU
    {
        id: 10,
        name: "ASUS ROG Strix RTX 4080",
        price: 29990000,
        oldPrice: 32990000,
        category: "gpu",
        brand: "asus",
        rating: 5,
        image: "fas fa-memory",
        imageColor: "#ec4899",
        badge: "SALE",
        isNew: false
    },
    {
        id: 11,
        name: "MSI RTX 4070 Ti SUPER",
        price: 22990000,
        category: "gpu",
        brand: "msi",
        rating: 5,
        image: "fas fa-memory",
        imageColor: "#dc2626",
        isNew: true
    },
    {
        id: 12,
        name: "GIGABYTE RTX 4060 Ti",
        price: 16990000,
        category: "gpu",
        brand: "gigabyte",
        rating: 4,
        image: "fas fa-memory",
        imageColor: "#059669",
        isNew: false
    },
    {
        id: 13,
        name: "EVGA RTX 4090 FTW3",
        price: 39990000,
        category: "gpu",
        brand: "evga",
        rating: 5,
        image: "fas fa-memory",
        imageColor: "#8b5cf6",
        badge: "FLAGSHIP",
        isNew: false
    },

    // RAM
    {
        id: 14,
        name: "Corsair Dominator 32GB DDR5",
        price: 8990000,
        category: "ram",
        brand: "corsair",
        rating: 5,
        image: "fas fa-memory",
        imageColor: "#f59e0b",
        isNew: false
    },
    {
        id: 15,
        name: "G.Skill Trident Z5 32GB",
        price: 7490000,
        category: "ram",
        brand: "gskill",
        rating: 4,
        image: "fas fa-memory",
        imageColor: "#3b82f6",
        isNew: true
    },
    {
        id: 16,
        name: "Kingston Fury Beast 16GB",
        price: 3990000,
        category: "ram",
        brand: "kingston",
        rating: 4,
        image: "fas fa-memory",
        imageColor: "#ef4444",
        isNew: false
    },

    // Storage
    {
        id: 17,
        name: "Samsung 980 PRO 2TB NVMe",
        price: 6490000,
        category: "storage",
        brand: "samsung",
        rating: 4,
        image: "fas fa-hdd",
        imageColor: "#10b981",
        isNew: false
    },
    {
        id: 18,
        name: "WD Black SN850X 1TB NVMe",
        price: 3990000,
        category: "storage",
        brand: "wd",
        rating: 5,
        image: "fas fa-hdd",
        imageColor: "#3b82f6",
        isNew: false
    },
    {
        id: 19,
        name: "Seagate FireCuda 530 2TB",
        price: 7490000,
        category: "storage",
        brand: "seagate",
        rating: 4,
        image: "fas fa-save",
        imageColor: "#dc2626",
        isNew: true
    },
    {
        id: 20,
        name: "Crucial MX4 4TB SSD",
        price: 12990000,
        category: "storage",
        brand: "crucial",
        rating: 5,
        image: "fas fa-database",
        imageColor: "#059669",
        isNew: false
    },

    // Monitors
    {
        id: 21,
        name: "ASUS TUF VG27AQ 27\" 144Hz",
        price: 7990000,
        category: "monitor",
        brand: "asus",
        rating: 5,
        image: "fas fa-desktop",
        imageColor: "#f59e0b",
        isNew: false
    },
    {
        id: 22,
        name: "MSI Optix G32CQ4 32\" Curved",
        price: 9990000,
        category: "monitor",
        brand: "msi",
        rating: 4,
        image: "fas fa-desktop",
        imageColor: "#ef4444",
        isNew: false
    },
    {
        id: 23,
        name: "LG UltraGear 34GP83A-B",
        price: 18990000,
        category: "monitor",
        brand: "lg",
        rating: 5,
        image: "fas fa-desktop",
        imageColor: "#8b5cf6",
        badge: "ULTRAWIDE",
        isNew: true
    },
    {
        id: 24,
        name: "Acer Predator X34 GS",
        price: 22990000,
        category: "monitor",
        brand: "acer",
        rating: 4,
        image: "fas fa-desktop",
        imageColor: "#059669",
        isNew: false
    },

    // Peripherals
    {
        id: 25,
        name: "Razer Huntsman V3 Pro",
        price: 4990000,
        category: "peripheral",
        brand: "razer",
        rating: 5,
        image: "fas fa-keyboard",
        imageColor: "#8b5cf6",
        badge: "GAMING",
        isNew: false
    },
    {
        id: 26,
        name: "Logitech G Pro X Superlight",
        price: 3290000,
        category: "peripheral",
        brand: "logitech",
        rating: 4,
        image: "fas fa-mouse",
        imageColor: "#ef4444",
        isNew: false
    },
    {
        id: 27,
        name: "SteelSeries Arctis 7P+",
        price: 4590000,
        category: "peripheral",
        brand: "steelseries",
        rating: 5,
        image: "fas fa-headset",
        imageColor: "#f59e0b",
        isNew: false
    },
    {
        id: 28,
        name: "Corsair K95 RGB Platinum XT",
        price: 5490000,
        category: "peripheral",
        brand: "corsair",
        rating: 5,
        image: "fas fa-keyboard",
        imageColor: "#3b82f6",
        isNew: true
    }
];

// State management
let filteredProducts = [...allProducts];
let currentPage = 1;
const productsPerPage = 12;
let currentView = 'grid';

// DOM Elements (will be initialized in DOMContentLoaded)
let productsGrid;
let resultCount;
let loadMoreBtn;
let noResults;
let sortSelect;
let searchInput;
let searchOverlay;
let searchSuggestions;

// Initialize the shop page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Shop page DOMContentLoaded');
    
    // Initialize DOM elements
    productsGrid = document.getElementById('productsGrid');
    resultCount = document.getElementById('resultCount');
    loadMoreBtn = document.getElementById('loadMoreBtn');
    noResults = document.getElementById('noResults');
    sortSelect = document.getElementById('sortSelect');
    searchInput = document.getElementById('searchInput');
    searchOverlay = document.getElementById('searchOverlay');
    searchSuggestions = document.getElementById('searchSuggestions');
    
    // Log for debugging
    console.log('Shop DOM elements initialized:', {
        productsGrid: !!productsGrid,
        resultCount: !!resultCount,
        loadMoreBtn: !!loadMoreBtn,
        noResults: !!noResults
    });
    
    // Initialize mobile menu first (critical for navigation)
    initializeMobileMenu();
    
    // Initialize admin dropdown
    setTimeout(initializeShopAdminDropdown, 300);
    
    initializeShop();
    setupEventListeners();
    renderProducts();
    initializeCartFunctionality();
});

function initializeMobileMenu() {
    console.log('Initializing mobile menu...');
    
    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    console.log('Mobile menu elements found:', { 
        toggle: !!mobileMenuToggle, 
        menu: !!navMenu,
        toggleElement: mobileMenuToggle,
        menuElement: navMenu
    });
    
    if (mobileMenuToggle && navMenu) {
        // Remove any existing event listeners
        const newToggle = mobileMenuToggle.cloneNode(true);
        mobileMenuToggle.parentNode.replaceChild(newToggle, mobileMenuToggle);
        
        newToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Mobile menu toggle clicked, current active state:', navMenu.classList.contains('active'));
            
            // Toggle the menu
            navMenu.classList.toggle('active');
            
            // Toggle hamburger animation
            const icon = newToggle.querySelector('i');
            if (icon) {
                if (navMenu.classList.contains('active')) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-times');
                    document.body.style.overflow = 'hidden';
                    console.log('Menu opened');
                } else {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                    document.body.style.overflow = '';
                    console.log('Menu closed');
                }
            }
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (navMenu.classList.contains('active') && 
                !navMenu.contains(e.target) && 
                !newToggle.contains(e.target)) {
                navMenu.classList.remove('active');
                const icon = newToggle.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
                document.body.style.overflow = '';
                console.log('Menu closed by clicking outside');
            }
        });
        
        // Close menu when clicking on a link
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                const icon = newToggle.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
                document.body.style.overflow = '';
                console.log('Menu closed by clicking link');
            });
        });
        
        // Close menu when window is resized to desktop
        window.addEventListener('resize', function() {
            if (window.innerWidth > 1024) {
                navMenu.classList.remove('active');
                const icon = newToggle.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
                document.body.style.overflow = '';
                console.log('Menu closed by window resize');
            }
        });
        
        console.log('Mobile menu setup completed successfully');
    } else {
        console.error('Mobile menu elements not found!', {
            toggle: !!mobileMenuToggle,
            menu: !!navMenu,
            toggleSelector: '.mobile-menu-toggle',
            menuSelector: '.nav-menu'
        });
    }
}

function initializeShop() {
    console.log('Initializing shop...');
    
    // Reset pagination
    currentPage = 1;
    
    // Set default filters
    const categoryAll = document.getElementById('categoryAll');
    if (categoryAll) {
        categoryAll.checked = true;
    }
    
    // Apply initial filters
    applyFilters();
    
    console.log('Shop initialized, currentPage:', currentPage, 'filteredProducts:', filteredProducts.length);
}

function setupEventListeners() {
    // Filter listeners
    document.querySelectorAll('.category-filter').forEach(checkbox => {
        checkbox.addEventListener('change', applyFilters);
    });
    
    document.getElementById('categoryAll').addEventListener('change', function() {
        if (this.checked) {
            document.querySelectorAll('.category-filter').forEach(cb => cb.checked = false);
        }
        applyFilters();
    });
    
    document.querySelectorAll('.brand-filter').forEach(checkbox => {
        checkbox.addEventListener('change', applyFilters);
    });
    
    document.querySelectorAll('input[name="rating"]').forEach(radio => {
        radio.addEventListener('change', applyFilters);
    });
    
    // Price range listeners
    document.getElementById('minPrice').addEventListener('input', debounce(applyFilters, 500));
    document.getElementById('maxPrice').addEventListener('input', debounce(applyFilters, 500));
    
    // Price tag listeners
    document.querySelectorAll('.price-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            const minPrice = this.dataset.min;
            const maxPrice = this.dataset.max;
            
            document.getElementById('minPrice').value = minPrice === '0' ? '' : minPrice;
            document.getElementById('maxPrice').value = maxPrice === '999999999' ? '' : maxPrice;
            
            document.querySelectorAll('.price-tag').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            applyFilters();
        });
    });
    
    // Sort listener
    sortSelect.addEventListener('change', applySorting);
    
    // View toggle listeners
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.dataset.view;
            toggleView(view);
        });
    });
    
    // Search listeners
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    searchInput.addEventListener('focus', showSearchSuggestions);
    
    // Search suggestions
    document.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', function() {
            const category = this.dataset.category;
            selectCategoryFilter(category);
            toggleSearch();
        });
    });
    
    // Click outside to close search
    searchOverlay.addEventListener('click', function(e) {
        if (e.target === searchOverlay) {
            toggleSearch();
        }
    });
}

function applyFilters() {
    filteredProducts = allProducts.filter(product => {
        // Category filter
        const categoryFilters = Array.from(document.querySelectorAll('.category-filter:checked')).map(cb => cb.value);
        const showAll = document.getElementById('categoryAll').checked;
        
        if (!showAll && categoryFilters.length > 0) {
            if (!categoryFilters.includes(product.category)) return false;
        }
        
        // Brand filter
        const brandFilters = Array.from(document.querySelectorAll('.brand-filter:checked')).map(cb => cb.value);
        if (brandFilters.length > 0 && !brandFilters.includes(product.brand)) return false;
        
        // Price filter
        const minPrice = parseInt(document.getElementById('minPrice').value) || 0;
        const maxPrice = parseInt(document.getElementById('maxPrice').value) || Infinity;
        if (product.price < minPrice || product.price > maxPrice) return false;
        
        // Rating filter
        const selectedRating = document.querySelector('input[name="rating"]:checked');
        if (selectedRating) {
            const ratingValue = parseInt(selectedRating.value);
            if (product.rating < ratingValue) return false;
        }
        
        // Search filter
        const searchTerm = searchInput.value.toLowerCase().trim();
        if (searchTerm) {
            const searchableText = `${product.name} ${product.brand} ${product.category}`.toLowerCase();
            if (!searchableText.includes(searchTerm)) return false;
        }
        
        return true;
    });
    
    currentPage = 1;
    applySorting();
}

function applySorting() {
    const sortValue = sortSelect.value;
    
    switch (sortValue) {
        case 'name-asc':
            filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'price-asc':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'price-desc':
            filteredProducts.sort((a, b) => b.price - a.price);
            break;
        case 'rating-desc':
            filteredProducts.sort((a, b) => b.rating - a.rating);
            break;
        case 'newest':
            filteredProducts.sort((a, b) => b.isNew - a.isNew);
            break;
        default:
            // Keep original order
            break;
    }
    
    renderProducts();
}

function renderProducts() {
    console.log('renderProducts called');
    console.log('filteredProducts length:', filteredProducts.length);
    console.log('currentPage:', currentPage);
    console.log('productsPerPage:', productsPerPage);
    console.log('productsGrid element:', productsGrid);
    
    if (!productsGrid) {
        console.error('productsGrid element not found!');
        return;
    }
    
    // Show products from start to currentPage * productsPerPage
    const endIndex = currentPage * productsPerPage;
    const productsToShow = filteredProducts.slice(0, endIndex);
    
    console.log('endIndex:', endIndex);
    console.log('productsToShow length:', productsToShow.length);
    
    if (productsToShow.length === 0) {
        productsGrid.innerHTML = '';
        if (noResults) noResults.style.display = 'block';
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        if (resultCount) resultCount.textContent = 'Không tìm thấy sản phẩm';
        return;
    }
    
    if (noResults) noResults.style.display = 'none';
    
    const productsHTML = productsToShow.map(product => createProductCard(product)).join('');
    console.log('Generated HTML length:', productsHTML.length);
    console.log('Sample products:', productsToShow.slice(0, 3).map(p => p.name));
    
    productsGrid.innerHTML = productsHTML;
    
    // Update result count
    if (resultCount) {
        resultCount.textContent = `Hiển thị ${productsToShow.length} / ${filteredProducts.length} sản phẩm`;
    }
    
    // Update load more button
    if (loadMoreBtn) {
        if (endIndex >= filteredProducts.length) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'block';
        }
    }
    
    console.log('renderProducts completed, HTML set to grid');
}

function createProductCard(product) {
    const oldPriceHtml = product.oldPrice ? `<span class="product-old-price">${formatPrice(product.oldPrice)}</span>` : '';
    const badgeHtml = product.badge ? `<div class="product-badge">${product.badge}</div>` : '';
    const starsHtml = generateStars(product.rating);
    
    if (currentView === 'list') {
        return `
            <div class="product-card" data-product-id="${product.id}">
                <div class="product-image" onclick="goToProductDetail(${product.id})">
                    <i class="${product.image}" style="color: ${product.imageColor};"></i>
                    ${badgeHtml}
                </div>
                <div class="product-info">
                    <div class="product-details" onclick="goToProductDetail(${product.id})">
                        <div class="product-rating">${starsHtml}</div>
                        <h4>${product.name}</h4>
                        <div class="product-price">
                            <span>${formatPrice(product.price)}</span>
                            ${oldPriceHtml}
                        </div>
                    </div>
                    <div class="product-price-actions">
                        <button class="add-to-cart" onclick="event.stopPropagation(); addToCart('${product.name}', '${formatPrice(product.price)}', '${product.id}')">
                            <i class="fas fa-cart-plus"></i> THÊM VÀO GIỎ
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="product-card" data-product-id="${product.id}" onclick="goToProductDetail(${product.id})">
            <div class="product-image">
                <i class="${product.image}" style="color: ${product.imageColor};"></i>
                ${badgeHtml}
            </div>
            <div class="product-info">
                <div class="product-rating">${starsHtml}</div>
                <h4>${product.name}</h4>
                <div class="product-price">
                    <span>${formatPrice(product.price)}</span>
                    ${oldPriceHtml}
                </div>
                <button class="add-to-cart" onclick="event.stopPropagation(); addToCart('${product.name}', '${formatPrice(product.price)}', '${product.id}')">
                    <i class="fas fa-cart-plus"></i> THÊM VÀO GIỎ
                </button>
            </div>
        </div>
    `;
}

function generateStars(rating) {
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            starsHtml += '<i class="fas fa-star"></i>';
        } else {
            starsHtml += '<i class="far fa-star"></i>';
        }
    }
    return starsHtml;
}

function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
}

function toggleView(view) {
    currentView = view;
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    
    productsGrid.className = view === 'list' ? 'products-grid list-view' : 'products-grid';
    renderProducts();
}

function loadMoreProducts() {
    currentPage++;
    renderProducts();
}

function clearAllFilters() {
    // Reset category filters
    document.getElementById('categoryAll').checked = true;
    document.querySelectorAll('.category-filter').forEach(cb => cb.checked = false);
    
    // Reset brand filters
    document.querySelectorAll('.brand-filter').forEach(cb => cb.checked = false);
    
    // Reset rating filters
    document.querySelectorAll('input[name="rating"]').forEach(radio => radio.checked = false);
    
    // Reset price filters
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.querySelectorAll('.price-tag').forEach(tag => tag.classList.remove('active'));
    
    // Reset search
    searchInput.value = '';
    
    // Reset sort
    sortSelect.value = 'default';
    
    // Apply filters
    applyFilters();
}

function selectCategoryFilter(category) {
    document.getElementById('categoryAll').checked = false;
    document.querySelectorAll('.category-filter').forEach(cb => {
        cb.checked = cb.value === category;
    });
    applyFilters();
}

function handleSearch() {
    applyFilters();
    if (searchInput.value.trim()) {
        hideSearchSuggestions();
    } else {
        showSearchSuggestions();
    }
}

function showSearchSuggestions() {
    if (searchInput.value.trim() === '') {
        searchSuggestions.classList.add('show');
    }
}

function hideSearchSuggestions() {
    searchSuggestions.classList.remove('show');
}

function toggleSearch() {
    searchOverlay.classList.toggle('active');
    if (searchOverlay.classList.contains('active')) {
        searchInput.focus();
        showSearchSuggestions();
    } else {
        hideSearchSuggestions();
    }
}

function toggleFilters() {
    const sidebar = document.getElementById('filterSidebar');
    sidebar.classList.toggle('active');
    
    if (sidebar.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

// Close filter sidebar when clicking outside (mobile)
document.addEventListener('click', function(e) {
    const sidebar = document.getElementById('filterSidebar');
    const filterToggle = document.querySelector('.filter-toggle');
    
    if (window.innerWidth <= 1024 && sidebar.classList.contains('active')) {
        if (!sidebar.contains(e.target) && !filterToggle.contains(e.target)) {
            toggleFilters();
        }
    }
});

// Debounce function for search and price inputs
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

// Keyboard navigation for search
searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        toggleSearch();
    }
});

// Global function for adding products to cart (if not defined in main script.js)
if (typeof addToCart === 'undefined') {
    window.addToCart = function(productName, price, productId) {
        // Basic add to cart functionality
        console.log(`Added ${productName} (${price}) to cart`);
        
        // You can implement your cart logic here
        // This is a placeholder implementation
        alert(`Đã thêm "${productName}" vào giỏ hàng!`);
    };
}

// =====================================
// SHOPPING CART FUNCTIONALITY
// =====================================

// Initialize cart functionality
function initializeCartFunctionality() {
    // Load cart from localStorage if not already loaded by script.js
    if (typeof window.loadCartFromStorage === 'function') {
        window.loadCartFromStorage();
    }
    
    // Don't override global cart functions if they already exist from script.js
    if (!window.addToCart) {
        // Only define these functions if they don't exist (fallback)
        window.addToCart = addToCartLocal;
        window.removeFromCart = removeFromCartLocal;
        window.updateCartQuantity = updateCartQuantityLocal;
        window.toggleCart = toggleCartLocal;
        window.proceedToCheckout = proceedToCheckoutLocal;
        window.closeCheckoutModal = closeCheckoutModalLocal;
        window.completeOrder = completeOrderLocal;
    }
    
    // Setup cart event listeners
    setupCartEventListeners();
}

// Local fallback functions (only used if script.js functions not available)
function addToCartLocal(productName, productPrice, productId) {
    // This is a fallback - should not be called if script.js is loaded
    console.log('Using fallback addToCart');
    alert(`Đã thêm "${productName}" vào giỏ hàng!`);
}

// Setup cart event listeners
function setupCartEventListeners() {
    console.log('Setting up cart event listeners...');
    
    // Close cart when clicking overlay
    document.addEventListener('click', function(e) {
        if (e.target.id === 'cartOverlay') {
            if (typeof window.toggleCart === 'function') {
                window.toggleCart();
            }
        }
    });

    // Close modal when clicking overlay
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            if (typeof window.closeCheckoutModal === 'function') {
                window.closeCheckoutModal();
            }
        }
    });
    
    // Cart icon click handlers
    const cartIconWrapper = document.querySelector('.cart-icon-wrapper');
    if (cartIconWrapper) {
        // Remove any existing onclick to prevent conflicts
        cartIconWrapper.removeAttribute('onclick');
        cartIconWrapper.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Cart icon wrapper clicked');
            if (typeof window.toggleCart === 'function') {
                window.toggleCart();
            } else {
                console.error('toggleCart function not available');
            }
        });
        console.log('Cart icon wrapper listener added');
    } else {
        console.warn('Cart icon wrapper not found');
    }
    
    // Mobile cart link
    const mobileCartLinks = document.querySelectorAll('a[onclick*="toggleCart"]');
    mobileCartLinks.forEach(link => {
        link.removeAttribute('onclick');
        link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Mobile cart link clicked');
            if (typeof window.toggleCart === 'function') {
                window.toggleCart();
            }
        });
    });
    
    // Search icon click
    const searchIcon = document.querySelector('.fas.fa-search[onclick*="toggleSearch"]');
    if (searchIcon) {
        searchIcon.removeAttribute('onclick');
        searchIcon.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof toggleSearch === 'function') {
                toggleSearch();
            }
        });
    }
}

// Export functions for use in other scripts
window.shopFunctions = {
    toggleSearch,
    toggleFilters,
    clearAllFilters,
    selectCategoryFilter,
    loadMoreProducts
};

// Make functions globally available for HTML onclick and other scripts
window.loadMoreProducts = loadMoreProducts;
window.toggleSearch = toggleSearch;
window.toggleFilters = toggleFilters;

// Ensure critical cart functions are available
if (typeof window.toggleCart !== 'function') {
    console.warn('toggleCart not available from script.js, creating fallback');
    window.toggleCart = function() {
        console.log('Fallback toggleCart called');
        alert('Cart functionality not fully loaded. Please refresh the page.');
    };
}

// Navigate to product detail page
function goToProductDetail(productId) {
    console.log('Navigating to product detail:', productId);
    window.location.href = `/product/${productId}`;
}

// Admin Dropdown Functionality for Shop
function initializeShopAdminDropdown() {
    console.log('Initializing shop admin dropdown...');
    
    // Wait for DOM to be fully ready
    const adminDropdown = document.querySelector('.admin-dropdown');
    if (!adminDropdown) {
        console.log('Admin dropdown not found, retrying in 200ms...');
        setTimeout(initializeShopAdminDropdown, 200);
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
    
    console.log('Shop admin dropdown initialized successfully');
}

// Make navigation function globally available
window.goToProductDetail = goToProductDetail;