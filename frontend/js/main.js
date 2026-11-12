/* ==========================================================================
   EVENTIFY - Global Frontend SDK (API, Auth, Navbar, Notifications, Socket.IO)
   ========================================================================== */

const EventifyApp = (() => {
  const BACKEND_ORIGIN = (
    window.EVENTIFY_BACKEND_URL ||
    (typeof document !== 'undefined' &&
      document.querySelector('meta[name="eventify-backend-url"]')?.getAttribute('content')) ||
    localStorage.getItem('ev_backend_url') ||
    (window.location.origin.includes('localhost') || window.location.origin.startsWith('http')
      ? window.location.origin
      : 'http://localhost:5000')
  ).replace(/\/$/, '');

  const SOCKET_ORIGIN =
    typeof window !== 'undefined' && window.location.hostname.endsWith('.netlify.app')
      ? 'https://eventify-event-management.onrender.com'
      : BACKEND_ORIGIN;

  const API_BASE = `${BACKEND_ORIGIN}/api`;

  const getToken = () => localStorage.getItem('ev_token');
  const getUser = () => {
    try {
      const raw = localStorage.getItem('ev_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };

  const setSession = (token, user) => {
    if (token) localStorage.setItem('ev_token', token);
    if (user) localStorage.setItem('ev_user', JSON.stringify(user));
  };

  const clearSession = () => {
    localStorage.removeItem('ev_token');
    localStorage.removeItem('ev_user');
  };

  const logout = (redirectUrl = '/login.html') => {
    clearSession();
    showToast('You have been logged out safely.', 'info');
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 400);
  };

  // Universal API Fetch Wrapper
  const api = async (endpoint, options = {}) => {
    const token = getToken();
    const headers = options.headers ? { ...options.headers } : {};

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/pdf')) {
      if (!response.ok) throw new Error('Failed to download PDF');
      return await response.blob();
    }

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        // Token expired or invalid
        clearSession();
        showToast('Your session has expired. Please log in again.', 'warning');
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 700);
      }
      throw new Error(data.message || 'Something went wrong');
    }
    return data;
  };

  // Toast Notification Utility
  const showToast = (message, type = 'success') => {
    let container = document.getElementById('ev-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ev-toast-container';
      document.body.appendChild(container);
    }

    const icons = {
      success: 'fa-circle-check text-success',
      error: 'fa-circle-exclamation text-danger',
      warning: 'fa-triangle-exclamation text-warning',
      info: 'fa-bell text-primary'
    };

    const toast = document.createElement('div');
    toast.className = `ev-toast ${type}`;
    toast.innerHTML = `
      <i class="fa-solid ${icons[type] || icons.info} fs-5 mt-1"></i>
      <div class="flex-grow-1">
        <div class="fw-semibold text-dark small">${message}</div>
      </div>
      <button type="button" class="btn-close btn-sm" aria-label="Close"></button>
    `;

    toast.querySelector('.btn-close').addEventListener('click', () => toast.remove());
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 4500);
  };

  // Format Currency & Dates
  const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    if (num === 0) return 'Free';
    return '₹' + num.toLocaleString('en-IN');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Render Event Card HTML
  const renderEventCard = (event, wishlistIds = []) => {
    const isSaved = wishlistIds.includes(event._id);
    const posterUrl = event.poster || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80';
    const seatsLeft = event.availableSeats !== undefined ? event.availableSeats : event.capacity;

    return `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="ev-card">
          <div class="ev-card-img-wrap">
            <a href="/event-details.html?id=${event._id}">
              <img src="${posterUrl}" alt="${event.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80'">
            </a>
            <span class="ev-card-badge-top">
              <i class="fa-solid fa-tag me-1 text-warning"></i> ${event.categoryName || 'Event'}
            </span>
            <button class="ev-wishlist-btn ${isSaved ? 'active' : ''}" onclick="EventifyApp.toggleWishlist('${event._id}', this)" title="Save to Wishlist">
              <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
          </div>
          <div class="ev-card-body">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <div class="ev-card-meta">
                <i class="fa-regular fa-calendar-check"></i> ${formatDate(event.date)} • ${event.startTime || '18:00'}
              </div>
              <span class="badge bg-light text-dark border small">
                <i class="fa-solid fa-star text-warning"></i> ${event.averageRating || '4.8'}
              </span>
            </div>
            <a href="/event-details.html?id=${event._id}" class="ev-card-title text-decoration-none">
              ${event.title}
            </a>
            <div class="ev-card-location">
              <i class="fa-solid fa-location-dot text-primary"></i>
              <span class="text-truncate">${event.venue}, ${event.city}</span>
            </div>
            <div class="d-flex align-items-center gap-2 mb-3 flex-wrap">
              <span class="ev-badge ${seatsLeft > 10 ? 'ev-badge-green' : 'ev-badge-amber'}">
                <i class="fa-solid fa-chair"></i> ${seatsLeft} ${seatsLeft === 1 ? 'seat' : 'seats'} left
              </span>
              ${event.certificateEligible ? `<span class="ev-badge ev-badge-purple"><i class="fa-solid fa-award"></i> Certificate</span>` : ''}
            </div>
            <div class="ev-card-footer">
              <div>
                <span class="text-muted d-block" style="font-size:0.72rem;">Starting from</span>
                <span class="ev-price-tag">${formatCurrency(event.ticketPrice)}</span>
              </div>
              <a href="/event-details.html?id=${event._id}" class="btn-ev-primary btn-sm px-3 py-2">
                Book Now <i class="fa-solid fa-arrow-right ms-1"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // Toggle Wishlist Action
  const toggleWishlist = async (eventId, btnEl) => {
    const user = getUser();
    if (!user) {
      showToast('Please login to save events to your wishlist', 'warning');
      setTimeout(() => { window.location.href = '/login.html'; }, 900);
      return;
    }

    try {
      const res = await api('/wishlist/toggle', {
        method: 'POST',
        body: { eventId }
      });

      if (btnEl) {
        const icon = btnEl.querySelector('i');
        if (res.saved) {
          btnEl.classList.add('active');
          if (icon) icon.className = 'fa-solid fa-heart';
        } else {
          btnEl.classList.remove('active');
          if (icon) icon.className = 'fa-regular fa-heart';
        }
      }
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Live Event Countdown Updater
  const startCountdown = (targetDateStr, containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const update = () => {
      const now = new Date().getTime();
      const target = new Date(targetDateStr).getTime();
      const diff = target - now;

      if (diff <= 0) {
        container.innerHTML = `<span class="ev-badge ev-badge-green fs-6 px-3 py-2"><i class="fa-solid fa-circle-play me-2"></i>Event is Live / Completed</span>`;
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      container.innerHTML = `
        <div class="ev-countdown-wrap">
          <div class="ev-countdown-box">
            <div class="ev-countdown-num">${String(days).padStart(2, '0')}</div>
            <div class="ev-countdown-label">Days</div>
          </div>
          <div class="ev-countdown-box">
            <div class="ev-countdown-num">${String(hours).padStart(2, '0')}</div>
            <div class="ev-countdown-label">Hours</div>
          </div>
          <div class="ev-countdown-box">
            <div class="ev-countdown-num">${String(mins).padStart(2, '0')}</div>
            <div class="ev-countdown-label">Minutes</div>
          </div>
          <div class="ev-countdown-box">
            <div class="ev-countdown-num">${String(secs).padStart(2, '0')}</div>
            <div class="ev-countdown-label">Seconds</div>
          </div>
        </div>
      `;
    };

    update();
    return setInterval(update, 1000);
  };

  // Render Shared Navbar across Customer Pages
  const renderNavbar = () => {
    const navPlaceholder = document.getElementById('ev-navbar-placeholder');
    if (!navPlaceholder) return;

    const user = getUser();
    const path = window.location.pathname;

    let roleDashboardLink = '';
    if (user && user.role === 'customer') {
      roleDashboardLink = `<li class="nav-item"><a class="nav-link ev-nav-link fw-bold text-primary ${path.includes('profile.html') ? 'active' : ''}" href="/profile.html"><i class="fa-solid fa-gauge-high me-1"></i>My Dashboard</a></li>`;
    } else if (user && user.role === 'organizer') {
      roleDashboardLink = `<li class="nav-item"><a class="nav-link ev-nav-link fw-bold text-primary" href="/organizer/dashboard.html"><i class="fa-solid fa-chart-pie me-1"></i>Organizer Hub</a></li>`;
    } else if (user && user.role === 'admin') {
      roleDashboardLink = `<li class="nav-item"><a class="nav-link ev-nav-link fw-bold text-danger" href="/admin/dashboard.html"><i class="fa-solid fa-shield-halved me-1"></i>Admin Panel</a></li>`;
    }

    const authSection = user
      ? `
        <div class="d-flex align-items-center gap-3">
          <!-- Notifications Bell -->
          <div class="dropdown">
            <button class="btn btn-ev-lavender position-relative p-2 rounded-circle" style="width:40px;height:40px;" data-bs-toggle="dropdown" aria-expanded="false" onclick="EventifyApp.loadNotifications()">
              <i class="fa-regular fa-bell"></i>
              <span id="ev-notif-badge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger d-none" style="font-size:0.65rem;">0</span>
            </button>
            <div class="dropdown-menu dropdown-menu-end shadow-lg border-0 p-0" style="width:330px;border-radius:16px;overflow:hidden;">
              <div class="p-3 bg-light border-bottom d-flex justify-content-between align-items-center">
                <h6 class="mb-0 fw-bold">Notifications</h6>
                <button class="btn btn-link btn-sm p-0 text-decoration-none" onclick="EventifyApp.markAllRead()">Mark all read</button>
              </div>
              <div id="ev-notif-list" style="max-height:320px;overflow-y:auto;">
                <div class="p-4 text-center text-muted small">Loading notifications...</div>
              </div>
            </div>
          </div>

          <!-- User Profile Dropdown -->
          <div class="dropdown">
            <button class="btn btn-ev-lavender dropdown-toggle d-flex align-items-center gap-2 py-1 px-3 rounded-pill" data-bs-toggle="dropdown">
              <div class="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center fw-bold" style="width:28px;height:28px;font-size:0.8rem;">
                ${user.name.charAt(0).toUpperCase()}
              </div>
              <span class="d-none d-sm-inline small fw-semibold">${user.name.split(' ')[0]}</span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-2" style="border-radius:14px;">
              <li class="px-3 py-2 border-bottom">
                <div class="fw-bold text-dark small">${user.name}</div>
                <div class="text-muted" style="font-size:0.75rem;">${user.email} (${user.role.toUpperCase()})</div>
              </li>
              ${user.role === 'customer' ? `<li><a class="dropdown-item py-2" href="/profile.html"><i class="fa-solid fa-gauge-high me-2 text-primary"></i>Customer Dashboard</a></li>` : ''}
              ${user.role === 'organizer' ? `<li><a class="dropdown-item py-2" href="/organizer/dashboard.html"><i class="fa-solid fa-gauge-high me-2 text-primary"></i>Organizer Dashboard</a></li>` : ''}
              ${user.role === 'admin' ? `<li><a class="dropdown-item py-2" href="/admin/dashboard.html"><i class="fa-solid fa-user-shield me-2 text-danger"></i>Admin Dashboard</a></li>` : ''}
              <li><a class="dropdown-item py-2" href="/my-bookings.html"><i class="fa-solid fa-ticket me-2 text-primary"></i>My Bookings & Tickets</a></li>
              <li><a class="dropdown-item py-2" href="/wishlist.html"><i class="fa-regular fa-heart me-2 text-danger"></i>Saved Wishlist</a></li>
              <li><a class="dropdown-item py-2" href="/profile.html#account"><i class="fa-regular fa-user me-2 text-secondary"></i>My Profile & Settings</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><button class="dropdown-item py-2 text-danger fw-semibold" onclick="EventifyApp.logout()"><i class="fa-solid fa-right-from-bracket me-2"></i>Logout</button></li>
            </ul>
          </div>
        </div>
      `
      : `
        <div class="d-flex align-items-center gap-2">
          <a href="/login.html" class="btn-ev-outline btn-sm px-3">Login</a>
          <a href="/register.html" class="btn-ev-primary btn-sm px-3">Sign Up</a>
        </div>
      `;

    navPlaceholder.innerHTML = `
      <nav class="navbar navbar-expand-lg ev-navbar">
        <div class="container">
          <a class="navbar-brand ev-brand" href="/index.html">
            <span class="ev-brand-icon"><i class="fa-solid fa-bolt"></i></span>
            EVENTIFY
          </a>
          <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#evNavbarContent">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="evNavbarContent">
            <ul class="navbar-nav mx-auto mb-2 mb-lg-0 gap-1">
              <li class="nav-item"><a class="nav-link ev-nav-link ${path === '/' || path.endsWith('/index.html') ? 'active' : ''}" href="/index.html">Home</a></li>
              <li class="nav-item"><a class="nav-link ev-nav-link ${path.includes('events.html') ? 'active' : ''}" href="/events.html">Explore Events</a></li>
              <li class="nav-item"><a class="nav-link ev-nav-link ${path.includes('categories.html') ? 'active' : ''}" href="/categories.html">Categories</a></li>
              ${user ? `<li class="nav-item"><a class="nav-link ev-nav-link ${path.includes('my-bookings.html') ? 'active' : ''}" href="/my-bookings.html">My Tickets</a></li>` : ''}
              ${user ? `<li class="nav-item"><a class="nav-link ev-nav-link ${path.includes('wishlist.html') ? 'active' : ''}" href="/wishlist.html">Wishlist</a></li>` : ''}
              <li class="nav-item"><a class="nav-link ev-nav-link ${path.includes('contact.html') ? 'active' : ''}" href="/contact.html">Contact</a></li>
              ${roleDashboardLink}
            </ul>
            ${authSection}
          </div>
        </div>
      </nav>
    `;

    if (user) {
      loadNotifications();
      initSocket(user._id);
    }
  };

  // Render Shared Footer
  const renderFooter = () => {
    const footerPlaceholder = document.getElementById('ev-footer-placeholder');
    if (!footerPlaceholder) return;

    footerPlaceholder.innerHTML = `
      <footer class="ev-footer">
        <div class="container">
          <div class="row g-4 g-lg-5 pb-4 border-bottom border-secondary border-opacity-25 align-items-start justify-content-between">
            <div class="col-12 col-md-6 col-lg-4">
              <a class="ev-brand text-white mb-3 d-inline-flex" href="/index.html">
                <span class="ev-brand-icon"><i class="fa-solid fa-bolt"></i></span>
                <span class="text-white">EVENTIFY</span>
              </a>
              <p class="mb-3">
                EVENTIFY is a next-generation Smart Event Management and Online Ticket Booking Platform featuring interactive seat selection, cryptographic QR tickets, and instant participation certificates.
              </p>
              <div class="ev-footer-socials">
                <a href="/events.html" class="ev-footer-social-link" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
                <a href="/events.html" class="ev-footer-social-link" aria-label="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>
                <a href="/events.html" class="ev-footer-social-link" aria-label="X Twitter"><i class="fa-brands fa-x-twitter"></i></a>
                <a href="/events.html" class="ev-footer-social-link" aria-label="YouTube"><i class="fa-brands fa-youtube"></i></a>
              </div>
            </div>
            <div class="col-12 col-sm-6 col-md-6 col-lg-2">
              <h6>Discover</h6>
              <ul class="list-unstyled mb-0">
                <li><a href="/events.html">All Events</a></li>
                <li><a href="/events.html?featured=true">Featured Events</a></li>
                <li><a href="/events.html?trending=true">Trending Now</a></li>
                <li><a href="/categories.html">Browse Categories</a></li>
              </ul>
            </div>
            <div class="col-12 col-sm-6 col-md-6 col-lg-3">
              <h6>For Attendees & Hosts</h6>
              <ul class="list-unstyled mb-0">
                <li><a href="/my-bookings.html">My QR Tickets</a></li>
                <li><a href="/wishlist.html">Saved Wishlist</a></li>
                <li><a href="/register.html?role=organizer">Host an Event</a></li>
                <li><a href="/organizer/scan-ticket.html">Smart QR Scanner</a></li>
              </ul>
            </div>
            <div class="col-12 col-md-6 col-lg-3">
              <h6>Support & Contact</h6>
              <div class="ev-footer-contact-item">
                <i class="fa-solid fa-location-dot"></i>
                <span>Bandra Kurla Complex, Mumbai, India</span>
              </div>
              <div class="ev-footer-contact-item">
                <i class="fa-solid fa-envelope"></i>
                <span>support@eventify.com</span>
              </div>
              <div class="ev-footer-contact-item mb-3">
                <i class="fa-solid fa-phone"></i>
                <span>+91 98201 11223</span>
              </div>
              <a href="/contact.html" class="btn-ev-primary btn-sm w-100 py-2 text-white">Contact Helpdesk</a>
            </div>
          </div>
          <div class="d-flex flex-column flex-md-row justify-content-between align-items-center pt-4 gap-3 small text-secondary">
            <div class="text-center text-md-start">© ${new Date().getFullYear()} EVENTIFY – Smart Event Management System. All rights reserved.</div>
            <div class="d-flex flex-wrap justify-content-center gap-4">
              <a href="/contact.html" class="mb-0">Privacy Policy</a>
              <a href="/contact.html" class="mb-0">Terms of Service</a>
              <a href="/admin/dashboard.html" class="mb-0">Admin Portal</a>
            </div>
          </div>
        </div>
      </footer>
    `;
  };

  // Notifications Loader
  const loadNotifications = async () => {
    try {
      const res = await api('/notifications');
      const badge = document.getElementById('ev-notif-badge');
      const list = document.getElementById('ev-notif-list');

      if (badge) {
        if (res.unreadCount > 0) {
          badge.textContent = res.unreadCount;
          badge.classList.remove('d-none');
        } else {
          badge.classList.add('d-none');
        }
      }

      if (list) {
        if (!res.notifications || res.notifications.length === 0) {
          list.innerHTML = `<div class="p-4 text-center text-muted small">No notifications yet.</div>`;
          return;
        }
        list.innerHTML = res.notifications
          .map(
            (n) => `
            <a href="${n.link || '#'}" class="d-block p-3 border-bottom text-decoration-none ${n.isRead ? 'bg-white' : 'bg-light'}">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold text-dark small">${n.title}</span>
                <span class="text-muted" style="font-size:0.7rem;">${formatDate(n.createdAt)}</span>
              </div>
              <div class="text-secondary small">${n.message}</div>
            </a>
          `
          )
          .join('');
      }
    } catch (e) {
      // silent fail
    }
  };

  const markAllRead = async () => {
    try {
      await api('/notifications/mark-read', { method: 'PUT', body: {} });
      loadNotifications();
    } catch (e) {
      // ignore
    }
  };

  // Initialize Real-Time Socket.IO client if available
  const initSocket = (userId) => {
    if (typeof io !== 'undefined') {
      try {
        const socket = io(SOCKET_ORIGIN, { transports: ['websocket', 'polling'] });
        socket.emit('join_user_room', userId);
        socket.on('new_notification', (notif) => {
          showToast(`${notif.title}: ${notif.message}`, 'info');
          loadNotifications();
        });
        window.evSocket = socket;
      } catch (e) {
        // ignore socket init errors
      }
    }
  };

  // Require Authentication Guard
  const requireAuth = (allowedRoles = []) => {
    const user = getUser();
    const token = getToken();
    if (!user || !token) {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return null;
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      showToast('Access Denied: Insufficient permissions for this portal.', 'error');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1000);
      return null;
    }
    return user;
  };

  // Eventify AI Chat Assistant Widget
  let aiChatHistory = [];

  const formatAiText = (rawText) => {
    const escaped = String(rawText || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="text-primary fw-bold">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary fw-semibold text-decoration-underline">$1</a>')
      .replace(/\n/g, '<br>');
  };

  const renderAIChatWidget = () => {
    if (document.getElementById('ev-ai-widget-root')) return;

    const root = document.createElement('div');
    root.id = 'ev-ai-widget-root';
    root.innerHTML = `
      <button type="button" class="ev-ai-fab" id="evAiFabBtn" aria-label="Open Eventify AI Assistant" title="Ask Eventify AI Assistant">
        <i class="fa-solid fa-robot"></i>
        <span class="ev-ai-fab-badge">AI</span>
      </button>

      <div class="ev-ai-panel" id="evAiPanel" role="dialog" aria-label="Eventify AI Chat Assistant">
        <div class="ev-ai-header">
          <div class="d-flex align-items-center gap-2">
            <div class="rounded-circle bg-white text-primary d-flex align-items-center justify-content-center fw-bold" style="width:34px;height:34px;">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <div>
              <div class="fw-bold small lh-1">EVENTIFY AI Assistant</div>
              <span style="font-size:0.68rem;opacity:0.85;"><i class="fa-solid fa-circle text-success me-1" style="font-size:0.5rem;"></i>Connected to Live Event Catalog</span>
            </div>
          </div>
          <button type="button" class="btn btn-sm text-white border-0 p-1" id="evAiCloseBtn" aria-label="Close AI Chat">
            <i class="fa-solid fa-xmark fs-5"></i>
          </button>
        </div>

        <div class="ev-ai-messages" id="evAiMessages">
          <div class="ev-ai-bubble assistant">
            👋 Hi! I'm the <strong>EVENTIFY Smart AI Assistant</strong>.<br>
            Ask me about upcoming events, ticket prices, cities, VIP seating tiers, or your personal bookings &amp; QR tickets!
          </div>
        </div>

        <div class="ev-ai-chips">
          <button type="button" class="ev-ai-chip" data-prompt="Show upcoming tech and AI events">💻 Tech Events</button>
          <button type="button" class="ev-ai-chip" data-prompt="Events under ₹1000">💸 Under ₹1000</button>
          <button type="button" class="ev-ai-chip" data-prompt="Events in Mumbai">📍 Mumbai</button>
          <button type="button" class="ev-ai-chip" data-prompt="Show my bookings and QR tickets">🎟️ My Tickets</button>
          <button type="button" class="ev-ai-chip" data-prompt="How do VIP and Premium seats work?">🪑 Seat Tiers</button>
        </div>

        <form class="ev-ai-input-bar" id="evAiForm">
          <input type="text" id="evAiInput" class="form-control form-control-sm" placeholder="Ask about events, prices, cities..." maxlength="400" autocomplete="off" required>
          <button type="submit" id="evAiSendBtn" class="btn-ev-primary btn-sm px-3">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(root);

    const fab = document.getElementById('evAiFabBtn');
    const panel = document.getElementById('evAiPanel');
    const closeBtn = document.getElementById('evAiCloseBtn');
    const form = document.getElementById('evAiForm');
    const input = document.getElementById('evAiInput');
    const messagesEl = document.getElementById('evAiMessages');

    const togglePanel = () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        input.focus();
      }
    };

    fab.addEventListener('click', togglePanel);
    closeBtn.addEventListener('click', () => panel.classList.remove('open'));

    root.querySelectorAll('.ev-ai-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const promptText = chip.getAttribute('data-prompt');
        if (promptText) {
          input.value = promptText;
          form.dispatchEvent(new Event('submit'));
        }
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      input.value = '';
      const userBubble = document.createElement('div');
      userBubble.className = 'ev-ai-bubble user';
      userBubble.textContent = text;
      messagesEl.appendChild(userBubble);

      const typingBubble = document.createElement('div');
      typingBubble.className = 'ev-ai-bubble assistant text-muted';
      typingBubble.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin text-primary me-1"></i> Searching live events...`;
      messagesEl.appendChild(typingBubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      try {
        const res = await api('/ai/chat', {
          method: 'POST',
          body: { message: text, history: aiChatHistory }
        });

        aiChatHistory.push({ role: 'user', content: text });
        aiChatHistory.push({ role: 'assistant', content: res.reply || '' });
        if (aiChatHistory.length > 10) aiChatHistory = aiChatHistory.slice(-10);

        const suggestedHtml = (res.suggestedEvents || [])
          .slice(0, 3)
          .map(
            (ev) => `
            <a href="/event-details.html?id=${ev._id}" class="ev-ai-mini-card">
              <div class="fw-bold text-primary" style="font-size:0.78rem;">${ev.title}</div>
              <div class="text-secondary" style="font-size:0.7rem;">
                📍 ${ev.city} • 📅 ${formatDate(ev.date)} • <strong>${formatCurrency(ev.ticketPrice)}</strong> (${ev.availableSeats} seats left)
              </div>
            </a>
          `
          )
          .join('');

        typingBubble.className = 'ev-ai-bubble assistant';
        typingBubble.innerHTML = `<div>${formatAiText(res.reply)}</div>${suggestedHtml}`;
      } catch (err) {
        typingBubble.className = 'ev-ai-bubble assistant text-danger';
        typingBubble.textContent = err.message || 'Unable to reach AI Assistant right now.';
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderNavbar();
    renderFooter();
    renderAIChatWidget();
  });

  return {
    api,
    getToken,
    getUser,
    setSession,
    clearSession,
    logout,
    showToast,
    formatCurrency,
    formatDate,
    renderEventCard,
    toggleWishlist,
    startCountdown,
    loadNotifications,
    markAllRead,
    requireAuth
  };
})();

