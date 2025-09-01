import { TrashIcon } from "@heroicons/react/24/outline";
import ConnectStep from "../../components/steps/ConnectStep";
import ConfirmStep from "./ConfirmStep";
import EraseStep from "./EraseStep";
import SummaryStep from "./SummaryStep";
import type { WizardConfig, WizardContext } from "../../components/Wizard";
import { DriverMode } from "zwave-js";

export interface EraseNVMState {
	confirmed: boolean;
	isErasing: boolean;
	currentSubStep: number;
	eraseResult: "success" | "warning" | "error" | null;
	errorMessage: string;
}

async function handleConnectNavigation(context: WizardContext<EraseNVMState>) {
	if (!context.isConnected) {
		await context.onConnect();
		return false; // Don't advance step immediately, let connection success advance it
	}
	return true;
}

async function handleEraseNavigation(context: WizardContext<EraseNVMState>) {
	const { isErasing } = context.state;

	if (isErasing) {
		return false; // Don't allow navigation while erasing
	}

	if (!context.zwaveBinding) {
		return false;
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
				return 1; // Navigate to next step to show result
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
			return 1; // Navigate to next step to show result
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

		return 1; // Navigate to next step to show result
	} catch (error) {
		context.setState((prev) => ({
			...prev,
			isErasing: false,
			eraseResult: "error",
			errorMessage: `Unexpected error: ${error}`,
		}));
		return 1; // Navigate to next step to show result
	}
}

export const eraseNVMWizardConfig: WizardConfig<EraseNVMState> = {
	id: "erase",
	title: "Erase NVM",
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
					label: (context) =>
						context.isConnected ? "Next" : "Connect",
					beforeNavigate: handleConnectNavigation,
					disabled: (context) => context.isConnecting,
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
			navigationButtons: {
				next: {
					label: (context) => {
						if (context.state.isErasing) return "Erasing...";
						return "Erase";
					},
					beforeNavigate: handleEraseNavigation,
					disabled: (context) => {
						return !context.zwaveBinding || context.state.isErasing;
					},
				},
				back: {
					label: "Back",
					disabled: (context) => context.state.isErasing,
				},
				cancel: {
					label: "Cancel",
					disabled: (context) => context.state.isErasing,
				},
			},
			blockBrowserNavigation: (context) => context.state.isErasing,
		},
		{
			name: "Summary",
			component: SummaryStep,
			navigationButtons: {
				next: {
					label: "Finish",
				},
			},
		},
	],
};
