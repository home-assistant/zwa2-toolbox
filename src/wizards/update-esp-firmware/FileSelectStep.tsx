import type { WizardStepProps } from '../../components/Wizard';
import type { UpdateESPFirmwareState, ESPFirmwareOption } from './wizard';

export default function FileSelectStep({ context }: WizardStepProps<UpdateESPFirmwareState>) {
  const { selectedFirmware } = context.state;

  const firmwareOptions: Array<{ value: ESPFirmwareOption; label: string; description: string }> = [
    {
      value: { type: "latest-esp" },
      label: "ESP bridge firmware (latest)",
      description: "Download and install the latest official ESP bridge firmware from GitHub"
    }
  ];

  const handleOptionChange = (option: ESPFirmwareOption) => {
    context.setState(prev => ({ ...prev, selectedFirmware: option }));
  };

  const isSelected = (option: ESPFirmwareOption) => {
    return selectedFirmware?.type === option.type;
  };

  return (
    <div className="py-8">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Choose which ESP firmware package to install
      </h3>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Select the ESP firmware package you want to install on your ZWA-2.
      </p>

      <div className="space-y-4">
        {firmwareOptions.map((option, index) => (
          <div
            key={index}
            className={`relative flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
              isSelected(option.value)
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 dark:border-purple-400'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
            onClick={() => handleOptionChange(option.value)}
          >
            <div className="flex items-center h-5">
              <input
                type="radio"
                name="espFirmwareOption"
                checked={isSelected(option.value)}
                onChange={() => handleOptionChange(option.value)}
                className="h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700"
              />
            </div>
            <div className="ml-3 text-sm">
              <label className="font-medium text-gray-900 dark:text-white cursor-pointer">
                {option.label}
              </label>
              <p className="text-gray-500 dark:text-gray-400">
                {option.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
