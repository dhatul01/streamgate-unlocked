interface TextWatermarkProps {
  text: string;
  /** Skala teks 10..100. 100 = teks selebar player. */
  size: number;
  /** Opacity 0..1, default 0.12 (transparan) */
  opacity?: number;
}

/**
 * Watermark teks transparan yang menutupi seluruh area player.
 * Menggunakan SVG dengan preserveAspectRatio agar teks
 * otomatis menyesuaikan ukuran player (fullscreen, mobile, TV).
 */
const TextWatermark = ({ text, size, opacity = 0.12 }: TextWatermarkProps) => {
  const safeText = (text || "").trim();
  if (!safeText) return null;

  // Bound size 5..100
  const s = Math.max(5, Math.min(100, size || 30));
  // viewBox width = 100, font-size dihitung relatif agar teks pas selebar `s` persen.
  // Faktor 0.55 ≈ rata-rata lebar karakter / fontSize untuk sans-serif bold.
  const charCount = Math.max(safeText.length, 4);
  const fontSize = Math.min(60, (s / charCount) * 1.85);

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] flex items-center justify-center overflow-hidden">
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        aria-hidden="true"
      >
        <text
          x="50"
          y="33"
          textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight={800}
          fontSize={fontSize}
          fill="white"
          fillOpacity={opacity}
          stroke="black"
          strokeOpacity={opacity * 0.6}
          strokeWidth={0.15}
          style={{ letterSpacing: "0.05em", textTransform: "uppercase" }}
        >
          {safeText}
        </text>
      </svg>
    </div>
  );
};

export default TextWatermark;
