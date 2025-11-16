// =====================================
// ADMIN BILL MANAGEMENT JAVASCRIPT
// Fetches and displays ALL orders from Firestore (Admin View)
// Independent from script.js - manages its own Firebase connection
// =====================================

console.log('👨‍💼 Admin Bill Management JS loaded');
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
    console.log('📋 Initializing Admin Bill Management page...');
    
    // Check if Firebase is initialized
    if (!firebase || !firebase.apps.length) {
        console.error('❌ Firebase not initialized!');
        showErrorMessage('Firebase configuration error. Please refresh the page.');
        return;
    }
    
    // First, try to get existing user from parent window
    const existingUser = checkExistingUser();
    if (existingUser && existingUser.uid) {
        console.log('✅ User found from parent window');
        currentUser = existingUser;
        currentUser.isAdmin = true; // Trust that EJS already verified admin status
        
        // Load all bills immediately (no need to check Firestore again)
        console.log('✅ Loading all bills for admin...');
        await loadAllBills();
        initializeFilterTabs();
        initializeModal();
        return;
    }
    
    // Wait for Firebase Auth to be ready
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            console.log('👤 Admin logged in via Firebase Auth:', user.email);
            console.log('🔑 User ID:', user.uid);
            
            // Check admin privileges from Firestore
            const db = firebase.firestore();
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                console.log('📊 User data from Firestore:', userData);
                
                // Check both isAdmin and is_admin fields
                const isAdmin = userData.isAdmin || userData.is_admin || false;
                console.log('🔐 Admin status:', isAdmin);
                
                if (isAdmin) {
                    console.log('✅ User confirmed as admin from Firestore');
                    currentUser.isAdmin = true;
                    await loadAllBills(); // ADMIN: Load ALL bills
                    initializeFilterTabs();
                } else {
                    console.warn('⚠️ User is not admin, redirecting...');
                    showErrorMessage('Bạn không có quyền truy cập trang này');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                }
            } else {
                console.error('❌ User document not found in Firestore');
                showErrorMessage('Không tìm thấy thông tin người dùng');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            }
        } else {
            console.warn('⚠️ No user logged in, redirecting to home...');
            showErrorMessage('Vui lòng đăng nhập để truy cập');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        }
    });
    
    // Initialize modal close handlers
    initializeModal();
});

// Load ALL bills from Firestore with real-time updates (ADMIN)
async function loadAllBills() {
    try {
        showLoading(true);
        console.log('📥 Setting up real-time listener for ALL bills (ADMIN MODE)');
        
        const db = firebase.firestore();
        const billsRef = db.collection('bills');
        
        // Unsubscribe from previous listener if exists
        if (unsubscribeBills) {
            console.log('🔌 Unsubscribing from previous listener');
            unsubscribeBills();
        }
        
        // Set up real-time listener for ALL bills (no userId filter)
        console.log('🔍 Setting up Firestore real-time listener: ALL bills in collection');
        unsubscribeBills = billsRef
            .orderBy('createdAt', 'desc')
            .onSnapshot(
                (snapshot) => {
                    console.log('🔔 Real-time update received:', snapshot.size, 'documents (ADMIN)');
                    
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
                            console.log('➕ Bill added:', change.doc.id, 'User:', billData.userId);
                        } else if (change.type === 'modified') {
                            changes.modified.push(billData);
                            console.log('✏️ Bill modified:', change.doc.id, 'New status:', billData.status);
                        } else if (change.type === 'removed') {
                            changes.removed.push(billData);
                            console.log('🗑️ Bill removed:', change.doc.id);
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
                    
                    console.log('✅ Total bills loaded:', allBills.length);
                    console.log('📊 Bills by status:', {
                        pending: allBills.filter(b => b.status === 'pending').length,
                        processing: allBills.filter(b => b.status === 'processing').length,
                        shipping: allBills.filter(b => b.status === 'shipping').length,
                        delivered: allBills.filter(b => b.status === 'delivered').length,
                        completed: allBills.filter(b => b.status === 'completed').length,
                        cancelled: allBills.filter(b => b.status === 'cancelled').length,
                        returned: allBills.filter(b => b.status === 'returned').length
                    });
                    
                    // Update UI
                    updateStats();
                    renderBills(currentFilter);
                    showLoading(false);
                    
                    // Show notifications for changes (only for modifications, not initial load)
                    if (changes.modified.length > 0 && allBills.length > 0) {
                        changes.modified.forEach(bill => {
                            console.log('📢 Showing notification for modified bill:', bill.id);
                            showStatusChangeNotification(bill);
                        });
                    }
                },
                (error) => {
                    console.error('❌ Error in real-time listener:', error);
                    showErrorMessage('Lỗi khi tải đơn hàng: ' + error.message);
                    showLoading(false);
                }
            );
    } catch (error) {
        console.error('❌ Error loading bills:', error);
        showErrorMessage('Không thể tải danh sách đơn hàng: ' + error.message);
        showLoading(false);
    }
}

