# Rencana Perbaikan Halaman Live & Chat

## Temuan Akar Masalah

1. **Live chat tidak menerima pesan baru / tidak bisa kirim**
   - Tabel `chat_messages` (juga `streams`, `playlists`, `tokens`, `site_settings`) **belum** terdaftar di publikasi `supabase_realtime`. Jadi event INSERT/UPDATE tidak pernah sampai ke client → pesan baru tidak muncul kecuali refresh.
   - RLS `chat_messages` mensyaratkan user **terautentikasi** (`Authenticated can insert non-admin messages` dengan `WITH CHECK (is_admin = false)` & `REPLICA IDENTITY` untuk role `authenticated`). Penonton yang masuk via token tapi tanpa login Supabase → `insert` ditolak diam-diam (tidak ada toast error).
   - Komponen `LiveChat.sendMessage` tidak menampilkan error sehingga user mengira chat "rusak".

2. **Player blank pada YouTube**
   - Pada `VideoPlayer.tsx` (event `onReady`), iframe YouTube diberi `sandbox="allow-scripts allow-same-origin"` setelah dibuat. Penambahan atribut `sandbox` memicu iframe **reload tanpa konteks YT API** → player blank dan tidak pernah memanggil `onStateChange`. Atribut ini perlu dihapus (cukup `referrerpolicy="no-referrer"`).
   - Untuk m3u8/cloudflare layar blank umumnya akibat `signedStreamUrl` belum siap atau HLS init dipanggil ganda. Tambah guard agar `key={playerKey}` tidak ikut berubah saat URL signed di-refresh (sudah aman) dan tampilkan fallback "Coba Lagi" bila inisialisasi gagal >10 detik.

3. **Tombol navigasi tetap muncul di halaman live (mobile)**
   - `MobileBottomNav.tsx` punya daftar `HIDDEN_PREFIXES = ["/admin", "/reset-password", "/install"]`. Route `/live` tidak ada di sana, jadi bottom nav tetap tampil dan menyempitkan area chat.

4. **Login tidak persisten**
   - `supabase/client.ts` sebenarnya sudah `persistSession: true` + `localStorage`. Sesi otomatis tersimpan.
   - Masalah sebenarnya: `AdminLogin` & `ViewerAuth` tidak melakukan **redirect otomatis** kalau sesi sudah ada, jadi user merasa "harus login lagi". Tambah pengecekan `getSession()` di mount → kalau ada sesi valid + role sesuai, langsung `navigate` ke dashboard/profile.
   - Untuk LivePage: tampilkan toast "berhasil login otomatis" sekali saja agar terasa persistent.

## Perubahan

### A. Database (migrasi)
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages, public.streams, public.playlists, public.tokens, public.site_settings;` (gunakan `DO $$` untuk skip table yang sudah terdaftar agar idempotent).
- `ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;` (sudah default di-tabel public, tetap dipastikan agar payload UPDATE/DELETE lengkap).

### B. `src/components/viewer/LiveChat.tsx`
- Tampilkan toast error bila `supabase.from("chat_messages").insert(...)` mengembalikan error (terutama untuk RLS / belum login).
- Bila user belum punya session Supabase, tampilkan placeholder input "Login dulu untuk komentar" + tombol kecil ke `/auth?redirect=/live?...`.
- Pastikan channel name unik (`chat-realtime-${tokenId ?? "anon"}`) agar tidak konflik antar tab.

### C. `src/components/viewer/VideoPlayer.tsx`
- Hapus baris `iframe.setAttribute("sandbox", "allow-scripts allow-same-origin")` di handler `onReady` YouTube agar API tidak putus.
- Tambah safety: kalau `isLoading` masih `true` setelah 12 detik, tampilkan tombol "Muat Ulang Player" yang me-reset key playlist (set state baru di parent).
- Tetap `referrerpolicy="no-referrer"` untuk anti-leak.

### D. `src/components/viewer/MobileBottomNav.tsx`
- Tambahkan `"/live"` ke `HIDDEN_PREFIXES` agar bottom nav hilang di halaman live → area chat lebih luas.

### E. `src/pages/LivePage.tsx`
- Tambah handler `onPlayerStuck` yang men-set state `playerReloadKey` (di-suffix ke `playerKey`) supaya tombol "Muat Ulang Player" berfungsi.
- Sembunyikan elemen header link `← Kembali` saat fullscreen / mobile chat tampil (opsional minor).

### F. `src/pages/AdminLogin.tsx` & `src/pages/ViewerAuth.tsx`
- Pada mount: panggil `supabase.auth.getSession()`. Bila ada session:
  - AdminLogin: cek role admin/moderator → redirect `/admin/dashboard`.
  - ViewerAuth: redirect ke `/profile` (atau ke `?redirect=...` bila ada).
- Pasang listener `supabase.auth.onAuthStateChange` agar perubahan login langsung terdeteksi.

## Catatan Teknis
- Tidak ada perubahan logika bisnis lain; fokus hanya pada perbaikan bug di atas.
- Migrasi realtime aman untuk produksi (idempotent) dan tidak merubah data.
- Tidak ada perubahan pada RPC keamanan (`get_playlists_for_token`, `validate_token`).
