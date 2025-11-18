// =====================================
// BILL DETAIL PAGE JAVASCRIPT
// Fetches and displays user's order history from Firestore
// Independent from script.js - manages its own Firebase connection
// =====================================

console.log('🧾 Bill Detail JS loaded');
console.log('🔍 Checking window.currentUser:', window.currentUser);
console.log('🔍 Checking localStorage userData:', localStorage.getItem('userData'));

let currentUser = null;
let allBills = [];
let currentFilter = 'all';
let unsubscribeBills = null; // Store listener unsubscribe function

// Check for existing user from parent window (index.ejs)
function checkExistingUser() {
    console.log('🔍 Checking for existing user from parent window...');
    
    // Try to get user from window.currentUser (set by index.ejs)
    if (window.currentUser) {
        console.log('✅ Found existing user from parent window:', {
            uid: window.currentUser.uid,
            email: window.currentUser.email,
            displayName: window.currentUser.displayName || window.currentUser.name
        });
        return window.currentUser;
    }
    
    // Try to get user from localStorage (backup)
    const storedUserData = localStorage.getItem('userData');
    if (storedUserData) {
        try {
            const userData = JSON.parse(storedUserData);
            console.log('✅ Found user in localStorage:', userData);
            return userData;
        } catch (error) {
            console.error('❌ Error parsing stored user data:', error);
        }
    }
    
    return null;
}

// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📋 Initializing Bill Detail page...');
    
    // Check if Firebase is initialized
    if (!firebase || !firebase.apps.length) {
        console.error('❌ Firebase not initialized!');
        showErrorMessage('Firebase configuration error. Please refresh the page.');
        return;
    }
    
    // First, try to get existing user from parent window
    const existingUser = checkExistingUser();
    if (existingUser && existingUser.uid) {
        console.log('✅ Using existing user from parent window');
        currentUser = existingUser;
        await loadUserBills();
        initializeFilterTabs();
        initializeModal();
        
        // Check for pre-selected order from URL
        if (window.preSelectedOrder) {
            console.log('🎯 Pre-selected order detected, opening modal...');
            setTimeout(() => {
                showBillDetail(window.preSelectedOrder);
            }, 500); // Small delay to ensure modal is ready
        }
        return;
    }
    
    // Wait for Firebase Auth to be ready
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            console.log('👤 User logged in via Firebase Auth:', user.email);
            console.log('🔑 User ID:', user.uid);
            await loadUserBills();
            initializeFilterTabs();
            
            // Check for pre-selected order from URL
            if (window.preSelectedOrder) {
                console.log('🎯 Pre-selected order detected, opening modal...');
                setTimeout(() => {
                    showBillDetail(window.preSelectedOrder);
                }, 500); // Small delay to ensure modal is ready
            }
        } else {
            console.warn('⚠️ No user logged in, redirecting to home...');
            showErrorMessage('Vui lòng đăng nhập để xem lịch sử đơn hàng');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        }
    });
    
    // Initialize modal close handlers
    initializeModal();
});

// Load user's bills from Firestore with real-time updates
async function loadUserBills() {
    try {
        // Validate currentUser exists
        if (!currentUser || !currentUser.uid) {
            console.error('❌ No current user found');
            showErrorMessage('User not authenticated. Please login.');
            return;
        }
        
        showLoading(true);
        console.log('📥 Setting up real-time listener for user:', currentUser.uid);
        console.log('📧 User email:', currentUser.email || currentUser.emailAddress || 'N/A');
        
        const db = firebase.firestore();
        const billsRef = db.collection('bills');
        
        // Unsubscribe from previous listener if exists
        if (unsubscribeBills) {
            console.log('🔌 Unsubscribing from previous listener');
            unsubscribeBills();
        }
        
        // Set up real-time listener
        console.log('🔍 Setting up Firestore real-time listener: bills collection where userId ==', currentUser.uid);
        unsubscribeBills = billsRef
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .onSnapshot(
                (snapshot) => {
                    console.log('🔔 Real-time update received:', snapshot.size, 'documents');
                    
                    // Track changes for notifications
                    const changes = {
                        added: [],
                        modified: [],
                        removed: []
                    };
                    
                    snapshot.docChanges().forEach((change) => {
                        const billData = {
                            id: change.doc.id,
                            ...change.doc.data()
                        };
                        
                        if (change.type === 'added') {
                            changes.added.push(billData);
                            console.log('➕ Bill added:', change.doc.id);
                        }
                        if (change.type === 'modified') {
                            changes.modified.push(billData);
                            console.log('✏️ Bill modified:', change.doc.id, 'New status:', billData.status);
                        }
                        if (change.type === 'removed') {
                            changes.removed.push(billData);
                            console.log('➖ Bill removed:', change.doc.id);
                        }
                    });
                    
                    // Update allBills array
                    allBills = [];
                    snapshot.forEach((doc) => {
                        const billData = doc.data();
                        allBills.push({
                            id: doc.id,
                            ...billData
                        });
                    });
                    
                    console.log(`✅ Updated bills list: ${allBills.length} total bills`);
                    
                    // Show notification for modified bills (status changes)
                    if (changes.modified.length > 0) {
                        changes.modified.forEach(bill => {
                            showStatusChangeNotification(bill);
                        });
                    }
                    
                    // Update UI
                    updateStats();
                    renderBills(currentFilter);
                    showLoading(false);
                },
                (error) => {
                    console.error('❌ Error in real-time listener:', error);
                    console.error('Error details:', error.message);
                    showLoading(false);
                    
                    // Show detailed error message based on error type
                    if (error.code === 'failed-precondition' || error.message.includes('index')) {
                        // Index is still being created
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'index-building-message';
                        errorDiv.innerHTML = `
                            <div style="text-align: center; padding: 60px 20px;">
                                <i class="fas fa-hourglass-half" style="font-size: 80px; color: #E5D4FF; margin-bottom: 30px; animation: spin 2s linear infinite;"></i>
                                <h2 style="color: #333; margin-bottom: 20px; font-size: 32px;">⏳ Đang khởi tạo cơ sở dữ liệu...</h2>
                                <p style="color: #666; font-size: 18px; margin-bottom: 30px; max-width: 600px; margin-left: auto; margin-right: auto;">
                                    Database index đang được tạo để tối ưu hóa tốc độ truy vấn. 
                                    Quá trình này thường mất <strong>1-2 phút</strong>.
                                </p>
                                <div style="background: linear-gradient(135deg, #FFD6E8 0%, #E5D4FF 100%); padding: 20px; border-radius: 15px; margin: 30px auto; max-width: 500px;">
                                    <p style="margin: 0; color: #333; font-size: 16px;">
                                        💡 <strong>Mẹo:</strong> Hãy thử lại sau <strong>1 phút</strong> bằng cách nhấn nút bên dưới
                                    </p>
                                </div>
                                <button onclick="location.reload()" style="
                                    background: linear-gradient(135deg, #E5D4FF 0%, #FFD6E8 100%);
                                    color: #333;
                                    border: none;
                                    padding: 15px 40px;
                                    border-radius: 30px;
                                    font-size: 18px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    box-shadow: 0 4px 15px rgba(229, 212, 255, 0.4);
                                    transition: all 0.3s ease;
                                    margin-top: 20px;
                                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(229, 212, 255, 0.6)';" 
                                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(229, 212, 255, 0.4)';">
                                    🔄 Thử lại ngay
                                </button>
                                <p style="margin-top: 20px; color: #999; font-size: 14px;">
                                    Trang sẽ tự động tải lại sau <span id="countdown">60</span> giây...
                                </p>
                            </div>
                            <style>
                                @keyframes spin {
                                    0% { transform: rotate(0deg); }
                                    100% { transform: rotate(360deg); }
                                }
                            </style>
                        `;
                        
                        // Replace bill cards container with error message
                        const billsGrid = document.querySelector('.bills-grid');
                        if (billsGrid) {
                            billsGrid.innerHTML = '';
                            billsGrid.appendChild(errorDiv);
                        }
                        
                        // Auto reload after 60 seconds
                        let countdown = 60;
                        const countdownInterval = setInterval(() => {
                            countdown--;
                            const countdownEl = document.getElementById('countdown');
                            if (countdownEl) {
                                countdownEl.textContent = countdown;
                            }
                            if (countdown <= 0) {
                                clearInterval(countdownInterval);
                                location.reload();
                            }
                        }, 1000);
                        
                    } else if (error.code === 'permission-denied') {
                        showErrorMessage('Bạn không có quyền xem đơn hàng. Vui lòng đăng nhập lại.');
                    } else {
                        showErrorMessage('Không thể tải lịch sử đơn hàng: ' + error.message);
                    }
                }
            );
        
        console.log('✅ Real-time listener set up successfully');
        
    } catch (error) {
        console.error('❌ Error setting up real-time listener:', error);
        console.error('Error details:', error.message);
        showLoading(false);
        showErrorMessage('Không thể thiết lập kết nối real-time: ' + error.message);
    }
}

