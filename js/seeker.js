/**
 * FoodCare - Food Seeker Dashboard Functionality
 * Vanilla JavaScript (No Frameworks)
 */

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('seeker-dashboard-root')) {
    initSeekerDashboard();
  }
});

let allSeekerFoods = [];
let activeCategory = 'all';
let searchQuery = '';

async function initSeekerDashboard() {
  // 1. Authenticate with real backend
  const user = await window.API.auth.getMe();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Strict Role Check: Seekers only
  if (user.role !== 'seeker') {
    console.warn(`Access denied to seeker dashboard for role: ${user.role}`);
    window.showToast('Access restricted: You are registered as a Food Donor. Redirecting to Donor Dashboard...', 'warning', 3500);
    setTimeout(() => {
      window.location.href = 'donor-dashboard.html';
    }, 600);
    return;
  }

  const welcomeName = document.getElementById('seeker-welcome-name');
  if (welcomeName) {
    welcomeName.textContent = user.organization || user.name || 'Community Food Seeker';
  }

  await loadSeekerStats();
  await loadAvailableFoods();
  initSearchAndFilters();
}

/**
 * Load Seeker Stats
 */
async function loadSeekerStats() {
  try {
    const foods = await window.API.foods.getAll();
    const requests = await window.API.requests.getAll();

    const availableCount = foods.filter(f => f.status === 'Available').length;
    const myRequests = requests.length;
    const acceptedCount = requests.filter(r => r.status === 'Accepted').length;
    const completedCount = requests.filter(r => r.status === 'Completed').length;

    const elAvail = document.getElementById('seeker-stat-available');
    const elReqs = document.getElementById('seeker-stat-requests');
    const elAccepted = document.getElementById('seeker-stat-accepted');
    const elCompleted = document.getElementById('seeker-stat-completed');

    if (elAvail) elAvail.textContent = availableCount;
    if (elReqs) elReqs.textContent = myRequests;
    if (elAccepted) elAccepted.textContent = acceptedCount;
    if (elCompleted) elCompleted.textContent = completedCount;
  } catch (err) {
    console.error('Failed to load seeker stats:', err);
  }
}

/**
 * Fetch and render available foods for seekers
 */
async function loadAvailableFoods() {
  const container = document.getElementById('seeker-food-grid');
  if (!container) return;

  try {
    allSeekerFoods = await window.API.foods.getAll();
    renderFilteredFoods();
  } catch (err) {
    console.error('Failed to load foods for seeker:', err);
  }
}

/**
 * Filter foods based on category & search query
 */
function renderFilteredFoods() {
  const container = document.getElementById('seeker-food-grid');
  if (!container) return;

  container.innerHTML = '';

  const filtered = allSeekerFoods.filter(food => {
    const matchesCat = activeCategory === 'all' || food.category.toLowerCase() === activeCategory.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ||
      food.title.toLowerCase().includes(query) ||
      food.location.toLowerCase().includes(query) ||
      food.category.toLowerCase().includes(query) ||
      (food.donorName && food.donorName.toLowerCase().includes(query));

    return matchesCat && matchesSearch;
  });

  const countBadge = document.getElementById('filtered-count-badge');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} items available`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🔍</div>
        <h3>No Matching Food Found</h3>
        <p>Try clearing your search filters or select a different category to see available surplus food.</p>
        <button id="reset-filters-btn" class="btn btn-secondary">Reset Filters</button>
      </div>
    `;
    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        activeCategory = 'all';
        searchQuery = '';
        const searchInput = document.getElementById('seeker-search-input');
        if (searchInput) searchInput.value = '';
        document.querySelectorAll('.filter-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.category === 'all');
        });
        renderFilteredFoods();
      });
    }
    return;
  }

  filtered.forEach(food => {
    const card = window.createFoodCard(food, { isSeeker: true });
    container.appendChild(card);
  });
}

/**
 * Filter bar event handlers
 */
function initSearchAndFilters() {
  const searchInput = document.getElementById('seeker-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderFilteredFoods();
    });
  }

  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category || 'all';
      renderFilteredFoods();
    });
  });
}
