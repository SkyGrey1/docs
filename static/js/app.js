// --- App State ---
const state = {
    currentUser: null,
    services: [],
    branches: [],
    queues: [],
    users: [],
    // ... other state ...
};

// --- Socket.IO Connection ---
const socket = io(window.location.origin);
socket.on('connect', () => socket.emit('request_initial_data'));
socket.on('update_data', (data) => {
    console.log('Received data update');
    Object.assign(state, data);
    updateAllUI();
});
socket.on('notification', (data) => showNotification(data.message, data.type || 'info'));


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupStaticEventListeners();
});

function updateAllUI() {
    if (state.currentUser) {
        showNavbar();
        if (state.currentUser.role === 'admin') {
            showPage('adminDashboard');
            renderAdminDashboard();
        } else {
            showPage('staffDashboard');
            renderStaffDashboard();
        }
    } else {
        hideNavbar();
        showPage('queueSystemPage');
    }
    renderPublicDisplay();
}

// --- Event Listeners ---
function setupStaticEventListeners() {
    document.getElementById('staffLoginForm').addEventListener('submit', (e) => { e.preventDefault(); staffLogin(); });
    document.getElementById('addBranchForm').addEventListener('submit', (e) => { e.preventDefault(); handleAddOrEditBranch(); });
    document.getElementById('addUserForm').addEventListener('submit', (e) => { e.preventDefault(); handleAddOrEditUser(); });
    document.getElementById('addServiceForm').addEventListener('submit', (e) => { e.preventDefault(); handleAddOrEditService(); });
    // ... other listeners ...
}

// --- Page & Modal Navigation ---
function hideAllPages() { /* hide all pages */ }
function showPage(pageId) { /* hide all, then show one */ }
function showNavbar() { /* show authed navbar */ }
function hideNavbar() { /* hide authed navbar */ }

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// --- Authentication ---
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
        updateAllUI();
    } else {
        showNotification('Invalid credentials', 'error');
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    state.currentUser = null;
    updateAllUI();
}

// --- Admin Dashboard Rendering ---
function renderAdminDashboard() {
    if (!state.currentUser || state.currentUser.role !== 'admin') return;
    renderBranchesTable();
    renderUsersTable();
    renderServicesTable();
    // ... render other admin components ...
}

function renderBranchesTable() {
    const tbody = document.getElementById('branchesTableBody');
    tbody.innerHTML = '';
    state.branches.forEach(branch => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${branch.name}</td>
            <td>${branch.address}</td>
            <td>${branch.contact}</td>
            <td>${branch.status}</td>
            <td>
                <button onclick="showEditBranchModal(${branch.id})" class="action-btn edit-btn"><i class="fas fa-edit"></i></button>
                <button onclick="deleteBranch(${branch.id})" class="action-btn delete-btn"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    state.users.forEach(user => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.full_name}</td>
            <td>${user.role}</td>
            <td>${state.branches.find(b => b.id === user.branch_id)?.name || 'N/A'}</td>
            <td>${user.status}</td>
            <td>
                <button onclick="showEditUserModal(${user.id})" class="action-btn edit-btn"><i class="fas fa-edit"></i></button>
                <button onclick="deleteUser(${user.id})" class="action-btn delete-btn"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
}

function renderServicesTable() {
    const tbody = document.getElementById('servicesTableBody');
    tbody.innerHTML = '';
    state.services.forEach(service => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${service.name}</td>
            <td>${service.description}</td>
            <td><i class="fas ${service.icon}"></i></td>
            <td>${service.status}</td>
            <td>
                <button onclick="showEditServiceModal(${service.id})" class="action-btn edit-btn"><i class="fas fa-edit"></i></button>
                <button onclick="deleteService(${service.id})" class="action-btn delete-btn"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
}


// --- Admin CRUD Handlers ---

// Branches
function showAddBranchModal() {
    document.getElementById('addBranchForm').reset();
    document.getElementById('addBranchForm').removeAttribute('data-editing-id');
    showModal('addBranchModal');
}
function showEditBranchModal(id) {
    const branch = state.branches.find(b => b.id === id);
    if (!branch) return;
    document.getElementById('branchName').value = branch.name;
    document.getElementById('branchAddress').value = branch.address;
    document.getElementById('branchContact').value = branch.contact;
    document.getElementById('addBranchForm').setAttribute('data-editing-id', id);
    showModal('addBranchModal');
}
async function handleAddOrEditBranch() {
    const form = document.getElementById('addBranchForm');
    const id = form.getAttribute('data-editing-id');
    const data = {
        name: document.getElementById('branchName').value,
        address: document.getElementById('branchAddress').value,
        contact: document.getElementById('branchContact').value,
    };
    const url = id ? `/api/admin/branches/${id}` : '/api/admin/branches';
    const method = id ? 'PUT' : 'POST';
    await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    closeModal('addBranchModal');
    // UI will update via WebSocket
}
async function deleteBranch(id) {
    if (!confirm('Are you sure?')) return;
    await fetch(`/api/admin/branches/${id}`, { method: 'DELETE' });
}

// Users
function showAddUserModal() {
    document.getElementById('addUserForm').reset();
    document.getElementById('addUserForm').removeAttribute('data-editing-id');
    const branchSelect = document.getElementById('newUserBranch');
    branchSelect.innerHTML = state.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    showModal('addUserModal');
}
function showEditUserModal(id) {
    const user = state.users.find(u => u.id === id);
    if (!user) return;
    document.getElementById('newUsername').value = user.username;
    document.getElementById('newFullName').value = user.full_name;
    document.getElementById('newUserRole').value = user.role;
    const branchSelect = document.getElementById('newUserBranch');
    branchSelect.innerHTML = state.branches.map(b => `<option value="${b.id}" ${b.id === user.branch_id ? 'selected' : ''}>${b.name}</option>`).join('');
    document.getElementById('addUserForm').setAttribute('data-editing-id', id);
    showModal('addUserModal');
}
async function handleAddOrEditUser() {
    const form = document.getElementById('addUserForm');
    const id = form.getAttribute('data-editing-id');
    const data = {
        username: document.getElementById('newUsername').value,
        full_name: document.getElementById('newFullName').value,
        email: `user${Date.now()}@example.com`, // Placeholder
        role: document.getElementById('newUserRole').value,
        branch_id: document.getElementById('newUserBranch').value,
        password: document.getElementById('newPassword').value,
    };
    const url = id ? `/api/admin/users/${id}` : '/api/admin/users';
    const method = id ? 'PUT' : 'POST';
    await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    closeModal('addUserModal');
}
async function deleteUser(id) {
    if (!confirm('Are you sure?')) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
}

// Services
function showAddServiceModal() {
    document.getElementById('addServiceForm').reset();
    document.getElementById('addServiceForm').removeAttribute('data-editing-id');
    showModal('addServiceModal');
}
async function deleteService(id) {
    if (!confirm('Are you sure? This will delete all sub-services.')) return;
    await fetch(`/api/admin/services/${id}`, { method: 'DELETE' });
}
// ... and so on for all other functions. This is a representative sample.

// Global handlers
window.logout = logout;
window.showAddBranchModal = showAddBranchModal;
window.showEditBranchModal = showEditBranchModal;
window.deleteBranch = deleteBranch;
window.showAddUserModal = showAddUserModal;
window.showEditUserModal = showEditUserModal;
window.deleteUser = deleteUser;
window.showAddServiceModal = showAddServiceModal;
window.deleteService = deleteService;
// etc.
