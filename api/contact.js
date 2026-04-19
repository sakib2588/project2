import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const SERVICE_LABELS = {
  website:  'Website Design',
  profiles: 'Business Profiles',
  seo:      'SEO',
  social:   'Social Media Marketing',
  ecom:     'E-Commerce Solutions',
  ads:      'Paid Ads Management',
  bundle:   'Full Bundle',
  '':       'Not specified',
};

const VALID_SERVICES = Object.keys(SERVICE_LABELS);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, phone, service, message, website } = req.body || {};

  // Honeypot: bots fill hidden fields, real users don't
  if (website) return res.status(200).json({ success: true, message: 'Message received!' });

  const cleanName    = sanitize(name, 200);
  const cleanEmail   = sanitize(email, 320);

  if (!cleanName)                                return res.status(400).json({ error: 'Name is required' });
  if (!cleanEmail || !isValidEmail(cleanEmail))  return res.status(400).json({ error: 'A valid email is required' });

  const cleanPhone   = sanitize(phone, 30);
  const cleanService = VALID_SERVICES.includes(service) ? service : '';
  const cleanMessage = sanitize(message, 2000);
  const serviceLabel = SERVICE_LABELS[cleanService] || 'Not specified';

  // Save to database
  const { error: dbError } = await supabase.from('leads').insert({
    name:    cleanName,
    email:   cleanEmail,
    phone:   cleanPhone   || null,
    service: cleanService || null,
    message: cleanMessage || null,
  });

  if (dbError) {
    console.error('Supabase insert error:', dbError);
    return res.status(500).json({ error: 'Failed to save your message. Please try again.' });
  }

  // Send email notifications (non-blocking — don't fail the request if email fails)
  const toEmail = process.env.TO_EMAIL || 'hello@nexoradigital.com';
  const fromEmail = process.env.FROM_EMAIL || 'leads@nexoradigital.com';

  try {
    await Promise.all([
      // Alert to business owner
      resend.emails.send({
        from: `Nexora Digital <${fromEmail}>`,
        to:   toEmail,
        subject: `New Lead: ${cleanName} — ${serviceLabel}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#141516;color:#fff;border-radius:12px;overflow:hidden">
            <div style="background:#eeb75d;padding:24px 32px">
              <h1 style="margin:0;color:#141516;font-size:20px;font-weight:700">New Lead from Nexora Digital</h1>
            </div>
            <div style="padding:32px">
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:10px 0;color:rgba(255,255,255,.5);font-size:14px;width:120px">Name</td><td style="padding:10px 0;color:#fff;font-size:14px"><strong>${cleanName}</strong></td></tr>
                <tr><td style="padding:10px 0;color:rgba(255,255,255,.5);font-size:14px">Email</td><td style="padding:10px 0;font-size:14px"><a href="mailto:${cleanEmail}" style="color:#eeb75d">${cleanEmail}</a></td></tr>
                ${cleanPhone ? `<tr><td style="padding:10px 0;color:rgba(255,255,255,.5);font-size:14px">Phone</td><td style="padding:10px 0;color:#fff;font-size:14px"><a href="tel:${cleanPhone}" style="color:#eeb75d">${cleanPhone}</a></td></tr>` : ''}
                <tr><td style="padding:10px 0;color:rgba(255,255,255,.5);font-size:14px">Service</td><td style="padding:10px 0;color:#fff;font-size:14px">${serviceLabel}</td></tr>
                ${cleanMessage ? `<tr><td style="padding:10px 0;color:rgba(255,255,255,.5);font-size:14px;vertical-align:top">Message</td><td style="padding:10px 0;color:#fff;font-size:14px;line-height:1.6">${cleanMessage}</td></tr>` : ''}
              </table>
              <div style="margin-top:24px">
                <a href="mailto:${cleanEmail}" style="display:inline-block;background:#eeb75d;color:#141516;padding:12px 24px;border-radius:6px;font-weight:700;font-size:14px;text-decoration:none">Reply to ${cleanName} →</a>
              </div>
            </div>
          </div>
        `,
      }),

      // Confirmation to the lead
      resend.emails.send({
        from: `Nexora Digital <${fromEmail}>`,
        to:   cleanEmail,
        subject: `We got your message, ${cleanName.split(' ')[0]}!`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#141516;color:#fff;border-radius:12px;overflow:hidden">
            <div style="background:#eeb75d;padding:24px 32px">
              <h1 style="margin:0;color:#141516;font-size:20px;font-weight:700">Nexora Digital</h1>
            </div>
            <div style="padding:32px">
              <h2 style="margin:0 0 16px;font-size:22px">Hey ${cleanName.split(' ')[0]}, we got your message!</h2>
              <p style="color:rgba(255,255,255,.7);line-height:1.7;margin:0 0 16px">Thanks for reaching out about <strong style="color:#eeb75d">${serviceLabel}</strong>. Our team will review your request and get back to you within <strong>2 business hours</strong>.</p>
              <p style="color:rgba(255,255,255,.7);line-height:1.7;margin:0 0 32px">In the meantime, feel free to call us directly at <a href="tel:+13109551077" style="color:#eeb75d">(310) 955-1077</a>.</p>
              <a href="https://nexoradigital.com" style="display:inline-block;background:#eeb75d;color:#141516;padding:12px 24px;border-radius:6px;font-weight:700;font-size:14px;text-decoration:none">Visit Our Website →</a>
            </div>
            <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,.06)">
              <p style="margin:0;color:rgba(255,255,255,.3);font-size:12px">&copy; 2026 Nexora Digital LLC. United States.</p>
            </div>
          </div>
        `,
      }),
    ]);
  } catch (emailErr) {
    console.error('Email send error:', emailErr);
    // Don't return error — lead is already saved to DB
  }

  return res.status(200).json({ success: true, message: 'Message received!' });
}
