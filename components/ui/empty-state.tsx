import Link from "next/link";
import { Scene, type SceneName } from "@/components/art/scenes";

// A designed "nothing here yet" that explains the place and offers the next step.
export function EmptyState({
  scene, title, children, action, secondary, compact = false,
}: {
  scene?: SceneName; title: string; children?: React.ReactNode;
  action?: { href: string; label: string }; secondary?: { href: string; label: string }; compact?: boolean;
}) {
  return (
    <div className={`card flex flex-col items-center gap-2 text-center ${compact ? "px-4 py-6" : "px-5 py-9"}`} data-empty-state>
      {scene && <Scene name={scene} className={compact ? "h-20 w-auto" : "h-28 w-auto"} />}
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <p className="max-w-md text-sm text-ink-2">{children}</p>}
      {(action || secondary) && (
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {action && <Link href={action.href} className="btn-primary">{action.label}</Link>}
          {secondary && <Link href={secondary.href} className="btn-secondary">{secondary.label}</Link>}
        </div>
      )}
    </div>
  );
}
