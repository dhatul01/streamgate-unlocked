import { useEffect, useState, useMemo } from "react";

export type AnimationType = "none" | "snow" | "stars" | "rain" | "leaves" | "bubbles" | "fireflies" | "confetti";

export const ANIMATION_OPTIONS: { value: AnimationType; label: string; emoji: string }[] = [
  { value: "none", label: "Tidak Ada", emoji: "🚫" },
  { value: "snow", label: "Salju Turun", emoji: "❄️" },
  { value: "stars", label: "Bintang & Planet", emoji: "🌟" },
  { value: "rain", label: "Hujan", emoji: "🌧️" },
  { value: "leaves", label: "Daun Berguguran", emoji: "🍂" },
  { value: "bubbles", label: "Gelembung", emoji: "🫧" },
  { value: "fireflies", label: "Kunang-kunang", emoji: "✨" },
  { value: "confetti", label: "Confetti", emoji: "🎊" },
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

const PlayerAnimations = ({ type }: { type: AnimationType }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (type === "none") { setParticles([]); return; }
    const count = type === "rain" ? 60 : type === "confetti" ? 40 : 30;
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
      default:
        return base;
    }
  };

  const leafEmojis = ["🍂", "🍁", "🍃", "🌿"];

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
      `}</style>
      <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
        {particles.map((p) => (
          <div key={p.id} style={getStyle(p)}>
            {type === "leaves" ? leafEmojis[p.id % leafEmojis.length] : null}
          </div>
        ))}
      </div>
    </>
  );
};

export default PlayerAnimations;
