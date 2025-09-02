import type { WizardStepProps } from '../../components/Wizard';
import type { InstallFirmwareState } from './wizard';
import CircularProgress from '../../components/CircularProgress';

export default function FlashStep({ context }: WizardStepProps<InstallFirmwareState>) {
  const { isFlashing, progress, flashResult, downloadedFirmwareName, isDownloading } = context.state;

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

  // Show indeterminate spinner if downloading or no firmware name yet
  if (isDownloading || !downloadedFirmwareName) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Install Firmware
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          {downloadedFirmwareName ? `Downloading ${downloadedFirmwareName}...` : 'Preparing to download firmware...'}
        </p>
      </div>
    );
  }

  // Show circular progress during installation
  if (isFlashing && !isDownloading) {
    return (
      <div className="text-center py-8">
        <CircularProgress progress={progress} className="mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Install Firmware
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Installing {downloadedFirmwareName}...
        </p>
      </div>
    );
  }

  // Fallback state
  return (
    <div className="text-center py-8">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Install Firmware
      </h3>
      <p className="text-gray-600 dark:text-gray-300">
        Ready to install firmware...
      </p>
    </div>
  );
}
