import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
};

export default function Notice({ icon: Icon, title, description, action }: Props) {
  const actionClass =
    "mt-6 inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity";
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="text-center max-w-sm">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
        {action &&
          (action.href ? (
            <Link href={action.href} className={actionClass}>
              {action.label}
            </Link>
          ) : (
            <button onClick={action.onClick} className={actionClass}>
              {action.label}
            </button>
          ))}
      </div>
    </div>
  );
}
