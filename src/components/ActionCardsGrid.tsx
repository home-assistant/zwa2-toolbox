import React from 'react';

interface ActionCardsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function ActionCardsGrid({ children, columns = 3 }: ActionCardsGridProps) {
  const gridCols = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';

  return (
    <div className={classNames(
      'divide-y divide-gray-200 overflow-hidden rounded-lg bg-gray-200 shadow-sm sm:grid sm:divide-y-0 sm:divide-x dark:divide-white/10 dark:bg-gray-900 dark:shadow-none dark:outline dark:-outline-offset-1 dark:outline-white/20',
      gridCols
    )}>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;

        const totalChildren = React.Children.count(children);

        let additionalClasses = '';

        if (columns === 2) {
          if (index === 0) additionalClasses += ' rounded-tl-lg rounded-tr-lg sm:rounded-tr-none';
          if (index === 1) additionalClasses += ' sm:rounded-tr-lg';
          if (index === totalChildren - 2) additionalClasses += ' sm:rounded-bl-lg';
          if (index === totalChildren - 1) additionalClasses += ' rounded-br-lg rounded-bl-lg sm:rounded-bl-none';
          if (index % 2 === 1) additionalClasses += ' sm:border-l-0'; // Remove left border added by divide-x for proper spacing
        } else {
          // For 3 columns
          if (index === 0) additionalClasses += ' rounded-tl-lg sm:rounded-tl-lg';
          if (index === 2 && totalChildren >= 3) additionalClasses += ' rounded-tr-lg sm:rounded-tr-lg';
          if (index === totalChildren - 3 && totalChildren > 3) additionalClasses += ' sm:rounded-bl-lg';
          if (index === totalChildren - 1) additionalClasses += ' rounded-br-lg rounded-bl-lg sm:rounded-bl-none sm:rounded-br-lg';
          if (index % 3 === 1 || index % 3 === 2) additionalClasses += ' sm:border-l-0'; // Remove left border added by divide-x for proper spacing
        }

        return React.cloneElement(child as React.ReactElement<any>, {
          ...(child as React.ReactElement<any>).props,
          className: `${(child as React.ReactElement<any>).props.className || ''} ${additionalClasses}`.trim()
        });
      })}
    </div>
  );
}
