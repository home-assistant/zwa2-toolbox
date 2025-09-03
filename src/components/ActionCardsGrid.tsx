import React from 'react';

interface ActionCardsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function ActionCardsGrid({ children, columns = 3 }: ActionCardsGridProps) {
  // Force max 2 columns as per requirements
  const maxColumns = Math.min(columns, 2);
  const gridCols = maxColumns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1';

  return (
    <div className={classNames(
      'grid gap-4 sm:gap-6',
      gridCols
    )}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return child;
      })}
    </div>
  );
}
