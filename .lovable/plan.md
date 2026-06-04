# Fitur Lirik Lagu JKT48 di Panel Chat

Menambahkan tab **Lirik** di sebelah **Chat** pada halaman Live. User bisa berpindah bebas tanpa kehilangan lirik yang sedang dibuka. Lirik dan referensi setlist disimpan di database — admin dan user bisa menambahkan, dengan moderasi admin.

## Struktur UI

```text
┌─ Panel Kanan ───────────────────┐
│ [ Chat ]  [ Lirik ]   ← tabs    │
├─────────────────────────────────┤
│ Mode Lirik:                     │
│  ┌─ Kalau lirik aktif ──────┐   │
│  │ Judul Lagu          [X]  │   │ ← X = tutup lirik, kembali pilih
│  │ ─────────────────────    │   │
│  │ [scroll teks lirik]      │   │
│  │ Sumber: link ke situs    │   │
│  └──────────────────────────┘   │
│                                  │
│  ┌─ Kalau belum pilih ──────┐   │
│  │ 🔍 Cari lirik...         │   │
│  │                          │   │
│  │ Setlist:                 │   │
│  │ • Sambil Menggandeng…    │   │
│  │ • Pajama Drive           │   │
│  │ • Cara Meminum Ramuan    │   │
│  │ • Pajama Drive Passion   │   │
│  │ • Dream Bakudan          │   │
│  │ • Otadaki Love           │   │
│  │                          │   │
│  │ [+ Tambah lirik]         │   │
│  └──────────────────────────┘   │
└──────────────────────────────────┘
```

Flow:
1. User klik setlist → daftar judul lagu dari setlist itu muncul → pilih judul → lirik tampil.
2. Tombol **X** di header lirik = kembali ke daftar (lirik dibersihkan dari state).
3. Pindah ke tab **Chat** tidak menghilangkan lirik — saat tab Lirik dibuka lagi, lirik yang sama masih tampil. Disimpan di `localStorage` (`jkt48_active_lyric_id`).
4. Kolom **Cari** mencari lintas semua lirik (judul + setlist).
5. Tombol **+ Tambah lirik** membuka dialog: judul, setlist, isi lirik, sumber URL. User submit → masuk antrian moderasi (`status='pending'`). Admin approve → tampil ke semua user.

## Database (3 tabel baru)

`jkt48_setlists` — daftar setlist (seed 6 setlist permintaan user).
- nama, slug, urutan tampil, aktif

`jkt48_songs` — judul lagu per setlist.
- setlist_id, judul, urutan tampil

`jkt48_lyrics` — lirik per lagu.
- song_id, isi lirik, url sumber, kontributor (user id atau 'admin'), status (`pending`/`approved`/`rejected`), approved_by

RLS:
- Setlists & songs: SELECT publik untuk yang aktif. INSERT/UPDATE/DELETE admin only.
- Lyrics: SELECT publik hanya untuk `status='approved'`. INSERT authenticated user (default pending). UPDATE/DELETE admin only. User bisa lihat submission-nya sendiri.

Seed data: 6 setlist yang user sebut. Daftar lagu per setlist & isi lirik **dikosongkan** — diisi admin/user lewat UI (alasan: hak cipta, kami tidak menyalin lirik resmi ke seed).

## Panel Admin

Section baru di `AdminDashboard` → **Lirik JKT48**:
- Tab "Setlist": CRUD setlist (nama, urutan, aktif).
- Tab "Lagu": CRUD lagu per setlist.
- Tab "Lirik": list semua lirik. Filter status. Approve/reject submission user. Edit/hapus lirik. Field URL sumber (situs referensi lirik).

## File yang Dibuat / Diubah

Baru:
- `src/components/viewer/LyricsPanel.tsx` — UI tab Lirik (search, setlist list, song list, lyric viewer, dialog tambah).
- `src/components/viewer/ChatLyricsTabs.tsx` — wrapper dengan 2 tab (Chat | Lirik), keep-alive (kedua komponen tetap mounted, hanya `hidden`) supaya state Chat & Lirik tidak reset saat ganti tab.
- `src/components/admin/LyricsManager.tsx` — panel admin 3 tab.
- `src/hooks/useActiveLyric.ts` — sinkron lirik aktif ke `localStorage`.

Diubah:
- `src/pages/LivePage.tsx` — ganti `<LiveChat>` di kolom kanan dengan `<ChatLyricsTabs>`.
- `src/components/admin/AdminSidebar.tsx` + `AdminDashboard.tsx` — tambah menu "Lirik JKT48".

## Catatan Hak Cipta

Lirik lagu JKT48/AKB48 berhak cipta. Pendekatan ini menempatkan tanggung jawab konten pada admin/kontributor (mirip wiki). Kami **tidak** menyalin lirik di seed dan **tidak** memakai AI untuk membangkitkan teks lirik. Field "URL sumber" wajib diisi kontributor agar pembaca bisa verifikasi ke sumber resmi. Admin yang memutuskan publikasi.

## Yang Tidak Dilakukan

- Tidak memakai Google AI / Lovable AI untuk menghasilkan teks lirik (risiko hukum + sering tidak akurat).
- Tidak menyentuh logika Video Player atau Watermark.
- Tidak mengubah skema chat.