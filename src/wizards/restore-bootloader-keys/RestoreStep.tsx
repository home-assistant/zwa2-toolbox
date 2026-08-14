import { useCallback, useEffect, useRef } from 'react';
import Button from '../../components/Button';
import ConnectPrompt from '../../components/ConnectPrompt';
import ManualBootloaderInstructions from '../../components/ManualBootloaderInstructions';
import StatusPanel from '../../components/StatusPanel';
import { useAwaitPowerCycle } from '../../hooks/useAwaitPowerCycle';
import RepairFailedAlert from './RepairFailedAlert';
import type { RestoreBootloaderKeysStepProps, RestoreState } from './wizard';
import {
  connectedPort,
  enterBootloaderForRepair,
  flashDebuggerFirmware,
  restoreKeys,
} from './wizard';

const BUSY_MESSAGES: Partial<Record<RestoreState['status'], string>> = {
  'entering-bootloader': 'Preparing your ZWA-2…',
  probing: 'Reading the keys…',
  writing: 'Restoring the keys…',
  verifying: 'Checking the result…',
};

export default function RestoreStep({ context }: RestoreBootloaderKeysStepProps) {
  const { restoreState } = context.state;
  const serialPort = connectedPort(context);
  const connectionType =
    context.connectionState.status === 'connected' ? context.connectionState.type : null;
  const connecting = context.connectionState.status === 'connecting';
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

  useAwaitPowerCycle(
    serialPort,
    restoreState.status === 'waiting-for-power-cycle',
    async () => {
      await context.onDisconnect?.();
      context.setState((prev) => ({
        ...prev,
        restoreState: { status: 'waiting-for-console' },
      }));
    },
  );

  const retry = useCallback(async () => {
    if (restoreState.status !== 'error') return;
    const fromProbe = restoreState.retryFrom === 'probe';
    const port = connectedPort(context);

    // The USB link survives an SWD or flash failure, so the same port can be
    // used again. Only a device that went away needs picking again.
    if (port) {
      await (fromProbe ? restoreKeys(context, port) : flashDebuggerFirmware(context, port));
      return;
    }

    context.setState((prev) => ({
      ...prev,
      restoreState: fromProbe
        ? { status: 'waiting-for-console' }
        : { status: 'waiting-for-esp32', bootloaderEntryFailed: false },
    }));
  }, [context, restoreState]);

  const selectPortButton = (onClick: () => void, label: string) => (
    <Button onClick={onClick} disabled={connecting}>
      {connecting ? 'Connecting...' : label}
    </Button>
  );

  if (restoreState.status === 'waiting-for-zwa2') {
    // The ZWA-2 may come back running the bridge firmware, or the repair tool
    // from an earlier attempt. The combined filters cover both.
    return (
      <ConnectPrompt
        connected={false}
        title="Select the ZWA-2 again"
        description={<p>Select the ZWA-2 to start the repair.</p>}
      >
        {selectPortButton(() => context.requestCombinedSerialPort(), 'Connect')}
      </ConnectPrompt>
    );
  }

  if (restoreState.status === 'flashing-debugger') {
    return (
      <StatusPanel progress={restoreState.progress} title="Installing the repair tool…">
        <p>Do not unplug the ZWA-2.</p>
      </StatusPanel>
    );
  }

  if (restoreState.status === 'waiting-for-power-cycle') {
    return (
      <StatusPanel title="Unplug the ZWA-2 and plug it back in">
        <p>The repair tool is installed. It only starts up properly after a power cycle.</p>
        <p>Leave both wires connected.</p>
      </StatusPanel>
    );
  }

  if (restoreState.status === 'waiting-for-console') {
    return (
      <ConnectPrompt
        connected={false}
        title="Select the ZWA-2 again"
        description={
          <>
            <p>Select the ZWA-2 once more to run the repair.</p>
            <p>The device is called "USB JTAG/serial debug unit".</p>
          </>
        }
      >
        {selectPortButton(() => context.requestESP32SerialPort(), 'Select port')}
      </ConnectPrompt>
    );
  }

  if (restoreState.status === 'waiting-for-esp32') {
    const connectedToESP32 = connectionType === 'esp32';
    return (
      <ConnectPrompt
        connected={connectedToESP32}
        title={connectedToESP32 ? 'ESP32 Connected' : 'Connect to ESP32 Bootloader'}
        description={
          <>
            <p>
              {connectedToESP32
                ? 'Successfully connected to the ESP32 bootloader.'
                : restoreState.bootloaderEntryFailed
                  ? <>Could not enter the bootloader automatically.<br />You can follow the instructions below to enter bootloader mode manually, then try again.</>
                  : 'Bootloader mode activated. Now select the ESP32 serial port to install the repair tool.'}
            </p>
            <p>The device is usually called "ESP32-S3" or "USB JTAG/serial debug unit".</p>
          </>
        }
      >
        {selectPortButton(() => context.requestESP32SerialPort(), 'Select port')}
        {restoreState.bootloaderEntryFailed && <ManualBootloaderInstructions deviceName="ZWA-2" />}
      </ConnectPrompt>
    );
  }

  if (restoreState.status === 'error') {
    return (
      <div className="py-8 space-y-6">
        <RepairFailedAlert message={restoreState.errorMessage} />
        <div className="flex justify-center">
          <Button onClick={retry}>Try again</Button>
        </div>
        <p className="text-center text-secondary">
          The ZWA-2 is still running the repair tool. Skip the repair to put its normal
          firmware back before unplugging it.
        </p>
      </div>
    );
  }

  return (
    <StatusPanel title={BUSY_MESSAGES[restoreState.status] ?? 'Working…'}>
      <p>Do not unplug the ZWA-2.</p>
    </StatusPanel>
  );
}
