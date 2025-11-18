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
let realProducts = []; // Store real products from server-side rendering
let currentPage = 1;
const productsPerPage = 12;
let totalProducts = 0; // Track total number of products
let currentView = 'grid';

// DOM Elements (will be initialized in DOMContentLoaded)
let productsGrid;
let resultCount;
let loadMoreBtn;
let noResults;
let sortSelect;

// Initialize the shop page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Shop page DOMContentLoaded');
    
    // Wait for script.js to fully initialize
    setTimeout(() => {
        initializeShopPage();
    }, 200);
});

function initializeShopPage() {
    console.log('Initializing shop page with delay for script.js...');
    
    // Initialize DOM elements
    productsGrid = document.getElementById('productsGrid');
    resultCount = document.getElementById('resultCount');
    loadMoreBtn = document.getElementById('loadMoreBtn');
    noResults = document.getElementById('noResults');
    sortSelect = document.getElementById('sortSelect');
    
    // Log for debugging
    console.log('Shop DOM elements initialized:', {
        productsGrid: !!productsGrid,
        resultCount: !!resultCount,
        loadMoreBtn: !!loadMoreBtn,
        noResults: !!noResults
    });

    // Extract real products from server-side rendered DOM
    // Delay to ensure server-side products are loaded
    setTimeout(() => {
        extractRealProductsFromDOM();
    }, 500);
    
    // Initialize mobile menu first (critical for navigation)
    initializeMobileMenu();
    
    // Initialize admin dropdown
    setTimeout(initializeShopAdminDropdown, 300);
    
    initializeShop();
    setupEventListeners();
    renderProducts();
    initializeCartFunctionality();
}

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
    // Initialize wasChecked attribute for rating radios
    document.querySelectorAll('input[name="rating"]').forEach(radio => {
        if (!radio.dataset.wasChecked) {
            radio.dataset.wasChecked = 'false';
        }
    });
    
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
        radio.addEventListener('click', function(e) {
            // Get the current checked state from DOM (before browser processes the click)
            // Check wasChecked first as it's more reliable
            const isCurrentlyChecked = this.dataset.wasChecked === 'true';
            
            console.log('⭐ Rating clicked:', this.value, 'isCurrentlyChecked:', isCurrentlyChecked, 'DOM checked:', this.checked, 'wasChecked:', this.dataset.wasChecked);
            
            if (isCurrentlyChecked) {
                // This radio is already checked, so uncheck it
                e.preventDefault(); // MUST be first to prevent browser from re-checking
                setTimeout(() => {
                    // Use setTimeout to ensure DOM updates after preventDefault
                    this.checked = false;
                    this.dataset.wasChecked = 'false';
                    console.log('⭐ Rating UNCHECKED:', this.value);
                    // Apply filters after unchecking
                    applyFilters();
                }, 0);
            } else {
                // This radio is not checked yet, let browser check it
                // Update all radios' wasChecked state
                document.querySelectorAll('input[name="rating"]').forEach(r => {
                    r.dataset.wasChecked = 'false';
                });
                this.dataset.wasChecked = 'true';
                console.log('⭐ Rating CHECKED:', this.value);
                // Apply filters after checking
                applyFilters();
            }
        });
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
    
    // View toggle listeners - enhanced with logging and persistence
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const view = this.dataset.view;
            console.log(`🔄 Switching to ${view} view`);
            toggleView(view);
            
            // Save user preference
            localStorage.setItem('productViewMode', view);
        });
    });
    
    // Load saved view preference on page load
    const savedView = localStorage.getItem('productViewMode') || 'grid';
    setTimeout(() => {
        if (savedView === 'list') {
            console.log('📱 Loading saved list view preference');
            toggleView('list');
        }
    }, 200);
    
    // Note: Search event listeners are handled by script.js
    // We don't add search listeners here to avoid conflicts
}

