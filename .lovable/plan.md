

## Rencana: Sinkronisasi ChannelPage dengan Website Utama

### Masalah
`ChannelPage.tsx` (website cadangan) memiliki beberapa kekurangan dibanding `LivePage.tsx` (website utama):
1. **Tidak ada `playerRef`** — tombol play/pause tidak tersinkronisasi saat switch playlist
2. **Tidak ada realtime subscription** — stream status, playlist, dan site_settings tidak auto-update
3. **Tidak ada countdown/offline state** — player selalu ditampilkan meskipun stream offline
4. **Tidak ada right-click protection** pada area player
5. **Tidak ada `handlePlaylistSwitch`** yang pause dulu sebelum ganti playlist
6. **Live chat sudah terhubung** ke database yang sama (chat_messages), tapi perlu dipastikan username modal dan interaksi berfungsi

### Perubahan pada `src/pages/ChannelPage.tsx`

1. **Import `useRef`, `useCallback` dan `VideoPlayerHandle`**, tambah `playerRef`
2. **Tambah state**: `countdown`, `nextShowTime`, `watermarkUrl`
3. **Fetch `site_settings`** saat init (ambil `next_show_time` dan `watermark_image_url`)
4. **Tambah realtime subscriptions** (copy pattern dari LivePage):
   - `streams` table → auto-update `stream` state, auto-play saat live dimulai
   - `playlists` table → refresh playlist via RPC `get_playlists_for_channel`
   - `site_settings` table → update countdown/watermark
5. **Tambah countdown timer** effect (sama persis dengan LivePage)
6. **Tambah right-click prevention** pada `.player-area`
7. **Tambah `handlePlaylistSwitch`** yang pause dulu via `playerRef.current.pause()` sebelum switch
8. **Update render**:
   - Pass `ref={playerRef}` dan `autoPlay`, `watermarkUrl`, `tokenCode` ke `<VideoPlayer>`
   - Tampilkan countdown/offline state saat `!stream?.is_live` (bukan selalu player)
   - Wrap player dalam div `.player-area`
   - Playlist buttons memanggil `handlePlaylistSwitch` bukan langsung `setActivePlaylist`

### File yang Diubah
- `src/pages/ChannelPage.tsx` — satu-satunya file yang perlu diubah

### Tidak Ada Perubahan Database
Live chat sudah menggunakan tabel `chat_messages` yang sama. Tidak perlu perubahan schema atau RLS.

