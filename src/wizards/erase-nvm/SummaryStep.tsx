import type { WizardStepProps } from '../../components/Wizard';
import type { EraseNVMState } from './wizard';

export default function SummaryStep({ context }: WizardStepProps<EraseNVMState>) {
  const { eraseResult, errorMessage } = context.state;

  return (
    <div className="text-center py-8">
      {eraseResult === 'success' && (
        <>
          <div className="text-green-600 dark:text-green-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            NVM Erased Successfully!
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            All Z-Wave network data has been removed from your device and the application has been started.
          </p>
        </>
      )}

      {eraseResult === 'warning' && (
        <>
          <div className="text-orange-600 dark:text-orange-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            NVM Erased with Warning
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            {errorMessage}
          </p>
        </>
      )}

      {eraseResult === 'error' && (
        <>
          <div className="text-red-600 dark:text-red-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Erase Failed
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            {errorMessage}
          </p>
        </>
      )}
    </div>
  );
}
