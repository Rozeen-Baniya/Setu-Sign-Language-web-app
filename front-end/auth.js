// Authentication module for Setu application
class Auth {
    constructor() {
        this.initDefaultUser();
        this.init();
    }

    // Initialize with a default user for demo purposes
    initDefaultUser() {
        const users = JSON.parse(localStorage.getItem('setuUsers') || '[]');
        if (users.length === 0) {
            const defaultUser = {
                username: 'demo',
                email: 'demo@setu.com',
                password: 'demo123'
            };
            users.push(defaultUser);
            localStorage.setItem('setuUsers', JSON.stringify(users));
        }
    }

    init() {
        this.updateNavigation();
        this.attachLogoutHandler();
    }

    // Check if user is logged in
    isLoggedIn() {
        return localStorage.getItem('setuUser') !== null;
    }

    // Get current user data
    getCurrentUser() {
        const userData = localStorage.getItem('setuUser');
        return userData ? JSON.parse(userData) : null;
    }

    // Login user
    login(userData) {
        localStorage.setItem('setuUser', JSON.stringify(userData));
        this.updateNavigation();
    }

    // Logout user
    logout() {
        localStorage.removeItem('setuUser');
        this.updateNavigation();
    }

    // Update navigation based on login state
    updateNavigation() {
        const loginBtn = document.querySelector('.login-btn');
        if (!loginBtn) return;

        if (this.isLoggedIn()) {
            const user = this.getCurrentUser();
            loginBtn.textContent = `Hi, ${user.username}`;
            loginBtn.classList.add('logged-in');
            loginBtn.href = '#';
            loginBtn.onclick = (e) => {
                e.preventDefault();
                this.showUserMenu();
            };
        } else {
            loginBtn.textContent = 'Login';
            loginBtn.classList.remove('logged-in');
            loginBtn.href = 'login.html';
            loginBtn.onclick = null;
        }
    }

    // Show user menu dropdown
    showUserMenu() {
        const existingMenu = document.querySelector('.user-menu');
        if (existingMenu) {
            existingMenu.remove();
            return;
        }

        const menu = document.createElement('div');
        menu.className = 'user-menu';
        menu.innerHTML = `
            <div class="user-menu-item" onclick="auth.logout()">Logout</div>
        `;
        
        const loginBtn = document.querySelector('.login-btn');
        loginBtn.parentNode.appendChild(menu);
        
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', (e) => {
                if (!menu.contains(e.target) && !loginBtn.contains(e.target)) {
                    menu.remove();
                }
            }, { once: true });
        }, 0);
    }

    // Attach logout handler
    attachLogoutHandler() {
        // This will be called from the user menu
    }
}

// Initialize auth system
const auth = new Auth();

// Add CSS for user menu
const style = document.createElement('style');
style.textContent = `
    .login-btn.logged-in {
        background: #4CAF50;
        cursor: pointer;
    }
    .user-menu {
        position: absolute;
        top: 100%;
        right: 0;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
        min-width: 120px;
    }
    .user-menu-item {
        padding: 10px 15px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
    }
    .user-menu-item:hover {
        background: #f5f5f5;
    }
    .user-menu-item:last-child {
        border-bottom: none;
    }
    .nav-container {
        position: relative;
    }
    .login-btn {
        text-decoration: none;
    }
    .footer .contact-item a {
        color: white !important;
        text-decoration: none;
    }
    .footer .contact-item a:hover {
        color: white !important;
    }
    .footer .contact-item span {
        color: white;
    }
`;
document.head.appendChild(style);