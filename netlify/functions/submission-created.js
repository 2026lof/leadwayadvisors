// Runs automatically whenever a Netlify form on this site receives a submission.
// Sends the enquiry to Telegram. Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.

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

exports.handler = async (event) => {
  try {
    const payload = (JSON.parse(event.body || '{}').payload) || {};
    const d = payload.data || {};
    const lines = [
      '📩 New website enquiry (Leadway Advisors)',
      '',
      `Name: ${d.name || '-'}`,
      `Email: ${d.email || '-'}`,
      `Phone: ${d.phone || '-'}`,
      `Type: ${d['client-type'] || '-'}`,
      '',
      d.message || '(no message)',
    ];
    await sendTelegram(lines.join('\n'));
  } catch (err) {
    console.error('submission-created failed', err);
  }
  return { statusCode: 200, body: 'ok' };
};