// Update statistics cards
function updateStats() {
    const stats = {
        all: allBills.length,
        pending: allBills.filter(b => b.status === 'pending').length,
        processing: allBills.filter(b => b.status === 'processing').length,
        shipping: allBills.filter(b => b.status === 'shipping').length,
        delivered: allBills.filter(b => b.status === 'delivered').length,
        completed: allBills.filter(b => b.status === 'completed').length,
        cancelled: allBills.filter(b => b.status === 'cancelled').length,
        returned: allBills.filter(b => b.status === 'returned').length
    };
    
    document.querySelector('.stat-all .stat-number').textContent = stats.all;
    document.querySelector('.stat-pending .stat-number').textContent = stats.pending;
    document.querySelector('.stat-processing .stat-number').textContent = stats.processing;
    document.querySelector('.stat-shipping .stat-number').textContent = stats.shipping;
    document.querySelector('.stat-delivered .stat-number').textContent = stats.delivered;
    document.querySelector('.stat-completed .stat-number').textContent = stats.completed;
    document.querySelector('.stat-cancelled .stat-number').textContent = stats.cancelled;
    document.querySelector('.stat-returned .stat-number').textContent = stats.returned;
}

// Initialize filter tabs
function initializeFilterTabs() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            filterTabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Get filter value and render bills
            currentFilter = tab.dataset.filter;
            console.log('🔍 Filter changed to:', currentFilter);
            renderBills(currentFilter);
        });
    });
}

