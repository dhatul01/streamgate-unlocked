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
  const [view, setView] = useState<"setlists" | "songs" | "search" | "online">("setlists");
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

  // === Online search view (in-panel, no leaving site) ===
  if (view === "online") {
    return (
      <OnlineSearchPanel onBack={() => setView("setlists")} />
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
        <button
          onClick={() => setView("online")}
          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 tv:text-xs"
          title="Cari lirik di Google / mesin pencari lain tanpa keluar dari sini"
        >
          <Globe className="h-3 w-3" /> Cari Online
        </button>
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

const SubmitLyricDialog = ({ open, onClose, setlists, hasSession }: {
  open: boolean;
  onClose: () => void;
  setlists: Setlist[];
  songsBySetlist: Map<string, Song[]>;
  hasSession: boolean;
}) => {
  const NO_SETLIST = "__none__";
  const [setlistId, setSetlistId] = useState<string>(NO_SETLIST);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isLinkOnly, setIsLinkOnly] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setSetlistId(NO_SETLIST); setTitle(""); setContent(""); setSourceUrl(""); setIsLinkOnly(false);
    }
  }, [open]);

  const submit = async () => {
    if (!hasSession) { toast.error("Login dulu untuk menyumbang lirik"); return; }
    const t = title.trim();
    if (t.length < 2) { toast.error("Judul lagu wajib diisi"); return; }
    if (isLinkOnly) {
      if (!sourceUrl.trim()) { toast.error("Mode link wajib URL sumber"); return; }
    } else {
      if (content.trim().length < 20) { toast.error("Lirik minimal 20 karakter"); return; }
    }

    setSending(true);
    const { data, error } = await supabase.rpc("submit_lyric_contribution", {
      _title: t,
      _setlist_id: setlistId === NO_SETLIST ? null : setlistId,
      _content: isLinkOnly ? "" : content,
      _source_url: sourceUrl.trim(),
      _is_link_only: isLinkOnly,
    } as any);
    setSending(false);
    const res = data as any;
    if (error || !res?.success) {
      toast.error("Gagal mengirim", { description: res?.error || error?.message || "Unknown" });
      return;
    }
    toast.success("Sumbangan dikirim — menunggu persetujuan admin");
    onClose();
  };

  return (
    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Sumbang Lirik JKT48</DialogTitle>
      </DialogHeader>
      {!hasSession ? (
        <p className="text-sm text-muted-foreground">Login dulu untuk menyumbang lirik. Sumbanganmu akan ditinjau admin sebelum tampil.</p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-warning/30 bg-warning/5 p-2.5">
            <p className="text-[11px] text-muted-foreground">
              Kamu hanya bisa <span className="font-semibold text-foreground">menyumbang</span>. Sumbangan tidak menimpa lirik yang sudah ada — admin akan meninjau dulu. Lirik yang sudah disetujui tidak bisa kamu ubah atau hapus.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Setlist (opsional)</label>
            <Select value={setlistId} onValueChange={setSetlistId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SETLIST}>Tanpa setlist</SelectItem>
                {setlists.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Judul Lagu</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul lagu JKT48"
              maxLength={200}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-card p-2.5">
            <div>
              <p className="text-xs font-semibold">Mode link saja</p>
              <p className="text-[10px] text-muted-foreground">Hanya simpan link ke situs lirik (tanpa menyalin teks).</p>
            </div>
            <input
              type="checkbox"
              checked={isLinkOnly}
              onChange={(e) => setIsLinkOnly(e.target.checked)}
              className="h-4 w-4"
            />
          </div>

          {!isLinkOnly && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Isi Lirik</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder="Tempel isi lirik di sini..."
                maxLength={20000}
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              URL Sumber {isLinkOnly ? "(wajib)" : "(opsional, tapi dianjurkan)"}
            </label>
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              maxLength={500}
            />
          </div>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Batal</Button>
        {hasSession && <Button onClick={submit} disabled={sending}>{sending ? "Mengirim..." : "Kirim untuk Ditinjau"}</Button>}
      </DialogFooter>
    </DialogContent>
  );
};

// === Online search panel — Google/DuckDuckGo/Bing/Genius without leaving the site ===
const ONLINE_QUERY_KEY = "jkt48_online_search_q";
const ONLINE_ENGINE_KEY = "jkt48_online_search_engine";

type Engine = "ddg" | "google" | "bing" | "genius";

const buildSearchUrl = (engine: Engine, q: string) => {
  const fullQ = `${q} JKT48 lirik`;
  const enc = encodeURIComponent(fullQ);
  switch (engine) {
    case "ddg": return `https://duckduckgo.com/?q=${enc}&kp=-2&kl=id-id`;
    case "google": return `https://www.google.com/search?q=${enc}`;
    case "bing": return `https://www.bing.com/search?q=${enc}`;
    case "genius": return `https://genius.com/search?q=${encodeURIComponent(q + " JKT48")}`;
  }
};

const buildEmbedUrl = (engine: Engine, q: string) => {
  const fullQ = `${q} JKT48 lirik`;
  const enc = encodeURIComponent(fullQ);
  // DuckDuckGo HTML version generally allows embedding via iframe.
  if (engine === "ddg") return `https://html.duckduckgo.com/html/?q=${enc}&kl=id-id`;
  // Google/Bing/Genius typically block framing — we use them as "open new tab" only.
  return null;
};

const OnlineSearchPanel = ({ onBack }: { onBack: () => void }) => {
  const [query, setQuery] = useState<string>(() => {
    try { return localStorage.getItem(ONLINE_QUERY_KEY) || ""; } catch { return ""; }
  });
  const [engine, setEngine] = useState<Engine>(() => {
    try { return (localStorage.getItem(ONLINE_ENGINE_KEY) as Engine) || "ddg"; } catch { return "ddg"; }
  });
  const [submitted, setSubmitted] = useState<string>(query);
  const [iframeFailed, setIframeFailed] = useState(false);

  useEffect(() => { try { localStorage.setItem(ONLINE_QUERY_KEY, query); } catch {} }, [query]);
  useEffect(() => { try { localStorage.setItem(ONLINE_ENGINE_KEY, engine); } catch {} }, [engine]);

  const go = () => {
    setIframeFailed(false);
    setSubmitted(query.trim());
  };

  const embedUrl = submitted ? buildEmbedUrl(engine, submitted) : null;
  const openUrl = submitted ? buildSearchUrl(engine, submitted) : null;

  const engines: { id: Engine; label: string }[] = [
    { id: "ddg", label: "DuckDuckGo" },
    { id: "google", label: "Google" },
    { id: "bing", label: "Bing" },
    { id: "genius", label: "Genius" },
  ];

  return (
    <div className="flex h-full flex-col bg-card/50">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Globe className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tv:text-base">Cari Lirik Online</h3>
            <p className="text-[10px] text-muted-foreground tv:text-xs">Tetap di sini — hasil ditampilkan di dalam panel</p>
          </div>
        </div>
      </div>

      <div className="space-y-2 border-b border-border bg-card/50 p-3">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") go(); }}
            placeholder="Judul lagu JKT48..."
            className="h-9 text-xs"
          />
          <Button size="sm" onClick={go} disabled={!query.trim()} className="shrink-0 gap-1.5">
            <Search className="h-3.5 w-3.5" /> Cari
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {engines.map((e) => (
            <button
              key={e.id}
              onClick={() => { setEngine(e.id); setIframeFailed(false); }}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition ${
                engine === e.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        {!submitted ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
            Ketik judul lagu lalu klik Cari. Hasil akan muncul di panel ini tanpa keluar dari website.
          </div>
        ) : embedUrl && !iframeFailed ? (
          <>
            <iframe
              key={`${engine}-${submitted}`}
              src={embedUrl}
              title="Hasil pencarian"
              className="absolute inset-0 h-full w-full border-0 bg-white"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              onError={() => setIframeFailed(true)}
            />
            {openUrl && (
              <a
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-card/95 px-2 py-1 text-[10px] font-semibold text-primary shadow hover:bg-card"
              >
                <ExternalLink className="h-3 w-3" /> Buka tab baru
              </a>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <Globe className="h-8 w-8 text-primary" />
            <p className="text-sm font-semibold text-foreground">{engines.find((e) => e.id === engine)?.label} tidak bisa di-embed</p>
            <p className="text-xs text-muted-foreground">
              Mesin pencari ini memblokir tampilan dalam iframe. Buka di tab baru atau coba DuckDuckGo untuk hasil yang tampil langsung di sini.
            </p>
            {openUrl && (
              <a
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Buka di tab baru
              </a>
            )}
            {engine !== "ddg" && (
              <button
                onClick={() => { setEngine("ddg"); setIframeFailed(false); }}
                className="text-[11px] text-primary underline"
              >
                Coba DuckDuckGo di dalam panel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LyricsPanel;
