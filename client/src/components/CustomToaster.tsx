import { useState } from "react";
import { useToaster, resolveValue, toast as hotToast } from "react-hot-toast";
import { CheckCircle2, XCircle, Loader2, Info, X } from "lucide-react";
import type { Toast } from "react-hot-toast";

function ToastIcon({ type }: { type: Toast["type"] }) {
  if (type === "success") {
    return <CheckCircle2 size={18} style={{ color: "#4ade80", flexShrink: 0 }} />;
  }
  if (type === "error") {
    return <XCircle size={18} style={{ color: "#f87171", flexShrink: 0 }} />;
  }
  if (type === "loading") {
    return (
      <Loader2
        size={18}
        className="toast-spinner-icon"
        style={{ color: "#60a5fa", flexShrink: 0 }}
      />
    );
  }
  return <Info size={18} style={{ color: "#60a5fa", flexShrink: 0 }} />;
}

export function CustomToaster() {
  const { toasts, handlers } = useToaster();
  const { startPause, endPause } = handlers;
  const [isPaused, setIsPaused] = useState(false);

  const handleMouseEnter = () => {
    setIsPaused(true);
    startPause();
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    endPause();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        pointerEvents: "none",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {toasts.map((t) => {
        const message = resolveValue(t.message, t);
        const animClass = t.visible ? "toast-visible" : "toast-hidden";
        const duration = typeof t.duration === "number" && t.duration !== Infinity
          ? t.duration
          : 12000;

        const barColor =
          t.type === "success"
            ? "rgba(74, 222, 128, 0.65)"
            : t.type === "error"
            ? "rgba(248, 113, 113, 0.65)"
            : "rgba(96, 165, 250, 0.65)";

        return (
          <div
            key={t.id}
            className={animClass}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              minWidth: "300px",
              maxWidth: "380px",
              borderRadius: "14px",
              overflow: "hidden",
              background: "rgba(10, 20, 50, 0.82)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              border: "1px solid rgba(59, 130, 246, 0.35)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
              color: "#e2e8f0",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "14px 42px 14px 18px",
              }}
            >
              <ToastIcon type={t.type} />
              <span
                style={{
                  fontSize: "14px",
                  lineHeight: "1.5",
                  fontWeight: 400,
                  letterSpacing: "0.01em",
                  wordBreak: "break-word",
                  flex: 1,
                }}
              >
                {message}
              </span>
            </div>

            <button
              onClick={() => hotToast.dismiss(t.id)}
              aria-label="Fechar notificação"
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "rgba(148, 163, 184, 0.7)",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color =
                  "rgba(148, 163, 184, 0.7)";
              }}
            >
              <X size={14} />
            </button>

            {t.type !== "loading" && (
              <div
                style={{
                  height: "3px",
                  width: "100%",
                  background: "rgba(59, 130, 246, 0.12)",
                  overflow: "hidden",
                }}
              >
                <div
                  key={t.id + "-bar"}
                  style={{
                    height: "100%",
                    width: "100%",
                    background: barColor,
                    transformOrigin: "left center",
                    animation: `toast-progress ${duration}ms linear forwards`,
                    animationPlayState: isPaused ? "paused" : "running",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
