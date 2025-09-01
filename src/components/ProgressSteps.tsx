

export interface WizardStep {
  id: string;
  name: string;
}

interface ProgressStepsProps {
  steps: WizardStep[];
  currentStepIndex: number;
  onStepClick?: (stepId: string) => void;
}

export default function ProgressSteps({ steps, currentStepIndex, onStepClick }: ProgressStepsProps) {
  return (
    <nav aria-label="Progress">
      <ol role="list" className="space-y-4 md:flex md:space-y-0 md:space-x-8">
        {steps.map((step, index) => (
          <li key={step.name} className="md:flex-1">
            {index < currentStepIndex ? (
              <button
                onClick={() => onStepClick?.(step.id)}
                className="group flex flex-col border-l-4 border-indigo-600 py-2 pl-4 hover:border-indigo-800 md:border-t-4 md:border-l-0 md:pt-4 md:pb-0 md:pl-0 dark:border-indigo-500 dark:hover:border-indigo-400 w-full text-left"
              >
                <span className="text-sm font-medium text-indigo-600 group-hover:text-indigo-800 dark:text-indigo-400 dark:group-hover:text-indigo-300">
                  Step {index + 1}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{step.name}</span>
              </button>
            ) : index === currentStepIndex ? (
              <div className="flex flex-col border-l-4 border-indigo-600 py-2 pl-4 md:border-t-4 md:border-l-0 md:pt-4 md:pb-0 md:pl-0 dark:border-indigo-500">
                <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Step {index + 1}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{step.name}</span>
              </div>
            ) : (
              <div className="group flex flex-col border-l-4 border-gray-200 py-2 pl-4 hover:border-gray-300 md:border-t-4 md:border-l-0 md:pt-4 md:pb-0 md:pl-0 dark:border-white/10 dark:hover:border-white/20">
                <span className="text-sm font-medium text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300">
                  Step {index + 1}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{step.name}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
