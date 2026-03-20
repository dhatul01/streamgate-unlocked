import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_API = 'https://api.telegram.org/bot';
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

serve(async () => {
  const startTime = Date.now();

  const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!BOT_TOKEN) return errorResponse('TELEGRAM_BOT_TOKEN is not configured');

  const ADMIN_CHAT_ID = Deno.env.get('ADMIN_TELEGRAM_CHAT_ID');
  if (!ADMIN_CHAT_ID) return errorResponse('ADMIN_TELEGRAM_CHAT_ID is not configured');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let totalProcessed = 0;

  // Read initial offset
  const { data: state, error: stateErr } = await supabase
    .from('telegram_bot_state')
    .select('update_offset')
    .eq('id', 1)
    .single();

  if (stateErr) return errorResponse(stateErr.message);

  let currentOffset = state.update_offset;

  // Poll loop
  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    const response = await fetch(`${TELEGRAM_API}${BOT_TOKEN}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offset: currentOffset,
        timeout,
        allowed_updates: ['message'],
      }),
    });

    const data = await response.json();
    if (!response.ok) return errorResponse(`getUpdates failed: ${JSON.stringify(data)}`);

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    // Store messages
    const rows = updates
      .filter((u: any) => u.message)
      .map((u: any) => ({
        update_id: u.update_id,
        chat_id: u.message.chat.id,
        text: u.message.text ?? null,
        raw_update: u,
        processed: false,
      }));

    if (rows.length > 0) {
      await supabase.from('telegram_messages').upsert(rows, { onConflict: 'update_id' });
    }

    // Advance offset
    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase
      .from('telegram_bot_state')
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq('id', 1);
    currentOffset = newOffset;

    // Process admin replies for coin order approval/rejection
    const adminMessages = rows.filter(
      (r: any) => String(r.chat_id) === ADMIN_CHAT_ID && r.text
    );

    for (const msg of adminMessages) {
      const rawText = (msg.text as string).trim();
      const text = rawText.toUpperCase();
      const yaMatch = text.match(/^YA\s+(.+)$/);
      const tidakMatch = text.match(/^TIDAK\s+(.+)$/);
      const isStatus = rawText === '/status' || text === '/STATUS';

      if (isStatus) {
        await handleStatusCommand(supabase, BOT_TOKEN, ADMIN_CHAT_ID);
        totalProcessed++;
      } else if (yaMatch) {
        await processAnyOrder(supabase, BOT_TOKEN, ADMIN_CHAT_ID, yaMatch[1].trim(), 'approve');
        totalProcessed++;
      } else if (tidakMatch) {
        await processAnyOrder(supabase, BOT_TOKEN, ADMIN_CHAT_ID, tidakMatch[1].trim(), 'reject');
        totalProcessed++;
      }

      // Mark as processed
      await supabase
        .from('telegram_messages')
        .update({ processed: true })
        .eq('update_id', msg.update_id);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed, finalOffset: currentOffset }));
});

async function handleStatusCommand(supabase: any, botToken: string, chatId: string) {
  try {
    // Fetch recent pending coin orders
    const { data: coinOrders } = await supabase
      .from('coin_orders')
      .select('id, coin_amount, price, created_at, user_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch recent pending subscription orders
    const { data: subOrders } = await supabase
      .from('subscription_orders')
      .select('id, show_id, phone, email, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    let message = '📊 *STATUS ORDER TERBARU*\n\n';

    // Coin orders section
    if (coinOrders && coinOrders.length > 0) {
      message += `🪙 *Order Koin Pending (${coinOrders.length}):*\n`;
      for (const o of coinOrders) {
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', o.user_id).single();
        const time = new Date(o.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        message += `• ${escapeMarkdown(profile?.username || 'User')} \\- ${o.coin_amount} koin \\(Rp ${escapeMarkdown(Number(o.price).toLocaleString('id-ID'))}\\)\n  ID: \`${o.id}\` \\| ${escapeMarkdown(time)}\n`;
      }
    } else {
      message += '🪙 *Order Koin:* Tidak ada order pending\n';
    }

    message += '\n';

    // Subscription orders section
    if (subOrders && subOrders.length > 0) {
      message += `🎬 *Subscription Pending (${subOrders.length}):*\n`;
      for (const o of subOrders) {
        const { data: show } = await supabase.from('shows').select('title').eq('id', o.show_id).single();
        const time = new Date(o.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        message += `• ${escapeMarkdown(show?.title || 'Unknown')} \\- ${escapeMarkdown(o.email)}\n  ID: \`${o.id}\` \\| ${escapeMarkdown(time)}\n`;
      }
    } else {
      message += '🎬 *Subscription:* Tidak ada order pending\n';
    }

    message += '\n📌 *Commands:*\n`YA <id>` \\- Konfirmasi order\n`TIDAK <id>` \\- Tolak order\n`/status` \\- Cek order pending';

    await sendTelegramMessage(botToken, chatId, message);
  } catch (e) {
    console.error('handleStatusCommand error:', e);
    await sendTelegramMessage(botToken, chatId, '⚠️ Error mengambil data status');
  }
}

