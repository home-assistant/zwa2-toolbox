import type { WizardStepProps } from '../../components/Wizard';
import type { InstallFirmwareState } from './wizard';

export default function SummaryStep({ context }: WizardStepProps<InstallFirmwareState>) {
  const { flashResult, errorMessage } = context.state;

  const getResultContent = () => {
    switch (flashResult) {
      case "success":
        return {
          icon: (
            <div className="text-green-600 dark:text-green-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          ),
          title: "Firmware installed successfully!",
          message: (
            <p className="text-gray-600 dark:text-gray-300">
              Your ZWA-2 has been updated with the latest controller firmware.
            </p>
          )
        };

      case "error":
        return {
          icon: (
            <div className="text-red-600 dark:text-red-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
          ),
          title: "Installation failed",
          message: (
            <div>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                The firmware installation could not be completed.
              </p>
              {errorMessage && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded">
                  {errorMessage}
                </p>
              )}
            </div>
          )
        };

      default:
        return {
          icon: (
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
          ),
          title: "Installation status unknown",
          message: (
            <p className="text-gray-600 dark:text-gray-300">
              The installation process was interrupted or did not complete normally.
            </p>
          )
        };
    }
  };

  const content = getResultContent();

  return (
    <div className="text-center py-8">
      {content.icon}
      <h3 className="text-lg font-medium text-primary mb-2">
        {content.title}
      </h3>
      {content.message}
    </div>
  );
}