// Render bills based on filter
function renderBills(filter = 'all') {
    const billsList = document.querySelector('.bills-list');
    
    // Filter bills based on status
    let filteredBills = allBills;
    if (filter !== 'all') {
        filteredBills = allBills.filter(bill => bill.status === filter);
    }
    
    console.log(`📊 Rendering ${filteredBills.length} bills with filter: ${filter}`);
    
    // Check if empty
    if (filteredBills.length === 0) {
        billsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <h3>No orders found</h3>
                <p>You don't have any ${filter === 'all' ? '' : filter} orders yet.</p>
                ${filter === 'all' ? '<a href="/shop" class="shop-now-btn"><i class="fas fa-shopping-bag"></i> Start Shopping</a>' : ''}
            </div>
        `;
        return;
    }
    
    // Render bill cards
    billsList.innerHTML = filteredBills.map(bill => createBillCard(bill)).join('');
    
    // Add click handlers to view detail buttons
    document.querySelectorAll('.view-detail-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const billId = btn.dataset.billId;
            const bill = allBills.find(b => b.id === billId);
            if (bill) {
                showBillDetail(bill);
            }
        });
    });
    
    // Add click handler to entire card
    document.querySelectorAll('.bill-card').forEach(card => {
        card.addEventListener('click', () => {
            const billId = card.dataset.billId;
            const bill = allBills.find(b => b.id === billId);
            if (bill) {
                showBillDetail(bill);
            }
        });
    });
}

// Create HTML for a single bill card
function createBillCard(bill) {
    const statusClass = `status-${bill.status || 'pending'}`;
    const statusText = getStatusText(bill.status || 'pending');
    const statusIcon = getStatusIcon(bill.status || 'pending');
    const date = formatDate(bill.createdAt || bill.updatedAt);
    const totalAmount = formatCurrency(bill.totalAmount || 0);
    
    // Ensure products is an array
    const products = Array.isArray(bill.products) ? bill.products : [];
    
    // Show first 3 products
    const productsPreview = products.slice(0, 3).map(p => `
        <div class="product-item">
            <span class="product-name">${escapeHtml(p.name || 'Product')}</span>
            <span class="product-quantity">x${p.quantity || 1}</span>
            <span class="product-price">${formatCurrency(p.price || 0)}</span>
        </div>
    `).join('');
    
    const moreProducts = products.length > 3 ? 
        `<div class="product-item" style="color: #999; font-style: italic;">
            + ${products.length - 3} more products
        </div>` : '';
    
    return `
        <div class="bill-card ${statusClass}" data-bill-id="${bill.id}">
            <div class="bill-header">
                <div class="bill-id-section">
                    <div class="bill-id">Order #${bill.id.substring(0, 8).toUpperCase()}</div>
                    <div class="bill-date">
                        <i class="fas fa-calendar-alt"></i>
                        ${date}
                    </div>
                </div>
                <span class="bill-status ${statusClass}">
                    <i class="${statusIcon}"></i>
                    ${statusText}
                </span>
            </div>
            
            <div class="bill-products">
                ${productsPreview || '<div class="product-item" style="color: #999;">No products</div>'}
                ${moreProducts}
            </div>
            
            <div class="bill-footer">
                <div class="bill-total">
                    Total: <strong>${totalAmount}</strong>
                </div>
                <div class="bill-actions">
                    ${bill.status === 'delivered' || (bill.status === 'completed' && !bill.confirmDeliveryDate) ? `
                        <button class="confirm-delivery-card-btn" onclick="confirmDelivery('${bill.id}'); event.stopPropagation();">
                            <i class="fas fa-check-double"></i>
                            Xác Nhận Đã Nhận
                        </button>
                    ` : ''}
                    ${bill.status === 'completed' && bill.confirmDeliveryDate ? (() => {
                        console.log('🔍 Checking return button for bill:', bill.id);
                        console.log('   Status:', bill.status);
                        console.log('   confirmDeliveryDate:', bill.confirmDeliveryDate);
                        
                        const confirmDate = new Date(bill.confirmDeliveryDate.toDate ? bill.confirmDeliveryDate.toDate() : bill.confirmDeliveryDate);
                        const now = new Date();
                        const daysDiff = Math.floor((now - confirmDate) / (1000 * 60 * 60 * 24));
                        const daysLeft = 7 - daysDiff;
                        
                        console.log('   Days since confirmation:', daysDiff);
                        console.log('   Days left to return:', daysLeft);
                        
                        if (daysDiff <= 7) {
                            console.log('✅ Return button will be shown');
                            return `
                                <button class="return-order-card-btn" onclick="returnOrder('${bill.id}'); event.stopPropagation();">
                                    <i class="fas fa-undo"></i>
                                    Trả Hàng (${daysLeft} ngày)
                                </button>
                            `;
                        }
                        console.log('❌ Return window expired');
                        return '';
                    })() : (() => {
                        console.log('❌ Return button NOT shown for bill:', bill.id);
                        console.log('   Status:', bill.status);
                        console.log('   confirmDeliveryDate exists:', !!bill.confirmDeliveryDate);
                        return '';
                    })()}
                    ${bill.status !== 'completed' && bill.status !== 'cancelled' && bill.status !== 'returned' ? `
                        <button class="cancel-bill-btn" onclick="cancelBill('${bill.id}'); event.stopPropagation();">
                            <i class="fas fa-times-circle"></i>
                            Hủy Đơn
                        </button>
                    ` : ''}
                    <button class="view-detail-btn" data-bill-id="${bill.id}">
                        <i class="fas fa-eye"></i>
                        View Details
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Show bill detail in modal
function showBillDetail(bill) {
    console.log('📄 Showing bill detail:', bill.id);
    
    const modal = document.getElementById('billDetailModal');
    const modalBody = modal.querySelector('.modal-body');
    
    const statusClass = `status-${bill.status || 'pending'}`;
    const statusText = getStatusText(bill.status || 'pending');
    const statusIcon = getStatusIcon(bill.status || 'pending');
    const date = formatDate(bill.createdAt || bill.updatedAt);
    
    // Ensure products is an array
    const products = Array.isArray(bill.products) ? bill.products : [];
    
    // Build products list
    const productsList = products.map(p => `
        <div class="product-detail-item">
            <span class="product-detail-name">${escapeHtml(p.name || 'Product')}</span>
            <span class="product-detail-qty">x${p.quantity || 1}</span>
            <span class="product-detail-price">${formatCurrency((p.price || 0) * (p.quantity || 1))}</span>
        </div>
    `).join('');
    
    // Calculate totals with safe number handling
    const subtotal = products.reduce((sum, p) => {
        const price = parseFloat(p.price) || 0;
        const quantity = parseInt(p.quantity) || 1;
        return sum + (price * quantity);
    }, 0);
    const discount = parseFloat(bill.discount) || 0;
    const shipping = parseFloat(bill.shippingFee) || 0;
    const total = parseFloat(bill.totalAmount) || (subtotal - discount + shipping);
    
    modalBody.innerHTML = `
        <!-- Delivery Tracking Animation -->
        <div class="detail-section delivery-tracking">
            <h4><i class="fas fa-shipping-fast"></i> Theo Dõi Vận Chuyển</h4>
            <div class="tracking-container">
                <div class="tracking-road">
                    <div class="road-line"></div>
                    <div class="road-start">
                        <i class="fas fa-store"></i>
                        <span>Kho hàng</span>
                    </div>
                    <div class="road-end">
                        <i class="fas fa-home"></i>
                        <span>Nhà bạn</span>
                    </div>
                    <div class="delivery-truck ${bill.status}" style="--progress: ${calculateDeliveryProgress(bill)}%">
                        <i class="fas fa-truck"></i>
                        ${bill.status === 'cancelled' || bill.status === 'returned' ? '<div class="warning-sign"><i class="fas fa-exclamation-triangle"></i></div>' : ''}
                    </div>
                    ${bill.status === 'cancelled' ? '<div class="cancelled-message">⚠️ Đơn hàng đã bị hủy</div>' : ''}
                    ${bill.status === 'returned' ? '<div class="cancelled-message">⚠️ Đơn hàng đã được trả lại</div>' : ''}
                </div>
                <div class="tracking-status">
                    ${getTrackingStatusText(bill)}
                </div>
            </div>
        </div>
        
        <!-- Order Status -->
        <div class="detail-section">
            <h4><i class="fas fa-info-circle"></i> Order Status</h4>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Order ID</div>
                    <div class="info-value">#${bill.id.substring(0, 8).toUpperCase()}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Date</div>
                    <div class="info-value">${date}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Status</div>
                    <div class="info-value">
                        <span class="bill-status ${statusClass}">
                            <i class="${statusIcon}"></i>
                            ${statusText}
                        </span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Customer Info -->
        <div class="detail-section">
            <h4><i class="fas fa-user"></i> Customer Information</h4>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Name</div>
                    <div class="info-value">${escapeHtml(bill.customerInfo?.name || bill.customerInfo?.fullName || bill.name || 'N/A')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Phone</div>
                    <div class="info-value">${escapeHtml(bill.customerInfo?.phone || bill.phone || 'N/A')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Email</div>
                    <div class="info-value">${escapeHtml(bill.customerInfo?.email || bill.email || currentUser?.email || 'N/A')}</div>
                </div>
            </div>
        </div>
        
        <!-- Shipping Address -->
        <div class="detail-section">
            <h4><i class="fas fa-map-marker-alt"></i> Shipping Address</h4>
            <div class="info-item">
                <div class="info-value">${escapeHtml(getFullAddress(bill))}</div>
            </div>
        </div>
        
        <!-- Products -->
        <div class="detail-section">
            <h4><i class="fas fa-box"></i> Products (${products.length})</h4>
            <div class="product-list">
                ${productsList || '<p>No products</p>'}
            </div>
        </div>
        
        <!-- Order Summary -->
        <div class="detail-section">
            <h4><i class="fas fa-receipt"></i> Order Summary</h4>
            <div class="summary-grid">
                <div class="summary-row">
                    <span>Subtotal:</span>
                    <span>${formatCurrency(subtotal)}</span>
                </div>
                ${discount > 0 ? `
                    <div class="summary-row">
                        <span>Discount:</span>
                        <span>-${formatCurrency(discount)}</span>
                    </div>
                ` : ''}
                ${shipping > 0 ? `
                    <div class="summary-row">
                        <span>Shipping Fee:</span>
                        <span>${formatCurrency(shipping)}</span>
                    </div>
                ` : ''}
                <div class="summary-row">
                    <span>Total Amount:</span>
                    <span><strong>${formatCurrency(total)}</strong></span>
                </div>
            </div>
        </div>
        
        ${bill.note ? `
            <div class="detail-section">
                <h4><i class="fas fa-sticky-note"></i> Order Note</h4>
                <div class="info-item">
                    <div class="info-value">${escapeHtml(bill.note)}</div>
                </div>
            </div>
        ` : ''}
        
        <!-- Confirm Delivery Button (show for delivered OR completed without confirmDeliveryDate) -->
        ${bill.status === 'delivered' || (bill.status === 'completed' && !bill.confirmDeliveryDate) ? `
            <div class="detail-section confirm-delivery-section">
                <button class="confirm-delivery-btn" onclick="confirmDelivery('${bill.id}')">
                    <i class="fas fa-check-double"></i>
                    Xác Nhận Đã Nhận Hàng
                </button>
                <p class="confirm-note">Nhấn nút này khi bạn đã nhận được hàng và kiểm tra đầy đủ</p>
            </div>
        ` : ''}
        
        <!-- Return Order Button (only show for completed orders within 7 days of confirmation) -->
        ${bill.status === 'completed' && bill.confirmDeliveryDate ? (() => {
            const confirmDate = new Date(bill.confirmDeliveryDate.toDate ? bill.confirmDeliveryDate.toDate() : bill.confirmDeliveryDate);
            const now = new Date();
            const daysDiff = Math.floor((now - confirmDate) / (1000 * 60 * 60 * 24));
            const daysLeft = 7 - daysDiff;
            
            if (daysDiff <= 7) {
                return `
                    <div class="detail-section return-order-section">
                        <button class="return-order-btn" onclick="returnOrder('${bill.id}')">
                            <i class="fas fa-undo"></i>
                            Trả Hàng / Hoàn Trả
                        </button>
                        <p class="return-note">
                            <i class="fas fa-clock"></i> 
                            Còn ${daysLeft} ngày để trả hàng (xác nhận ngày ${confirmDate.toLocaleDateString('vi-VN')})
                        </p>
                        <p class="return-info">⚠️ Trả hàng sẽ hoàn trả số lượng sản phẩm về kho</p>
                    </div>
                `;
            }
            return '';
        })() : ''}
        
        <!-- Cancel Bill Button (only show if not completed or cancelled or returned) -->
        ${bill.status !== 'completed' && bill.status !== 'cancelled' && bill.status !== 'returned' ? `
            <div class="detail-section cancel-bill-section">
                <button class="cancel-bill-modal-btn" onclick="cancelBill('${bill.id}')">
                    <i class="fas fa-times-circle"></i>
                    Hủy Đơn Hàng
                </button>
                <p class="cancel-note">⚠️ Hủy đơn hàng sẽ hoàn trả số lượng sản phẩm về kho</p>
            </div>
        ` : ''}
    `;
    
    modal.classList.add('active');
}

// Initialize modal handlers
function initializeModal() {
    const modal = document.getElementById('billDetailModal');
    const closeBtn = modal.querySelector('.close-modal');
    
    // Close on button click
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
    });
}

