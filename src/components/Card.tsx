import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  standalone?: boolean;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '', standalone = false }: CardProps) {
  const borderStyles = standalone
    ? ''
    : 'rounded-lg shadow-sm dark:shadow-none dark:outline dark:-outline-offset-1 dark:outline-app-border';

  return (
    <div className={`divide-y divide-app-border overflow-hidden bg-app-card ${borderStyles} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`px-4 py-5 sm:px-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return (
    <div className={`px-4 py-5 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`px-4 py-4 sm:px-6 ${className}`}>
      {children}
    </div>
  );
}
