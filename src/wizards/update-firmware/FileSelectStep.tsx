import { useRef } from 'react';
import Button from '../../components/Button';
import type { WizardStepProps } from '../../components/Wizard';
import type { UpdateFirmwareState } from './wizard';

export default function FileSelectStep({ context }: WizardStepProps<UpdateFirmwareState>) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      context.setState(prev => ({
        ...prev,
        selectedFile: file,
      }));
    }
  };

  return (
    <div className="py-8">
      <h3 className="text-lg font-medium text-primary mb-4">
        Select Firmware Update
      </h3>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Choose the firmware update file for your ZWA-2.
      </p>

      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".hex,.ota,.zip"
          onChange={handleFileSelect}
          className="hidden"
        />

        {context.state.selectedFile ? (
          <div>
            <p className="text-sm font-medium text-primary">
              Selected: {context.state.selectedFile.name}
            </p>
            <p className="text-xs text-secondary mt-1">
              {(context.state.selectedFile.size / 1024).toFixed(1)} KB
            </p>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4"
            >
              Choose Different File
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Click to select a firmware update file (.hex, .ota, .zip)
            </p>
            <Button onClick={() => fileInputRef.current?.click()}>
              Select File
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
