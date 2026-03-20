import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INDONESIAN_MONTHS: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};

function parseShowDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const cleanTime = timeStr.replace(/\s*WIB\s*/i, '').trim().replace(/\./g, ':');
  const [hour, minute] = cleanTime.split(':').map(Number);

  // Try ISO format (2026-03-20)
  const parts = dateStr.split('-');
  if (parts.length === 3 && !isNaN(Number(parts[0])) && parts[0].length === 4) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), hour || 0, minute || 0);
  }

  // Try Indonesian format (20 maret 2026)
  const words = dateStr.toLowerCase().trim().split(/\s+/);
  if (words.length === 3) {
    const day = parseInt(words[0]);
    const month = INDONESIAN_MONTHS[words[1]];
    const year = parseInt(words[2]);
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      return new Date(year, month, day, hour || 0, minute || 0);
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const FONNTE_TOKEN = Deno.env.get('FONNTE_API_TOKEN');
    if (!FONNTE_TOKEN) throw new Error('FONNTE_API_TOKEN not configured');

    const ADMIN_WA = Deno.env.get('ADMIN_WHATSAPP_NUMBER');

    // Get current time in Asia/Jakarta
    const now = new Date();
    const jakartaOffset = 7 * 60; // UTC+7
    const jakartaNow = new Date(now.getTime() + (jakartaOffset + now.getTimezoneOffset()) * 60000);

    // Check shows starting within 55-65 minutes from now (to catch the ~1 hour window)
    const minTime = new Date(jakartaNow.getTime() + 55 * 60000);
    const maxTime = new Date(jakartaNow.getTime() + 65 * 60000);

    // Get active, non-replay shows
    const { data: shows, error: showErr } = await supabase
      .from('shows')
      .select('id, title, schedule_date, schedule_time, lineup, is_subscription, coin_price')
      .eq('is_active', true)
      .eq('is_replay', false);

    if (showErr) throw showErr;
    if (!shows || shows.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No shows found', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sentCount = 0;
    const results: string[] = [];

    for (const show of shows) {
      // Parse schedule_date (e.g. "2026-03-21") and schedule_time (e.g. "19:00")
      if (!show.schedule_date || !show.schedule_time) continue;

      const [year, month, day] = show.schedule_date.split('-').map(Number);
      const [hour, minute] = show.schedule_time.split(':').map(Number);
      if (!year || !hour === undefined) continue;

      const showTime = new Date(year, month - 1, day, hour, minute || 0);

      // Check if show starts within the 55-65 minute window
      if (showTime < minTime || showTime > maxTime) continue;

      // Check if reminder already sent
      const { data: existing } = await supabase
        .from('show_reminders_sent')
        .select('id')
        .eq('show_id', show.id)
        .eq('reminder_type', '1h')
        .maybeSingle();

      if (existing) continue;

      // Get buyers who purchased this show via coins (have phone in coin_orders or subscription_orders)
      const recipients: Set<string> = new Set();

      // From subscription_orders (confirmed)
      const { data: subOrders } = await supabase
        .from('subscription_orders')
        .select('phone')
        .eq('show_id', show.id)
        .eq('status', 'confirmed');

      subOrders?.forEach(o => { if (o.phone) recipients.add(o.phone); });

      // From coin purchases: get user_ids from coin_transactions referencing this show
      const { data: coinTx } = await supabase
        .from('coin_transactions')
        .select('user_id')
        .eq('reference_id', show.id)
        .in('type', ['redeem', 'replay_redeem']);

      if (coinTx && coinTx.length > 0) {
        const userIds = [...new Set(coinTx.map(t => t.user_id))];
        // Get phone from coin_orders for these users
        const { data: coinOrders } = await supabase
          .from('coin_orders')
          .select('phone, user_id')
          .in('user_id', userIds)
          .neq('phone', '');

        coinOrders?.forEach(o => { if (o.phone) recipients.add(o.phone); });
      }

      // Always notify admin
      if (ADMIN_WA) recipients.add(ADMIN_WA);

      if (recipients.size === 0) {
        results.push(`${show.title}: no recipients`);
        continue;
      }

      // Send WhatsApp reminder
      const message = `⏰ *REMINDER - 1 Jam Lagi!*\n\n🎭 *${show.title}*\n📅 ${show.schedule_date} pukul ${show.schedule_time} WIB\n🎤 ${show.lineup || '-'}\n\nJangan sampai ketinggalan! Siapkan dirimu ya~ 🔥`;

      const targetList = [...recipients].join(',');

      const waResponse = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': FONNTE_TOKEN },
        body: new URLSearchParams({ target: targetList, message }),
      });

      const waResult = await waResponse.json();
      console.log(`Sent reminder for ${show.title} to ${recipients.size} recipients:`, waResult);

      // Mark as sent
      await supabase.from('show_reminders_sent').insert({
        show_id: show.id,
        reminder_type: '1h',
      });

      sentCount++;
      results.push(`${show.title}: sent to ${recipients.size} recipients`);
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Reminder error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
