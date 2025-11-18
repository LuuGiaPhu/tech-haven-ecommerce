// =====================================
// AI CHAT WIDGET WITH GEMINI API
// =====================================

// Gemini API Configuration
const GEMINI_API_KEY = 'AIzaSyAc9OMANuNHb4-A7iNj2e1dyWhWuGhrVT4';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Chat state
let chatMessages = [];
let isChatOpen = false;
let isTyping = false;

// Initialize chat widget when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    createChatWidget();
    setupChatEventListeners();
    loadChatHistory();
});

// Create chat widget HTML
function createChatWidget() {
    const chatWidgetHTML = `
        <!-- AI Chat Bubble -->
        <div class="ai-chat-bubble" id="aiChatBubble" title="Chat với AI Assistant">
            <i class="fas fa-comments"></i>
            <span class="chat-notification-badge" id="chatNotificationBadge" style="display: none;">1</span>
        </div>

        <!-- AI Chat Window -->
        <div class="ai-chat-window" id="aiChatWindow">
            <div class="ai-chat-header">
                <div class="ai-chat-header-content">
                    <div class="ai-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="ai-info">
                        <h3>AI Assistant</h3>
                        <p class="ai-status">
                            <span class="status-dot"></span>
                            Đang hoạt động
                        </p>
                    </div>
                </div>
                <div class="ai-chat-actions">
                    <button class="ai-action-btn" id="clearChatBtn" title="Xóa lịch sử chat">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="ai-action-btn" id="closeChatBtn" title="Đóng">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <div class="ai-chat-body" id="aiChatBody">
                <div class="ai-welcome-message">
                    <div class="ai-avatar-large">
                        <i class="fas fa-robot"></i>
                    </div>
                    <h4>Xin chào! 👋</h4>
                    <p>Tôi là AI Assistant của Tech Haven. Tôi có thể giúp bạn:</p>
                    <ul>
                        <li>Tư vấn sản phẩm công nghệ</li>
                        <li>So sánh cấu hình PC</li>
                        <li>Giải đáp thắc mắc</li>
                        <li>Hỗ trợ đặt hàng</li>
                    </ul>
                </div>
            </div>

            <div class="ai-chat-footer">
                <div class="ai-quick-actions" id="aiQuickActions">
                    <button class="quick-action-btn" data-message="Tư vấn PC gaming cho tôi">
                        🎮 PC Gaming
                    </button>
                    <button class="quick-action-btn" data-message="Laptop nào phù hợp cho lập trình?">
                        💻 Laptop
                    </button>
                    <button class="quick-action-btn" data-message="So sánh RTX 4070 vs RTX 4060">
                        🎯 So sánh
                    </button>
                </div>
                <div class="ai-input-container">
                    <textarea 
                        class="ai-chat-input" 
                        id="aiChatInput" 
                        placeholder="Nhập câu hỏi của bạn..."
                        rows="1"
                    ></textarea>
                    <button class="ai-send-btn" id="aiSendBtn" disabled>
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatWidgetHTML);
}

// Setup event listeners
function setupChatEventListeners() {
    const chatBubble = document.getElementById('aiChatBubble');
    const chatWindow = document.getElementById('aiChatWindow');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const chatInput = document.getElementById('aiChatInput');
    const sendBtn = document.getElementById('aiSendBtn');
    const quickActionBtns = document.querySelectorAll('.quick-action-btn');

    // Toggle chat window
    chatBubble.addEventListener('click', toggleChat);
    closeChatBtn.addEventListener('click', closeChat);

    // Clear chat history
    clearChatBtn.addEventListener('click', clearChatHistory);

    // Input events
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        sendBtn.disabled = !this.value.trim();
    });

    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (this.value.trim()) {
                sendMessage();
            }
        }
    });

    // Send button
    sendBtn.addEventListener('click', sendMessage);

    // Quick action buttons
    quickActionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const message = this.getAttribute('data-message');
            chatInput.value = message;
            sendMessage();
        });
    });
}

// Toggle chat window
function toggleChat() {
    isChatOpen = !isChatOpen;
    const chatWindow = document.getElementById('aiChatWindow');
    const chatBubble = document.getElementById('aiChatBubble');
    const notificationBadge = document.getElementById('chatNotificationBadge');

    if (isChatOpen) {
        chatWindow.classList.add('active');
        chatBubble.classList.add('active');
        notificationBadge.style.display = 'none';
        
        // Focus on input
        setTimeout(() => {
            document.getElementById('aiChatInput').focus();
        }, 300);
    } else {
        chatWindow.classList.remove('active');
        chatBubble.classList.remove('active');
    }
}

// Close chat window
function closeChat() {
    isChatOpen = false;
    document.getElementById('aiChatWindow').classList.remove('active');
    document.getElementById('aiChatBubble').classList.remove('active');
}

// Send message
async function sendMessage() {
    const chatInput = document.getElementById('aiChatInput');
    const message = chatInput.value.trim();

    if (!message || isTyping) return;

    // Add user message
    addMessage('user', message);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    document.getElementById('aiSendBtn').disabled = true;

    // Hide quick actions after first message
    const quickActions = document.getElementById('aiQuickActions');
    if (quickActions && chatMessages.length > 0) {
        quickActions.style.display = 'none';
    }

    // Get AI response
    await getAIResponse(message);
}

// Add message to chat
function addMessage(sender, text) {
    const chatBody = document.getElementById('aiChatBody');
    const welcomeMessage = chatBody.querySelector('.ai-welcome-message');
    
    // Remove welcome message on first user message
    if (sender === 'user' && welcomeMessage) {
        welcomeMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ${sender}-message`;
    
    const timestamp = new Date().toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    if (sender === 'user') {
        messageDiv.innerHTML = `
            <div class="message-content">${escapeHtml(text)}</div>
            <div class="message-time">${timestamp}</div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="ai-message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-wrapper">
                <div class="message-content">${formatAIMessage(text)}</div>
                <div class="message-time">${timestamp}</div>
            </div>
        `;
    }

    chatBody.appendChild(messageDiv);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Save to chat history
    chatMessages.push({ sender, text, timestamp: new Date().toISOString() });
    saveChatHistory();
}

