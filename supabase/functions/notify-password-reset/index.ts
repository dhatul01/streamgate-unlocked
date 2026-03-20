import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_API = 'https://api.telegram.org/bot';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { short_id, identifier, username } = await req.json();

    const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const ADMIN_CHAT_ID = Deno.env.get('ADMIN_TELEGRAM_CHAT_ID');
    if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
      return new Response(JSON.stringify({ error: 'Bot not configured' }), { status: 500, headers: corsHeaders });
    }

    const escMd = (t: string) => String(t || '').replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');

    const message =
      `🔑 *PERMINTAAN RESET PASSWORD*\n\n` +
      `👤 User: ${escMd(username || 'Unknown')}\n` +
      `📱 Identifier: \`${escMd(identifier)}\`\n` +
      `🆔 ID: \`${escMd(short_id)}\`\n\n` +
      `Balas \`RESET ${escMd(short_id)}\` untuk setujui\n` +
      `Balas \`TOLAK\\_RESET ${escMd(short_id)}\` untuk menolak`;

    const res = await fetch(`${TELEGRAM_API}${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: message, parse_mode: 'MarkdownV2' }),
    });

    const data = await res.json();
    if (!data.ok) {
      // Fallback without markdown
      await fetch(`${TELEGRAM_API}${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: `🔑 PERMINTAAN RESET PASSWORD\n\nUser: ${username || 'Unknown'}\nIdentifier: ${identifier}\nID: ${short_id}\n\nBalas "RESET ${short_id}" untuk setujui`,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('notify-password-reset error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
