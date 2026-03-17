import { useEffect, useState, useMemo } from "react";

export type AnimationType = "none" | "snow" | "stars" | "rain" | "leaves" | "bubbles" | "fireflies" | "confetti" | "money" | "trees" | "hearts" | "sakura" | "sparkle" | "balloons";

export const ANIMATION_OPTIONS: { value: AnimationType; label: string; emoji: string }[] = [
  { value: "none", label: "Tidak Ada", emoji: "🚫" },
  { value: "snow", label: "Salju Turun", emoji: "❄️" },
  { value: "stars", label: "Bintang & Planet", emoji: "🌟" },
  { value: "rain", label: "Hujan", emoji: "🌧️" },
  { value: "leaves", label: "Daun Berguguran", emoji: "🍂" },
  { value: "bubbles", label: "Gelembung", emoji: "🫧" },
  { value: "fireflies", label: "Kunang-kunang", emoji: "✨" },
  { value: "confetti", label: "Confetti", emoji: "🎊" },
  { value: "money", label: "Hujan Uang", emoji: "💰" },
  { value: "trees", label: "Pohon Berhembus", emoji: "🌳" },
  { value: "hearts", label: "Hati Beterbangan", emoji: "💖" },
  { value: "sakura", label: "Bunga Sakura", emoji: "🌸" },
  { value: "sparkle", label: "Kilauan Bintang", emoji: "💎" },
  { value: "balloons", label: "Balon Terbang", emoji: "🎈" },
];

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  delay: number;
  drift: number;
  color?: string;
}

const CONFETTI_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(38, 92%, 50%)",
  "hsl(142, 71%, 45%)",
  "hsl(280, 70%, 60%)",
  "hsl(200, 80%, 60%)",
];

const MONEY_EMOJIS = ["💵", "💴", "💶", "💷", "💰", "🪙"];
const TREE_EMOJIS = ["🌳", "🌲", "🌴", "🎋", "🌿"];
const HEART_EMOJIS = ["💖", "💕", "💗", "💝", "❤️", "🩷"];
const SAKURA_EMOJIS = ["🌸", "🏵️", "💮"];

