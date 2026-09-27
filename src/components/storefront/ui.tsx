import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Home / Section / Page trail. The last item is the current page. */
export function Breadcrumbs({ items }: { items: [label: string, href?: string][] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map(([label, href], i) => (
          <li key={`${label}-${i}`}>
            {href && i < items.length - 1 ? (
              <Link href={href}>{label}</Link>
            ) : (
              <span aria-current="page">{label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Section title row with an optional "View all" link. */
export function SectionHead({
  title,
  description,
  href,
  linkLabel = "View all",
}: {
  title: string;
  description?: string | null;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {href && (
        <Link href={href} className="button ghost sm">
          {linkLabel} <ArrowRight size={15} aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** Read-only star rating. Fractional averages fill partially; text carries the value. */
export function Stars({ value, size = 15, label }: { value: number; size?: number; label?: string }) {
  const row = (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <path d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z" />
        </svg>
      ))}
    </>
  );
  return (
    <span
      className="stars"
      role="img"
      aria-label={label ?? `Rated ${value.toFixed(1)} out of 5`}
      style={{ "--stars": `${Math.max(0, Math.min(5, value)) * 20}%` } as React.CSSProperties}
    >
      <span className="stars-base">{row}</span>
      <span className="stars-fill">{row}</span>
    </span>
  );
}
