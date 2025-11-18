// =====================================
// REAL-TIME COMMENT AND RATING SYSTEM WITH WEBSOCKET
// =====================================

let commentsSocket = null;
let commentsListener = null;
let ratingsListener = null;
let currentProductId = null;
let currentUserId = null;
let commentsData = [];
let ratingsData = [];
let isLoadingComments = false;
let isLoadingRatings = false;
let commentsPerPage = 10;
let currentPage = 0;
let selectedRating = 0;
let userRating = null; // Store user's existing rating

// =====================================
// CSS INJECTION FOR RATING SYSTEM
// =====================================

// Inject CSS for rating system to ensure it loads properly on all devices
function injectRatingSystemCSS() {
    // Check if CSS is already injected
    const existingCSS = document.getElementById('rating-system-css');
    if (existingCSS) {
        console.log('⭐ Rating system CSS already injected, verifying styles...');
        // Double check if styles are actually applied
        setTimeout(() => {
            const testElement = document.querySelector('.reviews-section');
            if (testElement) {
                const styles = window.getComputedStyle(testElement);
                if (styles.marginTop === '0px' || !styles.marginTop) {
                    console.warn('🔄 CSS not properly applied, re-injecting...');
                    existingCSS.remove();
                    injectRatingSystemCSS();
                }
            }
        }, 100);
        return;
    }
    
    console.log('💉 Injecting rating system CSS for desktop compatibility...');
    
    const css = `
        /* =====================================
           RATING SYSTEM STYLES - DESKTOP OPTIMIZED
           ===================================== */
        
        /* Force CSS priority for desktop browsers */
        * {
            box-sizing: border-box;
        }
        
        /* Rating Summary Styles */
        .reviews-section {
            margin-top: 2rem !important;
            width: 100% !important;
            display: block !important;
        }
        
        .reviews-summary {
            padding: 2rem !important;
            background: #f8fafc !important;
            border-radius: 12px !important;
            border: 1px solid #e2e8f0 !important;
            margin-bottom: 2rem !important;
            width: 100% !important;
            display: block !important;
        }
        
        .reviews-summary h3 {
            margin: 0 0 1.5rem 0 !important;
            color: #1a202c !important;
            font-size: 1.5rem !important;
            font-weight: 700 !important;
            display: block !important;
        }
        
        .rating-summary {
            display: grid !important;
            grid-template-columns: auto 1fr !important;
            gap: 2rem !important;
            align-items: start !important;
            width: 100% !important;
        }
        
        /* Desktop specific grid layout */
        @media (min-width: 1024px) {
            .rating-summary {
                grid-template-columns: 200px 1fr !important;
                gap: 3rem !important;
            }
        }
        
        .average-rating {
            text-align: center !important;
            padding: 1rem !important;
            background: white !important;
            border-radius: 8px !important;
            border: 1px solid #e2e8f0 !important;
            min-width: 140px !important;
            display: block !important;
        }
        
        .rating-number {
            display: block !important;
            font-size: 2.5rem !important;
            font-weight: 700 !important;
            color: #667eea !important;
            margin-bottom: 0.5rem !important;
        }
        
        .average-rating .stars {
            display: flex !important;
            justify-content: center !important;
            gap: 2px !important;
            margin-bottom: 0.5rem !important;
        }
        
        .average-rating .stars i {
            font-size: 1.2rem !important;
            color: #fbbf24 !important;
        }
        
        .review-count {
            font-size: 0.9rem !important;
            color: #64748b !important;
            display: block !important;
        }
        
        .rating-distribution {
            display: flex !important;
            flex-direction: column !important;
            gap: 0.5rem !important;
            width: 100% !important;
        }
        
        .rating-bar {
            display: grid;
            grid-template-columns: 50px 1fr 40px;
            gap: 0.75rem;
            align-items: center;
        }
        
        .star-label {
            font-size: 0.85rem;
            color: #64748b;
            font-weight: 500;
        }
        
        .rating-progress {
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
            position: relative;
        }
        
        .rating-fill {
            height: 100%;
            background: linear-gradient(90deg, #fbbf24, #f59e0b);
            border-radius: 4px;
            transition: width 0.6s ease;
        }
        
        .rating-count {
            font-size: 0.85rem;
            color: #64748b;
            text-align: right;
            font-weight: 500;
        }
        
        /* Rating Form Styles */
        .rating-form-container {
            margin-bottom: 2rem;
            padding: 1.5rem;
            background: #f8fafc;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
        }
        
        .rating-form-container h4 {
            margin: 0 0 1rem 0;
            color: #374151;
            font-size: 1.1rem;
            font-weight: 600;
        }
        
        .rating-user-info {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }
        
        /* Star Rating Input */
        .star-rating-input {
            margin-bottom: 1rem;
        }
        
        .star-rating-input label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #374151;
        }
        
        .star-input {
            display: flex;
            gap: 4px;
            margin-bottom: 0.5rem;
        }
        
        .star-input i {
            font-size: 1.8rem;
            color: #d1d5db;
            cursor: pointer;
            transition: all 0.2s ease;
            user-select: none;
        }
        
        .star-input i:hover,
        .star-input i.hovered {
            color: #fbbf24;
            transform: scale(1.1);
        }
        
        .star-input i.selected {
            color: #f59e0b;
        }
        
        .rating-text {
            font-size: 0.9rem;
            color: #64748b;
            font-weight: 500;
        }
        
        /* Rating Input Group */
        .rating-input-group {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        
        .rating-input-group textarea {
            padding: 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-family: inherit;
            font-size: 0.9rem;
            resize: vertical;
            transition: all 0.3s ease;
        }
        
        .rating-input-group textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .rating-actions {
            display: flex;
            justify-content: flex-end;
            gap: 0.75rem;
        }
        
        .btn-rating-cancel,
        .btn-rating-submit {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 6px;
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .btn-rating-cancel {
            background: #f3f4f6;
            color: #6b7280;
        }
        
        .btn-rating-cancel:hover {
            background: #e5e7eb;
            color: #374151;
        }
        
        .btn-rating-submit {
            background: #667eea;
            color: white;
        }
        
        .btn-rating-submit:hover:not(:disabled) {
            background: #5a67d8;
            transform: translateY(-1px);
        }
        
        .btn-rating-submit:disabled {
            background: #9ca3af;
            cursor: not-allowed;
            transform: none;
        }
        
        /* Rating List Styles */
        .ratings-list-container {
            margin-top: 2rem;
        }
        
        .ratings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .ratings-header h4 {
            margin: 0;
            color: #1a202c;
            font-size: 1.2rem;
            font-weight: 600;
        }
        
        .rating-filter select {
            padding: 0.5rem 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            font-size: 0.9rem;
            cursor: pointer;
        }
        
        /* Make the ratings list scrollable on desktop and mobile */
        .ratings-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            max-height: 600px; /* desktop default */
            overflow-y: auto;
            overflow-x: hidden;
            padding-right: 0.5rem; /* prevent content under scrollbar */
        }
        
        /* Custom scrollbar for injected CSS (WebKit) */
        .ratings-list::-webkit-scrollbar {
            width: 8px;
        }
        .ratings-list::-webkit-scrollbar-track {
            background: #e2e8f0;
            border-radius: 10px;
        }
        .ratings-list::-webkit-scrollbar-thumb {
            background: #9ca3af;
            border-radius: 10px;
        }
        
        .rating-item {
            padding: 1.5rem;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            transition: all 0.2s ease;
        }
        
        .rating-item:hover {
            border-color: #cbd5e0;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .rating-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
        }
        
        .rating-user {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        
        .rating-user-info h5 {
            margin: 0 0 0.25rem 0;
            font-size: 0.95rem;
            font-weight: 600;
            color: #374151;
        }
        
        .rating-user-info .rating-time {
            font-size: 0.8rem;
            color: #64748b;
        }
        
        .rating-stars {
            display: flex;
            gap: 2px;
        }
        
        .rating-stars i {
            font-size: 1rem;
            color: #fbbf24;
        }
        
        .rating-content {
            margin-top: 0.75rem;
            line-height: 1.6;
            color: #374151;
        }
        
        .no-ratings {
            text-align: center;
            padding: 3rem 2rem;
            color: #64748b;
        }
        
        .no-ratings i {
            display: block;
            margin-bottom: 1rem;
        }
        
        .no-ratings p {
            margin: 0.5rem 0;
        }
        
        .ratings-loading {
            text-align: center;
            padding: 2rem;
            color: #64748b;
        }
        
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #e2e8f0;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Rating Actions */
        .rating-actions {
            margin-top: 1rem;
            display: flex;
            justify-content: flex-end;
            gap: 0.5rem;
        }
        
        .btn-delete-rating {
            padding: 0.25rem 0.5rem;
            background: #fee2e2;
            color: #dc2626;
            border: 1px solid #fecaca;
            border-radius: 4px;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }
        
        .btn-delete-rating:hover {
            background: #fecaca;
            border-color: #f87171;
        }
        
        /* Existing Rating Notice */
        .existing-rating-notice {
            background: #fef3cd !important;
            border: 1px solid #fde68a !important;
            color: #92400e !important;
            padding: 0.75rem !important;
            border-radius: 6px !important;
            margin-bottom: 1rem !important;
            font-size: 0.9rem !important;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
            .rating-summary {
                grid-template-columns: 1fr;
                gap: 1.5rem;
            }
            
            .rating-bar {
                grid-template-columns: 40px 1fr 30px;
                gap: 0.5rem;
            }
            
            .star-label {
                font-size: 0.8rem;
            }
            
            .rating-header {
                flex-direction: column;
                gap: 1rem;
                align-items: flex-start;
            }
            
            .ratings-header {
                flex-direction: column;
                gap: 1rem;
                align-items: flex-start;
            }
            
            .rating-actions {
                flex-direction: column;
            }
            
            .btn-rating-cancel,
            .btn-rating-submit {
                justify-content: center;
            }
            
            .reviews-summary {
                padding: 1rem;
            }
            
            .rating-form-container {
                padding: 1rem;
            }
            
            .rating-item {
                padding: 1rem;
            }
        }
        
        /* Desktop specific improvements */
        @media (min-width: 769px) {
            .rating-summary {
                grid-template-columns: 180px 1fr;
                gap: 2.5rem;
            }
            
            .average-rating {
                min-width: 160px;
                padding: 1.5rem;
            }
            
            .rating-number {
                font-size: 3rem;
            }
            
            .rating-form-container,
            .reviews-summary {
                padding: 2rem;
            }
            
            .rating-item {
                padding: 2rem;
            }
        }
    `;
    
    // Create and inject style element
    const styleElement = document.createElement('style');
    styleElement.id = 'rating-system-css';
    styleElement.type = 'text/css';
    styleElement.textContent = css;
    
    // Insert at the end of head to ensure it overrides other styles
    document.head.appendChild(styleElement);
    
    console.log('✅ Rating system CSS injected successfully');
    
    // Verify CSS is working by checking if styles are applied
    setTimeout(() => {
        const reviewsSection = document.querySelector('.reviews-section');
        if (reviewsSection) {
            const styles = window.getComputedStyle(reviewsSection);
            if (styles.marginTop === '0px' || styles.marginTop === '') {
                console.warn('⚠️ CSS may not be applied correctly, attempting re-injection...');
                // Force re-injection if styles aren't applied
                document.getElementById('rating-system-css')?.remove();
                setTimeout(() => injectRatingSystemCSS(), 100);
            } else {
                console.log('✅ CSS verified to be working correctly');
            }
        }
    }, 1000);
}

// Force reload rating system CSS
window.reloadRatingCSS = function() {
    console.log('🔄 Force reloading rating system CSS...');
    
    // Remove existing CSS
    const existingCSS = document.getElementById('rating-system-css');
    if (existingCSS) {
        existingCSS.remove();
        console.log('🗑️ Removed existing CSS');
    }
    
    // Re-inject CSS
    setTimeout(() => {
        injectRatingSystemCSS();
        console.log('✅ CSS reloaded successfully');
    }, 100);
};

// Desktop CSS troubleshooting function
window.fixDesktopCSS = function() {
    console.log('🔧 Running desktop CSS fix...');
    
    // Force remove all existing styles
    const existingStyles = document.querySelectorAll('#rating-system-css, style[data-rating-css]');
    existingStyles.forEach(style => style.remove());
    
    // Clear any cached styles
    if (document.styleSheets) {
        Array.from(document.styleSheets).forEach((sheet, index) => {
            try {
                if (sheet.href && sheet.href.includes('product_detail.css')) {
                    sheet.disabled = true;
                    setTimeout(() => sheet.disabled = false, 50);
                }
            } catch (e) {
                // Skip cross-origin stylesheets
            }
        });
    }
    
    // Re-inject with higher priority
    setTimeout(() => {
        injectRatingSystemCSS();
        
        // Verify after injection
        setTimeout(() => {
            const testElement = document.querySelector('.reviews-section');
            if (testElement) {
                const styles = window.getComputedStyle(testElement);
                console.log('🔍 Reviews section margin-top:', styles.marginTop);
                console.log('🔍 Reviews section display:', styles.display);
                
                if (styles.marginTop === '0px') {
                    console.warn('⚠️ CSS still not applied, trying alternative method...');
                    // Try inline styles as fallback
                    document.querySelectorAll('.reviews-section').forEach(el => {
                        el.style.marginTop = '2rem';
                        el.style.display = 'block';
                        el.style.width = '100%';
                    });
                    
                    document.querySelectorAll('.reviews-summary').forEach(el => {
                        el.style.padding = '2rem';
                        el.style.background = '#f8fafc';
                        el.style.borderRadius = '12px';
                        el.style.border = '1px solid #e2e8f0';
                        el.style.marginBottom = '2rem';
                    });
                } else {
                    console.log('✅ Desktop CSS fix successful');
                }
            }
        }, 500);
    }, 100);
};

