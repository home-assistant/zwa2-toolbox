import { LinkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef } from 'react';
import type { WizardStepProps } from '../../components/Wizard';
import type { UpdateESPFirmwareState } from './wizard';

/**
 * Connect step for ESP firmware wizard that follows the standard ConnectStep pattern
 */
export default function ESPConnectStep({ context }: WizardStepProps<UpdateESPFirmwareState>) {
  const isConnected = context.connectionState.status === 'connected';
  const serialPort = context.connectionState.status === 'connected' ? context.connectionState.port : null;

  // Track previous serialPort value
  const prevSerialPort = useRef<SerialPort | null>(serialPort);

  // Custom request function that uses combined filters
  const requestCombinedSerialPort = async (): Promise<void> => {
    if (context.requestCombinedSerialPort) {
      await context.requestCombinedSerialPort();
    } else {
      // Fallback to ZWA-2 connection if combined request is not available
      await context.requestZWA2SerialPort();
    }
  };

  useEffect(() => {
    // Only trigger when serialPort transitions from null to non-null
    if (!prevSerialPort.current && serialPort) {
      context.autoNavigateToNext();
    }
    prevSerialPort.current = serialPort;
  }, [serialPort, context]);

  return (
    <div className="text-center py-8">
      <div className={`mb-4 ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>
        <LinkIcon className="w-16 h-16 mx-auto" />
      </div>
      <h3 className="text-lg font-medium text-primary mb-2">
        {isConnected ? 'ZWA-2 Connected' : 'Connect to ZWA-2'}
      </h3>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        {isConnected
          ? 'Successfully connected to your ZWA-2.'
          : 'First, we need to establish a connection to your ZWA-2. Depending on the ESP firmware, the device will be called "ZWA-2", "ESP32-S3" or "USB JTAG/serial debug unit".'
        }
      </p>
      {!isConnected && (
        <button
          onClick={requestCombinedSerialPort}
          disabled={context.connectionState.status === 'connecting'}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {context.connectionState.status === 'connecting' ? 'Connecting...' : 'Connect'}
        </button>
      )}
      {isConnected && context.onDisconnect && (
        <button
          onClick={() => {
            context.onDisconnect?.();
            requestCombinedSerialPort();
          }}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-primary shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
        >
          Connect different device
        </button>
      )}
    </div>
  );
}
