import { useState } from 'react';
import type { WizardStepProps } from '../../components/Wizard';
import type { EraseNVMState } from './wizard';

export default function ConfirmStep({ context }: WizardStepProps<EraseNVMState>) {
  const [confirmed, setConfirmed] = useState(context.state.confirmed);

  const handleConfirmChange = (checked: boolean) => {
    setConfirmed(checked);
    context.setState(prev => ({
      ...prev,
      confirmed: checked,
    }));
  };

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
              <p className="mt-2">
                All connected Z-Wave devices will be orphaned and will need to be re-included in the network.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center">
        <input
          id="confirm-erase"
          type="checkbox"
          checked={confirmed}
          onChange={(e) => handleConfirmChange(e.target.checked)}
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
        />
        <label htmlFor="confirm-erase" className="ml-2 block text-sm text-gray-900 dark:text-white">
          I understand that this action cannot be undone and I want to proceed with erasing the NVM.
        </label>
      </div>
    </div>
  );
}
