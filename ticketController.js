const Ticket = require('../models/Ticket');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const Certificate = require('../models/Certificate');
const crypto = require('crypto');
const { createNotification } = require('../utils/notificationHelper');

// @desc    Get ticket by ID or ticketCode or bookingId
// @route   GET /api/tickets/:id
// @access  Private
exports.getTicket = async (req, res, next) => {
  try {
    const param = req.params.id;
    let ticket = null;

    if (/^[0-9a-fA-F]{24}$/.test(param)) {
      ticket = await Ticket.findById(param)
        .populate('event', 'title poster date startTime endTime venue address city organizer organizerName categoryName certificateEligible')
        .populate('booking')
        .populate('user', 'name email phone');

      if (!ticket) {
        ticket = await Ticket.findOne({ booking: param })
          .populate('event', 'title poster date startTime endTime venue address city organizer organizerName categoryName certificateEligible')
          .populate('booking')
          .populate('user', 'name email phone');
      }
    } else {
      ticket = await Ticket.findOne({ ticketCode: param.toUpperCase() })
        .populate('event', 'title poster date startTime endTime venue address city organizer organizerName categoryName certificateEligible')
        .populate('booking')
        .populate('user', 'name email phone');
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check access permission (Ticket Owner, Event Organizer Owner, or Admin)
    const isTicketOwner = ticket.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isEventOrganizer =
      req.user.role === 'organizer' &&
      ticket.event &&
      ticket.event.organizer &&
      ticket.event.organizer.toString() === req.user._id.toString();

    if (!isTicketOwner && !isAdmin && !isEventOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this ticket'
      });
    }

    res.status(200).json({
      success: true,
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify and Scan QR Ticket (Organizer / Admin) - Prevents duplicate entry!
// @route   POST /api/tickets/scan
// @access  Private (Organizer / Admin)
exports.scanAndValidateTicket = async (req, res, next) => {
  try {
    const { qrData, ticketCode: manualTicketCode } = req.body;

    let parsedCode = manualTicketCode ? manualTicketCode.trim().toUpperCase() : '';
    let providedHash = '';

    if (qrData) {
      try {
        const obj = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
        if (obj.ticketCode) parsedCode = obj.ticketCode.toUpperCase();
        if (obj.hash) providedHash = obj.hash;
      } catch (e) {
        // If qrData was a plain ticket code string
        parsedCode = String(qrData).trim().toUpperCase();
      }
    }

    if (!parsedCode) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Please provide a valid Ticket ID or QR code payload'
      });
    }

    const ticket = await Ticket.findOne({ ticketCode: parsedCode })
      .populate('event', 'title date startTime venue city organizer certificateEligible organizerName')
      .populate('booking', 'bookingReference attendeeName attendeeEmail attendeePhone totalAmount quantity')
      .populate('user', 'name email phone');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        valid: false,
        status: 'invalid',
        message: `INVALID TICKET: No ticket found matching code "${parsedCode}".`
      });
    }

    // Verify organizer owns this event (unless admin)
    if (
      req.user.role === 'organizer' &&
      ticket.event.organizer.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        valid: false,
        status: 'unauthorized_event',
        message: 'This ticket belongs to an event hosted by a different organizer.'
      });
    }

    // Verify cryptographic hash if scanned via QR payload
    if (providedHash && providedHash !== ticket.qrPayloadHash) {
      return res.status(400).json({
        success: false,
        valid: false,
        status: 'tampered',
        message: 'SECURITY ALERT: QR signature hash mismatch! Counterfeit ticket detected.'
      });
    }

    // Prevent Duplicate Entry!
    if (ticket.checkInStatus === 'checked_in') {
      return res.status(409).json({
        success: false,
        valid: false,
        status: 'already_used',
        message: `DUPLICATE ENTRY PREVENTED! Ticket ${ticket.ticketCode} was already scanned and checked in at ${new Date(
          ticket.checkedInAt
        ).toLocaleString()}.`,
        ticket
      });
    }

    if (ticket.checkInStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        valid: false,
        status: 'cancelled',
        message: `Ticket ${ticket.ticketCode} has been cancelled and is not valid for entry.`,
        ticket
      });
    }

    // Mark ticket as checked_in in MongoDB
    ticket.checkInStatus = 'checked_in';
    ticket.checkedInAt = new Date();
    ticket.checkedInBy = req.user._id;
    await ticket.save();

    // Ensure certificate exists for checked-in participant
    if (ticket.event.certificateEligible) {
      const certNumber = 'EVCERT-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
      await Certificate.findOneAndUpdate(
        { user: ticket.user._id, event: ticket.event._id },
        {
          certificateNumber: certNumber,
          user: ticket.user._id,
          event: ticket.event._id,
          booking: ticket.booking._id,
          participantName: ticket.booking.attendeeName || ticket.user.name,
          eventTitle: ticket.event.title,
          eventDate: ticket.event.date,
          organizerName: ticket.event.organizerName || 'EVENTIFY Official Organizer'
        },
        { upsert: true, new: true }
      );
    }

    await createNotification({
      user: ticket.user._id,
      title: 'Venue Check-In Successful!',
      message: `Your ticket (${ticket.ticketCode}) for "${ticket.event.title}" was scanned at the entrance. Enjoy the event!`,
      type: 'event_update',
      link: `/my-bookings.html`
    });

    res.status(200).json({
      success: true,
      valid: true,
      status: 'checked_in',
      message: `ACCESS GRANTED: Ticket ${ticket.ticketCode} verified! Attendee ${ticket.booking.attendeeName} checked in for seats [${ticket.seats.join(', ')}].`,
      ticket
    });
  } catch (error) {
    next(error);
  }
};

