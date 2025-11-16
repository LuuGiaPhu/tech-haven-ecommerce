// User Profile Management Script - Utility Functions Only
// Note: Main user authentication is handled by script.js and index.ejs

console.log('🚀 User Profile Script Loaded - Utility Mode');

// Initialize user profile functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ User Profile utilities ready');
    // No longer overriding authentication functions
});

// Utility functions for user profile (not overriding main auth system)
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

console.log('✅ User Profile Management Script Ready - Utility Mode');

// Export utility functions for use by main authentication system
window.userProfileUtils = {
    showMessage,
    showLoading,
    hideLoading
};