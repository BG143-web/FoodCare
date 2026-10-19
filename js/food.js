/**
 * FoodCare - Food Cards & Food Details Rendering
 * Vanilla JavaScript (No Frameworks)
 */

/**
 * Reusable Food Card Generator
 * Returns an HTMLElement representing a food card
 * @param {Object} food 
 * @param {Object} options { isSeeker: boolean, isDonor: boolean }
 * @returns {HTMLElement}
 */
window.createFoodCard = function(food, options = {}) {
  const card = document.createElement('article');
  card.className = 'food-card';
  card.id = `food-card-${food.id}`;

  const statusClass = (food.status || 'Available').toLowerCase();
  const safeImg = food.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';

  card.innerHTML = `
    <div class="food-card-media">
      <img src="${safeImg}" alt="${escapeHtml(food.title)}" class="food-card-img" loading="lazy">
      <span class="food-category-pill">${escapeHtml(food.category || 'Cooked Food')}</span>
      <span class="food-status-pill badge badge-${statusClass}">
        ${escapeHtml(food.status || 'Available')}
      </span>
    </div>
    <div class="food-card-body">
      <h3 class="food-card-title">${escapeHtml(food.title)}</h3>
      <div class="food-card-donor">
        <span>📍 ${escapeHtml(food.donorName || 'Verified Donor')}</span>
      </div>
      <div class="food-meta-list">
        <div class="food-meta-item">
          <span class="food-meta-icon">📦</span>
          <span><strong>Quantity:</strong> ${escapeHtml(food.quantity)}</span>
        </div>
        <div class="food-meta-item">
          <span class="food-meta-icon">📌</span>
          <span><strong>Location:</strong> ${escapeHtml(food.location)}</span>
        </div>
        <div class="food-meta-item">
          <span class="food-meta-icon">⏰</span>
          <span><strong>Available Until:</strong> ${escapeHtml(food.availableUntil)}</span>
        </div>
      </div>
      <div class="food-card-footer">
        <a href="food-details.html?id=${encodeURIComponent(food.id)}" class="btn btn-sm btn-outline btn-block">
          View Details
        </a>
      </div>
    </div>
  `;

  return card;
};

/**
 * Initialize Food Details Page
 */
window.initFoodDetailsPage = async function() {
  const container = document.getElementById('food-details-container');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const foodId = urlParams.get('id') || 'f-101';

  try {
    const food = await window.API.foods.getById(foodId);
    if (!food) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Food Item Not Found</h3>
          <p>The requested food item could not be found or may have already been claimed.</p>
          <a href="seeker-dashboard.html" class="btn btn-primary">Browse Available Food</a>
        </div>
      `;
      return;
    }

    // Set page title
    document.title = `${food.title} - FoodCare`;

    const statusClass = (food.status || 'Available').toLowerCase();

    container.innerHTML = `
      <div class="food-details-grid">
        <div class="food-details-media">
          <img src="${food.image}" alt="${escapeHtml(food.title)}" class="food-details-img">
        </div>
        <div class="food-details-card">
          <div class="food-details-header">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem;">
              <span class="badge badge-available">${escapeHtml(food.category)}</span>
              <span class="badge badge-${statusClass}">${escapeHtml(food.status)}</span>
            </div>
            <h1 class="food-details-title">${escapeHtml(food.title)}</h1>
          </div>

          <p class="food-details-desc">${escapeHtml(food.description || 'Nutritious surplus food preserved with high sanitary standards.')}</p>

          <div class="food-info-list">
            <div class="food-info-item">
              <span class="food-info-label">Quantity</span>
              <span class="food-info-val">${escapeHtml(food.quantity)}</span>
            </div>
            <div class="food-info-item">
              <span class="food-info-label">Available Until</span>
              <span class="food-info-val">${escapeHtml(food.availableUntil)}</span>
            </div>
            <div class="food-info-item">
              <span class="food-info-label">Pickup Location</span>
              <span class="food-info-val">${escapeHtml(food.location)}</span>
            </div>
            <div class="food-info-item">
              <span class="food-info-label">Donor</span>
              <span class="food-info-val">${escapeHtml(food.donorName)}</span>
            </div>
          </div>

          <div class="donor-contact-box">
            <div class="donor-contact-title">
              <span>📋 Pickup Instructions & Contact</span>
            </div>
            <p class="donor-contact-text">
              ${escapeHtml(food.pickupNotes || 'Please contact donor upon arrival. Bring reusable crates or clean carry bags.')}
            </p>
            <p class="donor-contact-text" style="margin-top: 0.5rem; font-weight: 600;">
              Contact: ${escapeHtml(food.donorPhone || '+91 98765 43210')}
            </p>
          </div>

          <div style="margin-top: auto; display: flex; gap: 1rem; flex-wrap: wrap;">
            <button id="request-food-btn" class="btn btn-primary btn-lg" style="flex: 2;">
              Request Food
            </button>
            <a href="seeker-dashboard.html" class="btn btn-secondary btn-lg" style="flex: 1;">
              Back to Browse
            </a>
          </div>
        </div>
      </div>
    `;

    // Hook up Request Food button
    const requestBtn = document.getElementById('request-food-btn');
    if (requestBtn) {
      requestBtn.addEventListener('click', () => {
        handleRequestFood(food);
      });
    }

  } catch (err) {
    console.error('Error loading food details:', err);
    container.innerHTML = `<div class="empty-state"><p>Unable to load food details.</p></div>`;
  }
};

/**
 * Handle Request Food Interaction
 */
async function handleRequestFood(food) {
  const currentUser = await window.API.auth.getMe();
  if (!currentUser) {
    window.showToast('Please sign in as a Food Seeker to request food.', 'warning');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1200);
    return;
  }

  if (currentUser.role !== 'seeker') {
    window.showToast('Access restricted: Only registered Food Seekers (NGOs/Shelters) can request surplus food.', 'error');
    return;
  }

  const seekerName = currentUser.organization || currentUser.name || 'Community Food Seeker';
  const seekerContact = currentUser.phone || '';

  const confirmSubmit = confirm(`Confirm requesting "${food.title}" (${food.quantity}) from ${food.donorName}?`);
  if (!confirmSubmit) return;

  try {
    await window.API.requests.create({
      foodId: food.id,
      quantityRequested: food.quantity,
      notes: 'Standard community distribution request.'
    });

    window.showToast('Food claim request submitted successfully!', 'success');

    const btn = document.getElementById('request-food-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Request Submitted';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
    }
  } catch (e) {
    console.error('Request food error:', e);
    window.showToast(e.message || 'Failed to create request', 'error');
  }
}

/**
 * Utility HTML sanitizer
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
