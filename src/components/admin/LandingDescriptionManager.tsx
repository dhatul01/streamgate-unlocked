import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";

interface Description {
  id: string;
  title: string;
  content: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

const LandingDescriptionManager = () => {
  const [items, setItems] = useState<Description[]>([]);
  const { toast } = useToast();

  const fetch = async () => {
    const { data } = await supabase.from("landing_descriptions").select("*").order("sort_order");
    setItems((data as Description[]) || []);
  };

  useEffect(() => { fetch(); }, []);

  const create = async () => {
    await supabase.from("landing_descriptions").insert({
      title: "Fitur Baru",
      content: "Deskripsi fitur...",
      icon: "✨",
      sort_order: items.length,
    });
    await fetch();
    toast({ title: "Deskripsi ditambahkan" });
  };

  const update = async (item: Description) => {
    await supabase
      .from("landing_descriptions")
      .update({ title: item.title, content: item.content, icon: item.icon, is_active: item.is_active, sort_order: item.sort_order })
      .eq("id", item.id);
    await fetch();
  };

  const remove = async (id: string) => {
    await supabase.from("landing_descriptions").delete().eq("id", id);
    await fetch();
    toast({ title: "Deskripsi dihapus" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">📝 Deskripsi Landing Page</h2>
        <Button onClick={create} size="sm"><Plus className="mr-1 h-4 w-4" /> Tambah</Button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Input
                  value={item.icon}
                  onChange={(e) => setItems(items.map((i) => i.id === item.id ? { ...i, icon: e.target.value } : i))}
                  onBlur={() => update(item)}
                  className="w-14 bg-background text-center text-lg"
                  maxLength={4}
                />
                <Input
                  value={item.title}
                  onChange={(e) => setItems(items.map((i) => i.id === item.id ? { ...i, title: e.target.value } : i))}
                  onBlur={() => update(item)}
                  className="bg-background font-semibold"
                  placeholder="Judul"
                />
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => { const u = { ...item, is_active: !item.is_active }; setItems(items.map((i) => i.id === u.id ? u : i)); update(u); }}>
                  {item.is_active ? <Eye className="h-4 w-4 text-success" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(item.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <Textarea
              value={item.content}
              onChange={(e) => setItems(items.map((i) => i.id === item.id ? { ...i, content: e.target.value } : i))}
              onBlur={() => update(item)}
              className="bg-background"
              rows={2}
              placeholder="Konten deskripsi..."
            />
          </div>
        ))}
        {items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada deskripsi</p>}
      </div>
    </div>
  );
};

export default LandingDescriptionManager;
