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

// 좁은 화면에서는 항목 단위로 다음 줄로 넘어간다. 항목 안에서는 줄바꿈하지 않고, 긴 교육명은 말줄임한다.
export default function Breadcrumb({ items, variant = "default" }: Props) {
  const isLight = variant === "light";
  return (
    <nav
      aria-label="상위 경로"
      className={"flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm " + (isLight ? "text-white/60" : "text-muted-foreground")}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex min-w-0 max-w-full items-center gap-1.5">
            {item.to && !isLast ? (
              <Link
                href={item.to}
                className={"truncate whitespace-nowrap transition-colors " + (isLight ? "hover:text-white" : "hover:text-foreground")}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={
                  "truncate whitespace-nowrap " + (isLast ? "font-medium " + (isLight ? "text-white" : "text-foreground") : "")
                }
              >
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
          </span>
        );
      })}
    </nav>
  );
}
