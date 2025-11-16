// User Profile Management Script
import { userManager } from './user-manager.js';

// Initialize user profile functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 User Profile Script Loaded');
    
    // Check if user is logged in from server data
    const userDataElement = document.getElementById('user-data');
    let currentUser = null;
    
    if (userDataElement && userDataElement.textContent) {
        try {
            currentUser = JSON.parse(userDataElement.textContent);
            console.log('✅ Current user:', currentUser);
            initializeUserProfile(currentUser);
        } catch (e) {
            console.log('❌ No user data found');
        }
    }
    
    // Setup event listeners
    setupUserProfileEventListeners();
});

// Initialize user profile panel
function initializeUserProfile(user) {
    if (!user) return;
    
    // Auto-show profile panel after a delay
    setTimeout(() => {
        const panel = document.getElementById('userProfilePanel');
        if (panel) {
            panel.classList.add('active');
        }
    }, 1000);
    
    // Update join date
    updateJoinDate();
    
    // Load user orders and favorites
    loadUserData(user);
}

// Setup event listeners for user profile
function setupUserProfileEventListeners() {
    // Global functions for buttons
    window.closeUserProfile = function() {
        const panel = document.getElementById('userProfilePanel');
        if (panel) {
            panel.classList.remove('active');
        }
    };
    
    window.editUserProfile = function() {
        showEditProfileModal();
    };
    
    window.viewOrderHistory = function() {
        showOrderHistoryModal();
    };
    
    window.handleLogout = function() {
        if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
            window.location.href = '/logout';
        }
    };
    
    // Enhanced login/register functions with Firebase
    window.handleRegister = async function() {
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const agreeTerms = document.getElementById('agreeTerms').checked;
        
        if (!name || !email || !password) {
            showMessage('Vui lòng điền đầy đủ thông tin', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showMessage('Mật khẩu xác nhận không khớp', 'error');
            return;
        }
        
        if (!agreeTerms) {
            showMessage('Vui lòng đồng ý với điều khoản dịch vụ', 'error');
            return;
        }
        
        try {
            showLoading('Đang đăng ký...');
            
            // Send to server API
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    password: password
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showMessage('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
                
                // Switch to login form
                toggleAuthMode();
                
                // Clear form
                document.getElementById('registerForm').reset();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showMessage('Lỗi đăng ký: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    };
    
    window.handleLogin = async function() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            showMessage('Vui lòng nhập email và mật khẩu', 'error');
            return;
        }
        
        try {
            showLoading('Đang đăng nhập...');
            
            // Send to server API
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showMessage('Đăng nhập thành công! Đang tải lại trang...', 'success');
                
                // Reload page to show user profile
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showMessage('Lỗi đăng nhập: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    };
}

// Update join date display
function updateJoinDate() {
    const joinDateElement = document.getElementById('joinDate');
    if (joinDateElement) {
        joinDateElement.textContent = new Date().toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// Load user data (orders, favorites, etc.)
async function loadUserData(user) {
    // Simulate loading delay
    setTimeout(() => {
        const ordersElement = document.getElementById('recentOrders');
        if (ordersElement) {
            ordersElement.innerHTML = `
                <div style="text-align: left;">
                    <p style="color: #666; margin: 0;">Chưa có đơn hàng nào</p>
                    <small style="color: #999;">Hãy mua sắm để xem đơn hàng của bạn tại đây!</small>
                </div>
            `;
        }
        
        const favoritesElement = document.getElementById('favoriteProducts');
        if (favoritesElement) {
            favoritesElement.innerHTML = `
                <div style="text-align: left;">
                    <p style="color: #666; margin: 0;">Chưa có sản phẩm yêu thích</p>
                    <small style="color: #999;">Nhấp vào ❤️ trên sản phẩm để thêm vào danh sách yêu thích!</small>
                </div>
            `;
        }
    }, 2000);
}

// Show edit profile modal
function showEditProfileModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>Chỉnh Sửa Hồ Sơ</h3>
                <button class="close-modal" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Họ và tên</label>
                    <input type="text" id="editName" class="form-input" value="${window.currentUser?.name || ''}">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="editEmail" class="form-input" value="${window.currentUser?.email || ''}" disabled>
                    <small style="color: #666;">Email không thể thay đổi</small>
                </div>
                <div class="form-group">
                    <label>Ảnh đại diện (URL)</label>
                    <input type="url" id="editPhoto" class="form-input" value="${window.currentUser?.photo || ''}">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
                <button class="btn btn-primary" onclick="saveUserProfile()">Lưu thay đổi</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Show order history modal
function showOrderHistoryModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h3>Lịch Sử Đơn Hàng</h3>
                <button class="close-modal" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-shopping-cart" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
                    <p style="color: #666; font-size: 16px;">Bạn chưa có đơn hàng nào</p>
                    <p style="color: #999; font-size: 14px;">Hãy mua sắm ngay để tạo đơn hàng đầu tiên!</p>
                    <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove(); window.location.href='/shop'">
                        <i class="fas fa-shopping-bag"></i> Mua Sắm Ngay
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Save user profile changes
window.saveUserProfile = function() {
    const name = document.getElementById('editName').value.trim();
    const photo = document.getElementById('editPhoto').value.trim();
    
    if (!name) {
        showMessage('Vui lòng nhập họ và tên', 'error');
        return;
    }
    
    // In a real app, send to server API
    showMessage('Cập nhật hồ sơ thành công!', 'success');
    
    // Close modal
    document.querySelector('.modal-overlay').remove();
    
    // Update display (in a real app, reload or update from server)
    setTimeout(() => {
        window.location.reload();
    }, 1500);
};

// Utility functions
function showMessage(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `message-toast message-${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        messageEl.remove();
    }, 5000);
}

function showLoading(message = 'Đang tải...') {
    const loader = document.createElement('div');
    loader.id = 'globalLoader';
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        font-size: 16px;
    `;
    loader.innerHTML = `<div><i class="fas fa-spinner fa-spin"></i> ${message}</div>`;
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.remove();
    }
}

console.log('✅ User Profile Management Script Ready');