// Utility: Format date
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        let date;
        if (timestamp && typeof timestamp.toDate === 'function') {
            // Firestore Timestamp
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else if (timestamp && timestamp.seconds) {
            // Firestore Timestamp object with seconds
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.warn('Invalid date:', timestamp);
            return 'N/A';
        }
        
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Ho_Chi_Minh'
        };
        
        return date.toLocaleDateString('vi-VN', options);
    } catch (error) {
        console.error('Error formatting date:', error, timestamp);
        return 'N/A';
    }
}

// Utility: Format currency
function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        amount = parseFloat(amount) || 0;
    }
    
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

// Utility: Get status text
function getStatusText(status) {
    const statusMap = {
        'pending': 'Chờ Xử Lý',
        'processing': 'Đang Xử Lý',
        'shipping': 'Đang Vận Chuyển',
        'delivered': 'Đã Giao',
        'completed': 'Hoàn Thành',
        'cancelled': 'Đã Hủy',
        'returned': 'Đã Trả Hàng'
    };
    
    return statusMap[status] || status;
}

// Utility: Get status icon
function getStatusIcon(status) {
    const iconMap = {
        'pending': 'fas fa-clock',
        'processing': 'fas fa-spinner',
        'shipping': 'fas fa-truck',
        'delivered': 'fas fa-box-open',
        'completed': 'fas fa-check-circle',
        'cancelled': 'fas fa-times-circle',
        'returned': 'fas fa-undo'
    };
    
    return iconMap[status] || 'fas fa-info-circle';
}

// Utility: Get full address from bill data
function getFullAddress(bill) {
    // Try different address formats
    if (bill.address) {
        if (typeof bill.address === 'string') {
            return bill.address;
        }
        if (bill.address.fullAddress) {
            return bill.address.fullAddress;
        }
        // Construct from parts
        const parts = [
            bill.address.address,
            bill.address.district,
            bill.address.city
        ].filter(Boolean);
        if (parts.length > 0) {
            return parts.join(', ');
        }
    }
    
    // Try customerInfo address
    if (bill.customerInfo?.address) {
        if (typeof bill.customerInfo.address === 'string') {
            return bill.customerInfo.address;
        }
        const parts = [
            bill.customerInfo.address.address,
            bill.customerInfo.address.district,
            bill.customerInfo.address.city
        ].filter(Boolean);
        if (parts.length > 0) {
            return parts.join(', ');
        }
    }
    
    return 'No address provided';
}

// Calculate delivery progress based on status and time
function calculateDeliveryProgress(bill) {
    const status = bill.status || 'pending';
    
    // Status-based positions
    if (status === 'pending' || status === 'processing') {
        return 0; // At start
    }
    
    if (status === 'delivered' || status === 'completed') {
        return 100; // At destination
    }
    
    if (status === 'cancelled' || status === 'returned') {
        // Stop at 50% for cancelled/returned orders
        return 50;
    }
    
    // For shipping status, calculate based on time
    if (status === 'shipping') {
        try {
            let createdDate;
            const createdAt = bill.createdAt;
            
            if (createdAt && typeof createdAt.toDate === 'function') {
                createdDate = createdAt.toDate();
            } else if (createdAt instanceof Date) {
                createdDate = createdAt;
            } else if (createdAt && createdAt.seconds) {
                createdDate = new Date(createdAt.seconds * 1000);
            } else {
                createdDate = new Date(createdAt);
            }
            
            const now = new Date();
            const elapsedMs = now.getTime() - createdDate.getTime();
            const threeDaysMs = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
            
            // Calculate progress from 0% to 100% over 3 days
            let progress = (elapsedMs / threeDaysMs) * 100;
            
            // Clamp between 5% and 95% (never fully at start or end while shipping)
            progress = Math.max(5, Math.min(95, progress));
            
            return Math.round(progress);
        } catch (error) {
            console.error('Error calculating delivery progress:', error);
            return 50; // Default to middle if error
        }
    }
    
    return 0;
}