// Get AI response from Gemini API
async function getAIResponse(userMessage) {
    isTyping = true;
    showTypingIndicator();

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: buildPrompt(userMessage)
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const aiText = data.candidates[0].content.parts[0].text;

        hideTypingIndicator();
        addMessage('ai', aiText);

        // Show notification if chat is closed
        if (!isChatOpen) {
            showChatNotification();
        }

    } catch (error) {
        console.error('Gemini API Error:', error);
        hideTypingIndicator();
        addMessage('ai', 'Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau.');
    } finally {
        isTyping = false;
    }
}

// Build prompt with context
function buildPrompt(userMessage) {
    const systemContext = `Bạn là AI Assistant chuyên nghiệp của Tech Haven - cửa hàng công nghệ hàng đầu Việt Nam.

NHIỆM VỤ:
- Tư vấn sản phẩm PC, Laptop, linh kiện máy tính
- Giải đáp thắc mắc về công nghệ
- So sánh cấu hình và giá cả
- Hỗ trợ khách hàng chọn sản phẩm phù hợp

PHONG CÁCH TRÌNH BÀY:
- Thân thiện, chuyên nghiệp, ngắn gọn
- Sử dụng emoji phù hợp (🎮💻⚡🔥👍)
- Trả lời bằng tiếng Việt
- Chia thành các điểm rõ ràng
- Tối đa 200 từ mỗi phản hồi

SẢN PHẨM CHÍNH:
- Laptop Gaming: ASUS ROG, MSI, Acer Predator, Alienware
- PC Gaming: RTX 4070/4060, Intel Core i5/i7, AMD Ryzen 5/7
- Linh kiện: VGA, CPU, RAM, SSD, Monitor 144Hz
- Phụ kiện: Chuột, Bàn phím cơ, Tai nghe gaming

GIÁ THAM KHẢO:
- Laptop Gaming: 20-45 triệu
- PC Gaming: 15-40 triệu  
- RTX 4070: 15-18 triệu
- RTX 4060: 9-12 triệu
- Monitor 144Hz: 4-8 triệu

CÂU HỎI KHÁCH HÀNG:`;

    return `${systemContext}\n\n${userMessage}`;
}

