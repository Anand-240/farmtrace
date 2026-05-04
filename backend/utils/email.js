'use strict';

const { Resend } = require('resend');
const logger = require('./logger').child({ module: 'email' });

const getClient = () => {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
};

const mailFrom = () => process.env.MAIL_FROM || 'FarmTrace <onboarding@resend.dev>';

// In testing mode all emails are redirected to EMAIL_TEST_OVERRIDE
const resolveTo = (to) => process.env.EMAIL_TEST_OVERRIDE || to;

async function sendMail({ to, subject, html }) {
  if (!to) return;
  const client = getClient();
  if (!client) {
    logger.warn({ to, subject }, 'RESEND_API_KEY not set — skipping email');
    return;
  }
  const resolvedTo = resolveTo(to);
  try {
    const { error } = await client.emails.send({ from: mailFrom(), to: resolvedTo, subject, html });
    if (error) {
      logger.error({ error, to: resolvedTo, subject }, 'Resend send failed');
    } else {
      logger.info({ to: resolvedTo, originalTo: to, subject }, 'Email sent via Resend');
    }
  } catch (err) {
    logger.error({ err, to: resolvedTo, subject }, 'Resend error');
  }
}

const shell = (body) => `
<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2f26;max-width:600px;margin:0 auto;">
  <div style="background:#27500A;padding:16px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;font-size:18px;">FarmTrace</h2>
  </div>
  <div style="padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
    ${body}
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
    <p style="color:#999;font-size:12px;margin:0;">FarmTrace — Kisan se Bazaar, Bharose ke Saath</p>
  </div>
</div>`;

const row = (label, value, shaded) =>
  `<tr${shaded ? ' style="background:#f5f5f5;"' : ''}><td style="padding:8px;color:#555;">${label}</td><td style="padding:8px;font-weight:bold;">${value}</td></tr>`;

const emailTemplates = {
  transferRequest({ recipientName, senderName, cropType, pricePerKg, location }) {
    return {
      subject: `FarmTrace: ${senderName} ne ${cropType} transfer request bheji`,
      html: shell(`
        <p>Namaste <strong>${recipientName}</strong>,</p>
        <p><strong>${senderName}</strong> ne aapko <strong>${cropType}</strong> khareedne ki request bheji hai.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          ${row('Fasal', cropType, true)}
          ${row('Daam', `&#8377;${pricePerKg}/kg`, false)}
          ${row('Jagah', location || '—', true)}
        </table>
        <p>FarmTrace app par login karke request <strong>accept ya reject</strong> karo.</p>`)
    };
  },

  transferReceived({ recipientName, senderName, cropType, pricePerKg, location }) {
    return {
      subject: `FarmTrace: ${senderName} ne ${cropType} transfer kiya`,
      html: shell(`
        <p>Namaste <strong>${recipientName}</strong>,</p>
        <p><strong>${senderName}</strong> ne aapko <strong>${cropType}</strong> transfer kiya hai.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          ${row('Fasal', cropType, true)}
          ${row('Daam', `&#8377;${pricePerKg}/kg`, false)}
          ${row('Jagah', location, true)}
        </table>
        <p>FarmTrace app par login karke apna produce dekho.</p>`)
    };
  },

  bookingConfirmed({ recipientName, cropType, bookingAmount, dispatchAmount }) {
    return {
      subject: 'FarmTrace: Booking Payment Received!',
      html: shell(`
        <p>Namaste <strong>${recipientName}</strong>,</p>
        <p><strong>${cropType}</strong> ke liye <strong style="color:#27500A;">&#8377;${bookingAmount.toLocaleString()}</strong> booking payment aa gayi!</p>
        ${dispatchAmount > 0 ? `<p>Dispatch ke baad <strong>&#8377;${dispatchAmount.toLocaleString()}</strong> aur milega.</p>` : ''}
        <p>FarmTrace app par apna escrow track karo.</p>`)
    };
  },

  orderConfirmed({ recipientName, cropType, milestones, totalAmount }) {
    return {
      subject: 'FarmTrace: Order Confirm Ho Gaya!',
      html: shell(`
        <p>Namaste <strong>${recipientName}</strong>,</p>
        <p><strong>${cropType}</strong> ke liye payment confirm ho gayi. Milestone breakdown:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          ${row('Booking (abhi)', `&#8377;${milestones.booking.toLocaleString()}`, true)}
          ${row('Dispatch par', `&#8377;${milestones.dispatch.toLocaleString()}`, false)}
          ${row('Delivery par', `&#8377;${milestones.delivery.toLocaleString()}`, true)}
          <tr style="border-top:2px solid #27500A;"><td style="padding:8px;font-weight:bold;">Total</td><td style="padding:8px;font-weight:bold;color:#27500A;">&#8377;${totalAmount.toLocaleString()}</td></tr>
        </table>
        <p>FarmTrace app par delivery track karo.</p>`)
    };
  },

  deliveryUpdate({ recipientName, cropType, status, location }) {
    return {
      subject: `FarmTrace: ${cropType} Delivery — ${status}`,
      html: shell(`
        <p>Namaste <strong>${recipientName}</strong>,</p>
        <p><strong>${cropType}</strong> delivery update:</p>
        <p style="font-size:16px;font-weight:bold;color:#27500A;">${status}${location ? ` — ${location}` : ''}</p>
        <p>FarmTrace app par real-time track karo.</p>`)
    };
  },

  refundRequested({ farmerName, buyerPhone, cropType, refundAmount, reason }) {
    return {
      subject: `FarmTrace: Refund Request — ${cropType}`,
      html: shell(`
        <p>Namaste <strong>${farmerName}</strong>,</p>
        <p><strong>${buyerPhone}</strong> ne <strong>${cropType}</strong> delivery reject kar di hai.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          ${row('Fasal', cropType, true)}
          ${row('Refund Amount', `&#8377;${refundAmount.toLocaleString()}`, false)}
          ${row('Reason', reason || '—', true)}
        </table>
        <p>FarmTrace app par apna escrow status dekho.</p>`)
    };
  }
};

module.exports = { sendMail, emailTemplates };
