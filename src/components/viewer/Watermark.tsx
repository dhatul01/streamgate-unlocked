import { useState, useEffect } from "react";

interface WatermarkProps {
  tokenCode: string;
}

const Watermark = ({ tokenCode }: WatermarkProps) => {
  const [position, setPosition] = useState({ top: 10, left: 10 });
  const code = `RE-${tokenCode.slice(-4)}`;

  useEffect(() => {
    const interval = setInterval(() => {
      setPosition({
        top: Math.random() * 70 + 5,
        left: Math.random() * 70 + 5,
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="pointer-events-none absolute z-30 select-none font-mono text-xs font-bold text-foreground/30 transition-all duration-1000 tv:text-sm"
      style={{ top: `${position.top}%`, left: `${position.left}%` }}
    >
      {code}
    </div>
  );
};

export default Watermark;
