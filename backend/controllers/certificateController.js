const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const Certificate = require('../models/Certificate');
const Booking = require('../models/Booking');
const Event = require('../models/Event');

// @desc    Get user's earned certificates
// @route   GET /api/certificates/my-certificates
// @access  Private
exports.getMyCertificates = async (req, res, next) => {
  try {
    const certificates = await Certificate.find({ user: req.user._id })
      .populate('event', 'title date venue city categoryName organizerName')
      .sort({ issuedAt: -1 });

    res.status(200).json({
      success: true,
      count: certificates.length,
      certificates
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate or retrieve certificate and stream a styled PDF download
// @route   GET /api/certificates/download/:bookingId
// @access  Private
exports.downloadCertificatePDF = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate('event');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isBookingOwner = booking.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isEventOrganizer =
      req.user.role === 'organizer' &&
      booking.event &&
      booking.event.organizer &&
      booking.event.organizer.toString() === req.user._id.toString();

    if (!isBookingOwner && !isAdmin && !isEventOrganizer) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to certificate' });
    }

    if (booking.bookingStatus !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Certificates are only available for confirmed bookings'
      });
    }

    const event = booking.event;
    let cert = await Certificate.findOne({ user: booking.user, event: event._id });

    if (!cert) {
      const certNumber =
        'EVCERT-' +
        Date.now().toString(36).toUpperCase() +
        '-' +
        crypto.randomBytes(2).toString('hex').toUpperCase();

      cert = await Certificate.create({
        certificateNumber: certNumber,
        user: booking.user,
        event: event._id,
        booking: booking._id,
        participantName: booking.attendeeName,
        eventTitle: event.title,
        eventDate: event.date,
        organizerName: event.organizerName || 'EVENTIFY Official Organizer'
      });
    }

    // Generate PDF using PDFKit
    const doc = new PDFDocument({
      layout: 'landscape',
      size: 'A4',
      margin: 40
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=EVENTIFY-Certificate-${cert.certificateNumber}.pdf`
    );

    doc.pipe(res);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Background tint
    doc.rect(0, 0, pageWidth, pageHeight).fill('#FAF8FF');

    // Outer Decorative Purple Border
    doc
      .lineWidth(8)
      .strokeColor('#6C3CE9')
      .rect(25, 25, pageWidth - 50, pageHeight - 50)
      .stroke();

    // Inner Lavender Border
    doc
      .lineWidth(2)
      .strokeColor('#B8A2F8')
      .rect(36, 36, pageWidth - 72, pageHeight - 72)
      .stroke();

    // Header Badge
    doc
      .fillColor('#6C3CE9')
      .fontSize(26)
      .font('Helvetica-Bold')
      .text('EVENTIFY', 0, 75, { align: 'center', characterSpacing: 4 });

    doc
      .fillColor('#64748B')
      .fontSize(11)
      .font('Helvetica')
      .text('SMART EVENT MANAGEMENT & ONLINE BOOKING PLATFORM', 0, 108, {
        align: 'center',
        characterSpacing: 2
      });

    // Main Certificate Title
    doc
      .fillColor('#1E1B4B')
      .fontSize(34)
      .font('Helvetica-Bold')
      .text('CERTIFICATE OF PARTICIPATION', 0, 155, { align: 'center', characterSpacing: 1.5 });

    // Subtitle
    doc
      .fillColor('#475569')
      .fontSize(15)
      .font('Helvetica-Oblique')
      .text('This is proudly presented to', 0, 215, { align: 'center' });

    // Participant Name
    doc
      .fillColor('#6C3CE9')
      .fontSize(32)
      .font('Helvetica-Bold')
      .text(cert.participantName.toUpperCase(), 0, 250, { align: 'center' });

    // Decorative Underline
    doc
      .moveTo(pageWidth / 2 - 160, 292)
      .lineTo(pageWidth / 2 + 160, 292)
      .lineWidth(1.5)
      .strokeColor('#C4B5FD')
      .stroke();

    // Event Description
    const formattedDate = new Date(cert.eventDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    doc
      .fillColor('#334155')
      .fontSize(15)
      .font('Helvetica')
      .text(
        `for actively participating in the official event`,
        100,
        315,
        { align: 'center', width: pageWidth - 200 }
      );

    doc
      .fillColor('#1E1B4B')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(`"${cert.eventTitle}"`, 80, 345, { align: 'center', width: pageWidth - 160 });

    doc
      .fillColor('#475569')
      .fontSize(13)
      .font('Helvetica')
      .text(`Held on ${formattedDate} at ${event.venue}, ${event.city}`, 100, 385, {
        align: 'center',
        width: pageWidth - 200
      });

    // Footer Signatures & Certificate ID
    const footerY = 465;

    doc
      .fillColor('#1E1B4B')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(cert.organizerName, 90, footerY, { width: 220, align: 'center' });
    doc
      .moveTo(100, footerY - 8)
      .lineTo(300, footerY - 8)
      .lineWidth(1)
      .strokeColor('#94A3B8')
      .stroke();
    doc
      .fillColor('#64748B')
      .fontSize(10)
      .font('Helvetica')
      .text('Authorized Event Organizer', 90, footerY + 18, { width: 220, align: 'center' });

    // Center Verification Seal
    doc
      .fillColor('#6C3CE9')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`CERTIFICATE ID: ${cert.certificateNumber}`, 0, footerY + 5, { align: 'center' });
    doc
      .fillColor('#64748B')
      .fontSize(9)
      .font('Helvetica')
      .text(`Verified by EVENTIFY Smart QR & Certificate Engine`, 0, footerY + 20, {
        align: 'center'
      });

    // Right Signature
    doc
      .fillColor('#1E1B4B')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('EVENTIFY Certification Board', pageWidth - 310, footerY, {
        width: 220,
        align: 'center'
      });
    doc
      .moveTo(pageWidth - 300, footerY - 8)
      .lineTo(pageWidth - 100, footerY - 8)
      .lineWidth(1)
      .strokeColor('#94A3B8')
      .stroke();
    doc
      .fillColor('#64748B')
      .fontSize(10)
      .font('Helvetica')
      .text('Platform Director', pageWidth - 310, footerY + 18, { width: 220, align: 'center' });

    doc.end();
  } catch (error) {
    next(error);
  }
};

