/**
 * FoodCare - REST API Client Foundation
 * 
 * Replaces previous localStorage mockup with standard fetch-based REST API calls
 * communicating with the Node.js + Express + MySQL backend.
 * 
 * Features:
 * - Credentials included on all requests for HTTP-only cookie-based JWT sessions.
 * - Centralized request pipeline with unified error handling and session validation.
 * - Synchronous & asynchronous dual-compatibility for API.auth.getCurrentUser().
 * - Comprehensive resource endpoints for auth, foods, requests, users, history, stats, and dashboards.
 */

const API_BASE = '/api';

const SESSION_STORAGE_KEY = 'foodcare_user_session';

/**
 * Local cache helpers for user profile metadata (never stores JWT or secrets)
 */
function getCachedUser() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCachedUser(user) {
  try {
    if (user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (e) {}
}

function clearCachedUser() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {}
}

/**
 * Centralized HTTP request helper
 * @param {string} endpoint - API path (e.g. '/foods' or 'auth/login')
 * @param {Object} options - Request options (method, body, headers, etc.)
 * @returns {Promise<any>}
 */
async function request(endpoint, options = {}) {
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${cleanPath}`;

  const config = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    credentials: 'include', // Send and receive HTTP-only cookies
    ...options
  };

  if (options.body && typeof options.body !== 'string') {
    config.body = JSON.stringify(options.body);
  }

  let res;
  try {
    res = await fetch(url, config);
  } catch (networkError) {
    console.error(`Network error connecting to ${url}:`, networkError);
    const err = new Error('Network error: Unable to connect to the FoodCare server. Please check your internet connection.');
    err.isNetworkError = true;
    throw err;
  }

  // Parse JSON response safely
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
  } else {
    data = await res.text();
  }

  // Handle HTTP error responses
  if (!res.ok) {
    const errorMessage = (data && (data.error || data.message)) || `Request failed with status ${res.status}`;
    const error = new Error(errorMessage);
    error.status = res.status;
    error.data = data;

    // Handle expired or unauthorized sessions
    if (res.status === 401) {
      clearCachedUser();
      error.isUnauthorized = true;
    }

    throw error;
  }

  return data;
}

/**
 * Global API Client Interface
 */
window.API = {
  // Base endpoint for reference
  BASE_URL: API_BASE,

  // ============================================================================
  // Authentication & Session Management
  // ============================================================================
  auth: {
    /**
     * Authenticate user with email, password, and optional role
     */
    async login(credentials) {
      const data = await request('/auth/login', {
        method: 'POST',
        body: credentials
      });
      if (data && data.user) {
        setCachedUser(data.user);
      }
      return data;
    },

    /**
     * Register a new donor or seeker account
     */
    async register(userData) {
      const data = await request('/auth/register', {
        method: 'POST',
        body: userData
      });
      if (data && data.user) {
        setCachedUser(data.user);
      }
      return data;
    },

    /**
     * Dual-mode user getter:
     * - Returns cached user properties immediately for synchronous code: const user = API.auth.getCurrentUser();
     * - Also functions as an async Promise for awaited callers: const user = await API.auth.getCurrentUser();
     */
    getCurrentUser() {
      const cached = getCachedUser();

      // Default safe fallback metadata for unauthenticated state
      const fallback = cached || {
        id: null,
        name: 'Guest User',
        fullName: 'Guest User',
        email: '',
        role: null,
        organization: '',
        phone: '',
        address: ''
      };

      const promise = (async () => {
        try {
          const data = await request('/auth/me');
          if (data && data.user) {
            setCachedUser(data.user);
            return data.user;
          }
          clearCachedUser();
          return null;
        } catch (err) {
          if (err.status === 401) {
            clearCachedUser();
            return null;
          }
          return cached;
        }
      })();

      // Attach properties so synchronous access (user.name, user.role) works without undefined errors
      Object.assign(promise, fallback);
      return promise;
    },

    /**
     * Explicit asynchronous check for currently authenticated user
     */
    async getMe() {
      try {
        const data = await request('/auth/me');
        if (data && data.user) {
          setCachedUser(data.user);
          return data.user;
        }
        return null;
      } catch (err) {
        if (err.status === 401) {
          clearCachedUser();
        }
        return null;
      }
    },

    /**
     * Terminate session and clear authentication cookie
     */
    async logout() {
      try {
        await request('/auth/logout', { method: 'POST' });
      } catch (err) {
        console.warn('Logout request warning:', err);
      } finally {
        clearCachedUser();
      }
      return { success: true };
    },

    /**
     * Set cached user manually
     */
    setCurrentUser(user) {
      setCachedUser(user);
    }
  },

  // ============================================================================
  // Food Listings (Public & Donor CRUD)
  // ============================================================================
  foods: {
    /**
     * Get all foods with optional filters (category, search, status)
     * Returns an Array directly for UI compatibility (.filter(), .forEach())
     */
    async getAll(params = {}) {
      let endpoint = '/foods';
      const qs = typeof params === 'string'
        ? params
        : new URLSearchParams(params).toString();
      if (qs) endpoint += `?${qs}`;

      const data = await request(endpoint);
      const list = Array.isArray(data) ? data : (data.foods || []);

      // Attach metadata to the array instance
      list.foods = list;
      list.count = list.length;
      list.success = true;
      return list;
    },

    /**
     * Get single food item by ID
     * Falls back to first available item if demo placeholder 'f-101' is requested
     */
    async getById(id) {
      if (!id || id === 'f-101' || isNaN(parseInt(id, 10))) {
        try {
          const all = await this.getAll();
          if (all && all.length > 0) {
            return all[0];
          }
        } catch (e) {}
      }

      const data = await request(`/foods/${encodeURIComponent(id)}`);
      return (data && data.food) ? data.food : data;
    },

    /**
     * Post a new surplus food listing (Donor only)
     */
    async create(foodData) {
      const data = await request('/foods', {
        method: 'POST',
        body: foodData
      });
      return (data && data.food) ? data.food : data;
    },

    /**
     * Update an existing food listing (Donor owner only)
     */
    async update(id, foodData) {
      const data = await request(`/foods/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: foodData
      });
      return (data && data.food) ? data.food : data;
    },

    /**
     * Cancel / soft-delete a food listing (Donor owner only)
     */
    async delete(id) {
      return request(`/foods/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    },

    async cancel(id) {
      return this.delete(id);
    },

    async updateStatus(id, status) {
      if (status === 'Cancelled') {
        return this.delete(id);
      }
      return this.update(id, { status });
    }
  },

  // ============================================================================
  // Food Requests & Claims
  // ============================================================================
  requests: {
    /**
     * Get requests for current user (Donors see incoming; Seekers see submitted)
     * Returns an Array directly for UI compatibility
     */
    async getAll(params = {}) {
      let endpoint = '/requests';
      const qs = typeof params === 'string'
        ? params
        : new URLSearchParams(params).toString();
      if (qs) endpoint += `?${qs}`;

      const data = await request(endpoint);
      const list = Array.isArray(data) ? data : (data.requests || []);

      list.requests = list;
      list.count = list.length;
      list.success = true;
      return list;
    },

    /**
     * Create a new food claim (Seeker only)
     */
    async create(requestData) {
      const data = await request('/requests', {
        method: 'POST',
        body: requestData
      });
      return (data && data.request) ? data.request : data;
    },

    /**
     * Update request status ('Accepted', 'Rejected', 'Completed')
     */
    async updateStatus(id, status) {
      const data = await request(`/requests/${encodeURIComponent(id)}/status`, {
        method: 'PUT',
        body: { status }
      });
      return (data && data.request) ? data.request : data;
    }
  },

  // ============================================================================
  // User Profile
  // ============================================================================
  users: {
    /**
     * Get authenticated user profile
     */
    async getProfile() {
      const data = await request('/users/profile');
      const profile = (data && data.user) ? data.user : data;
      if (profile && profile.email) {
        setCachedUser(profile);
      }
      return profile;
    },

    /**
     * Update editable profile fields (name, organization, phone, address)
     */
    async updateProfile(profileData) {
      const data = await request('/users/profile', {
        method: 'PUT',
        body: profileData
      });
      const profile = (data && data.user) ? data.user : data;
      if (profile && profile.email) {
        setCachedUser(profile);
      }
      return profile;
    }
  },

  // ============================================================================
  // Completed Distribution History & Transparencies
  // ============================================================================
  history: {
    /**
     * Get completed donation/claim history for current user
     */
    async getAll() {
      const data = await request('/history');
      const list = Array.isArray(data) ? data : (data.history || []);
      list.history = list;
      list.count = list.length;
      list.userSummary = data.userSummary || null;
      list.success = true;
      return list;
    }
  },

  // ============================================================================
  // Platform Statistics
  // ============================================================================
  stats: {
    /**
     * Get public cumulative impact metrics (mealsSaved, foodDonors, foodSeekers, wasteDivertedTons)
     */
    async getSummary() {
      return request('/stats/summary');
    }
  },

  // ============================================================================
  // Dashboards (Role-Guarded)
  // ============================================================================
  donor: {
    /**
     * Get donor-specific metrics and recent activity
     */
    async getDashboard() {
      return request('/donor/dashboard');
    }
  },

  seeker: {
    /**
     * Get seeker-specific metrics, requests, and available food previews
     */
    async getDashboard() {
      return request('/seeker/dashboard');
    }
  }
};

// ============================================================================
// Direct Convenience Aliases for Alternate Calling Conventions
// ============================================================================
window.API.profile = window.API.users;
window.API.profile.get = window.API.users.getProfile;
window.API.profile.update = window.API.users.updateProfile;
window.API.stats.getPublicStats = window.API.stats.getSummary;
window.API.history.getHistory = window.API.history.getAll;
window.API.requests.getRequests = window.API.requests.getAll;
window.API.requests.createRequest = window.API.requests.create;
window.API.requests.updateRequestStatus = window.API.requests.updateStatus;
window.API.foods.cancelFood = window.API.foods.delete;
window.API.foods.updateFood = window.API.foods.update;

