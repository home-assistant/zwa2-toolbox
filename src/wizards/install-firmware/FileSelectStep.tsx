import type { WizardStepProps } from '../../components/Wizard';
import type { InstallFirmwareState, FirmwareOption, FirmwareType } from './wizard';
import { firmwareTypeFromOption, needsDataLossWarning } from './wizard';
import Spinner from '../../components/Spinner';

const FIRMWARE_TYPE_LABELS: Record<FirmwareType, string> = {
  controller: "Controller",
  repeater: "Repeater",
  zniffer: "Zniffer",
};

const firmwareOptions: Array<{ value: FirmwareOption; label: string; description: string; experimental?: boolean }> = [
  {
    value: { type: "latest-controller" },
    label: "Controller firmware (latest)",
    description: "Download and install the latest official controller firmware from GitHub",
  },
  {
    value: { type: "latest-repeater" },
    label: "Repeater firmware (latest)",
    description: "Turn your ZWA-2 into a repeater",
    experimental: true,
  },
  {
    value: { type: "latest-zniffer" },
    label: "Zniffer firmware (latest)",
    description: "Capture and analyze Z-Wave network traffic",
    experimental: true,
  },
];

export default function FileSelectStep({ context }: WizardStepProps<InstallFirmwareState>) {
  const { selectedFirmware, detectedFirmwareType, detectionState, dataLossConfirmed } = context.state;

  const handleOptionChange = (option: FirmwareOption) => {
    context.setState(prev => ({
      ...prev,
      selectedFirmware: option,
      dataLossConfirmed: false,
    }));
  };

  const isSelected = (option: FirmwareOption) => {
    return selectedFirmware?.type === option.type;
  };

  const showWarning = selectedFirmware
    && detectionState === "done"
    && needsDataLossWarning(detectedFirmwareType, firmwareTypeFromOption(selectedFirmware));

  return (
    <div className="py-8">
      <h3 className="text-lg font-medium text-primary mb-4">
        Choose which firmware package to install
      </h3>

      {detectionState === "detecting" ? (
        <div className="flex items-center gap-3 mb-6">
          <Spinner size="h-5 w-5" />
          <p className="text-secondary">Detecting current firmware...</p>
        </div>
      ) : detectionState === "done" ? (
        <p className="text-secondary mb-6">
          Currently installed:{" "}
          {detectedFirmwareType
            ? <span className="font-medium text-primary">{FIRMWARE_TYPE_LABELS[detectedFirmwareType]} firmware</span>
            : <span className="font-medium text-primary">Unknown</span>
          }
        </p>
      ) : (
        <p className="text-secondary mb-6">
          Select the firmware package you want to install on your ZWA-2.
        </p>
      )}

      <div className="space-y-4">
        {firmwareOptions.map((option, index) => (
          <div
            key={index}
            className={`relative flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
              isSelected(option.value)
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-400'
                : 'border-app-border hover:border-app-border-hover'
            }`}
            onClick={() => handleOptionChange(option.value)}
          >
            <div className="flex items-center h-5">
              <input
                type="radio"
                name="firmwareOption"
                checked={isSelected(option.value)}
                onChange={() => handleOptionChange(option.value)}
                className="h-4 w-4 text-blue-600 border-app-border focus:ring-blue-500 dark:bg-gray-700"
              />
            </div>
            <div className="ml-3 text-sm">
              <label className="font-medium text-primary cursor-pointer">
                {option.label}
                {option.experimental && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:text-yellow-300">
                    Experimental
                  </span>
                )}
              </label>
              <p className="text-secondary">
                {option.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {showWarning && (
        <div className="mt-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Warning: This will erase existing network data
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  {detectedFirmwareType === null ? (
                    <p>
                      We cannot determine the current firmware type. Installing new firmware will erase all existing network data from the device.
                    </p>
                  ) : detectedFirmwareType === "controller" ? (
                    <p>
                      Switching from {FIRMWARE_TYPE_LABELS[detectedFirmwareType]} firmware to {FIRMWARE_TYPE_LABELS[firmwareTypeFromOption(selectedFirmware)]} firmware will erase the Z-Wave network from the device. All joined devices will be orphaned and need to be re-included in a new network.
                    </p>
                  ) : (
                    <p>
                      Switching from {FIRMWARE_TYPE_LABELS[detectedFirmwareType]} firmware to {FIRMWARE_TYPE_LABELS[firmwareTypeFromOption(selectedFirmware)]} firmware will erase all Z-Wave network data from the device, including network membership, security keys, and node associations.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="confirm-data-loss"
              type="checkbox"
              checked={dataLossConfirmed}
              onChange={(e) => context.setState(prev => ({ ...prev, dataLossConfirmed: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-app-border rounded dark:bg-gray-700"
            />
            <label htmlFor="confirm-data-loss" className="ml-2 block text-sm text-primary">
              I understand that switching firmware will erase all network data from the device.
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
