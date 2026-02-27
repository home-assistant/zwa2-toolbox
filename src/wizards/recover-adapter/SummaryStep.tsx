import type { WizardStepProps } from '../../components/Wizard';
import type { RecoverAdapterState, RecoveryResult } from './wizard';
import Alert from '../../components/Alert';

function getRecoveryResult(state: RecoverAdapterState): RecoveryResult {
  // Use finalResult if available, otherwise use diagnosisResult
  const result = state.finalResult || state.diagnosisResult;

  if (!result) {
    return {
      tag: "CONNECTION_FAILED",
      severity: "error",
      message: "No diagnosis result available."
    };
  }

  switch (result.tag) {
    case "NO_ISSUES":
      return {
        tag: "NO_ISSUES",
        severity: "success",
        message: (
          <div>
            <p>Your ZWA-2 adapter is working correctly and is ready to use as a Z-Wave controller.</p>
          </div>
        )
      };

    case "STARTED_APPLICATION":
      return {
        tag: "STARTED_APPLICATION",
        severity: "success",
        message: (
          <div>
            <p>Your ZWA-2 adapter was in bootloader mode but has been successfully started. It is now ready to use as a Z-Wave controller.</p>
          </div>
        )
      };

    case "RECOVERED":
      return {
        tag: "RECOVERED",
        severity: "success",
        message: (
          <div>
            <p>Your ZWA-2 adapter has been successfully recovered by installing fresh firmware. It is now ready to use as a Z-Wave controller.</p>
          </div>
        )
      };

    case "FIXED_CONTROLLER_NODE_ID_239":
      return {
        tag: "FIXED_CONTROLLER_NODE_ID_239",
        severity: "success",
        message: (
          <div>
            <p>The invalid controller node ID on your ZWA-2 adapter has been successfully corrected.</p>
          </div>
        )
      };
    case "FIXING_CONTROLLER_NODE_ID_239_FAILED":
      return {
        tag: "FIXING_CONTROLLER_NODE_ID_239_FAILED",
        severity: "error",
        message: (
          <div>
            <p>Failed to correct the invalid controller node ID on your ZWA-2 adapter.</p>
            <p className="mt-2">Please try running the recovery wizard again, or contact support if the problem persists.</p>
          </div>
        )
      };
    case "END_DEVICE_CLI":
      return {
        tag: "END_DEVICE_CLI",
        severity: "warning",
        message: (
          <div>
            <p>Your ZWA-2 adapter is running an end device CLI firmware, which may cause it to appear unresponsive in Z-Wave controller applications.</p>
            <p className="mt-2">
              <strong>Recommendation:</strong> Use the "Install Z-Wave firmware" wizard to install the correct Z-Wave controller firmware.
            </p>
          </div>
        )
      };

    case "CONNECTION_FAILED":
      return {
        tag: "CONNECTION_FAILED",
        severity: "error",
        message: (
          <div>
            <p>Unable to establish a connection with your ZWA-2 adapter. This issue cannot be recovered automatically.</p>
            <p className="mt-2">Please check your connection and try again, or contact support if the problem persists.</p>
          </div>
        )
      };

    case "RECOVERY_FAILED":
      return {
        tag: "RECOVERY_FAILED",
        severity: "error",
        message: (
          <div>
            <p>The recovery process failed to restore your ZWA-2 adapter to a working state.</p>
            <p className="mt-2">You can try running the recovery wizard again with a different firmware file, or contact support for further assistance.</p>
          </div>
        )
      };

    case "DOWNLOAD_FAILED":
      return {
        tag: "DOWNLOAD_FAILED",
        severity: "error",
        message: (
          <div>
            <p>Failed to download the latest firmware from the internet. This could be due to a network connectivity issue or the firmware repository being temporarily unavailable.</p>
            <p className="mt-2">
              <strong>Suggestion:</strong> Check your internet connection and try again, or use the "Install Z-Wave firmware" wizard to provide a custom firmware file.
            </p>
          </div>
        )
      };

    case "CORRUPTED_FIRMWARE":
      return {
        tag: "CORRUPTED_FIRMWARE",
        severity: "error",
        message: (
          <div>
            <p>Your ZWA-2 adapter has corrupted firmware and requires recovery, but no recovery was attempted.</p>
            <p className="mt-2">Please run the recovery wizard again and proceed with the recovery process.</p>
          </div>
        )
      };

    case "UNKNOWN_FIRMWARE":
      return {
        tag: "UNKNOWN_FIRMWARE",
        severity: "warning",
        message: (
          <div>
            <p>Your ZWA-2 adapter is running an unknown firmware that is not recognized as a standard Z-Wave controller firmware.</p>
            <p className="mt-2">If you want to use this adapter as a Z-Wave controller, please use the "Install Z-Wave firmware" wizard to install the correct Z-Wave controller firmware.</p>
          </div>
        )
      };

    default:
      return {
        tag: "CONNECTION_FAILED",
        severity: "error",
        message: "An unexpected error occurred during the recovery process."
      };
  }
}

function getResultTitle(result: RecoveryResult): string {
  switch (result.tag) {
    case "NO_ISSUES":
      return "Adapter is working properly";
    case "STARTED_APPLICATION":
    case "RECOVERED":
      return "Adapter successfully recovered";
    case "FIXED_CONTROLLER_NODE_ID_239":
      return "Controller node ID corrected";
    case "FIXING_CONTROLLER_NODE_ID_239_FAILED":
      return "Failed to correct controller node ID";
    case "END_DEVICE_CLI":
      return "Wrong firmware detected";
    case "CONNECTION_FAILED":
      return "Connection failed";
    case "RECOVERY_FAILED":
      return "Recovery failed";
    case "DOWNLOAD_FAILED":
      return "Firmware download failed";
    case "CORRUPTED_FIRMWARE":
      return "Recovery required";
    case "UNKNOWN_FIRMWARE":
      return "Unknown firmware";
    default:
      return "Recovery summary";
  }
}

export default function SummaryStep({ context }: WizardStepProps<RecoverAdapterState>) {
  const result = getRecoveryResult(context.state);
  const title = getResultTitle(result);

  return (
    <div className="py-8">
      <h3 className="text-lg font-medium text-primary mb-6">
        Recovery summary
      </h3>

      {result.severity === "success" && (
        <div className="text-center py-8">
          <div className="text-green-600 dark:text-green-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h4 className="text-lg font-medium text-primary mb-4">
            {title}
          </h4>
          <div className="text-gray-600 dark:text-gray-300">
            {result.message}
          </div>
        </div>
      )}

      {result.severity === "warning" && (
        <div className="space-y-4">
          <Alert title={title} severity="warning">
            {result.message}
          </Alert>
        </div>
      )}

      {result.severity === "error" && (
        <div className="space-y-4">
          <Alert title={title} severity="error">
            {result.message}
          </Alert>
        </div>
      )}
    </div>
  );
}
