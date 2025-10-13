import type { WizardStepProps } from '../../components/Wizard';
import type { EraseNVMState } from './wizard';

export default function SummaryStep({ context }: WizardStepProps<EraseNVMState>) {
  const { eraseResult, errorMessage } = context.state;

  return (
    <div className="py-8">
      <h3 className="text-lg font-medium text-primary mb-4">
        Erase Summary
      </h3>

      <div className="mt-6">
        {eraseResult === "success" && (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-500/10 mb-4">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-600 dark:text-green-400 font-medium">
              NVM erased successfully!
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              All Z-Wave network data has been removed from your device and the application has been started.
            </p>
          </div>
        )}

        {eraseResult === "warning" && (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-500/10 mb-4">
              <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-yellow-600 dark:text-yellow-400 font-medium mb-2">
              NVM erased with warnings
            </p>
            {errorMessage && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {errorMessage}
              </p>
            )}
          </div>
        )}

        {eraseResult === "error" && (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-500/10 mb-4">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-600 dark:text-red-400 font-medium mb-2">
              Failed to erase NVM
            </p>
            {errorMessage && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {errorMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
