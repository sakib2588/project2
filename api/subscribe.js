import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const rawEmail = req.body?.email;
  const email    = typeof rawEmail === 'string' ? rawEmail.trim().slice(0, 320) : '';

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  const { error } = await supabase
    .from('subscribers')
    .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });

  if (error) {
    console.error('Supabase upsert error:', error);
    return res.status(500).json({ error: 'Subscription failed. Please try again.' });
  }

  return res.status(200).json({ success: true, message: 'You are subscribed!' });
}
