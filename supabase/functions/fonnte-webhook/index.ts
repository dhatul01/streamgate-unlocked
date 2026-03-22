import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verify webhook secret token from URL query parameter
    const url = new URL(req.url);
    const secretParam = (url.searchParams.get('secret') || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const WEBHOOK_SECRET = (Deno.env.get('FONNTE_WEBHOOK_SECRET') || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    if (!WEBHOOK_SECRET || secretParam !== WEBHOOK_SECRET) {
      console.error('Webhook secret mismatch or not configured');
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const rawSender = (body.sender || body.from || '').replace(/[^0-9]/g, '');
    const message = (body.message || body.text || body.body || '').trim();
    const rawAdmin = ADMIN_WA.replace(/[^0-9]/g, '');

    // Normalize: strip leading 62 or 0 to get core number
    const normalizePhone = (num: string) => {
      if (num.startsWith('62')) return num.slice(2);
      if (num.startsWith('0')) return num.slice(1);
      return num;
    };
    const sender = normalizePhone(rawSender);
    const normalizedAdmin = normalizePhone(rawAdmin);

    console.log('Webhook body keys:', Object.keys(body));
    console.log('Sender:', sender, '| Admin:', normalizedAdmin, '| Match:', sender === normalizedAdmin);
    console.log('Message:', message);

    if (!sender || sender !== normalizedAdmin) {
      console.log('Rejected: sender does not match admin');
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
    } else if (command === 'SALDO') {
      // Total admin earnings
      const { data: earnings } = await supabase.from('admin_earnings').select('amount');
      const totalEarnings = (earnings || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

      // Total withdrawn
      const { data: withdrawals } = await supabase.from('admin_withdrawals').select('amount, status');
      const totalWithdrawn = (withdrawals || []).filter((w: any) => w.status === 'completed').reduce((sum: number, w: any) => sum + (w.amount || 0), 0);
      const pendingWithdraw = (withdrawals || []).filter((w: any) => w.status === 'pending').reduce((sum: number, w: any) => sum + (w.amount || 0), 0);

      // Pending coin orders
      const { count: pendingOrders } = await supabase.from('coin_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending');

      await sendReply(
        `💰 *SALDO ADMIN*\n\n` +
        `Total Pendapatan: ${totalEarnings} koin\n` +
        `Sudah Ditarik: ${totalWithdrawn} koin\n` +
        `Penarikan Pending: ${pendingWithdraw} koin\n` +
        `Saldo Bersih: ${totalEarnings - totalWithdrawn} koin\n\n` +
        `📦 Order Koin Pending: ${pendingOrders || 0}`
      );
    } else if (command === 'STATUS') {
      // Pending coin orders
      const { data: coinPending } = await supabase.from('coin_orders').select('short_id, coin_amount, price, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(10);

      // Pending subscription orders
      const { data: subPending } = await supabase.from('subscription_orders').select('short_id, phone, created_at, show_id').eq('status', 'pending').order('created_at', { ascending: false }).limit(10);

      // Pending password resets
      const { data: resetPending } = await supabase.from('password_reset_requests').select('short_id, identifier, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5);

      // Active viewers (streams)
      const { data: stream } = await supabase.from('streams').select('is_live').limit(1).maybeSingle();

      let msg = `📊 *STATUS SISTEM*\n\n`;
      msg += `🔴 Live: ${stream?.is_live ? 'YA' : 'TIDAK'}\n\n`;

      msg += `📦 *Order Koin Pending (${(coinPending || []).length}):*\n`;
      if ((coinPending || []).length === 0) msg += `  Tidak ada\n`;
      else (coinPending || []).forEach((o: any) => { msg += `  • ${o.short_id} — ${o.coin_amount} koin (${o.price})\n`; });

      msg += `\n🎫 *Order Membership Pending (${(subPending || []).length}):*\n`;
      if ((subPending || []).length === 0) msg += `  Tidak ada\n`;
      else (subPending || []).forEach((o: any) => { msg += `  • ${o.short_id} — ${o.phone}\n`; });

      msg += `\n🔑 *Reset Password Pending (${(resetPending || []).length}):*\n`;
      if ((resetPending || []).length === 0) msg += `  Tidak ada\n`;
      else (resetPending || []).forEach((r: any) => { msg += `  • ${r.short_id} — ${r.identifier}\n`; });

      await sendReply(msg);
    } else if (command === 'HELP' || command === 'MENU') {
      await sendReply(
        `📋 *DAFTAR PERINTAH ADMIN*\n\n` +
        `✅ *YA [ID]* — Konfirmasi order koin\n` +
        `   Contoh: YA C1\n\n` +
        `❌ *TIDAK [ID]* — Tolak order koin\n` +
        `   Contoh: TIDAK C1\n\n` +
        `💰 *SALDO* — Cek saldo & pendapatan admin\n\n` +
        `📊 *STATUS* — Lihat order pending & status sistem\n\n` +
        `📋 *HELP* — Tampilkan menu ini`
      );
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
