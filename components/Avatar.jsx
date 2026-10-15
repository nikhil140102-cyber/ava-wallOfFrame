import { avatarColor, initials } from "@/lib/format";

export function Avatar({ name, size = 36, ring }) {
  return (
    <span
      className="avatar"
      role="img"
      aria-label={name}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        backgroundColor: avatarColor(name),
        boxShadow: ring ? `0 0 0 2px var(--bg-elevated), 0 0 0 4px ${ring}` : undefined,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, size = 22, max = 4 }) {
  const shown = names.slice(0, max);
  return (
    <span className="avatar-stack" style={{ borderRadius: 999 }}>
      {shown.map((n) => (
        <Avatar key={n} name={n} size={size} />
      ))}
    </span>
  );
}

export function LevelPill({ name, color, size = "md" }) {
  return (
    <span
      className="tag"
      style={{
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        color,
        height: size === "sm" ? 20 : 22,
        fontSize: size === "sm" ? 11 : 12,
      }}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
        <circle cx="4" cy="4" r="4" fill={color} />
      </svg>
      {name}
    </span>
  );
}
