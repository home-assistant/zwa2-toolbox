import React from 'react';

interface ActionCardsGridProps {
  children: React.ReactNode;
}

export default function ActionCardsGrid({ children }: ActionCardsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {React.Children.map(children, (child) => (
        <div className="w-full h-full">
          {React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<any>, {
                ...(child as React.ReactElement<any>).props,
                className: `${(child as React.ReactElement<any>).props.className || ''} w-full h-full max-w-[400px] mx-auto`.trim(),
              })
            : child}
        </div>
      ))}
    </div>
  );
}
