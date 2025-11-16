// Auth Service - Xử lý logic authentication ở backend
class AuthService {
    constructor() {
        console.log('🔐 AuthService initialized');
    }

    // Kiểm tra trạng thái authentication
    checkAuthStatus(req) {
        const isAuthenticated = req.isAuthenticated();
        const user = req.user || null;
        
        console.log('🔍 Auth Status Check:', {
            authenticated: isAuthenticated,
            user: user ? user.name : 'None',
            sessionId: req.sessionID
        });

        return {
            authenticated: isAuthenticated,
            user: user ? {
                id: user.id,
                name: user.name,
                email: user.email,
                photo: user.photo || '',
                provider: user.provider,
                role: user.role,
                status: user.status
            } : null,
            sessionId: req.sessionID
        };
    }

    // Tạo user data cho frontend
    getUserDataForFrontend(req) {
        const authStatus = this.checkAuthStatus(req);
        
        if (authStatus.authenticated && authStatus.user) {
            console.log('✅ Generating user data for frontend:', authStatus.user.name);
            return {
                id: authStatus.user.id,
                name: authStatus.user.name,
                email: authStatus.user.email,
                photo: authStatus.user.photo || '/images/default-avatar.png',
                provider: authStatus.user.provider,
                role: authStatus.user.role,
                status: authStatus.user.status,
                isAuthenticated: true
            };
        } else {
            console.log('❌ No authenticated user for frontend');
            return null;
        }
    }

    // Tạo user icon HTML
    generateUserIconHTML(req) {
        const userData = this.getUserDataForFrontend(req);
        
        if (userData) {
            return `
                <div class="user-icon-authenticated" onclick="openUserProfile()">
                    <img src="${userData.photo}" alt="${userData.name}" class="user-avatar-small">
                    <span class="user-name-display">${userData.name}</span>
                </div>
            `;
        } else {
            return `<i class="fas fa-user" onclick="openModal()"></i>`;
        }
    }

    // Tạo user menu HTML
    generateUserMenuHTML(req) {
        const userData = this.getUserDataForFrontend(req);
        
        if (!userData) return '';

        return `
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
                    <strong>${userData.name}</strong><br>
                    <small style="color: #666;">${userData.email}</small>
                </div>
                <a href="/admin" style="display: block; padding: 10px 15px; text-decoration: none; color: #333;">
                    <i class="fas fa-cog"></i> Admin Panel
                </a>
                <a href="/logout" style="display: block; padding: 10px 15px; text-decoration: none; color: #d73d32;">
                    <i class="fas fa-sign-out-alt"></i> Đăng xuất
                </a>
            </div>
        `;
    }

    // Log user activity
    logUserActivity(req, activity) {
        const user = req.user;
        const sessionId = req.sessionID;
        
        console.log(`📊 User Activity [${sessionId.substring(0, 8)}...]:`, {
            user: user ? user.name : 'Anonymous',
            activity: activity,
            timestamp: new Date().toISOString(),
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    }
}

module.exports = new AuthService();
