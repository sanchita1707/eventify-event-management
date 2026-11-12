/* ==========================================================================
   EVENTIFY - Organizer Portal Shared Sidebar & Utilities
   ========================================================================== */

const OrganizerPortal = (() => {
  const renderSidebar = () => {
    const sidebar = document.getElementById('ev-organizer-sidebar');
    if (!sidebar) return;

    const user = EventifyApp.getUser() || {};
    const initials = (user.name || 'OR')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const path = window.location.pathname;
    const links = [
      { href: '/organizer/dashboard.html', icon: 'fa-gauge-high', label: 'Overview' },
      { href: '/organizer/create-event.html', icon: 'fa-calendar-plus', label: 'Create Event' },
      { href: '/organizer/manage-events.html', icon: 'fa-calendar-check', label: 'Manage Events' },
      { href: '/organizer/manage-bookings.html', icon: 'fa-ticket', label: 'Manage Bookings' },
      { href: '/organizer/participants.html', icon: 'fa-users', label: 'Participants' },
      { href: '/organizer/scan-ticket.html', icon: 'fa-qrcode', label: 'QR Scanner' },
      { href: '/organizer/analytics.html', icon: 'fa-chart-line', label: 'Analytics' },
      { href: '/profile.html', icon: 'fa-user-gear', label: 'Profile' }
    ];

    sidebar.innerHTML = `
      <div class="ev-sidebar-profile mb-3">
        <div class="ev-sidebar-avatar">${initials}</div>
        <div class="overflow-hidden">
          <div class="fw-bold text-dark text-truncate small">${user.name || 'Organizer'}</div>
          <span class="ev-badge ev-badge-purple mt-1" style="font-size:0.68rem;">
            <i class="fa-solid fa-bullhorn me-1"></i> ORGANIZER
          </span>
        </div>
      </div>
      <nav class="d-flex flex-column">
        ${links
        .map(
          (l) => `
          <a href="${l.href}" class="ev-sidebar-link ${path.endsWith(l.href) ? 'active' : ''}">
            <i class="fa-solid ${l.icon}"></i>
            <span>${l.label}</span>
          </a>
        `
        )
        .join('')}
        <hr class="my-3">
        <a href="/events.html" class="ev-sidebar-link">
          <i class="fa-solid fa-globe"></i>
          <span>Explore Public Events</span>
        </a>
        <button type="button" onclick="EventifyApp.logout('/organizer/login.html')" class="ev-sidebar-link border-0 bg-transparent text-danger text-start w-100">
          <i class="fa-solid fa-right-from-bracket text-danger"></i>
          <span>Logout</span>
        </button>
      </nav>
    `;
  };

  document.addEventListener('DOMContentLoaded', () => {
    EventifyApp.requireAuth(['organizer', 'admin']);
    renderSidebar();
  });

  return { renderSidebar };
})();


