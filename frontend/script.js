/**
 * ============================================================
 * CONTEXTIQ - HYBRID SEARCH RAG ASSISTANT
 * Main JavaScript - Complete Fixed Version
 * ============================================================
 */

'use strict';

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
    API_URL: 'http://127.0.0.1:8000/ask/',
    REQUEST_TIMEOUT: 30000,
    MAX_INPUT_LENGTH: 2000,
    CHAR_COUNTER_THRESHOLD: 1500,
    MAX_HISTORY_ITEMS: 30,
    STORAGE_KEY: 'rag_chat_sessions',
    THEME_KEY: 'rag_theme',
    TOAST_DURATION: 3000,
};

// ============================================================
// APPLICATION STATE
// ============================================================

const State = {
    isLoading: false,
    currentSessionId: null,
    sessions: [],
    isSidebarOpen: true,      // desktop: open by default
    isMobileSidebarOpen: false,
    theme: 'dark',
};

// ============================================================
// DOM REFERENCES
// ============================================================

const DOM = {
    // Layout
    appWrapper:         document.querySelector('.app-wrapper'),
    sidebar:            document.getElementById('sidebar'),
    sidebarOverlay:     document.getElementById('sidebarOverlay'),
    sidebarExpandBtn:   document.getElementById('sidebarExpandBtn'),

    // Buttons
    menuBtn:            document.getElementById('menuBtn'),
    sidebarCloseBtn:    document.getElementById('sidebarCloseBtn'),
    newChatBtn:         document.getElementById('newChatBtn'),
    sendBtn:            document.getElementById('sendBtn'),
    clearChatBtn:       document.getElementById('clearChatBtn'),
    rerunBtn:           document.getElementById('rerunBtn'),
    themeToggleBtn:     document.getElementById('themeToggleBtn'),

    // Chat area
    chatContainer:      document.getElementById('chatContainer'),
    messagesArea:       document.getElementById('messagesArea'),
    welcomeScreen:      document.getElementById('welcomeScreen'),
    typingIndicator:    document.getElementById('typingIndicator'),

    // Input
    userInput:          document.getElementById('userInput'),
    charCounter:        document.getElementById('charCounter'),

    // Sidebar
    chatHistoryList:    document.getElementById('chatHistoryList'),

    // Toast
    toast:              document.getElementById('toast'),
    toastMessage:       document.getElementById('toastMessage'),
};

// ============================================================
// INITIALIZATION
// ============================================================

function init() {
    loadTheme();
    loadSessions();

    if (State.sessions.length === 0) {
        createNewSession();
    } else {
        loadSession(State.sessions[0].id);
    }

    renderChatHistory();
    setupEventListeners();
    configureMarkdown();
    updateSendButton();

    // Set initial sidebar state based on screen size
    if (window.innerWidth <= 768) {
        // Mobile: sidebar starts closed
        State.isSidebarOpen = false;
        State.isMobileSidebarOpen = false;
        hideSidebarExpandBtn();
    } else {
        // Desktop: sidebar starts open
        State.isSidebarOpen = true;
        showSidebarDesktop();
        hideSidebarExpandBtn();
    }

    DOM.userInput.focus();
}

// ============================================================
// MARKDOWN CONFIGURATION
// ============================================================

function configureMarkdown() {
    if (typeof marked === 'undefined') return;

    marked.setOptions({
        highlight: function (code, lang) {
            if (typeof hljs === 'undefined') return code;
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (err) {
                    console.warn('Highlight.js error:', err);
                }
            }
            return hljs.highlightAuto(code).value;
        },
        sanitize: false,
        gfm: true,
        breaks: true,
        mangle: false,
        headerIds: false,
    });
}

