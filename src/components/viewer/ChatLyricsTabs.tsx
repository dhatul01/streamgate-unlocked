import { useState, lazy, Suspense } from "react";
import { MessageSquare, Music } from "lucide-react";

const LiveChat = lazy(() => import("@/components/viewer/LiveChat"));
const LyricsPanel = lazy(() => import("@/components/viewer/LyricsPanel"));

interface Props {
  username: string;
  tokenId?: string;
  isLive: boolean;
  isAdmin: boolean;
}

const ChatLyricsTabs = ({ username, tokenId, isLive, isAdmin }: Props) => {
  const [tab, setTab] = useState<"chat" | "lyrics">("chat");
  const [lyricsMounted, setLyricsMounted] = useState(false);

  const goLyrics = () => { setLyricsMounted(true); setTab("lyrics"); };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b border-border bg-card">
        <button
          onClick={() => setTab("chat")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition tv:text-sm ${
            tab === "chat" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5 tv:h-4 tv:w-4" /> Chat
        </button>
        <button
          onClick={goLyrics}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition tv:text-sm ${
            tab === "lyrics" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Music className="h-3.5 w-3.5 tv:h-4 tv:w-4" /> Lirik
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* Keep both panels mounted so state persists across tab switches */}
        <div className={`absolute inset-0 ${tab === "chat" ? "" : "hidden"}`}>
          <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted-foreground">Memuat chat...</div>}>
            <LiveChat username={username} tokenId={tokenId} isLive={isLive} isAdmin={isAdmin} />
          </Suspense>
        </div>
        {lyricsMounted && (
          <div className={`absolute inset-0 ${tab === "lyrics" ? "" : "hidden"}`}>
            <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted-foreground">Memuat lirik...</div>}>
              <LyricsPanel />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatLyricsTabs;
