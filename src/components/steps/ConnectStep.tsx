import { LinkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import type { WizardStepProps } from '../Wizard';
import Alert from '../Alert';

export default function ConnectStep<T>({ context }: WizardStepProps<T>) {
  const isConnected = context.connectionState.status === 'connected';
  const serialPort = context.connectionState.status === 'connected' ? context.connectionState.port : null;
  const [showConnectionHint, setShowConnectionHint] = useState(false);

  // Track previous serialPort value
  const prevSerialPort = useRef<SerialPort | null>(serialPort);

  useEffect(() => {
    // Only trigger when serialPort transitions from null to non-null
    if (!prevSerialPort.current && serialPort) {
      context.autoNavigateToNext();
    }
    prevSerialPort.current = serialPort;
  }, [serialPort, context])

  const handleConnect = async () => {
    const success = await context.requestZWA2SerialPort();
    if (!success) {
      setShowConnectionHint(true);
    } else {
      setShowConnectionHint(false);
    }
  };

  return (
    <div className="flex flex-col items-center py-8 space-y-6">
      <div className={`${isConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>
        <LinkIcon className="w-16 h-16" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-medium text-primary mb-2">
          {isConnected ? 'ZWA-2 Connected' : 'Connect to ZWA-2'}
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          {isConnected
            ? 'Successfully connected to your ZWA-2.'
            : 'First, we need to establish a connection to your ZWA-2.'
          }
        </p>
      </div>
      {!isConnected && !showConnectionHint && (
        <button
          onClick={handleConnect}
          disabled={context.connectionState.status === 'connecting'}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {context.connectionState.status === 'connecting' ? 'Connecting...' : 'Connect'}
        </button>
      )}
      {!isConnected && showConnectionHint && (
        <div className="flex flex-col items-center space-y-4 max-w-md">
          <button
            onClick={handleConnect}
            disabled={context.connectionState.status === 'connecting'}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {context.connectionState.status === 'connecting' ? 'Connecting...' : 'Try Again'}
          </button>
          <Alert title="Can't find your ZWA-2?">
            Make sure it is running the default USB bridge firmware on the ESP. Otherwise the ZWA-2 toolbox cannot communicate with the Z-Wave chip.
          </Alert>
        </div>
      )}
      {isConnected && context.onDisconnect && (
        <button
          onClick={() => {
            context.onDisconnect?.();
            setShowConnectionHint(false);
            context.requestZWA2SerialPort();
          }}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-primary shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
        >
          Connect different device
        </button>
      )}
    </div>
  );
}
