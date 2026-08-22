import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const PALETTES = [
  { bg1: "#0b1026", bg2: "#1d4ed8", accent: "#38bdf8" },
  { bg1: "#1a0b2e", bg2: "#6d28d9", accent: "#a78bfa" },
  { bg1: "#04121f", bg2: "#0e7490", accent: "#22d3ee" },
  { bg1: "#1c0a0a", bg2: "#b45309", accent: "#fbbf24" },
  { bg1: "#0f172a", bg2: "#334155", accent: "#e2e8f0" },
];

export interface CardProps {
  keyword: string;
  palette: number;
  kind: "broll" | "overlay";
  kicker?: string;
}

const wrap = (text: string, maxChars: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean).slice(0, 6);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxChars && current) {
      lines.push(current.trim());
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines.slice(0, 3);
};

/** Eased entrance driven by a spring, staggered per element. */
const rise = ({
  frame,
  fps,
  delay,
  distance = 90,
}: {
  frame: number;
  fps: number;
  delay: number;
  distance?: number;
}) => {
  const local = frame - delay;
  if (local < 0) {
    return { opacity: 0, translateY: distance, blur: 8 };
  }
  const s = spring({ frame: local, fps, config: { damping: 14, mass: 0.9 } });
  return { opacity: Math.min(1, s), translateY: distance * (1 - s), blur: 8 * (1 - s) };
};

export const Card: React.FC<CardProps> = ({ keyword, palette, kind, kicker }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const colors = PALETTES[(palette ?? 0) % PALETTES.length];
  const lines = wrap(keyword, kind === "overlay" ? 22 : 13);

  const exitStart = durationInFrames - Math.round(0.3 * fps);
  const exit = frame > exitStart ? Math.min(1, (frame - exitStart) / (0.3 * fps)) : 0;

  const kickerRise = rise({ frame, fps, delay: 2 });
  const barScale = spring({ frame: frame - 8, fps, config: { damping: 20 } });
  // Slow ambient drift for the backdrop
  const drift = Math.sin((frame / fps) * 0.8) * 26;

  const sharedFont = `"Segoe UI", Inter, Arial, sans-serif`;

  if (kind === "overlay") {
    return (
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", opacity: 1 - exit }}>
        <div
          style={{
            width: 980,
            marginBottom: 0,
            padding: "34px 46px",
            borderRadius: 28,
            background: "rgba(8, 12, 26, 0.86)",
            border: "1.5px solid rgba(255,255,255,0.14)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            gap: 26,
            fontFamily: sharedFont,
            transform: `translateY(${kickerRise.translateY * 0.6}px)`,
            opacity: kickerRise.opacity,
            filter: `blur(${kickerRise.blur * 0.5}px)`,
          }}
        >
          <div
            style={{
              width: 10,
              alignSelf: "stretch",
              borderRadius: 6,
              background: colors.accent,
              transformOrigin: "center",
              transform: `scaleY(${Math.max(0.05, barScale)})`,
            }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 22,
                letterSpacing: 5,
                fontWeight: 700,
                color: "rgba(255,255,255,0.55)",
                textTransform: "uppercase",
              }}
            >
              {kicker ?? "key moment"}
            </div>
            <div
              style={{
                fontSize: 54,
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.12,
                marginTop: 6,
              }}
            >
              {lines.join(" ")}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // Full-frame B-roll card
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg1, opacity: 1 - exit, fontFamily: sharedFont }}>
      {/* Layered animated backdrop */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(160deg, ${colors.bg1} 0%, ${colors.bg2} 130%)`,
          transform: `translateY(${drift}px) scale(1.12)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 30% ${38 + drift * 0.4}%, ${colors.accent}33 0%, transparent 55%)`,
        }}
      />
      {/* Dim band behind text */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "36%",
          height: "30%",
          background: "rgba(0,0,0,0.32)",
        }}
      />
      {/* Kicker */}
      <div
        style={{
          position: "absolute",
          top: "40.5%",
          width: "100%",
          textAlign: "center",
          fontSize: 34,
          letterSpacing: 8,
          fontWeight: 700,
          color: "rgba(255,255,255,0.62)",
          textTransform: "uppercase",
          opacity: kickerRise.opacity,
          transform: `translateY(${kickerRise.translateY}px)`,
          filter: `blur(${kickerRise.blur}px)`,
        }}
      >
        ● {kicker ?? "key moment"}
      </div>
      {/* Keyword lines, staggered */}
      <div style={{ position: "absolute", top: "45%", width: "100%" }}>
        {lines.map((line, i) => {
          const r = rise({ frame, fps, delay: 5 + i * 4, distance: 110 });
          return (
            <div
              key={i}
              style={{
                textAlign: "center",
                fontSize: i === 0 ? 118 : 96,
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.05,
                opacity: r.opacity,
                transform: `translateY(${r.translateY}px)`,
                filter: `blur(${r.blur}px)`,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
      {/* Accent underline wipe */}
      <div
        style={{
          position: "absolute",
          top: "72%",
          left: "50%",
          width: 150,
          height: 9,
          borderRadius: 6,
          background: colors.accent,
          transform: `translateX(-50%) scaleX(${Math.max(0.02, barScale)})`,
        }}
      />
    </AbsoluteFill>
  );
};
