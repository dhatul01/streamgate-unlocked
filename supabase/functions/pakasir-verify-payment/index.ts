import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAKASIR_PROJECT = "realtime";
const PAKASIR_API = "https://app.pakasir.com/api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("PAKASIR_API_KEY");
    if (!apiKey) throw new Error("PAKASIR_API_KEY not configured");

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up order to get amount
    const { data: order } = await supabase
      .from("pakasir_orders")
      .select("order_id, amount, status, token_code")
      .eq("order_id", order_id).maybeSingle();

    if (!order) {
      return new Response(JSON.stringify({ status: "not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already completed → return
    if (order.status === "completed" && order.token_code) {
      return new Response(JSON.stringify({ status: "completed", token_code: order.token_code }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify against Pakasir
    const url = `${PAKASIR_API}/transactiondetail?project=${PAKASIR_PROJECT}&amount=${order.amount}&order_id=${encodeURIComponent(order_id)}&api_key=${apiKey}`;
    const verifyRes = await fetch(url);
    const verifyData = await verifyRes.json().catch(() => ({}));
    const txn = verifyData?.transaction;

    if (!txn) {
      return new Response(JSON.stringify({ status: "pending", detail: "no transaction yet" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (txn.status !== "completed") {
      return new Response(JSON.stringify({ status: txn.status || "pending" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Completed → call RPC, also triggers WA via webhook function reuse
    const { data: result, error } = await supabase.rpc("complete_pakasir_order", {
      _order_id: order_id, _amount: txn.amount,
    });
    if (error || !(result as any)?.success) {
      return new Response(JSON.stringify({ error: (result as any)?.error || error?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const r = result as any;

    // Send WhatsApp notification (best-effort, non-blocking failure)
    try {
      const fonnte = Deno.env.get("FONNTE_TOKEN") || Deno.env.get("FONNTE_API_TOKEN");
      if (fonnte && r.phone) {
        const origin = Deno.env.get("PUBLIC_SITE_URL") || "https://realtime48show.lovable.app";
        const liveLink = `${origin}/live?t=${r.token_code}`;
        const replayLink = `${origin}/replay`;
        const fmt = (iso?: string | null) => {
          if (!iso) return "-";
          try { return new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB"; }
          catch { return iso; }
        };
        const message =
`✅ *Pembayaran Berhasil!*

Show: *${r.show_title}*
Token kamu: *${r.token_code}*

🎬 *Tonton Live:*
${liveLink}

📺 *Replay tersedia hingga:*
${fmt(r.replay_expires_at)}
Akses replay di: ${replayLink}

⏰ Token live berlaku sampai: ${fmt(r.expires_at)}
🔒 Maksimal 1 perangkat (anti-share)

Selamat menonton! 🎉`;
        const fd = new FormData();
        fd.append("target", r.phone);
        fd.append("message", message);
        await fetch("https://api.fonnte.com/send", {
          method: "POST", headers: { Authorization: fonnte }, body: fd,
        }).catch(() => {});
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ status: "completed", token_code: r.token_code }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("verify-payment error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