// Initialize comment and rating system when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Rate Comment System Initializing...');
    
    // Inject CSS for rating system first
    injectRatingSystemCSS();
    
    // Add desktop-specific CSS monitoring
    if (window.innerWidth >= 1024) {
        console.log('🖥️ Desktop detected, monitoring CSS loading...');
        
        // Monitor for CSS issues on desktop
        setTimeout(() => {
            const testElements = [
                '.reviews-section',
                '.reviews-summary', 
                '.rating-summary',
                '.average-rating'
            ];
            
            let cssIssues = 0;
            testElements.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    const styles = window.getComputedStyle(element);
                    // Check if key styles are applied
                    if (selector === '.reviews-section' && styles.marginTop === '0px') {
                        cssIssues++;
                    }
                    if (selector === '.reviews-summary' && styles.padding === '0px') {
                        cssIssues++;
                    }
                }
            });
            
            if (cssIssues > 0) {
                console.warn('⚠️ CSS issues detected on desktop, running comprehensive fix...');
                window.fixDesktopCSS();
            } else {
                console.log('✅ Desktop CSS loading verified');
            }
        }, 2000);
    }
    
    // Get product ID from the page
    const newProductId = getProductIdFromPage();
    if (!newProductId) {
        console.error('❌ Product ID not found on page');
        return;
    }
    
    // Check if product changed - if so, reset all state
    if (currentProductId !== newProductId) {
        console.log('🔄 Product changed from', currentProductId, 'to', newProductId, '- Resetting state');
        
        // Reset all product-specific state
        currentProductId = newProductId;
        commentsData = [];
        ratingsData = [];
        userRating = null;
        selectedRating = 0;
        currentPage = 0;
        
        // Clear any existing listeners
        if (commentsListener) {
            commentsListener();
            commentsListener = null;
        }
        if (ratingsListener) {
            ratingsListener();
            ratingsListener = null;
        }
    } else {
        currentProductId = newProductId;
    }
    
    console.log('📦 Product ID found:', currentProductId);
    
    // Initialize comment and rating system
    initializeCommentSystem();
    initializeRatingSystem();
});

// Get product ID from page elements
function getProductIdFromPage() {
    // Try multiple ways to get product ID
    const productElement = document.querySelector('[data-product-id]');
    if (productElement) {
        return productElement.dataset.productId;
    }
    
    // Try from URL path
    const pathParts = window.location.pathname.split('/');
    const productIndex = pathParts.findIndex(part => part === 'product');
    if (productIndex !== -1 && pathParts[productIndex + 1]) {
        return pathParts[productIndex + 1];
    }
    
    // Try from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id') || urlParams.get('productId');
}

// Initialize the complete comment system
async function initializeCommentSystem() {
    console.log('🎯 Initializing comment system for product:', currentProductId);
    
    // Wait for authentication to be ready
    await waitForAuth();
    
    // Setup UI based on auth state
    setupCommentUI();
    
    // Setup Firebase auth state listener for dynamic UI updates
    if (window.firebaseAuth) {
        window.firebaseAuth.onAuthStateChanged((user) => {
            console.log('🔐 Auth state changed in comment system:', user ? 'logged in' : 'logged out');
            if (user) {
                currentUserId = user.uid;
            } else {
                currentUserId = null;
            }
            refreshCommentUIOnAuthChange();
        });
    }
    
    // Initialize WebSocket connection
    initializeWebSocket();
    
    // Setup Firebase real-time listener
    setupFirebaseCommentsListener();
    
    // Load initial comments
    await loadComments();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize simple popup system
    setTimeout(() => {
        initializeSimplePopupSystem();
    }, 500);
    
    console.log('✅ Comment system initialized successfully');
}

// =====================================
// RATING SYSTEM INITIALIZATION
// =====================================

// Initialize the complete rating system
async function initializeRatingSystem() {
    console.log('⭐ Initializing rating system for product:', currentProductId);
    
    // Wait for authentication to be ready
    await waitForAuth();
    
    // Setup rating UI based on auth state
    setupRatingUI();
    
    // Setup Firebase real-time listener for ratings
    setupFirebaseRatingsListener();
    
    // Load initial ratings
    await loadRatings();
    
    // Setup rating event listeners
    setupRatingEventListeners();
    
    // Double-check CSS injection after a delay
    setTimeout(() => {
        const cssElement = document.getElementById('rating-system-css');
        if (!cssElement) {
            console.warn('⚠️ Rating CSS not found during initialization, re-injecting...');
            injectRatingSystemCSS();
        }
    }, 500);
    
    console.log('✅ Rating system initialized successfully');
}

// Setup rating UI based on authentication state
function setupRatingUI() {
    console.log('⭐ Setting up rating UI for user:', currentUserId, 'product:', currentProductId);
    
    const userAvatar = document.getElementById('ratingUserAvatar');
    const userName = document.getElementById('ratingUserName');
    const ratingContent = document.getElementById('ratingContent');
    const submitBtn = document.querySelector('.btn-rating-submit');
    const starInput = document.getElementById('starInput');
    const ratingForm = document.getElementById('ratingForm');
    
    // IMPORTANT: Remove any existing rating notice first
    const existingNotice = ratingForm?.querySelector('.existing-rating-notice');
    if (existingNotice) {
        existingNotice.remove();
        console.log('🗑️ Removed old existing rating notice');
    }
    
    // Reset form to default state
    selectedRating = 0;
    if (ratingContent) {
        ratingContent.value = '';
    }
    resetStars();
    
    // Get user from multiple possible sources
    const user = window.currentUser || window.firebaseAuth?.currentUser;
    
    if (currentUserId && user) {
        // User is logged in
        console.log('👤 Setting up rating UI for logged in user');
        
        // Setup user avatar
        setupUserAvatar(userAvatar, user);
        
        // Setup user name
        if (userName) {
            userName.textContent = user.displayName || user.email || 'Người dùng';
        }
        
        // Enable rating form
        if (ratingContent) {
            ratingContent.disabled = false;
            ratingContent.placeholder = 'Chia sẻ đánh giá chi tiết về sản phẩm này...';
        }
        
        if (submitBtn) {
            submitBtn.disabled = true; // Will be enabled when user selects stars
            submitBtn.innerHTML = '<i class="fas fa-star"></i> Gửi đánh giá';
        }
        
        // Setup star rating interaction
        if (starInput) {
            setupStarRatingInteraction();
        }
        
    } else {
        // User is not logged in
        console.log('👤 Setting up rating UI for guest user');
        
        if (userAvatar) {
            userAvatar.innerHTML = '<i class="fas fa-user"></i>';
        }
        
        if (userName) {
            userName.textContent = 'Vui lòng đăng nhập để đánh giá';
        }
        
        if (ratingContent) {
            ratingContent.disabled = true;
            ratingContent.placeholder = 'Vui lòng đăng nhập để đánh giá sản phẩm';
        }
        
        if (submitBtn) {
            submitBtn.disabled = true;
        }
        
        if (starInput) {
            starInput.style.pointerEvents = 'none';
            starInput.style.opacity = '0.5';
        }
    }
}

// Setup star rating interaction
function setupStarRatingInteraction() {
    const starInput = document.getElementById('starInput');
    const ratingText = document.getElementById('ratingText');
    const submitBtn = document.querySelector('.btn-rating-submit');
    
    if (!starInput) return;
    
    // Enable star input interaction
    starInput.style.pointerEvents = 'auto';
    starInput.style.opacity = '1';
    
    const stars = starInput.querySelectorAll('i');
    const ratingTexts = ['Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Rất tốt'];
    
    stars.forEach((star, index) => {
        // Mouse hover effects
        star.addEventListener('mouseenter', () => {
            highlightStars(index + 1);
            if (ratingText) {
                ratingText.textContent = ratingTexts[index] || 'Chọn số sao';
            }
        });
        
        // Click to select rating
        star.addEventListener('click', () => {
            selectedRating = index + 1;
            selectStars(selectedRating);
            if (ratingText) {
                ratingText.textContent = ratingTexts[index] || 'Chọn số sao';
            }
            if (submitBtn) {
                submitBtn.disabled = false;
            }
            console.log('⭐ Rating selected:', selectedRating);
        });
    });
    
    // Reset on mouse leave
    starInput.addEventListener('mouseleave', () => {
        if (selectedRating > 0) {
            selectStars(selectedRating);
            if (ratingText) {
                ratingText.textContent = ratingTexts[selectedRating - 1] || 'Chọn số sao';
            }
        } else {
            resetStars();
            if (ratingText) {
                ratingText.textContent = 'Chọn số sao';
            }
        }
    });
}

// Highlight stars on hover
function highlightStars(count) {
    const stars = document.querySelectorAll('#starInput i');
    stars.forEach((star, index) => {
        if (index < count) {
            star.className = 'fas fa-star hovered';
        } else {
            star.className = 'far fa-star';
        }
    });
}

// Select stars (permanent selection)
function selectStars(count) {
    const stars = document.querySelectorAll('#starInput i');
    stars.forEach((star, index) => {
        if (index < count) {
            star.className = 'fas fa-star selected';
        } else {
            star.className = 'far fa-star';
        }
    });
}

// Reset stars to unselected state
function resetStars() {
    const stars = document.querySelectorAll('#starInput i');
    stars.forEach((star) => {
        star.className = 'far fa-star';
    });
}

// Wait for authentication to be ready
function waitForAuth() {
    return new Promise((resolve) => {
        // Check multiple possible sources for user authentication
        const checkAuthState = () => {
            // Check window.currentUser (Firebase compat)
            if (window.currentUser && window.currentUser.uid) {
                currentUserId = window.currentUser.uid;
                console.log('👤 Auth state ready:', currentUserId ? 'Logged in' : 'Guest');
                return true;
            }
            
            // Check Firebase auth instance directly
            if (window.firebaseAuth && window.firebaseAuth.currentUser) {
                currentUserId = window.firebaseAuth.currentUser.uid;
                window.currentUser = window.firebaseAuth.currentUser; // Sync the variables
                console.log('👤 Auth state ready (from Firebase):', currentUserId ? 'Logged in' : 'Guest');
                return true;
            }
            
            // Check if auth state is still loading
            if (window.currentUser === undefined) {
                return false; // Still loading
            }
            
            // User is definitely not logged in
            currentUserId = null;
            console.log('👤 Auth state ready: Guest');
            return true;
        };
        
        if (checkAuthState()) {
            resolve();
        } else {
            // Wait for auth state to be determined
            const checkAuth = setInterval(() => {
                if (checkAuthState()) {
                    clearInterval(checkAuth);
                    resolve();
                }
            }, 100);
            
            // Timeout after 10 seconds to prevent infinite waiting
            setTimeout(() => {
                clearInterval(checkAuth);
                console.warn('⚠️ Auth check timeout, proceeding as guest');
                currentUserId = null;
                resolve();
            }, 10000);
        }
    });
}

// Setup user avatar from users collection
async function setupUserAvatar(avatarElement, user) {
    if (!avatarElement || !user) return;
    
    let userPhoto = user.photoURL || user.photo;
    
    // Try to get photo from users collection
    if (currentUserId && window.firebase?.firestore) {
        console.log('🔍 Fetching user photo for comment form from users collection...');
        try {
            const db = window.firebase.firestore();
            const userDoc = await db.collection('users').doc(currentUserId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.photo) {
                    userPhoto = userData.photo;
                    console.log('✅ Found user photo for comment form:', userData.photo);
                }
            }
        } catch (error) {
            console.warn('⚠️ Error fetching user photo for comment form:', error);
        }
    }
    
    // Set avatar
    if (userPhoto) {
        avatarElement.innerHTML = `<img src="${userPhoto}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`;
        console.log('🖼️ Set user avatar in comment form');
    } else {
        const displayName = user.displayName || user.name || user.email || 'U';
        avatarElement.innerHTML = `<div class="avatar-placeholder" style="width: 40px; height: 40px; border-radius: 50%; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">${displayName.charAt(0).toUpperCase()}</div>`;
        console.log('🔤 Set user avatar placeholder in comment form');
    }
}

// Setup comment UI based on authentication state
function setupCommentUI() {
    console.log('🎨 Setting up comment UI for user:', currentUserId);
    
    const userAvatar = document.getElementById('commentUserAvatar');
    const userName = document.getElementById('commentUserName');
    const commentText = document.getElementById('commentText');
    const submitBtn = document.querySelector('.btn-comment-submit');
    
    // Get user from multiple possible sources
    const user = window.currentUser || window.firebaseAuth?.currentUser;
    
    if (currentUserId && user) {
        console.log('👤 Setting up UI for logged in user:', user.displayName || user.email);
        
        // User is logged in
        // Update avatar - fetch from users collection for better accuracy
        if (userAvatar) {
            setupUserAvatar(userAvatar, user);
        }
        
        // Update name
        if (userName) {
            userName.textContent = user.displayName || user.name || user.email || 'Người dùng';
            userName.style.cursor = 'default';
            userName.onclick = null;
        }
        
        // Enable comment form
        if (commentText) {
            commentText.disabled = false;
            commentText.placeholder = 'Chia sẻ ý kiến của bạn về sản phẩm này...';
        }
        
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    } else {
        console.log('👤 Setting up UI for guest user - allowing guest comments');
        
        // User is not logged in - allow guest comments
        if (userAvatar) {
            userAvatar.innerHTML = '<div class="avatar-placeholder">U</div>';
        }
        
        if (userName) {
            userName.textContent = 'Người Dùng';
            userName.style.cursor = 'default';
            userName.onclick = null;
        }
        
        if (commentText) {
            commentText.disabled = false;
            commentText.placeholder = 'Chia sẻ ý kiến của bạn (với tư cách Người Dùng)...';
        }
        
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }
}

