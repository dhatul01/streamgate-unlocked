## Tujuan
Memecah `src/pages/Index.tsx` (1237 baris) menjadi komponen-komponen presentasional kecil agar JSX lebih ringkas, mudah dirawat, dan minim risiko error JSX seperti yang sempat terjadi. Fokus refactor murni di layer presentasi — tanpa mengubah logika, RPC, atau alur Pakasir/koin yang sudah berjalan.

## Komponen yang akan dibuat (di `src/components/landing/`)

1. **`LandingNavbar.tsx`** — navbar atas + tombol coin shop + Sheet profil/koin.
2. **`HeroSection.tsx`** — hero + floating particles + CTA scroll.
3. **`AnnouncementBanner.tsx`** — banner pengumuman multi-baris (jika ada).
4. **`DescriptionsSection.tsx`** — grid kartu deskripsi landing.
5. **`SubscriptionsSection.tsx`** — banner langganan (Membership card list).
6. **`ShowsSection.tsx`** — grid show reguler + tombol beli/koin/tonton replay.
7. **`PurchaseModal.tsx`** — modal pembelian (Pakasir QRIS info → QR → done; subscription QRIS upload → info → done).
8. **`CoinPurchaseDialog.tsx`** — dialog beli pakai koin + hasil token + replay password.
9. **`ReplayPasswordDialog.tsx`** — dialog wajib copy password replay.

## Yang TIDAK dipindah
- Semua `useState`, `useEffect`, RPC call, handler (`handleConfirmRegular`, `handleUploadProof`, `handleSubmitSubscription`, `handleCoinRedeem`, `pollPakasirOrder`, dll) tetap di `Index.tsx`.
- Helper waktu (`isShowPastSchedule`, `isShowPast2Hours`, `isShowPast4Hours`, `isShowReplayMode`) tetap di `Index.tsx` dan dioper sebagai props.
- Tidak menyentuh `useShowPurchase`, edge function, RPC, atau migration.

## Cara passing data
Setiap komponen menerima props eksplisit (data + handler) dari `Index.tsx`. Tidak menggunakan context baru agar perubahan minimal dan diff mudah di-review. Tipe `Show`, `LandingDescription`, `SiteSettings` di-share via export dari file types kecil baru `src/components/landing/types.ts` (atau di-import kembali dari `Index.tsx`).

## Detail teknis

```text
src/pages/Index.tsx                 (logic + state, ~400 baris)
└─ src/components/landing/
   ├─ types.ts                       (Show, LandingDescription, SiteSettings)
   ├─ LandingNavbar.tsx
   ├─ HeroSection.tsx
   ├─ AnnouncementBanner.tsx
   ├─ DescriptionsSection.tsx
   ├─ SubscriptionsSection.tsx
   ├─ ShowsSection.tsx
   ├─ PurchaseModal.tsx
   ├─ CoinPurchaseDialog.tsx
   └─ ReplayPasswordDialog.tsx
```

Catatan: sudah ada `src/components/viewer/PurchaseModal.tsx` yang berbeda (dipakai komponen lain). File baru diletakkan di folder `landing/` agar tidak bentrok.

## Verifikasi
- Jalankan `vite build` untuk memastikan tidak ada error JSX/TS.
- Buka preview `/` untuk smoke test: hero, list show, klik beli (Pakasir flow), klik beli koin, replay password modal, sheet profil.

## Risiko
- Refactor besar → potensi typo di props. Mitigasi: pindahkan satu section per satu, lalu build setiap kali.
- Tidak ada perubahan fungsional yang dijanjikan ke user di luar struktur file.
