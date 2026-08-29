import Link from "next/link";
import { ChevronRight } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  to?: string;
};

type Props = {
  items: BreadcrumbItem[];
  variant?: "default" | "light";
};

export default function Breadcrumb({ items, variant = "default" }: Props) {
  const isLight = variant === "light";
  return (
    <nav
      className={
        "flex items-center gap-1.5 text-sm " +
        (isLight ? "text-white/60" : "text-muted-foreground")
      }
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.to && !isLast ? (
              <Link
                href={item.to}
                className={
                  "transition-colors " +
                  (isLight ? "hover:text-white" : "hover:text-foreground")
                }
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={
                  isLast ? "font-medium " + (isLight ? "text-white" : "text-foreground") : ""
                }
              >
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        );
      })}
    </nav>
  );
}
