import type { ReactNode } from "react";

type RadioCardProps = {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
  description?: string;
  hint?: string;
  icon?: ReactNode;
};

export function RadioCard({
  name,
  value,
  checked,
  onChange,
  label,
  description,
  hint,
  icon,
}: RadioCardProps) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
        checked
          ? "border-slate-800 bg-slate-50 ring-1 ring-slate-800"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-slate-800"
      />
      {icon}
      <span className="flex-1">
        <span className="block text-sm font-medium text-slate-900">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs text-slate-500">
            {description}
          </span>
        )}
      </span>
      {hint && (
        <span className="shrink-0 text-sm font-semibold text-slate-700">
          {hint}
        </span>
      )}
    </label>
  );
}
