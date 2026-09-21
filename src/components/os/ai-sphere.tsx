import { cn } from "@/lib/utils";

interface AiSphereProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showQuote?: boolean;
  quote?: string;
  glow?: boolean;
}

export function AiSphere({
  size = "lg",
  className,
  showQuote = false,
  quote = "Ideas are easy. Execution is hard. That's why I'm here.",
  glow = true,
}: AiSphereProps) {
  const sizeClasses = {
    sm: "size-16",
    md: "size-24",
    lg: "size-36 md:size-44",
    xl: "size-48 md:size-60",
  };

  return (
    <div className={cn("relative flex items-center gap-4", className)}>
      <div className={cn("relative shrink-0 select-none", sizeClasses[size])}>
        {/* Ambient Outer Halo */}
        {glow && (
          <div
            className="absolute -inset-4 rounded-full opacity-70 blur-2xl transition-all duration-700 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(6,182,212,0.45) 0%, rgba(14,165,233,0.2) 40%, transparent 70%)",
            }}
          />
        )}

        {/* Outer Ring / Atmospheric Edge */}
        <div
          className="absolute inset-0 rounded-full border border-cyan-400/30 shadow-[0_0_30px_rgba(6,182,212,0.35)] animate-[pulse_4s_ease-in-out_infinite]"
        />

        {/* 3D Glass Sphere Body */}
        <div
          className="relative size-full rounded-full overflow-hidden shadow-2xl flex items-center justify-center"
          style={{
            background:
              "radial-gradient(circle at 35% 25%, #38bdf8 0%, #06b6d4 25%, #0369a1 55%, #0f172a 85%, #020617 100%)",
          }}
        >
          {/* Specular Highlight */}
          <div
            className="absolute top-2 left-4 w-1/3 h-1/4 rounded-full opacity-60 blur-[1px] pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 75%)",
              transform: "rotate(-25deg)",
            }}
          />

          {/* Inner Cyan Glow */}
          <div
            className="absolute inset-0 rounded-full opacity-50 pointer-events-none"
            style={{
              boxShadow: "inset 0 0 25px rgba(6, 182, 212, 0.8), inset -8px -8px 20px rgba(0,0,0,0.8)",
            }}
          />

          {/* Friendly Glowing Smile / Face */}
          <div className="relative flex flex-col items-center justify-center pointer-events-none transform translate-y-1">
            <svg
              viewBox="0 0 60 30"
              className="w-10 h-5 text-cyan-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.85)]"
              fill="none"
            >
              {/* Sleek Curved Smile */}
              <path
                d="M 12 8 Q 30 26 48 8"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Shimmer overlay */}
          <div
            className="absolute inset-0 rounded-full opacity-30 mix-blend-overlay pointer-events-none animate-[pulse-soft_3s_ease-in-out_infinite]"
            style={{
              background: "radial-gradient(circle at 70% 80%, rgba(14,165,233,0.6) 0%, transparent 60%)",
            }}
          />
        </div>
      </div>

      {showQuote && quote && (
        <div className="hidden sm:block max-w-[220px] text-left">
          <p className="text-xs italic text-cyan-200/85 leading-relaxed font-sans">
            &ldquo;{quote}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
