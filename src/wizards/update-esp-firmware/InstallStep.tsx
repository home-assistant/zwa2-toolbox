import type { WizardStepProps } from '../../components/Wizard';
import type { UpdateESPFirmwareState } from './wizard';
import { flashESPFirmware } from './wizard';
import CircularProgress from '../../components/CircularProgress';
import { LinkIcon, LinkSlashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';

export default function InstallStep({ context }: WizardStepProps<UpdateESPFirmwareState>) {
  const {
    isInstalling,
    progress,
    installResult,
    downloadedFirmwareName,
    isDownloading,
    isEnteringBootloader,
    currentSubStep,
  } = context.state;

  const [showBootloaderHint, setShowBootloaderHint] = useState(false);
  const prevEspSerialPort = useRef<SerialPort | null>(null);

  const handleESP32Connect = async () => {
    const success = await context.requestESP32SerialPort();
    if (!success) {
      setShowBootloaderHint(true);
    } else {
      // Only update state to move to substep 2, do not set espSerialPort here
      context.setState(prev => ({
        ...prev,
        currentSubStep: 2,
        isInstalling: true,
      }));
    }
  };

  // Continue with the actual firmware installation when espSerialPort becomes non-null and currentSubStep === 2
  useEffect(() => {
	console.debug("[InstallStep] useEffect checking espSerialPort and currentSubStep", {
	  prevEspSerialPort: prevEspSerialPort.current,
	  currentEspSerialPort: context.serialPort,
	  currentSubStep: context.state.currentSubStep
	});
    // Only trigger when espSerialPort transitions from null to non-null and currentSubStep === 2
    if (!prevEspSerialPort.current && context.serialPort && context.connectionType === "esp32" && context.state.currentSubStep === 2) {
      (async () => {
        try {
          await flashESPFirmware(context);
          console.debug("[InstallStep] flashESPFirmware completed, going to Summary");
          context.goToStep("Summary");
        } catch (error) {
          console.error("[InstallStep] Failed to flash ESP firmware:", error);
          context.goToStep("Summary");
        }
      })();
    }
    prevEspSerialPort.current = context.serialPort;
  }, [context.serialPort, context.state.currentSubStep, context]);

  const handleRetry = async () => {
    console.debug("[InstallStep] handleRetry called");
    setShowBootloaderHint(false);
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
  const connectedToESP32 = !!context.serialPort && context.connectionType === 'esp32';
  if (currentSubStep === 1 && !connectedToESP32) {

    return (
      <div className="text-center py-8">
        <div className={`mb-4 ${connectedToESP32 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>
          {connectedToESP32 ? (
            <LinkIcon className="w-16 h-16 mx-auto" />
          ) : (
            <LinkSlashIcon className="w-16 h-16 mx-auto" />
          )}
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {connectedToESP32 ? 'ESP32 Connected' : 'Connect to ESP32 Bootloader'}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {connectedToESP32
            ? 'Successfully connected to the ESP32 bootloader.'
            : 'Bootloader mode activated. Now select the ESP32 serial port to continue with the firmware update.'
          }
        </p>

        {!connectedToESP32 && !showBootloaderHint && (
          <button
            onClick={handleESP32Connect}
            disabled={context.isConnecting}
            className="rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-purple-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-purple-500 dark:hover:bg-purple-400"
          >
            {context.isConnecting ? 'Connecting...' : 'Select ESP32 Port'}
          </button>
        )}

        {!connectedToESP32 && showBootloaderHint && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 mr-3 flex-shrink-0" />
                <div className="text-left">
                  <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                    Connection Failed
                  </h4>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Make sure your device is powered on with GPIO0 and GND pins bridged to enter bootloader mode, then try again.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleRetry}
              disabled={context.isConnecting}
              className="rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-purple-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-purple-500 dark:hover:bg-purple-400"
            >
              {context.isConnecting ? 'Connecting...' : 'Try Again'}
            </button>
          </div>
        )}

        {connectedToESP32 && context.onDisconnect && (
          <button
            onClick={() => {
              context.onDisconnect?.();
              setShowBootloaderHint(false);
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
          Installing {downloadedFirmwareName}...
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
