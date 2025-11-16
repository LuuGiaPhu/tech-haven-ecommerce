// =====================================
// REAL-TIME RATING SYSTEM WITH WEBSOCKET
// =====================================

let ratingsSocket = null;
let ratingsListener = null;
let currentProductId = null;
let currentUserId = null;
let ratingsData = [];
let isLoadingRatings = false;
let ratingsPerPage = 10;
let currentRatingPage = 0;

// Initialize rating system when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Rating System Initializing...');
    
    // Get product ID from the page
    currentProductId = getProductIdFromPage();
    if (!currentProductId) {
        console.warn('⚠️ Product ID not found on page');
        return;
    }
    
    console.log('📦 Product ID found:', currentProductId);
    
    // Initialize rating system
    initializeRatingSystem();
});

// Get product ID from page elements (reuse from comment system)
function getProductIdFromPage() {
    // Try multiple ways to get product ID
    const productElement = document.querySelector('[data-product-id]');
    if (productElement) {
        return productElement.getAttribute('data-product-id');
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

// Initialize the complete rating system
async function initializeRatingSystem() {
    console.log('🎯 Initializing rating system for product:', currentProductId);
    
    // Wait for authentication to be ready
    await waitForAuth();
    
    // Setup UI based on auth state
    setupRatingUI();
    
    // Setup Firebase auth state listener for dynamic UI updates
    if (window.firebaseAuth) {
        window.firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                currentUserId = user.uid;
                console.log('👤 User authenticated in rating system:', user.uid);
            } else {
                currentUserId = null;
                console.log('👤 User signed out in rating system');
            }
            refreshRatingUIOnAuthChange();
        });
    }
    
    // Initialize WebSocket connection
    initializeRatingWebSocket();
    
    // Setup Firebase real-time listener
    setupFirebaseRatingsListener();
    
    // Load initial ratings
    await loadRatings();
    
    // Setup event listeners
    setupRatingEventListeners();
    
    console.log('✅ Rating system initialized successfully');
}

// Wait for authentication to be ready
function waitForAuth() {
    return new Promise((resolve) => {
        if (window.currentUser) {
            currentUserId = window.currentUser.uid;
            resolve();
            return;
        }
        
        if (window.firebaseAuth) {
            const unsubscribe = window.firebaseAuth.onAuthStateChanged((user) => {
                if (user) {
                    currentUserId = user.uid;
                    window.currentUser = user;
                } else {
                    currentUserId = null;
                    window.currentUser = null;
                }
                unsubscribe();
                resolve();
            });
        } else {
            // Wait a bit for Firebase to load
            setTimeout(() => {
                if (window.firebaseAuth?.currentUser) {
                    currentUserId = window.firebaseAuth.currentUser.uid;
                    window.currentUser = window.firebaseAuth.currentUser;
                }
                resolve();
            }, 1000);
        }
    });
}

// Setup rating UI based on authentication state
function setupRatingUI() {
    console.log('🎨 Setting up rating UI for user:', currentUserId);
    
    const ratingForm = document.getElementById('ratingForm');
    const ratingStars = document.querySelectorAll('.rating-input .star');
    const submitBtn = document.querySelector('.btn-rating-submit');
    
    // Get user from multiple possible sources
    const user = window.currentUser || window.firebaseAuth?.currentUser;
    
    if (currentUserId && user) {
        console.log('👤 Setting up UI for logged in user:', user.displayName || user.email);
        
        // Enable rating form
        if (ratingForm) {
            ratingForm.style.display = 'block';
        }
        
        // Enable rating stars
        ratingStars.forEach(star => {
            star.style.pointerEvents = 'auto';
            star.style.opacity = '1';
        });
        
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    } else {
        console.log('👤 Setting up UI for guest user');
        
        // Disable rating form for guests
        if (ratingForm) {
            ratingForm.style.display = 'none';
        }
        
        // Show login prompt instead
        const loginPrompt = document.getElementById('ratingLoginPrompt');
        if (loginPrompt) {
            loginPrompt.style.display = 'block';
        }
    }
}

// Refresh rating UI when auth state changes
function refreshRatingUIOnAuthChange() {
    console.log('🔄 Refreshing rating UI due to auth change');
    
    // Re-check auth state
    const user = window.currentUser || window.firebaseAuth?.currentUser;
    if (user && user.uid) {
        currentUserId = user.uid;
    } else {
        currentUserId = null;
    }
    
    // Update UI
    setupRatingUI();
}

// Initialize WebSocket connection for real-time updates
function initializeRatingWebSocket() {
    // For now, we'll use Firebase real-time listeners
    // WebSocket can be added later for additional real-time features
    console.log('🔌 Rating WebSocket initialization (using Firebase real-time listeners)');
}

