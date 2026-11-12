/* ==========================================================================
   EVENTIFY - Administrator Portal Shared Sidebar & Utilities
   ========================================================================== */

const AdminPortal = (() => {
  const renderSidebar = () => {
    const sidebar = document.getElementById('ev-admin-sidebar');
    if (!sidebar) return;

    const user = EventifyApp.getUser() || {};
    const initials = (user.name || 'AD')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const path = window.location.pathname;
    const search = window.location.search;
    const fullUrl = path + search;

    const links = [
      { href: '/admin/dashboard.html', icon: 'fa-chart-pie', label: 'Overview' },
      { href: '/admin/users.html', icon: 'fa-users', label: 'Manage Users' },
      { href: '/admin/organizers.html', icon: 'fa-user-tie', label: 'Manage Organizers' },
      { href: '/admin/events.html', icon: 'fa-calendar-days', label: 'Manage Events' },
      { href: '/admin/events.html?filter=pending', icon: 'fa-calendar-check', label: 'Approve Events' },
      { href: '/admin/bookings.html', icon: 'fa-ticket', label: 'Manage Bookings' },
      { href: '/admin/payments.html', icon: 'fa-credit-card', label: 'Manage Payments' },
      { href: '/admin/categories.html', icon: 'fa-layer-group', label: 'Categories' },
      { href: '/admin/reviews.html', icon: 'fa-comments', label: 'Reviews' },
      { href: '/admin/reports.html', icon: 'fa-file-invoice-dollar', label: 'Reports' }
    ];

    sidebar.innerHTML = `
      <div class="ev-sidebar-profile mb-3">
        <div class="ev-sidebar-avatar" style="background:linear-gradient(135deg,#DC2626,#6C3CE9);">${initials}</div>
        <div class="overflow-hidden">
          <div class="fw-bold text-dark text-truncate small">${user.name || 'System Admin'}</div>
          <span class="ev-badge ev-badge-red mt-1" style="font-size:0.68rem;">
            <i class="fa-solid fa-user-shield me-1"></i> ADMINISTRATOR
          </span>
        </div>
      </div>
      <nav class="d-flex flex-column">
        ${links
          .map((l) => {
            const isActive =
              l.href.includes('?')
                ? fullUrl.endsWith(l.href)
                : path.endsWith(l.href) && !search.includes('filter=pending');
            return `
          <a href="${l.href}" class="ev-sidebar-link ${isActive ? 'active' : ''}">
            <i class="fa-solid ${l.icon}"></i>
            <span>${l.label}</span>
          </a>
        `;
          })
          .join('')}
        <hr class="my-3">
        <a href="/index.html" class="ev-sidebar-link">
          <i class="fa-solid fa-globe"></i>
          <span>View Public Website</span>
        </a>
        <button type="button" onclick="EventifyApp.logout('/admin/login.html')" class="ev-sidebar-link border-0 bg-transparent text-danger text-start w-100">
          <i class="fa-solid fa-right-from-bracket text-danger"></i>
          <span>Logout</span>
        </button>
      </nav>
    `;
  };

  document.addEventListener('DOMContentLoaded', () => {
    EventifyApp.requireAuth(['admin']);
    renderSidebar();
  });

  return { renderSidebar };
})();


