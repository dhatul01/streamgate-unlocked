import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAKASIR_PROJECT = "realtime";
const PAKASIR_API = "https://app.pakasir.com/api";

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta", day: "2-digit", month: "short",
      year: "numeric", hour: "2-digit", minute: "2-digit",
    }) + " WIB";
  } catch { return iso; }
}

async function sendFonnte(target: string, message: string) {
  const token = Deno.env.get("FONNTE_TOKEN");
  if (!token) { console.warn("FONNTE_TOKEN missing"); return; }
  const fd = new FormData();
  fd.append("target", target);
  fd.append("message", message);
  try {
    const r = await fetch("https://api.fonnte.com/send", {
      method: "POST", headers: { Authorization: token }, body: fd,
    });
    const txt = await r.text();
    console.log("Fonnte:", r.status, txt.slice(0, 200));
  } catch (e) { console.error("Fonnte error:", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("PAKASIR_API_KEY");
    if (!apiKey) throw new Error("PAKASIR_API_KEY missing");

    const body = await req.json().catch(() => ({}));
    console.log("Pakasir webhook:", body);

    const { order_id, amount, status, project } = body;
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id missing" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (project && project !== PAKASIR_PROJECT) {
      return new Response(JSON.stringify({ error: "Invalid project" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Re-verify with Pakasir API for security
    const verifyUrl = `${PAKASIR_API}/transactiondetail?project=${PAKASIR_PROJECT}&amount=${amount}&order_id=${encodeURIComponent(order_id)}&api_key=${apiKey}`;
    const verifyRes = await fetch(verifyUrl);
    const verifyData = await verifyRes.json().catch(() => ({}));
    const txn = verifyData?.transaction;
    if (!txn || txn.status !== "completed") {
      console.warn("Verification failed:", verifyData);
      return new Response(JSON.stringify({ error: "Transaction not completed", verify: verifyData }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: result, error } = await supabase.rpc("complete_pakasir_order", {
      _order_id: order_id, _amount: txn.amount,
    });
    if (error || !(result as any)?.success) {
      console.error("complete_pakasir_order failed:", error, result);
      return new Response(JSON.stringify({ error: (result as any)?.error || error?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = result as any;
    const origin = Deno.env.get("PUBLIC_SITE_URL") || "https://realtime48show.lovable.app";
    const liveLink = `${origin}/live?t=${r.token_code}`;
    const replayLink = `${origin}/replay`;

    const message =
`✅ *Pembayaran Berhasil!*

Show: *${r.show_title}*
Token kamu: *${r.token_code}*

🎬 *Tonton Live:*
${liveLink}

📺 *Replay tersedia hingga:*
${fmtDate(r.replay_expires_at)}
Akses replay di: ${replayLink}

⏰ Token live berlaku sampai: ${fmtDate(r.expires_at)}
🔒 Maksimal 1 perangkat (anti-share)

Selamat menonton! 🎉`;

    if (r.phone) await sendFonnte(r.phone, message);

    return new Response(JSON.stringify({ success: true, token_code: r.token_code }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("webhook error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
