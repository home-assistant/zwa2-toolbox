import { Card, CardHeader, CardBody, CardFooter } from './Card';
import ProgressSteps from './ProgressSteps';
import type { WizardStep } from './ProgressSteps';
import Button from './Button';
import { useEffect } from 'react';

export interface WizardProps {
  steps: WizardStep[];
  currentStepIndex: number;
  onNext?: () => void;
  onBack?: () => void;
  onCancel?: () => void;
  onStepClick?: (stepId: string) => void;
  children: React.ReactNode;
  nextLabel?: string;
  backLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  disableNext?: boolean;
  disableBack?: boolean;
  disableNavigation?: boolean;
  preventUnload?: boolean;
}

export default function Wizard({
  steps,
  currentStepIndex,
  onNext,
  onBack,
  onCancel,
  onStepClick,
  children,
  nextLabel = 'Next',
  backLabel = 'Back',
  cancelLabel = 'Cancel',
  showCancel = false,
  disableNext = false,
  disableBack = false,
  disableNavigation = false,
  preventUnload = false,
}: WizardProps) {
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Handle browser unload prevention
  useEffect(() => {
    if (preventUnload) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
        return '';
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [preventUnload]);

  const handleStepClick = (stepId: string) => {
    if (disableNavigation || !onStepClick) return;
    onStepClick(stepId);
  };

  return (
    <Card>
      <CardHeader>
        <ProgressSteps steps={steps} onStepClick={handleStepClick} />
      </CardHeader>

      <CardBody>
        {children}
      </CardBody>

      <CardFooter>
        <div className="flex justify-between">
          <div>
            {showCancel && (
              <Button variant="secondary" onClick={onCancel} disabled={disableNavigation}>
                {cancelLabel}
              </Button>
            )}
          </div>

          <div className="flex gap-3">
            {!isFirstStep && (
              <Button
                variant="secondary"
                onClick={onBack}
                disabled={disableBack || disableNavigation}
              >
                {backLabel}
              </Button>
            )}
            {!isLastStep && (
              <Button
                variant="primary"
                onClick={onNext}
                disabled={disableNext || disableNavigation}
              >
                {nextLabel}
              </Button>
            )}
            {isLastStep && (
              <Button
                variant="primary"
                onClick={onNext}
                disabled={disableNext || disableNavigation}
              >
                Finish
              </Button>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
