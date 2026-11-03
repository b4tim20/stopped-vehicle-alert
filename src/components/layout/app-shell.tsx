import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Camera, Map, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: Map },
  { to: "/cameras", label: "Cameras", icon: Camera },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  children,
  alertCount = 0,
}: {
  children: React.ReactNode;
  alertCount?: number;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg md:flex-row">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="px-5 pt-6 pb-5">
          <p className="font-mono text-[10px] tracking-[0.22em] text-accent uppercase">
            Gateway Guide
          </p>
          <h1 className="mt-1 font-display text-lg leading-tight font-medium tracking-tight">
            Stopped Vehicle Alert
          </h1>
          <p className="mt-2 text-xs text-muted">ZIP 63137 · 25 mi watch</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                  active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                {item.to === "/alerts" && alertCount > 0 ? (
                  <span className="ml-auto rounded-full bg-danger/20 px-2 py-0.5 font-mono text-[10px] text-danger tabular-nums">
                    {alertCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <p className="px-5 py-4 font-mono text-[10px] text-subtle">MoDOT · public feeds only</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:hidden">
          <div>
            <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">SVA</p>
            <p className="font-display text-sm">Stopped Vehicle Alert</p>
          </div>
          {alertCount > 0 ? (
            <span className="rounded-full bg-danger/20 px-2 py-1 font-mono text-[10px] text-danger">
              {alertCount} active
            </span>
          ) : (
            <span className="text-xs text-muted">63137</span>
          )}
        </header>
        <main className="min-h-0 flex-1 pb-20 md:pb-0">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 md:hidden">
        {NAV.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px]",
                active ? "text-fg" : "text-muted",
              )}
            >
              <Icon className="size-5" />
              {item.label}
              {item.to === "/alerts" && alertCount > 0 ? (
                <span className="absolute top-2 right-[calc(50%-18px)] size-1.5 rounded-full bg-danger" />
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