// Refresh comment UI when auth state changes
function refreshCommentUIOnAuthChange() {
    console.log('🔄 Refreshing comment UI due to auth change');
    
    // Re-check auth state
    const user = window.currentUser || window.firebaseAuth?.currentUser;
    if (user && user.uid) {
        currentUserId = user.uid;
    } else {
        currentUserId = null;
    }
    
    // Update UI for both comments and ratings
    setupCommentUI();
    setupRatingUI();
    console.log('✅ Both comment and rating UI refreshed for auth change');
}

// Initialize WebSocket connection for real-time updates
function initializeWebSocket() {
    // For now, we'll use Firebase real-time listeners for real-time updates
    // WebSocket can be added later for additional real-time features
    console.log('🔌 WebSocket initialization (using Firebase real-time listeners for comments and ratings)');
    
    // Setup cross-tab synchronization for ratings
    setupCrossTabSync();
}

// Setup cross-tab synchronization for real-time updates
function setupCrossTabSync() {
    // Listen for storage events from other tabs
    window.addEventListener('storage', (event) => {
        if (event.key === 'ratingUpdate' && event.newValue) {
            const updateData = JSON.parse(event.newValue);
            if (updateData.productId === currentProductId) {
                console.log('📡 Cross-tab rating update received:', updateData);
                // Reload ratings from Firebase to sync
                loadRatings();
            }
        }
        
        if (event.key === 'commentUpdate' && event.newValue) {
            const updateData = JSON.parse(event.newValue);
            if (updateData.productId === currentProductId) {
                console.log('📡 Cross-tab comment update received:', updateData);
                // This would be handled by the existing comment system
            }
        }
    });
}

// Broadcast rating update to other tabs
function broadcastRatingUpdate(updateType, ratingData) {
    const updateData = {
        type: updateType, // 'add', 'update', 'delete'
        productId: currentProductId,
        ratingId: ratingData?.id,
        userId: currentUserId,
        timestamp: Date.now()
    };
    
    localStorage.setItem('ratingUpdate', JSON.stringify(updateData));
    
    // Remove the item immediately to ensure the storage event fires for next update
    setTimeout(() => {
        localStorage.removeItem('ratingUpdate');
    }, 100);
    
    console.log('📢 Broadcasting rating update to other tabs:', updateData);
}

// Setup Firebase real-time listener for comments
function setupFirebaseCommentsListener() {
    if (!window.firebase?.firestore) {
        console.warn('⚠️ Firebase not available, skipping real-time listener');
        return;
    }
    
    // Stop existing listener if any
    if (commentsListener) {
        commentsListener();
        commentsListener = null;
    }
    
    const db = window.firebase.firestore();
    
    console.log('🎧 Setting up real-time comments listener for product:', currentProductId);
    
    // Listen to comments collection for this product
    commentsListener = db.collection('comments')
        .where('productId', '==', currentProductId)
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            console.log('📨 Comments snapshot received:', snapshot.size, 'comments');
            
            const comments = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                comments.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date()
                });
            });
            
            // Update local comments data
            commentsData = comments;
            
            // Re-render comments
            renderComments();
            
            // Update comments count
            updateCommentsCount();
            
        }, (error) => {
            console.error('❌ Error listening to comments:', error);
        });
}

// Load comments from Firebase
async function loadComments() {
    if (!window.firebase?.firestore || isLoadingComments) {
        return;
    }
    
    isLoadingComments = true;
    
    try {
        console.log('📥 Loading comments for product:', currentProductId);
        
        const db = window.firebase.firestore();
        
        const snapshot = await db.collection('comments')
            .where('productId', '==', currentProductId)
            .orderBy('createdAt', 'desc')
            .limit(commentsPerPage)
            .get();
        
        const comments = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            comments.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date()
            });
        });
        
        commentsData = comments;
        renderComments();
        updateCommentsCount();
        
        console.log('✅ Comments loaded successfully:', comments.length);
        
    } catch (error) {
        console.error('❌ Error loading comments:', error);
        showCommentError('Không thể tải bình luận. Vui lòng thử lại.');
    } finally {
        isLoadingComments = false;
    }
}

// Render comments in the UI
function renderComments() {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;
    
    if (commentsData.length === 0) {
        commentsList.innerHTML = `
            <div class="comments-placeholder">
                <p style="text-align: center; color: #666; padding: 3rem 1rem;">
                    <i class="fas fa-comment-dots" style="font-size: 3rem; margin-bottom: 1rem; display: block; color: #667eea;"></i>
                    Chưa có bình luận nào cho sản phẩm này.<br>
                    Hãy là người đầu tiên chia sẻ ý kiến của bạn!
                </p>
            </div>
        `;
        return;
    }
    
    // Build a nested comment structure
    const commentTree = buildCommentTree(commentsData);
    
    let commentsHTML = '';
    
    commentTree.forEach(comment => {
        commentsHTML += renderCommentWithNestedReplies(comment);
    });
    
    // Wrap comments in a scrollable inner container
    commentsList.innerHTML = `
        <div class="comments-list-inner">
            ${commentsHTML}
        </div>
    `;
    
    // Add scroll indicator if content overflows - with delay to ensure DOM is updated
    setTimeout(() => {
        addScrollIndicator(commentsList);
        
        // Setup horizontal scrolling for nested comments
        setupNestedCommentScrolling();
        
        // Setup comment detail popup handlers for new comments
        setupSimpleCommentClickHandlers();
        
        // Debug scroll state
        const innerContainer = commentsList.querySelector('.comments-list-inner');
        if (innerContainer) {
            console.log('🔍 Scroll Debug Info:', {
                containerHeight: commentsList.clientHeight + 'px',
                contentHeight: innerContainer.scrollHeight + 'px',
                maxHeight: getComputedStyle(commentsList).maxHeight,
                overflow: innerContainer.scrollHeight > commentsList.clientHeight ? 'YES - CAN SCROLL' : 'NO - FITS',
                commentsCount: commentsData.length,
                scrollTop: commentsList.scrollTop,
                scrollable: commentsList.scrollHeight > commentsList.clientHeight
            });
            
            // Force test scroll if content should overflow
            if (innerContainer.scrollHeight > commentsList.clientHeight) {
                console.log('🎯 Content overflows! Adding scroll indicators...');
                commentsList.classList.add('has-scroll');
            } else {
                console.log('⚠️ Content fits! No scroll needed.');
                commentsList.classList.remove('has-scroll');
            }
        }
    }, 200);
}

// Build a tree structure for nested comments
function buildCommentTree(comments) {
    const commentMap = new Map();
    const rootComments = [];
    
    // First pass: create a map of all comments
    comments.forEach(comment => {
        commentMap.set(comment.id, { ...comment, children: [] });
    });
    
    // Second pass: build the tree structure
    comments.forEach(comment => {
        if (comment.isChild && comment.parentId) {
            // This is a reply, find its parent
            const parent = commentMap.get(comment.parentId);
            if (parent) {
                parent.children.push(commentMap.get(comment.id));
            } else {
                // Parent not found, treat as root comment
                rootComments.push(commentMap.get(comment.id));
            }
        } else {
            // This is a root comment
            rootComments.push(commentMap.get(comment.id));
        }
    });
    
    return rootComments;
}

// Add scroll indicator and smooth scrolling behavior
function addScrollIndicator(commentsList) {
    // Remove existing indicator
    const existingIndicator = commentsList.querySelector('.scroll-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // Check if content overflows
    const innerContainer = commentsList.querySelector('.comments-list-inner');
    if (!innerContainer) return;
    
    const hasOverflow = innerContainer.scrollHeight > commentsList.clientHeight;
    
    // Add or remove has-scroll class for CSS styling
    if (hasOverflow) {
        commentsList.classList.add('has-scroll');
        console.log('📏 Comments list is scrollable:', {
            containerHeight: commentsList.clientHeight,
            contentHeight: innerContainer.scrollHeight,
            scrollTop: commentsList.scrollTop
        });
    } else {
        commentsList.classList.remove('has-scroll');
        console.log('📏 Comments list fits without scrolling');
    }
    
    if (hasOverflow) {
        // Add scroll event listener to hide indicator when scrolled to bottom
        const handleScroll = debounce(function() {
            const isScrolledToBottom = 
                commentsList.scrollTop + commentsList.clientHeight >= 
                commentsList.scrollHeight - 10; // 10px threshold
            
            if (isScrolledToBottom) {
                commentsList.classList.remove('has-scroll');
            } else {
                commentsList.classList.add('has-scroll');
            }
        }, 100);
        
        // Remove existing scroll listener to avoid duplicates
        commentsList.removeEventListener('scroll', commentsList._scrollHandler);
        
        // Add new scroll listener
        commentsList._scrollHandler = handleScroll;
        commentsList.addEventListener('scroll', handleScroll);
        
        // Smooth scroll behavior enhancement
        commentsList.style.scrollBehavior = 'smooth';
    }
}

// Debounce function for scroll events
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

// Check if current user is admin
function isCurrentUserAdmin() {
    const user = window.currentUser || window.firebaseAuth?.currentUser;
    
    if (!user) {
        console.log('❌ No user found for admin check');
        return false;
    }
    
    // Check if user has admin role from multiple sources
    // Method 1: Check from Firebase custom claims (recommended)
    if (user.customClaims && user.customClaims.admin === true) {
        console.log('✅ Admin detected via customClaims');
        return true;
    }
    
    // Method 2: Check from global variable (set during login)
    if (window.isAdmin === true) {
        console.log('✅ Admin detected via window.isAdmin');
        return true;
    }
    
    // Method 3: Check from user object property (camelCase)
    if (user.isAdmin === true) {
        console.log('✅ Admin detected via user.isAdmin');
        return true;
    }
    
    // Method 4: Check from user object property (snake_case) ⭐ NEW
    if (user.is_admin === true) {
        console.log('✅ Admin detected via user.is_admin');
        return true;
    }
    
    // Method 5: Check from window.currentUser (camelCase)
    if (window.currentUser && window.currentUser.isAdmin === true) {
        console.log('✅ Admin detected via window.currentUser.isAdmin');
        return true;
    }
    
    // Method 6: Check from window.currentUser (snake_case) ⭐ NEW
    if (window.currentUser && window.currentUser.is_admin === true) {
        console.log('✅ Admin detected via window.currentUser.is_admin');
        return true;
    }
    
    // Method 7: Check from localStorage (backup)
    try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const userData = JSON.parse(storedUser);
            if (userData.isAdmin === true || userData.is_admin === true) {
                console.log('✅ Admin detected via localStorage');
                return true;
            }
        }
    } catch (error) {
        // Ignore localStorage errors
    }
    
    console.log('❌ Admin check failed - user is not admin', { 
        userId: user.uid || user.id,
        hasCustomClaims: !!user.customClaims,
        windowIsAdmin: window.isAdmin,
        userIsAdmin: user.isAdmin,
        userIsAdminSnake: user.is_admin,
        currentUserIsAdmin: window.currentUser?.isAdmin,
        currentUserIsAdminSnake: window.currentUser?.is_admin
    });
    return false;
}

// Helper function to set admin status (call this after login)
window.setAdminStatus = function(isAdmin) {
    window.isAdmin = isAdmin;
    console.log('🔐 Admin status set to:', isAdmin);
    
    // Re-render comments to show/hide delete buttons
    if (commentsData && commentsData.length > 0) {
        console.log('🔄 Re-rendering comments after admin status change...');
        renderComments();
    }
};

// Watch for window.currentUser changes and re-render if admin status changes
let lastAdminStatus = false;
setInterval(() => {
    if (window.currentUser) {
        // Check both isAdmin and is_admin properties
        const currentAdminStatus = (window.currentUser.isAdmin === true) || (window.currentUser.is_admin === true);
        if (currentAdminStatus !== lastAdminStatus) {
            console.log('🔄 Admin status changed from', lastAdminStatus, 'to', currentAdminStatus);
            lastAdminStatus = currentAdminStatus;
            
            // Re-render comments to update delete buttons
            if (commentsData && commentsData.length > 0) {
                console.log('🔄 Re-rendering comments after admin status detection...');
                renderComments();
            }
        }
    }
}, 500); // Check every 500ms

