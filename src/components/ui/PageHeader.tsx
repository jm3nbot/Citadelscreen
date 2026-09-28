export function PageHeader({
  tag,
  title,
  subtitle,
  right,
  icon,
}: {
  tag: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  // Optional leading visual (e.g. a brand logo) shown before the title block.
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && <div className="shrink-0">{icon}</div>}
        <div>
          <div className="mono-tag">{tag}</div>
          <h1 className="mt-1 text-[24px] font-medium tracking-tight text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-[13px] text-muted">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
