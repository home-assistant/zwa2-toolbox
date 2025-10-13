import type { WizardStepProps } from '../../components/Wizard';
import SubStepProgress from '../../components/SubStepProgress';
import type { EraseNVMState } from './wizard';
import Spinner from '../../components/Spinner';

const subStepNames = [
  'Detect application',
  'Reset into bootloader',
  'Erase NVM',
  'Start application',
];

export default function EraseStep({ context }: WizardStepProps<EraseNVMState>) {
  const { isErasing, currentSubStep } = context.state;

  return (
    <div className="py-8">
      <h3 className="text-lg font-medium text-primary mb-4">
        Erasing NVM
      </h3>

      <SubStepProgress
        steps={subStepNames.map(name => ({ name }))}
        currentStepIndex={currentSubStep}
      />

      {isErasing && (
        <div className="text-center mt-6">
          <Spinner size="h-8 w-8" className="inline-block mb-4" />
          <p className="text-gray-600 dark:text-gray-300">
            Erasing NVM data... Please do not disconnect the device.
          </p>
        </div>
      )}
    </div>
  );
}
