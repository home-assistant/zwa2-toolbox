import type { WizardStepProps } from '../../components/Wizard';
import type { InstallFirmwareState } from './wizard';

export default function FlashStep({ context }: WizardStepProps<InstallFirmwareState>) {
  const { selectedFirmware, isFlashing, progress, flashResult, downloadedFirmwareName } = context.state;

  if (flashResult !== null) {
    // Show completion state, but let the Summary step handle the actual result display
    return (
      <div className="text-center py-8">
        <div className="text-gray-600 dark:text-gray-300">
          <p>Installation process completed. Click "Next" to see the results.</p>
        </div>
      </div>
    );
  }

  const getFirmwareDescription = () => {
    if (!selectedFirmware) return "No firmware selected";

    switch (selectedFirmware.type) {
      case "latest-controller":
        return "Latest controller firmware";
      default:
        return "Unknown firmware";
    }
  };

  return (
    <div className="py-8">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Install Firmware
      </h3>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        {getFirmwareDescription()}
      </p>

      {downloadedFirmwareName && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Downloaded: {downloadedFirmwareName}
        </p>
      )}

      {isFlashing && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {progress < 50 ? "Downloading firmware..." : "Installing firmware..."}
          </p>
        </div>
      )}

      {!isFlashing && flashResult === null && (
        <p className="text-gray-600 dark:text-gray-300">
          Installing firmware...
        </p>
      )}
    </div>
  );
}