const PlayerAnimations = ({ type, backgroundOnly = false }: { type: AnimationType; backgroundOnly?: boolean }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (type === "none") { setParticles([]); return; }
    const count = type === "rain" ? 60 : type === "confetti" ? 40 : type === "money" ? 35 : type === "aurora" ? 6 : type === "lightning" ? 5 : type === "trees" ? 8 : 30;
    const ps: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 6,
      speed: 3 + Math.random() * 8,
      opacity: 0.3 + Math.random() * 0.5,
      delay: Math.random() * 5,
      drift: -1 + Math.random() * 2,
      color: type === "confetti" ? CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] : undefined,
    }));
    setParticles(ps);
  }, [type]);

  if (type === "none" || particles.length === 0) return null;

  const getStyle = (p: Particle): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      left: `${p.x}%`,
      pointerEvents: "none",
      opacity: p.opacity,
      animationDelay: `${p.delay}s`,
      animationDuration: `${p.speed}s`,
      animationTimingFunction: "linear",
      animationIterationCount: "infinite",
    };

    switch (type) {
      case "snow":
        return { ...base, top: `-${p.size}px`, width: p.size, height: p.size, borderRadius: "50%", background: "white", animationName: "anim-fall", filter: "blur(0.5px)" };
      case "stars":
        return { ...base, top: `${p.y}%`, width: p.size, height: p.size, borderRadius: "50%", background: p.y < 30 ? "hsl(38, 92%, 70%)" : "white", animationName: "anim-twinkle", boxShadow: `0 0 ${p.size * 2}px ${p.y < 30 ? "hsl(38, 92%, 70%)" : "white"}` };
      case "rain":
        return { ...base, top: `-10px`, width: 1.5, height: p.size * 3, background: "hsl(var(--primary) / 0.4)", animationName: "anim-rain", animationDuration: `${p.speed * 0.4}s` };
      case "leaves":
        return { ...base, top: `-${p.size * 2}px`, fontSize: `${p.size + 6}px`, animationName: "anim-leaf" };
      case "bubbles":
        return { ...base, bottom: `-${p.size}px`, width: p.size * 2, height: p.size * 2, borderRadius: "50%", border: "1px solid hsl(var(--primary) / 0.3)", background: "hsl(var(--primary) / 0.05)", animationName: "anim-rise" };
      case "fireflies":
        return { ...base, top: `${p.y}%`, width: p.size * 0.8, height: p.size * 0.8, borderRadius: "50%", background: "hsl(50, 100%, 70%)", boxShadow: `0 0 ${p.size * 3}px hsl(50, 100%, 60%)`, animationName: "anim-firefly" };
      case "confetti":
        return { ...base, top: `-${p.size}px`, width: p.size * 0.8, height: p.size * 1.5, background: p.color, borderRadius: "1px", animationName: "anim-confetti", transform: `rotate(${Math.random() * 360}deg)` };
      case "money":
        return { ...base, top: `-30px`, fontSize: `${p.size + 14}px`, animationName: "anim-money", animationDuration: `${p.speed * 0.8}s` };
      case "trees":
        return { ...base, bottom: "0", top: "auto", left: `${p.x}%`, fontSize: `${p.size * 6 + 20}px`, animationName: "anim-sway", animationDuration: `${3 + p.speed * 0.5}s`, animationTimingFunction: "ease-in-out", opacity: 0.25 + p.opacity * 0.3, transformOrigin: "bottom center" };
      case "hearts":
        return { ...base, bottom: `-20px`, top: "auto", fontSize: `${p.size + 10}px`, animationName: "anim-float-up", animationDuration: `${p.speed * 1.2}s` };
      case "sakura":
        return { ...base, top: `-20px`, fontSize: `${p.size + 8}px`, animationName: "anim-sakura", animationDuration: `${p.speed * 1.1}s` };
      case "lightning":
        return { ...base, top: "0", left: `${p.x}%`, width: "3px", height: `${30 + p.size * 10}%`, background: "linear-gradient(180deg, hsl(60, 100%, 90%), hsl(50, 100%, 70%), transparent)", animationName: "anim-lightning", animationDuration: `${2 + p.speed * 0.5}s`, animationTimingFunction: "step-end", borderRadius: "2px", filter: "blur(1px)", boxShadow: "0 0 15px hsl(50, 100%, 70%)" };
      case "aurora":
        return { ...base, top: "0", left: `${p.x - 10}%`, width: "30%", height: "60%", background: `linear-gradient(180deg, hsl(${140 + p.id * 30}, 80%, 50%, 0.15), hsl(${200 + p.id * 20}, 70%, 60%, 0.1), transparent)`, animationName: "anim-aurora", animationDuration: `${8 + p.speed}s`, animationTimingFunction: "ease-in-out", borderRadius: "50%", filter: "blur(30px)" };
      default:
        return base;
    }
  };

  const leafEmojis = ["🍂", "🍁", "🍃", "🌿"];

  const getEmoji = (p: Particle) => {
    switch (type) {
      case "leaves": return leafEmojis[p.id % leafEmojis.length];
      case "money": return MONEY_EMOJIS[p.id % MONEY_EMOJIS.length];
      case "trees": return TREE_EMOJIS[p.id % TREE_EMOJIS.length];
      case "hearts": return HEART_EMOJIS[p.id % HEART_EMOJIS.length];
      case "sakura": return SAKURA_EMOJIS[p.id % SAKURA_EMOJIS.length];
      default: return null;
    }
  };

  return (
    <>
      <style>{`
        @keyframes anim-fall { 0% { transform: translateY(-10px) translateX(0); } 50% { transform: translateY(50vh) translateX(20px); } 100% { transform: translateY(100vh) translateX(-10px); } }
        @keyframes anim-twinkle { 0%,100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.3); } }
        @keyframes anim-rain { 0% { transform: translateY(-10px); } 100% { transform: translateY(100vh); } }
        @keyframes anim-leaf { 0% { transform: translateY(-20px) rotate(0deg) translateX(0); } 33% { transform: translateY(33vh) rotate(120deg) translateX(30px); } 66% { transform: translateY(66vh) rotate(240deg) translateX(-20px); } 100% { transform: translateY(100vh) rotate(360deg) translateX(10px); } }
        @keyframes anim-rise { 0% { transform: translateY(0) translateX(0); opacity: 0.5; } 100% { transform: translateY(-100vh) translateX(20px); opacity: 0; } }
        @keyframes anim-firefly { 0% { transform: translate(0, 0); opacity: 0.2; } 25% { transform: translate(15px, -20px); opacity: 1; } 50% { transform: translate(-10px, -40px); opacity: 0.3; } 75% { transform: translate(20px, -15px); opacity: 0.8; } 100% { transform: translate(0, 0); opacity: 0.2; } }
        @keyframes anim-confetti { 0% { transform: translateY(-10px) rotate(0deg); } 100% { transform: translateY(100vh) rotate(720deg); } }
        @keyframes anim-money { 0% { transform: translateY(-30px) rotate(0deg) translateX(0); opacity: 0.8; } 25% { transform: translateY(25vh) rotate(90deg) translateX(25px); } 50% { transform: translateY(50vh) rotate(180deg) translateX(-15px); } 75% { transform: translateY(75vh) rotate(270deg) translateX(20px); } 100% { transform: translateY(100vh) rotate(360deg) translateX(-10px); opacity: 0.3; } }
        @keyframes anim-sway { 0%, 100% { transform: rotate(-3deg) scaleY(1); } 25% { transform: rotate(2deg) scaleY(1.02); } 50% { transform: rotate(-2deg) scaleY(0.98); } 75% { transform: rotate(3deg) scaleY(1.01); } }
        @keyframes anim-float-up { 0% { transform: translateY(0) scale(0.5) rotate(0deg); opacity: 0; } 10% { opacity: 0.8; transform: translateY(-10vh) scale(1) rotate(10deg); } 50% { transform: translateY(-50vh) scale(1.1) rotate(-5deg) translateX(20px); } 100% { transform: translateY(-100vh) scale(0.8) rotate(15deg) translateX(-10px); opacity: 0; } }
        @keyframes anim-sakura { 0% { transform: translateY(-20px) rotate(0deg) translateX(0); opacity: 0.7; } 25% { transform: translateY(25vh) rotate(90deg) translateX(40px); } 50% { transform: translateY(50vh) rotate(180deg) translateX(-20px); } 75% { transform: translateY(75vh) rotate(270deg) translateX(30px); } 100% { transform: translateY(100vh) rotate(360deg) translateX(0); opacity: 0.2; } }
        @keyframes anim-lightning { 0%, 90%, 100% { opacity: 0; } 92% { opacity: 0.9; } 94% { opacity: 0.1; } 96% { opacity: 0.7; } 98% { opacity: 0; } }
        @keyframes anim-aurora { 0%, 100% { transform: translateX(0) scaleX(1); opacity: 0.15; } 25% { transform: translateX(5%) scaleX(1.1); opacity: 0.25; } 50% { transform: translateX(-3%) scaleX(0.9); opacity: 0.2; } 75% { transform: translateX(4%) scaleX(1.05); opacity: 0.3; } }
      `}</style>
      <div className={`pointer-events-none fixed inset-0 overflow-hidden ${backgroundOnly ? "z-0" : "z-[1]"}`}>
        {particles.map((p) => (
          <div key={p.id} style={getStyle(p)}>
            {getEmoji(p)}
          </div>
        ))}
      </div>
    </>
  );
};

export default PlayerAnimations;