// Render individual comment with nested replies (new function)
function renderCommentWithNestedReplies(comment, isReply = false) {
    const timeAgo = getTimeAgo(comment.createdAt);
    
    // Only allow deletion if:
    // 1. User is admin (can delete any comment)
    // 2. User owns the comment AND comment has a userId (not a guest comment)
    const isAdmin = isCurrentUserAdmin();
    const ownsComment = currentUserId && comment.userId && currentUserId === comment.userId;
    const canDelete = isAdmin || ownsComment;
    
    // Debug logging for delete button visibility
    console.log('🔍 Render comment delete check:', {
        commentId: comment.id,
        isGuest: !comment.userId,
        isAdmin,
        ownsComment,
        canDelete,
        currentUserId,
        commentUserId: comment.userId
    });
    
    const userAvatar = comment.userAvatar 
        ? `<img src="${comment.userAvatar}" alt="Avatar" class="comment-avatar">`
        : `<div class="comment-avatar-placeholder">${comment.userDisplayName ? comment.userDisplayName.charAt(0).toUpperCase() : 'U'}</div>`;
    
    // Recursively render children
    let childrenHTML = '';
    if (comment.children && comment.children.length > 0) {
        childrenHTML = comment.children.map(child => 
            renderCommentWithNestedReplies(child, true)
        ).join('');
    }
    
    const containerClass = isReply ? 'comment-reply' : 'comment-item';
    const parentIdAttr = comment.parentId ? ` data-parent-id="${comment.parentId}"` : '';
    
    // Determine user badge
    const isCommentByAdmin = comment.isAdmin === true;
    const isGuestComment = !comment.userId;
    let userBadge = '';
    
    if (isCommentByAdmin) {
        userBadge = '<span style="background: linear-gradient(135deg, #ec4899, #8b5cf6); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; margin-left: 6px;">Admin</span>';
    } else if (isGuestComment) {
        userBadge = '<span style="background: #e5e7eb; color: #6b7280; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; margin-left: 6px;">Khách</span>';
    }
    
    return `
        <div class="${containerClass}" data-comment-id="${comment.id}"${parentIdAttr}">
            <div class="comment-content">
                <div class="comment-header">
                    <div class="comment-user">
                        ${userAvatar}
                        <div class="comment-user-info">
                            <span class="comment-username">${comment.userDisplayName || 'Người dùng'}${userBadge}</span>
                            <span class="comment-time">${timeAgo}</span>
                        </div>
                    </div>
                    <div class="comment-actions">
                        <button class="btn-reply-comment" onclick="showReplyForm('${comment.id}')" title="Trả lời">
                            <i class="fas fa-reply"></i>
                        </button>
                        ${canDelete ? `
                            <button class="btn-delete-comment" onclick="deleteComment('${comment.id}')" title="Xóa bình luận">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="comment-text">${escapeHtml(comment.content)}</div>
                
                <!-- Reply Form (hidden by default) -->
                <div class="reply-form" id="replyForm-${comment.id}" style="display: none;">
                    <div class="reply-input-group">
                        <textarea id="replyText-${comment.id}" placeholder="Viết câu trả lời..." rows="2"></textarea>
                        <div class="reply-actions">
                            <button type="button" class="btn-reply-cancel" onclick="hideReplyForm('${comment.id}')">
                                Hủy
                            </button>
                            <button type="button" class="btn-reply-submit" onclick="submitReply('${comment.id}')">
                                Trả lời
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Nested Children -->
                ${childrenHTML ? `<div class="comment-replies">${childrenHTML}</div>` : ''}
            </div>
        </div>
    `;
}

// Legacy function - keep for compatibility but redirect to new function
function renderComment(comment, replies = []) {
    // Convert old format to new tree structure
    const commentWithChildren = { ...comment, children: replies };
    return renderCommentWithNestedReplies(commentWithChildren);
}

// Setup event listeners
function setupEventListeners() {
    // Comment form submission
    const commentForm = document.getElementById('commentForm');
    if (commentForm) {
        commentForm.addEventListener('submit', handleCommentSubmit);
    }
    
    // Clear comment button
    window.clearComment = clearComment;
    
    // Global functions for comment interactions
    window.showReplyForm = showReplyForm;
    window.hideReplyForm = hideReplyForm;
    window.submitReply = submitReply;
    window.deleteComment = deleteComment;
    window.loadMoreComments = loadMoreComments;
}

// Handle comment form submission
async function handleCommentSubmit(event) {
    event.preventDefault();
    
    // Allow comments from both logged in and guest users
    const commentText = document.getElementById('commentText');
    const submitBtn = document.querySelector('.btn-comment-submit');
    
    if (!commentText || !commentText.value.trim()) {
        showCommentError('Vui lòng nhập nội dung bình luận');
        return;
    }
    
    const content = commentText.value.trim();
    
    // Disable form during submission
    commentText.disabled = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
    
    try {
        await submitComment(content);
        
        // Clear form
        commentText.value = '';
        showCommentSuccess('Bình luận đã được gửi thành công!');
        
        // Scroll to the new comment after a short delay
        setTimeout(() => {
            scrollToLatestComment();
        }, 500);
        
    } catch (error) {
        console.error('❌ Error submitting comment:', error);
        showCommentError('Không thể gửi bình luận. Vui lòng thử lại.');
    } finally {
        // Re-enable form
        commentText.disabled = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi bình luận';
    }
}

// Submit a new comment to Firebase
async function submitComment(content, parentId = null) {
    if (!window.firebase?.firestore) {
        throw new Error('Firebase not available');
    }
    
    const db = window.firebase.firestore();
    const user = window.currentUser || window.firebaseAuth?.currentUser;
    
    // Determine if user is logged in or guest
    const isGuest = !currentUserId || !user;
    
    let userPhoto = null;
    let displayName = 'Người Dùng';
    let userId = null;
    
    if (!isGuest) {
        // Logged in user - get user data
        userId = currentUserId;
        displayName = user.displayName || user.email || 'Người dùng';
        userPhoto = user.photoURL || null;
        
        console.log('🔍 Fetching user photo from users collection for userId:', userId);
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.photo) {
                    userPhoto = userData.photo;
                    console.log('✅ Found user photo in users collection:', userData.photo);
                } else {
                    console.log('📷 No photo found in users collection, using photoURL fallback');
                }
            } else {
                console.log('👤 User document not found in users collection, using photoURL fallback');
            }
        } catch (error) {
            console.warn('⚠️ Error fetching user photo from users collection:', error);
            // Continue with photoURL fallback
        }
    } else {
        // Guest user
        console.log('👤 Guest user submitting comment');
    }
    
    // Check if current user is admin
    const isAdmin = isCurrentUserAdmin();
    
    const commentData = {
        productId: currentProductId,
        userId: userId,
        userDisplayName: displayName,
        userAvatar: userPhoto,
        isAdmin: isAdmin, // Store admin status
        content: content,
        isChild: !!parentId,
        parentId: parentId || null,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    };
    
    console.log('📤 Submitting comment:', {
        userId: commentData.userId || 'null (guest)',
        userDisplayName: commentData.userDisplayName,
        userAvatar: commentData.userAvatar ? '✅ Has avatar' : '❌ No avatar',
        isAdmin: commentData.isAdmin,
        content: commentData.content?.substring(0, 50) + '...',
        isGuest: isGuest
    });
    
    const docRef = await db.collection('comments').add(commentData);
    
    console.log('✅ Comment submitted with ID:', docRef.id);
    
    return docRef.id;
}

// Show reply form for a comment
function showReplyForm(commentId) {
    // Allow both logged in users and guests to reply
    
    // Hide all other reply forms
    document.querySelectorAll('.reply-form').forEach(form => {
        form.style.display = 'none';
    });
    
    // Show the specific reply form
    const replyForm = document.getElementById(`replyForm-${commentId}`);
    if (replyForm) {
        replyForm.style.display = 'block';
        const textarea = document.getElementById(`replyText-${commentId}`);
        if (textarea) {
            textarea.focus();
        }
    }
}

// Hide reply form
function hideReplyForm(commentId) {
    const replyForm = document.getElementById(`replyForm-${commentId}`);
    if (replyForm) {
        replyForm.style.display = 'none';
        // Clear textarea
        const textarea = document.getElementById(`replyText-${commentId}`);
        if (textarea) {
            textarea.value = '';
        }
    }
}

// Submit a reply to a comment
async function submitReply(parentId) {
    const textarea = document.getElementById(`replyText-${parentId}`);
    if (!textarea || !textarea.value.trim()) {
        showCommentError('Vui lòng nhập nội dung trả lời');
        return;
    }
    
    const content = textarea.value.trim();
    
    // Disable form during submission
    textarea.disabled = true;
    
    try {
        const newReplyId = await submitComment(content, parentId);
        
        // Hide reply form and clear content
        hideReplyForm(parentId);
        showCommentSuccess('Trả lời đã được gửi thành công!');
        
        // Scroll to the parent comment after a short delay to see the new reply
        setTimeout(() => {
            scrollToComment(parentId);
        }, 500);
        
    } catch (error) {
        console.error('❌ Error submitting reply:', error);
        showCommentError('Không thể gửi trả lời. Vui lòng thử lại.');
    } finally {
        textarea.disabled = false;
    }
}

// Delete a comment and all its nested replies
async function deleteComment(commentId) {
    if (!window.firebase?.firestore) {
        showCommentError('Lỗi hệ thống. Vui lòng thử lại.');
        return;
    }
    
    const db = window.firebase.firestore();
    
    // Check permissions: must be admin OR owner of the comment (and not a guest comment)
    const isAdmin = isCurrentUserAdmin();
    
    console.log('🔐 Delete permission check:', {
        isAdmin,
        currentUserId,
        commentId
    });
    
    // If NOT admin, verify ownership first
    if (!isAdmin) {
        // If not admin, check if user owns the comment
        if (!currentUserId) {
            showCommentError('Bạn không có quyền xóa bình luận này.');
            return;
        }
        
        // Verify ownership by fetching the comment
        try {
            const commentDoc = await db.collection('comments').doc(commentId).get();
            if (!commentDoc.exists) {
                showCommentError('Bình luận không tồn tại.');
                return;
            }
            
            const commentData = commentDoc.data();
            
            // Guest comments (userId = null) can only be deleted by admin
            if (!commentData.userId) {
                showCommentError('Chỉ admin mới có thể xóa bình luận của khách.');
                return;
            }
            
            // Check if user owns this comment
            if (commentData.userId !== currentUserId) {
                showCommentError('Bạn không có quyền xóa bình luận này.');
                return;
            }
            
            console.log('✅ User owns the comment - deletion allowed');
        } catch (error) {
            console.error('❌ Error checking comment ownership:', error);
            showCommentError('Không thể xác thực quyền sở hữu.');
            return;
        }
    } else {
        console.log('✅ User is admin - deletion allowed for any comment');
    }
    
    if (!confirm('Bạn có chắc chắn muốn xóa bình luận này? Tất cả các trả lời sẽ bị xóa theo.')) {
        return;
    }
    
    try {
        // Recursively delete all nested replies
        await deleteCommentAndChildren(commentId, db);
        
        showCommentSuccess('Bình luận đã được xóa');
        
    } catch (error) {
        console.error('❌ Error deleting comment:', error);
        showCommentError('Không thể xóa bình luận. Vui lòng thử lại.');
    }
}

// Recursively delete a comment and all its children
async function deleteCommentAndChildren(commentId, db) {
    // First, find all direct children of this comment
    const childrenSnapshot = await db.collection('comments')
        .where('parentId', '==', commentId)
        .get();
    
    // Create a batch for all deletions
    const batch = db.batch();
    
    // Recursively delete children first
    for (const childDoc of childrenSnapshot.docs) {
        await deleteCommentAndChildren(childDoc.id, db);
    }
    
    // Delete the comment itself
    const commentRef = db.collection('comments').doc(commentId);
    batch.delete(commentRef);
    
    // Commit the deletion
    await batch.commit();
}

// Clear comment form
function clearComment() {
    const commentText = document.getElementById('commentText');
    if (commentText) {
        commentText.value = '';
        commentText.focus();
    }
}

// Load more comments (pagination)
async function loadMoreComments() {
    // Implementation for pagination if needed
    console.log('Loading more comments...');
}

// Update comments count
function updateCommentsCount() {
    const countElement = document.getElementById('comments-total');
    if (countElement) {
        countElement.textContent = commentsData.length;
    }
}

// Utility functions
function getTimeAgo(date) {
    if (!date) return 'Vừa xong';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'Vừa xong';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} phút trước`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} giờ trước`;
    } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} ngày trước`;
    } else {
        return date.toLocaleDateString('vi-VN');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showCommentSuccess(message) {
    // Use existing notification system
    if (typeof showNotification === 'function') {
        showNotification(message, 'success');
    } else {
        alert(message);
    }
}

function showCommentError(message) {
    // Use existing notification system
    if (typeof showNotification === 'function') {
        showNotification(message, 'error');
    } else {
        alert(message);
    }
}

// Scroll to the latest comment smoothly
function scrollToLatestComment() {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;
    
    // Add smooth scroll class
    commentsList.classList.add('new-comment-added');
    
    // Scroll to top to see the newest comment (since comments are sorted by newest first)
    commentsList.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    
    // Remove the class after animation
    setTimeout(() => {
        commentsList.classList.remove('new-comment-added');
    }, 1000);
}

// Scroll to a specific comment (useful for replies)
function scrollToComment(commentId) {
    const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
    const commentsList = document.getElementById('commentsList');
    
    if (!commentElement || !commentsList) return;
    
    // Calculate the position relative to the scrollable container
    const containerRect = commentsList.getBoundingClientRect();
    const elementRect = commentElement.getBoundingClientRect();
    const scrollTop = commentsList.scrollTop;
    
    const targetScroll = scrollTop + (elementRect.top - containerRect.top) - 20; // 20px offset
    
    commentsList.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
    });
    
    // Highlight the comment briefly
    commentElement.style.transition = 'all 0.3s ease';
    commentElement.style.backgroundColor = '#e0f2fe';
    commentElement.style.borderColor = '#0ea5e9';
    
    setTimeout(() => {
        commentElement.style.backgroundColor = '';
        commentElement.style.borderColor = '';
    }, 2000);
}

// Cleanup function
function cleanupCommentSystem() {
    if (commentsListener) {
        commentsListener();
        commentsListener = null;
    }
    
    if (ratingsListener) {
        ratingsListener();
        ratingsListener = null;
    }
    
    if (commentsSocket) {
        commentsSocket.close();
        commentsSocket = null;
    }
}

// Clean up when page unloads
window.addEventListener('beforeunload', cleanupCommentSystem);

// =====================================
// RATING SYSTEM FUNCTIONS
// =====================================

// Setup Firebase real-time listener for ratings
function setupFirebaseRatingsListener() {
    if (!window.firebase?.firestore) {
        console.warn('⚠️ Firebase firestore not available for ratings');
        return;
    }
    
    // Stop existing listener if any
    if (ratingsListener) {
        ratingsListener();
        ratingsListener = null;
    }
    
    const db = window.firebase.firestore();
    
    console.log('🎧 Setting up real-time ratings listener for product:', currentProductId);
    
    // Listen to ratings collection for this product
    ratingsListener = db.collection('ratings')
        .where('productId', '==', currentProductId)
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            console.log('📡 Ratings snapshot received:', snapshot.size, 'ratings');
            
            // Process rating changes
            snapshot.docChanges().forEach((change) => {
                console.log(`📊 Rating ${change.type}:`, change.doc.id);
            });
            
            // Update ratings data
            ratingsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date()
            }));
            
            // Render ratings
            renderRatings();
            updateRatingSummary();
            
        }, (error) => {
            console.error('❌ Error listening to ratings:', error);
        });
}

