import { CheckCircleIcon } from '@heroicons/react/24/outline';
import Alert from '../../components/Alert';
import RepairFailedAlert from './RepairFailedAlert';
import type { RestoreBootloaderKeysStepProps } from './wizard';

export default function SummaryStep({ context }: RestoreBootloaderKeysStepProps) {
  const { checkState, restoreState, reinstallState, selectedManifestId } = context.state;

  if (checkState.status === 'done' && checkState.keysBlank === false) {
    return (
      <div className="text-center py-8">
        <CheckCircleIcon className="w-16 h-16 mx-auto mb-4 text-green-600 dark:text-green-400" />
        <h3 className="text-lg font-medium text-primary mb-2">Everything looks fine</h3>
        <p className="text-gray-600 dark:text-gray-300">
          The bootloader keys on this ZWA-2 are intact. There is nothing to repair.
        </p>
      </div>
    );
  }

  if (restoreState.status === 'error') {
    return (
      <div className="py-8 space-y-4">
        <RepairFailedAlert message={restoreState.errorMessage}>
          Check that both wires are connected firmly. Then unplug the ZWA-2, plug it back in
          and run this wizard again.
        </RepairFailedAlert>
        {reinstallState.status !== 'success' && (
          <Alert title="The ZWA-2 still runs the repair tool" severity="error">
            <p>
              It will not work as a Z-Wave adapter until its normal firmware is back. Use
              the "Update ESP firmware" wizard to install it.
            </p>
          </Alert>
        )}
      </div>
    );
  }

  if (reinstallState.status === 'error') {
    return (
      <div className="py-8 space-y-4">
        <Alert title="The firmware could not be reinstalled" severity="error">
          <p>{reinstallState.errorMessage}</p>
          <p className="mt-2">
            The bootloader keys were restored. Only the last step failed, so use the
            "Update ESP firmware" wizard to put the normal firmware back.
          </p>
        </Alert>
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <CheckCircleIcon className="w-16 h-16 mx-auto mb-4 text-green-600 dark:text-green-400" />
      <h3 className="text-lg font-medium text-primary mb-2">Your ZWA-2 is repaired</h3>
      <p className="text-gray-600 dark:text-gray-300">
        The bootloader keys are back and the firmware is reinstalled. Remove both wires
        and close the case.
      </p>
      {selectedManifestId === 'esphome' && (
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          Use the "Update ESP firmware" wizard to set up WiFi for the Portable Z-Wave
          firmware.
        </p>
      )}
    </div>
  );
}
