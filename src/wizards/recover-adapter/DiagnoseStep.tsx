import type { WizardStepProps } from '../../components/Wizard';
import type { RecoverAdapterState, DiagnosisResult } from './wizard';
import Alert from '../../components/Alert';

function DiagnosisResultDisplay({ result }: { result: DiagnosisResult }) {
  switch (result.tag) {
    case "CORRUPTED_FIRMWARE":
      return (
        <div className="space-y-4">
          <Alert title="Corrupted Firmware Detected" severity="error">
            <p>
              Your ZWA-2 adapter appears to have corrupted firmware. The device is stuck in bootloader mode
              and cannot start the application firmware.
            </p>
            <p className="mt-2">
              <strong>Recovery required:</strong> Proceeding to recovery options...
            </p>
          </Alert>
        </div>
      );

    case "UNKNOWN_FIRMWARE":
      return (
        <div className="space-y-4">
          <Alert title="Unknown Firmware Detected" severity="warning">
            <p>
              Your ZWA-2 adapter is running an unknown firmware that is not recognized as a standard
              Z-Wave controller firmware. This could be a Zniffer firmware or other custom firmware.
            </p>
            <p className="mt-2">
              <strong>Recovery available:</strong> Proceeding to recovery options...
            </p>
          </Alert>
        </div>
      );

    default:
      // This should not be shown since we auto-navigate for other cases
      return null;
  }
}

export default function DiagnoseStep({ context }: WizardStepProps<RecoverAdapterState>) {
  const { isDiagnosing, diagnosisResult } = context.state;

  if (isDiagnosing) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600 mx-auto mb-4"></div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Diagnosing Adapter
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Running diagnostics to identify any issues with your ZWA-2 adapter...
        </p>
      </div>
    );
  }

  if (diagnosisResult) {
    return (
      <div className="py-8">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
          Diagnostics results
        </h3>
        <DiagnosisResultDisplay result={diagnosisResult} />
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Diagnose Adapter
      </h3>
      <p className="text-gray-600 dark:text-gray-300">
        Diagnostis will start automatically when you reach this step.
      </p>
    </div>
  );
}