async function processAnyOrder(
  supabase: any,
  botToken: string,
  chatId: string,
  orderId: string,
  action: 'approve' | 'reject'
) {
  // Try coin_orders first
  const { data: coinOrder } = await supabase
    .from('coin_orders')
    .select('id, user_id, coin_amount, status, package_id, phone')
    .eq('id', orderId)
    .eq('status', 'pending')
    .maybeSingle();

  if (coinOrder) {
    await processCoinOrder(supabase, botToken, chatId, coinOrder, action);
    return;
  }

  // Try subscription_orders
  const { data: subOrder } = await supabase
    .from('subscription_orders')
    .select('id, show_id, phone, email, status')
    .eq('id', orderId)
    .eq('status', 'pending')
    .maybeSingle();

  if (subOrder) {
    await processSubscriptionOrder(supabase, botToken, chatId, subOrder, action);
    return;
  }

  await sendTelegramMessage(botToken, chatId,
    `❌ Order \`${orderId}\` tidak ditemukan atau sudah diproses\\.`);
}

async function processCoinOrder(
  supabase: any,
  botToken: string,
  chatId: string,
  order: any,
  action: 'approve' | 'reject'
) {
  try {
    if (action === 'approve') {
      await supabase.from('coin_orders').update({ status: 'confirmed' }).eq('id', order.id);

      const { data: existingBalance } = await supabase
        .from('coin_balances')
        .select('balance')
        .eq('user_id', order.user_id)
        .maybeSingle();

      if (existingBalance) {
        await supabase
          .from('coin_balances')
          .update({ balance: existingBalance.balance + order.coin_amount, updated_at: new Date().toISOString() })
          .eq('user_id', order.user_id);
      } else {
        await supabase
          .from('coin_balances')
          .insert({ user_id: order.user_id, balance: order.coin_amount });
      }

      await supabase.from('coin_transactions').insert({
        user_id: order.user_id,
        amount: order.coin_amount,
        type: 'purchase',
        reference_id: order.id,
        description: `Pembelian ${order.coin_amount} koin`,
      });

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', order.user_id)
        .single();

      await supabase.from('admin_notifications').insert({
        title: '✅ Order Koin Dikonfirmasi via Telegram',
        message: `Order ${order.id} untuk ${profile?.username || 'User'} (${order.coin_amount} koin) telah dikonfirmasi.`,
        type: 'coin_order',
      });

      await sendTelegramMessage(botToken, chatId,
        `✅ Order koin \`${order.id}\` berhasil dikonfirmasi\\!\n💰 ${order.coin_amount} koin ditambahkan ke akun ${escapeMarkdown(profile?.username || 'User')}\\.`);
    } else {
      await supabase.from('coin_orders').update({ status: 'rejected' }).eq('id', order.id);

      await supabase.from('admin_notifications').insert({
        title: '❌ Order Koin Ditolak via Telegram',
        message: `Order ${order.id} telah ditolak.`,
        type: 'coin_order',
      });

      await sendTelegramMessage(botToken, chatId,
        `❌ Order koin \`${order.id}\` telah ditolak\\.`);
    }
  } catch (e) {
    console.error('processCoinOrder error:', e);
    await sendTelegramMessage(botToken, chatId,
      `⚠️ Error memproses order koin: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

async function processSubscriptionOrder(
  supabase: any,
  botToken: string,
  chatId: string,
  order: any,
  action: 'approve' | 'reject'
) {
  try {
    const { data: show } = await supabase
      .from('shows')
      .select('title, group_link')
      .eq('id', order.show_id)
      .single();

    const showTitle = show?.title || 'Unknown Show';

    if (action === 'approve') {
      await supabase.from('subscription_orders').update({ status: 'confirmed' }).eq('id', order.id);

      await supabase.from('admin_notifications').insert({
        title: '✅ Subscription Dikonfirmasi via Telegram',
        message: `Order ${order.id} untuk "${showTitle}" (${order.email}) telah dikonfirmasi.`,
        type: 'subscription_order',
      });

      // Send WhatsApp notification to user
      if (order.phone) {
        let waMsg = `✅ Pembayaran kamu untuk *${showTitle}* telah dikonfirmasi!\n\nTerima kasih! 🎉`;
        if (show?.group_link) {
          waMsg = `✅ Pembayaran kamu untuk *${showTitle}* telah dikonfirmasi!\n\nSilakan bergabung ke grup membership melalui link berikut:\n${show.group_link}\n\nTerima kasih! 🎉`;
        }
        await sendFonnteWhatsApp(order.phone, waMsg);
      }

      await sendTelegramMessage(botToken, chatId,
        `✅ Subscription \`${order.id}\` untuk "${escapeMarkdown(showTitle)}" berhasil dikonfirmasi\\!`);
    } else {
      await supabase.from('subscription_orders').update({ status: 'rejected' }).eq('id', order.id);

      await supabase.from('admin_notifications').insert({
        title: '❌ Subscription Ditolak via Telegram',
        message: `Order ${order.id} untuk "${showTitle}" telah ditolak.`,
        type: 'subscription_order',
      });

      // Send WhatsApp notification to user
      if (order.phone) {
        const waMsg = `❌ Maaf, pembayaran kamu untuk *${showTitle}* tidak dapat dikonfirmasi.\n\nSilakan hubungi admin jika ada pertanyaan.`;
        await sendFonnteWhatsApp(order.phone, waMsg);
      }

      await sendTelegramMessage(botToken, chatId,
        `❌ Subscription \`${order.id}\` untuk "${escapeMarkdown(showTitle)}" telah ditolak\\.`);
    }
  } catch (e) {
    console.error('processSubscriptionOrder error:', e);
    await sendTelegramMessage(botToken, chatId,
      `⚠️ Error memproses subscription: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

function escapeMarkdown(text: string): string {
  return String(text || '').replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

async function sendFonnteWhatsApp(phone: string, message: string) {
  const FONNTE_TOKEN = Deno.env.get('FONNTE_API_TOKEN');
  if (!FONNTE_TOKEN) {
    console.error('FONNTE_API_TOKEN not configured, skipping WA notification');
    return;
  }
  const cleanPhone = phone.replace(/^0/, '62').replace(/[^0-9]/g, '');
  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': FONNTE_TOKEN },
      body: new URLSearchParams({ target: cleanPhone, message }),
    });
    const data = await res.json();
    console.log('Fonnte WA sent:', JSON.stringify(data));
  } catch (e) {
    console.error('sendFonnteWhatsApp error:', e);
  }
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
  });
  const data = await res.json();
  if (!data.ok) {
    await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.replace(/\\([_*\[\]()~`>#+\-=|{}.!\\])/g, '$1') }),
    });
  }
}

function errorResponse(msg: string) {
  console.error('telegram-poll error:', msg);
  return new Response(JSON.stringify({ error: msg }), { status: 500 });
}