// Show typing indicator
function showTypingIndicator() {
    const chatBody = document.getElementById('aiChatBody');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-message ai-message typing-indicator';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="ai-message-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="message-wrapper">
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    chatBody.appendChild(typingDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
}

// Hide typing indicator
function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Show chat notification
function showChatNotification() {
    const notificationBadge = document.getElementById('chatNotificationBadge');
    notificationBadge.style.display = 'flex';
    
    // Animate bubble
    const chatBubble = document.getElementById('aiChatBubble');
    chatBubble.classList.add('notification-pulse');
    setTimeout(() => {
        chatBubble.classList.remove('notification-pulse');
    }, 1000);
}

// Clear chat history
function clearChatHistory() {
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử chat?')) {
        chatMessages = [];
        localStorage.removeItem('techHavenChatHistory');
        
        const chatBody = document.getElementById('aiChatBody');
        chatBody.innerHTML = `
            <div class="ai-welcome-message">
                <div class="ai-avatar-large">
                    <i class="fas fa-robot"></i>
                </div>
                <h4>Xin chào! 👋</h4>
                <p>Tôi là AI Assistant của Tech Haven. Tôi có thể giúp bạn:</p>
                <ul>
                    <li>Tư vấn sản phẩm công nghệ</li>
                    <li>So sánh cấu hình PC</li>
                    <li>Giải đáp thắc mắc</li>
                    <li>Hỗ trợ đặt hàng</li>
                </ul>
            </div>
        `;

        // Show quick actions again
        const quickActions = document.getElementById('aiQuickActions');
        if (quickActions) {
            quickActions.style.display = 'flex';
        }

        showNotification('Đã xóa lịch sử chat', 'success');
    }
}

// Save chat history to localStorage
function saveChatHistory() {
    try {
        localStorage.setItem('techHavenChatHistory', JSON.stringify(chatMessages));
    } catch (e) {
        console.error('Failed to save chat history:', e);
    }
}

// Load chat history from localStorage
function loadChatHistory() {
    try {
        const saved = localStorage.getItem('techHavenChatHistory');
        if (saved) {
            chatMessages = JSON.parse(saved);
            
            // Restore messages (limit to last 20)
            const recentMessages = chatMessages.slice(-20);
            if (recentMessages.length > 0) {
                const chatBody = document.getElementById('aiChatBody');
                const welcomeMessage = chatBody.querySelector('.ai-welcome-message');
                if (welcomeMessage) welcomeMessage.remove();

                recentMessages.forEach(msg => {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = `ai-message ${msg.sender}-message`;
                    
                    const time = new Date(msg.timestamp).toLocaleTimeString('vi-VN', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });

                    if (msg.sender === 'user') {
                        messageDiv.innerHTML = `
                            <div class="message-content">${escapeHtml(msg.text)}</div>
                            <div class="message-time">${time}</div>
                        `;
                    } else {
                        messageDiv.innerHTML = `
                            <div class="ai-message-avatar">
                                <i class="fas fa-robot"></i>
                            </div>
                            <div class="message-wrapper">
                                <div class="message-content">${formatAIMessage(msg.text)}</div>
                                <div class="message-time">${time}</div>
                            </div>
                        `;
                    }

                    chatBody.appendChild(messageDiv);
                });

                // Hide quick actions if there are messages
                const quickActions = document.getElementById('aiQuickActions');
                if (quickActions && recentMessages.length > 0) {
                    quickActions.style.display = 'none';
                }
            }
        }
    } catch (e) {
        console.error('Failed to load chat history:', e);
    }
}

// Format AI message with markdown-like formatting
function formatAIMessage(text) {
    // Convert **bold** to <strong>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert *italic* to <em>
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert line breaks
    text = text.replace(/\n/g, '<br>');
    
    // Convert bullet points
    text = text.replace(/^- (.+)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    return text;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.aiChatWidget = {
    toggleChat,
    closeChat,
    clearChatHistory
};
