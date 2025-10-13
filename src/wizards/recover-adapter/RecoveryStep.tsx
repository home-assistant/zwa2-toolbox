import { useState } from 'react';
import type { WizardStepProps } from '../../components/Wizard';
import type { RecoverAdapterState } from './wizard';

export default function RecoveryStep({ context }: WizardStepProps<RecoverAdapterState>) {
  const { diagnosisResult, selectedFile, isRecovering, recoveryProgress, downloadedFirmwareName } = context.state;
  const [useCustomFirmware, setUseCustomFirmware] = useState(false);

  if (isRecovering) {
    return (
      <div className="py-8">
        <h3 className="text-lg font-medium text-primary mb-4">
          Recovering Adapter
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
            { downloadedFirmwareName ? (
                <>Installing latest firmware: {downloadedFirmwareName}</>
            ) : (
                <>Installing firmware: {selectedFile?.name || "Latest firmware"}</>
            )}
        </p>
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
            <span>Progress</span>
            <span>{Math.round(recoveryProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div
              className="bg-orange-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${recoveryProgress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (diagnosisResult?.tag === "CORRUPTED_FIRMWARE") {
    return (
      <div className="py-8">
        <h3 className="text-lg font-medium text-primary mb-4">
          Recover corrupted firmware
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Your adapter is in bootloader mode due to corrupted firmware. Choose how you would like to recover it:
        </p>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              id="latest-firmware"
              name="firmware-option"
              type="radio"
              checked={!useCustomFirmware}
              onChange={() => setUseCustomFirmware(false)}
              className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-600"
            />
            <label htmlFor="latest-firmware" className="block text-sm font-medium text-primary">
              Install latest Z-Wave controller firmware
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <input
              id="custom-firmware"
              name="firmware-option"
              type="radio"
              checked={useCustomFirmware}
              onChange={() => setUseCustomFirmware(true)}
              className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-600"
            />
            <label htmlFor="custom-firmware" className="block text-sm font-medium text-primary">
              Provide custom firmware file (.gbl or .zip)
            </label>
          </div>

          {useCustomFirmware && (
            <div className="mt-4 ml-7">
              <input
                type="file"
                accept=".gbl,.zip"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  context.setState(prev => ({ ...prev, selectedFile: file }));
                }}
                className="block w-full text-sm text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 dark:file:bg-orange-500/10 dark:file:text-orange-400"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (diagnosisResult?.tag === "UNKNOWN_FIRMWARE") {
    return (
      <div className="py-8">
        <h3 className="text-lg font-medium text-primary mb-4">
          Recover Unknown Firmware
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Your adapter is running an unknown firmware. This could be Zniffer firmware or other custom firmware.
          How would you like to proceed?
        </p>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              id="latest-firmware-unknown"
              name="firmware-option-unknown"
              type="radio"
              checked={!useCustomFirmware}
              onChange={() => setUseCustomFirmware(false)}
              className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-600"
            />
            <label htmlFor="latest-firmware-unknown" className="block text-sm font-medium text-primary">
              Install latest Z-Wave controller firmware
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <input
              id="custom-firmware-unknown"
              name="firmware-option-unknown"
              type="radio"
              checked={useCustomFirmware}
              onChange={() => setUseCustomFirmware(true)}
              className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-600"
            />
            <label htmlFor="custom-firmware-unknown" className="block text-sm font-medium text-primary">
              Provide custom firmware file (.gbl or .zip)
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <input
              id="abort-recovery"
              name="firmware-option-unknown"
              type="radio"
              checked={false}
              onChange={() => {
                // Set a flag to abort and go to summary
                context.setState(prev => ({ ...prev, finalResult: { tag: "UNKNOWN_FIRMWARE" } }));
              }}
              className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-600"
            />
            <label htmlFor="abort-recovery" className="block text-sm font-medium text-primary">
              Abort recovery
            </label>
          </div>

          {useCustomFirmware && (
            <div className="mt-4 ml-7">
              <input
                type="file"
                accept=".gbl,.zip"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  context.setState(prev => ({ ...prev, selectedFile: file }));
                }}
                className="block w-full text-sm text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 dark:file:bg-orange-500/10 dark:file:text-orange-400"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // This should never happen as we should skip to summary for other cases
  return (
    <div className="py-8">
      <h3 className="text-lg font-medium text-primary mb-4">
        Recovery
      </h3>
      <p className="text-gray-600 dark:text-gray-300">
        No recovery action needed based on the diagnosis results.
      </p>
    </div>
  );
}
