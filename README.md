# EVENTIFY – Smart Event Management & Online Booking System

**EVENTIFY** is a commercial-grade, full-stack Event Management and Online Ticket Booking Platform developed as a final-year B.Sc. Computer Science capstone project. It features real-time interactive venue seat selection, Razorpay Test Mode payment verification, tamper-proof Smart QR tickets with duplicate-entry prevention, automatic PDF participation certificates, and dedicated portals for Customers, Event Organizers, and Administrators.

---

## 1. Technology Stack

- **Frontend:** HTML5, CSS3 (Custom Design System with Purple `#6C3CE9` & Lavender `#F4F0FF` theme, Poppins typography), Vanilla JavaScript (ES6+), Bootstrap 5.3, Font Awesome 6.5, Chart.js 4.4, Socket.IO Client
- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas / Local MongoDB with Mongoose ODM
- **Security & Utilities:**
  - `jsonwebtoken` (JWT Authentication & Role-Based Access Control)
  - `bcryptjs` (Password Hashing)
  - `multer` (Poster Image Upload & File Validation)
  - `qrcode` (Cryptographic Smart QR Code Ticket Generation)
  - `razorpay` & `crypto` (Order Creation & HMAC-SHA256 Payment Signature Verification)
  - `pdfkit` (Automatic PDF Participation Certificate Generation)
  - `nodemailer` (Transactional Booking & Ticket Emails)
  - `socket.io` (Real-time Notifications & Live Seat Map Updates)
  - `helmet`, `cors`, `express-rate-limit` (API Security & Rate Limiting)

---

## 2. Project Folder Structure

```text
eventify-event-management/
├── frontend/
│   ├── css/
│   │   └── style.css                 # Premium Purple/Lavender Design System
│   ├── js/
│   │   ├── main.js                   # Global API SDK, Auth, Navbar, Toast, Socket.IO
│   │   ├── organizer.js              # Organizer Portal Sidebar & RBAC Guard
│   │   └── admin.js                  # Admin Portal Sidebar & RBAC Guard
│   ├── organizer/
│   │   ├── dashboard.html            # Organizer KPIs, Charts & Recent Bookings
│   │   ├── create-event.html         # Create / Edit Event & Seat Map Generator
│   │   ├── manage-events.html        # Event Status Control & Inventory
│   │   ├── manage-bookings.html      # Filterable Event Reservations
│   │   ├── participants.html         # Attendee Roster & 1-Click CSV Export
│   │   ├── scan-ticket.html          # Smart QR Scanner & Anti-Duplicate Validator
│   │   └── analytics.html            # Revenue & Seat Occupancy Analytics
│   ├── admin/
│   │   ├── dashboard.html            # Platform Revenue, Charts & Overview
│   │   ├── users.html                # User Management (Suspend/Activate/Delete)
│   │   ├── organizers.html           # Organizer Verification & Revenue Audit
│   │   ├── events.html               # Approve/Reject Events & Featured/Trending Toggles
│   │   ├── bookings.html             # Platform-Wide Booking Ledger
│   │   ├── categories.html           # Create & Manage Event Categories
│   │   ├── payments.html             # Razorpay Order & Payment Status Monitor
│   │   ├── reports.html              # Executive Financial Audit & CSV/Print Export
│   │   └── reviews.html              # Review Moderation & Customer Complaint Resolution
│   ├── index.html                    # Hero Search, Countdown, Categories, Featured, Smart Recommendations
│   ├── events.html                   # Advanced Search, Category/City/Price Filters & Sorting
│   ├── event-details.html            # Live Countdown, Tier Pricing, Verified Reviews
│   ├── categories.html               # Interactive Category Explorer
│   ├── booking.html                  # Interactive Seat Selection (Green/Red/Purple)
│   ├── payment.html                  # Razorpay Test Mode Checkout & Signature Verification
│   ├── ticket.html                   # Printable Smart QR Pass & Certificate Download
│   ├── my-bookings.html              # Booking History, QR Links & Certificate PDF Downloads
│   ├── wishlist.html                 # Saved Favorite Events
│   ├── profile.html                  # Profile Editor, Interests, Password & Certificates
│   ├── login.html                    # Role-Aware Login with 1-Click Demo Credentials
│   ├── register.html                 # Customer & Organizer Registration
│   └── contact.html                  # Support Helpdesk & Complaint Submission
├── backend/
│   ├── config/
│   │   └── db.js                     # MongoDB Atlas + Local MongoDB Fallback Connection
│   ├── models/                       # 11 Mongoose Schemas
│   │   ├── User.js
│   │   ├── Organizer.js
│   │   ├── Category.js
│   │   ├── Event.js
│   │   ├── Booking.js
│   │   ├── Ticket.js
│   │   ├── Payment.js
│   │   ├── Review.js
│   │   ├── Wishlist.js
│   │   ├── Notification.js
│   │   ├── Certificate.js
│   │   └── Complaint.js
│   ├── controllers/                  # Modular Express Controllers
│   ├── routes/                       # Protected & Public Express Routers
│   ├── middleware/                   # Auth, Role RBAC, Multer Upload & Error Handling
│   ├── utils/
│   │   ├── seeder.js                 # Rich Demo Data Seeder
│   │   ├── test-api.js               # Automated 18-Step End-to-End Test Suite
│   │   ├── emailService.js           # Nodemailer SMTP Service
│   │   └── notificationHelper.js     # Real-Time Socket.IO Notification Emitter
│   ├── uploads/                      # Uploaded Event Posters
│   └── server.js                     # Express + Socket.IO Entry Point
├── .env.example                      # Environment Variable Template
├── .gitignore
├── package.json
└── README.md
```

