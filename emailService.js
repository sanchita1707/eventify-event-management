const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(`[Email Service] SMTP credentials not configured. Logged email intended for ${to} | Subject: ${subject}`);
      return { sent: false, simulated: false, reason: 'SMTP not configured in .env' };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME || 'EVENTIFY'}" <${process.env.FROM_EMAIL || 'noreply@eventify.com'}>`,
      to,
      subject,
      text: text || subject,
      html
    });

    console.log(`[Email Service] Message sent: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email Service] Error sending email: ${error.message}`);
    return { sent: false, error: error.message };
  }
};

module.exports = { sendEmail };

