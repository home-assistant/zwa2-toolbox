import { LinkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { WizardStepProps } from '../Wizard';
import Alert from '../Alert';
import Button from '../Button';

interface ConnectStepProps<T> extends WizardStepProps<T> {
  /** Replaces the default body of the "Can't find your ZWA-2?" alert */
  hint?: ReactNode;
  /** Rendered below the hint, for an action that continues without a connection */
  hintAction?: ReactNode;
}

export default function ConnectStep<T>({ context, hint, hintAction }: ConnectStepProps<T>) {
  const isConnected = context.connectionState.status === 'connected';
  const serialPort = context.connectionState.status === 'connected' ? context.connectionState.port : null;
  const [showConnectionHint, setShowConnectionHint] = useState(false);

  const prevSerialPort = useRef<SerialPort | null>(serialPort);

  useEffect(() => {
    if (!prevSerialPort.current && serialPort) {
      context.autoNavigateToNext();
    }
    prevSerialPort.current = serialPort;
  }, [serialPort, context])

  const handleConnect = async () => {
    const success = await context.requestZWA2SerialPort();
    setShowConnectionHint(!success);
  };

  const connectButton = (label: string) => (
    <Button onClick={handleConnect} disabled={context.connectionState.status === 'connecting'}>
      {context.connectionState.status === 'connecting' ? 'Connecting...' : label}
    </Button>
  );

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
      {!isConnected && !showConnectionHint && connectButton('Connect')}
      {!isConnected && showConnectionHint && (
        <div className="flex flex-col items-center space-y-4 max-w-md">
          {connectButton('Try Again')}
          <Alert title="Can't find your ZWA-2?">
            {hint ?? 'Make sure it is running the default USB bridge firmware on the ESP. Otherwise the ZWA-2 toolbox cannot communicate with the Z-Wave chip.'}
          </Alert>
          {hintAction}
        </div>
      )}
      {isConnected && context.onDisconnect && (
        <Button
          variant="secondary"
          onClick={() => {
            context.onDisconnect?.();
            setShowConnectionHint(false);
            context.requestZWA2SerialPort();
          }}
        >
          Connect different device
        </Button>
      )}
    </div>
  );
}