// Load ratings from Firebase
async function loadRatings() {
    if (!window.firebase?.firestore || isLoadingRatings) {
        return;
    }
    
    isLoadingRatings = true;
    console.log('📥 Loading ratings for product:', currentProductId);
    
    try {
        const db = window.firebase.firestore();
        const ratingsSnapshot = await db.collection('ratings')
            .where('productId', '==', currentProductId)
            .orderBy('createdAt', 'desc')
            .get();
        
        ratingsData = ratingsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date()
        }));
        
        console.log('✅ Loaded ratings:', ratingsData.length);
        
        // IMPORTANT: Reset userRating before checking
        userRating = null;
        
        // Check if current user has already rated THIS SPECIFIC product
        if (currentUserId) {
            userRating = ratingsData.find(rating => 
                rating.userId === currentUserId && 
                rating.productId === currentProductId
            );
            
            if (userRating) {
                console.log('👤 User has existing rating for this product:', userRating.stars, 'stars');
                // Update UI to show existing rating
                updateUIWithExistingRating(userRating);
            } else {
                console.log('👤 User has NOT rated this product yet');
            }
        }
        
        renderRatings();
        updateRatingSummary();
        
    } catch (error) {
        console.error('❌ Error loading ratings:', error);
    } finally {
        isLoadingRatings = false;
    }
}

// Update UI with user's existing rating
function updateUIWithExistingRating(rating) {
    console.log('🔄 Updating UI with existing rating:', rating);
    
    const ratingForm = document.getElementById('ratingForm');
    const ratingContent = document.getElementById('ratingContent');
    const submitBtn = document.querySelector('.btn-rating-submit');
    const starInput = document.getElementById('starInput');
    
    if (!ratingForm || !rating) {
        console.warn('⚠️ Cannot update UI - form or rating not found');
        return;
    }
    
    // Remove any existing notice first
    let existingNotice = ratingForm.querySelector('.existing-rating-notice');
    if (existingNotice) {
        existingNotice.remove();
    }
    
    // Add a notice that user has already rated
    existingNotice = document.createElement('div');
    existingNotice.className = 'existing-rating-notice';
    existingNotice.style.cssText = `
        background: #fef3cd;
        border: 1px solid #fde68a;
        color: #92400e;
        padding: 0.75rem;
        border-radius: 6px;
        margin-bottom: 1rem;
        font-size: 0.9rem;
    `;
    
    existingNotice.innerHTML = `
        <i class="fas fa-info-circle"></i>
        Bạn đã đánh giá sản phẩm này ${rating.stars} sao. Bạn có thể cập nhật đánh giá của mình.
    `;
    
    // Insert notice at the beginning of the form
    ratingForm.insertBefore(existingNotice, ratingForm.firstChild);
    
    // Pre-fill the form with existing rating
    selectedRating = rating.stars;
    selectStars(selectedRating);
    
    // IMPORTANT: Enable textarea for editing
    if (ratingContent) {
        ratingContent.value = rating.content || '';
        ratingContent.disabled = false; // ← Enable textarea
        ratingContent.placeholder = 'Chia sẻ đánh giá chi tiết về sản phẩm này...';
    }
    
    // Enable star input for editing
    if (starInput) {
        starInput.style.pointerEvents = 'auto';
        starInput.style.opacity = '1';
    }
    
    // Enable submit button
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-edit"></i> Cập nhật đánh giá';
    }
    
    console.log('✅ UI updated with existing rating - form enabled for editing');
}

// Render ratings in the UI
function renderRatings() {
    const ratingsList = document.getElementById('ratingsList');
    const ratingsLoading = document.getElementById('ratingsLoading');
    
    if (!ratingsList) return;
    
    // Hide loading indicator
    if (ratingsLoading) {
        ratingsLoading.style.display = 'none';
    }
    
    if (ratingsData.length === 0) {
        ratingsList.innerHTML = `
            <div class="no-ratings">
                <i class="fas fa-star" style="font-size: 3rem; color: #ddd; margin-bottom: 1rem;"></i>
                <p>Chưa có đánh giá nào cho sản phẩm này</p>
                <p>Hãy là người đầu tiên đánh giá!</p>
            </div>
        `;
        return;
    }
    
    let ratingsHTML = '';
    
    ratingsData.forEach(rating => {
        ratingsHTML += renderRatingItem(rating);
    });
    
    ratingsList.innerHTML = ratingsHTML;
}

// Render individual rating item
function renderRatingItem(rating) {
    const timeAgo = getTimeAgo(rating.createdAt);
    const canDelete = currentUserId === rating.userId;
    
    const userAvatar = rating.userAvatar 
        ? `<img src="${rating.userAvatar}" alt="Avatar" class="user-avatar">`
        : `<div class="avatar-placeholder">${rating.userDisplayName ? rating.userDisplayName.charAt(0).toUpperCase() : 'U'}</div>`;
    
    // Generate stars display
    let starsHTML = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating.stars) {
            starsHTML += '<i class="fas fa-star"></i>';
        } else {
            starsHTML += '<i class="far fa-star"></i>';
        }
    }
    
    return `
        <div class="rating-item" data-rating-id="${rating.id}">
            <div class="rating-header">
                <div class="rating-user">
                    ${userAvatar}
                    <div class="rating-user-info">
                        <h5>${rating.userDisplayName || 'Người dùng'}</h5>
                        <div class="rating-time">${timeAgo}</div>
                    </div>
                </div>
                <div class="rating-stars">
                    ${starsHTML}
                </div>
            </div>
            <div class="rating-content">${escapeHtml(rating.content || '')}</div>
            ${canDelete ? `
                <div class="rating-actions">
                    <button class="btn-delete-rating" onclick="deleteRating('${rating.id}')" title="Xóa đánh giá">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// Update rating summary (average, distribution)
function updateRatingSummary() {
    const averageRatingElement = document.getElementById('averageRating');
    const averageStarsElement = document.getElementById('averageStars');
    const reviewCountElement = document.getElementById('reviewCount');
    const ratingDistribution = document.getElementById('ratingDistribution');
    
    if (ratingsData.length === 0) {
        if (averageRatingElement) averageRatingElement.textContent = '0.0';
        if (reviewCountElement) reviewCountElement.textContent = '(0 đánh giá)';
        if (averageStarsElement) {
            averageStarsElement.innerHTML = Array(5).fill('<i class="far fa-star"></i>').join('');
        }
        
        // Reset distribution bars
        if (ratingDistribution) {
            const bars = ratingDistribution.querySelectorAll('.rating-fill');
            const counts = ratingDistribution.querySelectorAll('.rating-count');
            bars.forEach(bar => bar.style.width = '0%');
            counts.forEach(count => count.textContent = '0');
        }
        return;
    }
    
    // Calculate average rating
    const totalStars = ratingsData.reduce((sum, rating) => sum + rating.stars, 0);
    const averageRating = (totalStars / ratingsData.length).toFixed(1);
    
    // Update average rating display
    if (averageRatingElement) {
        averageRatingElement.textContent = averageRating;
    }
    
    if (reviewCountElement) {
        reviewCountElement.textContent = `(${ratingsData.length} đánh giá)`;
    }
    
    // Update average stars display
    if (averageStarsElement) {
        const fullStars = Math.floor(averageRating);
        const hasHalfStar = averageRating % 1 >= 0.5;
        
        let starsHTML = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                starsHTML += '<i class="fas fa-star"></i>';
            } else if (i === fullStars + 1 && hasHalfStar) {
                starsHTML += '<i class="fas fa-star-half-alt"></i>';
            } else {
                starsHTML += '<i class="far fa-star"></i>';
            }
        }
        averageStarsElement.innerHTML = starsHTML;
    }
    
    // Update rating distribution
    if (ratingDistribution) {
        const distribution = [0, 0, 0, 0, 0]; // Index 0 = 1 star, Index 4 = 5 stars
        
        ratingsData.forEach(rating => {
            if (rating.stars >= 1 && rating.stars <= 5) {
                distribution[rating.stars - 1]++;
            }
        });
        
        // Update bars and counts
        for (let i = 0; i < 5; i++) {
            const percentage = ratingsData.length > 0 ? (distribution[i] / ratingsData.length) * 100 : 0;
            const stars = i + 1;
            
            const bar = ratingDistribution.querySelector(`[data-stars="${stars}"] .rating-fill`);
            const count = ratingDistribution.querySelector(`[data-stars="${stars}"]`).parentElement.querySelector('.rating-count');
            
            if (bar) bar.style.width = `${percentage}%`;
            if (count) count.textContent = distribution[i].toString();
        }
    }
    
    // Also update the product header rating at the top of the page
    updateProductHeaderRating();
}

// Update product header rating (at the top of product detail page)
function updateProductHeaderRating() {
    const headerStarsElement = document.getElementById('productHeaderStars');
    const headerReviewCountElement = document.getElementById('productHeaderReviewCount');
    
    if (!headerStarsElement || !headerReviewCountElement) {
        console.log('⚠️ Product header rating elements not found');
        return;
    }
    
    // Add a subtle fade effect for smooth transition
    const addFadeEffect = () => {
        headerStarsElement.style.transition = 'opacity 0.3s ease';
        headerReviewCountElement.style.transition = 'opacity 0.3s ease';
        headerStarsElement.style.opacity = '0.5';
        headerReviewCountElement.style.opacity = '0.5';
        
        setTimeout(() => {
            headerStarsElement.style.opacity = '1';
            headerReviewCountElement.style.opacity = '1';
        }, 150);
    };
    
    // Check if there are any ratings
    if (!ratingsData || ratingsData.length === 0) {
        // NO RATINGS: Show empty stars (far fa-star) and "0 đánh giá"
        const emptyStarsHTML = Array(5).fill('<i class="far fa-star"></i>').join('');
        
        addFadeEffect();
        headerStarsElement.innerHTML = emptyStarsHTML;
        headerReviewCountElement.textContent = '(0 đánh giá)';
        
        console.log('✅ Product header rating updated: No ratings - showing 0 stars');
        return;
    }
    
    // HAS RATINGS: Calculate average rating from Firebase data
    const totalStars = ratingsData.reduce((sum, rating) => sum + rating.stars, 0);
    const averageRating = totalStars / ratingsData.length;
    const fullStars = Math.floor(averageRating);
    const hasHalfStar = averageRating % 1 >= 0.5;
    
    // Build stars HTML based on calculated average
    let starsHTML = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) {
            starsHTML += '<i class="fas fa-star"></i>'; // Full star
        } else if (i === fullStars + 1 && hasHalfStar) {
            starsHTML += '<i class="fas fa-star-half-alt"></i>'; // Half star
        } else {
            starsHTML += '<i class="far fa-star"></i>'; // Empty star
        }
    }
    
    // Update DOM elements with Firebase data and fade effect
    addFadeEffect();
    headerStarsElement.innerHTML = starsHTML;
    headerReviewCountElement.textContent = `(${ratingsData.length} đánh giá)`;
    
    // Add a brief highlight effect to draw attention
    const productRatingDiv = document.getElementById('productHeaderRating');
    if (productRatingDiv) {
        productRatingDiv.style.transition = 'all 0.3s ease';
        productRatingDiv.style.transform = 'scale(1.05)';
        productRatingDiv.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
        productRatingDiv.style.borderRadius = '8px';
        productRatingDiv.style.padding = '4px 8px';
        
        setTimeout(() => {
            productRatingDiv.style.transform = 'scale(1)';
            productRatingDiv.style.backgroundColor = 'transparent';
            productRatingDiv.style.padding = '0';
        }, 300);
    }
    
    console.log(`✅ Product header rating updated with animation: ${averageRating.toFixed(1)} stars (${ratingsData.length} reviews)`);
}

// Setup rating event listeners
function setupRatingEventListeners() {
    // Rating form submission
    const ratingForm = document.getElementById('ratingForm');
    if (ratingForm) {
        ratingForm.addEventListener('submit', handleRatingSubmit);
    }
    
    // Rating filter
    const ratingFilter = document.getElementById('ratingFilter');
    if (ratingFilter) {
        ratingFilter.addEventListener('change', handleRatingFilter);
    }
    
    // Global functions for rating interactions
    window.clearRating = clearRating;
    window.deleteRating = deleteRating;
}

// Handle rating form submission
async function handleRatingSubmit(event) {
    event.preventDefault();
    
    if (!currentUserId) {
        alert('Vui lòng đăng nhập để đánh giá sản phẩm');
        return;
    }
    
    if (selectedRating === 0) {
        alert('Vui lòng chọn số sao đánh giá');
        return;
    }
    
    const ratingContent = document.getElementById('ratingContent');
    const submitBtn = document.querySelector('.btn-rating-submit');
    
    if (!ratingContent) return;
    
    const content = ratingContent.value.trim();
    const isUpdate = !!userRating; // Store this before submitting
    
    // Disable form during submission
    ratingContent.disabled = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
    
    try {
        await submitRating(selectedRating, content);
        
        // Show success message
        showRatingSuccess(isUpdate ? 'Cập nhật đánh giá thành công!' : 'Gửi đánh giá thành công!');
        
        // Reload ratings to get the updated data
        await loadRatings();
        
        // Force update product header rating immediately
        updateProductHeaderRating();
        console.log('🔄 Product header rating force updated after submit');
        
    } catch (error) {
        console.error('❌ Error submitting rating:', error);
        showRatingError('Có lỗi xảy ra khi gửi đánh giá. Vui lòng thử lại.');
        
        // Re-enable form on error
        ratingContent.disabled = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = isUpdate ? '<i class="fas fa-edit"></i> Cập nhật đánh giá' : '<i class="fas fa-star"></i> Gửi đánh giá';
    }
}

