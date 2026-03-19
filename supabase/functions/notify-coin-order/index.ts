import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const FONNTE_TOKEN = Deno.env.get('FONNTE_API_TOKEN');
    if (!FONNTE_TOKEN) throw new Error('FONNTE_API_TOKEN is not configured');

    const ADMIN_WA = Deno.env.get('ADMIN_WHATSAPP_NUMBER');
    if (!ADMIN_WA) throw new Error('ADMIN_WHATSAPP_NUMBER is not configured');

    const { order_id, username, package_name, coin_amount, price } = await req.json();

    const message = `🪙 *Order Koin Baru!*\n\n👤 User: ${username}\n📦 Paket: ${package_name}\n💰 Jumlah: ${coin_amount} koin\n💵 Harga: Rp ${Number(price).toLocaleString('id-ID')}\n🆔 Order ID: ${order_id}\n\n✅ Balas *YA ${order_id}* untuk approve\n❌ Balas *TIDAK ${order_id}* untuk reject`;

    await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': FONNTE_TOKEN },
      body: new URLSearchParams({ target: ADMIN_WA, message }),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
