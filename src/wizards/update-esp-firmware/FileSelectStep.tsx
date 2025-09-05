import { useCallback, useEffect, useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import type { WizardStepProps } from '../../components/Wizard';
import type { UpdateESPFirmwareState, ESPFirmwareOption } from './wizard';
import { fetchLatestESPFirmwareInfo } from '../../lib/esp-firmware-download';
import Modal from '../../components/Modal';

export default function FileSelectStep({ context }: WizardStepProps<UpdateESPFirmwareState>) {
  const { selectedFirmware, latestESPFirmwareInfo, isLoadingFirmwareInfo } = context.state;
  const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);

  // Fetch release info when component mounts
  useEffect(() => {
    if (!latestESPFirmwareInfo && !isLoadingFirmwareInfo) {
      context.setState(prev => ({ ...prev, isLoadingFirmwareInfo: true }));

      fetchLatestESPFirmwareInfo()
        .then(info => {
          context.setState(prev => ({
            ...prev,
            latestESPFirmwareInfo: info,
            isLoadingFirmwareInfo: false,
          }));
        })
        .catch(error => {
          console.error('Failed to fetch ESP firmware info:', error);
          context.setState(prev => ({
            ...prev,
            isLoadingFirmwareInfo: false,
          }));
        });
    }
  }, [context, latestESPFirmwareInfo, isLoadingFirmwareInfo]);

  const handleOptionChange = useCallback((option: ESPFirmwareOption) => {
    // When selecting the latest option, store the actual version
    if (option.type === "latest-esp" && latestESPFirmwareInfo) {
      option.version = latestESPFirmwareInfo.version;
    }
    context.setState(prev => ({ ...prev, selectedFirmware: option }));
  }, [context, latestESPFirmwareInfo]);

  const isSelected = useCallback((option: ESPFirmwareOption) => {
    return selectedFirmware?.type === option.type;
  }, [selectedFirmware]);

  const openChangelogModal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsChangelogModalOpen(true);
  }, []);

  const closeChangelogModal = useCallback(() => {
    setIsChangelogModalOpen(false);
  }, []);

  const firmwareOptions: Array<{ value: ESPFirmwareOption; label: string; description: string }> = [
    {
      value: { type: "latest-esp" },
      label: "ESP bridge firmware (latest)",
      description: "Download and install the latest official ESP bridge firmware from GitHub"
    }
  ];

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
            <div className="ml-3 text-sm flex-1">
              <div className="flex items-center gap-1 flex-wrap">
                <label className="font-medium text-gray-900 dark:text-white cursor-pointer">
                  {option.label}
                </label>
                {isLoadingFirmwareInfo && option.value.type === "latest-esp" && (
                  <span className="text-gray-500 dark:text-gray-400">
                    · Loading...
                  </span>
                )}
                {latestESPFirmwareInfo && option.value.type === "latest-esp" && (
                  <>
                    <span className="text-gray-500 dark:text-gray-400">
                      · {latestESPFirmwareInfo.version} ·
                    </span>
                    <button
                      onClick={openChangelogModal}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                    >
                      changelog
                    </button>
                  </>
                )}
              </div>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {option.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Changelog Modal */}
      <Modal
        isOpen={isChangelogModalOpen}
        onClose={closeChangelogModal}
        title={`Changelog · ${latestESPFirmwareInfo?.version || ''}`}
        content={
          <div className="max-h-96 overflow-y-auto">
            <div className="whitespace-pre-wrap text-sm font-mono">
              {latestESPFirmwareInfo?.changelog || 'No changelog available.'}
            </div>
          </div>
        }
        icon={InformationCircleIcon}
        iconClassName="size-6 text-blue-600 dark:text-blue-400"
        iconBackgroundClassName="bg-blue-100 dark:bg-blue-500/10"
        primaryButton={{
          label: "Dismiss",
          onClick: closeChangelogModal,
          className: "inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 sm:ml-3 sm:w-auto dark:bg-blue-500 dark:shadow-none dark:hover:bg-blue-400"
        }}
        showCloseButton={true}
        closeOnBackdrop={true}
      />
    </div>
  );
}