// Get tracking status text based on bill status
function getTrackingStatusText(bill) {
    const status = bill.status || 'pending';
    
    const statusMessages = {
        'pending': '<p style="color: #f093fb;">📦 Đơn hàng đang chờ xử lý tại kho</p>',
        'processing': '<p style="color: #a8edea;">⚙️ Đơn hàng đang được chuẩn bị</p>',
        'shipping': '<p style="color: #ffeaa7;">🚚 Đơn hàng đang trên đường giao đến bạn</p>',
        'delivered': '<p style="color: #00d2ff;">📦 Đơn hàng đã được giao! Vui lòng xác nhận đã nhận hàng</p>',
        'completed': '<p style="color: #4facfe;">✅ Đơn hàng đã hoàn thành!</p>',
        'cancelled': '<p style="color: #fa709a;">❌ Đơn hàng đã bị hủy</p>',
        'returned': '<p style="color: #fa709a;">↩️ Đơn hàng đã được trả lại</p>'
    };
    
    return statusMessages[status] || statusMessages['pending'];
}

// Show/hide loading state
function showLoading(show) {
    const billsList = document.querySelector('.bills-list');
    
    if (show) {
        billsList.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <h3>Loading your orders...</h3>
                <p>Please wait while we fetch your order history</p>
            </div>
        `;
    }
}

// Show error message
function showErrorMessage(message) {
    const billsList = document.querySelector('.bills-list');
    billsList.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3>Oops! Something went wrong</h3>
            <p>${message}</p>
            <button onclick="location.reload()" class="shop-now-btn">
                <i class="fas fa-sync-alt"></i>
                Retry
            </button>
        </div>
    `;
}

// Show status change notification
function showStatusChangeNotification(bill) {
    const statusText = getStatusText(bill.status);
    const statusIcon = getStatusIcon(bill.status);
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'status-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="${statusIcon}" style="font-size: 24px; margin-right: 15px;"></i>
            <div>
                <strong>Đơn hàng #${bill.id.substring(0, 8).toUpperCase()}</strong>
                <p>Trạng thái đã cập nhật: ${statusText}</p>
            </div>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

// Clean up listener when leaving page
window.addEventListener('beforeunload', () => {
    if (unsubscribeBills) {
        console.log('🔌 Cleaning up real-time listener');
        unsubscribeBills();
    }
});

// Confirm delivery - user confirms they received the order
async function confirmDelivery(billId) {
    if (!currentUser || !currentUser.uid) {
        alert('Vui lòng đăng nhập để xác nhận đơn hàng');
        return;
    }
    
    // Show confirmation dialog
    if (!confirm('Bạn đã nhận được hàng và kiểm tra đầy đủ chưa?\n\nSau khi xác nhận, đơn hàng sẽ chuyển sang trạng thái Hoàn Thành.')) {
        return;
    }
    
    try {
        console.log(`📦 Confirming delivery for bill: ${billId}`);
        
        // Show loading
        const confirmBtn = document.querySelector('.confirm-delivery-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xác nhận...';
        }
        
        // Call API to confirm delivery
        const response = await fetch(`/api/bills/${billId}/confirm-delivery`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.uid
            })
        });
        
        const data = await response.json();
        
        console.log('📊 API Response:', data);
        console.log('🎖️ Tier Promoted:', data.tierPromoted);
        console.log('🏆 Membership:', data.membership);
        
        if (data.success) {
            console.log('✅ Delivery confirmed successfully');
            
            // Check if user was promoted to a new tier
            if (data.tierPromoted && data.membership) {
                console.log('🎉 TIER PROMOTION DETECTED!');
                // Show tier promotion animation first
                showTierPromotionAnimation(data.membership, () => {
                    // After animation, show success message
                    alert(`✅ Đã xác nhận nhận hàng thành công!\n\n🎉 Chúc mừng bạn đã thăng hạng ${data.membership.name}!\nĐiểm tích lũy: ${data.membership.points.toLocaleString('vi-VN')}`);
                    
                    // Close modal
                    const modal = document.getElementById('billDetailModal');
                    modal.classList.remove('active');
                });
            } else {
                console.log('ℹ️ No tier promotion - showing normal message');
                // Show normal success message
                alert('✅ Đã xác nhận nhận hàng thành công!\n\nCảm ơn bạn đã mua hàng!');
                
                // Close modal
                const modal = document.getElementById('billDetailModal');
                modal.classList.remove('active');
            }
            
            // Real-time listener will automatically update the UI
        } else {
            console.error('❌ Failed to confirm delivery:', data.error);
            alert('❌ Không thể xác nhận: ' + data.error);
            
            // Restore button
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-check-double"></i> Xác Nhận Đã Nhận Hàng';
            }
        }
        
    } catch (error) {
        console.error('❌ Error confirming delivery:', error);
        alert('❌ Có lỗi xảy ra. Vui lòng thử lại sau.');
        
        // Restore button
        const confirmBtn = document.querySelector('.confirm-delivery-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-check-double"></i> Xác Nhận Đã Nhận Hàng';
        }
    }
}

// Make confirmDelivery globally accessible
window.confirmDelivery = confirmDelivery;

// Show tier promotion animation with Trophy Lottie
function showTierPromotionAnimation(membership, callback) {
    console.log('🏆 Showing tier promotion animation for:', membership);
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'tier-promotion-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        animation: fadeIn 0.3s ease;
    `;
    
    // Create animation container
    const animationContainer = document.createElement('div');
    animationContainer.id = 'tierPromotionAnimation';
    animationContainer.style.cssText = `
        width: 400px;
        height: 400px;
        margin-bottom: 20px;
    `;
    
    // Create message container
    const messageContainer = document.createElement('div');
    messageContainer.style.cssText = `
        text-align: center;
        color: white;
        animation: slideInUp 0.5s ease 0.5s both;
    `;
    
    // Get tier icon and color
    const tierIcons = {
        'standard': '⭐',
        'silver': '🥈',
        'gold': '🥇',
        'diamond': '💎'
    };
    
    const tierColors = {
        'standard': '#6c757d',
        'silver': '#c0c0c0',
        'gold': '#ffd700',
        'diamond': '#b9f2ff'
    };
    
    const icon = tierIcons[membership.level] || '⭐';
    const color = tierColors[membership.level] || '#6c757d';
    
    messageContainer.innerHTML = `
        <h1 style="font-size: 48px; margin: 0; text-shadow: 0 0 20px ${color};">
            🎉 CHÚC MỪNG! 🎉
        </h1>
        <p style="font-size: 36px; margin: 20px 0; font-weight: bold; color: ${color}; text-shadow: 0 0 15px ${color};">
            ${icon} ${membership.name} ${icon}
        </p>
        <p style="font-size: 20px; margin: 10px 0; color: #fff;">
            Bạn đã thăng hạng thành công!
        </p>
        <p style="font-size: 16px; margin: 10px 0; color: rgba(255,255,255,0.8);">
            ${membership.points.toLocaleString('vi-VN')} điểm tích lũy
        </p>
        <button id="closeTierPromotion" style="
            margin-top: 30px;
            padding: 12px 30px;
            background: linear-gradient(135deg, ${color}, ${adjustColor(color, -20)});
            color: white;
            border: none;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        ">
            Tiếp Tục
        </button>
    `;
    
    overlay.appendChild(animationContainer);
    overlay.appendChild(messageContainer);
    document.body.appendChild(overlay);
    
    // Add animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-20px) scale(1.1); }
        }
    `;
    document.head.appendChild(style);
    
    // Load and play Lottie animation
    console.log('🎬 Checking Lottie availability:', typeof lottie);
    
    if (typeof lottie !== 'undefined') {
        console.log('🎬 Lottie is available, loading Trophy.json...');
        
        fetch('/Trophy.json')
            .then(response => {
                console.log('📥 Trophy.json response status:', response.status);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(animationData => {
                console.log('📦 Trophy animation data loaded:', animationData);
                
                const animation = lottie.loadAnimation({
                    container: animationContainer,
                    renderer: 'svg',
                    loop: false,
                    autoplay: true,
                    animationData: animationData
                });
                
                console.log('🏆 Trophy animation loaded successfully!');
                
                // Play sound effect if available
                playPromotionSound();
            })
            .catch(error => {
                console.error('❌ Error loading Trophy animation:', error);
                // Fallback trophy emoji
                animationContainer.innerHTML = `
                    <div style="font-size: 200px; text-align: center; animation: bounce 1s ease infinite;">
                        🏆
                    </div>
                `;
            });
    } else {
        console.warn('⚠️ Lottie library not available, using fallback emoji');
        // Fallback if Lottie is not available
        animationContainer.innerHTML = `
            <div style="font-size: 200px; text-align: center; animation: bounce 1s ease infinite;">
                🏆
            </div>
        `;
    }
    
    // Close button handler
    document.getElementById('closeTierPromotion').addEventListener('click', () => {
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            overlay.remove();
            style.remove();
            if (callback) callback();
        }, 300);
    });
    
    // Add hover effect to button
    const btn = document.getElementById('closeTierPromotion');
    btn.addEventListener('mouseover', () => {
        btn.style.transform = 'scale(1.05)';
    });
    btn.addEventListener('mouseout', () => {
        btn.style.transform = 'scale(1)';
    });
}

