import { CheckCircleIcon } from '@heroicons/react/20/solid';
import Spinner from './Spinner';

export interface SubStep {
  name: string;
  showSpinner?: boolean;
}

interface SubStepProgressProps {
  steps: SubStep[];
  currentStepIndex: number;
  /**
   * Color of the spinner border as a full Tailwind class (e.g., 'border-blue-600', 'border-orange-600')
   * @default 'border-blue-600'
   */
  spinnerColor?: string;
}

export default function SubStepProgress({ steps, currentStepIndex, spinnerColor = 'border-blue-600' }: SubStepProgressProps) {
  return (
    <div className="px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Progress">
        <ol role="list" className="space-y-6">
          {steps.map((step, index) => (
            <li key={step.name}>
              {index < currentStepIndex ? (
                <div className="group">
                  <span className="flex items-start">
                    <span className="relative flex size-5 shrink-0 items-center justify-center">
                      <CheckCircleIcon
                        aria-hidden="true"
                        className="size-full text-green-600 dark:text-green-400"
                      />
                    </span>
                    <span className="ml-3 text-sm font-medium text-primary">
                      {step.name}
                    </span>
                  </span>
                </div>
              ) : index === currentStepIndex ? (
                <div className="flex items-start">
                  <span aria-hidden="true" className="relative flex size-5 shrink-0 items-center justify-center">
                    <span className="absolute size-4 rounded-full bg-indigo-200 dark:bg-indigo-900" />
                    <span className="relative block size-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  </span>
                  <span className="ml-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 flex items-center">
                    {step.name}
                    {step.showSpinner && (
                      <Spinner size="h-4 w-4" color={spinnerColor} className="ml-2" />
                    )}
                  </span>
                </div>
              ) : (
                <div className="group">
                  <div className="flex items-start">
                    <div aria-hidden="true" className="relative flex size-5 shrink-0 items-center justify-center">
                      <div className="size-2 rounded-full bg-gray-300 dark:bg-white/15" />
                    </div>
                    <p className="ml-3 text-sm font-medium text-secondary">
                      {step.name}
                    </p>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
