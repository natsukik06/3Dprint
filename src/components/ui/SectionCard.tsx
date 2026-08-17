import type { ReactNode } from "react";

type SectionCardProps = {
  step: number;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function SectionCard({
  step,
  title,
  description,
  action,
  children,
}: SectionCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white">
            {step}
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
