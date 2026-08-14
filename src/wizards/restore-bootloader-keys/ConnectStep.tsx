import Button from '../../components/Button';
import SharedConnectStep from '../../components/steps/ConnectStep';
import type { RestoreBootloaderKeysStepProps } from './wizard';

/**
 * The shared connect step with a way past it. A ZWA-2 whose ESP runs the repair
 * tool does not appear in the picker, so the user can skip the check and go
 * straight to the repair.
 */
export default function ConnectStep({ context }: RestoreBootloaderKeysStepProps) {
  return (
    <SharedConnectStep
      context={context}
      hint={
        <>
          <p>It does not show up here unless the ESP runs the default USB bridge firmware.</p>
          <p className="mt-2">To skip the check and go straight to the repair, click the button below.</p>
        </>
      }
      hintAction={
        <Button variant="secondary" onClick={() => context.goToStep('Prepare the ZWA-2 for repair')}>
          Repair without checking
        </Button>
      }
    />
  );
}
