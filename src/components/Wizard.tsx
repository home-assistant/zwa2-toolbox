import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardBody, CardFooter } from './Card';
import ProgressSteps from './ProgressSteps';
import Button from './Button';
import type { ZWaveBinding } from '../lib/zwave';

export interface BaseWizardContext {
  serialPort: SerialPort | null;
  zwaveBinding: ZWaveBinding | null;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => Promise<void>;
  onDisconnect?: () => Promise<void>;
}

export interface WizardContext<T = unknown> extends BaseWizardContext {
  state: T;
  setState: (updater: T | ((prev: T) => T)) => void;
}

export interface NavigationButton<T = unknown> {
  label: string | ((context: WizardContext<T>) => string);
  variant?: 'primary' | 'secondary';
  beforeNavigate?: (context: WizardContext<T>) => Promise<boolean | number>;
  disabled?: (context: WizardContext<T>) => boolean;
}

export interface WizardStepConfig<T = unknown> {
  name: string;
  component: React.ComponentType<WizardStepProps<T>>;
  navigationButtons?: {
    next?: NavigationButton<T>;
    back?: NavigationButton<T>;
    cancel?: NavigationButton<T>;
  };
  blockBrowserNavigation?: (context: WizardContext<T>) => boolean;
}

export interface WizardStepProps<T = unknown> {
  context: WizardContext<T>;
}

export interface WizardConfig<T = unknown> {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  iconForeground: string;
  iconBackground: string;
  steps: WizardStepConfig<T>[];
  createInitialState: () => T;
}

interface WizardProps<T = unknown> {
  config: WizardConfig<T>;
  baseContext: BaseWizardContext;
  onClose?: () => void;
}

export default function Wizard<T = unknown>({ config, baseContext, onClose }: WizardProps<T>) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [state, setState] = useState<T>(() => config.createInitialState());

  const currentStep = config.steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === config.steps.length - 1;

  // Create the full wizard context
  const context: WizardContext<T> = useMemo(() => ({
    ...baseContext,
    state,
    setState,
  }), [baseContext, state]);

  // Convert steps to the format expected by ProgressSteps
  const progressSteps = useMemo(() =>
    config.steps.map((step, index) => ({
      id: `step-${index}`,
      name: step.name,
    })),
    [config.steps]
  );

  // Check if browser navigation should be blocked
  const shouldBlockNavigation = currentStep.blockBrowserNavigation?.(context) ?? false;

  // Handle browser unload prevention
  useEffect(() => {
    if (shouldBlockNavigation) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
        return '';
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [shouldBlockNavigation]);

  const handleNext = async () => {
    const nextButton = currentStep.navigationButtons?.next;

    if (nextButton?.beforeNavigate) {
      const result = await nextButton.beforeNavigate(context);
      if (result === false) {
        return; // Navigation cancelled
      }
      if (typeof result === 'number') {
        // Navigate to specific step
        setCurrentStepIndex(Math.max(0, Math.min(result, config.steps.length - 1)));
        return;
      }
    }

    // Default navigation - go to next step
    if (!isLastStep) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // Finish wizard
      onClose?.();
    }
  };

  const handleBack = async () => {
    const backButton = currentStep.navigationButtons?.back;

    if (backButton?.beforeNavigate) {
      const result = await backButton.beforeNavigate(context);
      if (result === false) {
        return; // Navigation cancelled
      }
      if (typeof result === 'number') {
        // Navigate to specific step
        setCurrentStepIndex(Math.max(0, Math.min(result, config.steps.length - 1)));
        return;
      }
    }

    // Default navigation - go to previous step
    if (!isFirstStep) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleCancel = async () => {
    const cancelButton = currentStep.navigationButtons?.cancel;

    if (cancelButton?.beforeNavigate) {
      const result = await cancelButton.beforeNavigate(context);
      if (result === false) {
        return; // Navigation cancelled
      }
    }

    onClose?.();
  };

  const handleStepClick = (stepId: string) => {
    if (shouldBlockNavigation) return;

    const stepIndex = parseInt(stepId.replace('step-', ''));
    if (!isNaN(stepIndex) && stepIndex >= 0 && stepIndex < config.steps.length) {
      setCurrentStepIndex(stepIndex);
    }
  };

  // Render current step component
  const StepComponent = currentStep.component;

  // Get navigation button configurations
  const nextButton = currentStep.navigationButtons?.next;
  const backButton = currentStep.navigationButtons?.back;
  const cancelButton = currentStep.navigationButtons?.cancel;

  const showNext = nextButton !== undefined;
  const showBack = !isFirstStep && (backButton !== undefined || currentStep.navigationButtons?.back !== null);
  const showCancel = cancelButton !== undefined;

  const nextDisabled = nextButton?.disabled?.(context) ?? false;
  const backDisabled = backButton?.disabled?.(context) ?? false;
  const cancelDisabled = cancelButton?.disabled?.(context) ?? false;

  const nextLabel = typeof nextButton?.label === 'function'
    ? nextButton.label(context)
    : nextButton?.label ?? (isLastStep ? 'Finish' : 'Next');
  const backLabel = typeof backButton?.label === 'function'
    ? backButton.label(context)
    : backButton?.label ?? 'Back';
  const cancelLabel = typeof cancelButton?.label === 'function'
    ? cancelButton.label(context)
    : cancelButton?.label ?? 'Cancel';

  return (
    <Card>
      <CardHeader>
        <ProgressSteps
          steps={progressSteps}
          currentStepIndex={currentStepIndex}
          onStepClick={shouldBlockNavigation ? undefined : handleStepClick}
        />
      </CardHeader>

      <CardBody>
        <StepComponent context={context} />
      </CardBody>

      <CardFooter>
        <div className="flex justify-between">
          <div>
            {showCancel && (
              <Button
                variant={cancelButton?.variant ?? 'secondary'}
                onClick={handleCancel}
                disabled={cancelDisabled || shouldBlockNavigation}
              >
                {cancelLabel}
              </Button>
            )}
          </div>

          <div className="flex gap-3">
            {showBack && (
              <Button
                variant={backButton?.variant ?? 'secondary'}
                onClick={handleBack}
                disabled={backDisabled || shouldBlockNavigation}
              >
                {backLabel}
              </Button>
            )}
            {showNext && (
              <Button
                variant={nextButton?.variant ?? 'primary'}
                onClick={handleNext}
                disabled={nextDisabled || shouldBlockNavigation}
              >
                {nextLabel}
              </Button>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