function renderMarkdown(text) {
    if (typeof marked === 'undefined') return escapeHtml(text);
    try {
        return marked.parse(text);
    } catch (err) {
        console.error('Markdown parsing error:', err);
        return escapeHtml(text);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================

function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function createNewSession() {
    const session = {
        id: generateSessionId(),
        title: 'New Chat',
        messages: [],
        timestamp: Date.now(),
    };

    State.sessions.unshift(session);
    State.currentSessionId = session.id;

    saveSessions();
    renderChatHistory();
    renderMessages();
    showWelcomeScreen(true);

    return session;
}

function loadSession(sessionId) {
    const session = State.sessions.find(s => s.id === sessionId);
    if (!session) return;

    State.currentSessionId = sessionId;

    renderMessages();
    showWelcomeScreen(session.messages.length === 0);
    scrollToBottom();
    updateHistoryActiveState();

    // Close sidebar on mobile after selecting session
    if (window.innerWidth <= 768) {
        closeMobileSidebar();
    }
}

function getCurrentSession() {
    return State.sessions.find(s => s.id === State.currentSessionId) || null;
}

function addMessageToSession(role, content) {
    const session = getCurrentSession();
    if (!session) return;

    const message = {
        id: `msg_${Date.now()}`,
        role,
        content,
        timestamp: Date.now(),
    };

    session.messages.push(message);

    // Set title from first user message
    if (role === 'user' && session.messages.filter(m => m.role === 'user').length === 1) {
        session.title = content.substring(0, 40) + (content.length > 40 ? '...' : '');
        renderChatHistory();
    }

    session.timestamp = Date.now();
    saveSessions();

    return message;
}

function deleteSession(sessionId) {
    State.sessions = State.sessions.filter(s => s.id !== sessionId);

    if (State.currentSessionId === sessionId) {
        if (State.sessions.length > 0) {
            loadSession(State.sessions[0].id);
        } else {
            createNewSession();
        }
    }

    saveSessions();
    renderChatHistory();
}

function clearCurrentSession() {
    const session = getCurrentSession();
    if (!session) return;

    session.messages = [];
    session.title = 'New Chat';
    session.timestamp = Date.now();

    saveSessions();
    renderMessages();
    renderChatHistory();
    showWelcomeScreen(true);
}

// ============================================================
// LOCAL STORAGE
// ============================================================

function saveSessions() {
    try {
        const toSave = State.sessions.slice(0, CONFIG.MAX_HISTORY_ITEMS);
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
        console.warn('Failed to save sessions:', err);
    }
}

function loadSessions() {
    try {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (stored) {
            State.sessions = JSON.parse(stored);
        }
    } catch (err) {
        console.warn('Failed to load sessions:', err);
        State.sessions = [];
    }
}

// ============================================================
// THEME MANAGEMENT
// ============================================================

function loadTheme() {
    const savedTheme = localStorage.getItem(CONFIG.THEME_KEY) || 'dark';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    State.theme = theme;

    if (theme === 'light') {
        document.body.classList.add('light-theme');
        if (DOM.themeToggleBtn) {
            DOM.themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
            DOM.themeToggleBtn.title = 'Switch to Dark Mode';
        }
    } else {
        document.body.classList.remove('light-theme');
        if (DOM.themeToggleBtn) {
            DOM.themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
            DOM.themeToggleBtn.title = 'Switch to Light Mode';
        }
    }

    localStorage.setItem(CONFIG.THEME_KEY, theme);
}

function toggleTheme() {
    applyTheme(State.theme === 'dark' ? 'light' : 'dark');
}

// ============================================================
// SIDEBAR MANAGEMENT - FIXED
// ============================================================

/**
 * Show sidebar on desktop (collapse/expand)
 */
function showSidebarDesktop() {
    if (!DOM.sidebar) return;
    DOM.sidebar.classList.remove('sidebar-hidden');
    State.isSidebarOpen = true;

    // Update menu button state
    if (DOM.menuBtn) {
        DOM.menuBtn.classList.add('active');
        DOM.menuBtn.title = 'Close Sidebar';
    }

    hideSidebarExpandBtn();
}

/**
 * Hide sidebar on desktop
 */
function hideSidebarDesktop() {
    if (!DOM.sidebar) return;
    DOM.sidebar.classList.add('sidebar-hidden');
    State.isSidebarOpen = false;

    // Update menu button state
    if (DOM.menuBtn) {
        DOM.menuBtn.classList.remove('active');
        DOM.menuBtn.title = 'Open Sidebar';
    }

    showSidebarExpandBtn();
}

/**
 * Open sidebar on mobile
 */
function openMobileSidebar() {
    if (!DOM.sidebar) return;
    DOM.sidebar.classList.add('mobile-open');
    if (DOM.sidebarOverlay) {
        DOM.sidebarOverlay.classList.add('active');
    }
    State.isMobileSidebarOpen = true;
    document.body.style.overflow = 'hidden';
}

/**
 * Close sidebar on mobile
 */
function closeMobileSidebar() {
    if (!DOM.sidebar) return;
    DOM.sidebar.classList.remove('mobile-open');
    if (DOM.sidebarOverlay) {
        DOM.sidebarOverlay.classList.remove('active');
    }
    State.isMobileSidebarOpen = false;
    document.body.style.overflow = '';
}

/**
 * Toggle sidebar - handles both mobile and desktop
 */
function toggleSidebar() {
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Mobile: toggle mobile-open class
        if (State.isMobileSidebarOpen) {
            closeMobileSidebar();
        } else {
            openMobileSidebar();
        }
    } else {
        // Desktop: toggle sidebar-hidden class
        if (State.isSidebarOpen) {
            hideSidebarDesktop();
        } else {
            showSidebarDesktop();
        }
    }
}

/**
 * Show the expand button (small tab on left edge)
 */
function showSidebarExpandBtn() {
    if (DOM.sidebarExpandBtn) {
        DOM.sidebarExpandBtn.style.display = 'flex';
    }
}

/**
 * Hide the expand button
 */
function hideSidebarExpandBtn() {
    if (DOM.sidebarExpandBtn) {
        DOM.sidebarExpandBtn.style.display = 'none';
    }
}

// ============================================================
// UI RENDERING
// ============================================================

function showWelcomeScreen(show) {
    if (DOM.welcomeScreen) {
        DOM.welcomeScreen.style.display = show ? 'flex' : 'none';
    }
    if (DOM.messagesArea) {
        DOM.messagesArea.style.display = show ? 'none' : 'flex';
    }
}

function renderMessages() {
    const session = getCurrentSession();
    if (!session || !DOM.messagesArea) return;

    DOM.messagesArea.innerHTML = '';

    if (session.messages.length === 0) {
        showWelcomeScreen(true);
        return;
    }

    showWelcomeScreen(false);

    session.messages.forEach(msg => {
        const el = createMessageElement(msg.role, msg.content, msg.timestamp);
        DOM.messagesArea.appendChild(el);
    });

    // Apply syntax highlighting
    if (typeof hljs !== 'undefined') {
        document.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });
    }

    scrollToBottom();
}

