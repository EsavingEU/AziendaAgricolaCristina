// App State
let currentUser = null;

// DOM Elements
const loginSection = document.getElementById('login-section');
const mainSection = document.getElementById('main-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const menuButtons = document.querySelectorAll('.menu-btn');

// Authentication
const CREDENTIALS = {
    email: 'admin@azienda.it',
    password: 'admin123'
};

// Initialize App
function initApp() {
    checkAuth();
    setupEventListeners();
}

function checkAuth() {
    const savedUser = localStorage.getItem('aziendaUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainSection();
    } else {
        showLoginSection();
    }
}

function showLoginSection() {
    loginSection.style.display = 'flex';
    mainSection.style.display = 'none';
}

function showMainSection() {
    loginSection.style.display = 'none';
    mainSection.style.display = 'block';
}

function setupEventListeners() {
    // Login Form
    loginForm.addEventListener('submit', handleLogin);

    // Logout Button
    logoutBtn.addEventListener('click', handleLogout);

    // Menu Buttons
    menuButtons.forEach(btn => {
        btn.addEventListener('click', handleMenuClick);
    });
}

function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (email === CREDENTIALS.email && password === CREDENTIALS.password) {
        currentUser = { email };
        localStorage.setItem('aziendaUser', JSON.stringify(currentUser));
        loginError.textContent = '';
        showMainSection();
    } else {
        loginError.textContent = 'Credenziali non valide';
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('aziendaUser');
    showLoginSection();
}

function handleMenuClick(e) {
    const section = e.currentTarget.dataset.section;
    openSection(section);
}

function openSection(sectionName) {
    // Navigate to section in same tab
    window.location.href = `${sectionName}.html`;
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initApp);
