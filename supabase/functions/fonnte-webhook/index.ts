import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SITE_URL = 'https://realtime48stream.my.id';

const normalizePhone = (num: string) => {
  const digits = (num || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('62')) return digits.slice(2);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
};

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    }) + ' WIB';
  } catch { return iso; }
};

const buildTokenMessage = (opts: {
  code: string; durationLabel: string; expiresAt: string; replayExpiresAt: string;
  maxDevices: number; remainingQuota: number | null; resellerName?: string;
}) => {
  const live = `${SITE_URL}/live?t=${opts.code}`;
  const replay = `${SITE_URL}/replay?t=${opts.code}`;
  let msg = `🎟️ *Token Baru Siap Pakai*\n\n`;
  msg += `🔑 Kode: *${opts.code}*\n`;
  msg += `📅 Durasi: ${opts.durationLabel}\n`;
  msg += `⏰ Aktif s/d: ${formatDate(opts.expiresAt)}\n`;
  msg += `📱 Max Perangkat: ${opts.maxDevices}\n\n`;
  msg += `▶️ *Tonton Live*\n${live}\n\n`;
  msg += `🎬 *Replay* (s/d ${formatDate(opts.replayExpiresAt)})\n${replay}\n`;
  if (opts.resellerName) {
    msg += `\n👤 Reseller: ${opts.resellerName}`;
  }
  return msg;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const secretParam = (url.searchParams.get('secret') || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const WEBHOOK_SECRET = (Deno.env.get('FONNTE_WEBHOOK_SECRET') || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    if (!WEBHOOK_SECRET || secretParam !== WEBHOOK_SECRET) {
      console.error('Webhook secret mismatch');
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

    const isGroup = body.isgroup === 'true' || body.isgroup === true;
    if (isGroup) {
      return new Response(JSON.stringify({ success: true, skipped: 'group' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sender = normalizePhone(body.sender || body.from || '');
    const message = (body.message || body.text || body.body || '').trim();
    const normalizedAdmin = normalizePhone(ADMIN_WA);

    console.log('Sender:', sender, '| Admin:', normalizedAdmin, '| Msg:', message);

    if (!sender) {
      return new Response(JSON.stringify({ success: false, error: 'No sender' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isAdmin = sender === normalizedAdmin;

    // Lookup reseller
    let reseller: any = null;
    if (!isAdmin) {
      const { data } = await supabase.rpc('lookup_reseller_by_phone', { _phone: sender });
      reseller = data;
      if (!reseller) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const sendReply = async (msg: string) => {
      if (!FONNTE_TOKEN) return;
      const target = sender.startsWith('62') ? sender : '62' + sender;
      await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': FONNTE_TOKEN },
        body: new URLSearchParams({ target, message: msg }),
      });
    };

    const upperMsg = message.toUpperCase();
    const parts = upperMsg.split(/\s+/);
    const command = parts[0];

    // ===================== SHARED: BUAT TOKEN =====================
    // Format: BUAT <DURASI> [MAX] [SHOW <judul/kata kunci>]
    if (command === 'BUAT') {
      const durationRaw = parts[1] || '';
      const validDur = ['HARIAN', 'MINGGUAN', 'BULANAN'].includes(durationRaw);
      // Parse optional SHOW <query>
      let showId: string | null = null;
      let showTitle: string | null = null;
      let maxDev = 1;
      let requestedMax = 1;
      let forcedSingleDevice = false;
      let showIsSubscription = false;
      const showIdx = parts.indexOf('SHOW');
      if (showIdx > 1) {
        const query = message.split(/\s+/).slice(showIdx + 1).join(' ').trim();
        if (query) {
          const { data: shows } = await supabase
            .from('shows')
            .select('id, title, is_active, is_subscription')
            .ilike('title', `%${query}%`)
            .eq('is_active', true)
            .limit(2);
          if (!shows || shows.length === 0) {
            await sendReply(`❌ Show "${query}" tidak ditemukan / tidak aktif.`);
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          if (shows.length > 1) {
            await sendReply(`⚠️ Lebih dari 1 show cocok:\n${shows.map((s: any) => `• ${s.title}`).join('\n')}\n\nKetik judul lebih spesifik.`);
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          showId = shows[0].id;
          showTitle = shows[0].title;
          showIsSubscription = !!shows[0].is_subscription;
        }
        if (showIdx > 2) requestedMax = Math.max(1, Math.min(5, parseInt(parts[2]) || 1));
      } else if (parts[2]) {
        requestedMax = Math.max(1, Math.min(5, parseInt(parts[2]) || 1));
      }

      // Enforce max_devices=1 for non-membership shows (or when no show bound)
      if (showId && !showIsSubscription && requestedMax > 1) {
        forcedSingleDevice = true;
        maxDev = 1;
      } else if (!showId && requestedMax > 1) {
        // No show specified — default to single device for safety
        forcedSingleDevice = true;
        maxDev = 1;
      } else {
        maxDev = requestedMax;
      }

      if (!validDur) {
        await sendReply(
          `❌ Format salah.\n\n` +
          `Contoh:\n` +
          `• BUAT HARIAN\n` +
          `• BUAT MINGGUAN 2\n` +
          `• BUAT BULANAN SHOW Itadaki\n\n` +
          `Catatan: untuk show non-membership, max perangkat dipaksa 1.`
        );
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data, error } = await supabase.rpc('bot_create_token', {
        _actor_phone: sender,
        _duration_type: durationRaw.toLowerCase(),
        _max_devices: maxDev,
        _is_admin: isAdmin,
        _show_id: showId,
      });
      if (error) {
        await sendReply(`❌ Gagal: ${error.message}`);
      } else {
        const r = data as any;
        if (!r?.success) {
          await sendReply(`❌ ${r?.error || 'Gagal membuat token'}`);
        } else {
          const durationLabel = { daily: '1 hari', weekly: '7 hari', monthly: '30 hari' }[r.duration_type as string] || r.duration_type;
          await sendReply(buildTokenMessage({
            code: r.code,
            durationLabel,
            expiresAt: r.expires_at,
            replayExpiresAt: r.replay_expires_at,
            maxDevices: r.max_devices,
            remainingQuota: isAdmin ? null : r.remaining_quota,
            resellerName: isAdmin ? undefined : r.reseller_username,
          }) + (r.show_title ? `\n🎬 Show: *${r.show_title}*` : ''));
        }
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===================== RESELLER COMMANDS =====================
    if (!isAdmin) {
      if (command === 'KUOTA' || command === 'SALDO') {
        await sendReply(
          `📊 *KUOTA RESELLER*\n\n` +
          `👤 ${reseller.full_name || reseller.username}\n` +
          `🏷️ Prefix: ${reseller.prefix}\n` +
          `🎫 Sisa kuota: *${reseller.token_quota}* token\n` +
          `📈 Total dibuat: ${reseller.total_tokens_created}`
        );
      } else if (command === 'TOKEN' || command === 'LIST') {
        const { data: tokens } = await supabase.from('tokens')
          .select('code, expires_at, status')
          .eq('created_by_reseller_id', reseller.id)
          .order('created_at', { ascending: false }).limit(5);
        let msg = `🎫 *5 Token Terakhir*\n\n`;
        if (!tokens || tokens.length === 0) msg += `Belum ada token.`;
        else tokens.forEach((t: any, i: number) => {
          msg += `${i + 1}. *${t.code}*\n   ${t.status} • s/d ${formatDate(t.expires_at)}\n\n`;
        });
        await sendReply(msg);
      } else if (command === 'HELP' || command === 'MENU') {
        await sendReply(
          `📋 *MENU RESELLER*\n\n` +
          `🎟️ *BUAT [DURASI] [MAX]*\n` +
          `   Buat token baru.\n` +
          `   • BUAT HARIAN\n` +
          `   • BUAT MINGGUAN 2\n` +
          `   • BUAT BULANAN\n\n` +
          `📊 *KUOTA* — Cek sisa kuota\n` +
          `🎫 *TOKEN* — 5 token terakhir\n` +
          `📋 *HELP* — Menu ini\n\n` +
          `Prefix kamu: *${reseller.prefix}*`
        );
      } else {
        await sendReply(`❓ Perintah tidak dikenal. Ketik *HELP* untuk melihat menu.`);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===================== ADMIN COMMANDS =====================
    const orderId = parts[1] || '';

    if (command === 'YA' && orderId) {
      const { data: order } = await supabase.from('coin_orders').select('*').eq('short_id', orderId).eq('status', 'pending').maybeSingle();
      if (!order) { await sendReply(`❌ Order ${orderId} tidak ditemukan.`); }
      else {
        const { data, error } = await supabase.rpc('confirm_coin_order', { _order_id: order.id });
        if (error || !data?.success) await sendReply(`❌ Gagal: ${data?.error || error?.message}`);
        else await sendReply(`✅ Order ${orderId} dikonfirmasi! Saldo: ${data.new_balance} koin`);
      }
    } else if (command === 'TIDAK' && orderId) {
      const { data: order } = await supabase.from('coin_orders').select('*').eq('short_id', orderId).eq('status', 'pending').maybeSingle();
      if (!order) await sendReply(`❌ Order ${orderId} tidak ditemukan.`);
      else { await supabase.from('coin_orders').update({ status: 'rejected' }).eq('id', order.id); await sendReply(`❌ Order ${orderId} ditolak.`); }
    } else if (command === 'SALDO') {
      const { data: earnings } = await supabase.from('admin_earnings').select('amount');
      const totalEarnings = (earnings || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
      const { data: withdrawals } = await supabase.from('admin_withdrawals').select('amount, status');
      const totalWithdrawn = (withdrawals || []).filter((w: any) => w.status === 'completed').reduce((s: number, w: any) => s + (w.amount || 0), 0);
      const pendingWithdraw = (withdrawals || []).filter((w: any) => w.status === 'pending').reduce((s: number, w: any) => s + (w.amount || 0), 0);
      const { count: pendingOrders } = await supabase.from('coin_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      await sendReply(
        `💰 *SALDO ADMIN*\n\nTotal: ${totalEarnings} koin\nDitarik: ${totalWithdrawn}\nPending tarik: ${pendingWithdraw}\nBersih: ${totalEarnings - totalWithdrawn}\n\n📦 Order pending: ${pendingOrders || 0}`
      );
    } else if (command === 'STATUS') {
      const { data: coinPending } = await supabase.from('coin_orders').select('short_id, coin_amount, price').eq('status', 'pending').order('created_at', { ascending: false }).limit(10);
      const { data: subPending } = await supabase.from('subscription_orders').select('short_id, phone').eq('status', 'pending').order('created_at', { ascending: false }).limit(10);
      const { data: stream } = await supabase.from('streams').select('is_live').limit(1).maybeSingle();
      let msg = `📊 *STATUS*\n\n🔴 Live: ${stream?.is_live ? 'YA' : 'TIDAK'}\n\n📦 Koin pending (${(coinPending || []).length}):\n`;
      if (!coinPending?.length) msg += `  -\n`; else (coinPending || []).forEach((o: any) => msg += `  • ${o.short_id} — ${o.coin_amount} (${o.price})\n`);
      msg += `\n🎫 Membership pending (${(subPending || []).length}):\n`;
      if (!subPending?.length) msg += `  -\n`; else (subPending || []).forEach((o: any) => msg += `  • ${o.short_id} — ${o.phone}\n`);
      await sendReply(msg);
    } else if (command === 'BROADCAST') {
      const broadcastMsg = message.substring(message.indexOf(' ') + 1).trim();
      if (!broadcastMsg || broadcastMsg.toUpperCase() === 'BROADCAST') {
        await sendReply('❌ Format: BROADCAST [pesan]');
      } else {
        const { data: coinPhones } = await supabase.from('coin_orders').select('phone').eq('status', 'confirmed');
        const { data: subPhones } = await supabase.from('subscription_orders').select('phone').eq('status', 'confirmed');
        const allPhones = new Set<string>();
        [...(coinPhones || []), ...(subPhones || [])].forEach((r: any) => {
          const p = (r.phone || '').replace(/[^0-9]/g, '');
          if (p.length >= 10) allPhones.add(p);
        });
        if (allPhones.size === 0) await sendReply('❌ Tidak ada nomor.');
        else {
          if (FONNTE_TOKEN) {
            await fetch('https://api.fonnte.com/send', {
              method: 'POST',
              headers: { 'Authorization': FONNTE_TOKEN },
              body: new URLSearchParams({ target: Array.from(allPhones).join(','), message: `📢 *PENGUMUMAN*\n\n${broadcastMsg}` }),
            });
          }
          await sendReply(`✅ Broadcast ke ${allPhones.size} nomor!`);
        }
      }
    } else if (command === 'HELP' || command === 'MENU') {
      await sendReply(
        `📋 *MENU ADMIN*\n\n` +
        `🎟️ *BUAT [DURASI] [MAX]*\n` +
        `   Buat token baru (prefix ADM-).\n` +
        `   • BUAT HARIAN\n` +
        `   • BUAT MINGGUAN 2\n\n` +
        `✅ *YA [ID]* — Konfirmasi order\n` +
        `❌ *TIDAK [ID]* — Tolak order\n` +
        `💰 *SALDO* — Saldo admin\n` +
        `📊 *STATUS* — Order pending\n` +
        `📢 *BROADCAST [pesan]* — Pengumuman\n` +
        `📋 *HELP* — Menu ini`
      );
    } else {
      await sendReply(`❓ Perintah tidak dikenal. Ketik *HELP*.`);
    }

    return new Response(JSON.stringify({ success: true, action: command }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
