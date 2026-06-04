import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, ChevronRight, Plus, ExternalLink, Music, ArrowLeft, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import { useActiveLyric } from "@/hooks/useActiveLyric";

interface Setlist { id: string; name: string; sort_order: number; }
interface Song { id: string; setlist_id: string; title: string; sort_order: number; }
interface Lyric { id: string; song_id: string; content: string; source_url: string; status: string; is_link_only?: boolean; external_title?: string; }

const LyricsPanel = () => {
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [lyrics, setLyrics] = useState<Lyric[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLyricId, setActiveLyricId] = useActiveLyric();
  const [view, setView] = useState<"setlists" | "songs" | "search">("setlists");
  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = async () => {
    setLoading(true);
    const [sl, sg, ly] = await Promise.all([
      supabase.from("jkt48_setlists").select("id,name,sort_order").eq("is_active", true).order("sort_order"),
      supabase.from("jkt48_songs").select("id,setlist_id,title,sort_order").eq("is_active", true).order("sort_order"),
      supabase.from("jkt48_lyrics").select("id,song_id,content,source_url,status,is_link_only,external_title").eq("status", "approved"),
    ]);
    setSetlists((sl.data as Setlist[]) || []);
    setSongs((sg.data as Song[]) || []);
    setLyrics((ly.data as Lyric[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase
      .channel("jkt48-lyrics-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "jkt48_lyrics" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "jkt48_songs" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "jkt48_setlists" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const songsBySetlist = useMemo(() => {
    const m = new Map<string, Song[]>();
    for (const s of songs) {
      if (!m.has(s.setlist_id)) m.set(s.setlist_id, []);
      m.get(s.setlist_id)!.push(s);
    }
    return m;
  }, [songs]);

  const lyricBySong = useMemo(() => {
    const m = new Map<string, Lyric>();
    for (const l of lyrics) m.set(l.song_id, l);
    return m;
  }, [lyrics]);

  const songById = useMemo(() => {
    const m = new Map<string, Song>();
    for (const s of songs) m.set(s.id, s);
    return m;
  }, [songs]);

  const setlistById = useMemo(() => {
    const m = new Map<string, Setlist>();
    for (const s of setlists) m.set(s.id, s);
    return m;
  }, [setlists]);

  const activeLyric = activeLyricId ? lyrics.find((l) => l.id === activeLyricId) : null;
  const activeSong = activeLyric ? songById.get(activeLyric.song_id) : null;
  const activeSetlist = activeSong ? setlistById.get(activeSong.setlist_id) : null;

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return songs.filter((s) => {
      const sl = setlistById.get(s.setlist_id);
      return s.title.toLowerCase().includes(q) || (sl?.name.toLowerCase().includes(q));
    }).slice(0, 30);
  }, [search, songs, setlistById]);

  const openSong = (songId: string) => {
    const lyric = lyricBySong.get(songId);
    if (!lyric) {
      toast.info("Lirik belum tersedia. Silakan submit lirik untuk lagu ini.");
      return;
    }
    setActiveLyricId(lyric.id);
  };

  const closeLyric = () => setActiveLyricId(null);

  // === Active lyric view ===
  if (activeLyric && activeSong) {
    return (
      <div className="flex h-full flex-col bg-card/50">
        <div className="flex items-start justify-between gap-2 border-b border-border bg-card px-4 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-foreground tv:text-base">{activeSong.title}</h3>
            {activeSetlist && <p className="truncate text-[10px] text-muted-foreground tv:text-xs">Setlist: {activeSetlist.name}</p>}
          </div>
          <button
            onClick={closeLyric}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Tutup lirik"
            aria-label="Tutup lirik"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 tv:px-6">
          {activeLyric.is_link_only ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/40 p-6 text-center">
              <ExternalLink className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Lirik tersedia di situs sumber</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Untuk menghormati hak cipta, lirik lagu ini tidak disalin ke sini. Buka link di bawah untuk membaca lirik resmi.
                </p>
              </div>
              {activeLyric.source_url && (
                <a
                  href={activeLyric.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Buka di situs sumber
                </a>
              )}
            </div>
          ) : (
            <>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground/90 tv:text-base">
                {activeLyric.content}
              </pre>
              {activeLyric.source_url && (
                <a
                  href={activeLyric.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                >
                  <ExternalLink className="h-3 w-3" /> Sumber lirik
                </a>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // === Browser view ===
  return (
    <div className="flex h-full flex-col bg-card/50">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          {view === "songs" && (
            <button
              onClick={() => { setView("setlists"); setSelectedSetlistId(null); }}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Kembali"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Music className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tv:text-base">Lirik JKT48</h3>
            <p className="text-[10px] text-muted-foreground tv:text-xs">
              {view === "songs" && selectedSetlistId ? setlistById.get(selectedSetlistId)?.name : "Pilih setlist atau cari lagu"}
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-card/50 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setView(e.target.value.trim() ? "search" : "setlists"); }}
            placeholder="Cari judul lagu JKT48..."
            className="h-9 pl-8 text-xs"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setView("setlists"); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Hapus pencarian"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        {loading && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!loading && view === "setlists" && (
          <div className="space-y-1">
            {setlists.map((s) => {
              const count = songsBySetlist.get(s.id)?.length || 0;
              return (
                <button
                  key={s.id}
                  onClick={() => { setSelectedSetlistId(s.id); setView("songs"); }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground tv:text-base">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground tv:text-xs">{count} lagu</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
            {setlists.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">Belum ada setlist</p>
            )}
          </div>
        )}

        {!loading && view === "songs" && selectedSetlistId && (
          <div className="space-y-1">
            {(songsBySetlist.get(selectedSetlistId) || []).map((song) => {
              const hasLyric = lyricBySong.has(song.id);
              return (
                <button
                  key={song.id}
                  onClick={() => openSong(song.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-secondary/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground tv:text-base">{song.title}</p>
                    {!hasLyric && <p className="text-[10px] text-warning">Lirik belum tersedia</p>}
                  </div>
                  {hasLyric && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
              );
            })}
            {(songsBySetlist.get(selectedSetlistId)?.length || 0) === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">Belum ada lagu di setlist ini</p>
            )}
          </div>
        )}

        {!loading && view === "search" && (
          <div className="space-y-1">
            {searchResults.map((song) => {
              const sl = setlistById.get(song.setlist_id);
              const hasLyric = lyricBySong.has(song.id);
              return (
                <button
                  key={song.id}
                  onClick={() => openSong(song.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-secondary/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground tv:text-base">{song.title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {sl?.name} {!hasLyric && "· lirik belum tersedia"}
                    </p>
                  </div>
                  {hasLyric && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
              );
            })}
            {searchResults.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">Tidak ada hasil</p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border bg-card p-3">
        <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Sumbang Lirik
            </Button>
          </DialogTrigger>
          <SubmitLyricDialog
            open={submitOpen}
            onClose={() => setSubmitOpen(false)}
            setlists={setlists}
            songsBySetlist={songsBySetlist}
            hasSession={hasSession}
          />
        </Dialog>
      </div>
    </div>
  );
};

const SubmitLyricDialog = ({ open, onClose, setlists, songsBySetlist, hasSession }: {
  open: boolean;
  onClose: () => void;
  setlists: Setlist[];
  songsBySetlist: Map<string, Song[]>;
  hasSession: boolean;
}) => {
  const [setlistId, setSetlistId] = useState("");
  const [songId, setSongId] = useState("");
  const [newSongTitle, setNewSongTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { if (!open) { setSetlistId(""); setSongId(""); setNewSongTitle(""); setContent(""); setSourceUrl(""); } }, [open]);

  const submit = async () => {
    if (!hasSession) { toast.error("Login dulu untuk submit lirik"); return; }
    if (!setlistId) { toast.error("Pilih setlist"); return; }
    if (!content.trim() || content.trim().length < 20) { toast.error("Lirik terlalu pendek"); return; }
    if (!sourceUrl.trim()) { toast.error("URL sumber lirik wajib diisi"); return; }

    setSending(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { toast.error("Sesi tidak valid"); setSending(false); return; }

    let finalSongId = songId;
    if (!finalSongId && newSongTitle.trim()) {
      // Need admin to create song. Save as pending with placeholder via inserting a song... but only admins can.
      // Instead require user to pick an existing song.
      toast.error("Admin akan menambah judul baru. Untuk sekarang pilih lagu yang sudah ada.");
      setSending(false);
      return;
    }
    if (!finalSongId) { toast.error("Pilih judul lagu"); setSending(false); return; }

    const { data: profile } = await supabase.from("profiles").select("username").eq("id", uid).maybeSingle();

    const { error } = await supabase.from("jkt48_lyrics").insert({
      song_id: finalSongId,
      content: content.trim(),
      source_url: sourceUrl.trim(),
      contributor_user_id: uid,
      contributor_name: profile?.username || "",
      status: "pending",
    });
    setSending(false);
    if (error) { toast.error("Gagal submit", { description: error.message }); return; }
    toast.success("Lirik dikirim, menunggu approval admin");
    onClose();
  };

  const songsForSetlist = setlistId ? (songsBySetlist.get(setlistId) || []) : [];

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Sumbang Lirik JKT48</DialogTitle>
      </DialogHeader>
      {!hasSession ? (
        <p className="text-sm text-muted-foreground">Login dulu untuk submit lirik. Submission akan ditinjau admin.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Setlist</label>
            <Select value={setlistId} onValueChange={(v) => { setSetlistId(v); setSongId(""); }}>
              <SelectTrigger><SelectValue placeholder="Pilih setlist" /></SelectTrigger>
              <SelectContent>
                {setlists.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Judul Lagu</label>
            <Select value={songId} onValueChange={setSongId} disabled={!setlistId}>
              <SelectTrigger><SelectValue placeholder={setlistId ? "Pilih judul lagu" : "Pilih setlist dulu"} /></SelectTrigger>
              <SelectContent>
                {songsForSetlist.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                {songsForSetlist.length === 0 && <div className="p-2 text-xs text-muted-foreground">Belum ada lagu. Minta admin tambahkan judul dulu.</div>}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Isi Lirik</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="Tempel isi lirik di sini..."
              maxLength={10000}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">URL Sumber (wajib)</label>
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              maxLength={500}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">Lirik akan diperiksa admin sebelum tampil.</p>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Batal</Button>
        {hasSession && <Button onClick={submit} disabled={sending}>{sending ? "Mengirim..." : "Kirim"}</Button>}
      </DialogFooter>
    </DialogContent>
  );
};

export default LyricsPanel;
