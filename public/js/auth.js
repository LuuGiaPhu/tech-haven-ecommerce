// =====================================
// CLEAN GOOGLE AUTHENTICATION (SERVER-SIDE)
// =====================================

// Simple server-side Google OAuth
window.handleGoogleLogin = function() {
    console.log('🔐 Đăng nhập với Google (server-side)');
    console.log('Chuyển hướng đến /auth/google...');
    window.location.href = '/auth/google';
};

// Hàm đăng xuất
window.handleLogout = function() {
    console.log('👋 Đăng xuất');
    window.location.href = '/logout';
};

// Check if user is logged in based on server data
function checkAuthStatus() {
    // User data is passed from server in index.ejs
    if (window.currentUser) {
        console.log('✅ User đã đăng nhập:', window.currentUser);
        updateUIForLoggedInUser(window.currentUser);
    } else {
        console.log('❌ User chưa đăng nhập');
    }
}

// Update UI for logged in user
function updateUIForLoggedInUser(user) {
    // Update user icons in header
    const userIcons = document.querySelectorAll('.fas.fa-user');
    userIcons.forEach(icon => {
        const parentLink = icon.closest('a');
        if (parentLink && parentLink.getAttribute('href') === '#') {
            if (user.photo) {
                parentLink.innerHTML = `
                    <img src="${user.photo}" 
                         alt="${user.name}" 
                         style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">
                    <span>${user.name}</span>
                `;
            } else {
                parentLink.innerHTML = `<i class="fas fa-user-circle"></i> ${user.name}`;
            }
            
            // Add click handler to show user menu
            parentLink.onclick = function(e) {
                e.preventDefault();
                showUserMenu();
            };
            
            parentLink.style.color = '#667eea';
        }
    });
}

// Show user menu dropdown
function showUserMenu() {
    const menu = `
        <div id="userDropdown" style="
            position: absolute;
            top: 60px;
            right: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            padding: 10px 0;
            min-width: 200px;
            z-index: 1000;
        ">
            <div style="padding: 10px 15px; border-bottom: 1px solid #eee;">
                <strong>${window.currentUser.name}</strong><br>
                <small style="color: #666;">${window.currentUser.email}</small>
            </div>
            <a href="/admin" style="display: block; padding: 10px 15px; text-decoration: none; color: #333;">
                <i class="fas fa-cog"></i> Admin Panel
            </a>
            <a href="#" onclick="handleLogout()" style="display: block; padding: 10px 15px; text-decoration: none; color: #d73d32;">
                <i class="fas fa-sign-out-alt"></i> Đăng xuất
            </a>
        </div>
    `;
    
    // Remove existing dropdown
    const existing = document.getElementById('userDropdown');
    if (existing) existing.remove();
    
    // Add new dropdown
    document.body.insertAdjacentHTML('beforeend', menu);
    
    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', function closeDropdown(e) {
            if (!e.target.closest('#userDropdown')) {
                const dropdown = document.getElementById('userDropdown');
                if (dropdown) dropdown.remove();
                document.removeEventListener('click', closeDropdown);
            }
        });
    }, 100);
}

// Initialize auth when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Auth module loaded');
    checkAuthStatus();
});

// Make functions globally available
window.updateUIForLoggedInUser = updateUIForLoggedInUser;
window.showUserMenu = showUserMenu;
window.checkAuthStatus = checkAuthStatus;