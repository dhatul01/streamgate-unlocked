import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const FONNTE_TOKEN = Deno.env.get('FONNTE_API_TOKEN');
    if (!FONNTE_TOKEN) throw new Error('FONNTE_API_TOKEN is not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phone } = await req.json();
    if (!phone) throw new Error('Missing phone number');

    // Normalize phone: remove non-digits, ensure starts with 62
    let normalized = phone.replace(/[^0-9]/g, '');
    if (normalized.startsWith('0')) normalized = '62' + normalized.slice(1);
    if (!normalized.startsWith('62')) normalized = '62' + normalized;

    // Rate limit: max 3 OTPs per phone per 10 minutes
    const { count } = await supabase
      .from('otp_codes')
      .select('*', { count: 'exact', head: true })
      .eq('phone', normalized)
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if ((count || 0) >= 3) {
      return new Response(JSON.stringify({ success: false, error: 'Terlalu banyak permintaan OTP. Coba lagi dalam 10 menit.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Store OTP
    await supabase.from('otp_codes').insert({
      phone: normalized,
      code: otp,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    // Send via Fonnte
    const message = `🔐 Kode OTP RealTime48 kamu: *${otp}*\n\nBerlaku 5 menit. Jangan bagikan ke siapapun.`;
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': FONNTE_TOKEN },
      body: new URLSearchParams({ target: normalized, message }),
    });

    const data = await response.json();

    return new Response(JSON.stringify({ success: true, phone: normalized }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
