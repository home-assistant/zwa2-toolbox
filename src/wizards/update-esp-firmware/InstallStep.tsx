import type { WizardStepProps } from '../../components/Wizard';
import type { UpdateESPFirmwareState } from './wizard';
import { flashESPFirmware } from './wizard';
import CircularProgress from '../../components/CircularProgress';
import { LinkIcon, LinkSlashIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import Alert from '../../components/Alert';

export default function InstallStep({ context }: WizardStepProps<UpdateESPFirmwareState>) {
  const {
    isInstalling,
    progress,
    installResult,
    downloadedFirmwareName,
    isDownloading,
    isEnteringBootloader,
    currentSubStep,
    selectedFirmware,
    latestESPFirmwareInfo,
    bootloaderEntryFailed,
  } = context.state;

  const [showBootloaderHint, setShowBootloaderHint] = useState(bootloaderEntryFailed);
  const prevEspSerialPort = useRef<SerialPort | null>(null);

  // Update showBootloaderHint when bootloaderEntryFailed changes
  useEffect(() => {
    if (bootloaderEntryFailed) {
      setShowBootloaderHint(true);
    }
  }, [bootloaderEntryFailed]);

  const handleESP32Connect = async () => {
    const success = await context.requestESP32SerialPort();
    if (!success) {
      setShowBootloaderHint(true);
    } else {
      // Clear the bootloader entry failed flag and hint on successful connection
      setShowBootloaderHint(false);
      context.setState(prev => ({
        ...prev,
        currentSubStep: 2,
        isInstalling: true,
        bootloaderEntryFailed: false,
      }));
    }
  };

  // Continue with the actual firmware installation when espSerialPort becomes non-null and currentSubStep === 2
  useEffect(() => {
    const currentEspSerialPort = context.connectionState.status === 'connected' ? context.connectionState.port : null;
    // Only trigger when espSerialPort transitions from null to non-null and currentSubStep === 2
    if (!prevEspSerialPort.current && currentEspSerialPort && context.connectionState.status === 'connected' && context.connectionState.type === "esp32" && context.state.currentSubStep === 2) {
      (async () => {
        try {
          await flashESPFirmware(context);
        } catch (error) {
          console.error("Failed to flash ESP firmware:", error);
        } finally {
          context.goToStep("Summary");
        }
      })();
    }
    prevEspSerialPort.current = currentEspSerialPort;
  }, [context.connectionState, context.state.currentSubStep, context]);

  const handleRetry = async () => {
    // setShowBootloaderHint(false);
    // Don't clear bootloaderEntryFailed flag here - it should remain true until successful connection
    await handleESP32Connect();
  };

  if (installResult !== null) {
    // Show completion state, but let the Summary step handle the actual result display
    return (
      <div className="text-center py-8">
        <div className="text-gray-600 dark:text-gray-300">
          <p>Installation process completed. Click "Next" to see the results.</p>
        </div>
      </div>
    );
  }

  // Show indeterminate spinner if downloading
  if (isDownloading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Download ESP Firmware
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Downloading the latest ESP bridge firmware...
        </p>
      </div>
    );
  }

  // Show indeterminate spinner when entering bootloader
  if (isEnteringBootloader) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Enter Bootloader
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Putting ESP into bootloader mode...
        </p>
      </div>
    );
  }

  // Show ESP32 connection UI when waiting for connection (currentSubStep 1)
  const connectedToESP32 = context.connectionState.status === 'connected' && context.connectionState.type === 'esp32';
  if (currentSubStep === 1 && !connectedToESP32) {

    return (
      <div className="flex flex-col items-center py-8 space-y-6">
        <div className={`${connectedToESP32 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>
          {connectedToESP32 ? (
            <LinkIcon className="w-16 h-16" />
          ) : (
            <LinkSlashIcon className="w-16 h-16" />
          )}
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {connectedToESP32 ? 'ESP32 Connected' : 'Connect to ESP32 Bootloader'}
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            {connectedToESP32
              ? 'Successfully connected to the ESP32 bootloader.'
              : bootloaderEntryFailed
                ? <>Could not enter the bootloader automatically.<br />You can also follow the instructions below to enter bootloader mode manually, then try again.</>
                : <>Bootloader mode activated. Now select the ESP32 serial port to continue with the firmware update.</>
            }
          </p>
          <p className="text-gray-600 dark:text-gray-300">
			The device is usually called "ESP32-S3" or "USB JTAG/serial debug unit".
          </p>
        </div>

        {!connectedToESP32 && !showBootloaderHint && (
          <button
            onClick={handleESP32Connect}
            disabled={context.connectionState.status === 'connecting'}
            className="rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-purple-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-purple-500 dark:hover:bg-purple-400"
          >
            {context.connectionState.status === 'connecting' ? 'Connecting...' : 'Select ESP32 Port'}
          </button>
        )}

        {!connectedToESP32 && showBootloaderHint && (
          <div className="flex flex-col items-center space-y-4 max-w-md">
            <button
              onClick={handleRetry}
              disabled={context.connectionState.status === 'connecting'}
              className="rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-purple-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-purple-500 dark:hover:bg-purple-400"
            >
              {context.connectionState.status === 'connecting' ? 'Connecting...' : bootloaderEntryFailed ? 'Select ESP32 Port' : 'Try Again'}
            </button>
            <Alert title={bootloaderEntryFailed ? "To trigger the bootloader manually" : "Can't find the ESP32 device?"}>
              {!bootloaderEntryFailed && <span className="block mb-2">You can also trigger the bootloader mode manually:</span>}
              <ol className="list-decimal pl-6 my-2 space-y-1">
                <li>Unplug the ZWA-2 and open it up</li>
                <li>On the top right of the PCB, under "ESP GPIO pins", bridge GPIO0 and GND with something conductive</li>
                <li>Plug the ZWA-2 back in</li>
                <li>Retry connecting</li>
              </ol>
              <span className="block mt-2">Don't forget to remove the bridge after flashing!</span>
            </Alert>
          </div>
        )}

        {connectedToESP32 && context.onDisconnect && (
          <button
            onClick={() => {
              context.onDisconnect?.();
              setShowBootloaderHint(false);
              // Clear the bootloader entry failed flag when disconnecting
              context.setState(prev => ({
                ...prev,
                bootloaderEntryFailed: false,
              }));
            }}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
          >
            Connect different device
          </button>
        )}
      </div>
    );
  }

  // Show circular progress during installation
  if (isInstalling && currentSubStep === 2) {
    return (
      <div className="text-center py-8">
        <CircularProgress progress={progress} className="mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Update ESP Firmware
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Installing {selectedFirmware?.type === "latest-esp" && latestESPFirmwareInfo
            ? `ESP firmware ${latestESPFirmwareInfo.version}`
            : downloadedFirmwareName
          }...
        </p>
      </div>
    );
  }

  // Fallback state
  return (
    <div className="text-center py-8">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Update ESP Firmware
      </h3>
      <p className="text-gray-600 dark:text-gray-300">
        Ready to update ESP firmware...
      </p>
    </div>
  );
}