// Update product rating and reviewCount in products collection
async function updateProductRating() {
    if (!window.firebase?.firestore || !currentProductId) {
        console.warn('⚠️ Cannot update product rating - Firebase or productId not available');
        return;
    }
    
    const db = window.firebase.firestore();
    
    try {
        console.log('📊 Calculating updated rating for product:', currentProductId);
        
        // Get all ratings for this product
        const ratingsSnapshot = await db.collection('ratings')
            .where('productId', '==', currentProductId)
            .get();
        
        const reviewCount = ratingsSnapshot.size;
        
        if (reviewCount === 0) {
            // No ratings - set rating to 0
            await db.collection('products').doc(currentProductId).update({
                rating: 0,
                reviewCount: 0
            });
            console.log('✅ Product rating updated: 0 stars (no reviews)');
        } else {
            // Calculate average rating
            let totalStars = 0;
            ratingsSnapshot.forEach(doc => {
                const rating = doc.data();
                totalStars += rating.stars || 0;
            });
            
            const averageRating = totalStars / reviewCount;
            
            // Update product document
            await db.collection('products').doc(currentProductId).update({
                rating: averageRating,
                reviewCount: reviewCount
            });
            
            console.log(`✅ Product rating updated: ${averageRating.toFixed(2)} stars (${reviewCount} reviews)`);
        }
        
    } catch (error) {
        console.error('❌ Error updating product rating:', error);
    }
}

// Submit a new rating to Firebase
async function submitRating(stars, content) {
    if (!window.firebase?.firestore || !currentUserId) {
        throw new Error('Firebase not available or user not logged in');
    }
    
    const db = window.firebase.firestore();
    const user = window.currentUser;
    
    // Get user photo from users collection
    let userPhoto = user.photoURL || null;
    
    console.log('🔍 Fetching user photo from users collection for rating:', currentUserId);
    try {
        const userDoc = await db.collection('users').doc(currentUserId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.photo) {
                userPhoto = userData.photo;
                console.log('✅ Found user photo for rating:', userData.photo);
            }
        }
    } catch (error) {
        console.warn('⚠️ Error fetching user photo for rating:', error);
    }
    
    const ratingData = {
        productId: currentProductId,
        userId: currentUserId,
        userDisplayName: user.displayName || user.email || 'Người dùng',
        userAvatar: userPhoto,
        stars: stars,
        content: content,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    };
    
    console.log('📤 Submitting rating with data:', {
        userId: ratingData.userId,
        userDisplayName: ratingData.userDisplayName,
        userAvatar: ratingData.userAvatar ? '✅ Has avatar' : '❌ No avatar',
        stars: ratingData.stars,
        content: ratingData.content?.substring(0, 50) + '...'
    });
    
    let ratingId;
    
    if (userRating) {
        // Update existing rating
        await db.collection('ratings').doc(userRating.id).update({
            ...ratingData,
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Rating updated with ID:', userRating.id);
        ratingId = userRating.id;
        
        // Broadcast update to other tabs
        broadcastRatingUpdate('update', { id: userRating.id, ...ratingData });
    } else {
        // Create new rating
        const docRef = await db.collection('ratings').add(ratingData);
        console.log('✅ Rating submitted with ID:', docRef.id);
        ratingId = docRef.id;
        
        // Broadcast update to other tabs
        broadcastRatingUpdate('add', { id: docRef.id, ...ratingData });
    }
    
    // Update product rating and reviewCount
    await updateProductRating();
    
    return ratingId;
}

// Delete a rating
async function deleteRating(ratingId) {
    if (!currentUserId || !window.firebase?.firestore) {
        return;
    }
    
    if (!confirm('Bạn có chắc chắn muốn xóa đánh giá này?')) {
        return;
    }
    
    try {
        const db = window.firebase.firestore();
        await db.collection('ratings').doc(ratingId).delete();
        
        console.log('✅ Rating deleted:', ratingId);
        
        // Reset userRating reference since it's been deleted
        userRating = null;
        
        // Clear the rating form to default state
        clearRatingFormCompletely();
        
        // Broadcast delete to other tabs
        broadcastRatingUpdate('delete', { id: ratingId });
        
        // Update product rating and reviewCount after deletion
        await updateProductRating();
        
        // Reload ratings to update the list and UI
        await loadRatings();
        
        // Force update product header rating immediately
        updateProductHeaderRating();
        console.log('🔄 Product header rating force updated after delete');
        
        showRatingSuccess('Đã xóa đánh giá thành công!');
        
    } catch (error) {
        console.error('❌ Error deleting rating:', error);
        showRatingError('Có lỗi xảy ra khi xóa đánh giá.');
    }
}

// Clear rating form completely (used after deletion)
function clearRatingFormCompletely() {
    const ratingContent = document.getElementById('ratingContent');
    const submitBtn = document.querySelector('.btn-rating-submit');
    const existingNotice = document.querySelector('.existing-rating-notice');
    const ratingText = document.getElementById('ratingText');
    const starInput = document.getElementById('starInput');
    
    console.log('🗑️ Clearing rating form completely after deletion');
    
    // Remove the notice
    if (existingNotice) {
        existingNotice.remove();
    }
    
    // Clear textarea
    if (ratingContent) {
        ratingContent.value = '';
    }
    
    // Reset stars
    selectedRating = 0;
    resetStars();
    
    // Reset rating text
    if (ratingText) {
        ratingText.textContent = 'Chọn số sao';
    }
    
    // Reset submit button
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-star"></i> Gửi đánh giá';
    }
    
    // Ensure star input is enabled for new rating
    if (starInput) {
        starInput.style.pointerEvents = 'auto';
        starInput.style.opacity = '1';
    }
    
    console.log('✅ Rating form cleared - ready for new rating');
}

// Clear rating form
function clearRating() {
    const ratingContent = document.getElementById('ratingContent');
    const submitBtn = document.querySelector('.btn-rating-submit');
    const existingNotice = document.querySelector('.existing-rating-notice');
    
    // If user has existing rating for this product, restore it instead of clearing
    if (userRating && userRating.productId === currentProductId) {
        console.log('🔄 Restoring existing rating instead of clearing');
        updateUIWithExistingRating(userRating);
        return;
    }
    
    // No existing rating - clear the form completely
    if (ratingContent) {
        ratingContent.value = '';
    }
    
    selectedRating = 0;
    resetStars();
    
    const ratingText = document.getElementById('ratingText');
    if (ratingText) {
        ratingText.textContent = 'Chọn số sao';
    }
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-star"></i> Gửi đánh giá';
    }
    
    if (existingNotice) {
        existingNotice.remove();
    }
}

// Handle rating filter change
function handleRatingFilter(event) {
    const filterValue = event.target.value;
    const ratingItems = document.querySelectorAll('.rating-item');
    
    ratingItems.forEach(item => {
        if (filterValue === 'all') {
            item.style.display = 'block';
        } else {
            const stars = item.querySelectorAll('.rating-stars .fas').length;
            if (stars === parseInt(filterValue)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        }
    });
}

// Show rating success notification
function showRatingSuccess(message) {
    if (typeof showNotification === 'function') {
        showNotification(message, 'success');
    } else {
        alert(message);
    }
}

// Show rating error notification
function showRatingError(message) {
    if (typeof showNotification === 'function') {
        showNotification(message, 'error');
    } else {
        alert(message);
    }
}

// Cleanup rating system
function cleanupRatingSystem() {
    if (ratingsListener) {
        ratingsListener();
        ratingsListener = null;
    }
}

// Export functions for global access
window.initializeCommentSystem = initializeCommentSystem;
window.initializeRatingSystem = initializeRatingSystem;
window.setupCommentUI = setupCommentUI;
window.setupRatingUI = setupRatingUI;
window.clearComment = clearComment;
window.clearRating = clearRating;
window.showReplyForm = showReplyForm;
window.hideReplyForm = hideReplyForm;
window.submitReply = submitReply;
window.deleteComment = deleteComment;
window.deleteRating = deleteRating;
window.loadMoreComments = loadMoreComments;
window.scrollToComment = scrollToComment;
window.scrollToLatestComment = scrollToLatestComment;
window.isCurrentUserAdmin = isCurrentUserAdmin; // Export admin check function

// Debug function để test scroll
window.testScroll = function() {
    const commentsList = document.getElementById('commentsList');
    if (commentsList) {
        const innerContainer = commentsList.querySelector('.comments-list-inner');
        console.log('🧪 SCROLL TEST:', {
            'Container Max Height': getComputedStyle(commentsList).maxHeight,
            'Container Client Height': commentsList.clientHeight + 'px',
            'Container Scroll Height': commentsList.scrollHeight + 'px',
            'Inner Content Height': innerContainer ? innerContainer.scrollHeight + 'px' : 'N/A',
            'Can Scroll (container)': commentsList.scrollHeight > commentsList.clientHeight,
            'Can Scroll (inner)': innerContainer ? innerContainer.scrollHeight > commentsList.clientHeight : false,
            'Has Scroll Class': commentsList.classList.contains('has-scroll'),
            'Overflow Style': getComputedStyle(commentsList).overflowY
        });
        
        // Force add class to test visual
        commentsList.classList.add('has-scroll');
        console.log('✅ Added has-scroll class for testing');
    }
};

// Setup horizontal scrolling for nested comments on mobile
function setupNestedCommentScrolling() {
    console.log('🔄 Setting up nested comment scrolling...');
    
    const nestedReplies = document.querySelectorAll('.comment-replies');
    console.log(`📱 Found ${nestedReplies.length} comment replies containers`);
    
    nestedReplies.forEach((repliesContainer, index) => {
        console.log(`🔍 Processing container ${index + 1}`);
        
        // Force check for horizontal overflow regardless of screen width
        const hasHorizontalOverflow = repliesContainer.scrollWidth > repliesContainer.clientWidth;
        console.log(`📏 Container ${index + 1}: scrollWidth=${repliesContainer.scrollWidth}, clientWidth=${repliesContainer.clientWidth}, hasOverflow=${hasHorizontalOverflow}`);
        
        if (hasHorizontalOverflow || window.innerWidth <= 768) {
            repliesContainer.classList.add('has-horizontal-scroll');
            
            // Ensure container has proper overflow settings
            repliesContainer.style.overflowX = 'auto';
            repliesContainer.style.overflowY = 'visible';
            repliesContainer.style.webkitOverflowScrolling = 'touch';
            
            // Add smooth scroll behavior for touch devices
            let isScrolling = false;
            let startX = 0;
            let scrollLeft = 0;
            
            // Remove existing listeners to prevent duplicates
            repliesContainer.removeEventListener('touchstart', repliesContainer._touchStartHandler);
            repliesContainer.removeEventListener('touchmove', repliesContainer._touchMoveHandler);
            repliesContainer.removeEventListener('touchend', repliesContainer._touchEndHandler);
            
            // Touch start handler
            repliesContainer._touchStartHandler = (e) => {
                isScrolling = true;
                startX = e.touches[0].pageX - repliesContainer.offsetLeft;
                scrollLeft = repliesContainer.scrollLeft;
                console.log('👆 Touch start detected');
            };
            
            // Touch move handler
            repliesContainer._touchMoveHandler = (e) => {
                if (!isScrolling) return;
                
                const x = e.touches[0].pageX - repliesContainer.offsetLeft;
                const walk = (x - startX) * 1.5; // Scroll speed multiplier
                repliesContainer.scrollLeft = scrollLeft - walk;
                
                // Only prevent default if we're actually scrolling horizontally
                if (Math.abs(walk) > 5) {
                    e.preventDefault();
                }
                console.log('👆 Touch move, scrollLeft:', repliesContainer.scrollLeft);
            };
            
            // Touch end handler
            repliesContainer._touchEndHandler = () => {
                isScrolling = false;
                console.log('👆 Touch end');
            };
            
            repliesContainer.addEventListener('touchstart', repliesContainer._touchStartHandler, { passive: true });
            repliesContainer.addEventListener('touchmove', repliesContainer._touchMoveHandler, { passive: false });
            repliesContainer.addEventListener('touchend', repliesContainer._touchEndHandler, { passive: true });
            
            // Add visual hint for horizontal scrolling on mobile
            if (window.innerWidth <= 768 && !repliesContainer.querySelector('.horizontal-scroll-hint')) {
                const scrollHint = document.createElement('div');
                scrollHint.className = 'horizontal-scroll-hint';
                scrollHint.innerHTML = '← Vuốt để xem thêm →';
                scrollHint.style.cssText = `
                    position: absolute;
                    top: -20px;
                    right: 0;
                    font-size: 10px;
                    color: #667eea;
                    background: rgba(255,255,255,0.9);
                    padding: 2px 6px;
                    border-radius: 3px;
                    pointer-events: none;
                    z-index: 10;
                    opacity: 0.8;
                    font-weight: 500;
                `;
                repliesContainer.style.position = 'relative';
                repliesContainer.appendChild(scrollHint);
                
                // Auto-hide hint after 4 seconds
                setTimeout(() => {
                    if (scrollHint.parentNode) {
                        scrollHint.style.opacity = '0';
                        scrollHint.style.transition = 'opacity 0.5s ease';
                        setTimeout(() => scrollHint.remove(), 500);
                    }
                }, 4000);
            }
            
            console.log(`✅ Setup horizontal scroll for container ${index + 1}`);
        }
    });
    
    console.log('✅ Nested comment scrolling setup complete');
}

// Call setup function when comments are rendered
window.setupNestedCommentScrolling = setupNestedCommentScrolling;

// Enhanced debug function for nested comment scrolling
window.debugNestedScroll = function() {
    console.log('🔍 Debugging nested comment scrolling...');
    
    // Check if function exists
    if (typeof setupNestedCommentScrolling === 'function') {
        console.log('✅ setupNestedCommentScrolling function exists');
        setupNestedCommentScrolling();
    } else {
        console.error('❌ setupNestedCommentScrolling function not found');
    }
    
    // Check CSS
    const testElement = document.querySelector('.comment-replies');
    if (testElement) {
        const styles = getComputedStyle(testElement);
        console.log('🎨 CSS Styles for .comment-replies:', {
            overflowX: styles.overflowX,
            overflowY: styles.overflowY,
            display: styles.display,
            minWidth: styles.minWidth,
            width: styles.width,
            webkitOverflowScrolling: styles.webkitOverflowScrolling
        });
    }
    
    // Test nested replies
    const nestedReplies = document.querySelectorAll('.comment-replies');
    console.log(`📱 Found ${nestedReplies.length} nested reply containers`);
    
    nestedReplies.forEach((container, index) => {
        console.log(`📏 Container ${index + 1}:`, {
            element: container,
            scrollWidth: container.scrollWidth,
            clientWidth: container.clientWidth,
            scrollLeft: container.scrollLeft,
            maxScrollLeft: container.scrollWidth - container.clientWidth,
            isHorizontallyScrollable: container.scrollWidth > container.clientWidth,
            overflowX: getComputedStyle(container).overflowX,
            display: getComputedStyle(container).display,
            minWidth: getComputedStyle(container).minWidth,
            width: getComputedStyle(container).width
        });
        
        // Test horizontal scroll
        if (container.scrollWidth > container.clientWidth) {
            console.log(`✅ Container ${index + 1} CAN scroll horizontally`);
            // Test scroll by scrolling 50px
            container.scrollLeft = 50;
            setTimeout(() => {
                console.log(`📏 After scroll test - scrollLeft: ${container.scrollLeft}`);
                container.scrollLeft = 0; // Reset
            }, 500);
        } else {
            console.log(`❌ Container ${index + 1} CANNOT scroll horizontally`);
        }
    });
};

// =====================================
// SIMPLE COMMENT DETAIL POPUP SYSTEM
// =====================================

let simplePopup = null;

// Create and inject simple popup CSS
function createSimplePopupCSS() {
    if (document.getElementById('simpleCommentPopupCSS')) return;
    
    const style = document.createElement('style');
    style.id = 'simpleCommentPopupCSS';
    style.textContent = `
        /* Simple Comment Popup Overlay */
        .simple-comment-popup {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(5px);
        }
        
        .simple-comment-popup.show {
            display: flex;
        }
        
        .simple-popup-content {
            background: white;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        
        .simple-popup-header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 1rem;
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .simple-popup-title {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
        }
        
        .simple-popup-close {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.3s;
        }
        
        .simple-popup-close:hover {
            background: rgba(255,255,255,0.3);
        }
        
        .simple-popup-body {
            padding: 1.5rem;
        }
        
        .simple-comment-display {
            background: #f8f9ff;
            border: 2px solid #e3e7ff;
            border-radius: 8px;
            padding: 1rem;
        }
        
        .simple-comment-user {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
        }
        
        .simple-comment-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1rem;
        }
        
        .simple-comment-userinfo h4 {
            margin: 0;
            font-size: 0.9rem;
            color: #333;
            font-weight: 600;
        }
        
        .simple-comment-userinfo span {
            font-size: 0.75rem;
            color: #666;
        }
        
        .simple-comment-text {
            background: white;
            padding: 0.75rem;
            border-radius: 6px;
            border: 1px solid #e0e4e7;
            font-size: 0.9rem;
            line-height: 1.4;
            color: #333;
        }
        
        /* Children Comments Styles */
        .simple-children-container {
            margin-top: 1.5rem;
            border-top: 2px solid #e3e7ff;
            padding-top: 1rem;
        }
        
        .children-header h4 {
            margin: 0 0 1rem 0;
            font-size: 0.95rem;
            color: #667eea;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .children-header i {
            font-size: 0.85rem;
        }
        
        .children-list {
            max-height: 300px;
            overflow-y: auto;
            padding-right: 8px;
        }
        
        .children-list::-webkit-scrollbar {
            width: 6px;
        }
        
        .children-list::-webkit-scrollbar-track {
            background: #f1f3f4;
            border-radius: 3px;
        }
        
        .children-list::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 3px;
        }
        
        .children-list::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
        }
        
        .simple-child-comment {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 0.75rem;
            margin-bottom: 0.75rem;
            transition: all 0.2s ease;
        }
        
        .simple-child-comment:hover {
            border-color: #667eea;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
        }
        
        .simple-child-comment:last-child {
            margin-bottom: 0;
        }
        
        .child-comment-user {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
        }
        
        .child-comment-avatar {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: linear-gradient(135deg, #9ca3af, #6b7280);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 0.75rem;
            overflow: hidden;
        }
        
        .child-avatar-text {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .child-comment-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .child-comment-username {
            font-size: 0.8rem;
            font-weight: 600;
            color: #374151;
        }
        
        .child-comment-time {
            font-size: 0.7rem;
            color: #6b7280;
        }
        
        .child-comment-text {
            font-size: 0.85rem;
            line-height: 1.4;
            color: #4b5563;
            background: #f9fafb;
            padding: 0.5rem;
            border-radius: 4px;
            border-left: 3px solid #667eea;
        }
    `;
    
    document.head.appendChild(style);
    console.log('✅ Simple popup CSS injected with children support');
}

// Create simple popup HTML structure
function createSimplePopup() {
    if (simplePopup) return simplePopup;
    
    console.log('� Creating simple comment popup');
    
    // Create popup HTML
    const popup = document.createElement('div');
    popup.className = 'simple-comment-popup';
    popup.innerHTML = `
        <div class="simple-popup-content">
            <div class="simple-popup-header">
                <h3 class="simple-popup-title">Chi tiết bình luận</h3>
                <button class="simple-popup-close">&times;</button>
            </div>
            <div class="simple-popup-body">
                <div class="simple-comment-display">
                    <div class="simple-comment-user">
                        <div class="simple-comment-avatar"></div>
                        <div class="simple-comment-userinfo">
                            <h4 class="simple-comment-username"></h4>
                            <span class="simple-comment-time"></span>
                        </div>
                    </div>
                    <div class="simple-comment-text"></div>
                </div>
                <!-- Children will be dynamically added here -->
            </div>
        </div>
    `;
    
    // Add to body
    document.body.appendChild(popup);
    
    // Setup close event
    const closeBtn = popup.querySelector('.simple-popup-close');
    closeBtn.addEventListener('click', hideSimplePopup);
    
    // Close on overlay click
    popup.addEventListener('click', (e) => {
        if (e.target === popup) hideSimplePopup();
    });
    
    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && popup.classList.contains('show')) {
            hideSimplePopup();
        }
    });
    
    simplePopup = popup;
    return popup;
}

