/**
 * TripMate Frontend Single Page Application
 * Pure Vanilla JavaScript (No external heavy frameworks)
 * Strict Black & White Theme, Accessible, Role-aware
 */

// Application State
const state = {
  user: null,
  csrfToken: null,
  currentTrip: null,
  activeTab: 'overview',
  trips: []
};

// Utilities
function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

async function apiRequest(endpoint, options = {}) {
  const headers = options.headers || {};
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Include Double-Submit CSRF Token
  const csrfToken = getCookie('XSRF-TOKEN') || state.csrfToken;
  if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes((options.method || 'GET').toUpperCase())) {
    headers['x-csrf-token'] = csrfToken;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include'
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Server error occurred');
  }

  return data;
}

// Initial Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
  setupTheme();
  setupAuthForms();
  setupNav();
  await checkSession();
});

function setupTheme() {
  const currentTheme = localStorage.getItem('tripmate_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);

  const toggleBtn = document.getElementById('themeToggleBtn');
  toggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const nextTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('tripmate_theme', nextTheme);
  });
}

function setupAuthForms() {
  const showRegisterLink = document.getElementById('showRegisterLink');
  const showLoginLink = document.getElementById('showLoginLink');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  });

  showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      state.user = res.user;
      showToast('Logged in successfully');
      renderAppView();
    } catch (err) {
      showToast(err.message);
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      showToast('Registration successful! Please sign in.');
      registerForm.style.display = 'none';
      loginForm.style.display = 'block';
      document.getElementById('loginEmail').value = email;
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      state.user = null;
      state.currentTrip = null;
      showToast('Logged out');
      renderAuthView();
    } catch (err) {
      showToast(err.message);
    }
  });
}

function setActiveNav(navId) {
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const activeLink = document.getElementById(navId);
  if (activeLink) activeLink.classList.add('active');
}

function setupNav() {
  document.getElementById('nav-dashboard').addEventListener('click', () => {
    setActiveNav('nav-dashboard');
    renderDashboard();
  });
  document.getElementById('nav-my-trips').addEventListener('click', () => {
    setActiveNav('nav-my-trips');
    renderMyTrips();
  });
  document.getElementById('nav-shared-trips').addEventListener('click', () => {
    setActiveNav('nav-shared-trips');
    renderSharedTrips();
  });
  document.getElementById('nav-audit-logs').addEventListener('click', () => {
    setActiveNav('nav-audit-logs');
    renderAuditLogsView();
  });
  document.getElementById('nav-settings').addEventListener('click', () => {
    setActiveNav('nav-settings');
    renderSettingsView();
  });
}

async function checkSession() {
  try {
    const res = await apiRequest('/api/auth/me');
    if (res.user) {
      state.user = res.user;
      renderAppView();
      return;
    }
  } catch (_) {
    // Not logged in
  }
  renderAuthView();
}

function renderAuthView() {
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('topBar').style.display = 'none';
  document.getElementById('authViewContainer').style.display = 'block';
  document.getElementById('viewContainer').style.display = 'none';
  document.getElementById('mainWrapper').style.marginLeft = '0';
}

function renderAppView() {
  document.getElementById('sidebar').style.display = 'flex';
  document.getElementById('topBar').style.display = 'flex';
  document.getElementById('authViewContainer').style.display = 'none';
  document.getElementById('viewContainer').style.display = 'block';
  document.getElementById('mainWrapper').style.marginLeft = '250px';

  document.getElementById('currentUserName').textContent = state.user.name;
  document.getElementById('currentUserEmail').textContent = state.user.email;

  renderDashboard();
}

