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
      const approveMatch = text.match(/^APPROVE\s+(.+)$/);
      const rejectMatch = text.match(/^REJECT\s+(.+)$/);
      const isStatus = rawText === '/status' || text === '/STATUS';

      if (isStatus) {
        await handleStatusCommand(supabase, BOT_TOKEN, ADMIN_CHAT_ID);
        totalProcessed++;
      } else if (yaMatch) {
        await processCoinOrder(supabase, BOT_TOKEN, ADMIN_CHAT_ID, yaMatch[1].trim(), 'approve');
        totalProcessed++;
      } else if (tidakMatch) {
        await processCoinOrder(supabase, BOT_TOKEN, ADMIN_CHAT_ID, tidakMatch[1].trim(), 'reject');
        totalProcessed++;
      } else if (approveMatch) {
        await processSubscriptionOrder(supabase, BOT_TOKEN, ADMIN_CHAT_ID, approveMatch[1].trim(), 'approve');
        totalProcessed++;
      } else if (rejectMatch) {
        await processSubscriptionOrder(supabase, BOT_TOKEN, ADMIN_CHAT_ID, rejectMatch[1].trim(), 'reject');
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

    message += '\n📌 *Commands:*\n`YA <id>` / `TIDAK <id>` \\- Coin order\n`APPROVE <id>` / `REJECT <id>` \\- Subscription';

    await sendTelegramMessage(botToken, chatId, message);
  } catch (e) {
    console.error('handleStatusCommand error:', e);
    await sendTelegramMessage(botToken, chatId, '⚠️ Error mengambil data status');
  }
}

async function processCoinOrder(
  supabase: any,
  botToken: string,
  chatId: string,
  orderId: string,
  action: 'approve' | 'reject'
) {
  try {
    const { data: order, error: orderErr } = await supabase
      .from('coin_orders')
      .select('id, user_id, coin_amount, status, package_id')
      .or(`id.eq.${orderId}`)
      .eq('status', 'pending')
      .single();

    if (orderErr || !order) {
      await sendTelegramMessage(botToken, chatId,
        `❌ Order koin \`${orderId}\` tidak ditemukan atau sudah diproses.`);
      return;
    }

    if (action === 'approve') {
      await supabase.from('coin_orders').update({ status: 'confirmed' }).eq('id', order.id);

      const { data: existingBalance } = await supabase
        .from('coin_balances')
        .select('balance')
        .eq('user_id', order.user_id)
        .single();

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
        `✅ Order koin \`${order.id}\` berhasil di\\-approve\\!\n💰 ${order.coin_amount} koin ditambahkan ke akun user\\.`);
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
  orderId: string,
  action: 'approve' | 'reject'
) {
  try {
    const { data: order, error: orderErr } = await supabase
      .from('subscription_orders')
      .select('id, show_id, phone, email, status')
      .or(`id.eq.${orderId}`)
      .eq('status', 'pending')
      .single();

    if (orderErr || !order) {
      await sendTelegramMessage(botToken, chatId,
        `❌ Order subscription \`${orderId}\` tidak ditemukan atau sudah diproses.`);
      return;
    }

    // Get show title
    const { data: show } = await supabase
      .from('shows')
      .select('title')
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

      await sendTelegramMessage(botToken, chatId,
        `✅ Subscription \`${order.id}\` untuk "${escapeMarkdown(showTitle)}" berhasil di\\-approve\\!`);
    } else {
      await supabase.from('subscription_orders').update({ status: 'rejected' }).eq('id', order.id);

      await supabase.from('admin_notifications').insert({
        title: '❌ Subscription Ditolak via Telegram',
        message: `Order ${order.id} untuk "${showTitle}" telah ditolak.`,
        type: 'subscription_order',
      });

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