// Show simple popup with comment data and children
async function showSimpleCommentPopup(commentElement) {
    console.log('📋 === START showSimpleCommentPopup ===');
    console.log('📝 Received commentElement:', commentElement);
    console.log('📝 Element tag name:', commentElement.tagName);
    console.log('📝 Element ID attribute:', commentElement.getAttribute('data-comment-id'));
    console.log('📝 Element full HTML:', commentElement.outerHTML.substring(0, 200) + '...');
    
    // Get comment ID
    const commentId = commentElement.getAttribute('data-comment-id');
    if (!commentId) {
        console.error('❌ No comment ID found');
        return;
    }
    
    console.log('🔍 Working with comment ID:', commentId);
    
    // Extract data directly from the clicked DOM element (more reliable)
    const contentElement = commentElement.querySelector('.comment-text');
    const usernameElement = commentElement.querySelector('.comment-username');
    const avatarElement = commentElement.querySelector('.comment-avatar img');
    const timeElement = commentElement.querySelector('.comment-time');
    
    console.log('🔍 Found sub-elements:', {
        contentElement: !!contentElement,
        usernameElement: !!usernameElement,
        avatarElement: !!avatarElement,
        timeElement: !!timeElement
    });
    
    if (contentElement) {
        console.log('📝 Content element text:', contentElement.textContent?.trim());
        console.log('📝 Content element HTML:', contentElement.innerHTML);
    }
    
    const commentData = {
        id: commentId,
        userDisplayName: usernameElement?.textContent?.trim() || 'Người dùng',
        content: contentElement?.textContent?.trim() || 'Không có nội dung',
        userAvatar: avatarElement?.src || null,
        createdAt: null // We'll try to extract time if available
    };
    
    // Try to get timestamp
    if (timeElement) {
        commentData.timeText = timeElement.textContent?.trim() || '';
    }
    
    // If userAvatar is missing, try to get userId from Firebase comment document
    if (!commentData.userAvatar && window.firebase?.firestore) {
        console.log('🔍 Main comment missing avatar, fetching comment document for userId...');
        try {
            const db = window.firebase.firestore();
            const commentDoc = await db.collection('comments').doc(commentId).get();
            if (commentDoc.exists) {
                const commentFirebaseData = commentDoc.data();
                if (commentFirebaseData.userId) {
                    console.log('👤 Found userId in comment document:', commentFirebaseData.userId);
                    const userDoc = await db.collection('users').doc(commentFirebaseData.userId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        if (userData.photo) {
                            commentData.userAvatar = userData.photo;
                            console.log('✅ Found main comment user avatar from users collection:', userData.photo);
                        } else {
                            console.log('📷 No photo found in users collection for main comment user');
                        }
                    } else {
                        console.log('👤 User document not found for main comment');
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Error fetching main comment user data:', error);
        }
    }
    
    console.log('✅ Final extracted comment data from DOM:', {
        id: commentData.id,
        content: commentData.content,
        userDisplayName: commentData.userDisplayName,
        timeText: commentData.timeText,
        userAvatar: commentData.userAvatar ? 'Yes' : 'No'
    });
    
    // Find child comments from Firebase
    console.log('🔍 Searching for child comments of:', commentId);
    try {
        const childComments = await findChildComments(commentId);
        console.log(`📊 Found ${childComments.length} child comments for comment:`, commentId);
        
        // Create fresh popup (this will remove any existing popup)
        createSimplePopupCSS();
        const popup = createSimplePopup();
        
        console.log('🆕 Created fresh popup, populating with data...');
        
        // Populate popup with main comment and children
        populateCommentPopup(popup, commentData, childComments);
        
        // Show popup
        popup.classList.add('show');
        
        console.log('✅ Simple popup displayed with', childComments.length, 'children for comment:', commentId);
        console.log('📋 === END showSimpleCommentPopup ===');
    } catch (error) {
        console.error('❌ Error finding child comments for comment:', commentId, error);
        
        // Fallback: show popup without children
        createSimplePopupCSS();
        const popup = createSimplePopup();
        populateCommentPopup(popup, commentData, []);
        popup.classList.add('show');
        
        console.log('⚠️ Simple popup displayed without children (fallback) for comment:', commentId);
        console.log('📋 === END showSimpleCommentPopup ===');
    }
}

// Find child comments from Firebase and enhance with user avatar data
async function findChildComments(parentCommentId) {
    if (!window.firebase?.firestore) {
        console.warn('⚠️ Firebase not available for finding child comments');
        return [];
    }
    
    try {
        const db = window.firebase.firestore();
        console.log('🔍 Querying Firebase for child comments of:', parentCommentId);
        
        // Query comments where parentId equals the clicked comment ID
        const childSnapshot = await db.collection('comments')
            .where('parentId', '==', parentCommentId)
            .orderBy('createdAt', 'asc') // Show replies in chronological order
            .get();
        
        const childComments = [];
        
        // First, collect all child comments
        childSnapshot.forEach(doc => {
            const data = doc.data();
            const createdAt = data.createdAt ? data.createdAt.toDate() : new Date();
            
            childComments.push({
                id: doc.id,
                ...data,
                createdAt: createdAt
            });
        });
        
        console.log('📊 Found', childComments.length, 'child comments, checking for missing avatars...');
        
        // Enhance comments with user avatar data if userAvatar is null
        const enhancedComments = await Promise.all(
            childComments.map(async (comment) => {
                // If userAvatar is null or empty, try to get from users collection
                if (!comment.userAvatar && comment.userId) {
                    console.log('🔍 Looking up user avatar for userId:', comment.userId);
                    try {
                        const userDoc = await db.collection('users').doc(comment.userId).get();
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            if (userData.photo) {
                                comment.userAvatar = userData.photo;
                                console.log('✅ Found user avatar from users collection:', userData.photo);
                            } else {
                                console.log('📷 No photo found in users collection for:', comment.userId);
                            }
                        } else {
                            console.log('👤 User document not found for:', comment.userId);
                        }
                    } catch (userError) {
                        console.warn('⚠️ Error fetching user data for', comment.userId, ':', userError);
                    }
                }
                return comment;
            })
        );
        
        console.log('✅ Enhanced child comments:', enhancedComments.map(c => ({
            id: c.id,
            content: c.content?.substring(0, 30) + '...',
            userDisplayName: c.userDisplayName,
            userAvatar: c.userAvatar ? '✅ Has avatar' : '❌ No avatar'
        })));
        
        return enhancedComments;
        
    } catch (error) {
        console.error('❌ Error querying child comments:', error);
        return [];
    }
}

// Populate popup with main comment and child comments
function populateCommentPopup(popup, mainCommentData, childComments) {
    console.log('🎨 Populating popup with main comment and', childComments.length, 'children');
    
    // Get popup body and completely clear it first to remove any previous children
    const popupBody = popup.querySelector('.simple-popup-body');
    if (popupBody) {
        console.log('🧹 Completely clearing popup body to remove previous children');
        popupBody.innerHTML = `
            <div class="simple-comment-display">
                <div class="simple-comment-user">
                    <div class="simple-comment-avatar"></div>
                    <div class="simple-comment-userinfo">
                        <h4 class="simple-comment-username"></h4>
                        <span class="simple-comment-time"></span>
                    </div>
                </div>
                <div class="simple-comment-text"></div>
            </div>
        `;
        console.log('✅ Popup body completely reset with fresh HTML');
    }
    
    // Get popup elements (freshly created)
    const avatar = popup.querySelector('.simple-comment-avatar');
    const username = popup.querySelector('.simple-comment-username');
    const time = popup.querySelector('.simple-comment-time');
    const text = popup.querySelector('.simple-comment-text');
    
    console.log('🔧 Fresh popup elements found:', {
        avatar: !!avatar,
        username: !!username,
        time: !!time,
        text: !!text
    });
    
    // Set main comment avatar
    if (mainCommentData.userAvatar) {
        avatar.innerHTML = `<img src="${mainCommentData.userAvatar}" alt="${mainCommentData.userDisplayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        console.log('🖼️ Set avatar image:', mainCommentData.userAvatar);
    } else {
        avatar.textContent = mainCommentData.userDisplayName ? mainCommentData.userDisplayName.charAt(0).toUpperCase() : 'U';
        console.log('🔤 Set avatar letter:', avatar.textContent);
    }
    
    // Set main comment data
    username.textContent = mainCommentData.userDisplayName || 'Người dùng';
    time.textContent = mainCommentData.timeText || 'Vừa xong';
    text.textContent = mainCommentData.content;
    
    console.log('📝 Main comment data populated:', {
        username: username.textContent,
        time: time.textContent,
        content: text.textContent
    });
    
    // Add child comments if any
    if (childComments.length > 0) {
        const popupBody = popup.querySelector('.simple-popup-body');
        
        console.log('📦 Adding children container for', childComments.length, 'child comments');
        
        // Create children container
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'simple-children-container';
        childrenContainer.innerHTML = `
            <div class="children-header">
                <h4><i class="fas fa-reply"></i> Các câu trả lời (${childComments.length})</h4>
            </div>
            <div class="children-list"></div>
        `;
        
        const childrenList = childrenContainer.querySelector('.children-list');
        
        // Add each child comment
        childComments.forEach((child, index) => {
            const timeAgo = getTimeAgo(child.createdAt);
            const childAvatar = child.userAvatar 
                ? `<img src="${child.userAvatar}" alt="${child.userDisplayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
                : `<div class="child-avatar-text">${child.userDisplayName ? child.userDisplayName.charAt(0).toUpperCase() : 'U'}</div>`;
            
            const childElement = document.createElement('div');
            childElement.className = 'simple-child-comment';
            childElement.innerHTML = `
                <div class="child-comment-user">
                    <div class="child-comment-avatar">${childAvatar}</div>
                    <div class="child-comment-info">
                        <span class="child-comment-username">${child.userDisplayName || 'Người dùng'}</span>
                        <span class="child-comment-time">${timeAgo}</span>
                    </div>
                </div>
                <div class="child-comment-text">${escapeHtml(child.content)}</div>
            `;
            
            childrenList.appendChild(childElement);
            console.log(`📝 Added child comment ${index + 1}:`, child.content?.substring(0, 30) + '...');
        });
        
        popupBody.appendChild(childrenContainer);
        console.log('✅ Successfully added', childComments.length, 'child comments to fresh popup');
    } else {
        console.log('📭 No child comments to add');
    }
}