function applyFilters() {
    // Always use server-side filtering for better database querying
    console.log('🔍 Applying filters via server-side API call');
    
    const filters = getCurrentFilters();
    console.log('📋 Current filters:', filters);
    
    // Reset to page 1 when filters change
    currentPage = 1;
    
    // Always call server API - don't fallback to client-side
    loadProductsFromAPI(filters);
}

// Load products from API with filters
async function loadProductsFromAPI(filters) {
    try {
        console.log('📦 Loading filtered products from database...');
        
        // Build query parameters with pagination
        const params = new URLSearchParams({
            limit: productsPerPage, // Fetch only products for current page
            offset: (currentPage - 1) * productsPerPage, // Calculate offset based on current page
            sort: filters.sort || 'default'
        });
        
        // Add category filter
        if (filters.category && filters.category.length > 0) {
            // Handle both string and array formats
            const categoryValue = Array.isArray(filters.category) ? filters.category.join(',') : filters.category;
            params.append('category', categoryValue);
        }
        
        // Add brand filter
        if (filters.brand && filters.brand.length > 0) {
            // Handle both string and array formats  
            const brandValue = Array.isArray(filters.brand) ? filters.brand.join(',') : filters.brand;
            params.append('brand', brandValue);
        }
        
        // Add price range filter
        if (filters.minPrice !== null && filters.minPrice !== '') {
            params.append('minPrice', filters.minPrice);
        }
        if (filters.maxPrice !== null && filters.maxPrice !== '') {
            params.append('maxPrice', filters.maxPrice);
        }
        
        // Add rating filter
        if (filters.rating) {
            params.append('rating', filters.rating);
            console.log('⭐ Adding rating filter to API params:', filters.rating);
        } else {
            console.log('⭐ No rating filter in params (filters.rating is', filters.rating, ')');
        }
        
        // Note: Search filter handled by script.js, not here
        // Search filter removed to avoid conflicts
        
        console.log('🔗 API URL:', `/api/products?${params.toString()}`);
        console.log('📄 Fetching page:', currentPage, 'Offset:', (currentPage - 1) * productsPerPage);
        
        const response = await fetch(`/api/products?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Received', data.products?.length || 0, 'products for page', currentPage);
        console.log('📊 Total products in database:', data.pagination?.total || 0);
        console.log('📊 API pagination data:', data.pagination);
        
        // Update filteredProducts with server response
        filteredProducts = data.products || [];
        
        // Update totalProducts from server response (this is the real total count)
        totalProducts = data.pagination?.total || filteredProducts.length;
        
        console.log('📦 Updated state - totalProducts:', totalProducts, 'filteredProducts:', filteredProducts.length, 'currentPage:', currentPage);
        
        // Render the filtered products
        renderProducts();
        
        // Update result count
        updateResultCount();
        
        // Update pagination controls - THIS IS CRITICAL
        updatePaginationControls();
        
        console.log('✅ Filters applied successfully - totalProducts:', totalProducts, 'currentPage:', currentPage);
        
        console.log('✅ Completed loading products and updating UI');
        
    } catch (error) {
        console.error('❌ Error loading filtered products:', error);
        
        // Show error message instead of fallback
        filteredProducts = [];
        renderProducts();
        
        // Show user-friendly error message
        if (productsGrid) {
            productsGrid.innerHTML = `
                <div class="error-message" style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3>Không thể tải sản phẩm</h3>
                    <p>Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại sau.</p>
                    <button onclick="location.reload()" class="retry-btn" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
                        <i class="fas fa-refresh"></i> Thử lại
                    </button>
                </div>
            `;
        }
    }
}

// Client-side filtering fallback
function applyClientSideFilters() {
    // Always use realProducts (extracted from DOM) if available
    const sourceProducts = realProducts.length > 0 ? realProducts : [];
    console.log('🔍 Applying client-side filters to', sourceProducts.length, 'real products');
    
    if (sourceProducts.length === 0) {
        console.log('⚠️ No real products found, showing empty result');
        filteredProducts = [];
        renderProducts();
        updateResultCount();
        return;
    }
    
    filteredProducts = sourceProducts.filter(product => {
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
            console.log('⭐ Rating filter:', ratingValue, 'stars or higher, product rating:', product.rating);
            if (product.rating < ratingValue) return false;
        }
        
        // Note: Search filter removed - handled by script.js
        // Search functionality moved to script.js to avoid conflicts
        
        return true;
    });
    
    console.log('✅ Client-side filtered to', filteredProducts.length, 'products');
    currentPage = 1;
    applySorting();
}

// Function to get current filter values (used by server-side loadProducts)
function getCurrentFilters() {
    const filters = {};
    
    // Category filter
    const categoryFilters = document.querySelectorAll('.category-filter:checked');
    if (categoryFilters.length > 0) {
        filters.category = Array.from(categoryFilters).map(cb => cb.value).join(',');
    }
    
    // Brand filter
    const brandFilters = document.querySelectorAll('.brand-filter:checked');
    if (brandFilters.length > 0) {
        filters.brand = Array.from(brandFilters).map(cb => cb.value).join(',');
    }
    
    // Price filter
    const minPrice = parseInt(document.getElementById('minPrice').value) || 0;
    const maxPrice = parseInt(document.getElementById('maxPrice').value) || 0;
    
    if (minPrice > 0) filters.minPrice = minPrice;
    if (maxPrice > 0) filters.maxPrice = maxPrice;
    
    // Rating filter - only include if actually selected AND checked
    const selectedRating = document.querySelector('input[name="rating"]:checked');
    if (selectedRating && selectedRating.dataset.wasChecked === 'true') {
        filters.rating = parseInt(selectedRating.value);
        console.log('⭐ Rating filter active:', filters.rating, 'stars');
    } else {
        // Explicitly log that no rating filter is applied
        console.log('⭐ No rating filter applied (checked:', !!selectedRating, ', wasChecked:', selectedRating?.dataset?.wasChecked, ')');
    }
    
    // Note: Search is handled by script.js, not shop.js
    // Search filter removed to avoid conflicts
    
    // Sort
    filters.sort = sortSelect.value || 'default';
    
    return filters;
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
    console.log('📦 renderProducts called');
    console.log('  - filteredProducts length:', filteredProducts.length);
    console.log('  - currentPage:', currentPage);
    console.log('  - productsPerPage:', productsPerPage);
    console.log('  - totalProducts:', totalProducts);
    
    if (!productsGrid) {
        console.error('❌ productsGrid element not found!');
        return;
    }
    
    // Products already paginated from server, no need to slice
    const productsToShow = filteredProducts;
    
    console.log('  - productsToShow length:', productsToShow.length);
    
    if (productsToShow.length === 0) {
        productsGrid.innerHTML = '';
        if (noResults) noResults.style.display = 'block';
        
        // Hide pagination when no results
        const paginationSection = document.querySelector('.pagination-section');
        if (paginationSection) {
            paginationSection.style.display = 'none';
            console.log('  - Pagination hidden (no results)');
        }
        
        if (resultCount) resultCount.textContent = 'Không tìm thấy sản phẩm';
        return;
    }
    
    if (noResults) noResults.style.display = 'none';
    
    const productsHTML = productsToShow.map(product => createProductCard(product)).join('');
    console.log('  - Generated HTML length:', productsHTML.length);
    
    productsGrid.innerHTML = productsHTML;
    
    // Ensure products grid is visible
    productsGrid.style.display = currentView === 'list' ? 'block' : 'grid';
    console.log('  - Products grid display set to:', productsGrid.style.display);
    
    // Calculate display range for result count
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = Math.min(startIndex + productsToShow.length, totalProducts);
    
    // Update result count
    if (resultCount) {
        resultCount.textContent = `Hiển thị ${startIndex + 1}-${endIndex} / ${totalProducts} sản phẩm`;
        console.log('  - Result count updated:', resultCount.textContent);
    }
    
    // DON'T call updatePaginationControls here - it's called by loadProductsFromAPI
    // This prevents double-rendering of pagination
    
    console.log('✅ renderProducts completed');
}

function createProductCard(product) {
    const oldPriceHtml = product.oldPrice ? `<span class="product-old-price">${formatPrice(product.oldPrice)}</span>` : '';
    const badgeHtml = product.badge ? `<div class="product-badge">${product.badge}</div>` : '';
    const starsHtml = generateStars(product.rating);
    
    // Handle image rendering - support both URLs and Font Awesome icons
    let imageHtml = '';
    if (product.images && product.images.length > 0) {
        // Has actual image URL
        imageHtml = `<img src="${product.images[0]}" alt="${product.name}" style="width: 100%; height: 200px; object-fit: cover;">`;
    } else if (product.imageUrl) {
        // Fallback to imageUrl property
        imageHtml = `<img src="${product.imageUrl}" alt="${product.name}" style="width: 100%; height: 200px; object-fit: cover;">`;
    } else {
        // Fallback to Font Awesome icon
        const iconClass = product.image || getProductIcon(product.name || 'product');
        const iconColor = product.imageColor || '#667eea';
        imageHtml = `<i class="${iconClass}" style="color: ${iconColor};"></i>`;
    }
    
    if (currentView === 'list') {
        return `
            <div class="product-card" data-product-id="${product.id}">
                <div class="product-image" onclick="goToProductDetail('${product.id}')">
                    ${imageHtml}
                    ${badgeHtml}
                </div>
                <div class="product-info">
                    <div class="product-details" onclick="goToProductDetail('${product.id}')">
                        <div class="product-rating">${starsHtml}</div>
                        <h4>${product.name}</h4>
                        <div class="product-price">
                            <span>${formatPrice(product.price)}</span>
                            ${oldPriceHtml}
                        </div>
                    </div>
                    <div class="product-price-actions">
                        <button class="add-to-cart" onclick="event.stopPropagation(); addToCart('${product.name}', '${formatPrice(product.price)}', '${product.id}', '${product.images && product.images[0] || product.imageUrl || ''}')">
                            <i class="fas fa-cart-plus"></i> THÊM VÀO GIỎ
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="product-card" data-product-id="${product.id}" onclick="goToProductDetail('${product.id}')">
            <div class="product-image">
                ${imageHtml}
                ${badgeHtml}
            </div>
            <div class="product-info">
                <div class="product-rating">${starsHtml}</div>
                <h4>${product.name}</h4>
                <div class="product-price">
                    <span>${formatPrice(product.price)}</span>
                    ${oldPriceHtml}
                </div>
                <button class="add-to-cart" onclick="event.stopPropagation(); addToCart('${product.name}', '${formatPrice(product.price)}', '${product.id}', '${product.images && product.images[0] || product.imageUrl || ''}')">
                    <i class="fas fa-cart-plus"></i> THÊM VÀO GIỎ
                </button>
            </div>
        </div>
    `;
}

function generateStars(rating) {
    console.log('⭐ Generating stars for rating:', rating);
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

// Function to extract real products from server-side rendered DOM
function extractRealProductsFromDOM() {
    console.log('🔍 Extracting real products from DOM...');
    
    productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) {
        console.warn('❌ productsGrid not found, cannot extract real products');
        console.warn('Available elements with id:', document.querySelectorAll('[id*="product"]'));
        return;
    }
    
    const productCards = productsGrid.querySelectorAll('.product-card');
    console.log(`Found ${productCards.length} product cards in DOM`);
    
    if (productCards.length === 0) {
        console.warn('❌ No product cards found in productsGrid');
        console.warn('productsGrid innerHTML:', productsGrid.innerHTML.substring(0, 200));
    }
    
    realProducts = Array.from(productCards).map((card, index) => {
        const productId = card.getAttribute('data-product-id');
        const img = card.querySelector('img');
        const name = card.querySelector('h4');
        const priceSpan = card.querySelector('.product-price span:first-child');
        const oldPriceSpan = card.querySelector('.product-old-price');
        const rating = card.querySelectorAll('.product-rating .fas.fa-star').length;
        
        // Check if this is a variant product by looking at the name or data attributes
        const productName = name ? name.textContent.trim() : '';
        const isVariant = productName.includes('Biến thể') || productName.includes('- Biến thể');
        
        // Extract image source
        let imageUrl = '';
        if (img && img.src && img.src !== window.location.href) {
            imageUrl = img.src;
        }
        
        // Extract price (remove currency symbols and parse)
        let price = 0;
        if (priceSpan) {
            const priceText = priceSpan.textContent.replace(/[^\d]/g, '');
            price = parseInt(priceText) || 0;
        }
        
        let oldPrice = null;
        if (oldPriceSpan) {
            const oldPriceText = oldPriceSpan.textContent.replace(/[^\d]/g, '');
            oldPrice = parseInt(oldPriceText) || null;
        }
        
        const product = {
            id: productId || `real-${index}`,
            name: name ? name.textContent.trim() : `Product ${index + 1}`,
            price: price,
            oldPrice: oldPrice,
            category: 'unknown', // Can't determine from DOM
            brand: 'unknown', // Can't determine from DOM  
            rating: rating,
            image: imageUrl,
            isReal: true, // Flag to identify real products
            isVariant: isVariant // Flag to identify variant products
        };
        
        console.log(`Extracted product: ${product.name} - ${product.price}đ ${isVariant ? '(VARIANT)' : '(MAIN)'}`);
        return product;
    }).filter(product => {
        // Filter out variant products (only show main products)
        const shouldShow = !product.isVariant;
        if (product.isVariant) {
            console.log(`🚫 Filtering out variant product: ${product.name}`);
        }
        return shouldShow;
    });
    
    console.log(`✅ Extracted ${realProducts.length} main products (variants filtered out):`, realProducts.map(p => p.name));
    
    // Use real products as initial filtered products
    if (realProducts.length > 0) {
        filteredProducts = [...realProducts];
        console.log('✅ Set filteredProducts to realProducts');
    } else {
        console.warn('No real products found, using sample data');
    }
}

function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
}

function toggleView(view) {
    console.log(`🎯 toggleView called with: ${view}`);
    console.log('Current productsGrid:', productsGrid);
    console.log('Available view buttons:', document.querySelectorAll('.view-btn'));
    
    currentView = view;
    
    // Update button states
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(btn => {
        btn.classList.remove('active');
        console.log(`Removed active from button: ${btn.dataset.view}`);
    });
    
    const targetButton = document.querySelector(`[data-view="${view}"]`);
    if (targetButton) {
        targetButton.classList.add('active');
        console.log(`Added active to button: ${view}`);
    } else {
        console.warn(`Button with data-view="${view}" not found!`);
    }
    
    // Update grid classes ONLY - don't re-render products
    if (productsGrid) {
        const newClassName = view === 'list' ? 'products-grid list-view' : 'products-grid';
        console.log(`Updating grid class from "${productsGrid.className}" to "${newClassName}"`);
        productsGrid.className = newClassName;
        
        // Just update the display style, don't re-render
        productsGrid.style.display = view === 'list' ? 'block' : 'grid';
        
        console.log(`✅ View switched to ${view} successfully (CSS only, products preserved)`);
    } else {
        console.error('productsGrid not found, cannot toggle view!');
    }
}

function loadMoreProducts() {
    // This is now replaced by pagination - go to next page
    goToPage(currentPage + 1);
}

function goToPage(pageNumber) {
    // Calculate total pages from server data
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    
    console.log('📄 Going to page:', pageNumber, 'Total pages:', totalPages, 'Total products:', totalProducts);
    
    if (pageNumber < 1 || pageNumber > totalPages) {
        console.log('⚠️ Invalid page number:', pageNumber, 'Valid range: 1 -', totalPages);
        return;
    }
    
    // Update current page and load products from server
    currentPage = pageNumber;
    
    // Load products from API for the new page
    const filters = getCurrentFilters();
    loadProductsFromAPI(filters);
    
    // Scroll to top of products grid
    setTimeout(() => {
        if (productsGrid) {
            productsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
}

function updatePaginationControls() {
    // Use totalProducts from server, not filteredProducts.length
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    
    console.log('🔄 Updating pagination:', { totalProducts, productsPerPage, totalPages, currentPage });
    
    // Find or create pagination section
    let paginationSection = document.querySelector('.pagination-section');
    
    if (!paginationSection) {
        // Create pagination section if it doesn't exist
        const loadMoreSection = document.querySelector('.load-more-section');
        if (loadMoreSection) {
            paginationSection = document.createElement('div');
            paginationSection.className = 'pagination-section';
            loadMoreSection.parentNode.insertBefore(paginationSection, loadMoreSection);
        } else {
            console.warn('Load more section not found, cannot add pagination');
            return;
        }
    }
    
    // Hide old load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn && loadMoreBtn.parentElement) {
        loadMoreBtn.parentElement.style.display = 'none';
    }
    
    // Hide pagination if no products or only 1 page
    if (totalProducts === 0) {
        paginationSection.style.display = 'none';
        console.log('  - Pagination hidden (no products)');
        return;
    }
    
    // Always show pagination if there are products
    paginationSection.style.display = 'flex';
    
    // Generate pagination HTML
    let paginationHTML = '<div class="pagination-controls">';
    
    // Previous button
    if (currentPage > 1) {
        paginationHTML += `
            <button class="pagination-btn" onclick="goToPage(${currentPage - 1})">
                <i class="fas fa-chevron-left"></i> Trước
            </button>
        `;
    }
    
    // Page numbers
    paginationHTML += '<div class="page-numbers">';
    
    // Show all pages if totalPages <= 7
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `
                <button class="page-number ${currentPage === i ? 'active' : ''}" onclick="goToPage(${i})">
                    ${i}
                </button>
            `;
        }
    } else {
        // Show smart pagination for many pages
        // Always show first page
        paginationHTML += `
            <button class="page-number ${currentPage === 1 ? 'active' : ''}" onclick="goToPage(1)">
                1
            </button>
        `;
        
        // Show ellipsis if needed
        if (currentPage > 3) {
            paginationHTML += '<span class="page-ellipsis">...</span>';
        }
        
        // Show pages around current page
        const startPage = Math.max(2, currentPage - 1);
        const endPage = Math.min(totalPages - 1, currentPage + 1);
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="page-number ${currentPage === i ? 'active' : ''}" onclick="goToPage(${i})">
                    ${i}
                </button>
            `;
        }
        
        // Show ellipsis if needed
        if (currentPage < totalPages - 2) {
            paginationHTML += '<span class="page-ellipsis">...</span>';
        }
        
        // Always show last page
        if (totalPages > 1) {
            paginationHTML += `
                <button class="page-number ${currentPage === totalPages ? 'active' : ''}" onclick="goToPage(${totalPages})">
                    ${totalPages}
                </button>
            `;
        }
    }
    
    paginationHTML += '</div>';
    
    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `
            <button class="pagination-btn" onclick="goToPage(${currentPage + 1})">
                Sau <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    paginationHTML += '</div>';
    
    paginationSection.innerHTML = paginationHTML;
    console.log(`✅ Pagination updated: showing ${totalPages} page(s), current page: ${currentPage}`);
}

// Make goToPage globally available
window.goToPage = goToPage;

function clearAllFilters() {
    console.log('🔄 Clearing all filters...');
    
    // Reset category filters
    document.getElementById('categoryAll').checked = true;
    document.querySelectorAll('.category-filter').forEach(cb => cb.checked = false);
    
    // Reset brand filters
    document.querySelectorAll('.brand-filter').forEach(cb => cb.checked = false);
    
    // Reset rating filters and their data attributes
    console.log('🔄 Clearing rating filters...');
    document.querySelectorAll('input[name="rating"]').forEach(radio => {
        radio.checked = false;
        radio.dataset.wasChecked = 'false';
        console.log('  - Reset rating radio:', radio.value, '-> wasChecked=false');
    });
    
    // Reset price filters
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.querySelectorAll('.price-tag').forEach(tag => tag.classList.remove('active'));
    
    // Note: Search reset handled by script.js
    // Search reset removed to avoid conflicts
    
    // Reset sort
    if (sortSelect) {
        sortSelect.value = 'default';
    }
    
    // Reset to page 1
    currentPage = 1;
    
    // Apply filters (will load from API and update pagination)
    applyFilters();
    
    console.log('✅ Filters cleared, loading all products...');
}

function selectCategoryFilter(category) {
    document.getElementById('categoryAll').checked = false;
    document.querySelectorAll('.category-filter').forEach(cb => {
        cb.checked = cb.value === category;
    });
    applyFilters();
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

// Global function for adding products to cart (if not defined in main script.js)
// Only define fallback addToCart if it doesn't exist AND script.js hasn't been loaded
if (typeof addToCart === 'undefined' && !window.scriptJsLoaded) {
    console.log('⚠️ Script.js not loaded, using shop.js fallback addToCart');
    window.addToCart = function(productName, price, productId) {
        // Basic add to cart functionality
        console.log(`Added ${productName} (${price}) to cart`);
        
        // You can implement your cart logic here
        // This is a placeholder implementation
        alert(`Đã thêm "${productName}" vào giỏ hàng!`);
    };
} else if (window.scriptJsLoaded) {
    console.log('✅ Script.js loaded, using its addToCart function');
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
    if (!window.addToCart && !window.scriptJsLoaded) {
        console.log('⚠️ Script.js not loaded, using shop.js fallback functions');
        // Only define these functions if they don't exist (fallback)
        window.addToCart = addToCartLocal;
        window.removeFromCart = removeFromCartLocal;
        window.updateCartQuantity = updateCartQuantityLocal;
        // DON'T override toggleCart - let script.js or shop.ejs handle it
        window.proceedToCheckout = proceedToCheckoutLocal;
        window.closeCheckoutModal = closeCheckoutModalLocal;
        window.completeOrder = completeOrderLocal;
    } else {
        console.log('✅ Script.js functions available, skipping shop.js fallbacks');
    }
    
    // Setup cart event listeners (only if script.js doesn't have it)
    if (typeof window.setupCartEventListeners !== 'function') {
        console.log('🔧 Using shop.js cart event listeners as fallback');
        setupCartEventListeners();
    } else {
        console.log('✅ Using script.js cart event listeners');
    }
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
    toggleFilters,
    clearAllFilters,
    selectCategoryFilter,
    loadMoreProducts
};

// Make functions globally available for HTML onclick and other scripts
window.loadMoreProducts = loadMoreProducts;
window.toggleFilters = toggleFilters;

// Ensure critical cart functions are available - with delay for script.js loading
function ensureCartFunctions() {
    // Don't override toggleCart - let script.js or shop.ejs handle it properly
    if (typeof window.toggleCart === 'function') {
        console.log('✅ toggleCart function available from script.js');
    } else {
        console.warn('⚠️ toggleCart not available from script.js');
    }
    
    // Check for universal cart functions for guest support
    if (typeof window.handleCartQuantityUpdate === 'function') {
        console.log('✅ handleCartQuantityUpdate function available from script.js');
    } else {
        console.warn('⚠️ handleCartQuantityUpdate not available from script.js');
    }
    
    if (typeof window.handleCartRemove === 'function') {
        console.log('✅ handleCartRemove function available from script.js');
    } else {
        console.warn('⚠️ handleCartRemove not available from script.js');
    }
    
    if (typeof window.updateGuestCartQuantity === 'function') {
        console.log('✅ updateGuestCartQuantity function available from script.js');
    } else {
        console.warn('⚠️ updateGuestCartQuantity not available from script.js');
    }
    
    if (typeof window.removeGuestCartItem === 'function') {
        console.log('✅ removeGuestCartItem function available from script.js');
    } else {
        console.warn('⚠️ removeGuestCartItem not available from script.js');
    }
}

// Try multiple times with increasing delays to ensure script.js is ready
setTimeout(() => ensureCartFunctions(), 500);
setTimeout(() => ensureCartFunctions(), 1000);
setTimeout(() => ensureCartFunctions(), 2000);

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

// Admin navigation function
function navigateToAdmin(page) {
    console.log('🚀 Navigating to admin page:', page);
    
    // Get the current auth token
    const idToken = localStorage.getItem('idToken');
    
    if (!idToken) {
        console.error('❌ No auth token found');
        showNotification('Vui lòng đăng nhập để truy cập trang admin', 'warning');
        return;
    }
    
    let url;
    switch(page.toUpperCase()) {
        case 'INPUT':
            url = `/admin/input?token=${encodeURIComponent(idToken)}`;
            break;
        case 'EDIT':
            url = `/admin/edit?token=${encodeURIComponent(idToken)}`;
            break;
        case 'COUPON':
            url = `/admin/coupon?token=${encodeURIComponent(idToken)}`;
            break;
        default:
            console.error('❌ Unknown admin page:', page);
            return;
    }
    
    console.log('✅ Navigating to:', url);
    window.location.href = url;
}

// Make the function globally available
window.navigateToAdmin = navigateToAdmin;

// Helper functions for product filtering
function updateResultCount() {
    const resultCountElement = document.getElementById('resultCount');
    if (resultCountElement) {
        const startIndex = (currentPage - 1) * productsPerPage + 1;
        const endIndex = Math.min(currentPage * productsPerPage, totalProducts);
        const showing = filteredProducts.length; // Current page products count
        
        if (totalProducts > 0) {
            resultCountElement.textContent = `Hiển thị ${startIndex}-${startIndex + showing - 1} / ${totalProducts} sản phẩm`;
        } else {
            resultCountElement.textContent = 'Không tìm thấy sản phẩm';
        }
    }
}

function updateLoadMoreButton(hasMore) {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        if (hasMore && filteredProducts.length > currentPage * productsPerPage) {
            loadMoreBtn.style.display = 'block';
        } else {
            loadMoreBtn.style.display = 'none';
        }
    }
}

// Get Font Awesome icon class for product based on name/category
function getProductIcon(productName) {
    if (!productName) return 'fas fa-cube';
    
    const name = productName.toLowerCase();
    
    if (name.includes('laptop') || name.includes('gaming')) return 'fas fa-laptop';
    if (name.includes('cpu') || name.includes('processor') || name.includes('intel') || name.includes('amd')) return 'fas fa-microchip';
    if (name.includes('gpu') || name.includes('graphics') || name.includes('nvidia') || name.includes('rtx') || name.includes('gtx')) return 'fas fa-memory';
    if (name.includes('ram') || name.includes('memory')) return 'fas fa-memory';
    if (name.includes('ssd') || name.includes('hdd') || name.includes('storage') || name.includes('drive')) return 'fas fa-hdd';
    if (name.includes('monitor') || name.includes('screen') || name.includes('display')) return 'fas fa-tv';
    if (name.includes('mouse') || name.includes('keyboard') || name.includes('headset') || name.includes('gaming')) return 'fas fa-gamepad';
    if (name.includes('motherboard') || name.includes('mainboard')) return 'fas fa-microchip';
    if (name.includes('power') || name.includes('psu')) return 'fas fa-bolt';
    if (name.includes('case') || name.includes('tower')) return 'fas fa-desktop';
    if (name.includes('cooler') || name.includes('fan')) return 'fas fa-fan';
    
    return 'fas fa-cube';
}

// Simple notification function for shop page
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    // Set background color based on type
    switch(type) {
        case 'success':
            notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            break;
        case 'error':
            notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            break;
        case 'warning':
            notification.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
            break;
        default:
            notification.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

window.goToProductDetail = goToProductDetail;