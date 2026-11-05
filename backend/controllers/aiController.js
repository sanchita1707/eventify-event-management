const Event = require('../models/Event');
const Category = require('../models/Category');
const Booking = require('../models/Booking');

/**
 * Helper: Find relevant events from live MongoDB records based on user query
 */
const matchEventsFromQuery = (qLower, events) => {
  let matched = [...events];

  // Filter by city if mentioned
  const cities = ['mumbai', 'bengaluru', 'bangalore', 'pune', 'delhi', 'hyderabad', 'chennai', 'kolkata'];
  const mentionedCity = cities.find((c) => qLower.includes(c));
  if (mentionedCity) {
    const normalizedCity = mentionedCity === 'bangalore' ? 'bengaluru' : mentionedCity;
    const cityMatches = matched.filter((e) => (e.city || '').toLowerCase().includes(normalizedCity));
    if (cityMatches.length > 0) matched = cityMatches;
  }

  // Filter by category / topic keywords
  const topicKeywords = [
    { keys: ['tech', 'ai', 'cloud', 'developer', 'coding', 'hackathon', 'software'], cat: 'technology' },
    { keys: ['music', 'concert', 'live band', 'dj', 'festival', 'acoustic', 'arijit', 'symphony'], cat: 'music' },
    { keys: ['business', 'startup', 'founder', 'entrepreneur', 'investor', 'summit'], cat: 'business' },
    { keys: ['workshop', 'bootcamp', 'training', 'masterclass', 'hands-on', 'design'], cat: 'workshop' },
    { keys: ['comedy', 'standup', 'stand-up', 'laugh', 'humor'], cat: 'comedy' },
    { keys: ['sport', 'marathon', 'cricket', 'football', 'fitness', 'tournament'], cat: 'sport' }
  ];

  for (const group of topicKeywords) {
    if (group.keys.some((k) => qLower.includes(k))) {
      const catMatches = matched.filter(
        (e) =>
          (e.categoryName || '').toLowerCase().includes(group.cat) ||
          (e.title || '').toLowerCase().includes(group.cat) ||
          (e.tags || []).some((t) => t.toLowerCase().includes(group.cat))
      );
      if (catMatches.length > 0) {
        matched = catMatches;
        break;
      }
    }
  }

  // Filter by price budget (e.g. "under 1000", "below 800", "less than 1500")
  const budgetMatch = qLower.match(/(?:under|below|less than|max|within)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i);
  if (budgetMatch) {
    const maxBudget = Number(budgetMatch[1]);
    const budgetEvents = matched.filter((e) => Number(e.ticketPrice) <= maxBudget);
    if (budgetEvents.length > 0) matched = budgetEvents;
  }

  if (qLower.includes('free')) {
    const freeEvents = matched.filter((e) => Number(e.ticketPrice) === 0);
    if (freeEvents.length > 0) matched = freeEvents;
  }

  if (qLower.includes('cheap') || qLower.includes('lowest price') || qLower.includes('budget')) {
    matched.sort((a, b) => a.ticketPrice - b.ticketPrice);
  } else if (qLower.includes('popular') || qLower.includes('trending') || qLower.includes('top') || qLower.includes('best')) {
    matched.sort((a, b) => (b.bookingsCount || 0) - (a.bookingsCount || 0));
  }

  return matched.slice(0, 3);
};

