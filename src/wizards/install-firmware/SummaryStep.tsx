import type { WizardStepProps } from '../../components/Wizard';
import type { InstallFirmwareState } from './wizard';
import { firmwareTypeFromOption } from './wizard';

const FIRMWARE_TYPE_LABELS = {
  controller: "controller",
  repeater: "repeater",
  zniffer: "Zniffer",
} as const;

export default function SummaryStep({ context }: WizardStepProps<InstallFirmwareState>) {
  const { flashResult, errorMessage, selectedFirmware } = context.state;

  const firmwareLabel = selectedFirmware
    ? FIRMWARE_TYPE_LABELS[firmwareTypeFromOption(selectedFirmware)]
    : "controller";

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
            <div className="text-gray-600 dark:text-gray-300">
              <p>
                The latest {firmwareLabel} firmware has been installed.
              </p>
              {context.state.dsk && (
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-left">
                  <p className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">
                    Write down the DSK of your ZWA-2:
                  </p>
                  <p className="font-mono text-lg text-yellow-900 dark:text-yellow-100 select-all">
                    {context.state.dsk}
                  </p>
                  <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
                    You will need this key to include it in a Z-Wave network.
                  </p>
                </div>
              )}
            </div>
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
