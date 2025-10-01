import { useCallback, useEffect, useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import type { WizardStepProps } from '../../components/Wizard';
import type { UpdateESPFirmwareState, ESPFirmwareOption } from './wizard';
import { ESP_FIRMWARE_MANIFESTS } from './wizard';
import { fetchManifestFirmwareInfo } from '../../lib/esp-firmware-download';
import Modal from '../../components/Modal';

export default function FileSelectStep({ context }: WizardStepProps<UpdateESPFirmwareState>) {
  const { selectedFirmware } = context.state;
  const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);
  const [activeChangelogManifest, setActiveChangelogManifest] = useState<string | null>(null);
  const [manifestInfo, setManifestInfo] = useState<Record<string, any> | null>(null);
  const [isLoadingManifestInfo, setIsLoadingManifestInfo] = useState(false);

  // Fetch manifest info when component mounts
  useEffect(() => {
    if (!manifestInfo && !isLoadingManifestInfo) {
      setIsLoadingManifestInfo(true);

      // Fetch info for all manifests
      const fetchPromises = Object.entries(ESP_FIRMWARE_MANIFESTS).map(([id, manifest]) =>
        fetchManifestFirmwareInfo(manifest.manifestUrl, manifest.changelogUrl)
          .then(info => ({ id, info }))
          .catch(error => {
            console.error(`Failed to fetch manifest info for ${id}:`, error);
            return { id, info: null };
          })
      );

      Promise.all(fetchPromises)
        .then(results => {
          const manifestInfoRecord: Record<string, any> = {};
          results.forEach(({ id, info }) => {
            if (info) {
              manifestInfoRecord[id] = info;
            }
          });

          setManifestInfo(manifestInfoRecord);
          setIsLoadingManifestInfo(false);
        })
        .catch(error => {
          console.error('Failed to fetch manifest info:', error);
          setIsLoadingManifestInfo(false);
        });
    }
  }, [manifestInfo, isLoadingManifestInfo]);

  const handleOptionChange = useCallback((option: ESPFirmwareOption) => {
    // When selecting a manifest option, store the actual version, label, and wifi flag
    if (option.type === "manifest" && manifestInfo?.[option.manifestId]) {
      const manifest = ESP_FIRMWARE_MANIFESTS[option.manifestId];
      option.version = manifestInfo[option.manifestId].version;
      option.label = manifest.label;
      option.wifi = manifest.wifi;
    }
    context.setState(prev => ({ ...prev, selectedFirmware: option }));
  }, [context, manifestInfo]);

  const isSelected = useCallback((option: ESPFirmwareOption) => {
    if (selectedFirmware?.type !== option.type) return false;
    if (option.type === "manifest") {
      return selectedFirmware.manifestId === option.manifestId;
    }
    return true;
  }, [selectedFirmware]);

  const openChangelogModal = useCallback((e: React.MouseEvent, manifestId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveChangelogManifest(manifestId);
    setIsChangelogModalOpen(true);
  }, []);

  const closeChangelogModal = useCallback(() => {
    setIsChangelogModalOpen(false);
    setActiveChangelogManifest(null);
  }, []);

  const firmwareOptions: Array<{ value: ESPFirmwareOption; label: string; description: string; experimental?: boolean }> =
    Object.entries(ESP_FIRMWARE_MANIFESTS).map(([id, manifest]) => ({
      value: { type: "manifest", manifestId: id },
      label: manifest.label,
      description: manifest.description,
      experimental: manifest.experimental,
    }));

  return (
    <div className="py-8">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Choose which firmware package to install
      </h3>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Select the firmware package you want to install on your ZWA-2.
      </p>

      <div className="space-y-4">
        {firmwareOptions.map((option, index) => {
          const manifestId = option.value.manifestId;
          const manifestData = manifestInfo?.[manifestId];
          const isLoading = isLoadingManifestInfo && !manifestData;

          return (
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
                  {option.experimental && (
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                      Experimental
                    </span>
                  )}
                  {isLoading && (
                    <span className="text-gray-500 dark:text-gray-400">
                      · Loading...
                    </span>
                  )}
                  {manifestData && (
                    <>
                      <span className="text-gray-500 dark:text-gray-400">
                        · {manifestData.version} ·
                      </span>
                      <button
                        onClick={(e) => openChangelogModal(e, manifestId)}
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
          );
        })}
      </div>

      {/* Changelog Modal */}
      <Modal
        isOpen={isChangelogModalOpen}
        onClose={closeChangelogModal}
        title={`Changelog · ${activeChangelogManifest && manifestInfo?.[activeChangelogManifest]?.version || ''}`}
        content={
          <div className="max-h-96 overflow-y-auto">
            <div className="whitespace-pre-wrap text-sm font-mono">
              {activeChangelogManifest && manifestInfo?.[activeChangelogManifest]?.changelog || 'No changelog available.'}
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