function renderChatHistory() {
    if (!DOM.chatHistoryList) return;

    DOM.chatHistoryList.innerHTML = '';

    if (State.sessions.length === 0) {
        DOM.chatHistoryList.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-comments"></i>
                <p>No chats yet</p>
            </div>
        `;
        return;
    }

    State.sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = `history-item ${session.id === State.currentSessionId ? 'active' : ''}`;
        item.dataset.sessionId = session.id;
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', `Open chat: ${session.title}`);

        item.innerHTML = `
            <i class="fas fa-message history-item-icon"></i>
            <span class="history-item-text" title="${escapeHtml(session.title)}">
                ${escapeHtml(session.title)}
            </span>
            <button 
                class="history-item-delete" 
                title="Delete chat"
                aria-label="Delete chat: ${escapeHtml(session.title)}"
                data-session-id="${session.id}"
            >
                <i class="fas fa-trash-can"></i>
            </button>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.history-item-delete')) return;
            loadSession(session.id);
        });

        item.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.target.closest('.history-item-delete')) {
                loadSession(session.id);
            }
        });

        const deleteBtn = item.querySelector('.history-item-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete "${session.title}"?`)) {
                deleteSession(session.id);
            }
        });

        DOM.chatHistoryList.appendChild(item);
    });
}

function updateHistoryActiveState() {
    document.querySelectorAll('.history-item').forEach(item => {
        item.classList.toggle(
            'active',
            item.dataset.sessionId === State.currentSessionId
        );
    });
}

// ============================================================
// MESSAGE CREATION
// ============================================================

