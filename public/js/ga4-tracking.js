// Google Analytics 4 E-commerce Tracking Helper
// This file provides helper functions to track e-commerce events

// Track page view
function trackPageView(pageTitle, pageLocation) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'page_view', {
            page_title: pageTitle,
            page_location: pageLocation,
            page_path: window.location.pathname
        });
        console.log('📊 GA4: Page view tracked -', pageTitle);
    }
}

// Track product view
function trackProductView(product) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'view_item', {
            currency: 'VND',
            value: product.price || 0,
            items: [{
                item_id: product.id || '',
                item_name: product.name || '',
                item_brand: product.brand || 'TECH HAVEN',
                item_category: product.category || '',
                price: product.price || 0,
                quantity: 1
            }]
        });
        console.log('📊 GA4: Product view tracked -', product.name);
    }
}

// Track add to cart
function trackAddToCart(product, quantity = 1) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'add_to_cart', {
            currency: 'VND',
            value: (product.price || 0) * quantity,
            items: [{
                item_id: product.id || '',
                item_name: product.name || '',
                item_brand: product.brand || 'TECH HAVEN',
                item_category: product.category || '',
                price: product.price || 0,
                quantity: quantity
            }]
        });
        console.log('📊 GA4: Add to cart tracked -', product.name, 'x', quantity);
    }
}

// Track remove from cart
function trackRemoveFromCart(product, quantity = 1) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'remove_from_cart', {
            currency: 'VND',
            value: (product.price || 0) * quantity,
            items: [{
                item_id: product.id || '',
                item_name: product.name || '',
                item_brand: product.brand || 'TECH HAVEN',
                item_category: product.category || '',
                price: product.price || 0,
                quantity: quantity
            }]
        });
        console.log('📊 GA4: Remove from cart tracked -', product.name);
    }
}

// Track begin checkout
function trackBeginCheckout(cartItems, totalValue) {
    if (typeof gtag !== 'undefined') {
        const items = cartItems.map(item => ({
            item_id: item.productId || item.id || '',
            item_name: item.name || '',
            item_brand: item.brand || 'TECH HAVEN',
            item_category: item.category || '',
            price: item.price || 0,
            quantity: item.quantity || 1
        }));

        gtag('event', 'begin_checkout', {
            currency: 'VND',
            value: totalValue,
            items: items
        });
        console.log('📊 GA4: Begin checkout tracked - Total:', totalValue);
    }
}

// Track purchase
function trackPurchase(orderId, cartItems, totalValue, shipping = 0, tax = 0, coupon = '') {
    if (typeof gtag !== 'undefined') {
        const items = cartItems.map(item => ({
            item_id: item.productId || item.id || '',
            item_name: item.name || '',
            item_brand: item.brand || 'TECH HAVEN',
            item_category: item.category || '',
            price: item.price || 0,
            quantity: item.quantity || 1
        }));

        gtag('event', 'purchase', {
            transaction_id: orderId,
            value: totalValue,
            tax: tax,
            shipping: shipping,
            currency: 'VND',
            coupon: coupon,
            items: items
        });
        console.log('📊 GA4: Purchase tracked - Order ID:', orderId, 'Total:', totalValue);
    }
}

// Track search
function trackSearch(searchTerm, resultCount = 0) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'search', {
            search_term: searchTerm,
            result_count: resultCount
        });
        console.log('📊 GA4: Search tracked -', searchTerm, '(', resultCount, 'results)');
    }
}

// Track user signup
function trackSignup(method = 'email') {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'sign_up', {
            method: method
        });
        console.log('📊 GA4: Sign up tracked - Method:', method);
    }
}

// Track user login
function trackLogin(method = 'email') {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'login', {
            method: method
        });
        console.log('📊 GA4: Login tracked - Method:', method);
    }
}

// Track add to wishlist
function trackAddToWishlist(product) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'add_to_wishlist', {
            currency: 'VND',
            value: product.price || 0,
            items: [{
                item_id: product.id || '',
                item_name: product.name || '',
                item_brand: product.brand || 'TECH HAVEN',
                item_category: product.category || '',
                price: product.price || 0
            }]
        });
        console.log('📊 GA4: Add to wishlist tracked -', product.name);
    }
}

// Track share
function trackShare(method, contentType, itemId) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'share', {
            method: method,
            content_type: contentType,
            item_id: itemId
        });
        console.log('📊 GA4: Share tracked -', method, contentType);
    }
}

// Track coupon usage
function trackCouponUsage(couponCode, discountValue) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'coupon_applied', {
            coupon: couponCode,
            discount: discountValue,
            currency: 'VND'
        });
        console.log('📊 GA4: Coupon applied -', couponCode, 'Discount:', discountValue);
    }
}

// Make functions globally available
window.trackPageView = trackPageView;
window.trackProductView = trackProductView;
window.trackAddToCart = trackAddToCart;
window.trackRemoveFromCart = trackRemoveFromCart;
window.trackBeginCheckout = trackBeginCheckout;
window.trackPurchase = trackPurchase;
window.trackSearch = trackSearch;
window.trackSignup = trackSignup;
window.trackLogin = trackLogin;
window.trackAddToWishlist = trackAddToWishlist;
window.trackShare = trackShare;
window.trackCouponUsage = trackCouponUsage;

console.log('✅ GA4 E-commerce tracking helpers loaded');
