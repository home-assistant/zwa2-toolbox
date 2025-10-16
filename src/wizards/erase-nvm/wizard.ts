import { TrashIcon } from "@heroicons/react/24/outline";
import ConnectStep from "../../components/steps/ConnectStep";
import ConfirmStep from "./ConfirmStep";
import EraseStep from "./EraseStep";
import SummaryStep from "./SummaryStep";
import type { WizardConfig, WizardContext, WizardStepProps } from "../../components/Wizard";
import { DriverMode } from "zwave-js";

export interface EraseNVMState {
	confirmed: boolean;
	isErasing: boolean;
	currentSubStep: number;
	eraseResult: "success" | "warning" | "error" | null;
	errorMessage: string;
}

export type EraseNVMWizardStepProps = WizardStepProps<EraseNVMState>;

// FIXME: We should distinguish between erasing the NVM and simply factory resetting a Z-Wave controller (hard reset)

async function handleEraseStepEntry(context: WizardContext<EraseNVMState>) {
	const { isErasing } = context.state;

	// Don't start if already erasing or if there's already a result
	if (isErasing || context.state.eraseResult !== null) {
		return;
	}

	// Initialize the ZWave driver
	if (!context.zwaveBinding || !(await context.zwaveBinding.initialize())) {
		context.setState((prev) => ({
			...prev,
			eraseResult: "error",
			errorMessage: "Failed to initialize Z-Wave driver",
		}));
		context.goToStep("Summary");
		return;
	}

	try {
		context.setState((prev) => ({
			...prev,
			isErasing: true,
			currentSubStep: 0,
			eraseResult: null,
			errorMessage: "",
		}));

		// Step 1: Detect application
		context.setState((prev) => ({ ...prev, currentSubStep: 0 }));
		const driverMode = context.zwaveBinding.getDriverMode();

		// Step 2: Reset into bootloader (if needed)
		context.setState((prev) => ({ ...prev, currentSubStep: 1 }));
		if (driverMode === DriverMode.Bootloader) {
			// Already in bootloader, skip this step
			context.setState((prev) => ({ ...prev, currentSubStep: 2 }));
		} else if (
			driverMode === DriverMode.SerialAPI ||
			driverMode === DriverMode.CLI
		) {
			const resetSuccess = await context.zwaveBinding.resetToBootloader();
			if (!resetSuccess) {
				context.setState((prev) => ({
					...prev,
					isErasing: false,
					eraseResult: "error",
					errorMessage: "Failed to reset to bootloader",
				}));
				context.goToStep("Summary");
				return;
			}
			context.setState((prev) => ({ ...prev, currentSubStep: 2 }));
		}

		// Step 3: Erase NVM
		const eraseSuccess = await context.zwaveBinding.eraseNVM();
		if (!eraseSuccess) {
			context.setState((prev) => ({
				...prev,
				isErasing: false,
				eraseResult: "error",
				errorMessage: "Failed to erase NVM",
			}));
			context.goToStep("Summary");
			return;
		}

		context.setState((prev) => ({ ...prev, currentSubStep: 3 }));

		// Step 4: Start application
		const startSuccess = await context.zwaveBinding.runApplication();
		if (startSuccess) {
			context.setState((prev) => ({
				...prev,
				isErasing: false,
				currentSubStep: 4,
				eraseResult: "success",
				errorMessage: "",
			}));
		} else {
			context.setState((prev) => ({
				...prev,
				isErasing: false,
				currentSubStep: 4,
				eraseResult: "warning",
				errorMessage:
					"NVM erased successfully, but failed to start application",
			}));
		}

		// Navigate to Summary step immediately after completion
		context.goToStep("Summary");
	} catch (error) {
		context.setState((prev) => ({
			...prev,
			isErasing: false,
			eraseResult: "error",
			errorMessage: `Unexpected error: ${error}`,
		}));

		// Navigate to Summary step immediately after error
		context.goToStep("Summary");
	}
}

export const eraseNVMWizardConfig: WizardConfig<EraseNVMState> = {
	id: "erase",
	title: "Factory Reset",
	description:
		"Remove all Z-Wave network data from your device. This will reset the device to factory defaults.",
	icon: TrashIcon,
	iconForeground: "text-red-700 dark:text-red-400",
	iconBackground: "bg-red-50 dark:bg-red-500/10",
	createInitialState: () => ({
		confirmed: false,
		isErasing: false,
		currentSubStep: -1,
		eraseResult: null,
		errorMessage: "",
	}),
	steps: [
		{
			name: "Connect",
			component: ConnectStep<EraseNVMState>,
			navigationButtons: {
				next: {
					label: "Next",
					disabled: (context) => context.connectionState.status !== 'connected',
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
			name: "Confirm",
			component: ConfirmStep,
			navigationButtons: {
				next: {
					label: "Next",
					disabled: (context) => !context.state.confirmed,
				},
				back: {
					label: "Back",
				},
				cancel: {
					label: "Cancel",
				},
			},
		},
		{
			name: "Erase",
			component: EraseStep,
			onEnter: handleEraseStepEntry,
			blockBrowserNavigation: (context) => context.state.isErasing,
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
