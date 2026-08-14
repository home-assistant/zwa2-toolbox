import type { ReactNode } from 'react';
import CircularProgress from './CircularProgress';
import Spinner from './Spinner';

interface StatusPanelProps {
  /** Percentage for a progress ring. Omit it for an indeterminate spinner. */
  progress?: number;
  title: ReactNode;
  children?: ReactNode;
}

/** Centred panel for a step that is working and has nothing to interact with */
export default function StatusPanel({ progress, title, children }: StatusPanelProps) {
  return (
    <div className="text-center py-8">
      {progress === undefined ? (
        <Spinner className="mx-auto mb-4" />
      ) : (
        <CircularProgress progress={progress} className="mb-4" />
      )}
      <h3 className="text-lg font-medium text-primary mb-2">{title}</h3>
      <div className="text-gray-600 dark:text-gray-300">{children}</div>
    </div>
  );
}
