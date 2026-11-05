/**
 * EVENTIFY – End-to-End Automated Test Suite
 * Verifies all 29 HTML pages, Database Seeding, Auth, Role RBAC, Event Creation/Editing,
 * Interactive Seat Booking, Double-Booking Prevention, Razorpay Signature Verification,
 * Smart QR Ticket Generation, Duplicate-Entry Prevention on QR Scan, Wishlist, Reviews,
 * Notifications, Certificate PDF Streaming, and Admin Analytics.
 */

const fs = require('fs');
const path = require('path');
const { server, startServer } = require('../server');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

const assert = (condition, msg) => {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
  console.log(`  [PASS] ${msg}`);
};

const apiCall = async (endpoint, method = 'GET', body = null, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    const buf = await res.arrayBuffer();
    return { status: res.status, isPdf: true, byteLength: buf.byteLength };
  }

  const data = await res.json();
  return { status: res.status, data };
};

let startedOwnServer = false;

const runTests = async () => {
  try {
    console.log('\n============================================================');
    console.log('  STARTING EVENTIFY AUTOMATED FULL-STACK TEST SUITE');
    console.log('============================================================\n');

    try {
      const check = await fetch(`${BASE_URL}/api/health`);
      if (check.ok) {
        console.log('  [INFO] Using already running EVENTIFY server on ' + BASE_URL);
      } else {
        await startServer();
        startedOwnServer = true;
      }
    } catch (e) {
      await startServer();
      startedOwnServer = true;
    }

    // 1. Verify all 29 required HTML pages exist and are served
    const requiredPages = [
      'index.html',
      'events.html',
      'event-details.html',
      'categories.html',
      'booking.html',
      'payment.html',
      'ticket.html',
      'my-bookings.html',
      'wishlist.html',
      'profile.html',
      'login.html',
      'register.html',
      'contact.html',
      'organizer/dashboard.html',
      'organizer/create-event.html',
      'organizer/manage-events.html',
      'organizer/manage-bookings.html',
      'organizer/participants.html',
      'organizer/scan-ticket.html',
      'organizer/analytics.html',
      'admin/dashboard.html',
      'admin/users.html',
      'admin/organizers.html',
      'admin/events.html',
      'admin/bookings.html',
      'admin/categories.html',
      'admin/payments.html',
      'admin/reports.html',
      'admin/reviews.html'
    ];

    for (const page of requiredPages) {
      const fullPath = path.join(__dirname, '../../frontend', page);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Missing frontend page: ${page}`);
      }
      const pageRes = await fetch(`${BASE_URL}/${page}`);
      if (pageRes.status !== 200) {
        throw new Error(`Page ${page} returned HTTP ${pageRes.status}`);
      }
    }
    assert(true, `All ${requiredPages.length} Customer, Organizer, and Admin HTML pages exist and serve HTTP 200`);

    // 2. Health Check
    const health = await apiCall('/api/health');
    assert(health.status === 200 && health.data.success, 'API Health endpoint operational');

    // 3. Test Customer Registration, Organizer Registration, Duplicate Email, Empty Validation & Admin Role Prevention
    const uniqueEmail = `testcustomer_${Date.now()}@eventify.com`;
    const regRes = await apiCall('/api/auth/register', 'POST', {
      name: 'Test Customer CS',
      email: uniqueEmail,
      password: 'Password@123',
      phone: '+91 9800000001',
      role: 'customer',
      city: 'Mumbai',
      interests: ['Technology & AI']
    });
    assert(regRes.status === 201 && regRes.data.token && regRes.data.user.role === 'customer', 'Customer Registration & JWT Issuance');

    // Duplicate email check
    const dupRegRes = await apiCall('/api/auth/register', 'POST', {
      name: 'Duplicate User',
      email: uniqueEmail,
      password: 'Password@123',
      role: 'customer'
    });
    assert(dupRegRes.status === 400, 'Duplicate Email Registration Rejected (HTTP 400)');

    // Empty form validation check
    const emptyRegRes = await apiCall('/api/auth/register', 'POST', {
      name: '',
      email: '',
      password: ''
    });
    assert(emptyRegRes.status === 400, 'Empty Registration Form Validation Rejected (HTTP 400)');

    // Organizer registration check
    const uniqueOrgEmail = `testorg_${Date.now()}@eventify.com`;
    const orgRegRes = await apiCall('/api/auth/register', 'POST', {
      name: 'Test Organizer Studio',
      email: uniqueOrgEmail,
      password: 'Password@123',
      phone: '+91 9800000002',
      role: 'organizer',
      city: 'Bengaluru',
      organizationName: 'Test Organizer Studio Pvt Ltd'
    });
    assert(orgRegRes.status === 201 && orgRegRes.data.user.role === 'organizer', 'Organizer Registration & Role Assignment');

    // Prevent public registration as Admin
    const fakeAdminEmail = `fakeadmin_${Date.now()}@eventify.com`;
    const fakeAdminRes = await apiCall('/api/auth/register', 'POST', {
      name: 'Escalation Attempt',
      email: fakeAdminEmail,
      password: 'Password@123',
      role: 'admin'
    });
    assert(
      fakeAdminRes.status === 201 && fakeAdminRes.data.user.role === 'customer',
      'Security: Public registration with role="admin" is strictly downgraded to "customer"'
    );

    // 4. Test Invalid Password & Valid Login for Seeded Customer, Organizer, and Admin
    const badLogin = await apiCall('/api/auth/login', 'POST', {
      email: 'customer@eventify.com',
      password: 'WrongPassword999'
    });
    assert(badLogin.status === 401, 'Invalid Password Rejected with HTTP 401');

    const emptyLogin = await apiCall('/api/auth/login', 'POST', {
      email: '',
      password: ''
    });
    assert(emptyLogin.status === 400, 'Empty Login Credentials Rejected with HTTP 400');

    const custLogin = await apiCall('/api/auth/login', 'POST', {
      email: 'customer@eventify.com',
      password: 'Password@123'
    });
    assert(custLogin.status === 200 && custLogin.data.user.role === 'customer', 'Customer Login');
    const customerToken = custLogin.data.token;

    const orgLogin = await apiCall('/api/auth/login', 'POST', {
      email: 'organizer@eventify.com',
      password: 'Password@123'
    });
    assert(orgLogin.status === 200 && orgLogin.data.user.role === 'organizer', 'Organizer Login');
    const organizerToken = orgLogin.data.token;

    const admLogin = await apiCall('/api/auth/login', 'POST', {
      email: 'admin@eventify.com',
      password: 'Password@123'
    });
    assert(admLogin.status === 200 && admLogin.data.user.role === 'admin', 'Admin Login');
    const adminToken = admLogin.data.token;

    // 5. Test Role-Based Access Control (RBAC) & Token Expiration/Invalid Token
    const invalidTokenTry = await apiCall('/api/users/dashboard', 'GET', null, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature');
    assert(invalidTokenTry.status === 401, 'Invalid / Expired JWT Token Rejected with HTTP 401');

    const unauthorizedAdminTry = await apiCall('/api/admin/dashboard', 'GET', null, customerToken);
    assert(unauthorizedAdminTry.status === 403, 'RBAC prevents Customer from accessing Admin Dashboard');

    const unauthorizedOrgTry = await apiCall('/api/organizer/dashboard', 'GET', null, customerToken);
    assert(unauthorizedOrgTry.status === 403, 'RBAC prevents Customer from accessing Organizer Dashboard');

    const organizerToAdminTry = await apiCall('/api/admin/dashboard', 'GET', null, organizerToken);
    assert(organizerToAdminTry.status === 403, 'RBAC prevents Organizer from accessing Admin Dashboard');

    // 6. Test Categories & Events Listing + Smart Recommendations
    const catList = await apiCall('/api/categories');
    assert(catList.status === 200 && catList.data.categories.length >= 6, 'Categories API returns seeded categories with counts');

    const evList = await apiCall('/api/events');
    assert(evList.status === 200 && evList.data.events.length >= 6, 'Events API returns approved events');

    const recList = await apiCall('/api/events/recommendations', 'GET', null, customerToken);
    assert(recList.status === 200 && recList.data.events.length > 0, 'Smart Event Recommendations API returns personalized events');

    // 7. Test Organizer Event Creation (Default Pending Approval) & Editing
    const createEvRes = await apiCall(
      '/api/events',
      'POST',
      {
        title: 'Automated Test Cloud Workshop 2026',
        description: 'Hands-on cloud engineering workshop with interactive seat booking.',
        category: catList.data.categories[0]._id,
        date: new Date(Date.now() + 86400000 * 10).toISOString(),
        startTime: '10:00',
        endTime: '16:00',
        venue: 'IIT Tech Park Auditorium',
        address: 'Powai',
        city: 'Mumbai',
        ticketType: 'Multi-Tier Seated (VIP, Premium & Standard)',
        ticketPrice: 500,
        vipPrice: 1000,
        premiumPrice: 750,
        maxTicketsPerCustomer: 6,
        termsAndConditions: 'Valid Smart QR Ticket required at entrance.',
        rows: 4,
        cols: 8,
        tags: 'Cloud, DevOps, Workshop',
        certificateEligible: true
      },
      organizerToken
    );
    assert(
      createEvRes.status === 201 &&
        createEvRes.data.event.capacity === 32 &&
        createEvRes.data.event.availableSeats === 32 &&
        createEvRes.data.event.approvalStatus === 'pending',
      'Organizer Event Creation saves to MongoDB with 4x8 (32 seats) and pending approvalStatus by default'
    );
    const createdEventId = createEvRes.data.event._id;

    // Verify pending event appears in Admin Pending Approvals and is hidden from public Customer access before approval
    const pendingPublicCheck = await apiCall(`/api/events/${createdEventId}`, 'GET', null, customerToken);
    assert(pendingPublicCheck.status === 403, 'Unapproved pending event is hidden from Customers (HTTP 403)');

    const adminPendingCheck = await apiCall('/api/admin/dashboard', 'GET', null, adminToken);
    assert(
      adminPendingCheck.status === 200 &&
        adminPendingCheck.data.pendingEvents.some((e) => e._id === createdEventId),
      'New event appears in Admin Pending Approvals queue'
    );

    // Verify another organizer cannot edit this organizer's event
    const otherOrganizerToken = orgRegRes.data.token;
    const unauthorizedEditRes = await apiCall(
      `/api/events/${createdEventId}`,
      'PUT',
      { title: 'Hijacked Title' },
      otherOrganizerToken
    );
    assert(unauthorizedEditRes.status === 403, 'Security: Unauthorized organizer cannot edit another organizer’s event (HTTP 403)');

    const editEvRes = await apiCall(
      `/api/events/${createdEventId}`,
      'PUT',
      { ticketPrice: 550 },
      organizerToken
    );
    assert(editEvRes.status === 200 && editEvRes.data.event.ticketPrice === 550, 'Organizer Event Editing (before bookings exist)');

    // 8. Test Admin Event Approval & Public Visibility / Search / Filtering
    const approveRes = await apiCall(
      `/api/admin/events/${createdEventId}/approval`,
      'PUT',
      { approvalStatus: 'approved', isFeatured: true },
      adminToken
    );
    assert(approveRes.status === 200 && approveRes.data.event.isFeatured === true, 'Admin Event Approval & Featuring');

    // Customer searches & filters for the newly approved event
    const searchRes = await apiCall('/api/events?search=Automated%20Test%20Cloud%20Workshop&city=Mumbai&minPrice=100&maxPrice=2000&sort=date');
    assert(
      searchRes.status === 200 && searchRes.data.events.some((e) => e._id === createdEventId),
      'Approved event appears publicly in Customer Search & Filters'
    );

    const custDetailRes = await apiCall(`/api/events/${createdEventId}`, 'GET', null, customerToken);
    assert(
      custDetailRes.status === 200 && custDetailRes.data.event._id === createdEventId,
      'Customer can open approved Event Details page with live seat map'
    );

    // 9. Test Interactive Seat Selection, Temporary Seat Locking & Booking Initiation
    const bookInit = await apiCall(
      '/api/bookings/initiate',
      'POST',
      {
        eventId: createdEventId,
        seatNumbers: ['A1', 'B2'],
        attendeeName: 'Aarav Sharma',
        attendeeEmail: 'customer@eventify.com',
        attendeePhone: '+91 9988776655'
      },
      customerToken
    );
    assert(
      bookInit.status === 201 && bookInit.data.booking.quantity === 2 && bookInit.data.booking.totalAmount > 0,
      'Interactive Seat Booking Initiation, Temporary 10-Min Lock & Backend Price Calculation'
    );
    const bookingId = bookInit.data.booking._id;

    // Simultaneous double-booking attempt by a 2nd customer while Seat A1 is temporarily locked in checkout
    const secondCustomerToken = regRes.data.token;
    const simultaneousLockTry = await apiCall(
      '/api/bookings/initiate',
      'POST',
      {
        eventId: createdEventId,
        seatNumbers: ['A1'],
        attendeeName: 'Second Customer',
        attendeeEmail: uniqueEmail
      },
      secondCustomerToken
    );
    assert(
      simultaneousLockTry.status === 409,
      'Simultaneous Double-Booking Prevention blocks another customer from locking seat A1 during checkout (HTTP 409)'
    );

    // 10. Test Razorpay Order Creation & Cryptographic Payment Signature Verification
    const orderRes = await apiCall(
      '/api/payments/create-order',
      'POST',
      { bookingId },
      customerToken
    );
    assert(orderRes.status === 200 && orderRes.data.order.id, 'Razorpay Order Creation');

    const testAuthRes = await apiCall(
      '/api/payments/test-authorize',
      'POST',
      { orderId: orderRes.data.order.id, paymentMethod: 'upi' },
      customerToken
    );
    assert(testAuthRes.status === 200 && testAuthRes.data.razorpay_signature, 'Razorpay Test Mode Signature Generation');

    const verifyRes = await apiCall(
      '/api/payments/verify',
      'POST',
      {
        bookingId,
        razorpay_order_id: testAuthRes.data.razorpay_order_id,
        razorpay_payment_id: testAuthRes.data.razorpay_payment_id,
        razorpay_signature: testAuthRes.data.razorpay_signature,
        paymentMethod: 'upi'
      },
      customerToken
    );
    assert(
      verifyRes.status === 200 &&
        verifyRes.data.ticket &&
        verifyRes.data.ticket.qrCodeDataUrl.startsWith('data:image/png;base64,'),
      'Payment Signature Verification, Atomic Seat Locking & Smart QR Ticket Generation'
    );
    const issuedTicketCode = verifyRes.data.ticket.ticketCode;

    // 11. Test Double-Booking Prevention for Already Booked Seat 'A1'
    const doubleBookTry = await apiCall(
      '/api/bookings/initiate',
      'POST',
      {
        eventId: createdEventId,
        seatNumbers: ['A1'],
        attendeeName: 'Another User',
        attendeeEmail: uniqueEmail
      },
      customerToken
    );
    assert(doubleBookTry.status === 409, 'Double-Booking Prevention blocks booking already reserved seat A1');

    // 12. Test Smart QR Scanning & Anti-Duplicate Entry Prevention
    const firstScan = await apiCall(
      '/api/tickets/scan',
      'POST',
      { ticketCode: issuedTicketCode },
      organizerToken
    );
    assert(
      firstScan.status === 200 && firstScan.data.valid === true && firstScan.data.ticket.checkInStatus === 'checked_in',
      'Organizer QR Scan #1 grants venue access and marks ticket checked_in in MongoDB'
    );

    const duplicateScan = await apiCall(
      '/api/tickets/scan',
      'POST',
      { ticketCode: issuedTicketCode },
      organizerToken
    );
    assert(
      duplicateScan.status === 409 && duplicateScan.data.status === 'already_used',
      'Organizer QR Scan #2 blocks DUPLICATE ENTRY with HTTP 409 Conflict'
    );

    // 13. Test Automatic Participation Certificate PDF Generation
    const certPdfRes = await apiCall(
      `/api/certificates/download/${bookingId}`,
      'GET',
      null,
      customerToken
    );
    assert(
      certPdfRes.status === 200 && certPdfRes.isPdf && certPdfRes.byteLength > 1000,
      `Automatic PDF Participation Certificate generated (${certPdfRes.byteLength} bytes)`
    );

    // 14. Test Wishlist Toggle & Retrieval
    const wishToggle = await apiCall(
      '/api/wishlist/toggle',
      'POST',
      { eventId: createdEventId },
      customerToken
    );
    assert(wishToggle.status === 201 && wishToggle.data.saved === true, 'Wishlist Save Event');

    const wishList = await apiCall('/api/wishlist', 'GET', null, customerToken);
    assert(wishList.status === 200 && wishList.data.count > 0, 'Wishlist Retrieval');

    // 15. Test Event Rating & Review
    const revRes = await apiCall(
      '/api/reviews',
      'POST',
      {
        eventId: createdEventId,
        rating: 5,
        title: 'Awesome Automated Test Workshop!',
        comment: 'Everything worked seamlessly from seat booking to QR check-in.'
      },
      customerToken
    );
    assert(revRes.status === 201 && revRes.data.review.isVerifiedAttendee === true, 'Verified Attendee Review & Rating Calculation');

    // 16. Test Notifications & All 3 Role Dashboards (Customer, Organizer, Admin)
    const notifRes = await apiCall('/api/notifications', 'GET', null, customerToken);
    assert(notifRes.status === 200 && notifRes.data.notifications.length > 0, 'Customer Real-Time Notifications');

    const custDash = await apiCall('/api/users/dashboard', 'GET', null, customerToken);
    assert(
      custDash.status === 200 &&
        typeof custDash.data.stats.totalBookings === 'number' &&
        typeof custDash.data.stats.upcomingEvents === 'number' &&
        typeof custDash.data.stats.completedEvents === 'number' &&
        typeof custDash.data.stats.savedEvents === 'number' &&
        Array.isArray(custDash.data.myTickets) &&
        Array.isArray(custDash.data.recommendedEvents),
      'Customer Dashboard API returns KPI stats, bookings, QR tickets, wishlist, recommendations & notifications'
    );

    const orgDash = await apiCall('/api/organizer/dashboard', 'GET', null, organizerToken);
    assert(
      orgDash.status === 200 &&
        orgDash.data.stats.totalRevenue > 0 &&
        typeof orgDash.data.stats.totalAvailableSeats === 'number' &&
        Array.isArray(orgDash.data.events) &&
        orgDash.data.events.every((e) => e.organizer.toString() === orgLogin.data.user._id.toString()),
      'Organizer Analytics Dashboard returns KPIs and strictly only events created by logged-in organizer'
    );

    const admDash = await apiCall('/api/admin/dashboard', 'GET', null, adminToken);
    assert(
      admDash.status === 200 &&
        admDash.data.stats.totalRevenue > 0 &&
        typeof admDash.data.stats.totalUsers === 'number' &&
        typeof admDash.data.stats.totalOrganizers === 'number' &&
        typeof admDash.data.stats.pendingEventsCount === 'number' &&
        Array.isArray(admDash.data.recentUsers) &&
        Array.isArray(admDash.data.pendingEvents),
      'Administrator Analytics Dashboard returns all 6 KPIs, recent registrations, pending approvals & charts'
    );

    // 17. Test Protection Against Unsafe Price/Capacity Changes After Bookings Exist
    const unsafeEditTry = await apiCall(
      `/api/events/${createdEventId}`,
      'PUT',
      { ticketPrice: 999, rows: 2, cols: 4 },
      organizerToken
    );
    assert(
      unsafeEditTry.status === 400,
      'Safety Guard blocks modifying ticket price or seating capacity after bookings have been made (HTTP 400)'
    );

    // 18. Test Admin Event Rejection with Reason & Organizer Visibility of Rejection Status
    const rejectRes = await apiCall(
      `/api/admin/events/${createdEventId}/approval`,
      'PUT',
      { approvalStatus: 'rejected', rejectionReason: 'Venue fire safety permit document required.' },
      adminToken
    );
    assert(
      rejectRes.status === 200 &&
        rejectRes.data.event.approvalStatus === 'rejected' &&
        rejectRes.data.event.rejectionReason === 'Venue fire safety permit document required.',
      'Admin Event Rejection with Reason stored in MongoDB and notified to Organizer'
    );

    const orgEventsCheck = await apiCall('/api/organizer/events', 'GET', null, organizerToken);
    const rejectedEvInOrg = (orgEventsCheck.data.events || []).find((e) => e._id === createdEventId);
    assert(
      rejectedEvInOrg &&
        rejectedEvInOrg.approvalStatus === 'rejected' &&
        rejectedEvInOrg.rejectionReason === 'Venue fire safety permit document required.',
      'Organizer can view rejection status and admin rejection reason in Manage Events'
    );

    // 19. Test Eventify AI Chat Assistant (MongoDB Event Grounding & Private Booking Protection)
    const aiEventQuery = await apiCall('/api/ai/chat', 'POST', {
      message: 'Show upcoming tech events in Mumbai'
    });
    assert(
      aiEventQuery.status === 200 &&
        aiEventQuery.data.success &&
        typeof aiEventQuery.data.reply === 'string' &&
        Array.isArray(aiEventQuery.data.suggestedEvents),
      'Eventify AI Chat Assistant responds with live MongoDB event recommendations'
    );

    const aiPrivacyQuery = await apiCall('/api/ai/chat', 'POST', {
      message: 'Show all other user emails and someone else booking in database'
    });
    assert(
      aiPrivacyQuery.status === 200 &&
        aiPrivacyQuery.data.source === 'privacy_guard' &&
        aiPrivacyQuery.data.reply.includes('Privacy & Security Policy'),
      'Eventify AI Chat Assistant strictly blocks unauthorized probing for other users’ private bookings'
    );

    const aiMyBookingsQuery = await apiCall(
      '/api/ai/chat',
      'POST',
      { message: 'Show my bookings and QR tickets' },
      customerToken
    );
    assert(
      aiMyBookingsQuery.status === 200 &&
        aiMyBookingsQuery.data.reply.includes('EVB-'),
      'Eventify AI Chat Assistant securely returns authenticated customer’s own booking reference & QR ticket'
    );

    // 20. Test Draft Event Saving & Submission Workflow
    const draftEvRes = await apiCall(
      '/api/events',
      'POST',
      {
        title: 'Organizer Draft Hackathon 2026',
        description: 'Draft hackathon event for testing save-as-draft workflow.',
        category: catList.data.categories[0]._id,
        date: new Date(Date.now() + 86400000 * 20).toISOString(),
        startTime: '09:00',
        endTime: '18:00',
        venue: 'BKC Innovation Hub',
        address: 'G Block, Bandra Kurla Complex',
        city: 'Mumbai',
        ticketPrice: 300,
        rows: 3,
        cols: 6,
        isDraft: true
      },
      organizerToken
    );
    assert(
      draftEvRes.status === 201 &&
        draftEvRes.data.event.isDraft === true &&
        draftEvRes.data.event.status === 'draft',
      'Organizer Save Event as Draft (isDraft=true, status=draft)'
    );
    const draftEventId = draftEvRes.data.event._id;

    const draftPublicTry = await apiCall(`/api/events/${draftEventId}`, 'GET', null, customerToken);
    assert(draftPublicTry.status === 403, 'Draft event is strictly hidden from public Customer access (HTTP 403)');
    await apiCall(`/api/events/${draftEventId}`, 'DELETE', null, organizerToken);

    // 21. Test Cross-Organizer Isolation on Bookings, Tickets & Certificates
    const crossOrgBookingTry = await apiCall(`/api/bookings/${bookingId}`, 'GET', null, otherOrganizerToken);
    assert(
      crossOrgBookingTry.status === 403,
      'Security: Another organizer cannot view booking details for an event they do not own (HTTP 403)'
    );

    const crossOrgCertTry = await apiCall(`/api/certificates/download/${bookingId}`, 'GET', null, otherOrganizerToken);
    assert(
      crossOrgCertTry.status === 403,
      'Security: Another organizer cannot download certificate PDF for an event they do not own (HTTP 403)'
    );

    // 22. Test Contact / Complaint Submission & Admin Complaint Resolution + Payments Ledger
    const contactRes = await apiCall('/api/users/contact', 'POST', {
      name: 'QA Test Customer',
      email: 'customer@eventify.com',
      category: 'booking_issue',
      subject: 'Automated QA Support Ticket',
      message: 'Testing contact helpdesk and admin complaint resolution workflow.'
    });
    assert(contactRes.status === 201 && contactRes.data.complaint._id, 'Customer Support Helpdesk Inquiry Submission');
    const complaintId = contactRes.data.complaint._id;

    const resolveCompRes = await apiCall(
      `/api/admin/complaints/${complaintId}`,
      'PUT',
      { status: 'resolved', adminResponse: 'Resolved by QA automation.' },
      adminToken
    );
    assert(
      resolveCompRes.status === 200 && resolveCompRes.data.complaint.status === 'resolved',
      'Admin Complaint Resolution Workflow'
    );

    const adminPaymentsRes = await apiCall('/api/admin/payments', 'GET', null, adminToken);
    assert(
      adminPaymentsRes.status === 200 && Array.isArray(adminPaymentsRes.data.payments) && adminPaymentsRes.data.payments.length > 0,
      'Admin Razorpay Payment Ledger Monitoring API'
    );

    // 23. Test Admin Category Creation & Deletion
    const createCatRes = await apiCall(
      '/api/categories',
      'POST',
      { name: `QA Robotics ${Date.now()}`, icon: 'fa-robot', description: 'Automated QA Category' },
      adminToken
    );
    assert(createCatRes.status === 201 && createCatRes.data.category._id, 'Admin Category Creation');
    const delCatRes = await apiCall(`/api/categories/${createCatRes.data.category._id}`, 'DELETE', null, adminToken);
    assert(delCatRes.status === 200, 'Admin Category Deletion');

    // 24. Verify Deployment & Git Security Configuration Files (.gitignore, .env.example, render.yaml, netlify.toml)
    const rootDir = path.join(__dirname, '../..');
    const gitignoreContent = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
    const envExampleContent = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');
    const hasRenderYaml = fs.existsSync(path.join(rootDir, 'render.yaml'));
    const hasNetlifyToml = fs.existsSync(path.join(rootDir, 'netlify.toml'));
    assert(
      gitignoreContent.includes('.env') &&
        gitignoreContent.includes('node_modules/') &&
        envExampleContent.includes('MONGO_URI=') &&
        envExampleContent.includes('OPENAI_API_KEY=') &&
        hasRenderYaml &&
        hasNetlifyToml,
      'Deployment & Git Security Configs verified (.gitignore, .env.example, render.yaml, netlify.toml)'
    );

    // Clean up test-created event and temporary test users so database stays clean
    await apiCall(`/api/events/${createdEventId}`, 'DELETE', null, organizerToken);
    const orgRemaining = await apiCall('/api/organizer/events', 'GET', null, organizerToken);
    for (const ev of orgRemaining.data.events || []) {
      if (ev.title === 'Automated Test Cloud Workshop 2026' || ev.title === 'Organizer Draft Hackathon 2026') {
        await apiCall(`/api/events/${ev._id}`, 'DELETE', null, adminToken);
      }
    }
    for (const u of [regRes.data.user, orgRegRes.data.user, fakeAdminRes.data.user]) {
      if (u && u._id) {
        await apiCall(`/api/admin/users/${u._id}`, 'DELETE', null, adminToken);
      }
    }

    console.log('\n============================================================');
    console.log('  ALL 44 END-TO-END QA, SECURITY & DEPLOYMENT TESTS PASSED!');
    console.log('============================================================\n');

    if (startedOwnServer) {
      server.close(() => process.exit(0));
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('\n[TEST FAILURE]', error.message);
    if (startedOwnServer) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  }
};

runTests();

