import { LifebuoyIcon } from "@heroicons/react/24/solid";
import ConnectStep from "../../components/steps/ConnectStep";
import DiagnoseStep from "./DiagnoseStep.tsx";
import RecoveryStep from "./RecoveryStep.tsx";
import SummaryStep from "./SummaryStep.tsx";
import type { WizardConfig, WizardContext } from "../../components/Wizard";
import { DriverMode } from "zwave-js";
import type { ReactNode } from "react";

export type DiagnosisResult =
	| { tag: "NO_ISSUES" }
	| { tag: "END_DEVICE_CLI" }
	| { tag: "CORRUPTED_FIRMWARE" }
	| { tag: "STARTED_APPLICATION" }
	| { tag: "UNKNOWN_FIRMWARE" }
	| { tag: "CONNECTION_FAILED" }
	| { tag: "RECOVERY_FAILED" }
	| { tag: "RECOVERED" };

export type RecoveryResultSeverity = "success" | "warning" | "error";

export interface RecoveryResult {
	tag: DiagnosisResult["tag"];
	severity: RecoveryResultSeverity;
	message: ReactNode;
}

export interface RecoverAdapterState {
	diagnosisResult: DiagnosisResult | null;
	isDiagnosing: boolean;
	selectedFile: File | null;
	isRecovering: boolean;
	recoveryProgress: number;
	finalResult: DiagnosisResult | null;
}

async function handleRecoveryNavigation(
	context: WizardContext<RecoverAdapterState>,
): Promise<boolean | number> {
	const { isRecovering, finalResult, selectedFile, diagnosisResult } = context.state;

	if (finalResult) {
		// Recovery complete, go to summary
		return true;
	}

	if (isRecovering) {
		return false; // Don't allow navigation while recovering
	}

	// Check if we need a custom firmware file but don't have one
	if (!selectedFile && !diagnosisResult) {
		return false;
	}

	// For latest firmware option (when selectedFile is null), show warning for now
	if (!selectedFile) {
		// TODO: Implement latest firmware download
		return false;
	}

	// Start recovery process
	await startRecovery(context);
	return false; // Stay on recovery step until recovery is complete
}

async function startRecovery(context: WizardContext<RecoverAdapterState>): Promise<boolean> {
	const { selectedFile, diagnosisResult } = context.state;

	if (!context.zwaveBinding || !diagnosisResult) {
		return false;
	}

	try {
		context.setState(prev => ({
			...prev,
			isRecovering: true,
			recoveryProgress: 0,
		}));

		// Set up progress callback
		context.zwaveBinding.onProgress = (progress: number) => {
			context.setState(prev => ({ ...prev, recoveryProgress: progress }));
		};

		let firmwareFile: File;

		if (selectedFile) {
			firmwareFile = selectedFile;
		} else {
			// TODO: Implement downloading latest firmware
			context.setState(prev => ({
				...prev,
				isRecovering: false,
				finalResult: { tag: "RECOVERY_FAILED" }
			}));
			return false;
		}

		const success = await context.zwaveBinding.flashFirmware(firmwareFile);

		if (success) {
			// Check the mode after recovery
			const mode = context.zwaveBinding.getDriverMode();
			if (mode === DriverMode.SerialAPI) {
				context.setState(prev => ({
					...prev,
					isRecovering: false,
					finalResult: { tag: "RECOVERED" }
				}));
			} else if (selectedFile && mode !== DriverMode.Bootloader) {
				// Custom firmware, not recognized as controller firmware
				context.setState(prev => ({
					...prev,
					isRecovering: false,
					finalResult: { tag: "END_DEVICE_CLI" }
				}));
			} else {
				context.setState(prev => ({
					...prev,
					isRecovering: false,
					finalResult: { tag: "RECOVERY_FAILED" }
				}));
			}
		} else {
			context.setState(prev => ({
				...prev,
				isRecovering: false,
				finalResult: { tag: "RECOVERY_FAILED" }
			}));
		}

		return success;
	} catch (error) {
		console.error("Recovery failed:", error);
		context.setState(prev => ({
			...prev,
			isRecovering: false,
			finalResult: { tag: "RECOVERY_FAILED" }
		}));
		return false;
	}
}