// Setup Firebase real-time listener for ratings
function setupFirebaseRatingsListener() {
    if (!window.firebase?.firestore) {
        console.warn('⚠️ Firebase Firestore not available');
        return;
    }
    
    // Stop existing listener if any
    if (ratingsListener) {
        ratingsListener();
        ratingsListener = null;
    }
    
    const db = window.firebase.firestore();
    
    console.log('🎧 Setting up real-time ratings listener for product:', currentProductId);
    
    // Listen to rates collection for this product
    ratingsListener = db.collection('rates')
        .where('productId', '==', currentProductId)
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            console.log('📊 Ratings snapshot received:', snapshot.size, 'ratings');
            
            ratingsData = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                ratingsData.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
                });
            });
            
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
    
    try {
        const db = window.firebase.firestore();
        
        console.log('📥 Loading ratings for product:', currentProductId);
        
        const snapshot = await db.collection('rates')
            .where('productId', '==', currentProductId)
            .orderBy('createdAt', 'desc')
            .limit(ratingsPerPage)
            .get();
        
        ratingsData = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            ratingsData.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
            });
        });
        
        console.log('✅ Loaded', ratingsData.length, 'ratings');
        
        renderRatings();
        updateRatingSummary();
        
    } catch (error) {
        console.error('❌ Error loading ratings:', error);
    } finally {
        isLoadingRatings = false;
    }
}

// Render ratings in the UI
function renderRatings() {
    const ratingsList = document.getElementById('ratingsList');
    if (!ratingsList) return;
    
    if (ratingsData.length === 0) {
        ratingsList.innerHTML = `
            <div class="ratings-placeholder">
                <p style="text-align: center; color: #666; padding: 2rem;">
                    <i class="fas fa-star" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                    Chưa có đánh giá nào. Hãy là người đầu tiên đánh giá sản phẩm này!
                </p>
            </div>
        `;
        return;
    }
    
    let ratingsHTML = '';
    
    ratingsData.forEach(rating => {
        ratingsHTML += renderIndividualRating(rating);
    });
    
    ratingsList.innerHTML = ratingsHTML;
}

