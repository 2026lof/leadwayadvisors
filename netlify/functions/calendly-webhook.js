// Receives Calendly webhooks (invitee.created / invitee.canceled) and forwards
// them to Telegram. Needs TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID and
// CALENDLY_SIGNING_KEY. Requests without a valid signature are rejected.
const crypto = require('crypto');

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('Telegram not configured; skipping notification.');
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
  });
  if (!res.ok) console.error('Telegram error', res.status, await res.text());
}

function validSignature(header, body, key) {
  const parts = Object.fromEntries(String(header || '').split(',').map((p) => p.trim().split('=')));
  if (!parts.t || !parts.v1) return false;
  // Reject anything older than five minutes to limit replays.
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac('sha256', key).update(`${parts.t}.${body}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function when(iso, timeZone) {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone, timeZoneName: 'short',
  }).format(new Date(iso));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const key = process.env.CALENDLY_SIGNING_KEY;
  if (!key) return { statusCode: 503, body: 'Not configured' };

  const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const signature = event.headers['calendly-webhook-signature'] || event.headers['Calendly-Webhook-Signature'];
  if (!validSignature(signature, body, key)) return { statusCode: 401, body: 'Invalid signature' };

  try {
    const msg = JSON.parse(body);
    const p = msg.payload || {};
    const ev = p.scheduled_event || {};
    const canceled = msg.event === 'invitee.canceled';
    const lines = [
      canceled ? '❌ Consultation cancelled (Leadway Advisors)' : '📅 New consultation booked (Leadway Advisors)',
      '',
      `Name: ${p.name || '-'}`,
      `Email: ${p.email || '-'}`,
      `Meeting: ${ev.name || '-'}`,
      `When: ${when(ev.start_time, 'America/New_York')}`,
    ];
    if (p.timezone) lines.push(`Their time: ${when(ev.start_time, p.timezone)}`);
    if (canceled && p.cancellation && p.cancellation.reason) lines.push(`Reason: ${p.cancellation.reason}`);
    (p.questions_and_answers || []).forEach((q) => {
      if (q.answer) lines.push('', `${q.question}`, `${q.answer}`);
    });
    await sendTelegram(lines.join('\n'));
  } catch (err) {
    console.error('calendly-webhook failed', err);
  }
  return { statusCode: 200, body: 'ok' };
};
