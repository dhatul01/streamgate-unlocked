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

  const { data: state, error: stateErr } = await supabase
    .from('telegram_bot_state')
    .select('update_offset')
    .eq('id', 1)
    .single();

  if (stateErr) return errorResponse(stateErr.message);

  let currentOffset = state.update_offset;

  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    const response = await fetch(`${TELEGRAM_API}${BOT_TOKEN}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset: currentOffset, timeout, allowed_updates: ['message'] }),
    });

    const data = await response.json();
    if (!response.ok) return errorResponse(`getUpdates failed: ${JSON.stringify(data)}`);

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

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

    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase.from('telegram_bot_state').update({ update_offset: newOffset, updated_at: new Date().toISOString() }).eq('id', 1);
    currentOffset = newOffset;

    // Process admin replies
    const adminMessages = rows.filter((r: any) => String(r.chat_id) === ADMIN_CHAT_ID && r.text);

    for (const msg of adminMessages) {
      const rawText = (msg.text as string).trim();
      const text = rawText.toUpperCase();
      const yaMatch = text.match(/^YA\s+(.+)$/);
      const tidakMatch = text.match(/^TIDAK\s+(.+)$/);
      const resetMatch = text.match(/^RESET\s+(.+)$/);
      const tolakResetMatch = text.match(/^TOLAK_RESET\s+(.+)$/);
      const isStatus = rawText === '/status' || text === '/STATUS';

      if (isStatus) {
        await handleStatusCommand(supabase, BOT_TOKEN, ADMIN_CHAT_ID);
        totalProcessed++;
      } else if (resetMatch) {
        const shortId = resetMatch[1].trim().toLowerCase();
        await processPasswordReset(supabase, BOT_TOKEN, ADMIN_CHAT_ID, shortId, 'approve');
        totalProcessed++;
      } else if (tolakResetMatch) {
        const shortId = tolakResetMatch[1].trim().toLowerCase();
        await processPasswordReset(supabase, BOT_TOKEN, ADMIN_CHAT_ID, shortId, 'reject');
        totalProcessed++;
      } else if (yaMatch) {
        const ids = yaMatch[1].split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
        if (ids.length > 10) {
          await sendTelegramMessage(BOT_TOKEN, ADMIN_CHAT_ID, '⚠️ Maksimal 10 order per bulk konfirmasi\\. Silakan bagi menjadi beberapa perintah\\.');
        } else {
          await processBulkOrders(supabase, BOT_TOKEN, ADMIN_CHAT_ID, ids, 'approve');
          totalProcessed += ids.length;
        }
      } else if (tidakMatch) {
        const ids = tidakMatch[1].split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
        if (ids.length > 10) {
          await sendTelegramMessage(BOT_TOKEN, ADMIN_CHAT_ID, '⚠️ Maksimal 10 order per bulk tolak\\. Silakan bagi menjadi beberapa perintah\\.');
        } else {
          await processBulkOrders(supabase, BOT_TOKEN, ADMIN_CHAT_ID, ids, 'reject');
          totalProcessed += ids.length;
        }
      }

      await supabase.from('telegram_messages').update({ processed: true }).eq('update_id', msg.update_id);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed, finalOffset: currentOffset }));
});

// ─── Bulk processing ───

async function processBulkOrders(
  supabase: any, botToken: string, chatId: string,
  shortIds: string[], action: 'approve' | 'reject'
) {
  const results: string[] = [];

  for (const shortId of shortIds) {
    const result = await processOrderByShortId(supabase, botToken, chatId, shortId, action);
    results.push(result);
  }

  // Send summary if bulk (>1)
  if (shortIds.length > 1) {
    const summary = `📋 *Hasil Bulk ${action === 'approve' ? 'Konfirmasi' : 'Tolak'}:*\n\n` + results.join('\n');
    await sendTelegramMessage(botToken, chatId, summary);
  }
}

async function processOrderByShortId(
  supabase: any, botToken: string, chatId: string,
  shortId: string, action: 'approve' | 'reject'
): Promise<string> {
  // Try coin_orders by short_id
  const { data: coinOrder } = await supabase
    .from('coin_orders')
    .select('id, user_id, coin_amount, status, package_id, phone, short_id')
    .eq('short_id', shortId)
    .eq('status', 'pending')
    .maybeSingle();

  if (coinOrder) {
    await processCoinOrder(supabase, botToken, chatId, coinOrder, action, shortId.length <= 5);
    return `${action === 'approve' ? '✅' : '❌'} ${escapeMarkdown(shortId)} \\(koin\\)`;
  }

  // Try subscription_orders by short_id
  const { data: subOrder } = await supabase
    .from('subscription_orders')
    .select('id, show_id, phone, email, status, short_id')
    .eq('short_id', shortId)
    .eq('status', 'pending')
    .maybeSingle();

  if (subOrder) {
    await processSubscriptionOrder(supabase, botToken, chatId, subOrder, action, shortId.length <= 5);
    return `${action === 'approve' ? '✅' : '❌'} ${escapeMarkdown(shortId)} \\(subscription\\)`;
  }

  // Fallback: try as UUID for backward compatibility
  const { data: coinByUuid } = await supabase
    .from('coin_orders')
    .select('id, user_id, coin_amount, status, package_id, phone, short_id')
    .eq('id', shortId)
    .eq('status', 'pending')
    .maybeSingle();

  if (coinByUuid) {
    await processCoinOrder(supabase, botToken, chatId, coinByUuid, action, false);
    return `${action === 'approve' ? '✅' : '❌'} ${escapeMarkdown(shortId)} \\(koin\\)`;
  }

  const { data: subByUuid } = await supabase
    .from('subscription_orders')
    .select('id, show_id, phone, email, status, short_id')
    .eq('id', shortId)
    .eq('status', 'pending')
    .maybeSingle();

  if (subByUuid) {
    await processSubscriptionOrder(supabase, botToken, chatId, subByUuid, action, false);
    return `${action === 'approve' ? '✅' : '❌'} ${escapeMarkdown(shortId)} \\(subscription\\)`;
  }

  // Not found - only send individual message if not bulk
  return `⚠️ ${escapeMarkdown(shortId)} tidak ditemukan`;
}

// ─── Status command ───

async function handleStatusCommand(supabase: any, botToken: string, chatId: string) {
  try {
    const { data: coinOrders } = await supabase
      .from('coin_orders')
      .select('id, coin_amount, price, created_at, user_id, short_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: subOrders } = await supabase
      .from('subscription_orders')
      .select('id, show_id, phone, email, created_at, short_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    let message = '📊 *STATUS ORDER TERBARU*\n\n';

    if (coinOrders && coinOrders.length > 0) {
      message += `🪙 *Order Koin Pending \\(${coinOrders.length}\\):*\n`;
      const allIds: string[] = [];
      for (const o of coinOrders) {
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', o.user_id).single();
        const time = new Date(o.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        const sid = o.short_id || o.id.substring(0, 6);
        allIds.push(sid);
        message += `• \`${escapeMarkdown(sid)}\` ${escapeMarkdown(profile?.username || 'User')} \\- ${o.coin_amount} koin \\(Rp ${escapeMarkdown(Number(o.price).toLocaleString('id-ID'))}\\) \\| ${escapeMarkdown(time)}\n`;
      }
      message += `\n💡 Konfirmasi semua: \`YA ${allIds.join(',')}\`\n`;
    } else {
      message += '🪙 *Order Koin:* Tidak ada order pending\n';
    }

    message += '\n';

    if (subOrders && subOrders.length > 0) {
      message += `🎬 *Subscription Pending \\(${subOrders.length}\\):*\n`;
      const allIds: string[] = [];
      for (const o of subOrders) {
        const { data: show } = await supabase.from('shows').select('title').eq('id', o.show_id).single();
        const time = new Date(o.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        const sid = o.short_id || o.id.substring(0, 6);
        allIds.push(sid);
        message += `• \`${escapeMarkdown(sid)}\` ${escapeMarkdown(show?.title || 'Unknown')} \\- ${escapeMarkdown(o.email)} \\| ${escapeMarkdown(time)}\n`;
      }
      message += `\n💡 Konfirmasi semua: \`YA ${allIds.join(',')}\`\n`;
    } else {
      message += '🎬 *Subscription:* Tidak ada order pending\n';
    }

    // Check pending password resets
    const { data: resetRequests } = await supabase
      .from('password_reset_requests')
      .select('short_id, identifier, created_at, user_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (resetRequests && resetRequests.length > 0) {
      message += `\n🔑 *Reset Password Pending \\(${resetRequests.length}\\):*\n`;
      for (const r of resetRequests) {
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', r.user_id).single();
        const time = new Date(r.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        message += `• \`${escapeMarkdown(r.short_id)}\` ${escapeMarkdown(profile?.username || 'User')} \\(${escapeMarkdown(r.identifier)}\\) \\| ${escapeMarkdown(time)}\n`;
      }
    }

    message += '\n📌 *Commands:*\n`YA <id>` \\- Konfirmasi order\n`YA id1,id2,id3` \\- Bulk konfirmasi\n`TIDAK <id>` \\- Tolak order\n`RESET <id>` \\- Setujui reset password\n`TOLAK\\_RESET <id>` \\- Tolak reset password\n`/status` \\- Cek order pending';

    await sendTelegramMessage(botToken, chatId, message);
  } catch (e) {
    console.error('handleStatusCommand error:', e);
    await sendTelegramMessage(botToken, chatId, '⚠️ Error mengambil data status');
  }
}

