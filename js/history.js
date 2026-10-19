/**
 * FoodCare - User Impact & Distribution History
 * Pure Vanilla JavaScript (No Frameworks)
 * 
 * Fetches verified user-specific history and cumulative impact metrics
 * from the backend REST API (/api/history), replacing hardcoded mockup values.
 */

document.addEventListener('DOMContentLoaded', () => {
  initHistoryPage();
});

/**
 * Safely escape HTML to prevent XSS injection
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format timestamp or date string to readable format
 */
function formatHandoverDate(rawDate) {
  if (!rawDate) return 'Recently';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return String(rawDate);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Updates UI, active tab option, and table section according to user role
 */
function applyRoleHistoryUI(role) {
  const isDonor = (role || '').toLowerCase() === 'donor';
  const btnDonations = document.getElementById('show-donations-tab');
  const btnRequests = document.getElementById('show-requests-tab');
  const secDonations = document.getElementById('section-donation-history');
  const secRequests = document.getElementById('section-request-history');
  const roleBadge = document.getElementById('user-role-badge');
  const pageTitle = document.getElementById('history-page-title');
  const pageDesc = document.getElementById('history-page-desc');
  const elMealsLbl = document.getElementById('history-metric-meals-lbl');
  const navDashLink = document.getElementById('nav-dashboard-link');

  if (navDashLink) {
    navDashLink.href = isDonor ? 'donor-dashboard.html' : 'seeker-dashboard.html';
    navDashLink.textContent = isDonor ? 'Donor Dashboard' : 'Seeker Dashboard';
  }

  if (isDonor) {
    // Donor role: display donation history option only, remove seeker request history
    if (btnRequests) btnRequests.remove();
    if (btnDonations) {
      btnDonations.style.display = '';
      btnDonations.className = 'btn btn-primary btn-sm';
    }
    if (secRequests) secRequests.remove();
    if (secDonations) secDonations.style.display = 'block';

    if (roleBadge) {
      roleBadge.textContent = 'Food Donor';
      roleBadge.classList.remove('seeker');
    }
    if (pageTitle) {
      pageTitle.textContent = 'Food Rescue & Donation History';
    }
    if (pageDesc) {
      pageDesc.textContent = 'Historical archive of your completed food donations, verified handovers, and community impact.';
    }
    if (elMealsLbl) {
      elMealsLbl.textContent = 'Meals Handed Over';
    }
  } else {
    // Seeker role: display request history option only, remove donor donation history
    if (btnDonations) btnDonations.remove();
    if (btnRequests) {
      btnRequests.style.display = '';
      btnRequests.className = 'btn btn-primary btn-sm';
    }
    if (secDonations) secDonations.remove();
    if (secRequests) secRequests.style.display = 'block';

    if (roleBadge) {
      roleBadge.textContent = 'Food Seeker';
      roleBadge.classList.add('seeker');
    }
    if (pageTitle) {
      pageTitle.textContent = 'Food Relief & Request History';
    }
    if (pageDesc) {
      pageDesc.textContent = 'Historical archive of your completed food claims, community distributions, and relief impact.';
    }
    if (elMealsLbl) {
      elMealsLbl.textContent = 'Meals Received & Shared';
    }
  }
}

/**
 * Main initialization routine for History Page
 */
async function initHistoryPage() {
  // 1. Authenticate with real backend
  if (!window.API || !window.API.auth) {
    console.error('FoodCare API client is not loaded.');
    return;
  }

  // Check cached user session immediately to prevent layout flicker
  try {
    const cached = JSON.parse(localStorage.getItem('foodcare_user_session') || '{}');
    if (cached && cached.role) {
      applyRoleHistoryUI(cached.role);
    }
  } catch (err) {}

  const user = await window.API.auth.getMe();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const userRole = (user.role || '').toLowerCase();
  const isDonor = userRole === 'donor';

  // Apply role UI based on real authenticated backend role
  applyRoleHistoryUI(userRole);

  const roleSubtext = document.getElementById('user-role-subtext');
  if (roleSubtext) {
    const orgName = user.organization || user.name || (isDonor ? 'Verified Donor' : 'Community Seeker');
    roleSubtext.textContent = `• ${orgName}`;
  }

  // 4. Load authenticated user's history from backend
  let historyItems = [];
  let userSummary = {
    totalHandovers: 0,
    totalMealsSaved: 0,
    totalWasteKgSaved: 0,
    totalCo2KgSaved: 0
  };

  try {
    const response = await window.API.history.getAll();
    historyItems = Array.isArray(response) ? response : (response.history || []);

    if (response.userSummary) {
      userSummary = response.userSummary;
    } else {
      userSummary.totalHandovers = historyItems.length;
      userSummary.totalMealsSaved = historyItems.reduce((acc, item) => acc + (item.mealsSaved || 0), 0);
      userSummary.totalWasteKgSaved = parseFloat(
        historyItems.reduce((acc, item) => acc + (parseFloat(item.wasteKgSaved) || 0), 0).toFixed(2)
      );
      userSummary.totalCo2KgSaved = parseFloat(
        historyItems.reduce((acc, item) => acc + (parseFloat(item.co2KgSaved) || 0), 0).toFixed(2)
      );
    }
  } catch (err) {
    console.error('Failed to load user history from backend:', err);
    if (window.showToast) {
      window.showToast('Unable to load history records from server.', 'error');
    }
  }

  // 5. Update Impact Banner metrics dynamically from user summary
  const elMeals = document.getElementById('history-metric-meals');
  const elWaste = document.getElementById('history-metric-waste');
  const elCo2 = document.getElementById('history-metric-co2');
  const elMealsLbl = document.getElementById('history-metric-meals-lbl');

  if (elMeals) {
    elMeals.textContent = userSummary.totalMealsSaved > 0 ? `${userSummary.totalMealsSaved}` : '0';
  }
  if (elWaste) {
    elWaste.textContent = `${userSummary.totalWasteKgSaved} kg`;
  }
  if (elCo2) {
    elCo2.textContent = `${userSummary.totalCo2KgSaved} kg`;
  }
  if (elMealsLbl) {
    elMealsLbl.textContent = isDonor ? 'Meals Handed Over' : 'Meals Received & Shared';
  }

  // 6. Render table matching the active user role
  if (isDonor) {
    renderDonationsTable(historyItems);
  } else {
    renderRequestsTable(historyItems);
  }
}

/**
 * Render completed donations into donations table
 */
function renderDonationsTable(items, isOppositeRole = false) {
  const tbody = document.getElementById('donations-history-tbody');
  const badgeCount = document.getElementById('donation-badge-count');
  if (!tbody) return;

  if (badgeCount) {
    badgeCount.textContent = `${items.length} Completed`;
  }

  if (isOppositeRole) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">ℹ️</div>
          <div style="font-weight: 600; font-size: 1.05rem; color: var(--text-heading); margin-bottom: 0.25rem;">
            Food Seeker Account
          </div>
          <p style="margin: 0; font-size: 0.9rem;">
            You are registered as a Food Seeker. Your completed food claims and distributions are recorded under <strong>Request History</strong>.
          </p>
        </td>
      </tr>
    `;
    return;
  }

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🍲</div>
          <div style="font-weight: 600; font-size: 1.05rem; color: var(--text-heading); margin-bottom: 0.25rem;">
            No Completed Donations Yet
          </div>
          <p style="margin: 0 auto; font-size: 0.9rem; max-width: 480px;">
            You haven't completed any surplus food handovers yet. Once an accepted food claim is handed over to a seeker and marked complete, it will appear here in your verified audit record.
          </p>
          <div style="margin-top: 1.25rem;">
            <a href="donor-dashboard.html" class="btn btn-sm btn-primary">+ Post Surplus Food</a>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => {
    const title = item.foodTitle || item.food_title || 'Surplus Food';
    const category = item.foodCategory || item.food_category || 'General';
    const quantity = item.quantityCompleted || item.quantity_completed || item.quantity || '—';
    const recipient = item.recipientOrganization || item.seekerOrganization || item.seekerName || item.seeker_name || 'Verified Recipient';
    const phone = item.seekerPhone || item.seeker_phone || '';
    const dateStr = item.handoverDate || formatHandoverDate(item.completedAt || item.completed_at);
    const location = item.foodLocation || item.food_location || '';
    const meals = item.mealsSaved || item.meals_saved || 0;
    const waste = item.wasteKgSaved || item.waste_kg_saved || 0;

    return `
      <tr>
        <td>
          <strong>${escapeHtml(title)}</strong>
          ${location ? `<br><span style="font-size: 0.8rem; color: var(--text-muted);">📍 ${escapeHtml(location)}</span>` : ''}
        </td>
        <td>
          <span class="badge badge-accepted" style="font-size: 0.76rem;">${escapeHtml(category)}</span>
        </td>
        <td><strong>${escapeHtml(quantity)}</strong></td>
        <td>
          <strong>${escapeHtml(recipient)}</strong>
          ${phone ? `<br><span style="font-size: 0.8rem; color: var(--text-muted);">📞 ${escapeHtml(phone)}</span>` : ''}
        </td>
        <td>${escapeHtml(dateStr)}</td>
        <td>
          <span class="badge badge-completed">Completed</span>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
            🌱 ${meals} meals • ${waste} kg
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Render completed requests into requests table
 */
function renderRequestsTable(items, isOppositeRole = false) {
  const tbody = document.getElementById('requests-history-tbody');
  const badgeCount = document.getElementById('request-badge-count');
  if (!tbody) return;

  if (badgeCount) {
    badgeCount.textContent = `${items.length} Completed`;
  }

  if (isOppositeRole) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">ℹ️</div>
          <div style="font-weight: 600; font-size: 1.05rem; color: var(--text-heading); margin-bottom: 0.25rem;">
            Food Donor Account
          </div>
          <p style="margin: 0; font-size: 0.9rem;">
            You are registered as a Food Donor. Your completed surplus food donations are recorded under <strong>Donation History</strong>.
          </p>
        </td>
      </tr>
    `;
    return;
  }

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📦</div>
          <div style="font-weight: 600; font-size: 1.05rem; color: var(--text-heading); margin-bottom: 0.25rem;">
            No Completed Requests Yet
          </div>
          <p style="margin: 0 auto; font-size: 0.9rem; max-width: 480px;">
            You haven't completed any food relief distributions yet. Once an accepted food claim is collected and handed over, it will appear here in your verified audit record.
          </p>
          <div style="margin-top: 1.25rem;">
            <a href="seeker-dashboard.html" class="btn btn-sm btn-primary">Find Available Food</a>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => {
    const title = item.foodTitle || item.food_title || 'Surplus Food';
    const category = item.foodCategory || item.food_category || '';
    const donorPartner = item.donorPartner || item.donorOrganization || item.donorName || item.donor_name || 'Verified Donor';
    const phone = item.donorPhone || item.donor_phone || '';
    const quantity = item.quantityCompleted || item.quantity_completed || item.quantity || '—';
    const dateStr = item.handoverDate || formatHandoverDate(item.completedAt || item.completed_at);
    const target = item.distributionTarget || item.seekerOrganization || item.seekerName || 'Local Community';
    const location = item.foodLocation || item.food_location || '';
    const meals = item.mealsSaved || item.meals_saved || 0;
    const waste = item.wasteKgSaved || item.waste_kg_saved || 0;

    return `
      <tr>
        <td>
          <strong>${escapeHtml(title)}</strong>
          ${category ? `<br><span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(category)}</span>` : ''}
        </td>
        <td>
          <strong>${escapeHtml(donorPartner)}</strong>
          ${phone ? `<br><span style="font-size: 0.8rem; color: var(--text-muted);">📞 ${escapeHtml(phone)}</span>` : ''}
        </td>
        <td><strong>${escapeHtml(quantity)}</strong></td>
        <td>${escapeHtml(dateStr)}</td>
        <td>
          <strong>${escapeHtml(target)}</strong>
          ${location ? `<br><span style="font-size: 0.8rem; color: var(--text-muted);">📍 ${escapeHtml(location)}</span>` : ''}
        </td>
        <td>
          <span class="badge badge-completed">Completed</span>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
            🌱 ${meals} meals • ${waste} kg
          </div>
        </td>
      </tr>
    `;
  }).join('');
}
