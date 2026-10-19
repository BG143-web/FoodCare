/**
 * FoodCare - Authentication & Form Validation
 * Vanilla JavaScript (No Frameworks)
 */

document.addEventListener('DOMContentLoaded', () => {
  initRoleSelection();
  initPasswordToggles();
  initLoginForm();
  initRegisterForm();
});

/**
 * Dynamic Role Selector UI Handling
 */
function initRoleSelection() {
  const roleInputs = document.querySelectorAll('input[name="role"]');
  const donorOnlyFields = document.querySelectorAll('.donor-only');

  roleInputs.forEach(input => {
    input.addEventListener('change', () => {
      const selectedRole = input.value;
      donorOnlyFields.forEach(field => {
        if (selectedRole === 'donor') {
          field.classList.remove('hidden');
        } else {
          field.classList.add('hidden');
        }
      });
    });
  });
}

/**
 * Toggle Password Visibility
 */
function initPasswordToggles() {
  const toggleButtons = document.querySelectorAll('.toggle-password-btn');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const input = btn.previousElementSibling;
      if (input && (input.type === 'password' || input.type === 'text')) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.textContent = isPassword ? 'Hide' : 'Show';
        btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      }
    });
  });
}

/**
 * Login Form Validation & Submission
 */
function initLoginForm() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(loginForm);

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const roleInput = document.querySelector('input[name="role"]:checked');

    let isValid = true;

    // Validate Email
    if (!emailInput.value.trim()) {
      showFieldError(emailInput, 'Email address is required');
      isValid = false;
    } else if (!validateEmail(emailInput.value.trim())) {
      showFieldError(emailInput, 'Please enter a valid email address');
      isValid = false;
    }

    // Validate Password
    if (!passwordInput.value) {
      showFieldError(passwordInput, 'Password is required');
      isValid = false;
    } else if (passwordInput.value.length < 6) {
      showFieldError(passwordInput, 'Password must be at least 6 characters');
      isValid = false;
    }

    // Validate Role
    if (!roleInput) {
      const roleGroup = document.querySelector('.role-selector-group');
      if (roleGroup) {
        const err = roleGroup.querySelector('.form-error');
        if (err) {
          err.textContent = 'Please choose your account role';
          err.classList.add('visible');
        }
      }
      isValid = false;
    }

    if (!isValid) return;

    // Authentication Request
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging in...';
    }

    try {
      const credentials = {
        email: emailInput.value.trim(),
        password: passwordInput.value,
        role: roleInput.value
      };

      const res = await window.API.auth.login(credentials);
      window.showToast(`Welcome back, ${res.user.name}!`, 'success');

      setTimeout(() => {
        if (res.user.role === 'donor') {
          window.location.href = 'donor-dashboard.html';
        } else {
          window.location.href = 'seeker-dashboard.html';
        }
      }, 700);
    } catch (err) {
      window.showToast('Login failed. Please verify credentials.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
      }
    }
  });
}

/**
 * Register Form Validation & Submission
 */
function initRegisterForm() {
  const registerForm = document.getElementById('register-form');
  if (!registerForm) return;

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(registerForm);

    const nameInput = document.getElementById('reg-name');
    const emailInput = document.getElementById('reg-email');
    const phoneInput = document.getElementById('reg-phone');
    const passwordInput = document.getElementById('reg-password');
    const confirmInput = document.getElementById('reg-confirm-password');
    const roleInput = document.querySelector('input[name="role"]:checked');
    const orgInput = document.getElementById('reg-organization');
    const termsCheckbox = document.getElementById('reg-terms');

    let isValid = true;

    // Full Name
    if (!nameInput.value.trim()) {
      showFieldError(nameInput, 'Full name is required');
      isValid = false;
    } else if (nameInput.value.trim().length < 2) {
      showFieldError(nameInput, 'Please enter a valid full name');
      isValid = false;
    }

    // Email
    if (!emailInput.value.trim()) {
      showFieldError(emailInput, 'Email address is required');
      isValid = false;
    } else if (!validateEmail(emailInput.value.trim())) {
      showFieldError(emailInput, 'Please enter a valid email address');
      isValid = false;
    }

    // Phone
    if (!phoneInput.value.trim()) {
      showFieldError(phoneInput, 'Phone number is required');
      isValid = false;
    } else if (!/^[0-9+\s-]{8,15}$/.test(phoneInput.value.trim())) {
      showFieldError(phoneInput, 'Please enter a valid phone number (at least 8 digits)');
      isValid = false;
    }

    // Password
    if (!passwordInput.value) {
      showFieldError(passwordInput, 'Password is required');
      isValid = false;
    } else if (passwordInput.value.length < 6) {
      showFieldError(passwordInput, 'Password must be at least 6 characters');
      isValid = false;
    }

    // Confirm Password
    if (!confirmInput.value) {
      showFieldError(confirmInput, 'Please confirm your password');
      isValid = false;
    } else if (confirmInput.value !== passwordInput.value) {
      showFieldError(confirmInput, 'Passwords do not match');
      isValid = false;
    }

    // Role
    if (!roleInput) {
      const roleGroup = document.querySelector('.role-selector-group');
      if (roleGroup) {
        const err = roleGroup.querySelector('.form-error');
        if (err) {
          err.textContent = 'Please choose a role';
          err.classList.add('visible');
        }
      }
      isValid = false;
    }

    // Terms & Conditions
    if (termsCheckbox && !termsCheckbox.checked) {
      const termsError = document.getElementById('terms-error');
      if (termsError) {
        termsError.textContent = 'You must agree to the Terms of Service & Privacy Policy';
        termsError.classList.add('visible');
      }
      isValid = false;
    }

    if (!isValid) return;

    // Register Account Request
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating Account...';
    }

    try {
      const payload = {
        fullName: nameInput.value.trim(),
        email: emailInput.value.trim(),
        phone: phoneInput.value.trim(),
        password: passwordInput.value,
        role: roleInput.value,
        organization: orgInput ? orgInput.value.trim() : ''
      };

      const res = await window.API.auth.register(payload);
      window.showToast('Registration successful! Redirecting...', 'success');

      setTimeout(() => {
        if (res.user.role === 'donor') {
          window.location.href = 'donor-dashboard.html';
        } else {
          window.location.href = 'seeker-dashboard.html';
        }
      }, 700);
    } catch (err) {
      window.showToast('Registration failed. Please try again.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
      }
    }
  });
}

/**
 * Validation Helpers
 */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function showFieldError(inputElement, message) {
  inputElement.classList.add('error');
  const parent = inputElement.closest('.form-group') || inputElement.parentElement;
  if (parent) {
    let errorEl = parent.querySelector('.form-error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'form-error';
      parent.appendChild(errorEl);
    }
    errorEl.textContent = message;
    errorEl.classList.add('visible');
  }
}

function clearErrors(formElement) {
  formElement.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
  formElement.querySelectorAll('.form-error').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
  });
}