// Render individual rating
function renderIndividualRating(rating) {
    const timeAgo = getTimeAgo(rating.createdAt);
    const canDelete = currentUserId === rating.userId;
    
    const stars = generateStarsHTML(rating.stars);
    
    return `
        <div class="rating-item" data-rating-id="${rating.id}">
            <div class="rating-header">
                <div class="rating-user">
                    <div class="user-info">
                        <span class="rating-username">${rating.userDisplayName || 'Người dùng'}</span>
                        <span class="rating-time">${timeAgo}</span>
                    </div>
                    <div class="rating-stars">
                        ${stars}
                    </div>
                </div>
                ${canDelete ? `
                    <div class="rating-actions">
                        <button class="btn-delete-rating" onclick="deleteRating('${rating.id}')" title="Xóa đánh giá">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
            ${rating.content ? `<div class="rating-content">${escapeHtml(rating.content)}</div>` : ''}
        </div>
    `;
}

// Generate stars HTML
function generateStarsHTML(stars) {
    let starsHTML = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= stars) {
            starsHTML += '<i class="fas fa-star"></i>';
        } else {
            starsHTML += '<i class="far fa-star"></i>';
        }
    }
    return starsHTML;
}

// Update rating summary
function updateRatingSummary() {
    if (ratingsData.length === 0) {
        // Show default summary
        const avgRatingElement = document.querySelector('.rating-number');
        const reviewCountElement = document.querySelector('.review-count');
        
        if (avgRatingElement) avgRatingElement.textContent = '0.0';
        if (reviewCountElement) reviewCountElement.textContent = '(0 đánh giá)';
        
        return;
    }
    
    // Calculate average rating
    const totalStars = ratingsData.reduce((sum, rating) => sum + rating.stars, 0);
    const averageRating = (totalStars / ratingsData.length).toFixed(1);
    
    // Update UI elements
    const avgRatingElement = document.querySelector('.rating-number');
    const reviewCountElement = document.querySelector('.review-count');
    const starsContainer = document.querySelector('.rating-summary .stars');
    
    if (avgRatingElement) {
        avgRatingElement.textContent = averageRating;
    }
    
    if (reviewCountElement) {
        reviewCountElement.textContent = `(${ratingsData.length} đánh giá)`;
    }
    
    if (starsContainer) {
        starsContainer.innerHTML = generateStarsHTML(Math.round(averageRating));
    }
    
    console.log('📊 Updated rating summary:', averageRating, 'stars,', ratingsData.length, 'reviews');
}

// Setup event listeners
function setupRatingEventListeners() {
    // Rating form submission
    const ratingForm = document.getElementById('ratingForm');
    if (ratingForm) {
        ratingForm.addEventListener('submit', handleRatingSubmit);
    }
    
    // Rating stars interaction
    setupRatingStarsInteraction();
    
    // Global functions for rating interactions
    window.deleteRating = deleteRating;
    window.loadMoreRatings = loadMoreRatings;
}

// Setup rating stars interaction
function setupRatingStarsInteraction() {
    const stars = document.querySelectorAll('.rating-input .star');
    let selectedRating = 0;
    
    stars.forEach((star, index) => {
        star.addEventListener('mouseover', () => {
            highlightStars(index + 1);
        });
        
        star.addEventListener('mouseout', () => {
            highlightStars(selectedRating);
        });
        
        star.addEventListener('click', () => {
            selectedRating = index + 1;
            highlightStars(selectedRating);
            
            // Store selected rating
            const ratingInput = document.getElementById('selectedRating');
            if (ratingInput) {
                ratingInput.value = selectedRating;
            }
        });
    });
}

// Highlight stars
function highlightStars(rating) {
    const stars = document.querySelectorAll('.rating-input .star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

// Handle rating form submission
async function handleRatingSubmit(event) {
    event.preventDefault();
    
    if (!currentUserId) {
        alert('Vui lòng đăng nhập để đánh giá sản phẩm!');
        return;
    }
    
    const selectedRating = parseInt(document.getElementById('selectedRating')?.value);
    const ratingContent = document.getElementById('ratingContent')?.value?.trim();
    const submitBtn = document.querySelector('.btn-rating-submit');
    
    if (!selectedRating || selectedRating < 1 || selectedRating > 5) {
        alert('Vui lòng chọn số sao đánh giá!');
        return;
    }
    
    // Disable form during submission
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
    }
    
    try {
        await submitRating(selectedRating, ratingContent);
        
        // Clear form
        clearRatingForm();
        
        // Show success message
        showRatingSuccess('Đánh giá của bạn đã được gửi thành công!');
        
    } catch (error) {
        console.error('❌ Error submitting rating:', error);
        showRatingError('Có lỗi xảy ra khi gửi đánh giá. Vui lòng thử lại!');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Gửi đánh giá';
        }
    }
}

// Submit a new rating to Firebase
async function submitRating(stars, content = '') {
    if (!window.firebase?.firestore || !currentUserId) {
        throw new Error('Firebase not available or user not authenticated');
    }
    
    const db = window.firebase.firestore();
    const user = window.currentUser;
    
    // Get user photo from users collection
    let userPhoto = user.photoURL || null;
    
    console.log('🔍 Fetching user photo from users collection for rating...');
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
    
    console.log('📤 Submitting rating:', {
        productId: ratingData.productId,
        userId: ratingData.userId,
        stars: ratingData.stars,
        content: ratingData.content?.substring(0, 50) + '...'
    });
    
    const docRef = await db.collection('rates').add(ratingData);
    
    console.log('✅ Rating submitted with ID:', docRef.id);
    
    return docRef.id;
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
        await db.collection('rates').doc(ratingId).delete();
        
        console.log('✅ Rating deleted:', ratingId);
        showRatingSuccess('Đánh giá đã được xóa thành công!');
        
    } catch (error) {
        console.error('❌ Error deleting rating:', error);
        showRatingError('Có lỗi xảy ra khi xóa đánh giá!');
    }
}

// Clear rating form
function clearRatingForm() {
    const ratingContent = document.getElementById('ratingContent');
    const selectedRating = document.getElementById('selectedRating');
    const stars = document.querySelectorAll('.rating-input .star');
    
    if (ratingContent) {
        ratingContent.value = '';
    }
    
    if (selectedRating) {
        selectedRating.value = '';
    }
    
    stars.forEach(star => {
        star.classList.remove('active');
    });
}

// Load more ratings (pagination)
async function loadMoreRatings() {
    console.log('Loading more ratings...');
    // Implementation for pagination if needed
}

// Utility functions
function getTimeAgo(date) {
    if (!date) return 'Vừa xong';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'Vừa xong';
    } else if (diffInSeconds < 3600) {
        return `${Math.floor(diffInSeconds / 60)} phút trước`;
    } else if (diffInSeconds < 86400) {
        return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    } else {
        return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showRatingSuccess(message) {
    if (typeof showNotification === 'function') {
        showNotification(message, 'success');
    } else {
        alert(message);
    }
}

function showRatingError(message) {
    if (typeof showNotification === 'function') {
        showNotification(message, 'error');
    } else {
        alert(message);
    }
}

// Cleanup function
function cleanupRatingSystem() {
    if (ratingsListener) {
        ratingsListener();
        ratingsListener = null;
    }
    
    if (ratingsSocket) {
        ratingsSocket.close();
        ratingsSocket = null;
    }
}

// Clean up when page unloads
window.addEventListener('beforeunload', cleanupRatingSystem);

// Export functions for global access
window.initializeRatingSystem = initializeRatingSystem;
window.setupRatingUI = setupRatingUI;
window.deleteRating = deleteRating;
window.loadMoreRatings = loadMoreRatings;

console.log('✅ Rating System loaded successfully');