const express = require('express');
const router = express.Router();
const {
  getAdminDashboard,
  getAllUsers,
  updateUserStatus,
  deleteUser,
  getAllOrganizers,
  updateOrganizerVerification,
  getAllEventsAdmin,
  updateEventApproval,
  getAllBookingsAdmin,
  getAllPaymentsAdmin,
  getAllReviewsAndComplaints,
  updateComplaintStatus
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect, authorize('admin'));

router.get('/dashboard', getAdminDashboard);
router.get('/users', getAllUsers);
router.put('/users/:id', updateUserStatus);
router.delete('/users/:id', deleteUser);
router.get('/organizers', getAllOrganizers);
router.put('/organizers/:id', updateOrganizerVerification);
router.get('/events', getAllEventsAdmin);
router.put('/events/:id/approval', updateEventApproval);
router.get('/bookings', getAllBookingsAdmin);
router.get('/payments', getAllPaymentsAdmin);
router.get('/reviews', getAllReviewsAndComplaints);
router.put('/complaints/:id', updateComplaintStatus);

module.exports = router;

