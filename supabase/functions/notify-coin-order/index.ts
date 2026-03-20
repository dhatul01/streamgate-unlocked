import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

    const ADMIN_CHAT_ID = Deno.env.get('ADMIN_TELEGRAM_CHAT_ID');
    if (!ADMIN_CHAT_ID) throw new Error('ADMIN_TELEGRAM_CHAT_ID is not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

    const { order_id, username, package_name, coin_amount, price, payment_proof_url } = await req.json();

    const priceFormatted = escapeMarkdown(Number(price).toLocaleString('id-ID'));
    const escapedOrderId = escapeMarkdown(order_id);
    const caption = `🪙 *Order Koin Baru\\!*\n\n👤 User: ${escapeMarkdown(username)}\n📦 Paket: ${escapeMarkdown(package_name)}\n💰 Jumlah: ${coin_amount} koin\n💵 Harga: Rp ${priceFormatted}\n🆔 Order ID: \`${escapedOrderId}\`\n\n✅ Balas *YA ${escapedOrderId}* untuk approve\n❌ Balas *TIDAK ${escapedOrderId}* untuk reject`;

    // If payment proof exists, send as photo with caption
    if (payment_proof_url && SUPABASE_URL) {
      const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/payment-proofs/${payment_proof_url}`;
      
      const photoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          photo: photoUrl,
          caption,
          parse_mode: 'MarkdownV2',
        }),
      });

      const photoData = await photoResponse.json();
      
      if (photoData.ok) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If photo send fails (e.g. private bucket), fall back to text + note
      console.warn('Photo send failed, falling back to text:', JSON.stringify(photoData));
    }

    // Fallback: send text message only
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: caption,
        parse_mode: 'MarkdownV2',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Telegram API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('notify-coin-order error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function escapeMarkdown(text: string): string {
  return String(text || '').replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
