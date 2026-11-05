const crypto = require('crypto');
const QRCode = require('qrcode');
const Razorpay = require('razorpay');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const Payment = require('../models/Payment');
const Ticket = require('../models/Ticket');
const Organizer = require('../models/Organizer');
const Certificate = require('../models/Certificate');
const { createNotification, getSocketIO } = require('../utils/notificationHelper');
const { sendEmail } = require('../utils/emailService');

const getRazorpayInstance = () => {
  if (
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    !process.env.RAZORPAY_KEY_ID.includes('YourTestKeyIdHere')
  ) {
    return new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return null;
};

// @desc    Initiate a booking and calculate exact server-side pricing
// @route   POST /api/bookings/initiate
// @access  Private (Customer / Organizer / Admin)
exports.initiateBooking = async (req, res, next) => {
  try {
    const { eventId, seatNumbers, attendeeName, attendeeEmail, attendeePhone } = req.body;

    if (!eventId || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one seat to book'
      });
    }

    if (seatNumbers.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'You can book a maximum of 10 seats per transaction'
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.approvalStatus !== 'approved' || event.isPublished === false || event.status === 'cancelled' || event.status === 'draft') {
      return res.status(400).json({
        success: false,
        message: 'This event is currently not open for booking'
      });
    }

    const maxAllowed = event.maxTicketsPerCustomer || 10;
    if (seatNumbers.length > maxAllowed) {
      return res.status(400).json({
        success: false,
        message: `You can book a maximum of ${maxAllowed} seats per transaction for this event`
      });
    }

    // Release any expired temporary seat locks before checking availability
    if (typeof event.releaseExpiredSeatLocks === 'function') {
      event.releaseExpiredSeatLocks();
    }

    const now = new Date();
    const lockExpiry = new Date(now.getTime() + 10 * 60 * 1000); // 10-minute temporary lock

    // Validate seat availability and compute price strictly from server seat map
    const uniqueSeats = [...new Set(seatNumbers.map((s) => s.toUpperCase().trim()))];
    const selectedSeatsData = [];
    let subTotal = 0;

    for (const seatCode of uniqueSeats) {
      const seatObj = event.seatLayout.seats.find((s) => s.seatNumber === seatCode);
      if (!seatObj) {
        return res.status(400).json({
          success: false,
          message: `Seat ${seatCode} does not exist in this venue layout`
        });
      }
      if (seatObj.status === 'booked') {
        return res.status(409).json({
          success: false,
          message: `Seat ${seatCode} has already been booked. Please refresh and choose another seat.`
        });
      }
      if (
        seatObj.lockedBy &&
        seatObj.lockedBy.toString() !== req.user._id.toString() &&
        seatObj.lockExpiresAt &&
        new Date(seatObj.lockExpiresAt) > now
      ) {
        return res.status(409).json({
          success: false,
          message: `Seat ${seatCode} is temporarily locked by another customer in checkout. Please select another seat.`
        });
      }

      const seatPrice = Number(seatObj.price);
      if (isNaN(seatPrice) || seatPrice < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price configuration for seat ${seatCode}`
        });
      }

      selectedSeatsData.push({
        seatNumber: seatObj.seatNumber,
        row: seatObj.row,
        tier: seatObj.tier,
        price: seatPrice
      });
      subTotal += seatPrice;
    }

    // Apply temporary lock to selected seats on the Event document
    event.seatLayout.seats.forEach((seatObj) => {
      if (uniqueSeats.includes(seatObj.seatNumber)) {
        seatObj.lockedBy = req.user._id;
        seatObj.lockExpiresAt = lockExpiry;
      }
    });
    await event.save();

    const taxAmount = Math.round(subTotal * 0.05); // 5% platform & GST fee
    const totalAmount = subTotal + taxAmount;

    const bookingReference = 'EVB-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

    const booking = await Booking.create({
      bookingReference,
      user: req.user._id,
      event: event._id,
      selectedSeats: selectedSeatsData,
      quantity: selectedSeatsData.length,
      subTotal,
      taxAmount,
      totalAmount,
      attendeeName: (attendeeName || req.user.name).trim(),
      attendeeEmail: (attendeeEmail || req.user.email).trim(),
      attendeePhone: (attendeePhone || req.user.phone || '').trim(),
      paymentStatus: 'pending',
      bookingStatus: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Booking initiated. Proceed to payment.',
      booking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get booking details by ID
// @route   GET /api/bookings/:id
// @access  Private
exports.getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('event', 'title poster date startTime endTime venue address city organizer organizerName categoryName certificateEligible')
      .populate('ticketId')
      .populate('paymentId')
      .populate('user', 'name email phone');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isBookingOwner = booking.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isEventOrganizer =
      req.user.role === 'organizer' &&
      booking.event &&
      booking.event.organizer &&
      booking.event.organizer.toString() === req.user._id.toString();

    if (!isBookingOwner && !isAdmin && !isEventOrganizer) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking' });
    }

    res.status(200).json({
      success: true,
      booking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's booking history
// @route   GET /api/bookings/my-bookings
// @access  Private
exports.getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('event', 'title poster date startTime endTime venue city categoryName status certificateEligible')
      .populate('ticketId')
      .populate('paymentId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Razorpay Order (calculates amount strictly on backend)
// @route   POST /api/payments/create-order
// @access  Private
exports.createPaymentOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }

    const booking = await Booking.findById(bookingId).populate('event');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized booking access' });
    }

    if (booking.bookingStatus === 'confirmed' || booking.paymentStatus === 'completed') {
      return res.status(400).json({ success: false, message: 'This booking is already paid and confirmed' });
    }

    // Re-verify that selected seats are still available in the event before creating payment order
    const event = await Event.findById(booking.event._id);
    for (const s of booking.selectedSeats) {
      const currentSeat = event.seatLayout.seats.find((item) => item.seatNumber === s.seatNumber);
      if (!currentSeat || currentSeat.status === 'booked') {
        booking.bookingStatus = 'cancelled';
        booking.paymentStatus = 'failed';
        await booking.save();
        return res.status(409).json({
          success: false,
          message: `Seat ${s.seatNumber} was just booked by another user. Please select different seats.`
        });
      }
    }

    const amountInPaise = Math.round(booking.totalAmount * 100);
    const razorpay = getRazorpayInstance();

    let orderId = '';
    let provider = 'razorpay_test_sandbox';
    let keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_eventify_sandbox';

    if (razorpay) {
      const rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: booking.bookingReference,
        notes: {
          bookingId: booking._id.toString(),
          eventTitle: event.title
        }
      });
      orderId = rzpOrder.id;
      provider = 'razorpay';
    } else {
      // Razorpay Test Mode Sandbox Order when live API keys are not set in .env
      orderId = 'order_test_' + crypto.randomBytes(8).toString('hex');
      provider = 'razorpay_test_sandbox';
    }

    const payment = await Payment.create({
      booking: booking._id,
      user: req.user._id,
      event: event._id,
      amount: booking.totalAmount,
      currency: 'INR',
      provider,
      razorpayOrderId: orderId,
      status: 'created'
    });

    // Generate HMAC test signature token if running in local test mode so backend signature check remains cryptographically verified
    const secret = process.env.RAZORPAY_KEY_SECRET || process.env.JWT_SECRET || 'eventify_default_secret';

    res.status(200).json({
      success: true,
      order: {
        id: orderId,
        amount: amountInPaise,
        amountRupees: booking.totalAmount,
        currency: 'INR',
        bookingId: booking._id,
        bookingReference: booking.bookingReference,
        provider,
        keyId,
        prefill: {
          name: booking.attendeeName,
          email: booking.attendeeEmail,
          contact: booking.attendeePhone
        }
      },
      paymentId: payment._id,
      // Provide helper endpoint support for test mode checkout modal
      testModeActive: provider === 'razorpay_test_sandbox',
      secretConfigured: Boolean(razorpay)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate test-mode payment credentials for Razorpay test checkout modal when external keys are placeholder
// @route   POST /api/payments/test-authorize
// @access  Private
exports.authorizeTestSandboxPayment = async (req, res, next) => {
  try {
    const { orderId, paymentMethod = 'card' } = req.body;
    const payment = await Payment.findOne({ razorpayOrderId: orderId, user: req.user._id });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment order not found' });
    }

    const paymentId = 'pay_test_' + crypto.randomBytes(8).toString('hex');
    const secret = process.env.RAZORPAY_KEY_SECRET || process.env.JWT_SECRET || 'eventify_default_secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    payment.paymentMethod = paymentMethod;
    await payment.save();

    res.status(200).json({
      success: true,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Razorpay Payment Signature, Lock Seats Atomically, and Generate Smart QR Ticket
// @route   POST /api/payments/verify
// @access  Private
exports.verifyPayment = async (req, res, next) => {
  try {
    const {
      bookingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentMethod
    } = req.body;

    if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification parameters'
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.bookingStatus === 'confirmed' && booking.ticketId) {
      return res.status(200).json({
        success: true,
        message: 'Booking already verified and confirmed',
        bookingId: booking._id,
        ticketId: booking.ticketId
      });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, booking: booking._id });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Matching payment order not found' });
    }

    // Verify HMAC SHA256 signature on backend
    const secret = process.env.RAZORPAY_KEY_SECRET || process.env.JWT_SECRET || 'eventify_default_secret';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      payment.status = 'failed';
      payment.failureReason = 'Invalid payment signature verification';
      await payment.save();

      booking.paymentStatus = 'failed';
      await booking.save();

      return res.status(400).json({
        success: false,
        message: 'Payment signature verification failed! Transaction rejected.'
      });
    }

    // Atomically check and lock seats in Event document
    const seatCodes = booking.selectedSeats.map((s) => s.seatNumber);
    const event = await Event.findById(booking.event);

    for (const code of seatCodes) {
      const seatObj = event.seatLayout.seats.find((s) => s.seatNumber === code);
      if (!seatObj || seatObj.status === 'booked') {
        payment.status = 'failed';
        payment.failureReason = `Seat ${code} conflict during finalization`;
        await payment.save();
        return res.status(409).json({
          success: false,
          message: `Seat ${code} was already booked by another attendee.`
        });
      }
    }

    // Mark seats as booked and clear temporary locks
    event.seatLayout.seats.forEach((seatObj) => {
      if (seatCodes.includes(seatObj.seatNumber)) {
        seatObj.status = 'booked';
        seatObj.bookedBy = req.user._id;
        seatObj.bookingId = booking._id;
        seatObj.lockedBy = null;
        seatObj.lockExpiresAt = null;
      }
    });

    const remainingAvailable = event.seatLayout.seats.filter((s) => s.status === 'available').length;
    event.availableSeats = remainingAvailable;
    event.bookingsCount = (event.bookingsCount || 0) + booking.quantity;
    await event.save();

    // Update Payment record
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    payment.status = 'captured';
    await payment.save();

    // Generate Unique Smart QR Ticket
    const ticketCode =
      'EVT-' +
      crypto.randomBytes(3).toString('hex').toUpperCase() +
      '-' +
      Date.now().toString().slice(-4);

    const qrPayloadHash = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'eventify_default_secret')
      .update(`${ticketCode}|${booking._id.toString()}|${event._id.toString()}`)
      .digest('hex')
      .slice(0, 24);

    const qrPayload = JSON.stringify({
      ticketCode,
      bookingReference: booking.bookingReference,
      eventId: event._id,
      eventTitle: event.title,
      attendee: booking.attendeeName,
      seats: seatCodes,
      hash: qrPayloadHash
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 340,
      color: {
        dark: '#2D1674',
        light: '#FFFFFF'
      }
    });

    const ticket = await Ticket.create({
      ticketCode,
      booking: booking._id,
      user: req.user._id,
      event: event._id,
      seats: seatCodes,
      qrCodeDataUrl,
      qrPayloadHash,
      checkInStatus: 'unused'
    });

    // Update Booking status
    booking.paymentStatus = 'completed';
    booking.bookingStatus = 'confirmed';
    booking.paymentId = payment._id;
    booking.ticketId = ticket._id;
    await booking.save();

    // Update Organizer revenue
    await Organizer.findOneAndUpdate(
      { user: event.organizer },
      { $inc: { totalRevenue: booking.totalAmount } }
    );

    // Automatically issue participation certificate record if event is certificate-eligible
    if (event.certificateEligible) {
      try {
        const certNumber = 'EVCERT-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
        await Certificate.findOneAndUpdate(
          { user: req.user._id, event: event._id },
          {
            certificateNumber: certNumber,
            user: req.user._id,
            event: event._id,
            booking: booking._id,
            participantName: booking.attendeeName,
            eventTitle: event.title,
            eventDate: event.date,
            organizerName: event.organizerName || 'EVENTIFY Official Organizer'
          },
          { upsert: true, new: true }
        );
      } catch (certErr) {
        console.error('[Certificate Auto-Create]', certErr.message);
      }
    }

    // Emit live seat update via Socket.IO
    const io = getSocketIO();
    if (io) {
      io.to(`event_${event._id.toString()}`).emit('seats_updated', {
        eventId: event._id,
        bookedSeats: seatCodes,
        availableSeats: remainingAvailable
      });
    }

    // Create Notifications for Customer & Organizer
    await createNotification({
      user: req.user._id,
      title: 'Booking & Payment Confirmed!',
      message: `Your ticket (${ticketCode}) for "${event.title}" [Seats: ${seatCodes.join(', ')}] is ready!`,
      type: 'booking',
      link: `/ticket.html?id=${ticket._id}`
    });

    await createNotification({
      user: event.organizer,
      title: 'New Ticket Booking!',
      message: `${booking.attendeeName} booked ${seatCodes.length} seat(s) (${seatCodes.join(', ')}) for "${event.title}".`,
      type: 'organizer',
      link: `/organizer/manage-bookings.html`
    });

    // Send confirmation email (if SMTP configured)
    await sendEmail({
      to: booking.attendeeEmail,
      subject: `EVENTIFY Ticket Confirmed: ${event.title} [${ticketCode}]`,
      html: `
        <div style="font-family:Poppins,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e0fa;border-radius:16px;">
          <h2 style="color:#6C3CE9;">EVENTIFY Booking Confirmed!</h2>
          <p>Hi <strong>${booking.attendeeName}</strong>,</p>
          <p>Your payment of <strong>₹${booking.totalAmount}</strong> was verified and your smart QR ticket is ready.</p>
          <ul>
            <li><strong>Ticket ID:</strong> ${ticketCode}</li>
            <li><strong>Booking Ref:</strong> ${booking.bookingReference}</li>
            <li><strong>Event:</strong> ${event.title}</li>
            <li><strong>Venue:</strong> ${event.venue}, ${event.city}</li>
            <li><strong>Seats:</strong> ${seatCodes.join(', ')}</li>
          </ul>
          <p>Present the QR code from your EVENTIFY dashboard at the venue entrance.</p>
        </div>
      `
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified and Smart QR Ticket generated!',
      booking,
      ticket,
      payment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Handle Failed or Cancelled Payment
// @route   POST /api/payments/failed
// @access  Private
exports.markPaymentFailed = async (req, res, next) => {
  try {
    const { bookingId, orderId, reason } = req.body;
    if (bookingId) {
      const booking = await Booking.findByIdAndUpdate(
        bookingId,
        {
          paymentStatus: 'failed',
          bookingStatus: 'cancelled'
        },
        { new: true }
      );
      if (booking && booking.event && Array.isArray(booking.selectedSeats)) {
        const seatCodes = booking.selectedSeats.map((s) => s.seatNumber);
        const event = await Event.findById(booking.event);
        if (event && event.seatLayout && Array.isArray(event.seatLayout.seats)) {
          event.seatLayout.seats.forEach((seatObj) => {
            if (seatCodes.includes(seatObj.seatNumber) && seatObj.status === 'available') {
              seatObj.lockedBy = null;
              seatObj.lockExpiresAt = null;
            }
          });
          await event.save();
        }
      }
    }
    if (orderId) {
      await Payment.findOneAndUpdate(
        { razorpayOrderId: orderId },
        { status: 'failed', failureReason: reason || 'Payment cancelled or failed by user' }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Payment failure recorded. Temporary seat locks released.'
    });
  } catch (error) {
    next(error);
  }
};

