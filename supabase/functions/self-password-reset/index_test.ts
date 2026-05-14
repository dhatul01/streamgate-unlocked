// E2E test for self-password-reset edge function.
// Verifies: token created, expires in ~20 minutes, confirm consumes it,
// login works with new password, expired/used tokens are rejected.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/self-password-reset`;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function callFn(action: string, body: Record<string, unknown>) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
    body: JSON.stringify({ action, ...body }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function createTempUser(phone: string, password: string) {
  const email = `${phone}@rt48.user`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { username: `test_${phone}` },
  });
  if (error) throw error;
  return data.user!.id;
}

async function cleanup(userId: string) {
  await admin.from("self_password_resets").delete().eq("user_id", userId);
  await admin.from("rate_limits").delete().like("key", "self_pw:%");
  await admin.auth.admin.deleteUser(userId);
}

Deno.test("E2E: request creates token with 20-minute expiry", async () => {
  const phone = "62" + Math.floor(8000000000 + Math.random() * 999999999);
  const userId = await createTempUser(phone, "oldpass123");
  try {
    const before = Date.now();
    const { status, json } = await callFn("request", { identifier: phone });
    assertEquals(status, 200);
    assertEquals(json.success, true);

    const { data: row } = await admin
      .from("self_password_resets")
      .select("*")
      .eq("user_id", userId)
      .is("used_at", null)
      .single();
    assert(row, "reset row should exist");
    assertEquals(row.phone, phone);

    const expMs = new Date(row.expires_at).getTime() - before;
    // 20 minutes = 1,200,000 ms. Allow ±60s drift.
    assert(expMs >= 1140000 && expMs <= 1260000, `expiry should be ~20min, got ${expMs}ms`);
  } finally {
    await cleanup(userId);
  }
});

Deno.test("E2E: confirm consumes token and updates password (login works)", async () => {
  const phone = "62" + Math.floor(8000000000 + Math.random() * 999999999);
  const userId = await createTempUser(phone, "oldpass123");
  try {
    // Insert a reset row directly with a token we control.
    const rawToken = randomToken();
    const tokenHash = await sha256Hex(rawToken);
    const { error: insErr } = await admin.from("self_password_resets").insert({
      user_id: userId, token_hash: tokenHash, phone,
      expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
    });
    assertEquals(insErr, null);

    const newPass = "BrandNewPass#2026";
    const { status, json } = await callFn("confirm", { token: rawToken, new_password: newPass });
    assertEquals(status, 200, JSON.stringify(json));
    assertEquals(json.success, true);

    // Verify used_at is set
    const { data: row } = await admin.from("self_password_resets")
      .select("used_at").eq("token_hash", tokenHash).single();
    assert(row?.used_at, "used_at should be set after confirm");

    // Login with new password
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: signin, error: signinErr } = await anon.auth.signInWithPassword({
      email: `${phone}@rt48.user`, password: newPass,
    });
    assertEquals(signinErr, null, signinErr?.message);
    assert(signin?.session, "should receive a session");
  } finally {
    await cleanup(userId);
  }
});

Deno.test("E2E: confirm rejects already-used token", async () => {
  const phone = "62" + Math.floor(8000000000 + Math.random() * 999999999);
  const userId = await createTempUser(phone, "oldpass123");
  try {
    const rawToken = randomToken();
    const tokenHash = await sha256Hex(rawToken);
    await admin.from("self_password_resets").insert({
      user_id: userId, token_hash: tokenHash, phone,
      expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
      used_at: new Date().toISOString(),
    });
    const { status, json } = await callFn("confirm", { token: rawToken, new_password: "another123" });
    assertEquals(status, 400);
    assertEquals(json.success, false);
    assert(/sudah digunakan/i.test(json.error), `expected 'sudah digunakan', got: ${json.error}`);
  } finally {
    await cleanup(userId);
  }
});

Deno.test("E2E: confirm rejects expired token", async () => {
  const phone = "62" + Math.floor(8000000000 + Math.random() * 999999999);
  const userId = await createTempUser(phone, "oldpass123");
  try {
    const rawToken = randomToken();
    const tokenHash = await sha256Hex(rawToken);
    await admin.from("self_password_resets").insert({
      user_id: userId, token_hash: tokenHash, phone,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const { status, json } = await callFn("confirm", { token: rawToken, new_password: "another123" });
    assertEquals(status, 400);
    assertEquals(json.success, false);
    assert(/kadaluarsa/i.test(json.error), `expected 'kadaluarsa', got: ${json.error}`);
  } finally {
    await cleanup(userId);
  }
});

Deno.test("E2E: request returns success even for unknown identifier (anti-enumeration)", async () => {
  const phone = "6289999000" + Math.floor(Math.random() * 9999);
  const { status, json } = await callFn("request", { identifier: phone });
  assertEquals(status, 200);
  assertEquals(json.success, true);
  // No row should be created
  const { data: rows } = await admin.from("self_password_resets").select("id").eq("phone", phone);
  assertEquals(rows?.length ?? 0, 0);
  await admin.from("rate_limits").delete().like("key", "self_pw:%");
});

Deno.test("E2E: confirm rejects invalid/short token", async () => {
  const { status, json } = await callFn("confirm", { token: "short", new_password: "abcdef" });
  assertEquals(status, 400);
  assertEquals(json.success, false);
});