// Helper function to adjust color brightness
function adjustColor(color, amount) {
    const clamp = (num) => Math.min(Math.max(num, 0), 255);
    const num = parseInt(color.replace('#', ''), 16);
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0x00FF) + amount);
    const b = clamp((num & 0x0000FF) + amount);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Play promotion sound effect
function playPromotionSound() {
    try {
        // Create a simple beep sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        
        console.log('🔊 Promotion sound played');
    } catch (error) {
        console.log('Sound effect not available:', error);
    }
}

// Make functions globally accessible
window.showTierPromotionAnimation = showTierPromotionAnimation;


// Cancel bill - user cancels the order and restores stock
async function cancelBill(billId) {
    if (!currentUser || !currentUser.uid) {
        alert('Vui lòng đăng nhập để hủy đơn hàng');
        return;
    }
    
    // Create modal for bank account info
    const modal = document.createElement('div');
    modal.className = 'refund-modal-overlay';
    modal.innerHTML = `
        <div class="refund-modal-content">
            <div class="refund-modal-header">
                <h3><i class="fas fa-university"></i> Thông Tin Hoàn Tiền</h3>
                <button class="refund-close-btn" onclick="this.closest('.refund-modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="refund-modal-body">
                <p style="color: #666; margin-bottom: 20px;">
                    <i class="fas fa-info-circle"></i> 
                    Vui lòng cung cấp thông tin tài khoản để hoàn tiền
                </p>
                
                <div class="refund-form-group">
                    <label><i class="fas fa-credit-card"></i> Số Tài Khoản <span style="color: red;">*</span></label>
                    <input type="text" id="refundAccountNumber" class="refund-input" placeholder="Nhập số tài khoản" required>
                </div>
                
                <div class="refund-form-group">
                    <label><i class="fas fa-user"></i> Tên Chủ Thẻ <span style="color: red;">*</span></label>
                    <input type="text" id="refundAccountName" class="refund-input" placeholder="NGUYEN VAN A" required>
                </div>
                
                <div class="refund-form-group">
                    <label><i class="fas fa-university"></i> Tên Ngân Hàng <span style="color: red;">*</span></label>
                    <select id="refundBankName" class="refund-input" required>
                        <option value="">-- Chọn ngân hàng --</option>
                        <option value="Vietcombank">Vietcombank</option>
                        <option value="Techcombank">Techcombank</option>
                        <option value="BIDV">BIDV</option>
                        <option value="VietinBank">VietinBank</option>
                        <option value="ACB">ACB</option>
                        <option value="MB Bank">MB Bank</option>
                        <option value="TPBank">TPBank</option>
                        <option value="VPBank">VPBank</option>
                        <option value="Sacombank">Sacombank</option>
                        <option value="HDBank">HDBank</option>
                        <option value="SHB">SHB</option>
                        <option value="VIB">VIB</option>
                        <option value="MSB">MSB</option>
                        <option value="OCB">OCB</option>
                        <option value="Agribank">Agribank</option>
                        <option value="DongA Bank">DongA Bank</option>
                        <option value="SeABank">SeABank</option>
                        <option value="Eximbank">Eximbank</option>
                        <option value="Other">Ngân hàng khác</option>
                    </select>
                </div>
                
                <div class="refund-form-group">
                    <label><i class="fas fa-comment"></i> Lý Do Hủy (tùy chọn)</label>
                    <textarea id="refundReason" class="refund-input" placeholder="Nhập lý do hủy đơn..." rows="3"></textarea>
                </div>
            </div>
            <div class="refund-modal-footer">
                <button class="refund-btn-cancel" onclick="this.closest('.refund-modal-overlay').remove()">
                    <i class="fas fa-times"></i> Hủy
                </button>
                <button class="refund-btn-submit" id="submitRefundBtn">
                    <i class="fas fa-check"></i> Xác Nhận Hủy Đơn
                </button>
            </div>
        </div>
    `;
    
    // Add styles for refund modal
    const style = document.createElement('style');
    style.textContent = `
        .refund-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        }
        
        .refund-modal-content {
            background: white;
            border-radius: 20px;
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 10px 50px rgba(0, 0, 0, 0.3);
            animation: slideInUp 0.4s ease;
        }
        
        .refund-modal-header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 20px;
            border-radius: 20px 20px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .refund-modal-header h3 {
            margin: 0;
            font-size: 1.5rem;
        }
        
        .refund-close-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 35px;
            height: 35px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1.2rem;
            transition: all 0.3s ease;
        }
        
        .refund-close-btn:hover {
            background: white;
            color: #667eea;
            transform: rotate(90deg);
        }
        
        .refund-modal-body {
            padding: 25px;
        }
        
        .refund-form-group {
            margin-bottom: 20px;
        }
        
        .refund-form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #333;
        }
        
        .refund-input {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            font-size: 1rem;
            transition: all 0.3s ease;
            font-family: inherit;
        }
        
        .refund-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .refund-modal-footer {
            padding: 20px 25px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        
        .refund-btn-cancel,
        .refund-btn-submit {
            padding: 12px 24px;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .refund-btn-cancel {
            background: #e2e8f0;
            color: #64748b;
        }
        
        .refund-btn-cancel:hover {
            background: #cbd5e1;
        }
        
        .refund-btn-submit {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
        }
        
        .refund-btn-submit:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    // Handle form submission
    document.getElementById('submitRefundBtn').addEventListener('click', async () => {
        const accountNumber = document.getElementById('refundAccountNumber').value.trim();
        const accountName = document.getElementById('refundAccountName').value.trim().toUpperCase();
        const bankName = document.getElementById('refundBankName').value;
        const reason = document.getElementById('refundReason').value.trim();
        
        // Validate required fields
        if (!accountNumber || !accountName || !bankName) {
            alert('⚠️ Vui lòng điền đầy đủ thông tin tài khoản!');
            return;
        }
        
        // Validate account number (only numbers)
        if (!/^\d+$/.test(accountNumber)) {
            alert('⚠️ Số tài khoản chỉ được chứa số!');
            return;
        }
        
        // Close modal and proceed with cancellation
        modal.remove();
        
        try {
        console.log(`🚫 Cancelling bill: ${billId}`);
        
        // Show loading on cancel button if exists
        const cancelBtn = document.querySelector(`.cancel-bill-btn[onclick*="${billId}"]`);
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang hủy...';
        }
        
        // Call API to cancel bill
        const response = await fetch(`/api/bills/${billId}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.uid,
                reason: reason || 'Người dùng yêu cầu hủy',
                refundBankAccount: accountNumber,
                refundAccountName: accountName,
                refundBankName: bankName
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Bill cancelled successfully');
            
            // Show success message
            alert(`✅ Đã hủy đơn hàng thành công!\n\n${data.restoredProducts} sản phẩm đã được hoàn trả vào kho.`);
            
            // Close modal if open
            const modal = document.getElementById('billDetailModal');
            if (modal && modal.classList.contains('active')) {
                modal.classList.remove('active');
            }
            
            // Real-time listener will automatically update the UI
        } else {
            console.error('❌ Failed to cancel bill:', data.error);
            alert('❌ Không thể hủy đơn: ' + data.error);
            
            // Restore button
            if (cancelBtn) {
                cancelBtn.disabled = false;
                cancelBtn.innerHTML = '<i class="fas fa-times-circle"></i> Hủy Đơn Hàng';
            }
        }
        
    } catch (error) {
        console.error('❌ Error cancelling bill:', error);
        alert('❌ Có lỗi xảy ra. Vui lòng thử lại sau.');
        
        // Restore button
        const cancelBtn = document.querySelector(`.cancel-bill-btn[onclick*="${billId}"]`);
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.innerHTML = '<i class="fas fa-times-circle"></i> Hủy Đơn Hàng';
        }
    }
    }); // Close event listener
}