// @desc    Eventify AI Chat Assistant (OpenAI API + Live MongoDB Grounding + Privacy Protection)
// @route   POST /api/ai/chat
// @access  Public / Optional Auth
exports.chatWithAI = async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a message for the Eventify AI Assistant.'
      });
    }

    const cleanMessage = message.trim().slice(0, 800);
    const qLower = cleanMessage.toLowerCase();

    // 1. Strict Privacy Guard: Never expose other users' private bookings, emails, phones, or admin data
    const privacyProbePatterns = [
      /other\s+user/i,
      /all\s+user.*email/i,
      /customer.*phone/i,
      /someone\s+else.*booking/i,
      /admin\s+password/i,
      /jwt[_\s]?secret/i,
      /database\s+dump/i,
      /all\s+bookings\s+in\s+database/i
    ];

    if (privacyProbePatterns.some((pat) => pat.test(cleanMessage))) {
      return res.status(200).json({
        success: true,
        source: 'privacy_guard',
        reply:
          '🔒 **Privacy & Security Policy:** I can only share public event information and—when you are signed in—your own personal bookings and QR tickets. Private customer data, other attendees’ bookings, and system credentials are strictly protected.',
        suggestedEvents: []
      });
    }

    // 2. Fetch live approved & published events and categories from MongoDB
    const [events, categories] = await Promise.all([
      Event.find({
        approvalStatus: 'approved',
        isPublished: { $ne: false },
        isDraft: { $ne: true },
        status: { $nin: ['cancelled', 'draft'] }
      })
        .select(
          'title categoryName date startTime endTime venue city ticketPrice vipPrice premiumPrice availableSeats capacity averageRating bookingsCount isFeatured isTrending certificateEligible tags'
        )
        .sort({ date: 1 })
        .limit(25),
      Category.find({ isActive: true }).select('name description')
    ]);

    // 3. Fetch ONLY the authenticated user's own bookings (if logged in)
    let userBookings = [];
    if (req.user) {
      userBookings = await Booking.find({ user: req.user._id })
        .populate('event', 'title date startTime venue city')
        .populate('ticketId', 'ticketCode checkInStatus')
        .select('bookingReference quantity totalAmount bookingStatus paymentStatus selectedSeats event ticketId createdAt')
        .sort({ createdAt: -1 })
        .limit(5);
    }

    const matchedEvents = matchEventsFromQuery(qLower, events);

    // 4. If OpenAI API Key is configured in .env, call OpenAI Chat Completions grounded with MongoDB context
    const openAiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : '';
    if (openAiKey && !openAiKey.includes('your_openai_api_key')) {
      try {
        const eventsCatalogText = events
          .map(
            (e) =>
              `- [${e.title}](/event-details.html?id=${e._id}) | Category: ${e.categoryName} | City: ${e.city} | Venue: ${e.venue} | Date: ${new Date(
                e.date
              ).toDateString()} (${e.startTime}) | Standard: ₹${e.ticketPrice}, Premium: ₹${
                e.premiumPrice || Math.round(e.ticketPrice * 1.5)
              }, VIP: ₹${e.vipPrice || e.ticketPrice * 2} | Available Seats: ${e.availableSeats}/${
                e.capacity
              } | Certificate: ${e.certificateEligible ? 'Yes' : 'No'}`
          )
          .join('\n');

        const userContextText = req.user
          ? `Authenticated User: ${req.user.name} (Role: ${req.user.role}).\nUser's Own Bookings (${userBookings.length}):\n` +
            (userBookings.length > 0
              ? userBookings
                  .map(
                    (b) =>
                      `- Ref: ${b.bookingReference} | Event: ${b.event ? b.event.title : 'Event'} | Seats: ${(
                        b.selectedSeats || []
                      )
                        .map((s) => s.seatNumber)
                        .join(', ')} | Total: ₹${b.totalAmount} | Status: ${b.bookingStatus} | Ticket Code: ${
                        b.ticketId ? b.ticketId.ticketCode : 'Pending'
                      }`
                  )
                  .join('\n')
              : 'No bookings made yet.')
          : 'User is currently browsing as an unauthenticated guest.';

        const systemPrompt = `You are the official EVENTIFY Smart AI Assistant for EVENTIFY – Smart Event Management and Online Booking System.
Always answer concisely, warmly, and accurately using ONLY the live MongoDB event data provided below.
Never invent fake events, fake prices, or fake booking references.
Never reveal any other customer's private data.

LIVE APPROVED EVENTS IN MONGODB (${events.length}):
${eventsCatalogText}

CATEGORIES: ${categories.map((c) => c.name).join(', ')}

CURRENT USER CONTEXT:
${userContextText}`;

        const sanitizedHistory = Array.isArray(history)
          ? history
              .slice(-6)
              .filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
              .map((m) => ({ role: m.role, content: m.content.slice(0, 500) }))
          : [];

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              ...sanitizedHistory,
              { role: 'user', content: cleanMessage }
            ],
            temperature: 0.4,
            max_tokens: 350
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (openAiRes.ok) {
          const openAiJson = await openAiRes.json();
          const aiReply =
            openAiJson.choices &&
            openAiJson.choices[0] &&
            openAiJson.choices[0].message &&
            openAiJson.choices[0].message.content;

          if (aiReply) {
            return res.status(200).json({
              success: true,
              source: 'openai',
              reply: aiReply,
              suggestedEvents: matchedEvents
            });
          }
        }
      } catch (openAiErr) {
        console.warn('[Eventify AI] OpenAI fallback triggered:', openAiErr.message);
      }
    }

    // 5. Intelligent MongoDB-Grounded Assistant Engine (works offline / without external API key)
    let reply = '';

    // Case A: User asks about their own bookings or tickets
    if (
      qLower.includes('my booking') ||
      qLower.includes('my ticket') ||
      qLower.includes('my qr') ||
      qLower.includes('booking status') ||
      qLower.includes('booked event')
    ) {
      if (!req.user) {
        reply =
          '🔒 Please **sign in to your EVENTIFY account** to view your personal booking history, seat numbers, and Smart QR Tickets. You can log in at `/login.html` or open **My Bookings** once authenticated.';
      } else if (userBookings.length === 0) {
        reply = `Hi **${req.user.name}**! You don't have any bookings yet. Here are some top upcoming events you can book right now with interactive seat selection:`;
      } else {
        const listStr = userBookings
          .map((b) => {
            const seats = (b.selectedSeats || []).map((s) => s.seatNumber).join(', ');
            const tCode = b.ticketId ? b.ticketId.ticketCode : 'Pending Payment';
            return `• **${b.event ? b.event.title : 'Event'}** — Ref: \`${b.bookingReference}\` | Seats: **${seats}** | Paid: **₹${b.totalAmount}** | Ticket: \`${tCode}\` (${b.bookingStatus.toUpperCase()})`;
          })
          .join('\n');
        reply = `Hi **${req.user.name}**, here are your recent bookings from your account:\n\n${listStr}\n\nYou can view and download your Smart QR Tickets anytime from **My Bookings** (\`/my-bookings.html\`).`;
      }

      return res.status(200).json({
        success: true,
        source: 'mongodb_assistant',
        reply,
        suggestedEvents: userBookings.length === 0 ? matchedEvents : []
      });
    }

    // Case B: User asks how seat selection, pricing tiers, or QR tickets work
    if (qLower.includes('seat') || qLower.includes('vip') || qLower.includes('tier') || qLower.includes('lock')) {
      reply =
        '🪑 **EVENTIFY Interactive Seating System:**\n' +
        '• **Row A (VIP Tier):** Front-stage experience.\n' +
        '• **Rows B & C (Premium Tier):** Prime elevated view.\n' +
        '• **Rows D+ (Standard Tier):** Value arena seating.\n' +
        '• **Color Guide:** Green = Available, Purple = Selected by you, Red = Booked/Locked.\n' +
        '• Selected seats are temporarily locked for **10 minutes** during checkout to prevent simultaneous double booking!';
      return res.status(200).json({
        success: true,
        source: 'mongodb_assistant',
        reply,
        suggestedEvents: matchedEvents
      });
    }

    if (qLower.includes('certificate') || qLower.includes('pdf')) {
      const certEvents = events.filter((e) => e.certificateEligible).slice(0, 3);
      reply =
        '🏅 **Official Participation Certificates:**\n' +
        'Events marked with the **Certificate Included** badge automatically generate a verifiable PDF Participation Certificate once your booking is confirmed or checked in. Here are upcoming certificate-eligible events:';
      return res.status(200).json({
        success: true,
        source: 'mongodb_assistant',
        reply,
        suggestedEvents: certEvents
      });
    }

    if (qLower.includes('category') || qLower.includes('categories')) {
      const catNames = categories.map((c) => `**${c.name}**`).join(', ');
      reply = `📂 We currently host live events across ${categories.length} categories: ${catNames}.\n\nHere are some top upcoming events from our catalog:`;
      return res.status(200).json({
        success: true,
        source: 'mongodb_assistant',
        reply,
        suggestedEvents: matchedEvents
      });
    }

    // Case C: Event Discovery (City, Category, Price, Date, Featured, General Search)
    if (matchedEvents.length > 0) {
      const summaryLines = matchedEvents
        .map(
          (e) =>
            `• **${e.title}** (${e.categoryName}) — 📍 ${e.venue}, ${e.city} | 📅 ${new Date(
              e.date
            ).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} | 🎟️ From **₹${
              e.ticketPrice
            }** (${e.availableSeats} seats left)`
        )
        .join('\n');

      reply = `✨ Here are the best matching live events from our database (${events.length} total approved events available):\n\n${summaryLines}\n\nClick any event card below to view full details and select your seats!`;
    } else {
      reply =
        '👋 Welcome to **EVENTIFY AI Assistant**! I can help you find events by city, category, or budget, explain VIP/Premium seat tiers, or check your personal booking & QR ticket status.';
    }

    res.status(200).json({
      success: true,
      source: 'mongodb_assistant',
      reply,
      suggestedEvents: matchedEvents
    });
  } catch (error) {
    next(error);
  }
};

