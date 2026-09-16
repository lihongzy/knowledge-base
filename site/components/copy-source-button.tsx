"use client";

import { useEffect, useRef, useState } from "react";

type CopyStatus = "idle" | "copying" | "copied" | "failed";

export function CopySourceButton({ source }: { source: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  async function copySource() {
    window.clearTimeout(resetTimer.current);
    setStatus("copying");

    try {
      await navigator.clipboard.writeText(source);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }

    resetTimer.current = window.setTimeout(() => setStatus("idle"), 2400);
  }

  const label = {
    idle: "复制源码",
    copying: "正在复制…",
    copied: "已复制",
    failed: "复制失败",
  }[status];

  return (
    <button
      className={`copy-source-button ${status}`}
      type="button"
      onClick={copySource}
      disabled={status === "copying"}
      aria-live="polite"
    >
      {label}
    </button>
  );
}
