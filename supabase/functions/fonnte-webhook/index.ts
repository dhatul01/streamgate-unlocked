import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const FONNTE_TOKEN = Deno.env.get('FONNTE_API_TOKEN');
    const ADMIN_WA = Deno.env.get('ADMIN_WHATSAPP_NUMBER') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: any = {};
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await req.json();
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      formData.forEach((value, key) => { body[key] = value; });
    } else {
      const text = await req.text();
      try { body = JSON.parse(text); } catch {
        const params = new URLSearchParams(text);
        params.forEach((value, key) => { body[key] = value; });
      }
    }

    const sender = (body.sender || body.from || '').replace(/[^0-9]/g, '');
    const message = (body.message || body.text || body.body || '').trim();
    const normalizedAdmin = ADMIN_WA.replace(/[^0-9]/g, '');

    if (!sender || sender !== normalizedAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const upperMsg = message.toUpperCase();
    const parts = upperMsg.split(/\s+/);
    const command = parts[0];
    const orderId = parts[1] || '';

    const sendReply = async (msg: string) => {
      if (!FONNTE_TOKEN) return;
      await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': FONNTE_TOKEN },
        body: new URLSearchParams({ target: sender, message: msg }),
      });
    };

    if (command === 'YA' && orderId) {
      const { data: order } = await supabase
        .from('coin_orders').select('*').eq('short_id', orderId).eq('status', 'pending').maybeSingle();

      if (!order) {
        await sendReply(`❌ Order ${orderId} tidak ditemukan atau sudah diproses.`);
        return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data, error } = await supabase.rpc('confirm_coin_order', { _order_id: order.id });
      if (error || !data?.success) {
        await sendReply(`❌ Gagal konfirmasi: ${data?.error || error?.message}`);
      } else {
        await sendReply(`✅ Order ${orderId} dikonfirmasi! Saldo baru: ${data.new_balance} koin`);
      }
    } else if (command === 'TIDAK' && orderId) {
      const { data: order } = await supabase
        .from('coin_orders').select('*').eq('short_id', orderId).eq('status', 'pending').maybeSingle();

      if (!order) {
        await sendReply(`❌ Order ${orderId} tidak ditemukan.`);
      } else {
        await supabase.from('coin_orders').update({ status: 'rejected' }).eq('id', order.id);
        await sendReply(`❌ Order ${orderId} ditolak.`);
      }
    }

    return new Response(JSON.stringify({ success: true, action: command }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