// ---------------- DASHBOARD VIEW ----------------
async function renderDashboard() {
  document.getElementById('pageHeading').textContent = 'Trips Dashboard';
  const topActions = document.getElementById('topBarActions');
  topActions.innerHTML = `
    <button class="btn btn-primary btn-sm" id="createTripBtn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      New Trip
    </button>
  `;

  document.getElementById('createTripBtn').addEventListener('click', showCreateTripModal);

  const container = document.getElementById('viewContainer');
  container.innerHTML = `<div class="empty-state">Loading trips...</div>`;

  try {
    const res = await apiRequest('/api/trips');
    state.trips = res.data;

    const totalTrips = state.trips.length;
    const totalExpenses = state.trips.reduce((acc, t) => acc + (t.total_expenses || 0), 0);
    const ownedCount = state.trips.filter(t => t.role === 'OWNER').length;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Accessible Trips</div>
          <div class="stat-value mono">${totalTrips}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Owned Trips</div>
          <div class="stat-value mono">${ownedCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Expenses Tracked</div>
          <div class="stat-value mono">$${totalExpenses.toFixed(2)}</div>
        </div>
      </div>

      <h3 style="font-size: 16px; margin-bottom: 16px; font-weight: 700;">Your Active Trips</h3>
      <div class="trips-grid" id="tripsGrid"></div>
    `;

    const grid = document.getElementById('tripsGrid');
    if (state.trips.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p>No trips yet. Create your first travel plan!</p>
        </div>
      `;
      return;
    }

    state.trips.forEach(trip => {
      const card = document.createElement('div');
      card.className = 'card card-hover trip-card';
      
      const badgeClass = trip.role === 'OWNER' ? 'badge-owner' : (trip.role === 'EDITOR' ? 'badge-editor' : 'badge-viewer');

      card.innerHTML = `
        <div>
          <div class="trip-header">
            <h4 class="trip-title">${escapeHtml(trip.title)}</h4>
            <span class="badge ${badgeClass}">${trip.role}</span>
          </div>
          <p class="trip-desc">${escapeHtml(trip.description || 'No description provided.')}</p>
        </div>
        <div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
            <span class="mono">${escapeHtml(trip.start_date)}</span> to <span class="mono">${escapeHtml(trip.end_date)}</span>
          </div>
          <div class="trip-footer">
            <span>Budget: <strong class="mono">$${Number(trip.budget).toFixed(2)}</strong></span>
            <span>Expenses: <strong class="mono">$${Number(trip.total_expenses).toFixed(2)}</strong></span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        loadTripDetail(trip.id);
      });

      grid.appendChild(card);
    });
  } catch (err) {
    showToast(err.message);
  }
}

// ---------------- MY TRIPS VIEW (Filtered to trips owned by current user) ----------------
async function renderMyTrips() {
  document.getElementById('pageHeading').textContent = 'My Trips (Owned)';
  const topActions = document.getElementById('topBarActions');
  topActions.innerHTML = `
    <button class="btn btn-primary btn-sm" id="createTripBtnMy">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Create New Trip
    </button>
  `;

  document.getElementById('createTripBtnMy').addEventListener('click', showCreateTripModal);

  const container = document.getElementById('viewContainer');
  container.innerHTML = `<div class="empty-state">Loading your trips...</div>`;

  try {
    const res = await apiRequest('/api/trips');
    state.trips = res.data;

    // Filter to trips where current user is OWNER
    const myTrips = state.trips.filter(t => t.role === 'OWNER');
    const myTotalBudget = myTrips.reduce((acc, t) => acc + (Number(t.budget) || 0), 0);
    const myTotalSpent = myTrips.reduce((acc, t) => acc + (Number(t.total_expenses) || 0), 0);

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Trips Created by You</div>
          <div class="stat-value mono">${myTrips.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Allocated Budget</div>
          <div class="stat-value mono">$${myTotalBudget.toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Spent</div>
          <div class="stat-value mono">$${myTotalSpent.toFixed(2)}</div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-size: 16px; font-weight: 700;">Trips You Own & Manage</h3>
        <span style="font-size: 12px; color: var(--text-muted);">Full administrative control (Share, Revoke, Delete)</span>
      </div>
      <div class="trips-grid" id="myTripsGrid"></div>
    `;

    const grid = document.getElementById('myTripsGrid');
    if (myTrips.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p>You haven't created any trips yet. Click "+ Create New Trip" to get started.</p>
        </div>
      `;
      return;
    }

    myTrips.forEach(trip => {
      const card = document.createElement('div');
      card.className = 'card card-hover trip-card';

      card.innerHTML = `
        <div>
          <div class="trip-header">
            <h4 class="trip-title">${escapeHtml(trip.title)}</h4>
            <span class="badge badge-owner">OWNER</span>
          </div>
          <p class="trip-desc">${escapeHtml(trip.description || 'No description provided.')}</p>
        </div>
        <div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
            <span class="mono">${escapeHtml(trip.start_date)}</span> to <span class="mono">${escapeHtml(trip.end_date)}</span>
            &bull; <span class="mono">${trip.member_count || 1} member(s)</span>
          </div>
          <div class="trip-footer">
            <span>Budget: <strong class="mono">$${Number(trip.budget).toFixed(2)}</strong></span>
            <span>Expenses: <strong class="mono">$${Number(trip.total_expenses).toFixed(2)}</strong></span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        loadTripDetail(trip.id);
      });

      grid.appendChild(card);
    });
  } catch (err) {
    showToast(err.message);
  }
}