function createMessageElement(role, content, timestamp) {
    const isUser  = role === 'user';
    const isError = role === 'error';

    const messageDiv = document.createElement('div');
    messageDiv.className = [
        'message',
        isUser  ? 'user-message'  : 'ai-message',
        isError ? 'error-message' : '',
    ].filter(Boolean).join(' ');

    const timeStr        = formatTimestamp(timestamp || Date.now());
    const renderedContent = isUser ? escapeHtml(content) : renderMarkdown(content);
    const avatarIcon     = isUser  ? 'fas fa-user'
                         : isError ? 'fas fa-exclamation-triangle'
                         : 'fas fa-brain';
    const senderLabel    = isUser  ? 'You' : 'ContextIQ';

    messageDiv.innerHTML = `
        <div class="message-avatar" aria-hidden="true">
            <i class="${avatarIcon}"></i>
        </div>
        <div class="message-content-wrapper">
            <div class="message-header">
                <span class="message-sender">${senderLabel}</span>
                <span class="message-time">${timeStr}</span>
            </div>
            <div class="message-bubble">
                ${renderedContent}
            </div>
            ${!isUser ? `
            <div class="message-footer">
                <button class="copy-btn" title="Copy response" aria-label="Copy to clipboard">
                    <i class="fas fa-copy"></i>
                    <span>Copy</span>
                </button>
            </div>
            ` : ''}
        </div>
    `;

    if (!isUser) {
        const copyBtn = messageDiv.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => copyToClipboard(content, copyBtn));
        }

        if (typeof hljs !== 'undefined') {
            messageDiv.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
        }
    }

    return messageDiv;
}

function appendMessage(role, content) {
    showWelcomeScreen(false);

    if (role !== 'error') {
        addMessageToSession(role, content);
    }

    const el = createMessageElement(role, content, Date.now());
    DOM.messagesArea.appendChild(el);
    scrollToBottom();
}

// ============================================================
// SCROLLING
// ============================================================

function scrollToBottom() {
    if (!DOM.chatContainer) return;
    requestAnimationFrame(() => {
        DOM.chatContainer.scrollTo({
            top: DOM.chatContainer.scrollHeight,
            behavior: 'smooth',
        });
    });
}

// ============================================================
// TYPING INDICATOR
// ============================================================

function showTypingIndicator() {
    if (DOM.typingIndicator) {
        DOM.typingIndicator.style.display = 'block';
        scrollToBottom();
    }
}

function hideTypingIndicator() {
    if (DOM.typingIndicator) {
        DOM.typingIndicator.style.display = 'none';
    }
}

// ============================================================
// LOADING STATE
// ============================================================

function setLoadingState(loading) {
    State.isLoading = loading;

    if (loading) {
        if (DOM.sendBtn) {
            DOM.sendBtn.disabled = true;
            DOM.sendBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        }
        if (DOM.userInput) DOM.userInput.disabled = true;
        if (DOM.rerunBtn) DOM.rerunBtn.disabled = true;
        showTypingIndicator();
    } else {
        if (DOM.sendBtn) {
            DOM.sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
        if (DOM.userInput) DOM.userInput.disabled = false;
        if (DOM.rerunBtn) DOM.rerunBtn.disabled = false;
        hideTypingIndicator();
        updateSendButton();
        if (DOM.userInput) DOM.userInput.focus();
    }
}

// ============================================================
// API COMMUNICATION
// ============================================================

class APIError extends Error {
    constructor(message, statusCode = 0, details = '') {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.details = details;
    }
}

async function queryBackend(query) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

    try {
        const response = await fetch(CONFIG.API_URL, {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept':        'application/json',
            },
            body:   JSON.stringify({ query }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new APIError(
                `Server error ${response.status}: ${response.statusText}`,
                response.status,
                errorText
            );
        }

        const data = await response.json();

        if (!data || typeof data.answer === 'undefined') {
            throw new APIError('Invalid response format from server', 0, JSON.stringify(data));
        }

        return data.answer;

    } catch (err) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
            throw new APIError('Request timed out. The server took too long to respond.', 408);
        }
        if (err instanceof APIError) throw err;
        if (err instanceof TypeError) {
            throw new APIError(
                'Cannot connect to the server. Please ensure the backend is running on http://127.0.0.1:8000',
                0,
                err.message
            );
        }

        throw new APIError(`Unexpected error: ${err.message}`, 0, err.message);
    }
}

// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage() {
    if (State.isLoading) return;

    const userQuery = DOM.userInput.value.trim();

    if (!userQuery) {
        shakeInput();
        return;
    }

    if (userQuery.length > CONFIG.MAX_INPUT_LENGTH) {
        showToast(`Message too long. Max ${CONFIG.MAX_INPUT_LENGTH} characters.`, 'error');
        return;
    }

    // Clear input
    DOM.userInput.value = '';
    autoResizeTextarea();
    updateCharCounter();
    updateSendButton();

    appendMessage('user', userQuery);
    setLoadingState(true);

    try {
        const answer = await queryBackend(userQuery);
        appendMessage('ai', answer);
    } catch (err) {
        console.error('Send message error:', err);
        appendMessage('error', buildErrorMessage(err));
    } finally {
        setLoadingState(false);
    }
}

/**
 * Re-run the last user message
 */
async function rerunLastMessage() {
    const session = getCurrentSession();
    if (!session || State.isLoading) return;

    const userMessages = session.messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return;

    const lastUserMsg = userMessages[userMessages.length - 1].content;

    appendMessage('user', lastUserMsg);
    setLoadingState(true);

    try {
        const answer = await queryBackend(lastUserMsg);
        appendMessage('ai', answer);
    } catch (err) {
        appendMessage('error', buildErrorMessage(err));
    } finally {
        setLoadingState(false);
    }
}

function buildErrorMessage(err) {
    if (err instanceof APIError) {
        let message = `⚠️ **Connection Error**\n\n${err.message}`;

        if (err.statusCode === 0) {
            message += '\n\n**Troubleshooting:**\n';
            message += '- Check if the Django server is running\n';
            message += '- Verify the URL: `http://127.0.0.1:8000/ask/`\n';
            message += '- Check for CORS configuration in Django settings';
        } else if (err.statusCode >= 500) {
            message += '\n\n**Note:** The server encountered an internal error. Check the Django logs.';
        }

        return message;
    }

    return `⚠️ **Unexpected Error**\n\n${err.message}`;
}

// ============================================================
// INPUT HANDLING
// ============================================================

function autoResizeTextarea() {
    if (!DOM.userInput) return;
    DOM.userInput.style.height = 'auto';
    const newHeight = Math.min(DOM.userInput.scrollHeight, 180);
    DOM.userInput.style.height = `${newHeight}px`;
}

function updateCharCounter() {
    if (!DOM.charCounter || !DOM.userInput) return;

    const length = DOM.userInput.value.length;
    const max    = CONFIG.MAX_INPUT_LENGTH;

    DOM.charCounter.textContent = `${length} / ${max}`;

    DOM.charCounter.classList.toggle('visible', length >= CONFIG.CHAR_COUNTER_THRESHOLD);
    DOM.charCounter.classList.remove('warning', 'danger');

    if (length >= max * 0.9)      DOM.charCounter.classList.add('danger');
    else if (length >= max * 0.75) DOM.charCounter.classList.add('warning');
}

function updateSendButton() {
    if (!DOM.sendBtn || !DOM.userInput) return;
    const hasContent = DOM.userInput.value.trim().length > 0;
    DOM.sendBtn.disabled = !hasContent || State.isLoading;
}

function shakeInput() {
    if (!DOM.userInput) return;
    DOM.userInput.style.outline = '2px solid var(--error)';
    setTimeout(() => { DOM.userInput.style.outline = ''; }, 1500);
}

// ============================================================
// CLIPBOARD
// ============================================================

async function copyToClipboard(text, button) {
    try {
        await navigator.clipboard.writeText(text);

        button.classList.add('copied');
        button.innerHTML = '<i class="fas fa-check"></i><span>Copied!</span>';
        showToast('Copied to clipboard!');

        setTimeout(() => {
            button.classList.remove('copied');
            button.innerHTML = '<i class="fas fa-copy"></i><span>Copy</span>';
        }, 2500);

    } catch (err) {
        // Fallback
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Copied to clipboard!');
        } catch {
            showToast('Failed to copy. Please copy manually.', 'error');
        }
    }
}

// ============================================================
// TOAST
// ============================================================

