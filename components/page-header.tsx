import Link from "next/link";
import { Icon } from "@/components/icons";

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && (
        <Link href={back} className="-ml-2 rounded-full p-2 text-black/60 hover:bg-black/5" aria-label="Back">
          <Icon name="back" />
        </Link>
      )}
      <h1 className="page-title min-w-0 flex-1 truncate">{title}</h1>
      {action}
    </div>
  );
}
