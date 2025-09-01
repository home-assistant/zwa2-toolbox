import { useState } from 'react';
import Wizard from '../components/Wizard';
import type { WizardStep } from '../components/ProgressSteps';
import ConnectStep from '../components/ConnectStep';

interface EraseNVMWizardProps {
  isConnected: boolean;
  onConnect: () => Promise<void>;
  onDisconnect?: () => Promise<void>;
  onClose: () => void;
  onEraseNVM: () => Promise<boolean>;
  isConnecting: boolean;
  isErasing: boolean;
  disableNavigation?: boolean;
  preventUnload?: boolean;
}

export default function EraseNVMWizard({
  isConnected,
  onConnect,
  onDisconnect,
  onClose,
  onEraseNVM,
  isConnecting,
  isErasing,
  disableNavigation = false,
  preventUnload = false,
}: EraseNVMWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const steps: WizardStep[] = [
    {
      id: 'Step 1',
      name: 'Connect',
      status: isConnected ? 'complete' : (currentStep === 0 ? 'current' : 'upcoming')
    },
    {
      id: 'Step 2',
      name: 'Confirm',
      status: currentStep === 1 ? 'current' : (currentStep > 1 ? 'complete' : 'upcoming')
    },
    {
      id: 'Step 3',
      name: 'Erase',
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
      const success = await onEraseNVM();
      if (success) {
        setIsComplete(true);
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
      setConfirmed(false);
      setIsComplete(false);
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
            Confirm NVM Erase
          </h3>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Warning: This action cannot be undone
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>
                    Erasing the NVM (Non-Volatile Memory) will permanently remove all Z-Wave network data from your device, including:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Network membership information</li>
                    <li>Security keys</li>
                    <li>Node associations</li>
                    <li>Device configuration</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="confirm-erase"
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="confirm-erase" className="ml-2 block text-sm text-gray-900 dark:text-white">
              I understand that this action cannot be undone and I want to proceed with erasing the NVM.
            </label>
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
              NVM Erased Successfully!
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              All Z-Wave network data has been removed from your device.
            </p>
          </div>
        );
      }

      return (
        <div className="py-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Erasing NVM
          </h3>

          {isErasing ? (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">
                Erasing NVM data...
              </p>
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-300">
              Ready to erase NVM data. Click "Erase" to begin.
            </p>
          )}
        </div>
      );
    }

    return null;
  };  return (
    <Wizard
      steps={steps}
      currentStepIndex={currentStep}
      onNext={handleNext}
      onBack={handleBack}
      onCancel={onClose}
      showCancel={!isErasing && !isComplete}
      disableNext={
        (currentStep === 0 && !isConnected && isConnecting) ||
        (currentStep === 1 && !confirmed) ||
        isErasing ||
        isComplete
      }
      disableBack={isErasing}
      disableNavigation={disableNavigation}
      preventUnload={preventUnload}
      nextLabel={
        (currentStep === 0 && !isConnected) ? 'Connect' :
        (currentStep === 2 && !isComplete) ? 'Erase' :
        isComplete ? 'Finish' : 'Next'
      }
    >
      {renderStepContent()}
    </Wizard>
  );
}
