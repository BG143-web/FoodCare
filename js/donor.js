/**
 * FoodCare - Donor Dashboard Functionality
 * Vanilla JavaScript (No Frameworks)
 */

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('donor-dashboard-root')) {
    initDonorDashboard();
  }
});

async function initDonorDashboard() {
  // 1. Authenticate with real backend
  const user = await window.API.auth.getMe();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Strict Role Check: Donors only
  if (user.role !== 'donor') {
    console.warn(`Access denied to donor dashboard for role: ${user.role}`);
    window.showToast('Access restricted: You are registered as a Food Seeker. Redirecting to Seeker Dashboard...', 'warning', 3500);
    setTimeout(() => {
      window.location.href = 'seeker-dashboard.html';
    }, 600);
    return;
  }

  // Set welcome message
  const welcomeName = document.getElementById('donor-welcome-name');
  if (welcomeName) {
    welcomeName.textContent = user.organization || user.name || 'Verified Food Donor';
  }

  await loadDonorStats();
  await loadDonorRecentFoods();
  initAddFoodModal();
}

/**
 * Load and calculate stats
 */
async function loadDonorStats() {
  try {
    const foods = await window.API.foods.getAll();
    const requests = await window.API.requests.getAll();

    const availableCount = foods.filter(f => f.status === 'Available').length;
    const pendingCount = requests.filter(r => r.status === 'Pending').length;
    const completedCount = requests.filter(r => r.status === 'Completed').length;
    const totalDonations = foods.length;

    const elTotal = document.getElementById('stat-total-donations');
    const elAvailable = document.getElementById('stat-available-food');
    const elPending = document.getElementById('stat-pending-requests');
    const elCompleted = document.getElementById('stat-completed-donations');

    if (elTotal) elTotal.textContent = totalDonations;
    if (elAvailable) elAvailable.textContent = availableCount;
    if (elPending) elPending.textContent = pendingCount;
    if (elCompleted) elCompleted.textContent = completedCount;
  } catch (err) {
    console.error('Failed to load donor stats:', err);
  }
}

/**
 * Load recent donations for donor
 */
async function loadDonorRecentFoods() {
  const container = document.getElementById('donor-recent-foods');
  if (!container) return;

  try {
    const foods = await window.API.foods.getAll();
    container.innerHTML = '';

    if (foods.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🍲</div>
          <h3>No Food Listings Yet</h3>
          <p>You haven't listed any surplus food. Add your first donation to help someone in need!</p>
          <button onclick="window.openModal('add-food-modal')" class="btn btn-primary">+ Add Surplus Food</button>
        </div>
      `;
      return;
    }

    foods.forEach(food => {
      const card = window.createFoodCard(food, { isDonor: true });
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load foods:', err);
  }
}

/**
 * Handle Add Surplus Food Modal & Form Submission
 */
function initAddFoodModal() {
  const form = document.getElementById('add-food-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const titleInput = document.getElementById('food-name');
    const categoryInput = document.getElementById('food-category');
    const quantityInput = document.getElementById('food-quantity');
    const locationInput = document.getElementById('food-location');
    const availableUntilInput = document.getElementById('food-available-until');
    const notesInput = document.getElementById('food-notes');
    const user = window.API.auth.getCurrentUser();

    if (!titleInput.value.trim() || !quantityInput.value.trim() || !locationInput.value.trim()) {
      window.showToast('Please fill in all required food details.', 'error');
      return;
    }

    const newFoodData = {
      title: titleInput.value.trim(),
      category: categoryInput.value,
      quantity: quantityInput.value.trim(),
      location: locationInput.value.trim(),
      availableUntil: availableUntilInput.value.trim() || 'Today, 9:00 PM',
      description: notesInput ? notesInput.value.trim() : 'Fresh surplus food ready for immediate pickup.',
      donorName: user.organization || user.name || 'Verified Food Donor',
      donorPhone: user.phone || '+91 98230 11223',
      image: getCategoryDefaultImage(categoryInput.value)
    };

    try {
      await window.API.foods.create(newFoodData);
      window.showToast('Surplus food added successfully! It is now visible to seekers.', 'success', 4000);
      form.reset();
      window.closeModal('add-food-modal');

      // Refresh listings and stats
      await loadDonorRecentFoods();
      await loadDonorStats();
    } catch (err) {
      window.showToast('Error saving food listing', 'error');
    }
  });
}

function getCategoryDefaultImage(category) {
  switch (category) {
    case 'Bakery':
      return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80';
    case 'Fresh Produce':
      return 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=800&q=80';
    case 'Dairy':
      return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80';
    case 'Packaged Food':
      return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80';
    default:
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
  }
}
