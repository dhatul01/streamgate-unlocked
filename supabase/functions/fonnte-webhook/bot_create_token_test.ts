// Security tests for bot_create_token RPC.
// Verifies: fresh token (no fingerprint copy), unique code, show binding,
// max_devices forced to 1 for non-membership shows, inactive show rejected,
// unregistered phone rejected.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function rndPhone() { return "62" + Math.floor(8000000000 + Math.random() * 999999999); }
function rndPrefix() { return "TST" + Math.floor(Math.random() * 99); }

async function setupReseller(opts: { quota?: number; bot_enabled?: boolean; is_active?: boolean } = {}) {
  const phone = rndPhone();
  const prefix = rndPrefix();
  const fakeUserId = crypto.randomUUID();
  const { data: r, error } = await admin.from("resellers").insert({
    user_id: fakeUserId,
    username: "test_" + phone.slice(-6),
    full_name: "Test Reseller",
    prefix,
    token_quota: opts.quota ?? 5,
    bot_enabled: opts.bot_enabled ?? true,
    is_active: opts.is_active ?? true,
  }).select().single();
  if (error) throw error;
  await admin.from("reseller_phones").insert({ reseller_id: r.id, phone, label: "test" });
  return { reseller: r, phone, prefix };
}

async function setupShow(is_subscription: boolean, is_active = true) {
  const { data, error } = await admin.from("shows").insert({
    title: "TestShow_" + Date.now() + "_" + Math.floor(Math.random() * 9999),
    is_subscription, is_active,
    schedule_date: "", schedule_time: "",
  }).select().single();
  if (error) throw error;
  return data;
}

async function cleanup(resellerId: string, showIds: string[] = []) {
  await admin.from("tokens").delete().eq("created_by_reseller_id", resellerId);
  await admin.from("reseller_audit_logs").delete().eq("reseller_id", resellerId);
  await admin.from("reseller_phones").delete().eq("reseller_id", resellerId);
  await admin.from("resellers").delete().eq("id", resellerId);
  for (const id of showIds) await admin.from("shows").delete().eq("id", id);
}

Deno.test("bot_create_token: rejects unregistered phone", async () => {
  const { data } = await admin.rpc("bot_create_token", {
    _actor_phone: "6289000000000",
    _duration_type: "harian",
    _max_devices: 1,
    _is_admin: false,
    _show_id: null,
  });
  assertEquals((data as any).success, false);
  assert(/tidak terdaftar/i.test((data as any).error));
});

Deno.test("bot_create_token: creates fresh token (no fingerprint, status active, unique code)", async () => {
  const { reseller, phone, prefix } = await setupReseller();
  try {
    const { data: a } = await admin.rpc("bot_create_token", {
      _actor_phone: phone, _duration_type: "harian", _max_devices: 1, _is_admin: false,
    });
    const { data: b } = await admin.rpc("bot_create_token", {
      _actor_phone: phone, _duration_type: "harian", _max_devices: 1, _is_admin: false,
    });
    assertEquals((a as any).success, true);
    assertEquals((b as any).success, true);
    assertNotEquals((a as any).code, (b as any).code, "two tokens must be different");
    assert(((a as any).code as string).startsWith(prefix + "-"));

    const { data: rows } = await admin.from("tokens")
      .select("code, locked_fingerprint, buyer_user_id, status, show_id")
      .in("code", [(a as any).code, (b as any).code]);
    for (const t of rows ?? []) {
      assertEquals(t.locked_fingerprint, null, "fingerprint must be empty");
      assertEquals(t.buyer_user_id, null, "buyer_user_id must be empty");
      assertEquals(t.status, "active");
      assertEquals(t.show_id, null);
    }
  } finally {
    await cleanup(reseller.id);
  }
});

Deno.test("bot_create_token: non-membership show forces max_devices=1 even if 5 requested", async () => {
  const { reseller, phone } = await setupReseller();
  const show = await setupShow(false);
  try {
    const { data } = await admin.rpc("bot_create_token", {
      _actor_phone: phone, _duration_type: "harian", _max_devices: 5,
      _is_admin: false, _show_id: show.id,
    });
    assertEquals((data as any).success, true);
    assertEquals((data as any).max_devices, 1);
    assertEquals((data as any).show_id, show.id);
  } finally {
    await cleanup(reseller.id, [show.id]);
  }
});

Deno.test("bot_create_token: membership show honors max_devices up to 5", async () => {
  const { reseller, phone } = await setupReseller();
  const show = await setupShow(true);
  try {
    const { data } = await admin.rpc("bot_create_token", {
      _actor_phone: phone, _duration_type: "mingguan", _max_devices: 3,
      _is_admin: false, _show_id: show.id,
    });
    assertEquals((data as any).success, true);
    assertEquals((data as any).max_devices, 3);
    assertEquals((data as any).show_id, show.id);
  } finally {
    await cleanup(reseller.id, [show.id]);
  }
});

Deno.test("bot_create_token: rejects inactive show", async () => {
  const { reseller, phone } = await setupReseller();
  const show = await setupShow(false, false);
  try {
    const { data } = await admin.rpc("bot_create_token", {
      _actor_phone: phone, _duration_type: "harian", _max_devices: 1,
      _is_admin: false, _show_id: show.id,
    });
    assertEquals((data as any).success, false);
    assert(/tidak aktif/i.test((data as any).error));
  } finally {
    await cleanup(reseller.id, [show.id]);
  }
});

Deno.test("bot_create_token: rejects when quota=0 / bot disabled", async () => {
  const a = await setupReseller({ quota: 0 });
  const b = await setupReseller({ bot_enabled: false });
  try {
    const r1 = await admin.rpc("bot_create_token", {
      _actor_phone: a.phone, _duration_type: "harian", _max_devices: 1, _is_admin: false,
    });
    assertEquals((r1.data as any).success, false);
    assert(/kuota habis/i.test((r1.data as any).error));

    const r2 = await admin.rpc("bot_create_token", {
      _actor_phone: b.phone, _duration_type: "harian", _max_devices: 1, _is_admin: false,
    });
    assertEquals((r2.data as any).success, false);
    assert(/dinonaktifkan/i.test((r2.data as any).error));
  } finally {
    await cleanup(a.reseller.id);
    await cleanup(b.reseller.id);
  }
});

Deno.test("bot_create_token: invalid duration rejected", async () => {
  const { reseller, phone } = await setupReseller();
  try {
    const { data } = await admin.rpc("bot_create_token", {
      _actor_phone: phone, _duration_type: "tahunan", _max_devices: 1, _is_admin: false,
    });
    assertEquals((data as any).success, false);
    assert(/durasi tidak valid/i.test((data as any).error));
  } finally {
    await cleanup(reseller.id);
  }
});
