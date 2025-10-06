import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Card, CardHeader, CardBody, CardFooter } from './Card';
import ProgressSteps from './ProgressSteps';
import Button from './Button';
import type { ZWaveBinding } from '../lib/zwave';
import { ZWaveBinding as ZWaveBindingClass } from '../lib/zwave';

export type ConnectionState =
  | { status: 'disconnected' }
  | { status: 'connecting'; type: 'zwa2' | 'esp32' }
  | { status: 'connected'; port: SerialPort; type: 'zwa2' | 'esp32' };

export interface BaseWizardContext {
  connectionState: ConnectionState;
  requestZWA2SerialPort: () => Promise<boolean>;
  requestESP32SerialPort: () => Promise<boolean>;
  requestCombinedSerialPort?: () => Promise<{ success: boolean; deviceType?: 'zwa2' | 'esp32' | 'unknown'; needsBootloaderMode?: boolean }>;
  onDisconnect?: () => Promise<void>;
}

export interface WizardContext<T = unknown> extends BaseWizardContext {
  state: T;
  setState: (updater: T | ((prev: T) => T)) => void;
  goToStep: (stepName: string) => void;
  autoNavigateToNext: () => Promise<void>;
  registerCleanup: (cleanup: () => Promise<void> | void) => void;
  zwaveBinding: ZWaveBinding | null;
  setZwaveBinding: (binding: ZWaveBinding | null) => void;
  afterConnect: () => Promise<boolean>;
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
  onEnter?: (context: WizardContext<T>) => Promise<void> | void;
  isFinal?: boolean;
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
  standalone?: boolean;
}

interface WizardProps<T = unknown> {
  config: WizardConfig<T>;
  baseContext: BaseWizardContext;
  onClose?: () => void;
}

export default function Wizard<T = unknown>({ config, baseContext, onClose }: WizardProps<T>) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [state, setState] = useState<T>(() => config.createInitialState());

  // Use refs for zwaveBinding and cleanupHooks
  const zwaveBindingRef = useRef<ZWaveBinding | null>(null);
  const cleanupHooksRef = useRef<Array<() => Promise<void> | void>>([]);

  const currentStep = config.steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === config.steps.length - 1;

  const registerCleanup = (cleanup: () => Promise<void> | void) => {
    cleanupHooksRef.current.push(cleanup);
  };

  const afterConnect = useCallback(async (): Promise<boolean> => {
    const serialPort = baseContext.connectionState.status === 'connected' ? baseContext.connectionState.port : null;
    if (!serialPort) {
      return false;
    }

    // Create ZWaveBinding if it doesn't exist
    if (!zwaveBindingRef.current) {
      const binding = new ZWaveBindingClass(serialPort);
      binding.onError = (error: string) => {
        console.error('[ZWaveBinding Error]:', error);
      };
      zwaveBindingRef.current = binding;
      return true;
    }

    return true;
  }, [baseContext.connectionState]);

  // Create the full wizard context
  const context: WizardContext<T> = useMemo(() => ({
    ...baseContext,
    state,
    setState,
    goToStep: (stepName: string) => {
      const stepIndex = config.steps.findIndex(step => step.name === stepName);
      if (stepIndex !== -1) {
        setCurrentStepIndex(stepIndex);
      }
    },
    autoNavigateToNext: async () => {
      const nextButton = currentStep.navigationButtons?.next;

      if (nextButton?.beforeNavigate) {
        const result = await nextButton.beforeNavigate(context);
        if (result === false) {
          return; // Navigation cancelled
        }
        if (typeof result === 'number') {
          setCurrentStepIndex(Math.max(0, Math.min(result, config.steps.length - 1)));
          return;
        }
      }

      if (currentStepIndex < config.steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      } else {
        onClose?.();
      }
    },
    registerCleanup,
    zwaveBinding: zwaveBindingRef.current,
    setZwaveBinding: (binding) => {
      zwaveBindingRef.current = binding;
    },
    afterConnect,
  }), [baseContext, state, config.steps, afterConnect, currentStep.navigationButtons?.next, currentStepIndex, onClose]);

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

  // Run cleanup on unmount
  useEffect(() => {
    return () => {
      if (zwaveBindingRef.current) {
        const cleanup = zwaveBindingRef.current.disconnect();
        if (cleanup && typeof cleanup.then === 'function') {
          cleanup.catch(error => console.error('ZWaveBinding cleanup failed on unmount:', error));
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      cleanupHooksRef.current.forEach((cleanup) => {
        try {
          const result = cleanup();
          if (result && typeof result.then === 'function') {
            result.catch(error => console.error('Cleanup hook failed on unmount:', error));
          }
        } catch (error) {
          console.error('Cleanup hook failed on unmount:', error);
        }
      });
    };
  }, []);

  // Handle step entry actions
  useEffect(() => {
    const handleStepEntry = async () => {
      if (currentStep.onEnter) {
        await currentStep.onEnter(context);
      }
    };

    handleStepEntry();
    // Only run when the step actually changes, not when context changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex]);

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
      // Finish wizard - just close
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

    // Cancel wizard - just close
    onClose?.();
  };

  // Remove navigation via wizard title progress altogether - no longer needed

  // Render current step component
  const StepComponent = currentStep.component;

  // Get navigation button configurations
  const nextButton = currentStep.navigationButtons?.next;
  const backButton = currentStep.navigationButtons?.back;
  const cancelButton = currentStep.navigationButtons?.cancel;

  // Hide finish and cancel button on standalone wizards
  const showNext = nextButton !== undefined && !(config.standalone && currentStep.isFinal);
  const showBack = !isFirstStep && backButton !== undefined && !currentStep.isFinal;
  const showCancel = cancelButton !== undefined && !currentStep.isFinal && !config.standalone;

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
