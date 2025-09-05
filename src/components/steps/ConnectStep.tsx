import { LinkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef } from 'react';
import type { WizardStepProps } from '../Wizard';

export default function ConnectStep<T>({ context }: WizardStepProps<T>) {
  const isConnected = context.connectionState.status === 'connected';
  const serialPort = context.connectionState.status === 'connected' ? context.connectionState.port : null;

  // Track previous serialPort value
  const prevSerialPort = useRef<SerialPort | null>(serialPort);

  useEffect(() => {
    // Only trigger when serialPort transitions from null to non-null
    if (!prevSerialPort.current && serialPort) {
      context.autoNavigateToNext();
    }
    prevSerialPort.current = serialPort;
  }, [serialPort, context])

  return (
    <div className="text-center py-8">
      <div className={`mb-4 ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>
        <LinkIcon className="w-16 h-16 mx-auto" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {isConnected ? 'ZWA-2 Connected' : 'Connect to ZWA-2'}
      </h3>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        {isConnected
          ? 'Successfully connected to your ZWA-2.'
          : 'First, we need to establish a connection to your ZWA-2.'
        }
      </p>
      {!isConnected && (
        <button
          onClick={context.requestZWA2SerialPort}
          disabled={context.connectionState.status === 'connecting'}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {context.connectionState.status === 'connecting' ? 'Connecting...' : 'Connect'}
        </button>
      )}
      {isConnected && context.onDisconnect && (
        <button
          onClick={() => {
            context.onDisconnect?.();
            context.requestZWA2SerialPort();
          }}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
        >
          Connect different device
        </button>
      )}
    </div>
  );
}
