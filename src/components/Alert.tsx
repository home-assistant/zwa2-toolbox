import { ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/20/solid';
import type { ReactNode } from 'react';

type AlertSeverity = 'warning' | 'error';

interface AlertProps {
  title: string;
  children: ReactNode;
  severity?: AlertSeverity;
}

const styles = {
  warning: {
    container: 'rounded-md bg-yellow-50 p-4 dark:bg-yellow-500/10 dark:outline dark:outline-yellow-500/15',
    icon: <ExclamationTriangleIcon aria-hidden="true" className="size-5 text-yellow-400 dark:text-yellow-300" />,
    title: 'text-sm font-medium text-yellow-800 dark:text-yellow-100',
    content: 'mt-2 text-sm text-yellow-700 dark:text-yellow-100/80',
  },
  error: {
    container: 'rounded-md bg-red-50 p-4 dark:bg-red-500/15 dark:outline dark:outline-red-500/25',
    icon: <XCircleIcon aria-hidden="true" className="size-5 text-red-400" />,
    title: 'text-sm font-medium text-red-800 dark:text-red-200',
    content: 'mt-2 text-sm text-red-700 dark:text-red-200/80',
  },
};

export default function Alert({ title, children, severity = 'warning' }: AlertProps) {
  const s = styles[severity];
  return (
    <div className={s.container}>
      <div className="flex">
        <div className="shrink-0">{s.icon}</div>
        <div className="ml-3">
          <h3 className={s.title}>{title}</h3>
          <div className={s.content}>{children}</div>
        </div>
      </div>
    </div>
  );
}
