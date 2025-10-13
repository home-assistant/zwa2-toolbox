import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ComponentType } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string | React.ReactNode;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  iconClassName?: string;
  iconBackgroundClassName?: string;
  primaryButton?: {
    label: string;
    onClick: () => void;
    className?: string;
  };
  secondaryButton?: {
    label: string;
    onClick: () => void;
    className?: string;
  };
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  content,
  icon: Icon,
  iconClassName = "size-6",
  iconBackgroundClassName = "bg-red-100 dark:bg-red-500/10",
  primaryButton,
  secondaryButton,
  showCloseButton = false,
  closeOnBackdrop = true,
}: ModalProps) {
  const handleBackdropClick = () => {
    if (closeOnBackdrop || showCloseButton) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleBackdropClick} className="relative z-10">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:bg-gray-900/50"
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative transform overflow-hidden rounded-lg bg-app-card text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-2xl data-closed:sm:translate-y-0 data-closed:sm:scale-95 dark:outline dark:-outline-offset-1 dark:outline-app-border"
          >
            {showCloseButton && (
              <div className="absolute right-0 top-0 pr-4 pt-4 sm:pr-6 sm:pt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-app-card text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:text-gray-300 dark:hover:text-gray-400"
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="size-6" aria-hidden="true" />
                </button>
              </div>
            )}

            <div className="bg-app-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                {Icon && (
                  <div className={`mx-auto flex size-12 shrink-0 items-center justify-center rounded-full sm:mx-0 sm:size-10 ${iconBackgroundClassName}`}>
                    <Icon aria-hidden={true} className={iconClassName} />
                  </div>
                )}
                <div className={`mt-3 text-center sm:mt-0 sm:text-left ${Icon ? 'sm:ml-4' : ''}`}>
                  <DialogTitle as="h3" className="text-base font-semibold text-primary">
                    {title}
                  </DialogTitle>
                  <div className="mt-2">
                    {typeof content === 'string' ? (
                      <p className="text-sm text-secondary">
                        {content}
                      </p>
                    ) : (
                      <div className="text-sm text-secondary">
                        {content}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {(primaryButton || secondaryButton) && (
              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 dark:bg-gray-700/25">
                {primaryButton && (
                  <button
                    type="button"
                    onClick={primaryButton.onClick}
                    className={primaryButton.className || "inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 sm:ml-3 sm:w-auto dark:bg-blue-500 dark:shadow-none dark:hover:bg-blue-400"}
                  >
                    {primaryButton.label}
                  </button>
                )}
                {secondaryButton && (
                  <button
                    type="button"
                    onClick={secondaryButton.onClick}
                    className={secondaryButton.className || "mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-primary shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-white/10 dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"}
                  >
                    {secondaryButton.label}
                  </button>
                )}
              </div>
            )}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