export async function diagnoseCorruptedFirmware(context: WizardContext<RecoverAdapterState>): Promise<DiagnosisResult> {
	// Initialize the ZWave driver
	if (!context.zwaveBinding || !(await context.zwaveBinding.initialize())) {
		return { tag: "CONNECTION_FAILED" };
	}

	try {
		// Check current driver mode
		const mode = context.zwaveBinding.getDriverMode();

		switch (mode) {
			case DriverMode.SerialAPI:
				return { tag: "NO_ISSUES" };

			case DriverMode.CLI:
				return { tag: "END_DEVICE_CLI" };

			case DriverMode.Bootloader: {
				// Try to run the application
				const runSuccess = await context.zwaveBinding.runApplication();
				if (runSuccess) {
					const newMode = context.zwaveBinding.getDriverMode();
					switch (newMode) {
						case DriverMode.SerialAPI:
							return { tag: "STARTED_APPLICATION" };
						case DriverMode.CLI:
							return { tag: "END_DEVICE_CLI" };
						case DriverMode.Unknown:
							return { tag: "UNKNOWN_FIRMWARE" };
						default:
							return { tag: "CORRUPTED_FIRMWARE" };
					}
				} else {
					return { tag: "CORRUPTED_FIRMWARE" };
				}
			}

			case DriverMode.Unknown:
				return { tag: "UNKNOWN_FIRMWARE" };

			default:
				return { tag: "CONNECTION_FAILED" };
		}
	} catch (error) {
		console.error("Diagnosis failed:", error);
		return { tag: "CONNECTION_FAILED" };
	}
}

export const recoverAdapterWizardConfig: WizardConfig<RecoverAdapterState> = {
	id: "recover",
	title: "Recover Adapter",
	description: "Attempt to recover a bricked ZWA-2 by identifying known issues and applying appropriate fixes.",
	icon: LifebuoyIcon,
	iconForeground: "text-orange-700 dark:text-orange-400",
	iconBackground: "bg-orange-50 dark:bg-orange-500/10",
	createInitialState: () => ({
		diagnosisResult: null,
		isDiagnosing: false,
		selectedFile: null,
		isRecovering: false,
		recoveryProgress: 0,
		finalResult: null,
	}),
	steps: [
		{
			name: "Connect",
			component: ConnectStep<RecoverAdapterState>,
			navigationButtons: {
				next: {
					label: "Next",
					disabled: (context) => !context.serialPort || context.isConnecting,
					beforeNavigate: async (context) => {
						return await context.afterConnect();
					},
				},
				cancel: {
					label: "Cancel",
				},
			},
		},
		{
			name: "Diagnose",
			component: DiagnoseStep,
			onEnter: async (context) => {
				if (!context.state.diagnosisResult && !context.state.isDiagnosing) {
					context.setState(prev => ({ ...prev, isDiagnosing: true }));
					const result = await diagnoseCorruptedFirmware(context);
					context.setState(prev => ({
						...prev,
						diagnosisResult: result,
						isDiagnosing: false
					}));

					// Automatically navigate based on diagnosis result
					switch (result.tag) {
						case "NO_ISSUES":
						case "CONNECTION_FAILED":
						case "STARTED_APPLICATION":
						case "END_DEVICE_CLI":
							// Skip to summary automatically
							context.setState(prev => ({ ...prev, finalResult: result }));
							context.goToStep("Summary");
							break;
						case "CORRUPTED_FIRMWARE":
						case "UNKNOWN_FIRMWARE":
							// Go to recovery step automatically
							context.goToStep("Recovery");
							break;
					}
				}
			},
		},
		{
			name: "Recovery",
			component: RecoveryStep,
			navigationButtons: {
				next: {
					label: (context) => {
						const { finalResult, isRecovering } = context.state;
						if (finalResult) return "Next";
						if (isRecovering) return "Recovering...";
						return "Start Recovery";
					},
					beforeNavigate: handleRecoveryNavigation,
					disabled: (context) => {
						const { isRecovering, diagnosisResult, selectedFile } = context.state;
						if (isRecovering) return true;
						if (!diagnosisResult) return true;

						// For latest firmware option (selectedFile is null), disable until implemented
						if (!selectedFile) return true;

						return false;
					},
				},
				back: {
					label: "Back",
					disabled: (context) => context.state.isRecovering,
				},
				cancel: {
					label: "Cancel",
					disabled: (context) => context.state.isRecovering,
				},
			},
			blockBrowserNavigation: (context) => context.state.isRecovering,
		},
		{
			name: "Summary",
			component: SummaryStep,
			isFinal: true,
			navigationButtons: {
				next: {
					label: "Finish",
				},
			},
		},
	],
};
