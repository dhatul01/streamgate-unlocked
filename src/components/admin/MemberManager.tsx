import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, Users } from "lucide-react";

interface Member {
  id: string;
  name: string;
  photo_url: string;
  sort_order: number;
}

const MemberManager = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();

  const fetchMembers = async () => {
    const { data } = await supabase
      .from("members")
      .select("*")
      .order("sort_order")
      .order("name");
    setMembers((data as Member[]) || []);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const addMember = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const { error } = await supabase.from("members").insert({ name, photo_url: "" });
    setCreating(false);
    if (error) {
      toast({ title: "Gagal menambah member", description: error.message, variant: "destructive" });
      return;
    }
    setNewName("");
    fetchMembers();
  };

  const handleUpload = async (member: Member, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "File harus gambar", variant: "destructive" });
      return;
    }
    setUploadingId(member.id);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${member.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("member-photos").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (upErr) {
      setUploadingId(null);
      toast({ title: "Upload gagal", description: upErr.message, variant: "destructive" });
      return;
    }
    const { data: pub } = supabase.storage.from("member-photos").getPublicUrl(path);
    const { error: updErr } = await supabase
      .from("members")
      .update({ photo_url: pub.publicUrl })
      .eq("id", member.id);
    setUploadingId(null);
    if (updErr) {
      toast({ title: "Gagal menyimpan foto", description: updErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Foto member diperbarui" });
    fetchMembers();
  };

  const renameMember = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("members").update({ name: trimmed }).eq("id", id);
    if (error) {
      toast({ title: "Gagal rename", description: error.message, variant: "destructive" });
      fetchMembers();
    }
  };

  const deleteMember = async (id: string) => {
    if (!confirm("Hapus member ini?")) return;
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) {
      toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
      return;
    }
    fetchMembers();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Manajemen Foto Member
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Tambahkan member dan unggah fotonya. Foto akan otomatis muncul di kartu show jika nama member ada di
          field <strong>Lineup</strong>.
        </p>
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nama member (mis. Alya)"
          className="bg-background"
          onKeyDown={(e) => e.key === "Enter" && addMember()}
        />
        <Button onClick={addMember} disabled={creating || !newName.trim()} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      {/* List */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {members.map((m) => (
          <div key={m.id} className="rounded-xl border border-border bg-card p-3 space-y-3">
            <div className="flex items-center gap-3">
              {m.photo_url ? (
                <img
                  src={m.photo_url}
                  alt={m.name}
                  className="h-16 w-16 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-muted-foreground">
                  {m.name.charAt(0).toUpperCase()}
                </div>
              )}
              <Input
                defaultValue={m.name}
                onBlur={(e) => e.target.value !== m.name && renameMember(m.id, e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*"
                ref={(el) => (fileInputs.current[m.id] = el)}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(m, f);
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 gap-1.5"
                disabled={uploadingId === m.id}
                onClick={() => fileInputs.current[m.id]?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {uploadingId === m.id ? "Mengunggah..." : m.photo_url ? "Ganti Foto" : "Upload Foto"}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => deleteMember(m.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {members.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">
            Belum ada member. Tambahkan member pertama Anda di atas.
          </p>
        )}
      </div>
    </div>
  );
};

export default MemberManager;
