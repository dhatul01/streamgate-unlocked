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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const FONNTE_TOKEN = Deno.env.get('FONNTE_API_TOKEN');
    if (!FONNTE_TOKEN) throw new Error('FONNTE_API_TOKEN is not configured');

    const ADMIN_WA = Deno.env.get('ADMIN_WHATSAPP_NUMBER');
    if (!ADMIN_WA) throw new Error('ADMIN_WHATSAPP_NUMBER is not configured');

    // Fonnte sends webhook data in various formats
    let body: any;
    const contentType = req.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        body = await req.json();
      } else if (contentType.includes('form')) {
        const formData = await req.formData();
        body = Object.fromEntries(formData.entries());
      } else {
        // Try JSON first, fallback to text parsing
        const text = await req.text();
        try {
          body = JSON.parse(text);
        } catch {
          // Try URL-encoded
          const params = new URLSearchParams(text);
          body = Object.fromEntries(params.entries());
        }
      }
    } catch {
      body = {};
    }

    const sender = String(body.sender || body.from || '').replace(/[^0-9]/g, '');
    const message = String(body.message || body.text || '').trim().toUpperCase();

    // Only process messages from admin number
    const adminNormalized = ADMIN_WA.replace(/[^0-9]/g, '');
    if (!sender.includes(adminNormalized) && !adminNormalized.includes(sender)) {
      return new Response(JSON.stringify({ success: false, error: 'Not admin' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse: YA <order_id> or TIDAK <order_id>
    const approveMatch = message.match(/^YA\s+([A-F0-9-]+)/i);
    const rejectMatch = message.match(/^TIDAK\s+([A-F0-9-]+)/i);

    if (!approveMatch && !rejectMatch) {
      return new Response(JSON.stringify({ success: false, error: 'Unrecognized command' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isApprove = !!approveMatch;
    const orderId = (approveMatch?.[1] || rejectMatch?.[1])!;

    // Get the order
    const { data: order } = await supabase
      .from('coin_orders')
      .select('*')
      .eq('id', orderId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!order) {
      // Send reply
      await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': FONNTE_TOKEN },
        body: new URLSearchParams({
          target: ADMIN_WA,
          message: `⚠️ Order ${orderId} tidak ditemukan atau sudah diproses.`,
        }),
      });
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let replyMessage: string;

    if (isApprove) {
      // Use the confirm_coin_order RPC
      const { data: result } = await supabase.rpc('confirm_coin_order', { _order_id: orderId });

      if (result?.success) {
        replyMessage = `✅ Order ${orderId} telah di-*APPROVE*!\n💰 ${order.coin_amount} koin ditambahkan.\n💳 Saldo baru: ${result.new_balance} koin`;
      } else {
        replyMessage = `❌ Gagal approve order: ${result?.error || 'Unknown error'}`;
      }
    } else {
      // Reject
      await supabase.from('coin_orders').update({ status: 'rejected' }).eq('id', orderId);
      replyMessage = `❌ Order ${orderId} telah di-*REJECT*.`;
    }

    // Send confirmation reply to admin
    await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': FONNTE_TOKEN },
      body: new URLSearchParams({ target: ADMIN_WA, message: replyMessage }),
    });

    return new Response(JSON.stringify({ success: true, action: isApprove ? 'approved' : 'rejected' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
