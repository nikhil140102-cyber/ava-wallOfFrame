// A short, light confetti burst for moments worth celebrating. Skipped when the person prefers reduced motion.
export function celebrate() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#3355E6", "#F59E0B", "#7C3AED", "#059669", "#DB2777", "#0891B2"];
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 70; i++) {
    const p = document.createElement("i");
    const angle = Math.random() * Math.PI - Math.PI; // upward fan
    const speed = 380 + Math.random() * 420;
    p.style.setProperty("--x", `${Math.cos(angle) * speed}px`);
    p.style.setProperty("--y", `${Math.sin(angle) * speed}px`);
    p.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 80}ms`;
    if (i % 3 === 0) p.style.borderRadius = "50%";
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1600);
}
