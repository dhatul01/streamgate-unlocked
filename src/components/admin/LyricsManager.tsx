import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pencil, Plus, Check, X, ExternalLink, Link2, Loader2, Download, Zap } from "lucide-react";
import { toast } from "sonner";

interface Setlist { id: string; name: string; slug: string; sort_order: number; is_active: boolean; }
interface Song { id: string; setlist_id: string; title: string; sort_order: number; is_active: boolean; }
interface Lyric {
  id: string; song_id: string; content: string; source_url: string;
  status: string; contributor_name: string; created_at: string;
  is_link_only?: boolean; external_title?: string;
}

const LyricsManager = () => {
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [lyrics, setLyrics] = useState<Lyric[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [sl, sg, ly] = await Promise.all([
      supabase.from("jkt48_setlists").select("*").order("sort_order"),
      supabase.from("jkt48_songs").select("*").order("sort_order"),
      supabase.from("jkt48_lyrics").select("*").order("created_at", { ascending: false }),
    ]);
    setSetlists((sl.data as Setlist[]) || []);
    setSongs((sg.data as Song[]) || []);
    setLyrics((ly.data as Lyric[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h2 className="text-xl font-bold text-foreground md:text-2xl">Lirik JKT48</h2>
        <p className="text-xs text-muted-foreground md:text-sm">Kelola setlist, judul lagu, dan moderasi submisi lirik dari user.</p>
      </div>

      <Tabs defaultValue="setlists">
        <TabsList>
          <TabsTrigger value="setlists">Setlist</TabsTrigger>
          <TabsTrigger value="songs">Lagu</TabsTrigger>
          <TabsTrigger value="lyrics">Lirik & Moderasi</TabsTrigger>
        </TabsList>

        <TabsContent value="setlists">
          <SetlistsTab setlists={setlists} onChange={load} />
        </TabsContent>

        <TabsContent value="songs">
          <SongsTab setlists={setlists} songs={songs} onChange={load} />
        </TabsContent>

        <TabsContent value="lyrics">
          <LyricsTab setlists={setlists} songs={songs} lyrics={lyrics} onChange={load} />
        </TabsContent>
      </Tabs>

      {loading && <p className="text-xs text-muted-foreground">Memuat...</p>}
    </div>
  );
};

// === Setlists tab ===
const SetlistsTab = ({ setlists, onChange }: { setlists: Setlist[]; onChange: () => void }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Setlist | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const openEdit = (s: Setlist | null) => {
    setEditing(s);
    setName(s?.name || "");
    setSlug(s?.slug || "");
    setSortOrder(s?.sort_order ?? 0);
    setIsActive(s?.is_active ?? true);
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim() || !slug.trim()) { toast.error("Nama & slug wajib"); return; }
    const payload = { name: name.trim(), slug: slug.trim(), sort_order: sortOrder, is_active: isActive };
    const res = editing
      ? await supabase.from("jkt48_setlists").update(payload).eq("id", editing.id)
      : await supabase.from("jkt48_setlists").insert(payload);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Setlist tersimpan");
    setOpen(false); onChange();
  };

  const del = async (id: string) => {
    if (!confirm("Hapus setlist ini? Semua lagu & lirik di dalamnya juga akan terhapus.")) return;
    const { error } = await supabase.from("jkt48_setlists").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Dihapus"); onChange(); }
  };

  return (
    <div className="space-y-3">
      <Button onClick={() => openEdit(null)} size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Tambah Setlist</Button>
      <div className="space-y-2">
        {setlists.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{s.name} {!s.is_active && <Badge variant="secondary" className="ml-2">nonaktif</Badge>}</p>
              <p className="text-[10px] text-muted-foreground">slug: {s.slug} · urutan: {s.sort_order}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" onClick={() => del(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Tambah"} Setlist</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs">Nama</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="text-xs">Slug</label><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
            <div><label className="text-xs">Urutan</label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} /></div>
            <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><label className="text-xs">Aktif</label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={save}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// === Songs tab ===
const SongsTab = ({ setlists, songs, onChange }: { setlists: Setlist[]; songs: Song[]; onChange: () => void }) => {
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Song | null>(null);
  const [setlistId, setSetlistId] = useState("");
  const [title, setTitle] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const filtered = filter === "all" ? songs : songs.filter((s) => s.setlist_id === filter);
  const setlistName = (id: string) => setlists.find((s) => s.id === id)?.name || "?";

  const openEdit = (s: Song | null) => {
    setEditing(s);
    setSetlistId(s?.setlist_id || (filter !== "all" ? filter : ""));
    setTitle(s?.title || "");
    setSortOrder(s?.sort_order ?? 0);
    setIsActive(s?.is_active ?? true);
    setOpen(true);
  };

  const save = async () => {
    if (!setlistId || !title.trim()) { toast.error("Setlist & judul wajib"); return; }
    const payload = { setlist_id: setlistId, title: title.trim(), sort_order: sortOrder, is_active: isActive };
    const res = editing
      ? await supabase.from("jkt48_songs").update(payload).eq("id", editing.id)
      : await supabase.from("jkt48_songs").insert(payload);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Lagu tersimpan"); setOpen(false); onChange();
  };

  const del = async (id: string) => {
    if (!confirm("Hapus lagu ini? Lirik terkait juga terhapus.")) return;
    const { error } = await supabase.from("jkt48_songs").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Dihapus"); onChange(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua setlist</SelectItem>
            {setlists.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => openEdit(null)} size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Tambah Lagu</Button>
      </div>
      <div className="space-y-2">
        {filtered.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{s.title} {!s.is_active && <Badge variant="secondary" className="ml-2">nonaktif</Badge>}</p>
              <p className="text-[10px] text-muted-foreground">{setlistName(s.setlist_id)} · urutan: {s.sort_order}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" onClick={() => del(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Belum ada lagu</p>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Tambah"} Lagu</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs">Setlist</label>
              <Select value={setlistId} onValueChange={setSetlistId}>
                <SelectTrigger><SelectValue placeholder="Pilih setlist" /></SelectTrigger>
                <SelectContent>{setlists.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-xs">Judul</label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><label className="text-xs">Urutan</label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} /></div>
            <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><label className="text-xs">Aktif</label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={save}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// === Lyrics tab ===
const LyricsTab = ({ setlists, songs, lyrics, onChange }: { setlists: Setlist[]; songs: Song[]; lyrics: Lyric[]; onChange: () => void }) => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Lyric | null>(null);
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [externalTitle, setExternalTitle] = useState("");
  const [isLinkOnly, setIsLinkOnly] = useState(false);
  const [songId, setSongId] = useState("");
  const [importing, setImporting] = useState(false);

  const songById = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);
  const setlistById = useMemo(() => new Map(setlists.map((s) => [s.id, s])), [setlists]);

  const filtered = statusFilter === "all" ? lyrics : lyrics.filter((l) => l.status === statusFilter);

  const openEdit = (l: Lyric) => {
    setEditing(l);
    setContent(l.content || "");
    setSourceUrl(l.source_url || "");
    setExternalTitle(l.external_title || "");
    setIsLinkOnly(!!l.is_link_only);
    setSongId(l.song_id);
    setEditOpen(true);
  };

  const importFromUrl = async () => {
    if (!sourceUrl.trim()) { toast.error("Isi URL dulu"); return; }
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-lyric-source", {
        body: { url: sourceUrl.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || data?.error || "Gagal fetch");
      if (data.song_guess) setExternalTitle(data.song_guess);
      // Try to auto-match song by title
      const guess = String(data.song_guess || "").toLowerCase();
      if (guess) {
        const match = songs.find((s) => s.title.toLowerCase().includes(guess) || guess.includes(s.title.toLowerCase()));
        if (match) { setSongId(match.id); toast.success(`Cocok dengan: ${match.title}`); }
        else toast.info(`Judul ditemukan: "${data.song_guess}". Pilih lagu manual.`);
      }
    } catch (e: any) {
      toast.error("Import gagal", { description: e?.message || String(e) });
    } finally {
      setImporting(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    if (!isLinkOnly && !content.trim()) { toast.error("Isi lirik atau aktifkan mode link-only"); return; }
    if (isLinkOnly && !sourceUrl.trim()) { toast.error("Mode link-only butuh URL sumber"); return; }
    const { error } = await supabase.from("jkt48_lyrics").update({
      content: isLinkOnly ? "" : content.trim(),
      source_url: sourceUrl.trim(),
      song_id: songId,
      is_link_only: isLinkOnly,
      external_title: externalTitle.trim(),
    } as any).eq("id", editing.id);
    if (error) toast.error(error.message); else { toast.success("Tersimpan"); setEditOpen(false); onChange(); }
  };

  const approve = async (id: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("jkt48_lyrics").update({
      status: "approved", approved_by: u.user?.id, approved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Disetujui"); onChange(); }
  };

  const reject = async (id: string) => {
    const { error } = await supabase.from("jkt48_lyrics").update({ status: "rejected" }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Ditolak"); onChange(); }
  };

  const del = async (id: string) => {
    if (!confirm("Hapus lirik ini?")) return;
    const { error } = await supabase.from("jkt48_lyrics").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Dihapus"); onChange(); }
  };

  const openAdd = () => {
    setContent(""); setSourceUrl(""); setExternalTitle(""); setIsLinkOnly(false); setSongId("");
    setAddOpen(true);
  };

  const saveAdd = async () => {
    if (!songId) { toast.error("Pilih lagu"); return; }
    if (!isLinkOnly && !content.trim()) { toast.error("Isi lirik atau pilih mode link-only"); return; }
    if (isLinkOnly && !sourceUrl.trim()) { toast.error("Mode link-only butuh URL sumber"); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("jkt48_lyrics").insert({
      song_id: songId,
      content: isLinkOnly ? "" : content.trim(),
      source_url: sourceUrl.trim(),
      is_link_only: isLinkOnly,
      external_title: externalTitle.trim(),
      status: "approved",
      contributor_user_id: u.user?.id,
      contributor_name: "admin",
      approved_by: u.user?.id,
      approved_at: new Date().toISOString(),
    } as any);
    if (error) toast.error(error.message); else { toast.success("Lirik ditambah"); setAddOpen(false); onChange(); }
  };

  const FormFields = (
    <div className="space-y-3">
      <div>
        <label className="text-xs">Lagu</label>
        <Select value={songId} onValueChange={setSongId}>
          <SelectTrigger><SelectValue placeholder="Pilih lagu" /></SelectTrigger>
          <SelectContent>
            {songs.map((s) => <SelectItem key={s.id} value={s.id}>{s.title} — {setlistById.get(s.setlist_id)?.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-semibold text-primary">Import dari URL situs lirik</p>
        </div>
        <div className="flex gap-2">
          <Input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://genius.com/... atau jkt48.com/..."
            className="h-8 text-xs"
          />
          <Button size="sm" onClick={importFromUrl} disabled={importing || !sourceUrl.trim()} className="gap-1.5 shrink-0">
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Cek
          </Button>
        </div>
        {externalTitle && (
          <p className="text-[10px] text-muted-foreground">Judul terdeteksi: <span className="font-mono text-foreground">{externalTitle}</span></p>
        )}
        <p className="text-[10px] text-muted-foreground">
          Hanya mengambil judul (metadata). Isi lirik tetap ditempel manual atau pilih mode link-only di bawah untuk menghormati hak cipta situs sumber.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5">
        <div>
          <p className="text-xs font-semibold">Mode link-only</p>
          <p className="text-[10px] text-muted-foreground">Tidak menyimpan teks lirik. User akan diarahkan ke situs sumber.</p>
        </div>
        <Switch checked={isLinkOnly} onCheckedChange={setIsLinkOnly} />
      </div>

      {!isLinkOnly && (
        <div>
          <label className="text-xs">Isi Lirik (tempel manual)</label>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} placeholder="Tempel teks lirik di sini..." />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="approved">Disetujui</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openAdd} size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Tambah Lirik</Button>
      </div>

      <div className="space-y-2">
        {filtered.map((l) => {
          const song = songById.get(l.song_id);
          const setlist = song ? setlistById.get(song.setlist_id) : undefined;
          return (
            <div key={l.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {song?.title || "—"}
                    {l.is_link_only && <Badge variant="outline" className="ml-2 gap-1"><Link2 className="h-3 w-3" />link-only</Badge>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {setlist?.name || "—"} · oleh {l.contributor_name || "?"} ·{" "}
                    <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"}>{l.status}</Badge>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {l.status === "pending" && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => approve(l.id)} title="Setujui"><Check className="h-3.5 w-3.5 text-success" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => reject(l.id)} title="Tolak"><X className="h-3.5 w-3.5 text-destructive" /></Button>
                    </>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => openEdit(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(l.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
              {!l.is_link_only && l.content && (
                <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded bg-secondary/30 p-2 font-sans text-[11px] text-muted-foreground">
                  {l.content.slice(0, 400)}{l.content.length > 400 ? "..." : ""}
                </pre>
              )}
              {l.source_url && (
                <a href={l.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> {l.source_url}
                </a>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Belum ada lirik</p>}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Lirik</DialogTitle></DialogHeader>
          {FormFields}
          <DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Batal</Button><Button onClick={save}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tambah Lirik (langsung approved)</DialogTitle></DialogHeader>
          {FormFields}
          <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>Batal</Button><Button onClick={saveAdd}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LyricsManager;
