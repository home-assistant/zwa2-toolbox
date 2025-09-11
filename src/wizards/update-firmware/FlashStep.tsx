import type { WizardStepProps } from '../../components/Wizard';
import type { UpdateFirmwareState } from './wizard';

export default function FlashStep({ context }: WizardStepProps<UpdateFirmwareState>) {
  const { selectedFile, isFlashing, progress, isComplete } = context.state;

  if (isComplete) {
    return (
      <div className="text-center py-8">
        <div className="text-green-600 dark:text-green-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Firmware Updated Successfully!
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Your ZWA-2 has been updated to the latest firmware.
        </p>
      </div>
    );
  }

  return (
    <div className="py-8">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Updating firmware
      </h3>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Updating firmware: {selectedFile?.name}
      </p>

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
        </div>
      )}

      {!isFlashing && !isComplete && (
        <p className="text-gray-600 dark:text-gray-300">
          Ready to update firmware. Click "Update" to begin.
        </p>
      )}
    </div>
  );
}