// Keep the old function name as alias for compatibility
async function loadUserBills() {
    return await loadAllBills();
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
    
    // Get customer info for ADMIN view
    const customerName = bill.customerInfo?.name || bill.customerInfo?.fullName || bill.name || 'N/A';
    const customerEmail = bill.customerInfo?.email || bill.email || 'N/A';
    const userId = bill.userId || 'N/A';
    
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
                    <div class="bill-customer" style="margin-top: 0.5rem; font-size: 0.9rem; color: #666;">
                        <i class="fas fa-user"></i> ${escapeHtml(customerName)}
                        <br>
                        <i class="fas fa-envelope" style="margin-left: 0px;"></i> ${escapeHtml(customerEmail)}
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
                        ${bill.status === 'cancelled' ? '<div class="warning-sign"><i class="fas fa-exclamation-triangle"></i></div>' : ''}
                    </div>
                    ${bill.status === 'cancelled' ? '<div class="cancelled-message">⚠️ Đơn hàng đã bị hủy</div>' : ''}
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
    
    if (status === 'cancelled') {
        // Stop at 50% for cancelled orders
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
        'cancelled': '<p style="color: #fa709a;">❌ Đơn hàng đã bị hủy</p>'
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
    
    // Show confirmation dialog with reason input
    const reason = prompt('Bạn có chắc muốn hủy đơn hàng này?\n\nVui lòng nhập lý do hủy (hoặc để trống):');
    
    // If user clicked Cancel
    if (reason === null) {
        return;
    }
    
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
                reason: reason || 'Người dùng yêu cầu hủy'
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
}

// Make cancelBill globally accessible
window.cancelBill = cancelBill;

// Return order - user returns order within 7 days of confirmation
async function returnOrder(billId) {
    if (!currentUser || !currentUser.uid) {
        alert('Vui lòng đăng nhập để trả hàng');
        return;
    }
    
    // Show confirmation dialog with reason input
    const reason = prompt('Bạn có chắc muốn trả hàng?\n\nVui lòng nhập lý do trả hàng (bắt buộc):');
    
    // If user clicked Cancel or left empty
    if (!reason || reason.trim() === '') {
        alert('Vui lòng nhập lý do trả hàng!');
        return;
    }
    
    try {
        // Find and disable the return button
        const returnBtn = document.querySelector(`.return-order-btn[onclick*="${billId}"]`);
        if (returnBtn) {
            returnBtn.disabled = true;
            returnBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
        }
        
        console.log(`↩️ Requesting return for bill: ${billId}`);
        console.log(`📝 Return reason: ${reason}`);
        
        const response = await fetch(`/api/bills/${billId}/return`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.uid,
                reason: reason.trim()
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Order returned successfully:', data);
            alert('✅ ' + data.message);
            
            // Close modal if open
            const modal = document.getElementById('billDetailModal');
            if (modal && modal.classList.contains('active')) {
                modal.classList.remove('active');
            }
            
            // Real-time listener will automatically update the UI
        } else {
            console.error('❌ Failed to return order:', data.error);
            alert('❌ Không thể trả hàng: ' + data.error);
            
            // Restore button
            if (returnBtn) {
                returnBtn.disabled = false;
                returnBtn.innerHTML = '<i class="fas fa-undo"></i> Trả Hàng / Hoàn Trả';
            }
        }
        
    } catch (error) {
        console.error('❌ Error returning order:', error);
        alert('❌ Có lỗi xảy ra. Vui lòng thử lại sau.');
        
        // Restore button
        const returnBtn = document.querySelector(`.return-order-btn[onclick*="${billId}"]`);
        if (returnBtn) {
            returnBtn.disabled = false;
            returnBtn.innerHTML = '<i class="fas fa-undo"></i> Trả Hàng / Hoàn Trả';
        }
    }
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
