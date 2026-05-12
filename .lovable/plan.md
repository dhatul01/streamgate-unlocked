## 1. Landing Page – Elegan & Serif

- Tambah Google Font **Playfair Display** (serif klasik mirip Times New Roman tapi lebih elegan untuk web) untuk semua heading, dan **Inter** untuk body.
- Update `index.html` (preconnect + link font) dan `tailwind.config.ts` (`fontFamily.serif: ["Playfair Display", "Times New Roman", "serif"]`).
- Apply class `font-serif` ke judul hero, judul section, judul kartu show, judul "Live", "Replay", "Schedule".
- Refresh tombol utama (`Tonton Live`, `Beli Token`, CTA hero) jadi style elegan: gradient halus primary→primary-glow, border tipis, shadow elegan, hover scale 1.02, transisi 300ms, sudut `rounded-xl`.
- Tidak mengubah struktur/komponen lain — hanya token visual & class.

## 2. Sistem Replay – Embed per Kartu + 14 Hari Token

### Database (migration)
- `shows`: tambah kolom `replay_embed_url text default ''` dan `replay_embed_type text default 'm3u8'` (`'m3u8' | 'youtube'`).
- `tokens`: tambah kolom `replay_expires_at timestamptz` (nullable). Diisi otomatis = `expires_at + 14 days` saat token dibuat (trigger `BEFORE INSERT`).
- Backfill semua token existing: `replay_expires_at = expires_at + interval '14 days'`.

### RPC baru
- `get_replay_access(_token_code text) returns json` — SECURITY DEFINER:
  - validasi token tidak `blocked`, dan `now() <= replay_expires_at`.
  - return list show `is_replay = true` beserta `replay_embed_url` + `replay_embed_type` (di-XOR untuk YouTube seperti playlist saat ini).
- `get_public_shows` tetap mask `replay_embed_url` (kosong) — URL hanya keluar via RPC token.

### Admin UI (`ShowManager.tsx`)
- Pada form edit show, tambah dua field di section Replay:
  - **Tipe Embed Replay** (select: m3u8 / youtube)
  - **URL Embed Replay** (input)
- Hanya muncul jika `is_replay` aktif atau show sudah selesai.

### ReplayPage
- Pastikan **semua** show dengan `is_replay = true` ditarik (audit query saat ini, hilangkan filter yang membatasi). 
- Saat user punya token aktif (cek via `get_replay_access`), tampilkan player langsung pakai `replay_embed_url`:
  - `m3u8` → komponen `VideoPlayer` existing (HLS.js)
  - `youtube` → iframe dengan overlay transparan & no-referrer (pola sama seperti live)
- Banner di atas: "Akses replay token kamu berlaku sampai {tanggal}" (dari `replay_expires_at`).

### LivePage / Halaman lain
- Pastikan show `is_replay = true` **tidak lagi** ditampilkan di Live/Schedule (audit; kemungkinan sudah benar tapi cek `LivePage` & `Index`).

## Files
- `index.html`, `tailwind.config.ts`, `src/index.css` (font + tombol class)
- `src/pages/Index.tsx`, `src/components/viewer/ShowCard.tsx`, hero/CTA components — apply `font-serif` + tombol baru
- New migration: kolom `replay_embed_url`, `replay_embed_type`, `replay_expires_at`, trigger, RPC `get_replay_access`, update `get_public_shows`
- `src/components/admin/ShowManager.tsx` — field embed replay
- `src/pages/ReplayPage.tsx` — token check + player embed + banner expiry

Tidak menyentuh logic auth, koin, atau token live existing.