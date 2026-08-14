import type { ReactNode } from 'react';

interface RadioCardProps {
  name: string;
  selected: boolean;
  onSelect: () => void;
  label: string;
  description: ReactNode;
  experimental?: boolean;
  /** Rendered on the label row, for things like a version and a changelog link */
  labelSuffix?: ReactNode;
}

export default function RadioCard({
  name,
  selected,
  onSelect,
  label,
  description,
  experimental,
  labelSuffix,
}: RadioCardProps) {
  return (
    <div
      className={`relative flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-400'
          : 'border-app-border hover:border-app-border-hover'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center h-5">
        <input
          type="radio"
          name={name}
          checked={selected}
          onChange={onSelect}
          className="h-4 w-4 text-blue-600 border-app-border focus:ring-blue-500 dark:bg-gray-700"
        />
      </div>
      <div className="ml-3 text-sm flex-1">
        <div className="flex items-center gap-1 flex-wrap">
          <label className="font-medium text-primary cursor-pointer">{label}</label>
          {experimental && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
              Experimental
            </span>
          )}
          {labelSuffix}
        </div>
        <p className="text-secondary mt-1">{description}</p>
      </div>
    </div>
  );
}
