import { LinkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import Alert from '../../components/Alert';
import type { RestoreBootloaderKeysStepProps } from './wizard';

/**
 * Same layout as the shared connect step. The difference is the escape hatch:
 * a ZWA-2 whose ESP runs the repair tool does not appear in the picker at all,
 * so the user can carry on without connecting and skip the check.
 */
export default function ConnectStep({ context }: RestoreBootloaderKeysStepProps) {
  const isConnected = context.connectionState.status === 'connected';
  const serialPort = context.connectionState.status === 'connected' ? context.connectionState.port : null;
  const [showConnectionHint, setShowConnectionHint] = useState(false);

  const prevSerialPort = useRef<SerialPort | null>(serialPort);

  useEffect(() => {
    if (!prevSerialPort.current && serialPort) {
      context.autoNavigateToNext();
    }
    prevSerialPort.current = serialPort;
  }, [serialPort, context]);

  const handleConnect = async () => {
    const success = await context.requestZWA2SerialPort();
    setShowConnectionHint(!success);
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
            : 'Plug your ZWA-2 into this computer, then click Connect.'
          }
        </p>
      </div>
      {!isConnected && !showConnectionHint && (
        <button
          onClick={handleConnect}
          disabled={context.connectionState.status === 'connecting'}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {context.connectionState.status === 'connecting' ? 'Connecting...' : 'Connect'}
        </button>
      )}
      {!isConnected && showConnectionHint && (
        <div className="flex flex-col items-center space-y-4 max-w-md">
          <button
            onClick={handleConnect}
            disabled={context.connectionState.status === 'connecting'}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {context.connectionState.status === 'connecting' ? 'Connecting...' : 'Try Again'}
          </button>
          <Alert title="Can't find your ZWA-2?">
            <p>
              It does not show up here unless the ESP runs the default USB bridge firmware.
            </p>
            <p className="mt-2">
              To skip the check and go straight to the repair, click the button below.
            </p>
          </Alert>
          <button
            onClick={() => context.goToStep('Prepare the ZWA-2 for repair')}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-primary shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
          >
            Repair without checking
          </button>
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
