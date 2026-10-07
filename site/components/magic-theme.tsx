"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { MotionConfig, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { Button } from "@/components/ui/button";

export function MagicTheme({ children }: { children: React.ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="yume-theme" disableTransitionOnChange>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  </ThemeProvider>;
}

export function ThemeToggle() {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const { resolvedTheme, setTheme } = useTheme();
  const dark = mounted && resolvedTheme === "dark";
  return <Button variant="outline" size="sm" className="min-h-9 shrink-0" aria-label={dark ? "当前黑夜主题，切换到白天" : "当前白天主题，切换到黑夜"} title={dark ? "切换到白天主题" : "切换到黑夜主题"} disabled={!mounted} onClick={() => setTheme(dark ? "light" : "dark")}>{dark ? <Moon data-icon="inline-start" aria-hidden="true" /> : <Sun data-icon="inline-start" aria-hidden="true" />}<span>{dark ? "黑夜" : "白天"}</span></Button>;
}

export function Starfield() {
  // Decorations are client-only: reduced-motion differs from the SSR snapshot.
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const reduced = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();
  const reading = /\/(notes|code|files|novels)\//.test(pathname);
  return <div className="starfield" data-reading={reading} aria-hidden="true">
    {mounted && !reduced && <FlickeringGrid squareSize={2} gridGap={28} color={resolvedTheme === "dark" ? "#a7b9ff" : "#7269ad"} maxOpacity={resolvedTheme === "dark" ? 0.25 : 0.08} flickerChance={0.12} />}
  </div>;
}

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
