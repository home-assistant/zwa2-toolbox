import React from 'react';

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  iconForeground: string;
  iconBackground: string;
  onClick: () => void;
  disabled?: boolean;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function ActionCard({
  title,
  description,
  icon: Icon,
  iconForeground,
  iconBackground,
  onClick,
  disabled = false,
}: ActionCardProps) {
  return (
    <div
      className={classNames(
        'group relative bg-white p-6 shadow rounded-lg h-full border border-gray-200 dark:border-white/10 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-indigo-600 dark:bg-gray-800 dark:focus-within:outline-indigo-500',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/70'
      )}
      onClick={disabled ? undefined : onClick}
    >
      <div>
        <span className={classNames(iconBackground, iconForeground, 'inline-flex rounded-lg p-3')}>
          <Icon aria-hidden={true} className="size-6" />
        </span>
      </div>
      <div className="mt-8">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          <button
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            className={classNames(
              "focus:outline-hidden",
              disabled ? 'cursor-not-allowed' : 'cursor-pointer'
            )}
          >
            <span aria-hidden="true" className="absolute inset-0" />
            {title}
          </button>
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400 dark:text-gray-500 dark:group-hover:text-gray-200"
      >
        <svg fill="currentColor" viewBox="0 0 24 24" className="size-6">
          <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
        </svg>
      </span>
    </div>
  );
}
