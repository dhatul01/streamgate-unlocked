import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory rate limiting per IP
const attemptCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attemptCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    attemptCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ success: false, error: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phone, code } = await req.json();
    if (!phone || !code) throw new Error('Missing phone or code');

    let normalized = phone.replace(/[^0-9]/g, '');
    if (normalized.startsWith('0')) normalized = '62' + normalized.slice(1);
    if (!normalized.startsWith('62')) normalized = '62' + normalized;

    // Database-level rate limit: max 5 failed attempts per phone per 5 minutes
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      _key: 'otp_verify:' + normalized,
      _max_requests: 5,
      _window_seconds: 300,
    });

    if (allowed === false) {
      return new Response(JSON.stringify({ success: false, error: 'Terlalu banyak percobaan verifikasi. Coba lagi dalam 5 menit.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find valid OTP
    const { data: otpRecord } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', normalized)
      .eq('code', code)
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord) {
      return new Response(JSON.stringify({ success: false, error: 'Kode OTP salah atau sudah kedaluwarsa.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as verified
    await supabase.from('otp_codes').update({ verified: true }).eq('id', otpRecord.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
