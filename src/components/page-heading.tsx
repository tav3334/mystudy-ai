export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap justify-between items-start gap-4 mb-7">
      <div>
        <p className="label text-emerald-700 dark:text-emerald-400 text-[10px] mb-3">
          {eyebrow}
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        <p className="muted mt-2 text-sm max-w-2xl leading-6">{description}</p>
      </div>
      {children}
    </div>
  );
}
