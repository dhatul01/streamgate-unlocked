

# RealTime48 — Full Implementation Plan

## Summary
Build a secure streaming platform with token-based access, multi-source video player (YouTube/m3u8/Cloudflare), admin panel, and real-time global chat — all powered by Lovable Cloud (Supabase).

---

## Phase 1: Foundation Setup

### Logo & Branding
- Copy uploaded image to `public/logo.png` and `src/assets/logo.png`
- Update `index.html`: favicon, title "RealTime48", OG meta tags
- Dark blue-black theme: background `hsl(222, 47%, 4%)`, surfaces `hsl(222, 47%, 7%)`, accent Electric Blue `hsl(217, 91%, 60%)`

### Supabase (Lovable Cloud) Setup
- Connect Lovable Cloud to the project
- Enable Supabase Auth (email/password)

### Database Schema
- **`streams`** — id, title, description, is_live (boolean), created_at
- **`playlists`** — id, stream_id, label, type (youtube/m3u8/cloudflare), url, sort_order
- **`tokens`** — id, code (rt48_xxxx), max_devices, duration_type (daily/weekly/monthly), expires_at, status (active/blocked), created_at
- **`token_sessions`** — id, token_id, fingerprint, user_agent, connected_at
- **`chat_messages`** — id, username, message, token_id, is_pinned, created_at
- **`blocked_users`** — id, token_id, reason, blocked_at
- **`user_roles`** — id, user_id (FK auth.users), role (admin enum)
- RLS policies on all tables; `has_role()` security definer function for admin checks

---

## Phase 2: Pages & Routing

### Routes
- `/live?t=TOKEN` — Viewer page (token-gated)
- `/admin` — Admin login
- `/admin/dashboard` — Admin panel (protected)
- `/` — Landing/redirect

---

## Phase 3: Viewer Page (`/live?t=...`)

### Token Validation
- On load: validate token from URL param against `tokens` table
- Check: not expired, not blocked, device count within limit
- Record device fingerprint in `token_sessions`; auto-release on `beforeunload` via `sendBeacon`

### Video Player
- **YouTube**: Embed via IFrame API, overlay with `pointer-events-none` div to block clicks. Custom Play/Pause buttons control via `postMessage` / YT API. Landscape/Portrait toggle via Screen Orientation API
- **m3u8**: HLS.js player with quality level selector from manifest
- **Cloudflare Stream**: iframe embed with resolution controls
- Playlist switcher: tabs/dropdown to switch between sources from admin-configured playlists

### Restream Protection
- Floating watermark: `RE-[last 4 chars of token]` at low opacity, repositioning randomly every 30s
- Disable right-click on player area

### Global Live Chat (always visible)
- Username prompt modal before chatting
- Supabase Realtime subscription for live messages
- Admin messages show badge/glow "STAFF" tag
- Pinned messages shown at top
- Chat functional even when live is OFF (banner shows "Live sedang tidak aktif")
- Auto-reset at 00:00 UTC via Edge Function (scheduled)

---

## Phase 4: Admin Panel

### Admin Auth
- Login page with email/password via Supabase Auth
- Role check via `user_roles` table + `has_role()` function
- Settings page: update email and password via `supabase.auth.updateUser()`

### Dashboard Sections
1. **Live Control** — Toggle live on/off, edit title & description
2. **Playlist Manager** — CRUD video sources (YouTube ID, m3u8 URL, Cloudflare URL), reorder, label each source
3. **Token Factory** — Generate tokens with duration (1 day/7 days/30 days) and device limit (1-5). Token format: `rt48_[random]`. Copy full link. Search/filter/sort tokens table. Actions: reset sessions, block, delete (single/bulk/selection via checkboxes)
4. **Monitor** — Embedded player showing current live source + live chat mirror with admin moderation tools (pin, delete message, block user)
5. **Settings** — Change admin email & password

---

## Phase 5: Responsive Design (PC, Mobile, TV)

```text
Breakpoints:
  mobile:  < 768px    → stacked layout, chat below player, bottom drawer
  tablet:  768-1279px → side-by-side, collapsible chat
  desktop: 1280-1799px → full layout with sidebar chat
  tv:      >= 1800px  → enlarged UI, 20px base font, large controls
```

- Custom `tv` Tailwind breakpoint at 1800px
- Min 48px touch targets for mobile/TV
- `aspect-video` container for player at all sizes
- Orientation lock support for mobile

---

## Phase 6: Edge Functions

1. **validate-token** — Token + device session validation endpoint
2. **release-session** — `sendBeacon` endpoint to clear device session on tab close
3. **reset-chat** — Scheduled function to clear chat_messages at 00:00 UTC

---

## Technical Notes
- Using HLS.js for m3u8 playback with quality switching
- YouTube IFrame API for programmatic play/pause without user clicking the iframe
- Device fingerprinting via combination of user-agent + screen resolution + localStorage ID
- All admin operations protected by RLS + `has_role()` check
- Supabase Realtime channels for live chat

This is a very large project. Implementation will be done incrementally across multiple messages, starting with Supabase setup, then core pages, then features.

