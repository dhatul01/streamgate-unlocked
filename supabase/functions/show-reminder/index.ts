import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const FONNTE_TOKEN = Deno.env.get('FONNTE_API_TOKEN');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!FONNTE_TOKEN) {
      return new Response(JSON.stringify({ success: false, error: 'FONNTE_API_TOKEN not set' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all active shows
    const { data: shows } = await supabase.from('shows').select('*').eq('is_active', true);
    if (!shows || shows.length === 0) {
      return new Response(JSON.stringify({ success: true, reminded: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    let remindedCount = 0;

    for (const show of shows) {
      if (!show.schedule_date || !show.schedule_time) continue;

      // Parse show datetime using RPC
      const { data: showStartStr } = await supabase.rpc('parse_show_datetime', {
        _date: show.schedule_date,
        _time: show.schedule_time,
      });

      if (!showStartStr) continue;
      const showStart = new Date(showStartStr);
      const diffMs = showStart.getTime() - now.getTime();
      const diffMin = diffMs / 60000;

      // Send reminder if show starts in 25-35 minutes (window for cron running every 5 min)
      if (diffMin < 25 || diffMin > 35) continue;

      // Check if reminder already sent (use site_settings as flag)
      const reminderKey = `reminder_sent_${show.id}`;
      const { data: existing } = await supabase.from('site_settings').select('value').eq('key', reminderKey).maybeSingle();
      if (existing) continue; // Already sent

      // Get subscriber phones for this show
      const { data: subs } = await supabase
        .from('subscription_orders')
        .select('phone')
        .eq('show_id', show.id)
        .eq('status', 'confirmed');

      // Get coin purchaser phones
      const { data: coinTxs } = await supabase
        .from('coin_transactions')
        .select('user_id')
        .eq('reference_id', show.id)
        .in('type', ['redeem', 'membership']);

      const phoneSet = new Set<string>();

      // Add subscriber phones
      (subs || []).forEach((s: any) => {
        const p = (s.phone || '').replace(/[^0-9]/g, '');
        if (p.length >= 10) phoneSet.add(p);
      });

      // For coin purchasers, look up their phone from profiles/auth pattern
      if (coinTxs && coinTxs.length > 0) {
        const userIds = [...new Set(coinTxs.map((t: any) => t.user_id))];
        for (const uid of userIds) {
          // Get user email to extract phone
          const { data: userData } = await supabase.auth.admin.getUserById(uid);
          if (userData?.user?.email) {
            const email = userData.user.email;
            if (email.endsWith('@rt48.user')) {
              const phone = email.replace('@rt48.user', '');
              if (phone.length >= 10) phoneSet.add(phone);
            }
          }
        }
      }

      if (phoneSet.size === 0) continue;

      const timeStr = show.schedule_time || '';
      const targets = Array.from(phoneSet).join(',');
      const message = `⏰ *REMINDER*\n\n🎬 *${show.title}*\nDimulai dalam 30 menit! (${timeStr})\n\nSiapkan dirimu dan jangan sampai ketinggalan! 🔥`;

      await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': FONNTE_TOKEN },
        body: new URLSearchParams({ target: targets, message }),
      });

      // Mark as sent
      await supabase.from('site_settings').upsert(
        { key: reminderKey, value: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

      console.log(`Reminder sent for "${show.title}" to ${phoneSet.size} users`);
      remindedCount++;
    }

    return new Response(JSON.stringify({ success: true, reminded: remindedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Reminder error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
