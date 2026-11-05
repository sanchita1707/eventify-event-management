require('dotenv').config();
const crypto = require('crypto');
const QRCode = require('qrcode');
const connectDB = require('../config/db');
const User = require('../models/User');
const Organizer = require('../models/Organizer');
const Category = require('../models/Category');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Ticket = require('../models/Ticket');
const Review = require('../models/Review');
const Wishlist = require('../models/Wishlist');
const Notification = require('../models/Notification');
const Certificate = require('../models/Certificate');
const Complaint = require('../models/Complaint');

const seedDatabase = async (closeAfter = false) => {
  try {
    const existingEvents = await Event.countDocuments();
    if (existingEvents > 0 && !process.argv.includes('--force')) {
      console.log(`[Seeder] Database already contains ${existingEvents} events. Skipping auto-seed.`);
      if (closeAfter) process.exit(0);
      return;
    }

    console.log('[Seeder] Populating EVENTIFY database with rich commercial seed data...');

    await Promise.all([
      User.deleteMany(),
      Organizer.deleteMany(),
      Category.deleteMany(),
      Event.deleteMany(),
      Booking.deleteMany(),
      Payment.deleteMany(),
      Ticket.deleteMany(),
      Review.deleteMany(),
      Wishlist.deleteMany(),
      Notification.deleteMany(),
      Certificate.deleteMany(),
      Complaint.deleteMany()
    ]);

    // 1. Create Users (Admin, Organizers, Customers)
    const adminUser = await User.create({
      name: 'Dr. Vikram Mehta (Admin)',
      email: 'admin@eventify.com',
      password: 'Password@123',
      phone: '+91 98201 11223',
      role: 'admin',
      city: 'Mumbai',
      bio: 'System Administrator at EVENTIFY Smart Event Management Platform.'
    });

    const organizer1 = await User.create({
      name: 'Rohan Kapoor',
      email: 'organizer@eventify.com',
      password: 'Password@123',
      phone: '+91 98765 43210',
      role: 'organizer',
      city: 'Mumbai',
      bio: 'Founder & Lead Producer at NovaLive Concerts & Tech Summits.'
    });

    const organizer2 = await User.create({
      name: 'Priya Nair',
      email: 'priya.organizer@eventify.com',
      password: 'Password@123',
      phone: '+91 98111 22334',
      role: 'organizer',
      city: 'Bengaluru',
      bio: 'Director at Elevate India Conferences & Creative Workshops.'
    });

    const customer1 = await User.create({
      name: 'Aarav Sharma',
      email: 'customer@eventify.com',
      password: 'Password@123',
      phone: '+91 99887 76655',
      role: 'customer',
      city: 'Mumbai',
      interests: ['Technology & AI', 'Music & Concerts', 'Business & Startups'],
      bio: 'Final-year Computer Science enthusiast & live music lover.'
    });

    const customer2 = await User.create({
      name: 'Ananya Deshmukh',
      email: 'ananya@eventify.com',
      password: 'Password@123',
      phone: '+91 97654 32109',
      role: 'customer',
      city: 'Pune',
      interests: ['Workshops & Bootcamp', 'Cultural & Arts', 'Comedy & Theatre'],
      bio: 'UX Designer & avid workshop attendee.'
    });

    // 2. Create Organizer Profiles
    await Organizer.create([
      {
        user: organizer1._id,
        organizationName: 'NovaLive Entertainment & Tech',
        description: 'Premier organizer of international tech summits, music festivals, and arena concerts across India.',
        website: 'https://novalive.eventify.com',
        contactEmail: organizer1.email,
        contactPhone: organizer1.phone,
        address: 'Bandra Kurla Complex, Mumbai, Maharashtra',
        verificationStatus: 'verified',
        totalEventsHosted: 5,
        totalRevenue: 14850,
        rating: 4.9
      },
      {
        user: organizer2._id,
        organizationName: 'Elevate India Summits',
        description: 'Curating high-impact developer bootcamps, startup pitch days, and cultural showcases.',
        website: 'https://elevate.eventify.com',
        contactEmail: organizer2.email,
        contactPhone: organizer2.phone,
        address: 'Indiranagar, Bengaluru, Karnataka',
        verificationStatus: 'verified',
        totalEventsHosted: 3,
        totalRevenue: 6200,
        rating: 4.8
      }
    ]);

    // 3. Create Categories
    const categoriesData = [
      {
        name: 'Technology & AI',
        slug: 'technology-ai',
        icon: 'fa-microchip',
        color: '#6C3CE9',
        description: 'AI summits, cloud conferences, hackathons, and developer meetups.'
      },
      {
        name: 'Music & Concerts',
        slug: 'music-concerts',
        icon: 'fa-music',
        color: '#EC4899',
        description: 'Live arena concerts, EDM nights, indie gigs, and symphony performances.'
      },
      {
        name: 'Business & Startups',
        slug: 'business-startups',
        icon: 'fa-briefcase',
        color: '#2563EB',
        description: 'Founder conclaves, venture capital pitch days, and leadership forums.'
      },
      {
        name: 'Workshops & Bootcamp',
        slug: 'workshops-bootcamp',
        icon: 'fa-laptop-code',
        color: '#10B981',
        description: 'Hands-on masterclasses, UI/UX design sprints, and certified bootcamps.'
      },
      {
        name: 'Comedy & Theatre',
        slug: 'comedy-theatre',
        icon: 'fa-masks-theater',
        color: '#F59E0B',
        description: 'Stand-up comedy specials, improv nights, and dramatic stage plays.'
      },
      {
        name: 'Cultural & College Fest',
        slug: 'cultural-college-fest',
        icon: 'fa-graduation-cap',
        color: '#8B5CF6',
        description: 'Inter-collegiate symposiums, cultural fiestas, and youth carnivals.'
      },
      {
        name: 'Sports & eSports',
        slug: 'sports-esports',
        icon: 'fa-trophy',
        color: '#EF4444',
        description: 'Gaming tournaments, marathon runs, and championship screenings.'
      }
    ];

    const createdCategories = await Category.insertMany(categoriesData);
    const catMap = {};
    createdCategories.forEach((c) => {
      catMap[c.name] = c;
    });

    // Helper for future dates relative to current clock
    const futureDate = (daysAhead) => {
      const d = new Date();
      d.setDate(d.getDate() + daysAhead);
      d.setHours(18, 0, 0, 0);
      return d;
    };

    // 4. Create Rich Events with Interactive Seat Maps
    const rawEvents = [
      {
        title: 'AI & NextGen Cloud Global Summit 2026',
        slug: 'ai-nextgen-cloud-global-summit-2026',
        shortDescription: 'India’s largest Generative AI, Full-Stack Engineering & Cloud Architecture conference with industry pioneers.',
        description:
          'Join over 500+ developers, researchers, and engineering leaders at the AI & NextGen Cloud Global Summit. Experience keynote sessions on Large Language Models, Autonomous Agents, Distributed Systems, and live hands-on coding labs. All attendees receive an official verified EVENTIFY Participation Certificate.',
        category: catMap['Technology & AI']._id,
        categoryName: 'Technology & AI',
        organizer: organizer1._id,
        organizerName: 'NovaLive Entertainment & Tech',
        poster: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80',
        date: futureDate(12),
        startTime: '09:30',
        endTime: '18:00',
        venue: 'Jio World Convention Centre',
        address: 'G Block, Bandra Kurla Complex, Bandra East',
        city: 'Mumbai',
        ticketPrice: 999,
        vipPrice: 2499,
        premiumPrice: 1499,
        rows: 6,
        cols: 10,
        tags: ['AI', 'Cloud', 'Tech Summit', 'Developers', 'Certificate'],
        isFeatured: true,
        isTrending: true,
        certificateEligible: true,
        approvalStatus: 'approved',
        averageRating: 4.9,
        reviewsCount: 2,
        speakersOrArtists: [
          { name: 'Dr. Siddharth Rao', role: 'VP of AI Research, TechCore', avatar: '' },
          { name: 'Meera Krishnan', role: 'Principal Cloud Architect', avatar: '' }
        ]
      },
      {
        title: 'Purple Pulse: Symphony & EDM Arena Night',
        slug: 'purple-pulse-symphony-edm-arena-night',
        shortDescription: 'An electrifying audiovisual concert blending live orchestral strings with progressive electronic beats.',
        description:
          'Experience an unforgettable night under laser canopies at Purple Pulse Arena Night! Featuring international DJs, a 20-piece electric string ensemble, immersive 3D stage mapping, and crystal-clear spatial sound. Choose your VIP front-row or Premium arena seats on our interactive seating chart.',
        category: catMap['Music & Concerts']._id,
        categoryName: 'Music & Concerts',
        organizer: organizer1._id,
        organizerName: 'NovaLive Entertainment & Tech',
        poster: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1000&q=80',
        date: futureDate(18),
        startTime: '19:00',
        endTime: '23:30',
        venue: 'DY Patil Arena Stadium',
        address: 'Sector 7, Nerul, Navi Mumbai',
        city: 'Mumbai',
        ticketPrice: 1299,
        vipPrice: 2999,
        premiumPrice: 1899,
        rows: 6,
        cols: 10,
        tags: ['Concert', 'EDM', 'Live Music', 'Festival'],
        isFeatured: true,
        isTrending: true,
        certificateEligible: false,
        approvalStatus: 'approved',
        averageRating: 4.8,
        reviewsCount: 1,
        speakersOrArtists: [
          { name: 'DJ KSHMR Tribute Collective', role: 'Headliner Act', avatar: '' },
          { name: 'Aria Strings', role: 'Electric Symphony', avatar: '' }
        ]
      },
      {
        title: 'Full-Stack Web & System Design Masterclass Bootcamp',
        slug: 'fullstack-web-system-design-masterclass',
        shortDescription: 'Intensive 1-day hands-on workshop on scalable Node.js microservices, MongoDB indexing, and UI engineering.',
        description:
          'Designed for Computer Science students, software engineers, and tech enthusiasts. Build and deploy a production-ready cloud architecture in 6 hours with live mentorship. Includes verifiable PDF Participation Certificate, architecture workbook, and networking lunch.',
        category: catMap['Workshops & Bootcamp']._id,
        categoryName: 'Workshops & Bootcamp',
        organizer: organizer2._id,
        organizerName: 'Elevate India Summits',
        poster: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1000&q=80',
        date: futureDate(8),
        startTime: '10:00',
        endTime: '17:00',
        venue: 'NIMHANS Convention & Tech Hub',
        address: 'Hosur Road, Lakkasandra',
        city: 'Bengaluru',
        ticketPrice: 499,
        vipPrice: 1199,
        premiumPrice: 799,
        rows: 5,
        cols: 10,
        tags: ['Bootcamp', 'Node.js', 'System Design', 'Workshop', 'Certificate'],
        isFeatured: true,
        isTrending: false,
        certificateEligible: true,
        approvalStatus: 'approved',
        averageRating: 4.9,
        reviewsCount: 1,
        speakersOrArtists: [
          { name: 'Karthik Subramanian', role: 'Staff Software Engineer', avatar: '' }
        ]
      },
      {
        title: 'Founders & Venture Capital Pitch Conclave',
        slug: 'founders-venture-capital-pitch-conclave',
        shortDescription: 'Where early-stage startup founders meet top angel investors, VCs, and product strategists.',
        description:
          'Watch 15 shortlisted startups pitch live to a panel of tier-1 venture capitalists. Gain insights into fundraising, zero-to-one product growth, and AI SaaS monetization. Network directly with founders and investors in the VIP lounge.',
        category: catMap['Business & Startups']._id,
        categoryName: 'Business & Startups',
        organizer: organizer2._id,
        organizerName: 'Elevate India Summits',
        poster: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1000&q=80',
        date: futureDate(25),
        startTime: '11:00',
        endTime: '18:30',
        venue: 'The Westin Grand Ballroom',
        address: 'Koregaon Park Annexe, Mundhwa',
        city: 'Pune',
        ticketPrice: 799,
        vipPrice: 1999,
        premiumPrice: 1299,
        rows: 6,
        cols: 8,
        tags: ['Startups', 'Networking', 'Business', 'Venture Capital'],
        isFeatured: false,
        isTrending: true,
        certificateEligible: true,
        approvalStatus: 'approved',
        averageRating: 4.7,
        reviewsCount: 0,
        speakersOrArtists: [
          { name: 'Nikhil Vora', role: 'Managing Partner, Horizon Ventures', avatar: '' }
        ]
      },
      {
        title: 'Laugh Out Loud: Stand-Up Comedy Gala',
        slug: 'laugh-out-loud-standup-comedy-gala',
        shortDescription: 'An evening of non-stop rib-tickling stand-up comedy featuring India’s sharpest observational comedians.',
        description:
          'Unwind this weekend with 2.5 hours of brand-new stand-up material covering college life, corporate chaos, tech startups, and modern relationships. Grab your seats early before the front rows sell out!',
        category: catMap['Comedy & Theatre']._id,
        categoryName: 'Comedy & Theatre',
        organizer: organizer1._id,
        organizerName: 'NovaLive Entertainment & Tech',
        poster: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=1000&q=80',
        date: futureDate(5),
        startTime: '20:00',
        endTime: '22:30',
        venue: 'St. Andrews Auditorium',
        address: 'St. Domnic Road, Bandra West',
        city: 'Mumbai',
        ticketPrice: 599,
        vipPrice: 1299,
        premiumPrice: 899,
        rows: 6,
        cols: 10,
        tags: ['Comedy', 'Standup', 'Weekend', 'Live Show'],
        isFeatured: false,
        isTrending: true,
        certificateEligible: false,
        approvalStatus: 'approved',
        averageRating: 4.8,
        reviewsCount: 0,
        speakersOrArtists: [
          { name: 'Rohan Joshi & Friends', role: 'Stand-up Headliners', avatar: '' }
        ]
      },
      {
        title: 'TECHNOVA 2026: National Inter-Collegiate CS Fest',
        slug: 'technova-2026-national-cs-fest',
        shortDescription: 'National-level B.Sc. Computer Science hackathon, coding championship, robotics expo, and cultural night.',
        description:
          'TECHNOVA 2026 brings together the brightest college minds for a 24-hour hackathon, algorithmic coding battles, UI/UX design-a-thon, and pronites. Every registered participant receives an official verifiable digital certificate.',
        category: catMap['Cultural & College Fest']._id,
        categoryName: 'Cultural & College Fest',
        organizer: organizer2._id,
        organizerName: 'Elevate India Summits',
        poster: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1000&q=80',
        date: futureDate(32),
        startTime: '09:00',
        endTime: '20:00',
        venue: 'University Grand Convocation Hall',
        address: 'Kalina Campus, Santacruz East',
        city: 'Mumbai',
        ticketPrice: 299,
        vipPrice: 699,
        premiumPrice: 499,
        rows: 6,
        cols: 10,
        tags: ['College Fest', 'Hackathon', 'Computer Science', 'Certificate'],
        isFeatured: true,
        isTrending: true,
        certificateEligible: true,
        approvalStatus: 'approved',
        averageRating: 4.9,
        reviewsCount: 0,
        speakersOrArtists: []
      },
      {
        title: 'Valorant & BGMI Pro Arena Championship Finals',
        slug: 'valorant-bgmi-pro-arena-finals',
        shortDescription: 'Watch the top 8 national eSports rosters battle live on stage for the ₹25 Lakh championship trophy.',
        description:
          'Experience the roar of the crowd at the Pro Arena eSports Finals! Giant LED battle screens, live shoutcasters, creator meet-and-greets, and gaming merchandise giveaways.',
        category: catMap['Sports & eSports']._id,
        categoryName: 'Sports & eSports',
        organizer: organizer1._id,
        organizerName: 'NovaLive Entertainment & Tech',
        poster: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1000&q=80',
        date: futureDate(40),
        startTime: '14:00',
        endTime: '21:00',
        venue: 'Hitex Indoor Arena',
        address: 'Izzathnagar, Madhapur',
        city: 'Hyderabad',
        ticketPrice: 699,
        vipPrice: 1599,
        premiumPrice: 999,
        rows: 6,
        cols: 10,
        tags: ['eSports', 'Gaming', 'Tournament', 'Valorant'],
        isFeatured: false,
        isTrending: false,
        certificateEligible: true,
        approvalStatus: 'approved',
        averageRating: 4.6,
        reviewsCount: 0,
        speakersOrArtists: []
      },
      {
        title: 'Web3 & Cybersecurity Summit Delhi (Pending Admin Approval)',
        slug: 'web3-cybersecurity-summit-delhi',
        shortDescription: 'Zero-trust security, ethical hacking live demos, and enterprise blockchain governance.',
        description:
          'An upcoming conference awaiting final administrator approval, showcasing live penetration testing labs and smart contract auditing workshops.',
        category: catMap['Technology & AI']._id,
        categoryName: 'Technology & AI',
        organizer: organizer1._id,
        organizerName: 'NovaLive Entertainment & Tech',
        poster: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1000&q=80',
        date: futureDate(45),
        startTime: '10:00',
        endTime: '17:30',
        venue: 'Bharat Mandapam Pragati Maidan',
        address: 'Mathura Road, New Delhi',
        city: 'Delhi',
        ticketPrice: 899,
        vipPrice: 1999,
        premiumPrice: 1399,
        rows: 5,
        cols: 10,
        tags: ['Cybersecurity', 'Ethical Hacking', 'Tech'],
        isFeatured: false,
        isTrending: false,
        certificateEligible: true,
        approvalStatus: 'pending',
        averageRating: 4.5,
        reviewsCount: 0,
        speakersOrArtists: []
      }
    ];

    const createdEvents = [];
    for (const evData of rawEvents) {
      const seats = Event.generateSeats(evData.rows, evData.cols, evData.ticketPrice, evData.vipPrice, evData.premiumPrice);
      const ev = await Event.create({
        ...evData,
        capacity: seats.length,
        availableSeats: seats.length,
        seatLayout: {
          rows: evData.rows,
          cols: evData.cols,
          seats
        }
      });
      createdEvents.push(ev);
    }

    // 5. Create Sample Confirmed Bookings, Payments, Smart QR Tickets & Certificates
    const createSampleConfirmedBooking = async (user, event, seatCodes, checkIn = false) => {
      const selectedSeats = [];
      let subTotal = 0;

      event.seatLayout.seats.forEach((s) => {
        if (seatCodes.includes(s.seatNumber)) {
          s.status = 'booked';
          s.bookedBy = user._id;
          selectedSeats.push({
            seatNumber: s.seatNumber,
            row: s.row,
            tier: s.tier,
            price: s.price
          });
          subTotal += s.price;
        }
      });

      const taxAmount = Math.round(subTotal * 0.05);
      const totalAmount = subTotal + taxAmount;
      const bookingReference =
        'EVB-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

      const booking = await Booking.create({
        bookingReference,
        user: user._id,
        event: event._id,
        selectedSeats,
        quantity: selectedSeats.length,
        subTotal,
        taxAmount,
        totalAmount,
        attendeeName: user.name,
        attendeeEmail: user.email,
        attendeePhone: user.phone,
        paymentStatus: 'completed',
        bookingStatus: 'confirmed'
      });

      const orderId = 'order_test_' + crypto.randomBytes(6).toString('hex');
      const paymentId = 'pay_test_' + crypto.randomBytes(6).toString('hex');
      const secret = process.env.RAZORPAY_KEY_SECRET || process.env.JWT_SECRET || 'eventify_default_secret';
      const sig = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

      const payment = await Payment.create({
        booking: booking._id,
        user: user._id,
        event: event._id,
        amount: totalAmount,
        currency: 'INR',
        provider: 'razorpay_test_sandbox',
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: sig,
        paymentMethod: 'upi',
        status: 'captured'
      });

      const ticketCode =
        'EVT-' +
        crypto.randomBytes(3).toString('hex').toUpperCase() +
        '-' +
        Math.floor(1000 + Math.random() * 9000);

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
        color: { dark: '#2D1674', light: '#FFFFFF' }
      });

      const ticket = await Ticket.create({
        ticketCode,
        booking: booking._id,
        user: user._id,
        event: event._id,
        seats: seatCodes,
        qrCodeDataUrl,
        qrPayloadHash,
        checkInStatus: checkIn ? 'checked_in' : 'unused',
        checkedInAt: checkIn ? new Date() : null,
        checkedInBy: checkIn ? organizer1._id : null
      });

      booking.paymentId = payment._id;
      booking.ticketId = ticket._id;
      await booking.save();

      event.availableSeats = event.seatLayout.seats.filter((s) => s.status === 'available').length;
      event.bookingsCount = (event.bookingsCount || 0) + selectedSeats.length;
      await event.save();

      if (event.certificateEligible) {
        await Certificate.create({
          certificateNumber: 'EVCERT-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
          user: user._id,
          event: event._id,
          booking: booking._id,
          participantName: user.name,
          eventTitle: event.title,
          eventDate: event.date,
          organizerName: event.organizerName
        });
      }

      return { booking, ticket, payment };
    };

    const sampleBooking1 = await createSampleConfirmedBooking(customer1, createdEvents[0], ['A1', 'A2'], false);
    const sampleBooking2 = await createSampleConfirmedBooking(customer1, createdEvents[2], ['B3'], true);
    const sampleBooking3 = await createSampleConfirmedBooking(customer2, createdEvents[1], ['A5', 'A6'], false);

    // 6. Create Reviews
    await Review.create([
      {
        event: createdEvents[0]._id,
        user: customer1._id,
        rating: 5,
        title: 'Best AI & Cloud conference in India!',
        comment: 'Incredible speaker lineup, seamless QR ticket check-in, and the interactive seat selection made booking front-row VIP seats effortless.',
        isVerifiedAttendee: true,
        status: 'approved'
      },
      {
        event: createdEvents[0]._id,
        user: customer2._id,
        rating: 5,
        title: 'Superb organization & instant certificate',
        comment: 'Loved the hands-on LLM architecture sessions and getting an automatic PDF certificate right from my dashboard.',
        isVerifiedAttendee: true,
        status: 'approved'
      },
      {
        event: createdEvents[1]._id,
        user: customer2._id,
        rating: 5,
        title: 'Electrifying production quality!',
        comment: 'The sound and laser production at DY Patil Arena were world-class.',
        isVerifiedAttendee: true,
        status: 'approved'
      },
      {
        event: createdEvents[2]._id,
        user: customer1._id,
        rating: 5,
        title: 'Must-attend for CS students',
        comment: 'Learned practical MongoDB atomic transactions and system design patterns.',
        isVerifiedAttendee: true,
        status: 'approved'
      }
    ]);

    // 7. Create Wishlist Items
    await Wishlist.create([
      { user: customer1._id, event: createdEvents[1]._id },
      { user: customer1._id, event: createdEvents[5]._id }
    ]);

    // 8. Create Notifications
    await Notification.create([
      {
        user: customer1._id,
        title: 'Smart QR Ticket Ready!',
        message: `Your booking (${sampleBooking1.booking.bookingReference}) for "${createdEvents[0].title}" is confirmed. Ticket Code: ${sampleBooking1.ticket.ticketCode}`,
        type: 'booking',
        link: `/ticket.html?id=${sampleBooking1.ticket._id}`
      },
      {
        user: customer1._id,
        title: 'Certificate Issued!',
        message: `Your participation certificate for "${createdEvents[2].title}" is ready for PDF download.`,
        type: 'event_update',
        link: `/my-bookings.html`
      },
      {
        user: organizer1._id,
        title: 'New VIP Booking Received',
        message: `Aarav Sharma booked 2 VIP seats (A1, A2) for "${createdEvents[0].title}".`,
        type: 'organizer',
        link: `/organizer/manage-bookings.html`
      },
      {
        user: adminUser._id,
        title: '1 Event Pending Approval',
        message: `"${createdEvents[7].title}" submitted by NovaLive Entertainment is awaiting admin review.`,
        type: 'system',
        link: `/admin/events.html`
      }
    ]);

    // 9. Create Sample Support Inquiry / Complaint
    await Complaint.create({
      user: customer2._id,
      name: customer2.name,
      email: customer2.email,
      subject: 'Group Booking Discount Inquiry for College Students',
      message: 'Hi EVENTIFY team, we have a batch of 15 B.Sc. Computer Science students interested in attending the AI Global Summit. Can we avail a group discount?',
      category: 'general',
      status: 'open'
    });

    console.log('[Seeder] Seed completed! Demo credentials:');
    console.log('  -> Customer : customer@eventify.com  | Password@123');
    console.log('  -> Organizer: organizer@eventify.com | Password@123');
    console.log('  -> Admin    : admin@eventify.com     | Password@123');
    console.log(`  -> Sample QR Ticket Code for Scanner Test: ${sampleBooking1.ticket.ticketCode}`);

    if (closeAfter) process.exit(0);
  } catch (error) {
    console.error('[Seeder] Error seeding database:', error);
    if (closeAfter) process.exit(1);
  }
};

if (require.main === module) {
  connectDB().then(() => seedDatabase(true));
}

module.exports = seedDatabase;