// Hide simple popup
function hideSimplePopup() {
    if (simplePopup) {
        simplePopup.classList.remove('show');
        
        // Clear popup content to prevent data from persisting
        const popupBody = simplePopup.querySelector('.simple-popup-body');
        if (popupBody) {
            // Small delay to allow animation to complete before clearing
            setTimeout(() => {
                popupBody.innerHTML = `
                    <div class="simple-comment-display">
                        <div class="simple-comment-user">
                            <div class="simple-comment-avatar"></div>
                            <div class="simple-comment-userinfo">
                                <h4 class="simple-comment-username"></h4>
                                <span class="simple-comment-time"></span>
                            </div>
                        </div>
                        <div class="simple-comment-text"></div>
                    </div>
                `;
                console.log('🧹 Popup content cleared on hide');
            }, 300);
        }
        
        console.log('🚫 Simple popup hidden and will be cleared');
    }
}

// Setup click handlers for comments
function setupSimpleCommentClickHandlers() {
    console.log('🔗 Setting up simple comment click handlers');
    
    const commentElements = document.querySelectorAll('[data-comment-id]');
    console.log(`📊 Found ${commentElements.length} comment elements`);
    
    commentElements.forEach(element => {
        // Remove existing listeners
        element.removeEventListener('click', element._simpleClickHandler);
        
        // Create new click handler
        const clickHandler = function(e) {
            // Ignore button clicks
            if (e.target.closest('button') || e.target.closest('.comment-actions')) {
                return;
            }
            
            // Stop event propagation to prevent bubbling to parent elements
            e.stopPropagation();
            
            console.log('🎯 Comment clicked:', element.getAttribute('data-comment-id'));
            console.log('📝 Event target:', e.target);
            console.log('📝 Current target (element):', e.currentTarget);
            console.log('📝 Element passed to function:', element);
            console.log('📝 Element classes:', element.className);
            console.log('📝 Element parent ID:', element.getAttribute('data-parent-id'));
            
            // Check if there are multiple elements with same ID
            const allElementsWithSameId = document.querySelectorAll(`[data-comment-id="${element.getAttribute('data-comment-id')}"]`);
            console.log('📊 Elements with same comment ID:', allElementsWithSameId.length);
            if (allElementsWithSameId.length > 1) {
                console.warn('⚠️ Multiple elements found with same comment ID!');
                allElementsWithSameId.forEach((el, index) => {
                    console.log(`Element ${index + 1}:`, el.querySelector('.comment-text')?.textContent?.trim());
                });
            }
            
            // Extract and log the actual content from DOM
            const actualContent = element.querySelector('.comment-text')?.textContent?.trim();
            const actualUsername = element.querySelector('.comment-username')?.textContent?.trim();
            console.log('📝 Actual content from DOM:', actualContent);
            console.log('📝 Actual username from DOM:', actualUsername);
            
            // Verify this is the correct element before calling popup
            console.log('✅ Calling showSimpleCommentPopup with verified element');
            showSimpleCommentPopup(element).catch(error => {
                console.error('❌ Error showing comment popup:', error);
            });
        };
        
        // Store handler reference and add listener
        element._simpleClickHandler = clickHandler;
        element.addEventListener('click', clickHandler);
        
        // Add visual feedback
        element.style.cursor = 'pointer';
        element.style.transition = 'transform 0.2s ease';
        
        element.addEventListener('mouseenter', () => {
            element.style.transform = 'scale(1.02)';
        });
        
        element.addEventListener('mouseleave', () => {
            element.style.transform = 'scale(1)';
        });
    });
    
    console.log('✅ Simple comment click handlers setup complete');
}

// Initialize simple popup system
function initializeSimplePopupSystem() {
    console.log('🚀 Initializing simple popup system');
    createSimplePopupCSS();
    setupSimpleCommentClickHandlers();
    console.log('✅ Simple popup system ready');
}

// Old function removed - replaced by simple popup system

// Old functions removed - replaced by setupSimpleCommentClickHandlers()

// Old function removed - replaced by showSimpleCommentPopup()

// Old function removed - data extraction now handled in showSimpleCommentPopup()

// Old functions removed - no longer needed with simple popup system

// Old function removed - replaced by showSimpleCommentPopup()

// Old function removed - CSS now embedded in simple popup system

// Old function removed - not needed with simple popup system

// Old function removed - replaced by simple popup system

// Old function removed - parent comments not shown in simple popup system

// Old function removed - children handled in simple popup system

// Old function removed - replaced by hideSimplePopup()

// Old function removed - not needed with simple popup system

// Hook into comment rendering to add click handlers to new comments
function hookCommentRendering() {
    // Override the original renderComments function if it exists
    const originalRenderComments = window.renderComments;
    
    window.renderComments = function(comments) {
        console.log('🔄 Enhanced renderComments called');
        
        // Call original function first
        if (originalRenderComments) {
            originalRenderComments(comments);
        }
        
        // Add click handlers to new comments
        setTimeout(() => {
            setupSimpleCommentClickHandlers();
            setupNestedCommentScrolling(); // Also setup scrolling for new comments
        }, 100);
    };
    
    // Also watch for DOM changes to catch dynamically added comments
    const observer = new MutationObserver(function(mutations) {
        let hasNewComments = false;
        
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList?.contains('comment-item') || 
                        node.querySelector?.('.comment-item')) {
                        hasNewComments = true;
                    }
                }
            });
        });
        
        if (hasNewComments) {
            console.log('🔄 New comments detected, adding click handlers...');
            setTimeout(() => {
                setupSimpleCommentClickHandlers();
                setupNestedCommentScrolling();
            }, 100);
        }
    });
    
    // Observe the comments container
    const commentsContainer = document.querySelector('.comments-section') || 
                             document.querySelector('#comments-container') ||
                             document.body;
    
    if (commentsContainer) {
        observer.observe(commentsContainer, {
            childList: true,
            subtree: true
        });
        console.log('✅ Comment observer setup for popup click handlers');
    }
}

// Initialize popup system when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            initializeSimplePopupSystem();
            hookCommentRendering();
        }, 1000);
    });
} else {
    setTimeout(() => {
        initializeSimplePopupSystem();
        hookCommentRendering();
    }, 1000);
}

// Export functions for global access - updated for simple popup system
window.showSimpleCommentPopup = showSimpleCommentPopup;
window.hideSimplePopup = hideSimplePopup;
window.initializeSimplePopupSystem = initializeSimplePopupSystem;

console.log('✅ Simple Comment Popup System loaded successfully');
console.log('🧪 Run window.testSimplePopup() to test simple popup');
console.log('� Simple popup shows only clicked comment (no parent/child hierarchy)');

// Test function for simple popup
window.testSimplePopup = function() {
    console.log('🧪 Testing simple popup...');
    
    // Find first comment
    const firstComment = document.querySelector('.comment-item, .comment-reply');
    if (firstComment) {
        console.log('✅ Found first comment:', firstComment);
        console.log('📋 Comment ID:', firstComment.dataset.commentId);
        
        // Extract comment data directly
        const commentId = firstComment.dataset.commentId;
        const username = firstComment.querySelector('.comment-username')?.textContent?.trim() || 'Test User';
        const content = firstComment.querySelector('.comment-text')?.textContent?.trim() || 'Test comment content';
        
        showSimpleCommentPopup({
            id: commentId,
            username: username,
            content: content,
            timestamp: 'just now'
        });
    } else {
        console.error('❌ No comments found to test');
    }
};

// Simple debug for popup system
console.log('🖼️ Simple popup system ready');

// Test function for rating system CSS
window.testRatingCSS = function() {
    console.log('🧪 Testing rating system CSS...');
    console.log('🖥️ Screen width:', window.innerWidth, 'px');
    console.log('📱 Is mobile:', window.innerWidth < 1024);
    
    // Check if CSS element exists
    let cssElement = document.getElementById('rating-system-css');
    console.log('🎨 CSS element exists:', !!cssElement);
    
    if (cssElement) {
        console.log('📝 CSS content length:', cssElement.textContent.length);
    } else {
        console.warn('⚠️ CSS element not found! Running injection...');
        injectRatingSystemCSS();
    }
    
    const ratingElements = {
        reviewsSection: document.querySelector('.reviews-section'),
        reviewsSummary: document.querySelector('.reviews-summary'),
        ratingForm: document.querySelector('.rating-form-container'),
        ratingsList: document.querySelector('.ratings-list'),
        starInput: document.querySelector('.star-input')
    };
    
    console.log('📊 Rating elements found:', {
        reviewsSection: !!ratingElements.reviewsSection,
        reviewsSummary: !!ratingElements.reviewsSummary,
        ratingForm: !!ratingElements.ratingForm,
        ratingsList: !!ratingElements.ratingsList,
        starInput: !!ratingElements.starInput
    });
    
    // Check if CSS is applied
    if (ratingElements.reviewsSection) {
        const styles = window.getComputedStyle(ratingElements.reviewsSection);
        console.log('📱 Reviews section styles:', {
            marginTop: styles.marginTop,
            display: styles.display,
            backgroundColor: styles.backgroundColor
        });
    }
    
    if (ratingElements.ratingForm) {
        const styles = window.getComputedStyle(ratingElements.ratingForm);
        console.log('📝 Rating form styles:', {
            padding: styles.padding,
            backgroundColor: styles.backgroundColor,
            borderRadius: styles.borderRadius
        });
    }
    
    // Check if CSS is injected
    cssElement = document.getElementById('rating-system-css');
    console.log('💉 CSS injection status:', {
        cssInjected: !!cssElement,
        cssLength: cssElement ? cssElement.textContent.length : 0
    });
    
    return {
        elementsFound: Object.values(ratingElements).filter(el => !!el).length,
        totalElements: Object.keys(ratingElements).length,
        cssInjected: !!cssElement
    };
};

console.log('✅ Rating system CSS injection ready');
console.log('🧪 Run window.testRatingCSS() to test CSS injection');

// Old test function removed

// Old test functions removed - use window.testSimplePopup() instead

// Simple popup system complete - all old test functions removed

// Add window resize listener for desktop CSS issues
window.addEventListener('resize', function() {
    const isDesktop = window.innerWidth >= 1024;
    const wasMobile = window.lastKnownWidth < 1024;
    const wasDesktop = window.lastKnownWidth >= 1024;
    
    // Track screen size changes
    window.lastKnownWidth = window.innerWidth;
    
    // If switching from mobile to desktop, fix potential CSS issues
    if (isDesktop && wasMobile) {
        console.log('📱➡️🖥️ Switching to desktop, checking CSS...');
        setTimeout(() => {
            window.fixDesktopCSS();
        }, 300);
    }
    
    // If switching from desktop to mobile, ensure mobile styles work
    if (!isDesktop && wasDesktop) {
        console.log('🖥️➡️📱 Switching to mobile, refreshing CSS...');
        setTimeout(() => {
            window.reloadRatingCSS();
        }, 300);
    }
});

// Initialize screen width tracking
window.lastKnownWidth = window.innerWidth;

console.log('🧪 Run window.fixDesktopCSS() to fix desktop CSS issues');
console.log('🔧 Desktop CSS monitoring and auto-fix enabled');