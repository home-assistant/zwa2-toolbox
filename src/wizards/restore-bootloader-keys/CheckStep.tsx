import Alert from '../../components/Alert';
import StatusPanel from '../../components/StatusPanel';
import type { RestoreBootloaderKeysStepProps } from './wizard';

export default function CheckStep({ context }: RestoreBootloaderKeysStepProps) {
  const { checkState } = context.state;

  if (checkState.status !== 'done') {
    return <StatusPanel title="Checking your ZWA-2" />;
  }

  if (checkState.keysBlank === true) {
    return (
      <div className="py-8 space-y-4">
        <Alert title="This ZWA-2 needs to be repaired" severity="error">
          <p>The bootloader keys are missing, which is why firmware updates fail.</p>
        </Alert>
        <p className="text-gray-600 dark:text-gray-300">
          This wizard can put them back. You will need a small screwdriver and two
          male-to-female jumper wires.
        </p>
        <p className="text-gray-600 dark:text-gray-300">
          The repair replaces the ESP firmware for a few minutes and puts it back
          afterwards.
        </p>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-4">
      <Alert title="Could not check automatically">
        <p>
          The automatic check could not determine whether the bootloader keys are intact.
          This can happen with newer controller firmware, alternative firmware or when
          the device does not start up properly.
        </p>
      </Alert>
      <p className="text-gray-600 dark:text-gray-300">
        Continue if firmware updates fail on this device. You will need a small screwdriver
        and two male-to-female jumper wires.
      </p>
      <p className="text-gray-600 dark:text-gray-300">
        The repair replaces the ESP firmware for a minute and puts it back afterwards.
		You will need to disconnect and reconnect your ZWA-2 a couple of times during the repair.
      </p>
    </div>
  );
}
