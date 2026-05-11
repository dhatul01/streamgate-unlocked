import { useEffect, useState, useCallback } from "react";
import { Image as ImageIcon, Trash2, Copy, RefreshCw, Upload, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const BUCKETS = [
  { id: "show-images", label: "Show Images" },
  { id: "moderator-logos", label: "Moderator Logos" },
  { id: "member-photos", label: "Member Photos" },
];

interface FileItem {
  name: string;
  publicUrl: string;
  size?: number;
  updated_at?: string;
}

const MediaLibrary = () => {
  const [bucket, setBucket] = useState<string>("show-images");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.storage.from(bucket).list("", {
      limit: 200,
      sortBy: { column: "updated_at", order: "desc" },
    });
    if (error) {
      toast.error("Gagal memuat: " + error.message);
      setFiles([]);
    } else {
      const items: FileItem[] = (data || [])
        .filter((f) => f.name && !f.name.endsWith("/"))
        .map((f) => ({
          name: f.name,
          publicUrl: supabase.storage.from(bucket).getPublicUrl(f.name).data.publicUrl,
          size: (f as any)?.metadata?.size,
          updated_at: f.updated_at,
        }));
      setFiles(items);
    }
    setLoading(false);
  }, [bucket]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (name: string) => {
    if (!confirm(`Hapus ${name}?`)) return;
    const { error } = await supabase.storage.from(bucket).remove([name]);
    if (error) toast.error(error.message);
    else {
      toast.success("File dihapus");
      load();
    }
  };

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("URL disalin");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    setUploading(false);
    e.target.value = "";
    if (error) toast.error(error.message);
    else {
      toast.success("Upload berhasil");
      load();
    }
  };

  const filtered = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ImageIcon className="h-6 w-6 text-primary" /> Media Library
        </h2>
        <p className="text-sm text-muted-foreground">Kelola file yang diunggah ke storage.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Select value={bucket} onValueChange={setBucket}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {BUCKETS.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>

        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
          <Upload className="h-4 w-4" />
          {uploading ? "Mengunggah..." : "Upload"}
          <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <ImageIcon className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Belum ada file.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((f) => (
            <div key={f.name} className="group relative overflow-hidden rounded-xl border border-border bg-card">
              <img src={f.publicUrl} alt={f.name} loading="lazy" className="aspect-square w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-background/80 p-1.5 backdrop-blur-sm opacity-0 transition group-hover:opacity-100">
                <button onClick={() => handleCopy(f.publicUrl)} className="rounded p-1.5 hover:bg-secondary" title="Salin URL">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <span className="flex-1 truncate px-1 text-[10px] text-muted-foreground" title={f.name}>{f.name}</span>
                <button onClick={() => handleDelete(f.name)} className="rounded p-1.5 text-destructive hover:bg-destructive/10" title="Hapus">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaLibrary;
