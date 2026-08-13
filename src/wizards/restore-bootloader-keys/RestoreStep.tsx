import { useCallback, useEffect, useRef } from 'react';
import { LinkIcon, LinkSlashIcon } from '@heroicons/react/24/outline';
import Alert from '../../components/Alert';
import CircularProgress from '../../components/CircularProgress';
import ManualBootloaderInstructions from '../../components/ManualBootloaderInstructions';
import Spinner from '../../components/Spinner';
import type { RestoreBootloaderKeysStepProps } from './wizard';
import { enterBootloaderForRepair, flashDebuggerFirmware, restoreKeys } from './wizard';

const BUSY_MESSAGES: Record<string, string> = {
  'entering-bootloader': 'Preparing your ZWA-2…',
  probing: 'Reading the keys…',
  writing: 'Restoring the keys…',
  verifying: 'Checking the result…',
};

export default function RestoreStep({ context }: RestoreBootloaderKeysStepProps) {
  const { restoreState } = context.state;
  const serialPort =
    context.connectionState.status === 'connected' ? context.connectionState.port : null;
  const connectionType =
    context.connectionState.status === 'connected' ? context.connectionState.type : null;
  const prevSerialPort = useRef<SerialPort | null>(null);

  // The repair takes three ports in a row. The current phase decides what to do
  // with the one just selected.
  useEffect(() => {
    if (!prevSerialPort.current && serialPort) {
      if (restoreState.status === 'waiting-for-zwa2' && connectionType) {
        enterBootloaderForRepair(context, serialPort, connectionType);
      } else if (restoreState.status === 'waiting-for-esp32') {
        flashDebuggerFirmware(context, serialPort);
      } else if (restoreState.status === 'waiting-for-console') {
        restoreKeys(context, serialPort);
      }
    }
    prevSerialPort.current = serialPort;
  }, [serialPort, connectionType, context, restoreState.status]);

  useEffect(() => {
    if (restoreState.status !== 'waiting-for-power-cycle') return;

    if (!serialPort) {
      context.setState((prev) => ({
        ...prev,
        restoreState: { status: 'waiting-for-console' },
      }));
      return;
    }

    const waitForPowerCycle = async () => {
      const { awaitESPRestart } = await import('../../lib/esp-utils');
      await awaitESPRestart(serialPort);
      await context.onDisconnect?.();
      context.setState((prev) => ({
        ...prev,
        restoreState: { status: 'waiting-for-console' },
      }));
    };

    waitForPowerCycle();
  }, [context, restoreState.status, serialPort]);

  const retry = useCallback(async () => {
    if (restoreState.status !== 'error') return;
    const port =
      context.connectionState.status === 'connected' ? context.connectionState.port : null;

    // The USB link survives an SWD or flash failure, so the same port can be
    // used again. Only a device that went away needs picking again.
    if (port) {
      if (restoreState.retryFrom === 'probe') {
        await restoreKeys(context, port);
      } else {
        await flashDebuggerFirmware(context, port);
      }
      return;
    }

    context.setState((prev) => ({
      ...prev,
      restoreState:
        restoreState.retryFrom === 'probe'
          ? { status: 'waiting-for-console' }
          : { status: 'waiting-for-esp32', bootloaderEntryFailed: false },
    }));
  }, [context, restoreState]);

  const selectPort = useCallback(async () => {
    await context.requestESP32SerialPort();
  }, [context]);

  // The ZWA-2 may come back running the bridge firmware or, after an earlier
  // attempt, the repair tool. The combined filters cover both.
  const selectZWA2Port = useCallback(async () => {
    if (context.requestCombinedSerialPort) {
      await context.requestCombinedSerialPort();
    } else {
      await context.requestZWA2SerialPort();
    }
  }, [context]);

  if (restoreState.status === 'waiting-for-zwa2') {
    return (
      <div className="flex flex-col items-center py-8 space-y-6">
        <div className="text-gray-400 dark:text-gray-600">
          <LinkSlashIcon className="w-16 h-16" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-primary mb-2">Select the ZWA-2 again</h3>
          <p className="text-gray-600 dark:text-gray-300">
            Select the ZWA-2 to start the repair.
          </p>
        </div>
        <button
          onClick={selectZWA2Port}
          disabled={context.connectionState.status === 'connecting'}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {context.connectionState.status === 'connecting' ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    );
  }

  if (restoreState.status === 'flashing-debugger') {
    return (
      <div className="text-center py-8">
        <CircularProgress progress={restoreState.progress} className="mb-4" />
        <h3 className="text-lg font-medium text-primary mb-2">
          Installing the repair tool&hellip;
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Do not unplug the ZWA-2.
        </p>
      </div>
    );
  }

  if (restoreState.status === 'waiting-for-power-cycle') {
    return (
      <div className="text-center py-8">
        <Spinner className="mx-auto mb-4" />
        <h3 className="text-lg font-medium text-primary mb-2">
          Unplug the ZWA-2 and plug it back in
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          The repair tool is installed. It only starts up properly after a power cycle.
        </p>
        <p className="text-gray-600 dark:text-gray-300">Leave both wires connected.</p>
      </div>
    );
  }

  if (restoreState.status === 'waiting-for-esp32' || restoreState.status === 'waiting-for-console') {
    const forConsole = restoreState.status === 'waiting-for-console';
    const connectedToESP32 =
      context.connectionState.status === 'connected' &&
      context.connectionState.type === 'esp32';
    return (
      <div className="flex flex-col items-center py-8 space-y-6">
        <div className={connectedToESP32 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}>
          {connectedToESP32 ? <LinkIcon className="w-16 h-16" /> : <LinkSlashIcon className="w-16 h-16" />}
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-primary mb-2">
            {forConsole
              ? 'Select the ZWA-2 again'
              : connectedToESP32
                ? 'ESP32 Connected'
                : 'Connect to ESP32 Bootloader'}
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            {forConsole ? (
              'Select the ZWA-2 once more to run the repair.'
            ) : connectedToESP32 ? (
              'Successfully connected to the ESP32 bootloader.'
            ) : restoreState.status === 'waiting-for-esp32' && restoreState.bootloaderEntryFailed ? (
              <>Could not enter the bootloader automatically.<br />You can follow the instructions below to enter bootloader mode manually, then try again.</>
            ) : (
              'Bootloader mode activated. Now select the ESP32 serial port to install the repair tool.'
            )}
          </p>
          <p className="text-gray-600 dark:text-gray-300">
            {forConsole
              ? 'The device is called "USB JTAG/serial debug unit".'
              : 'The device is usually called "ESP32-S3" or "USB JTAG/serial debug unit".'}
          </p>
        </div>

        <button
          onClick={selectPort}
          disabled={context.connectionState.status === 'connecting'}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {context.connectionState.status === 'connecting' ? 'Connecting...' : 'Select port'}
        </button>

        {!forConsole && restoreState.bootloaderEntryFailed && (
          <ManualBootloaderInstructions deviceName="ZWA-2" />
        )}
      </div>
    );
  }

  if (restoreState.status === 'error') {
    return (
      <div className="py-8 space-y-6">
        <Alert title="The repair did not finish" severity="error">
          <p>{restoreState.errorMessage}</p>
        </Alert>
        <div className="flex justify-center">
          <button
            onClick={retry}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            Try again
          </button>
        </div>
        <p className="text-center text-secondary">
          The ZWA-2 is still running the repair tool. Skip the repair to put its normal
          firmware back before unplugging it.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <Spinner className="mx-auto mb-4" />
      <h3 className="text-lg font-medium text-primary mb-2">
        {BUSY_MESSAGES[restoreState.status] ?? 'Working…'}
      </h3>
      <p className="text-gray-600 dark:text-gray-300">Do not unplug the ZWA-2.</p>
    </div>
  );
}
