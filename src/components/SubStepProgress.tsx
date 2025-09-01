import { CheckCircleIcon } from '@heroicons/react/20/solid';

export interface SubStep {
  name: string;
}

interface SubStepProgressProps {
  steps: SubStep[];
  currentStepIndex: number;
}

export default function SubStepProgress({ steps, currentStepIndex }: SubStepProgressProps) {
  return (
    <div className="px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Progress" className="flex justify-center">
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
                    <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
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
                  <span className="ml-3 text-sm font-medium text-indigo-600 dark:text-indigo-400">{step.name}</span>
                </div>
              ) : (
                <div className="group">
                  <div className="flex items-start">
                    <div aria-hidden="true" className="relative flex size-5 shrink-0 items-center justify-center">
                      <div className="size-2 rounded-full bg-gray-300 dark:bg-white/15" />
                    </div>
                    <p className="ml-3 text-sm font-medium text-gray-500 dark:text-gray-400">
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
