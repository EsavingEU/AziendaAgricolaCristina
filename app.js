// App State
let currentUser = null;

// DOM Elements
const loginSection = document.getElementById('login-section');
const mainSection = document.getElementById('main-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const menuButtons = document.querySelectorAll('.menu-btn');

// Initialize App
function initApp() {
    setupEventListeners();
    setupAuthListener();
}

function setupAuthListener() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            showMainSection();
        } else {
            currentUser = null;
            showLoginSection();
        }
    });
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

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Login successful
            currentUser = userCredential.user;
            loginError.textContent = '';
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error('Login error:', errorCode, errorMessage);
            
            // User friendly error messages
            if (errorCode === 'auth/user-not-found') {
                loginError.textContent = 'Utente non trovato';
            } else if (errorCode === 'auth/wrong-password') {
                loginError.textContent = 'Password errata';
            } else if (errorCode === 'auth/invalid-email') {
                loginError.textContent = 'Email non valida';
            } else if (errorCode === 'auth/invalid-credential') {
                loginError.textContent = 'Credenziali non valide';
            } else {
                loginError.textContent = 'Errore durante il login: ' + errorMessage;
            }
        });
}

function handleLogout() {
    firebase.auth().signOut()
        .then(() => {
            // Logout successful
            currentUser = null;
        })
        .catch((error) => {
            console.error('Logout error:', error);
            alert('Errore durante il logout');
        });
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