// ─── Process individual orders ───

async function processCoinOrder(
  supabase: any, botToken: string, chatId: string,
  order: any, action: 'approve' | 'reject', isBulk: boolean
) {
  try {
    const sid = order.short_id || order.id.substring(0, 6);

    if (action === 'approve') {
      await supabase.from('coin_orders').update({ status: 'confirmed' }).eq('id', order.id);

      const { data: existingBalance } = await supabase
        .from('coin_balances').select('balance').eq('user_id', order.user_id).maybeSingle();

      if (existingBalance) {
        await supabase.from('coin_balances')
          .update({ balance: existingBalance.balance + order.coin_amount, updated_at: new Date().toISOString() })
          .eq('user_id', order.user_id);
      } else {
        await supabase.from('coin_balances').insert({ user_id: order.user_id, balance: order.coin_amount });
      }

      await supabase.from('coin_transactions').insert({
        user_id: order.user_id, amount: order.coin_amount,
        type: 'purchase', reference_id: order.id,
        description: `Pembelian ${order.coin_amount} koin`,
      });

      const { data: profile } = await supabase.from('profiles').select('username').eq('id', order.user_id).single();
      const { data: balanceData } = await supabase.from('coin_balances').select('balance').eq('user_id', order.user_id).maybeSingle();
      const newBalance = balanceData?.balance ?? order.coin_amount;

      await supabase.from('admin_notifications').insert({
        title: '✅ Order Koin Dikonfirmasi via Telegram',
        message: `Order ${sid} untuk ${profile?.username || 'User'} (${order.coin_amount} koin) telah dikonfirmasi. Saldo baru: ${newBalance} koin.`,
        type: 'coin_order',
      });

      if (order.phone) {
        const waMsg = `✅ Pembayaran kamu untuk *${order.coin_amount} koin* telah dikonfirmasi!\n\n💰 Koin sudah ditambahkan ke akunmu.\nSaldo saat ini: ${newBalance} koin.\n\nTerima kasih! 🎉`;
        await sendFonnteWhatsApp(order.phone, waMsg);
      }

      const username = escapeMarkdown(profile?.username || 'User');
      await sendTelegramMessage(botToken, chatId,
        `✅ Order koin \`${escapeMarkdown(sid)}\` berhasil dikonfirmasi\\!\n👤 User: ${username}\n💰 \\+${order.coin_amount} koin\n🏦 Saldo baru: ${newBalance} koin`);
    } else {
      await supabase.from('coin_orders').update({ status: 'rejected' }).eq('id', order.id);

      await supabase.from('admin_notifications').insert({
        title: '❌ Order Koin Ditolak via Telegram',
        message: `Order ${sid} telah ditolak.`,
        type: 'coin_order',
      });

      if (order.phone) {
        const waMsg = `❌ Maaf, pembayaran kamu untuk pembelian koin tidak dapat dikonfirmasi.\n\nSilakan hubungi admin jika ada pertanyaan.`;
        await sendFonnteWhatsApp(order.phone, waMsg);
      }

      await sendTelegramMessage(botToken, chatId, `❌ Order koin \`${escapeMarkdown(sid)}\` telah ditolak\\.`);
    }
  } catch (e) {
    console.error('processCoinOrder error:', e);
    await sendTelegramMessage(botToken, chatId,
      `⚠️ Error memproses order koin: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

async function processSubscriptionOrder(
  supabase: any, botToken: string, chatId: string,
  order: any, action: 'approve' | 'reject', isBulk: boolean
) {
  try {
    const sid = order.short_id || order.id.substring(0, 6);

    const { data: show } = await supabase.from('shows').select('title, group_link').eq('id', order.show_id).single();
    const showTitle = show?.title || 'Unknown Show';

    if (action === 'approve') {
      await supabase.from('subscription_orders').update({ status: 'confirmed' }).eq('id', order.id);

      await supabase.from('admin_notifications').insert({
        title: '✅ Subscription Dikonfirmasi via Telegram',
        message: `Order ${sid} untuk "${showTitle}" (${order.email}) telah dikonfirmasi.`,
        type: 'subscription_order',
      });

      if (order.phone) {
        let waMsg = `✅ Pembayaran kamu untuk *${showTitle}* telah dikonfirmasi!\n\nTerima kasih! 🎉`;
        if (show?.group_link) {
          waMsg = `✅ Pembayaran kamu untuk *${showTitle}* telah dikonfirmasi!\n\nSilakan bergabung ke grup membership melalui link berikut:\n${show.group_link}\n\nTerima kasih! 🎉`;
        }
        await sendFonnteWhatsApp(order.phone, waMsg);
      }

      if (!isBulk) {
        await sendTelegramMessage(botToken, chatId,
          `✅ Subscription \`${escapeMarkdown(sid)}\` untuk "${escapeMarkdown(showTitle)}" berhasil dikonfirmasi\\!`);
      }
    } else {
      await supabase.from('subscription_orders').update({ status: 'rejected' }).eq('id', order.id);

      await supabase.from('admin_notifications').insert({
        title: '❌ Subscription Ditolak via Telegram',
        message: `Order ${sid} untuk "${showTitle}" telah ditolak.`,
        type: 'subscription_order',
      });

      if (order.phone) {
        const waMsg = `❌ Maaf, pembayaran kamu untuk *${showTitle}* tidak dapat dikonfirmasi.\n\nSilakan hubungi admin jika ada pertanyaan.`;
        await sendFonnteWhatsApp(order.phone, waMsg);
      }

      if (!isBulk) {
        await sendTelegramMessage(botToken, chatId,
          `❌ Subscription \`${escapeMarkdown(sid)}\` untuk "${escapeMarkdown(showTitle)}" telah ditolak\\.`);
      }
    }
  } catch (e) {
    console.error('processSubscriptionOrder error:', e);
    await sendTelegramMessage(botToken, chatId,
      `⚠️ Error memproses subscription: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

// ─── Password Reset Processing ───

async function processPasswordReset(
  supabase: any, botToken: string, chatId: string,
  shortId: string, action: 'approve' | 'reject'
) {
  try {
    const { data: request } = await supabase
      .from('password_reset_requests')
      .select('id, user_id, identifier, phone, short_id')
      .eq('short_id', shortId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!request) {
      await sendTelegramMessage(botToken, chatId,
        `⚠️ Reset request \`${escapeMarkdown(shortId)}\` tidak ditemukan atau sudah diproses\\.`);
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('username').eq('id', request.user_id).single();
    const username = profile?.username || 'User';

    if (action === 'approve') {
      // Set status to approved — user will set their own new password via reset link
      await supabase.from('password_reset_requests')
        .update({ status: 'approved', processed_at: new Date().toISOString() })
        .eq('id', request.id);

      // Send reset link via WhatsApp
      const resetLink = `https://realstream48.lovable.app/reset-password?token=${request.short_id}`;
      if (request.phone) {
        const waMsg = `✅ Permintaan reset password kamu telah disetujui!\n\nKlik link berikut untuk membuat password baru:\n${resetLink}\n\n⚠️ Link ini hanya bisa digunakan 1 kali.`;
        await sendFonnteWhatsApp(request.phone, waMsg);
      }

      await supabase.from('admin_notifications').insert({
        title: '🔑 Password Reset Disetujui',
        message: `Reset password untuk ${username} (${request.identifier}) telah disetujui. Menunggu user membuat password baru.`,
        type: 'password_reset',
      });

      await sendTelegramMessage(botToken, chatId,
        `✅ Reset \`${escapeMarkdown(shortId)}\` untuk ${escapeMarkdown(username)} disetujui\\!\n🔗 Link reset dikirim via WhatsApp\\.`);
    } else {
      await supabase.from('password_reset_requests')
        .update({ status: 'rejected', processed_at: new Date().toISOString() })
        .eq('id', request.id);

      if (request.phone) {
        const waMsg = `❌ Maaf, permintaan reset password kamu tidak disetujui.\n\nSilakan hubungi admin jika ada pertanyaan.`;
        await sendFonnteWhatsApp(request.phone, waMsg);
      }

      await sendTelegramMessage(botToken, chatId,
        `❌ Reset password \`${escapeMarkdown(shortId)}\` untuk ${escapeMarkdown(username)} ditolak\\.`);
    }
  } catch (e) {
    console.error('processPasswordReset error:', e);
    await sendTelegramMessage(botToken, chatId,
      `⚠️ Error memproses reset password: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

// ─── Helpers ───

function escapeMarkdown(text: string): string {
  return String(text || '').replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

async function sendFonnteWhatsApp(phone: string, message: string) {
  const FONNTE_TOKEN = Deno.env.get('FONNTE_API_TOKEN');
  if (!FONNTE_TOKEN) return;
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
    // Fallback: strip markdown
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