// ---------------- SHARED WITH ME VIEW (Filtered to EDITOR or VIEWER trips) ----------------
async function renderSharedTrips() {
  document.getElementById('pageHeading').textContent = 'Shared with Me';
  const topActions = document.getElementById('topBarActions');
  topActions.innerHTML = '';

  const container = document.getElementById('viewContainer');
  container.innerHTML = `<div class="empty-state">Loading shared trips...</div>`;

  try {
    const res = await apiRequest('/api/trips');
    state.trips = res.data;

    // Filter to trips where role is EDITOR or VIEWER
    const sharedTrips = state.trips.filter(t => t.role === 'EDITOR' || t.role === 'VIEWER');
    const editorCount = sharedTrips.filter(t => t.role === 'EDITOR').length;
    const viewerCount = sharedTrips.filter(t => t.role === 'VIEWER').length;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Shared Trips</div>
          <div class="stat-value mono">${sharedTrips.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Editor Access</div>
          <div class="stat-value mono">${editorCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Viewer (Read-Only)</div>
          <div class="stat-value mono">${viewerCount}</div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-size: 16px; font-weight: 700;">Trips Shared by Others</h3>
        <span style="font-size: 12px; color: var(--text-muted);">Collaborative access granted by trip owners</span>
      </div>
      <div class="trips-grid" id="sharedTripsGrid"></div>
    `;

    const grid = document.getElementById('sharedTripsGrid');
    if (sharedTrips.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p>No trips have been shared with you yet. Collaborators can invite you via your email: <code>${escapeHtml(state.user.email)}</code></p>
        </div>
      `;
      return;
    }

    sharedTrips.forEach(trip => {
      const card = document.createElement('div');
      card.className = 'card card-hover trip-card';
      const badgeClass = trip.role === 'EDITOR' ? 'badge-editor' : 'badge-viewer';

      card.innerHTML = `
        <div>
          <div class="trip-header">
            <h4 class="trip-title">${escapeHtml(trip.title)}</h4>
            <span class="badge ${badgeClass}">${trip.role}</span>
          </div>
          <p class="trip-desc">${escapeHtml(trip.description || 'No description provided.')}</p>
        </div>
        <div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
            <span class="mono">${escapeHtml(trip.start_date)}</span> to <span class="mono">${escapeHtml(trip.end_date)}</span>
          </div>
          <div class="trip-footer">
            <span>Expenses: <strong class="mono">$${Number(trip.total_expenses).toFixed(2)}</strong></span>
            <span>Access: <strong>${trip.role === 'EDITOR' ? 'Can Edit' : 'Read Only'}</strong></span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        loadTripDetail(trip.id);
      });

      grid.appendChild(card);
    });
  } catch (err) {
    showToast(err.message);
  }
}

// ---------------- SETTINGS VIEW ----------------
function renderSettingsView() {
  document.getElementById('pageHeading').textContent = 'Account & Security Settings';
  document.getElementById('topBarActions').innerHTML = '';

  const container = document.getElementById('viewContainer');
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

  container.innerHTML = `
    <div style="max-width: 600px; display: flex; flex-direction: column; gap: 20px;">
      <div class="card">
        <h4 style="font-weight: 700; margin-bottom: 16px;">User Profile</h4>
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input type="text" class="form-control" value="${escapeHtml(state.user.name)}" disabled>
        </div>
        <div class="form-group">
          <label class="form-label">Email Address</label>
          <input type="email" class="form-control" value="${escapeHtml(state.user.email)}" disabled>
        </div>
        <div class="form-group">
          <label class="form-label">User ID (UUID)</label>
          <input type="text" class="form-control mono" value="${escapeHtml(state.user.id)}" disabled>
        </div>
      </div>

      <div class="card">
        <h4 style="font-weight: 700; margin-bottom: 16px;">Interface Theme</h4>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">
          Strict black and white aesthetic. Choose between high-contrast dark mode and clean light mode.
        </p>
        <div style="display: flex; gap: 12px;">
          <button class="btn ${currentTheme === 'dark' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="setDarkBtn">Dark Mode (#0A0A0A)</button>
          <button class="btn ${currentTheme === 'light' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="setLightBtn">Light Mode (#FFFFFF)</button>
        </div>
      </div>

      <div class="card">
        <h4 style="font-weight: 700; margin-bottom: 16px;">Security Policy Status</h4>
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
          <div>&bull; <strong>Password Policy:</strong> Minimum 10 characters, complexity regex enforced</div>
          <div>&bull; <strong>Hashing:</strong> Salted bcrypt (cost factor 12)</div>
          <div>&bull; <strong>Session:</strong> Short-lived JWT (15 min) in HttpOnly, SameSite=Strict cookie</div>
          <div>&bull; <strong>CSRF Defense:</strong> Double-Submit Cookie verification on state changes</div>
          <div>&bull; <strong>Account Lockout:</strong> 5 failed attempts trigger 15-minute temporary lock</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('setDarkBtn').addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('tripmate_theme', 'dark');
    renderSettingsView();
  });

  document.getElementById('setLightBtn').addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('tripmate_theme', 'light');
    renderSettingsView();
  });
}

// ---------------- TRIP DETAIL VIEW ----------------
async function loadTripDetail(tripId) {
  try {
    const res = await apiRequest(`/api/trips/${tripId}`);
    state.currentTrip = res.data;
    renderTripDetail();
  } catch (err) {
    showToast(err.message);
  }
}

