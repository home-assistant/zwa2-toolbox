import { CheckCircleIcon } from '@heroicons/react/24/outline';
import Button from '../../components/Button';
import RadioCard from '../../components/RadioCard';
import StatusPanel from '../../components/StatusPanel';
import { ESP_FIRMWARE_MANIFESTS } from '../../lib/esp-firmware-download';
import { useAwaitPowerCycle } from '../../hooks/useAwaitPowerCycle';
import RepairFailedAlert from './RepairFailedAlert';
import type { RestoreBootloaderKeysStepProps } from './wizard';
import { connectedPort } from './wizard';

export default function ReinstallStep({ context }: RestoreBootloaderKeysStepProps) {
  const { restoreState, reinstallState, selectedManifestId } = context.state;
  const repairFailed = restoreState.status === 'error';
  const serialPort = connectedPort(context);
  const connecting = context.connectionState.status === 'connecting';

  useAwaitPowerCycle(
    serialPort,
    reinstallState.status === 'waiting-for-power-cycle',
    async () => {
      await context.onDisconnect?.();
      context.setState((prev) => ({ ...prev, reinstallState: { status: 'success' } }));
      context.goToStep('Summary');
    },
  );

  if (reinstallState.status === 'downloading') {
    return <StatusPanel title="Downloading firmware…" />;
  }

  if (reinstallState.status === 'installing') {
    return (
      <StatusPanel progress={reinstallState.progress} title="Installing firmware…">
        <p>Do not unplug the ZWA-2.</p>
      </StatusPanel>
    );
  }

  if (reinstallState.status === 'waiting-for-power-cycle') {
    return (
      <StatusPanel title="Firmware installed successfully">
        <p>Please power cycle your ZWA-2 to activate the new firmware.</p>
      </StatusPanel>
    );
  }

  return (
    <div className="py-8">
      {repairFailed && (
        <div className="mb-6">
          <RepairFailedAlert message={restoreState.errorMessage}>
            The ZWA-2 is still running the repair tool. Put its normal firmware back before
            unplugging it.
          </RepairFailedAlert>
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

      {!serialPort && (
        <div className="mb-6 flex flex-col items-center gap-3">
          <p className="text-gray-600 dark:text-gray-300">
            Select the ZWA-2 again to continue.
          </p>
          <Button onClick={() => context.requestESP32SerialPort()} disabled={connecting}>
            {connecting ? 'Connecting...' : 'Select port'}
          </Button>
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
