
# Plan Perbaikan Player, Kompatibilitas, & Token

## 1. Quality Switch UI yang Konsisten (`src/components/viewer/VideoPlayer.tsx`)
- Tampilkan label kualitas aktif di tombol "Kualitas" (mis. `Kualitas: 720p` atau `Auto · 720p`) berdasarkan `hls.currentLevel` & `hls.levels[currentLevel].height`.
- Saat user pilih level: tandai item terpilih dengan ✓, simpan `pendingLevel`, tampilkan overlay "Mengganti ke 480p…".
- Pasang listener `Hls.Events.LEVEL_SWITCHED` untuk update label & matikan overlay.
- Fallback: jika `LEVEL_SWITCHED` tidak datang dalam 5 dtk → revert pendingLevel ke level aktif sebenarnya, sembunyikan overlay, dan tampilkan toast "Gagal pindah resolusi, tetap di Xp". Tombol/menu tetap responsif (tidak ter-disable permanen).
- Saat error level (`LEVEL_LOAD_ERROR`) untuk level tertentu, hapus level itu dari daftar yang ditawarkan dan kembali ke Auto.

## 2. Kompatibilitas PC, Mobile, TV/Proyektor & Semua Browser
- **Layout TV/Proyektor (≥1800px)**: tambahkan breakpoint utility di `tailwind.config.ts` (`tv: '1800px'`) dan terapkan di `LivePage.tsx` untuk skala kontrol/teks lebih besar (text-xl, tombol h-12).
- **Chrome/Edge desktop**: hapus pemanggilan API yang throw (`screen.orientation.lock` di desktop), bungkus dengan `try/catch` + feature-detect `isMobile && 'orientation' in screen && 'lock' in screen.orientation`.
- **Safari iOS**: gunakan `webkitEnterFullscreen()` pada `<video>` jika `requestFullscreen` tidak tersedia; untuk HLS native (Safari), pakai `video.src` langsung tanpa hls.js.
- **Smart TV / WebOS / Tizen / Android TV browser**: pastikan semua tombol bisa diakses via keyboard/remote — tambah `tabIndex={0}` & focus ring (`focus-visible:ring-2 ring-primary`) pada tombol play/pause, mute, fullscreen, kualitas, PiP.
- **Pointer events**: ganti handler `onClick` yang hanya cocok untuk mouse menjadi `onClick` + `onKeyDown` (Enter/Space) untuk remote.
- **Pastikan tidak ada CSS** yang `pointer-events: none` menutupi tombol (audit overlay watermark & quality menu z-index).

## 3. Tombol Landscape Berfungsi di Semua Perangkat
File: `VideoPlayer.tsx`
- Logika `toggleFullscreen` direvisi:
  1. Jika `<video>.webkitEnterFullscreen` ada (iOS) → panggil itu.
  2. Else `containerRef.requestFullscreen()`.
  3. Setelah fullscreen aktif: cek `screen.orientation?.lock` — kalau ada DAN device mobile (`matchMedia('(pointer: coarse)')`) → coba lock `landscape`, telan error dengan `.catch(()=>{})`.
  4. Saat keluar fullscreen → `screen.orientation.unlock?.()`.
- Tambah event listener `fullscreenchange` + `webkitfullscreenchange` untuk sync state ikon tombol di semua browser.
- Tampilkan tombol fullscreen selalu visible (tidak di-hide) di bar kontrol, dan gunakan ikon yang berubah Maximize/Minimize.

## 4. Token Benar-Benar Mengunci 1 Perangkat
Backend (migration baru):
- Update `create_token_session`:
  - Untuk token **non-public** dengan `max_devices = 1`:
    - Jika sudah ada session dengan fingerprint berbeda → return error `"Token sudah dipakai di perangkat lain"` (jangan izinkan tambah).
    - Saat ini logika sudah cek `count >= max_devices` tapi izinkan jika fingerprint sama; tetap pertahankan untuk kasus yang sama.
  - Tambahkan kolom `locked_fingerprint` pada `tokens` (text, nullable).
  - Saat session pertama dibuat, set `tokens.locked_fingerprint = _fingerprint`.
  - Penolakan berikutnya: kalau `locked_fingerprint IS NOT NULL` dan `_fingerprint <> locked_fingerprint` → tolak, walau semua session sudah dihapus (mencegah bypass via reset).
- `release_token_session` tidak menghapus `locked_fingerprint`.
- `self_reset_token_session` tetap hapus session **tetapi reset `locked_fingerprint = NULL`** hanya jika user reset (artinya mereka pindah perangkat dengan kuota harian).

## 5. Reset Kuota 3x/Hari untuk Token Durasi >3 Hari & Membership
File: function `self_reset_token_session`
- Saat ini limit hardcoded 2x/hari. Ubah jadi dinamis:
  - Default `_max_resets = 1` untuk token harian (≤3 hari).
  - Untuk token dengan `duration_type IN ('weekly','monthly')` ATAU `expires_at - created_at > 3 days` ATAU token membership (token yang ter-link ke `subscription_orders` / show subscription) → `_max_resets = 3`.
- Reset count dihitung per **hari kalender Asia/Jakarta (00:00 WIB)** — sudah benar di logika existing, pastikan tetap pakai `date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta')`.
- Update return JSON: tambah field `max_resets` agar UI bisa menampilkan "Sisa reset: 2/3".
- UI di `LivePage.tsx` (banner reset session): tampilkan kuota dinamis dari response.

## Detail Teknis Singkat
- Migration baru untuk `tokens.locked_fingerprint` + revisi 2 RPC (`create_token_session`, `self_reset_token_session`).
- Frontend: hanya `VideoPlayer.tsx`, `LivePage.tsx`, `tailwind.config.ts`.
- Tidak mengubah auth / RLS table publik.
- Pengujian: 
  - Buka token di device A → device B harus ditolak meski sudah lewat tengah malam.
  - Reset di A (kuota 1 untuk daily / 3 untuk weekly+) → A bisa pindah ke B.
  - Tombol fullscreen di Chrome desktop, Safari iOS, Android Chrome, TV browser → semua bekerja, ikon sync.
  - Ganti resolusi 720p → 480p → label tombol berubah dan overlay hilang.
