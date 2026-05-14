import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAKASIR_PROJECT = "realtime";
const PAKASIR_API = "https://app.pakasir.com/api";

function parseAmount(price: string): number {
  if (!price) return 0;
  const digits = price.replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("PAKASIR_API_KEY");
    if (!apiKey) throw new Error("PAKASIR_API_KEY not configured");

    const { show_id, phone, email } = await req.json();
    if (!show_id || !phone) {
      return new Response(JSON.stringify({ error: "show_id dan phone wajib diisi" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch show price
    const { data: show, error: showErr } = await supabase
      .from("shows")
      .select("id, title, price, is_active")
      .eq("id", show_id).single();
    if (showErr || !show || !show.is_active) {
      return new Response(JSON.stringify({ error: "Show tidak tersedia" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const amount = parseAmount(show.price);
    if (amount < 1000) {
      return new Response(JSON.stringify({ error: "Harga show tidak valid (minimal Rp 1.000)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create order in DB
    const { data: orderRes, error: orderErr } = await supabase.rpc("create_pakasir_order", {
      _show_id: show_id, _phone: phone, _email: email || "", _amount: amount,
    });
    if (orderErr || !(orderRes as any)?.success) {
      return new Response(JSON.stringify({ error: (orderRes as any)?.error || orderErr?.message || "Gagal membuat order" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const order_id = (orderRes as any).order_id;

    // Call Pakasir API
    const pakasirRes = await fetch(`${PAKASIR_API}/transactioncreate/qris`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: PAKASIR_PROJECT, order_id, amount, api_key: apiKey }),
    });
    const pakasirData = await pakasirRes.json();
    if (!pakasirRes.ok || !pakasirData?.payment?.payment_number) {
      console.error("Pakasir error:", pakasirRes.status, pakasirData);
      return new Response(JSON.stringify({ error: "Pakasir API gagal", detail: pakasirData }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qr_string = pakasirData.payment.payment_number;
    const expires_at = pakasirData.payment.expired_at;
    const total_payment = pakasirData.payment.total_payment ?? amount;

    await supabase.rpc("set_pakasir_qr", {
      _order_id: order_id, _qr_string: qr_string, _expires_at: expires_at,
    });

    return new Response(JSON.stringify({
      success: true, order_id, qr_string, amount, total_payment, expires_at,
      show_title: show.title,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("create-payment error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
