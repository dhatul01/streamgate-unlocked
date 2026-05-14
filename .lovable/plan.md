## Tujuan

1. **Multi-reseller via bot** — admin bisa daftar banyak reseller (nama + nomor WA), tiap reseller punya **prefix unik** dan bisa membuat **token + info replay** lewat bot WA.
2. **Token benar-benar baru** — bukan menyalin token lama; kode unik, fingerprint kosong, sesi bersih (admin maupun reseller).
3. **Notifikasi token** rapi, menarik, simpel.
4. **Lupa password self-service** — user input email/HP terdaftar → langsung ubah password tanpa konfirmasi admin, anti-error.

---

## 1. Database

### Update tabel `resellers`
- Tambah kolom `prefix text unique` (2–8 huruf/angka, otomatis uppercase). Default `RSL` untuk yang lama.
- Tambah `bot_enabled boolean default true`.

### Tabel baru `reseller_phones`
- `reseller_id`, `phone` (digit only, unik global), `label`.
- RLS: admin penuh; reseller baca miliknya.

### RPC baru / update
- `reseller_create_token(_code, _duration_type, _expires_at, _max_devices)` — sudah ada; **diperbarui** untuk pakai `prefix` reseller.
- `bot_create_token(_actor_phone, _duration, _max_devices, _is_admin)` SECURITY DEFINER:
  - Lookup reseller dari `reseller_phones` (atau admin via `ADMIN_WHATSAPP_NUMBER`).
  - Generate kode unik: `<PREFIX>-<8 random>` untuk reseller, `ADM-<8 random>` untuk admin.
  - Insert token **fresh**: `locked_fingerprint = NULL`, `status = 'active'`, sesi kosong, replay window otomatis (`replay_expires_at = expires_at + 14 hari` via trigger yang sudah ada).
  - Untuk reseller: kurangi kuota, catat audit.
  - Return: `code`, `expires_at`, `replay_expires_at`, link live, link replay.

Kode dijamin tidak menabrak token lama: query `WHERE code = _code` sampai unik (loop max 5x).

---

## 2. Edge function `fonnte-webhook`

Tambah cabang sebelum cek admin: jika `sender` ada di `reseller_phones` → mode reseller.
Tetap balas hanya ke nomor pengirim (`target: sender`).

### Perintah baru (admin & reseller)
| Perintah | Aksi |
|---|---|
| `BUAT HARIAN` / `BUAT MINGGUAN` / `BUAT BULANAN` | Buat token + info replay. Default 1 device. |
| `BUAT HARIAN 3` | Sama, max 3 device. |
| `KUOTA` (reseller) | Sisa kuota + total dibuat. |
| `TOKEN` | 5 token aktif terbaru (kode + sisa hari). |
| `HELP` | Menu perintah sesuai role. |

### Format balasan token (menarik tapi simpel)
```
🎟️ Token Baru Siap Pakai

Kode     : AGUS-K9X2M4QP
Durasi   : 7 hari
Aktif s/d: 21 Mei 2026, 20:00

▶️ Tonton Live
https://realtime48stream.my.id/live?t=AGUS-K9X2M4QP

🎬 Replay (s/d 4 Jun 2026)
https://realtime48stream.my.id/replay?t=AGUS-K9X2M4QP

Sisa kuota: 24 token
```
Untuk admin tanpa baris kuota.

---

## 3. Frontend

### `src/components/admin/ResellerManager.tsx`
- Form Buat/Edit reseller: tambah field **Prefix** (validasi unik) + toggle **Bot Enabled**.
- Section **Nomor WA** dalam dialog edit: tabel kecil tambah/hapus nomor (label + nomor) → sync ke `reseller_phones`.

### `src/components/reseller/ResellerTokenCreator.tsx`
- Tampilkan placeholder kode pakai prefix reseller (`AGUS-XXXXXXXX`).
- Tambahkan info: "Token yang dibuat selalu baru, tidak menyalin token lama."