---

## 3. Installation & Local Setup Instructions

### Prerequisites
- **Node.js** (v18+ or v20/v24 recommended)
- **MongoDB** (Local MongoDB instance running on `127.0.0.1:27017` OR a **MongoDB Atlas** connection URI)

### Step-by-Step Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env` and update your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5000
   MONGO_URI=mongodb://127.0.0.1:27017/eventify
   JWT_SECRET=your_strong_jwt_secret_key
   JWT_EXPIRE=7d
   RAZORPAY_KEY_ID=rzp_test_YourTestKeyId
   RAZORPAY_KEY_SECRET=YourTestKeySecret
   ```
   *(Note: If `RAZORPAY_KEY_ID` is left blank, EVENTIFY automatically activates its built-in **Razorpay Test Mode Sandbox Modal** with real backend HMAC-SHA256 cryptographic signature verification so you can test payments end-to-end immediately).*

3. **Seed Sample Demonstration Data (Optional – runs automatically on first start):**
   ```bash
   npm run seed -- --force
   ```

4. **Start the Application Server:**
   ```bash
   # Development mode with auto-reload:
   npm run dev

   # Production mode:
   npm start
   ```

5. **Open in Browser:**
   Navigate to `http://localhost:5000`

---

## 4. Demo Login Credentials (Pre-Seeded)

| Role | Email | Password | Portal Access |
| :--- | :--- | :--- | :--- |
| **Customer** | `customer@eventify.com` | `Password@123` | Browse, Book Seats, QR Tickets, Certificates, Wishlist |
| **Event Organizer** | `organizer@eventify.com` | `Password@123` | Organizer Dashboard, Create Events, Scan QR, CSV Export |
| **Administrator** | `admin@eventify.com` | `Password@123` | Admin Command Center, Approve Events, Manage Users/Payments |

*(You can also click the **1-Click Demo Role Pills** directly on `/login.html`).*

---

## 5. API Testing Instructions

Run the automated 18-step end-to-end verification suite at any time:
```bash
npm test
```

### Key REST API Endpoints
- `POST /api/auth/register` — Register Customer or Organizer
- `POST /api/auth/login` — Authenticate & receive JWT
- `GET /api/events` — Search, filter, and sort approved events
- `GET /api/events/recommendations` — Smart personalized event recommendations
- `POST /api/events` — Create event with auto-generated interactive seat map (`organizer`/`admin`)
- `POST /api/bookings/initiate` — Validate seat availability & calculate backend pricing
- `POST /api/payments/create-order` — Create Razorpay order strictly from backend total
- `POST /api/payments/verify` — Verify HMAC-SHA256 signature, lock seats atomically & generate QR ticket
- `POST /api/tickets/scan` — Validate QR ticket & prevent duplicate check-in (`organizer`/`admin`)
- `GET /api/certificates/download/:bookingId` — Stream dynamically generated PDF certificate

---

## 6. Deployment Guide (MongoDB Atlas, Render, Netlify & Cloudinary)

1. **MongoDB Atlas:**
   - Create a cluster on MongoDB Atlas, whitelist `0.0.0.0/0` in Network Access, and set `MONGO_URI` in your environment variables.
2. **Render (Full-Stack / Backend Deployment):**
   - Connect your GitHub repository to Render as a **Web Service**.
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add environment variables (`MONGO_URI`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `SMTP_HOST`, etc.).
3. **Netlify (Optional Separate Frontend Hosting):**
   - Publish directory: `frontend`
   - Update `API_BASE` in `frontend/js/main.js` if hosting frontend on a separate domain from the Render backend.

