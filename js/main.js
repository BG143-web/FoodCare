/**
 * FoodCare - Main Common JavaScript
 * Reusable UI behaviors, mobile navigation, toast alerts, modals
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initActiveNav();
  initUserSessionState();
  initToastContainer();
});

/**
 * Mobile Navigation Drawer Toggle
 */
function initMobileNav() {
  const toggleBtn = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', () => {
      navLinks.classList.toggle('nav-active');
      const isExpanded = navLinks.classList.contains('nav-active');
      toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!toggleBtn.contains(e.target) && !navLinks.contains(e.target) && navLinks.classList.contains('nav-active')) {
        navLinks.classList.remove('nav-active');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

/**
 * Highlights active page in navigation based on current pathname
 */
function initActiveNav() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navItems = document.querySelectorAll('.nav-links a');

  navItems.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/**
 * Updates UI if user is logged in
 */
async function initUserSessionState() {
  const navActions = document.querySelector('.nav-actions');
  if (!navActions) return;

  // Verify real authenticated session from backend
  const currentUser = window.API ? await window.API.auth.getMe() : null;
  const isAuthPage = window.location.pathname.includes('login') || window.location.pathname.includes('register');
  const isProtectedPage = window.location.pathname.includes('dashboard') ||
    window.location.pathname.includes('requests') ||
    window.location.pathname.includes('profile') ||
    window.location.pathname.includes('history');

  if (currentUser) {
    const role = (currentUser.role || '').toLowerCase();
    const roleBadgeText = role === 'donor' ? 'Food Donor' : 'Food Seeker';
    const dashboardPage = role === 'donor' ? 'donor-dashboard.html' : 'seeker-dashboard.html';
    const dashboardTitle = role === 'donor' ? 'Donor Dashboard' : 'Seeker Dashboard';

    // Update role-based dashboard navigation if present
    const donorNav = document.getElementById('donor-dashboard-item') || document.querySelector('.nav-links a[href="donor-dashboard.html"]')?.closest('li');
    const seekerNav = document.getElementById('seeker-dashboard-item') || document.querySelector('.nav-links a[href="seeker-dashboard.html"]')?.closest('li');
    const genericDashLink = document.getElementById('nav-dashboard-link');

    if (genericDashLink) {
      genericDashLink.href = dashboardPage;
      genericDashLink.textContent = dashboardTitle;
    }

    if (donorNav && seekerNav) {
      if (role === 'donor') {
        seekerNav.remove();
        donorNav.style.display = '';
      } else if (role === 'seeker') {
        donorNav.remove();
        seekerNav.style.display = '';
      }
    }

    navActions.innerHTML = `
      <span class="badge ${role === 'donor' ? 'badge-available' : 'badge-completed'}" style="font-size: 0.82rem; padding: 0.35rem 0.65rem;">
        ${roleBadgeText}
      </span>
      <a href="profile.html" class="btn btn-sm btn-outline">Profile</a>
      <button id="nav-logout-btn" class="btn btn-sm btn-secondary">Logout</button>
    `;

    const logoutBtn = document.getElementById('nav-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (window.API) await window.API.auth.logout();
        showToast('Logged out successfully', 'info');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 500);
      });
    }
  } else {
    // If user is unauthenticated and attempting to access a protected page, redirect to login
    if (isProtectedPage) {
      window.location.href = 'login.html';
    }
  }
}

/**
 * Initializes Toast Container
 */
function initToastContainer() {
  if (!document.getElementById('toast-container')) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
}

/**
 * Global Toast Notification function
 * @param {string} message 
 * @param {'success'|'error'|'info'|'warning'} type 
 * @param {number} duration 
 */
window.showToast = function (message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Icon based on type
  let iconSvg = 'ℹ️';
  if (type === 'success') iconSvg = '✓';
  if (type === 'error') iconSvg = '✕';
  if (type === 'warning') iconSvg = '⚠';

  toast.innerHTML = `
    <span style="font-weight: 700; font-size: 1.1rem;">${iconSvg}</span>
    <span style="flex: 1;">${message}</span>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
};

/**
 * Modal Dialog Open / Close Helpers
 */
window.openModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
};

window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
};
