import { useState, useRef } from 'react';
import Wizard from '../components/Wizard';
import type { WizardStep } from '../components/ProgressSteps';
import Button from '../components/Button';
import ConnectStep from '../components/ConnectStep';

interface InstallFirmwareWizardProps {
  isConnected: boolean;
  onConnect: () => Promise<void>;
  onDisconnect?: () => Promise<void>;
  onClose: () => void;
  onFlashFirmware: (file: File) => Promise<boolean>;
  isConnecting: boolean;
  isFlashing: boolean;
  progress: number;
  disableNavigation?: boolean;
  preventUnload?: boolean;
}

export default function InstallFirmwareWizard({
  isConnected,
  onConnect,
  onDisconnect,
  onClose,
  onFlashFirmware,
  isConnecting,
  isFlashing,
  progress,
  disableNavigation = false,
  preventUnload = false,
}: InstallFirmwareWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps: WizardStep[] = [
    {
      id: 'Step 1',
      name: 'Connect',
      status: isConnected ? 'complete' : (currentStep === 0 ? 'current' : 'upcoming')
    },
    {
      id: 'Step 2',
      name: 'Select firmware',
      status: currentStep === 1 ? 'current' : (currentStep > 1 ? 'complete' : 'upcoming')
    },
    {
      id: 'Step 3',
      name: 'Install',
      status: currentStep === 2 ? 'current' : (currentStep > 2 ? 'complete' : 'upcoming')
    },
  ];

  const handleNext = async () => {
    if (currentStep === 0 && !isConnected) {
      await onConnect();
      // Advance to next step after successful connection
      setCurrentStep(1);
    } else if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (selectedFile) {
        const success = await onFlashFirmware(selectedFile);
        if (success) {
          setIsComplete(true);
        }
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDisconnect = async () => {
    if (onDisconnect) {
      await onDisconnect();
      // Reset wizard state as if just started
      setCurrentStep(0);
      setSelectedFile(null);
      setIsComplete(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <ConnectStep
          isConnected={isConnected}
          isConnecting={isConnecting}
          onDisconnect={handleDisconnect}
        />
      );
    }

    if (currentStep === 1) {
      return (
        <div className="py-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Select Firmware File
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Choose the firmware file you want to install on your ZWA-2 device.
          </p>

          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".hex,.ota,.zip"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile ? (
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Selected: {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB
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
                  Click to select a firmware file (.hex, .ota, .zip)
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

    if (currentStep === 2) {
      if (isComplete) {
        return (
          <div className="text-center py-8">
            <div className="text-green-600 dark:text-green-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Firmware Installed Successfully!
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Your ZWA-2 device has been updated with the new firmware.
            </p>
          </div>
        );
      }

      return (
        <div className="py-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Installing Firmware
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Installing firmware: {selectedFile?.name}
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
              Ready to install firmware. Click "Install" to begin.
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <Wizard
      steps={steps}
      currentStepIndex={currentStep}
      onNext={handleNext}
      onBack={handleBack}
      onCancel={onClose}
      showCancel={!isFlashing && !isComplete}
      disableNext={
        (currentStep === 0 && !isConnected && isConnecting) ||
        (currentStep === 1 && !selectedFile) ||
        isFlashing ||
        isComplete
      }
      disableBack={isFlashing}
      disableNavigation={disableNavigation}
      preventUnload={preventUnload}
      nextLabel={
        (currentStep === 0 && !isConnected) ? 'Connect' :
        (currentStep === 2 && !isComplete) ? 'Install' :
        isComplete ? 'Finish' : 'Next'
      }
    >
      {renderStepContent()}
    </Wizard>
  );
}
