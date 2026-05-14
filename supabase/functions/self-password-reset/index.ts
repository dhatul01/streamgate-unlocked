import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const SITE_URL = 'https://realtime48stream.my.id';

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendWa(phone: string, message: string) {
  const token = Deno.env.get('FONNTE_API_TOKEN');
  if (!token || !phone) return { ok: false, reason: 'no_token_or_phone' };
  const target = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': token },
      body: new URLSearchParams({ target, message }),
    });
    const t = await res.text();
    console.log('Fonnte response:', t);
    return { ok: res.ok, body: t };
  } catch (e) {
    console.error('Fonnte error:', e);
    return { ok: false, reason: String(e) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || (await req.clone().json().catch(() => ({}))).action;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));

    // ============ REQUEST ============
    if (action === 'request') {
      const identifier = String(body.identifier || '').trim();
      if (identifier.length < 5 || identifier.length > 120) {
        return json({ success: false, error: 'Email atau nomor HP tidak valid' }, 400);
      }

      const rawToken = randomToken();
      const tokenHash = await sha256Hex(rawToken);

      const { data, error } = await supabase.rpc('self_request_password_reset', {
        _identifier: identifier,
        _token_hash: tokenHash,
      });

      if (error) {
        console.error('RPC error:', error);
        return json({ success: false, error: error.message }, 500);
      }
      const res = data as { success: boolean; found?: boolean; phone?: string; error?: string };
      if (!res?.success) {
        return json({ success: false, error: res?.error || 'Gagal' }, 400);
      }

      // Anti-enumeration: always say success even if not found
      if (!res.found) {
        return json({ success: true, sent: false });
      }

      const link = `${SITE_URL}/reset-password?token=${rawToken}`;
      const msg =
        `🔐 *Reset Password RealTime48*\n\n` +
        `Hai! Kamu (atau seseorang) meminta reset password.\n\n` +
        `Klik link di bawah untuk membuat password baru:\n${link}\n\n` +
        `⏰ Berlaku 30 menit.\n` +
        `Abaikan pesan ini kalau bukan kamu.`;

      const phone = res.phone || identifier.replace(/[^0-9]/g, '');
      const sent = await sendWa(phone, msg);

      return json({ success: true, sent: sent.ok });
    }

    // ============ CONFIRM ============
    if (action === 'confirm') {
      const rawToken = String(body.token || '').trim();
      const newPassword = String(body.new_password || '');
      if (rawToken.length < 32) return json({ success: false, error: 'Link tidak valid' }, 400);
      if (newPassword.length < 6) return json({ success: false, error: 'Password minimal 6 karakter' }, 400);
      if (newPassword.length > 72) return json({ success: false, error: 'Password terlalu panjang' }, 400);

      const tokenHash = await sha256Hex(rawToken);
      const { data, error } = await supabase.rpc('self_consume_password_reset', { _token_hash: tokenHash });
      if (error) {
        console.error('Consume RPC error:', error);
        return json({ success: false, error: error.message }, 500);
      }
      const res = data as { success: boolean; user_id?: string; error?: string };
      if (!res?.success || !res.user_id) {
        return json({ success: false, error: res?.error || 'Link tidak valid' }, 400);
      }

      const { error: updErr } = await supabase.auth.admin.updateUserById(res.user_id, {
        password: newPassword,
      });
      if (updErr) {
        console.error('Auth update error:', updErr);
        return json({ success: false, error: 'Gagal mengubah password: ' + updErr.message }, 500);
      }

      return json({ success: true });
    }

    return json({ success: false, error: 'Action tidak dikenal (gunakan request atau confirm)' }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Unhandled error:', err);
    return json({ success: false, error: msg }, 500);
  }
});
