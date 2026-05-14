import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await adminClient
      .from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...body } = await req.json();
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    if (action === "create") {
      const { email, password, username, full_name, phone, whatsapp, token_quota } = body;
      if (!email || !password || !username) {
        return json({ error: "Email, password, dan username wajib" }, 400);
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (createError) return json({ error: createError.message }, 400);

      const cleanup = async () => {
        await adminClient.from("resellers").delete().eq("user_id", newUser.user.id);
        await adminClient.from("user_roles").delete().eq("user_id", newUser.user.id);
        await adminClient.auth.admin.deleteUser(newUser.user.id);
      };

      const { error: roleError } = await adminClient
        .from("user_roles").insert({ user_id: newUser.user.id, role: "reseller" });
      if (roleError) { await cleanup(); return json({ error: roleError.message }, 400); }

      const { error: rsError } = await adminClient.from("resellers").insert({
        user_id: newUser.user.id,
        username,
        full_name: full_name || "",
        phone: phone || "",
        whatsapp: whatsapp || "",
        token_quota: Math.max(0, parseInt(token_quota) || 0),
      });
      if (rsError) { await cleanup(); return json({ error: rsError.message }, 400); }

      return json({ success: true, user_id: newUser.user.id });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id wajib" }, 400);

      const { data: targetRoles } = await adminClient
        .from("user_roles").select("role").eq("user_id", user_id);
      if (targetRoles?.some((r: { role: string }) => r.role === "admin")) {
        return json({ error: "Tidak bisa menghapus admin" }, 403);
      }

      await adminClient.from("resellers").delete().eq("user_id", user_id);
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      const { error: delError } = await adminClient.auth.admin.deleteUser(user_id);
      if (delError) return json({ error: delError.message }, 400);
      return json({ success: true });
    }

    if (action === "reset_password") {
      const { user_id, new_password } = body;
      if (!user_id || !new_password || new_password.length < 6) {
        return json({ error: "user_id dan password (min 6 char) wajib" }, 400);
      }
      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
