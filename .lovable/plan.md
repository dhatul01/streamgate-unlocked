# Sistem Reseller / Sub-Admin

Membangun sistem reseller terpisah dari admin & moderator. Reseller bisa login, beli/dapat kuota token dari admin, generate token baru (unik, tidak duplikat), dan setiap aksi tercatat di audit log.

## 1. Database (migration)

**Tabel baru:**

- `resellers`
  - `user_id` (uuid, unique) — referensi ke auth.users
  - `username` (text, unique)
  - `full_name`, `phone`, `whatsapp`
  - `token_quota` (int, default 0) — sisa kuota token yang bisa dibuat
  - `total_tokens_created` (int, default 0)
  - `commission_rate` (numeric, default 0) — % komisi (info saja)
  - `is_active` (bool, default true)

- `reseller_quota_logs` — riwayat top-up kuota oleh admin
  - `reseller_id`, `amount` (int, +/-), `reason`, `created_by` (admin user_id)

- `reseller_audit_logs` — semua aksi reseller
  - `reseller_id`, `action` (text: login, create_token, reset_token, view_token), `target_token_id` (nullable), `metadata` (jsonb), `ip_address`, `user_agent`

**Tambahan:**
- Tambahkan kolom `created_by_reseller_id` (uuid, nullable) di tabel `tokens` agar token reseller dapat ditelusuri.
- Tambahkan enum value `'reseller'` ke `app_role`.

**RPC Security Definer baru:**

- `reseller_create_token(_code, _duration_type, _expires_at, _max_devices)` 
  - Verifikasi `auth.uid()` adalah reseller aktif dengan `token_quota > 0`
  - Pastikan `_code` unik dengan cek `EXISTS` di `tokens` — jika sudah ada → error
  - Auto-generate code default `RSL-<random8>` jika kosong; loop sampai unik (maks 5x)
  - INSERT token baru dengan `created_by_reseller_id = reseller.id`, `is_public = false`
  - Decrement `token_quota`, increment `total_tokens_created`
  - Insert audit log + quota log
  - Return token info

- `reseller_get_my_tokens()` — list token milik reseller
- `reseller_get_my_stats()` — total tokens, kuota, earnings, dll
- `admin_topup_reseller_quota(_reseller_id, _amount, _reason)` — admin only
- `admin_create_reseller(_user_id, _username, _full_name, _phone)` — admin only

**RLS Policies:**
- `resellers`: admin manage all, reseller read own row
- `reseller_quota_logs`: admin manage, reseller read own
- `reseller_audit_logs`: admin manage, reseller insert/read own
- `tokens`: tambahkan policy "Resellers can read own tokens" via `created_by_reseller_id`

## 2. Frontend

**Halaman baru:**

- `src/pages/ResellerLogin.tsx` (`/reseller`) — form email/password, cek role `reseller` setelah login
- `src/pages/ResellerDashboard.tsx` (`/reseller/dashboard`) — proteksi auth + role
  - Tab: **Stats** (kuota, total token, earnings), **Buat Token**, **Token Saya**, **Audit Log**

**Komponen reseller:**

- `src/components/reseller/ResellerSidebar.tsx`
- `src/components/reseller/ResellerStats.tsx`
- `src/components/reseller/ResellerTokenCreator.tsx` — form generate token (durasi, max device, code custom optional). Memanggil `reseller_create_token` RPC. Anti-duplicate dijamin di RPC + UI menampilkan error jika code bentrok.
- `src/components/reseller/ResellerTokenList.tsx` — tabel token milik reseller, status, copy link
- `src/components/reseller/ResellerAuditLog.tsx` — riwayat aksi sendiri

**Admin panel — komponen baru:**

- `src/components/admin/ResellerManager.tsx` (admin only)
  - List reseller, search, top-up kuota, aktif/non-aktif, reset password, lihat stats per reseller
  - Tombol "Buat Reseller Baru" — panggil edge function `manage-reseller-account`
- `src/components/admin/ResellerAuditView.tsx` — view audit log semua reseller (filterable)

Tambahkan menu di `AdminSidebar.tsx`: "Reseller" dan "Audit Reseller" (admin only).
Tambahkan route di `AdminDashboard.tsx`.

## 3. Edge Function

`supabase/functions/manage-reseller-account/index.ts` (mirror dari `manage-moderator-account`):
- Action `create`: buat auth user + role `reseller` + entry di `resellers`
- Action `delete`: hapus reseller + auth user
- Action `reset_password`: admin reset password reseller

## 4. Routing & Navigasi

- App.tsx: tambah lazy route `/reseller` dan `/reseller/dashboard`
- ResellerDashboard cek `user_roles` mengandung `reseller`, jika tidak → redirect ke `/reseller`

## 5. Anti-duplicate guarantee

- RPC `reseller_create_token` melakukan cek `EXISTS (SELECT 1 FROM tokens WHERE code = _code)` sebelum insert
- Unique constraint di `tokens.code` (sudah ada) menjadi safeguard kedua
- Auto-generate menggunakan `gen_random_uuid()` substring + prefix `RSL-` sehingga collision praktis nol
- Token reseller selalu fresh (`status='active'`, `locked_fingerprint=NULL`, `replay_expires_at` di-set lewat trigger existing)

## Files

**Created:**
- `supabase/migrations/<ts>_reseller_system.sql`
- `supabase/functions/manage-reseller-account/index.ts`
- `src/pages/ResellerLogin.tsx`, `src/pages/ResellerDashboard.tsx`
- `src/components/reseller/{ResellerSidebar,ResellerStats,ResellerTokenCreator,ResellerTokenList,ResellerAuditLog}.tsx`
- `src/components/admin/{ResellerManager,ResellerAuditView}.tsx`

**Edited:**
- `src/App.tsx` (routes), `src/components/admin/AdminSidebar.tsx`, `src/pages/AdminDashboard.tsx`
