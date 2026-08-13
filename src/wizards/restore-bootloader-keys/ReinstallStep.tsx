import { useEffect } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import Alert from '../../components/Alert';
import CircularProgress from '../../components/CircularProgress';
import RadioCard from '../../components/RadioCard';
import Spinner from '../../components/Spinner';
import type { RestoreBootloaderKeysStepProps } from './wizard';
import { ESP_FIRMWARE_MANIFESTS } from '../update-esp-firmware/wizard';

export default function ReinstallStep({ context }: RestoreBootloaderKeysStepProps) {
  const { restoreState, reinstallState, selectedManifestId } = context.state;
  const repairFailed = restoreState.status === 'error';
  const isConnected = context.connectionState.status === 'connected';

  useEffect(() => {
    if (reinstallState.status !== 'waiting-for-power-cycle') return;

    const serialPort =
      context.connectionState.status === 'connected' ? context.connectionState.port : null;

    const finish = async () => {
      if (serialPort) {
        const { awaitESPRestart } = await import('../../lib/esp-utils');
        await awaitESPRestart(serialPort);
        await context.onDisconnect?.();
      }
      context.setState((prev) => ({ ...prev, reinstallState: { status: 'success' } }));
      context.goToStep('Summary');
    };

    finish();
  }, [context, reinstallState.status]);

  if (reinstallState.status === 'downloading') {
    return (
      <div className="text-center py-8">
        <Spinner className="mx-auto mb-4" />
        <h3 className="text-lg font-medium text-primary mb-2">Downloading firmware&hellip;</h3>
      </div>
    );
  }

  if (reinstallState.status === 'installing') {
    return (
      <div className="text-center py-8">
        <CircularProgress progress={reinstallState.progress} className="mb-4" />
        <h3 className="text-lg font-medium text-primary mb-2">Installing firmware&hellip;</h3>
        <p className="text-gray-600 dark:text-gray-300">Do not unplug the ZWA-2.</p>
      </div>
    );
  }

  if (reinstallState.status === 'waiting-for-power-cycle') {
    return (
      <div className="text-center py-8">
        <Spinner className="mx-auto mb-4" />
        <h3 className="text-lg font-medium text-primary mb-2">
          Firmware installed successfully
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Please power cycle your ZWA-2 to activate the new firmware.
        </p>
      </div>
    );
  }

  return (
    <div className="py-8">
      {repairFailed && (
        <div className="mb-6">
          <Alert title="The repair did not finish" severity="error">
            <p>{restoreState.errorMessage}</p>
            <p className="mt-2">
              The ZWA-2 is still running the repair tool. Put its normal firmware back
              before unplugging it.
            </p>
          </Alert>
        </div>
      )}

      <h3 className="flex items-center gap-2 text-lg font-medium text-primary mb-2">
        {!repairFailed && (
          <CheckCircleIcon className="w-6 h-6 shrink-0 text-green-600 dark:text-green-400" />
        )}
        {repairFailed ? "Restore the ZWA-2's firmware" : 'The repair was successful'}
      </h3>
      <p className="text-secondary mb-6">
        Now put the ZWA-2's normal firmware back. Pick the one you were using before.
      </p>

      {!isConnected && (
        <div className="mb-6 flex flex-col items-center gap-3">
          <p className="text-gray-600 dark:text-gray-300">
            Select the ZWA-2 again to continue.
          </p>
          <button
            onClick={() => context.requestESP32SerialPort()}
            disabled={context.connectionState.status === 'connecting'}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {context.connectionState.status === 'connecting' ? 'Connecting...' : 'Select port'}
          </button>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(ESP_FIRMWARE_MANIFESTS).map(([id, manifest]) => (
          <RadioCard
            key={id}
            name="espFirmwareOption"
            selected={selectedManifestId === id}
            onSelect={() =>
              context.setState((prev) => ({ ...prev, selectedManifestId: id }))
            }
            label={manifest.label}
            description={manifest.description}
            experimental={manifest.experimental}
          />
        ))}
      </div>
    </div>
  );
}