let toastTimeout = null;

function showToast(message, type = 'success') {
    if (!DOM.toast || !DOM.toastMessage) return;

    DOM.toastMessage.textContent = message;

    const icon = DOM.toast.querySelector('i');
    if (icon) {
        if (type === 'error') {
            icon.className = 'fas fa-exclamation-circle';
            icon.style.color = 'var(--error)';
        } else {
            icon.className = 'fas fa-check-circle';
            icon.style.color = 'var(--success)';
        }
    }

    DOM.toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        DOM.toast.classList.remove('show');
    }, CONFIG.TOAST_DURATION);
}

// ============================================================
// UTILITY
// ============================================================

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now   = new Date();

    const isToday     = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday)     return timeStr;
    if (isYesterday) return `Yesterday ${timeStr}`;

    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {

    // ---- Input ----
    if (DOM.userInput) {
        DOM.userInput.addEventListener('input', () => {
            autoResizeTextarea();
            updateCharCounter();
            updateSendButton();
        });

        DOM.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        DOM.userInput.addEventListener('paste', () => {
            requestAnimationFrame(() => {
                autoResizeTextarea();
                updateCharCounter();
                updateSendButton();
            });
        });
    }

    // ---- Send Button ----
    if (DOM.sendBtn) {
        DOM.sendBtn.addEventListener('click', sendMessage);
    }

    // ---- New Chat ----
    if (DOM.newChatBtn) {
        DOM.newChatBtn.addEventListener('click', () => {
            createNewSession();
            if (DOM.userInput) DOM.userInput.focus();
        });
    }

    // ---- Clear Chat ----
    if (DOM.clearChatBtn) {
        DOM.clearChatBtn.addEventListener('click', () => {
            const session = getCurrentSession();
            if (!session || session.messages.length === 0) return;
            if (confirm('Clear all messages in this chat?')) {
                clearCurrentSession();
            }
        });
    }

    // ---- Re-run Button ----
    if (DOM.rerunBtn) {
        DOM.rerunBtn.addEventListener('click', rerunLastMessage);
    }

    // ---- Theme Toggle ----
    if (DOM.themeToggleBtn) {
        DOM.themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // ---- Sidebar: Menu Button (top header) ----
    if (DOM.menuBtn) {
        DOM.menuBtn.addEventListener('click', toggleSidebar);
    }

    // ---- Sidebar: Close Button (inside sidebar) ----
    if (DOM.sidebarCloseBtn) {
        DOM.sidebarCloseBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeMobileSidebar();
            } else {
                hideSidebarDesktop();
            }
        });
    }

    // ---- Sidebar: Expand Button (left edge tab) ----
    if (DOM.sidebarExpandBtn) {
        DOM.sidebarExpandBtn.addEventListener('click', () => {
            showSidebarDesktop();
        });
    }

    // ---- Sidebar: Overlay Click ----
    if (DOM.sidebarOverlay) {
        DOM.sidebarOverlay.addEventListener('click', closeMobileSidebar);
    }

    // ---- Escape Key ----
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (window.innerWidth <= 768 && State.isMobileSidebarOpen) {
                closeMobileSidebar();
            }
        }
    });

    // ---- Suggestion Cards ----
    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            const query = card.dataset.query;
            if (query && DOM.userInput) {
                DOM.userInput.value = query;
                autoResizeTextarea();
                updateCharCounter();
                updateSendButton();
                sendMessage();
            }
        });
    });

    // ---- Window Resize ----
    window.addEventListener('resize', () => {
        const isMobile = window.innerWidth <= 768;

        if (!isMobile) {
            // Switching to desktop: close mobile sidebar, restore desktop state
            closeMobileSidebar();

            if (State.isSidebarOpen) {
                showSidebarDesktop();
            } else {
                hideSidebarDesktop();
            }
        } else {
            // Switching to mobile: make sure sidebar-hidden is removed
            // (mobile uses transform, not width)
            if (DOM.sidebar) {
                DOM.sidebar.classList.remove('sidebar-hidden');
            }
            hideSidebarExpandBtn();
        }
    });
}

// ============================================================
// ENTRY POINT
// ============================================================

document.addEventListener('DOMContentLoaded', init);