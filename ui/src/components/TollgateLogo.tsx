export function TollgateLogo({ size = 40, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i * 360) / 16;
        const rad = (angle * Math.PI) / 180;
        const r = 16;
        const cx = 20 + r * Math.cos(rad);
        const cy = 20 + r * Math.sin(rad);
        const dotSize = i % 2 === 0 ? 2.2 : 1.4;
        return <circle key={i} cx={cx} cy={cy} r={dotSize} fill={color} />;
      })}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 360) / 8 + 22.5;
        const rad = (angle * Math.PI) / 180;
        const r = 8;
        const cx = 20 + r * Math.cos(rad);
        const cy = 20 + r * Math.sin(rad);
        return <circle key={`inner-${i}`} cx={cx} cy={cy} r={1.2} fill={color} opacity={0.6} />;
      })}
      <circle cx="20" cy="20" r="2.5" fill={color} />
    </svg>
  );
}
