# Perbaikan Halaman Live & Performa Global

## 1. Sembunyikan Bottom Navigation di Halaman Live
**File:** `src/components/viewer/MobileBottomNav.tsx` (sudah ada `/live` di `HIDDEN_PREFIXES`, tapi nav masih muncul di screenshot).

- Periksa `src/App.tsx` untuk memastikan `MobileBottomNav` di-mount di tempat yang konsisten dan tidak ada nav duplikat (misalnya dari `SharedNavbar`).
- Tambahkan pengecekan `useLocation` yang lebih ketat: hide jika `pathname === "/live"` ATAU `pathname.startsWith("/live")` ATAU ada query `?t=...`.
- Tambahkan fallback CSS guard di `LivePage.tsx`: render `<style>nav[data-bottom-nav]{display:none!important}</style>` lokal, dan tambahkan atribut `data-bottom-nav` ke `<nav>` di `MobileBottomNav` agar pasti tersembunyi pada device tertentu yang sudah cache HTML lama.

## 2. Klik Layar Player ≠ Play/Pause
**File:** `src/components/viewer/VideoPlayer.tsx`

- Hapus `onClick={togglePlay}` dari:
  - `<video>` element (m3u8) — ganti hanya untuk show/hide controls.
  - Overlay div di YouTube branch.
  - Overlay div di Cloudflare branch.
- Ganti perilaku klik menjadi *toggle visibility kontrol* saja (set `setShowControls(prev => !prev)` + reset auto-hide timer). Overlay tetap ada untuk memblokir interaksi native (link YT, dll) tapi tidak memicu play/pause.
- Tombol play/pause di bar kontrol tetap satu-satunya cara pause/play.

## 3. Quality Selector m3u8 Benar-benar Berfungsi
**File:** `src/components/viewer/VideoPlayer.tsx`

- Pastikan `handleQualityChange` untuk m3u8:
  - Set `hls.nextLevel = index` (untuk perpindahan halus segmen berikutnya) selain `currentLevel`.
  - Tampilkan overlay "Mengganti resolusi…" sampai event `LEVEL_SWITCHED` benar-benar selesai (pakai timeout 5 dtk fallback agar tidak ngambang).
  - Untuk pilihan `Auto` (index `-1`): set `hls.currentLevel = -1` dan `hls.nextLevel = -1` lalu reset ABR (`hls.loadLevel = -1`).
- Pastikan label level diambil dari `level.height || level.bitrate` agar selalu muncul nama seperti `720p`, `480p`, dst.
- Tutup menu kualitas otomatis saat klik di luar (event listener `pointerdown` global).

## 4. Ringankan Aplikasi & Kompatibilitas Chrome
**File:** `vite.config.ts`, `src/main.tsx`, beberapa komponen viewer.

- **Build splitting:** Tambah `manualChunks` di `vite.config.ts` untuk memisahkan `hls.js`, `recharts`, `@radix-ui/*`, `lucide-react` ke chunk sendiri sehingga halaman landing tidak menarik HLS.
- **Lazy import HLS lebih agresif:** sudah `await import("hls.js")` — tambah `webpackPrefetch`/`vite` magic comment `/* @vite-ignore */` tidak perlu, cukup pastikan `hls.js` tidak di-bundle ke entry.
- **Hindari API yang gagal di Chrome desktop:** bungkus `screen.orientation.lock` dengan deteksi `'lock' in screen.orientation` (di Chrome desktop akan throw — sudah di-try/catch tapi tetap blokir flow di beberapa versi).
- **Polyfill ringan:** pastikan `target: 'es2020'` di `vite.config.ts` agar Chrome lama (≥ 90) tetap jalan tanpa error syntax.
- Ganti beberapa `setInterval` polling (di `LivePage`) menjadi pakai `visibilitychange` + pause polling saat tab tidak aktif untuk menurunkan CPU.

## 5. Hapus Cache Lama Saat User Membuka Website
**File:** `src/main.tsx`, `vite.config.ts` (PWA plugin).

- Tambah versi build constant (`__APP_VERSION__` dari `package.json`) di `vite.config.ts` `define`.
- Di `src/main.tsx`, sebelum render:
  - Bandingkan `localStorage.getItem('app_version')` dengan `__APP_VERSION__`.
  - Jika beda: hapus semua `caches.keys()` (`caches.delete(...)`), unregister semua `serviceWorker.getRegistrations()` lama, set ulang versi, lalu `location.reload()` satu kali (guard agar tidak loop pakai `sessionStorage` flag).
- Pada PWA `registerSW`:
  - Set `onNeedRefresh` agar otomatis aktivasi `updateSW(true)` (sudah ada) DAN `skipWaiting: true`, `clientsClaim: true` di workbox config (`vite.config.ts`).
- Tambahkan meta tag `Cache-Control: no-cache` untuk `index.html` melalui `vite.config.ts` `transformIndexHtml`.

## Detail Teknis Singkat
- Tidak ada perubahan database / RLS.
- Tidak ada perubahan auth / login flow.
- Semua perubahan murni frontend + konfigurasi Vite/PWA.
- Pengujian: buka `/live?t=...` di Chrome mobile & desktop → bottom nav hilang, klik area video tidak pause, ganti resolusi 720p→480p → video benar-benar berpindah, refresh halaman versi baru → cache lama otomatis terhapus tanpa user harus clear manual.
