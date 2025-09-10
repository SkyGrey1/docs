// --- App State & Initialization ---
const state = {
    currentUser: null,
    services: [],
    queues: [],
    branches: [],
    users: [],
    pendingRegistrations: [],
    lastCalled: {}, // To track TTS announcements
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    setupStaticEventListeners();
    await checkLoginStatus();
    socket.emit('request_initial_data');
}

// --- Socket.IO Handlers ---
const socket = io(window.location.origin);

socket.on('connect', () => console.log('Connected to WebSocket server.'));

socket.on('update_data', (data) => {
    console.log('Received data update:', data);

    // --- TTS Logic ---
    if (document.getElementById('publicDisplayPage')?.offsetParent && data.services) {
        data.services.forEach(service => {
            const serviceName = service.name.toLowerCase();
            const newCalledQueue = data.queues.find(q => q.service.toLowerCase() === serviceName && q.status === 'called');

            if (newCalledQueue && state.lastCalled[serviceName] !== newCalledQueue.number) {
                state.lastCalled[serviceName] = newCalledQueue.number;
                const formattedNumber = newCalledQueue.number.split('').join(' ');
                speak(`Now serving, ${formattedNumber}, at the ${service.name} counter.`);
            }
        });
    }

    Object.assign(state, data);
    renderAllComponents();
});

// --- Main Rendering Controller ---
function renderAllComponents() {
    if (!state.currentUser) {
        showPage('queueSystemPage');
        hideNavbar();
    } else if (state.currentUser.role === 'admin') {
        showPage('adminDashboard');
        showNavbar();
        renderAdminDashboard();
    } else {
        showPage('staffDashboard');
        showNavbar();
        renderStaffDashboard();
    }
    renderPublicDisplay();
    renderServiceCards();
}

// --- Component Rendering ---
function renderPublicDisplay() {
    if (!state.services) return;
    state.services.forEach(service => {
        const serviceName = service.name.toLowerCase();
        const servingQueue = state.queues.find(q => q.service.toLowerCase() === serviceName && ['called', 'serving'].includes(q.status));
        const waitingQueues = state.queues.filter(q => q.service.toLowerCase() === serviceName && q.status === 'waiting');

        const numberEl = document.getElementById(`public${service.name}Number`);
        if(numberEl) numberEl.textContent = servingQueue ? servingQueue.number : '-';

        const statusEl = document.getElementById(`public${service.name}Status`);
        if(statusEl) statusEl.textContent = servingQueue ? servingQueue.status.toUpperCase() : '';

        const waitingEl = document.getElementById(`public${service.name}Waiting`);
        if(waitingEl) {
            waitingEl.innerHTML = '';
            waitingQueues.slice(0, 5).forEach(q => {
                const div = document.createElement('div');
                div.className = 'display-waiting-number';
                div.textContent = q.number;
                waitingEl.appendChild(div);
            });
        }
    });
}
function renderStaffDashboard() { /* Placeholder */ }
function renderAdminDashboard() { /* Placeholder */ }
function renderServiceCards() { /* Placeholder */ }

// --- API & Event Handlers ---
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        state.currentUser = data.logged_in ? data.user : null;
    } catch(e) { console.error("API status check failed", e); }
}

async function staffLogin() {
    const username = document.getElementById('staffUsername').value;
    const password = document.getElementById('staffPassword').value;
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    if (response.ok) {
        state.currentUser = await response.json();
        renderAllComponents();
    } else {
        showNotification('Invalid credentials', 'error');
    }
}

function callNext() { socket.emit('staff_action', { action: 'call_next' }); }

// --- Utilities ---
function speak(text) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

function showPage(pageId) {
    document.querySelectorAll('.page-container, #queueSystemPage, #publicDisplayPage, #staffLoginPage, #staffDashboard, #adminDashboard').forEach(p => p.classList.add('hidden'));
    const page = document.getElementById(pageId);
    if(page) page.classList.remove('hidden');
}

function showNavbar() {
    const nav = document.getElementById('navbar');
    if(nav) {
        nav.classList.remove('hidden');
        document.getElementById('userRole').textContent = `${state.currentUser.full_name} (${state.currentUser.role})`;
    }
}
function hideNavbar() {
    const nav = document.getElementById('navbar');
    if(nav) nav.classList.add('hidden');
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    const notif = document.createElement('div');
    notif.className = `bg-white rounded-lg shadow-lg p-4 mb-4 fade-in border-l-4 border-${type === 'success' ? 'green' : 'red'}-500`;
    notif.textContent = message;
    container.appendChild(notif);
    setTimeout(() => notif.remove(), 5000);
}

function setupEventListeners() {
    document.getElementById('staffLoginForm')?.addEventListener('submit', (e) => { e.preventDefault(); staffLogin(); });
}

window.showPublicDisplay = () => showPage('publicDisplayPage');
window.showStaffLoginPage = () => showPage('staffLoginPage');
window.logout = () => { fetch('/api/logout', {method: 'POST'}).then(() => { state.currentUser = null; renderAllComponents(); })};
window.callNext = callNext;
