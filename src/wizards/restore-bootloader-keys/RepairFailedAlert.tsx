import type { ReactNode } from 'react';
import Alert from '../../components/Alert';

interface RepairFailedAlertProps {
  message: string;
  /** What the user should do next. Each step says something different. */
  children?: ReactNode;
}

export default function RepairFailedAlert({ message, children }: RepairFailedAlertProps) {
  return (
    <Alert title="The repair did not finish" severity="error">
      <p>{message}</p>
      {children && <p className="mt-2">{children}</p>}
    </Alert>
  );
}