---

## 4. Lupa Password Self-Service

### Hapus alur konfirmasi admin
Tabel `password_reset_requests` tetap ada untuk audit, tapi tidak lagi memblokir.

### RPC baru `self_request_password_reset(_identifier text)`
SECURITY DEFINER. Logika:
1. Rate-limit per identifier (3 per 10 menit, sudah ada helper).
2. Resolve email: jika identifier digit → `<digit>@rt48.user`, kalau bukan → identifier as-is.
3. Lookup `auth.users.email`. **Anti enumeration**: kalau tidak ada, tetap return `success: true` (hasilnya tidak kirim WA, tidak buat row).
4. Jika ada: generate `reset_token` random 48 char, simpan di tabel baru `self_password_resets (user_id, token_hash sha256, phone, expires_at = now()+30 menit, used_at)`.
5. Kirim WA via Fonnte ke nomor terdaftar berisi link: `https://realtime48stream.my.id/reset-password?token=<raw>`. Format pesan singkat & ramah.

### Edge function baru `self-password-reset`
- Endpoint `POST /request` → panggil RPC + kirim WA Fonnte (server side).
- Endpoint `POST /confirm` → terima `{ token, new_password }`. Hash token, cek `expires_at > now()` & `used_at IS NULL`. Jika valid: gunakan `service-role` admin client untuk `auth.admin.updateUserById(user_id, { password })`, lalu set `used_at = now()`.
- CORS lengkap, validasi Zod, log error verbose, **selalu return JSON dengan `Content-Type`** supaya frontend tidak meledak.

### Frontend
- `src/pages/ForgotPassword.tsx`: form sederhana (email/HP) → invoke `self-password-reset/request`. Tampilkan toast generik "Jika data terdaftar, link reset sudah dikirim ke WhatsApp" (anti enumeration).
- `src/pages/ResetPassword.tsx` (atau update yang ada): baca `?token=` dari URL → form password baru → invoke `self-password-reset/confirm`. Tampilkan sukses + redirect ke `/auth`.
- `ViewerAuth.tsx`: link "Lupa password?" diarahkan ke `/forgot-password` (route public).

### Reliability
- Wrap semua await dalam try/catch dengan error message jelas.
- Validasi panjang password ≥ 6.
- Hapus dependency ke approval admin di UI lama (fitur lama lewat WA admin tetap dibiarkan jika diinginkan, tapi default user pakai self-service).

---

## File yang Akan Dibuat/Diubah

**Migration**: kolom `prefix`/`bot_enabled` di `resellers`, tabel `reseller_phones` + RLS, tabel `self_password_resets` + RLS, RPC `bot_create_token`, RPC `self_request_password_reset`, update `reseller_create_token` agar pakai prefix.

**Edge functions**:
- Update: `supabase/functions/fonnte-webhook/index.ts` (cabang reseller + perintah BUAT/KUOTA/TOKEN/HELP, format balasan baru).
- Baru: `supabase/functions/self-password-reset/index.ts` (request + confirm).

**Frontend**:
- `src/components/admin/ResellerManager.tsx` — prefix + multi-phone manager.
- `src/components/reseller/ResellerTokenCreator.tsx` — placeholder prefix.
- `src/pages/ForgotPassword.tsx` (baru) + `src/pages/ResetPassword.tsx` (update/baru).
- `src/App.tsx` — route `/forgot-password` & pastikan `/reset-password` public.
- `src/pages/ViewerAuth.tsx` — link ke halaman baru.

---

## Urutan implementasi

1. Migration (DB schema + RPC).
2. Edge function `self-password-reset` + `fonnte-webhook` update.
3. Frontend: ResellerManager → ResetPassword → ForgotPassword → ViewerAuth link.
4. Test: bot `BUAT HARIAN` (admin & reseller), forgot password end-to-end.

Setujui plan ini untuk saya mulai implementasi.