// Make cancelBill globally accessible
window.cancelBill = cancelBill;

// Return order - user returns order within 7 days of confirmation
async function returnOrder(billId) {
    console.log('↩️ Initiating order return for:', billId);
    
    if (!currentUser || !currentUser.uid) {
        alert('Vui lòng đăng nhập để trả hàng');
        return;
    }
    
    // Create refund modal
    const modal = document.createElement('div');
    modal.className = 'refund-modal-overlay';
    modal.innerHTML = `
        <div class="refund-modal-content">
            <div class="refund-modal-header">
                <h3><i class="fas fa-undo"></i> Trả Hàng & Hoàn Tiền</h3>
                <button class="refund-modal-close" onclick="this.closest('.refund-modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="refund-modal-body">
                <p class="refund-notice">
                    <i class="fas fa-info-circle"></i>
                    Vui lòng cung cấp thông tin tài khoản ngân hàng để nhận hoàn tiền
                </p>
                
                <div class="refund-form-group">
                    <label for="returnAccountNumber">
                        <i class="fas fa-credit-card"></i>
                        Số Tài Khoản <span class="required">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="returnAccountNumber" 
                        placeholder="Nhập số tài khoản ngân hàng"
                        required
                    >
                </div>
                
                <div class="refund-form-group">
                    <label for="returnAccountName">
                        <i class="fas fa-user"></i>
                        Tên Chủ Tài Khoản <span class="required">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="returnAccountName" 
                        placeholder="Nhập tên chủ tài khoản (VD: NGUYEN VAN A)"
                        required
                        style="text-transform: uppercase"
                    >
                </div>
                
                <div class="refund-form-group">
                    <label for="returnBankName">
                        <i class="fas fa-university"></i>
                        Ngân Hàng <span class="required">*</span>
                    </label>
                    <select id="returnBankName" required>
                        <option value="">-- Chọn ngân hàng --</option>
                        <option value="Vietcombank">Vietcombank - Ngân hàng TMCP Ngoại thương Việt Nam</option>
                        <option value="Techcombank">Techcombank - Ngân hàng TMCP Kỹ thương Việt Nam</option>
                        <option value="BIDV">BIDV - Ngân hàng TMCP Đầu tư và Phát triển Việt Nam</option>
                        <option value="VietinBank">VietinBank - Ngân hàng TMCP Công thương Việt Nam</option>
                        <option value="ACB">ACB - Ngân hàng TMCP Á Châu</option>
                        <option value="MB Bank">MB Bank - Ngân hàng TMCP Quân đội</option>
                        <option value="TPBank">TPBank - Ngân hàng TMCP Tiên Phong</option>
                        <option value="VPBank">VPBank - Ngân hàng TMCP Việt Nam Thịnh Vượng</option>
                        <option value="Sacombank">Sacombank - Ngân hàng TMCP Sài Gòn Thương Tín</option>
                        <option value="HDBank">HDBank - Ngân hàng TMCP Phát triển TP.HCM</option>
                        <option value="SHB">SHB - Ngân hàng TMCP Sài Gòn - Hà Nội</option>
                        <option value="VIB">VIB - Ngân hàng TMCP Quốc tế Việt Nam</option>
                        <option value="MSB">MSB - Ngân hàng TMCP Hàng Hải</option>
                        <option value="OCB">OCB - Ngân hàng TMCP Phương Đông</option>
                        <option value="Agribank">Agribank - Ngân hàng Nông nghiệp và Phát triển Nông thôn</option>
                        <option value="DongA Bank">DongA Bank - Ngân hàng TMCP Đông Á</option>
                        <option value="SeABank">SeABank - Ngân hàng TMCP Đông Nam Á</option>
                        <option value="Eximbank">Eximbank - Ngân hàng TMCP Xuất Nhập khẩu Việt Nam</option>
                        <option value="Other">Ngân hàng khác</option>
                    </select>
                </div>
                
                <div class="refund-form-group">
                    <label for="returnReason">
                        <i class="fas fa-comment-dots"></i>
                        Lý Do Trả Hàng <span class="required">*</span>
                    </label>
                    <textarea 
                        id="returnReason" 
                        placeholder="Vui lòng nhập lý do trả hàng..."
                        rows="3"
                        required
                    ></textarea>
                </div>
            </div>
            <div class="refund-modal-footer">
                <button class="refund-modal-cancel" onclick="this.closest('.refund-modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                    Hủy
                </button>
                <button class="refund-modal-submit" id="submitReturnBtn">
                    <i class="fas fa-check"></i>
                    Xác Nhận Trả Hàng
                </button>
            </div>
        </div>
    `;
    
    // Add CSS styles (reuse from cancelBill)
    const style = document.createElement('style');
    style.textContent = `
        .refund-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .refund-modal-content {
            background: white;
            border-radius: 16px;
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            animation: slideInUp 0.4s ease;
        }
        
        @keyframes slideInUp {
            from {
                transform: translateY(50px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        .refund-modal-header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 20px;
            border-radius: 16px 16px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .refund-modal-header h3 {
            margin: 0;
            font-size: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .refund-modal-close {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        }
        
        .refund-modal-close:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: rotate(90deg);
        }
        
        .refund-modal-body {
            padding: 24px;
        }
        
        .refund-notice {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 12px 16px;
            margin-bottom: 20px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
            color: #1565c0;
            font-size: 14px;
        }
        
        .refund-notice i {
            font-size: 20px;
        }
        
        .refund-form-group {
            margin-bottom: 20px;
        }
        
        .refund-form-group label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .refund-form-group label i {
            color: #667eea;
        }
        
        .required {
            color: #f44336;
        }
        
        .refund-form-group input,
        .refund-form-group select,
        .refund-form-group textarea {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.3s ease;
            font-family: inherit;
        }
        
        .refund-form-group input:focus,
        .refund-form-group select:focus,
        .refund-form-group textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .refund-form-group textarea {
            resize: vertical;
            min-height: 80px;
        }
        
        .refund-modal-footer {
            padding: 16px 24px;
            background: #f5f5f5;
            border-radius: 0 0 16px 16px;
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        }
        
        .refund-modal-cancel,
        .refund-modal-submit {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            font-size: 14px;
        }
        
        .refund-modal-cancel {
            background: white;
            color: #666;
            border: 2px solid #e0e0e0;
        }
        
        .refund-modal-cancel:hover {
            background: #f5f5f5;
            border-color: #bdbdbd;
        }
        
        .refund-modal-submit {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
        }
        
        .refund-modal-submit:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        
        .refund-modal-submit:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    // Handle form submission
    document.getElementById('submitReturnBtn').addEventListener('click', async () => {
        const accountNumber = document.getElementById('returnAccountNumber').value.trim();
        const accountName = document.getElementById('returnAccountName').value.trim().toUpperCase();
        const bankName = document.getElementById('returnBankName').value;
        const reason = document.getElementById('returnReason').value.trim();
        
        // Validation
        if (!accountNumber || !accountName || !bankName || !reason) {
            alert('⚠️ Vui lòng điền đầy đủ thông tin!');
            return;
        }
        
        // Validate account number (must be digits only)
        if (!/^\d+$/.test(accountNumber)) {
            alert('⚠️ Số tài khoản chỉ được chứa số!');
            return;
        }
        
        const submitBtn = document.getElementById('submitReturnBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
        
        try {
            console.log(`↩️ Requesting return for bill: ${billId}`);
            console.log(`📝 Return reason: ${reason}`);
            console.log(`💳 Refund info - Account: ${accountNumber}, Name: ${accountName}, Bank: ${bankName}`);
            
            const response = await fetch(`/api/bills/${billId}/return`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: currentUser.uid,
                    reason: reason,
                    refundBankAccount: accountNumber,
                    refundAccountName: accountName,
                    refundBankName: bankName
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Order returned successfully:', data);
                
                // Create success message
                let successMessage = '✅ Đã xử lý trả hàng thành công!\n\n📦 Sản phẩm đã được hoàn về kho.';
                
                // Coin will be deducted by Firebase Trigger automatically
                if (data.coinWillBeDeducted && data.coinWillBeDeducted > 0) {
                    successMessage += `\n\n💰 Thông tin coin:`;
                    successMessage += `\n• Coin sẽ bị trừ: ${data.coinWillBeDeducted.toLocaleString('vi-VN')}`;
                    successMessage += `\n• Lý do: Hoàn trả coin đã cộng khi hoàn thành đơn hàng (10% của ${data.orderAmount.toLocaleString('vi-VN')} VND)`;
                    successMessage += `\n\n⏳ Hệ thống đang tự động cập nhật số dư coin...`;
                } else {
                    successMessage += '\n\n💰 Không có coin bị trừ (đơn hàng không tích coin).';
                }
                
                alert(successMessage);
                
                // Force reload user coin balance from server
                if (window.currentUser && window.currentUser.uid) {
                    console.log('🔄 Reloading user coin balance...');
                    try {
                        const coinResponse = await fetch(`/api/users/${window.currentUser.uid}/coin`);
                        const coinData = await coinResponse.json();
                        if (coinData.success) {
                            const newCoin = coinData.coin || 0;
                            console.log(`💰 Updated coin balance: ${newCoin.toLocaleString('vi-VN')}`);
                            
                            // Update currentUser coin
                            if (window.currentUser) {
                                window.currentUser.coin = newCoin;
                            }
                            
                            // Trigger coin sync manager to update UI
                            if (window.CoinSyncManager) {
                                window.CoinSyncManager.updateCoinDisplays(newCoin);
                            }
                        }
                    } catch (error) {
                        console.error('❌ Error reloading coin balance:', error);
                    }
                }
                
                // Remove modal
                modal.remove();
                
                // Close detail modal if open
                const detailModal = document.getElementById('billDetailModal');
                if (detailModal && detailModal.classList.contains('active')) {
                    detailModal.classList.remove('active');
                }
                
                // Reload the bills list to reflect the change
                setTimeout(() => {
                    if (typeof loadUserBills === 'function') {
                        loadUserBills();
                    }
                }, 1000);
                
            } else {
                console.error('❌ Failed to return order:', data.error);
                alert('❌ Không thể trả hàng: ' + data.error);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check"></i> Xác Nhận Trả Hàng';
            }
            
        } catch (error) {
            console.error('❌ Error returning order:', error);
            alert('❌ Có lỗi xảy ra. Vui lòng thử lại sau.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Xác Nhận Trả Hàng';
        }
    });
}

// Make returnOrder globally accessible
window.returnOrder = returnOrder;

// Test function to manually trigger trophy animation
window.testTierPromotion = function() {
    console.log('🧪 Testing tier promotion animation...');
    console.log('🔍 Checking Lottie:', typeof lottie);
    
    const testMembership = {
        level: 'gold',
        name: 'Vàng',
        icon: '🥇',
        points: 1500000
    };
    
    if (typeof showTierPromotionAnimation === 'function') {
        showTierPromotionAnimation(testMembership, () => {
            console.log('✅ Test animation completed');
        });
    } else {
        console.error('❌ showTierPromotionAnimation function not found!');
    }
};

// Back button handler
document.querySelector('.back-btn')?.addEventListener('click', () => {
    window.history.back();
});

console.log('✅ Bill Detail JS initialized');
console.log('🧪 To test trophy animation, run: testTierPromotion()');