function renderTripDetail() {
  const trip = state.currentTrip;
  document.getElementById('pageHeading').textContent = trip.title;

  const topActions = document.getElementById('topBarActions');
  const role = trip.userRole;

  let actionButtons = `
    <button class="btn btn-secondary btn-sm" id="backToDashboardBtn">Back</button>
  `;

  if (role === 'OWNER') {
    actionButtons += `
      <button class="btn btn-secondary btn-sm" id="shareTripBtn">Collaborators & Permissions</button>
      <button class="btn btn-secondary btn-sm" id="deleteTripBtn" style="border-color: #666;">Delete Trip</button>
    `;
  }

  topActions.innerHTML = actionButtons;

  document.getElementById('backToDashboardBtn').addEventListener('click', renderDashboard);
  if (role === 'OWNER') {
    document.getElementById('shareTripBtn').addEventListener('click', showShareModal);
    document.getElementById('deleteTripBtn').addEventListener('click', confirmDeleteTrip);
  }

  const container = document.getElementById('viewContainer');
  const badgeClass = role === 'OWNER' ? 'badge-owner' : (role === 'EDITOR' ? 'badge-editor' : 'badge-viewer');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
      <div>
        <p style="color: var(--text-secondary); margin-bottom: 4px;">${escapeHtml(trip.description || '')}</p>
        <span style="font-size: 12px; color: var(--text-muted);">
          Dates: <strong class="mono">${trip.start_date}</strong> - <strong class="mono">${trip.end_date}</strong>
          &nbsp;|&nbsp; Budget: <strong class="mono">$${Number(trip.budget).toFixed(2)}</strong>
        </span>
      </div>
      <div>
        <span class="badge ${badgeClass}">ROLE: ${role}</span>
      </div>
    </div>

    <!-- Tab navigation -->
    <div class="tabs-nav">
      <button class="tab-btn ${state.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</button>
      <button class="tab-btn ${state.activeTab === 'destinations' ? 'active' : ''}" data-tab="destinations">Destinations</button>
      <button class="tab-btn ${state.activeTab === 'itinerary' ? 'active' : ''}" data-tab="itinerary">Itinerary</button>
      <button class="tab-btn ${state.activeTab === 'expenses' ? 'active' : ''}" data-tab="expenses">Expenses & Chart</button>
      ${role === 'OWNER' ? `<button class="tab-btn ${state.activeTab === 'activity' ? 'active' : ''}" data-tab="activity">Trip Activity Log</button>` : ''}
    </div>

    <div id="tabContent"></div>
  `;

  // Attach tab handlers
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.activeTab = e.target.getAttribute('data-tab');
      renderTripDetail();
    });
  });

  renderActiveTab();
}

async function renderActiveTab() {
  const content = document.getElementById('tabContent');
  const trip = state.currentTrip;
  const role = trip.userRole;
  const isEditable = role === 'OWNER' || role === 'EDITOR';

  if (state.activeTab === 'overview') {
    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Spent</div>
          <div class="stat-value mono">$${Number(trip.totalExpenses).toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Remaining Budget</div>
          <div class="stat-value mono">$${(Number(trip.budget) - Number(trip.totalExpenses)).toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Collaborators</div>
          <div class="stat-value mono">${trip.collaborators.length}</div>
        </div>
      </div>
      <div class="card">
        <h4 style="font-weight: 700; margin-bottom: 12px;">Collaborators on this trip</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            ${trip.collaborators.map(c => `
              <tr>
                <td>${escapeHtml(c.name)}</td>
                <td><span class="mono">${escapeHtml(c.email)}</span></td>
                <td><span class="badge ${c.role === 'OWNER' ? 'badge-owner' : (c.role === 'EDITOR' ? 'badge-editor' : 'badge-viewer')}">${c.role}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (state.activeTab === 'destinations') {
    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h4 style="font-weight: 700;">Destinations</h4>
        ${isEditable ? `<button class="btn btn-primary btn-sm" id="addDestBtn">+ Add Destination</button>` : ''}
      </div>
      <div id="destListContainer">Loading...</div>
    `;

    if (isEditable) {
      document.getElementById('addDestBtn').addEventListener('click', showAddDestinationModal);
    }

    try {
      const res = await apiRequest(`/api/trips/${trip.id}/destinations`);
      const destList = res.data;
      const listContainer = document.getElementById('destListContainer');
      if (destList.length === 0) {
        listContainer.innerHTML = `<div class="empty-state">No destinations added yet.</div>`;
        return;
      }
      listContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${destList.map(d => `
            <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h5 style="font-size: 15px; font-weight: 700;">${escapeHtml(d.name)}, ${escapeHtml(d.country)}</h5>
                <span class="mono" style="font-size: 12px; color: var(--text-secondary);">${d.arrival_date} &rarr; ${d.departure_date}</span>
                ${d.notes ? `<p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(d.notes)}</p>` : ''}
              </div>
              ${isEditable ? `
                <button class="btn btn-secondary btn-sm delete-dest-btn" data-id="${d.id}">Remove</button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;

      if (isEditable) {
        listContainer.querySelectorAll('.delete-dest-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const destId = e.target.getAttribute('data-id');
            if (confirm('Delete this destination?')) {
              await apiRequest(`/api/trips/${trip.id}/destinations/${destId}`, { method: 'DELETE' });
              showToast('Destination deleted');
              renderActiveTab();
            }
          });
        });
      }
    } catch (err) {
      showToast(err.message);
    }
  } else if (state.activeTab === 'itinerary') {
    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h4 style="font-weight: 700;">Itinerary Timeline</h4>
        ${isEditable ? `<button class="btn btn-primary btn-sm" id="addItineraryBtn">+ Add Activity</button>` : ''}
      </div>
      <div id="itineraryContainer">Loading...</div>
    `;

    if (isEditable) {
      document.getElementById('addItineraryBtn').addEventListener('click', showAddItineraryModal);
    }

    try {
      const res = await apiRequest(`/api/trips/${trip.id}/itinerary`);
      const items = res.data;
      const c = document.getElementById('itineraryContainer');
      if (items.length === 0) {
        c.innerHTML = `<div class="empty-state">No activities in this itinerary yet.</div>`;
        return;
      }

      c.innerHTML = `
        <div class="timeline">
          ${items.map(it => `
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="card" style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">
                    <span class="mono">${it.day}</span> at <strong class="mono">${it.time}</strong> &bull; ${escapeHtml(it.destination_name)}
                  </div>
                  <h5 style="font-size: 15px; font-weight: 700;">${escapeHtml(it.title)}</h5>
                  ${it.location ? `<p style="font-size: 12px; color: var(--text-secondary);">📍 ${escapeHtml(it.location)}</p>` : ''}
                  ${it.notes ? `<p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(it.notes)}</p>` : ''}
                </div>
                ${isEditable ? `
                  <button class="btn btn-secondary btn-sm delete-it-btn" data-id="${it.id}">Delete</button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;

      if (isEditable) {
        c.querySelectorAll('.delete-it-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const itemId = e.target.getAttribute('data-id');
            if (confirm('Delete this itinerary item?')) {
              await apiRequest(`/api/trips/${trip.id}/itinerary/${itemId}`, { method: 'DELETE' });
              showToast('Item deleted');
              renderActiveTab();
            }
          });
        });
      }
    } catch (err) {
      showToast(err.message);
    }
  } else if (state.activeTab === 'expenses') {
    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h4 style="font-weight: 700;">Expense Tracker & Visualization</h4>
        ${isEditable ? `<button class="btn btn-primary btn-sm" id="addExpenseBtn">+ Add Expense</button>` : ''}
      </div>
      
      <!-- Pure SVG/CSS Black and White Bar Chart -->
      <div class="chart-container" id="chartBox">
        <h5 style="font-size: 13px; font-weight: 700; margin-bottom: 16px; text-transform: uppercase;">Spending by Category</h5>
        <div id="svgChartWrapper"></div>
      </div>

      <div class="card">
        <table class="data-table" id="expensesTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Paid By</th>
              <th>Amount</th>
              ${isEditable ? `<th>Action</th>` : ''}
            </tr>
          </thead>
          <tbody id="expensesTableBody">
            <tr><td colspan="6">Loading expenses...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    if (isEditable) {
      document.getElementById('addExpenseBtn').addEventListener('click', showAddExpenseModal);
    }

    try {
      const res = await apiRequest(`/api/trips/${trip.id}/expenses`);
      const { expenses, total, categorySummary } = res.data;

      // Render Bar Chart
      renderBwBarChart(categorySummary, total);

      // Render Table
      const tbody = document.getElementById('expensesTableBody');
      if (expenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No expenses recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = expenses.map(exp => `
        <tr>
          <td><span class="mono">${exp.date}</span></td>
          <td>${exp.category}</td>
          <td>${escapeHtml(exp.description)}</td>
          <td>${escapeHtml(exp.paid_by)}</td>
          <td><strong class="mono">$${Number(exp.amount).toFixed(2)}</strong></td>
          ${isEditable ? `
            <td><button class="btn btn-secondary btn-sm delete-exp-btn" data-id="${exp.id}">Delete</button></td>
          ` : ''}
        </tr>
      `).join('');

      if (isEditable) {
        tbody.querySelectorAll('.delete-exp-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const expId = e.target.getAttribute('data-id');
            if (confirm('Delete this expense?')) {
              await apiRequest(`/api/trips/${trip.id}/expenses/${expId}`, { method: 'DELETE' });
              showToast('Expense removed');
              await loadTripDetail(trip.id);
            }
          });
        });
      }
    } catch (err) {
      showToast(err.message);
    }
  } else if (state.activeTab === 'activity') {
    content.innerHTML = `
      <h4 style="font-weight: 700; margin-bottom: 16px;">Security Audit Log (Trip Level)</h4>
      <div class="card">
        <div id="tripAuditLogContainer">Loading audit trail...</div>
      </div>
    `;

    try {
      const res = await apiRequest(`/api/trips/${trip.id}/audit-logs`);
      const logs = res.data;
      const c = document.getElementById('tripAuditLogContainer');
      if (logs.length === 0) {
        c.innerHTML = `<div class="empty-state">No audit events recorded for this trip.</div>`;
        return;
      }

      c.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Details</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td><span class="mono" style="font-size: 11px;">${l.timestamp}</span></td>
                <td><strong class="mono">${l.action}</strong></td>
                <td>${escapeHtml(l.user_name || 'System')} (${escapeHtml(l.user_email || 'N/A')})</td>
                <td><span class="mono" style="font-size: 11px;">${escapeHtml(l.details)}</span></td>
                <td><span class="mono">${escapeHtml(l.ip_address || '127.0.0.1')}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      showToast(err.message);
    }
  }
}

// Pure SVG Black & White Bar Chart Component
function renderBwBarChart(summary, total) {
  const wrapper = document.getElementById('svgChartWrapper');
  if (!summary || summary.length === 0 || total === 0) {
    wrapper.innerHTML = `<p style="font-size: 12px; color: var(--text-muted);">No expense data available to render chart.</p>`;
    return;
  }

  const maxVal = Math.max(...summary.map(s => s.total));
  const barHeight = 28;
  const gap = 14;
  const svgHeight = summary.length * (barHeight + gap) + 20;

  let barsSvg = '';
  summary.forEach((item, index) => {
    const y = index * (barHeight + gap) + 10;
    const widthPct = (item.total / maxVal) * 60; // 60% max width in SVG viewbox

    barsSvg += `
      <g>
        <text x="10" y="${y + 18}" fill="currentColor" font-size="12" font-family="sans-serif">${item.category}</text>
        <rect x="140" y="${y}" width="${widthPct * 5}" height="${barHeight}" rx="4" fill="currentColor" fill-opacity="${index % 2 === 0 ? '0.9' : '0.4'}" stroke="currentColor" stroke-width="1"></rect>
        <text x="${150 + widthPct * 5}" y="${y + 18}" fill="currentColor" font-size="12" font-family="monospace">$${Number(item.total).toFixed(2)} (${((item.total / total) * 100).toFixed(0)}%)</text>
      </g>
    `;
  });

  wrapper.innerHTML = `
    <svg viewBox="0 0 700 ${svgHeight}" width="100%" height="${svgHeight}" style="overflow: visible;">
      ${barsSvg}
    </svg>
  `;
}

// ---------------- GLOBAL AUDIT LOG VIEW ----------------
async function renderAuditLogsView() {
  document.getElementById('pageHeading').textContent = 'Security Audit Logs';
  document.getElementById('topBarActions').innerHTML = '';

  const container = document.getElementById('viewContainer');
  container.innerHTML = `<div class="card"><div class="empty-state">Loading audit trail...</div></div>`;

  try {
    const res = await apiRequest('/api/audit-logs');
    const logs = res.data;

    if (logs.length === 0) {
      container.innerHTML = `<div class="card"><div class="empty-state">No security audit logs found.</div></div>`;
      return;
    }

    container.innerHTML = `
      <div class="card">
        <h4 style="font-weight: 700; margin-bottom: 16px;">System Activity Trail</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Trip / Target</th>
              <th>Actor</th>
              <th>Details</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td><span class="mono" style="font-size: 11px;">${l.timestamp}</span></td>
                <td><strong class="mono">${l.action}</strong></td>
                <td>${escapeHtml(l.trip_title || 'N/A')}</td>
                <td>${escapeHtml(l.actor_name || 'Anonymous')}</td>
                <td><span class="mono" style="font-size: 11px;">${escapeHtml(l.details)}</span></td>
                <td><span class="mono">${escapeHtml(l.ip_address || '127.0.0.1')}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    showToast(err.message);
  }
}

// ---------------- MODALS & ACTIONS ----------------
function showModal(title, formHtml, onSubmit) {
  const container = document.getElementById('modalContainer');
  container.style.display = 'block';

  container.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="btn btn-secondary btn-sm" id="closeModalBtn">&times;</button>
        </div>
        <form id="modalForm">
          ${formHtml}
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
            <button type="button" class="btn btn-secondary" id="modalCancelBtn">Cancel</button>
            <button type="submit" class="btn btn-primary">Confirm</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const closeModal = () => {
    container.style.display = 'none';
    container.innerHTML = '';
  };

  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('modalCancelBtn').addEventListener('click', closeModal);

  document.getElementById('modalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await onSubmit(e.target);
      closeModal();
    } catch (err) {
      showToast(err.message);
    }
  });
}

function showCreateTripModal() {
  const html = `
    <div class="form-group">
      <label class="form-label">Trip Title</label>
      <input type="text" name="title" class="form-control" required placeholder="Summer Road Trip 2026">
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea name="description" class="form-control" rows="2" placeholder="Brief outline..."></textarea>
    </div>
    <div class="form-group" style="display: flex; gap: 12px;">
      <div style="flex: 1;">
        <label class="form-label">Start Date</label>
        <input type="date" name="startDate" class="form-control" required>
      </div>
      <div style="flex: 1;">
        <label class="form-label">End Date</label>
        <input type="date" name="endDate" class="form-control" required>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Budget ($)</label>
      <input type="number" step="0.01" name="budget" class="form-control" required placeholder="2500.00">
    </div>
  `;

  showModal('Create New Trip', html, async (form) => {
    const data = {
      title: form.title.value,
      description: form.description.value,
      startDate: form.startDate.value,
      endDate: form.endDate.value,
      budget: parseFloat(form.budget.value)
    };

    await apiRequest('/api/trips', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    showToast('Trip created successfully');
    renderDashboard();
  });
}

function showAddDestinationModal() {
  const html = `
    <div class="form-group">
      <label class="form-label">Destination Name</label>
      <input type="text" name="name" class="form-control" required placeholder="Tokyo">
    </div>
    <div class="form-group">
      <label class="form-label">Country</label>
      <input type="text" name="country" class="form-control" required placeholder="Japan">
    </div>
    <div class="form-group" style="display: flex; gap: 12px;">
      <div style="flex: 1;">
        <label class="form-label">Arrival Date</label>
        <input type="date" name="arrivalDate" class="form-control" required>
      </div>
      <div style="flex: 1;">
        <label class="form-label">Departure Date</label>
        <input type="date" name="departureDate" class="form-control" required>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea name="notes" class="form-control" rows="2"></textarea>
    </div>
  `;

  showModal('Add Destination', html, async (form) => {
    const data = {
      name: form.name.value,
      country: form.country.value,
      arrivalDate: form.arrivalDate.value,
      departureDate: form.departureDate.value,
      notes: form.notes.value
    };

    await apiRequest(`/api/trips/${state.currentTrip.id}/destinations`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    showToast('Destination added');
    renderActiveTab();
  });
}

async function showAddItineraryModal() {
  const destRes = await apiRequest(`/api/trips/${state.currentTrip.id}/destinations`);
  const destinations = destRes.data;

  if (destinations.length === 0) {
    showToast('Please add at least one destination first.');
    return;
  }

  const html = `
    <div class="form-group">
      <label class="form-label">Destination</label>
      <select name="destinationId" class="form-control" required>
        ${destinations.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="display: flex; gap: 12px;">
      <div style="flex: 1;">
        <label class="form-label">Date (Day)</label>
        <input type="date" name="day" class="form-control" required>
      </div>
      <div style="flex: 1;">
        <label class="form-label">Time (24h HH:MM)</label>
        <input type="text" name="time" class="form-control" placeholder="14:30" required pattern="^([01]\\d|2[0-3]):([0-5]\\d)$">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Activity Title</label>
      <input type="text" name="title" class="form-control" required placeholder="Museum Visit">
    </div>
    <div class="form-group">
      <label class="form-label">Location</label>
      <input type="text" name="location" class="form-control" placeholder="Downtown">
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea name="notes" class="form-control" rows="2"></textarea>
    </div>
  `;

  showModal('Add Itinerary Activity', html, async (form) => {
    const data = {
      destinationId: form.destinationId.value,
      day: form.day.value,
      time: form.time.value,
      title: form.title.value,
      location: form.location.value,
      notes: form.notes.value
    };

    await apiRequest(`/api/trips/${state.currentTrip.id}/itinerary`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    showToast('Itinerary item added');
    renderActiveTab();
  });
}

function showAddExpenseModal() {
  const html = `
    <div class="form-group">
      <label class="form-label">Amount ($)</label>
      <input type="number" step="0.01" min="0.01" name="amount" class="form-control" required placeholder="45.00">
    </div>
    <div class="form-group">
      <label class="form-label">Category</label>
      <select name="category" class="form-control" required>
        <option value="Accommodation">Accommodation</option>
        <option value="Transport">Transport</option>
        <option value="Food">Food</option>
        <option value="Activities">Activities</option>
        <option value="Shopping">Shopping</option>
        <option value="Other">Other</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input type="text" name="description" class="form-control" required placeholder="Dinner at bistro">
    </div>
    <div class="form-group">
      <label class="form-label">Paid By</label>
      <input type="text" name="paid_by" class="form-control" required value="${escapeHtml(state.user.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">Date</label>
      <input type="date" name="date" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
    </div>
  `;

  showModal('Record Expense', html, async (form) => {
    const data = {
      amount: parseFloat(form.amount.value),
      currency: 'USD',
      category: form.category.value,
      description: form.description.value,
      paid_by: form.paid_by.value,
      date: form.date.value
    };

    await apiRequest(`/api/trips/${state.currentTrip.id}/expenses`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    showToast('Expense recorded securely');
    await loadTripDetail(state.currentTrip.id);
  });
}

function showShareModal() {
  const trip = state.currentTrip;
  const container = document.getElementById('modalContainer');
  container.style.display = 'block';

  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 580px;">
        <div class="modal-header">
          <h3 class="modal-title">Trip Collaborators & Permissions</h3>
          <button class="btn btn-secondary btn-sm" id="closeShareModalBtn">&times;</button>
        </div>

        <!-- Add Collaborator Form -->
        <form id="shareForm" style="margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border-color);">
          <h5 style="font-weight: 700; margin-bottom: 10px;">Invite Collaborator</h5>
          <div style="display: flex; gap: 8px;">
            <input type="email" id="shareEmail" class="form-control" placeholder="collaborator@example.com" required style="flex: 2;">
            <select id="shareRole" class="form-control" style="flex: 1;">
              <option value="VIEWER">VIEWER</option>
              <option value="EDITOR">EDITOR</option>
              <option value="OWNER">OWNER</option>
            </select>
            <button type="submit" class="btn btn-primary btn-sm">Invite</button>
          </div>
        </form>

        <h5 style="font-weight: 700; margin-bottom: 12px;">Active Members</h5>
        <div style="max-height: 250px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="collabTableBody">
              ${trip.collaborators.map(c => `
                <tr>
                  <td>
                    <strong>${escapeHtml(c.name)}</strong><br>
                    <span class="mono" style="font-size: 11px; color: var(--text-muted);">${escapeHtml(c.email)}</span>
                  </td>
                  <td>
                    <select class="form-control update-role-select" data-userid="${c.user_id}" style="padding: 4px 8px; font-size: 11px;">
                      <option value="VIEWER" ${c.role === 'VIEWER' ? 'selected' : ''}>VIEWER</option>
                      <option value="EDITOR" ${c.role === 'EDITOR' ? 'selected' : ''}>EDITOR</option>
                      <option value="OWNER" ${c.role === 'OWNER' ? 'selected' : ''}>OWNER</option>
                    </select>
                  </td>
                  <td>
                    <button class="btn btn-secondary btn-sm revoke-user-btn" data-userid="${c.user_id}">Revoke</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const close = () => {
    container.style.display = 'none';
    container.innerHTML = '';
  };

  document.getElementById('closeShareModalBtn').addEventListener('click', close);

  // Invite handler
  document.getElementById('shareForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('shareEmail').value;
    const role = document.getElementById('shareRole').value;

    try {
      await apiRequest(`/api/trips/${trip.id}/collaborators`, {
        method: 'POST',
        body: JSON.stringify({ email, role })
      });
      showToast(`Invited ${email} as ${role}`);
      close();
      await loadTripDetail(trip.id);
    } catch (err) {
      showToast(err.message);
    }
  });

  // Change Role handler
  container.querySelectorAll('.update-role-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const targetUserId = e.target.getAttribute('data-userid');
      const newRole = e.target.value;
      try {
        await apiRequest(`/api/trips/${trip.id}/collaborators/${targetUserId}`, {
          method: 'PUT',
          body: JSON.stringify({ role: newRole })
        });
        showToast('Role updated successfully');
        await loadTripDetail(trip.id);
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  // Revoke handler
  container.querySelectorAll('.revoke-user-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const targetUserId = e.target.getAttribute('data-userid');
      if (confirm('Revoke access for this collaborator?')) {
        try {
          await apiRequest(`/api/trips/${trip.id}/collaborators/${targetUserId}`, {
            method: 'DELETE'
          });
          showToast('Access revoked');
          close();
          await loadTripDetail(trip.id);
        } catch (err) {
          showToast(err.message);
        }
      }
    });
  });
}

async function confirmDeleteTrip() {
  if (confirm(`Are you sure you want to permanently delete "${state.currentTrip.title}"? This cannot be undone.`)) {
    try {
      await apiRequest(`/api/trips/${state.currentTrip.id}`, { method: 'DELETE' });
      showToast('Trip deleted successfully');
      renderDashboard();
    } catch (err) {
      showToast(err.message);
    }
  }
}
