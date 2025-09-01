import { ChevronRightIcon, HomeIcon } from '@heroicons/react/20/solid';

interface BreadcrumbItem {
  name: string;
  href?: string;
  current?: boolean;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onHomeClick?: () => void;
  disabled?: boolean;
}

export default function Breadcrumb({ items, onHomeClick, disabled = false }: BreadcrumbProps) {
  const handleClick = (item: BreadcrumbItem, e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }

    if (item.onClick) {
      e.preventDefault();
      item.onClick();
    }
  };

  const handleHomeClick = (e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }

    if (onHomeClick) {
      e.preventDefault();
      onHomeClick();
    }
  };

  return (
    <nav aria-label="Breadcrumb" className="flex">
      <ol role="list" className="flex items-center space-x-4">
        <li>
          <div>
            <a
              href="#"
              onClick={handleHomeClick}
              className={`${
                disabled
                  ? 'text-gray-300 cursor-not-allowed dark:text-gray-600'
                  : 'text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300'
              }`}
            >
              <HomeIcon aria-hidden="true" className="size-5 shrink-0" />
              <span className="sr-only">Home</span>
            </a>
          </div>
        </li>
        {items.map((item) => (
          <li key={item.name}>
            <div className="flex items-center">
              <ChevronRightIcon
                aria-hidden="true"
                className={`size-5 shrink-0 ${
                  disabled
                    ? 'text-gray-300 dark:text-gray-600'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              />
              <a
                href={item.href || '#'}
                onClick={(e) => handleClick(item, e)}
                aria-current={item.current ? 'page' : undefined}
                className={`ml-4 text-sm font-medium ${
                  disabled
                    ? 'text-gray-300 cursor-not-allowed dark:text-gray-600'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {item.name}
              </a>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
