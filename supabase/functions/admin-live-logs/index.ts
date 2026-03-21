import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: roles } = await adminSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gather system status
    const now = new Date();

    // 1. Telegram polling health
    const { data: botState } = await adminSupabase
      .from('telegram_bot_state')
      .select('update_offset, updated_at')
      .eq('id', 1)
      .single();

    const telegramLastPoll = botState?.updated_at ? new Date(botState.updated_at) : null;
    const telegramOffset = botState?.update_offset ?? 0;
    const telegramAgeMs = telegramLastPoll ? now.getTime() - telegramLastPoll.getTime() : null;
    const telegramHealthy = telegramAgeMs !== null && telegramAgeMs < 120_000; // within 2 min

    // 2. Recent telegram messages (last 20)
    const { data: recentMessages } = await adminSupabase
      .from('telegram_messages')
      .select('update_id, chat_id, text, processed, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    // 3. Recent admin notifications (proxy for function activity)
    const { data: recentNotifications } = await adminSupabase
      .from('admin_notifications')
      .select('id, title, message, type, created_at, is_read')
      .order('created_at', { ascending: false })
      .limit(20);

    // 4. Recent coin orders (function trigger activity)
    const { data: recentCoinOrders } = await adminSupabase
      .from('coin_orders')
      .select('id, short_id, status, coin_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // 5. Recent subscription orders
    const { data: recentSubOrders } = await adminSupabase
      .from('subscription_orders')
      .select('id, short_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // 6. Recent security events
    const { data: recentSecurity } = await adminSupabase
      .from('security_events')
      .select('id, event_type, description, severity, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // 7. Recent password reset requests
    const { data: recentResets } = await adminSupabase
      .from('password_reset_requests')
      .select('id, short_id, status, identifier, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // 8. Cron job status check
    let cronJobs: any[] = [];
    try {
      const { data } = await adminSupabase.rpc('get_cron_jobs' as any);
      cronJobs = data || [];
    } catch {
      // Function may not exist, that's fine
    }

    // Build unified log entries
    const logs: any[] = [];

    // Telegram polling entries
    if (telegramLastPoll) {
      logs.push({
        timestamp: telegramLastPoll.toISOString(),
        source: 'telegram-poll',
        level: telegramHealthy ? 'info' : 'warn',
        message: telegramHealthy
          ? `Polling aktif, offset: ${telegramOffset}`
          : `Polling mungkin terhenti (${Math.round((telegramAgeMs || 0) / 1000)}s lalu)`,
      });
    }

    // Processed telegram messages
    if (recentMessages) {
      for (const m of recentMessages) {
        logs.push({
          timestamp: m.created_at,
          source: 'telegram-poll',
          level: m.processed ? 'info' : 'warn',
          message: `${m.processed ? '✅' : '⏳'} Chat ${m.chat_id}: "${(m.text || '(no text)').substring(0, 80)}"`,
        });
      }
    }

    // Notifications as function activity
    if (recentNotifications) {
      for (const n of recentNotifications) {
        logs.push({
          timestamp: n.created_at,
          source: n.type === 'coin_order' ? 'notify-coin-order'
            : n.type === 'subscription_order' ? 'notify-subscription-order'
            : n.type === 'security' ? 'security'
            : n.type === 'password_reset' ? 'password-reset'
            : n.type === 'coin_redeem' ? 'coin-redeem'
            : 'system',
          level: n.type === 'security' ? 'warn' : 'info',
          message: `${n.title}: ${n.message.substring(0, 120)}`,
        });
      }
    }

    // Security events
    if (recentSecurity) {
      for (const s of recentSecurity) {
        logs.push({
          timestamp: s.created_at,
          source: 'security',
          level: s.severity === 'critical' ? 'error' : s.severity === 'high' ? 'warn' : 'info',
          message: `[${s.event_type}] ${s.description.substring(0, 120)}`,
        });
      }
    }

    // Sort all logs by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return new Response(JSON.stringify({
      telegram: {
        healthy: telegramHealthy,
        lastPoll: telegramLastPoll?.toISOString() || null,
        ageSeconds: telegramAgeMs ? Math.round(telegramAgeMs / 1000) : null,
        offset: telegramOffset,
        unprocessedCount: recentMessages?.filter(m => !m.processed).length || 0,
      },
      orders: {
        coinPending: recentCoinOrders?.filter(o => o.status === 'pending').length || 0,
        subPending: recentSubOrders?.filter(o => o.status === 'pending').length || 0,
      },
      resets: {
        pending: recentResets?.filter(r => r.status === 'pending').length || 0,
      },
      logs: logs.slice(0, 50),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('admin-live-logs error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
