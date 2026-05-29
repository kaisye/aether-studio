import clsx from "clsx";

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("rounded-xl border border-[var(--outline)] bg-[var(--surface)]", className)}>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-normal">{title}</h1>
        <p className="mt-2 max-w-3xl text-base text-[var(--muted)]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Panel className="flex min-h-64 flex-col items-center justify-center p-10 text-center">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{description}</p>
    </Panel>
  );
}
