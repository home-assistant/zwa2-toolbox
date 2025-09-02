import { CloudArrowDownIcon } from "@heroicons/react/24/outline";
import ConnectStep from "../../components/steps/ConnectStep";
import FileSelectStep from "./FileSelectStep";
import FlashStep from "./FlashStep";
import type { WizardConfig, WizardContext } from "../../components/Wizard";

export interface InstallFirmwareState {
	selectedFile: File | null;
	isFlashing: boolean;
	progress: number;
	isComplete: boolean;
}

async function handleInstallNavigation(
	context: WizardContext<InstallFirmwareState>,
): Promise<boolean> {
	const { isComplete, isFlashing, selectedFile } = context.state;

	if (isComplete) {
		return true; // Allow finish
	}

	if (isFlashing) {
		return false; // Don't allow navigation while flashing
	}

	// Initialize the ZWave driver
	if (!context.zwaveBinding || !(await context.zwaveBinding.initialize())) {
		return false;
	}

	// Start the installation process
	if (!selectedFile || !context.zwaveBinding) {
		return false;
	}

	try {
		context.setState((prev) => ({
			...prev,
			isFlashing: true,
			progress: 0,
			isComplete: false,
		}));

		// Set up progress callback
		context.zwaveBinding.onProgress = (progress: number) => {
			context.setState((prev) => ({ ...prev, progress }));
		};

		const success = await context.zwaveBinding.flashFirmware(selectedFile);
		if (success) {
			context.setState((prev) => ({
				...prev,
				isFlashing: false,
				progress: 100,
				isComplete: true,
			}));
			return false; // Don't auto-advance, let user click Finish
		} else {
			// Reset state on failure so user can try again
			context.setState((prev) => ({
				...prev,
				isFlashing: false,
				progress: 0,
				isComplete: false,
			}));
			return false;
		}
	} catch (error) {
		console.error("Flash failed:", error);
		context.setState((prev) => ({
			...prev,
			isFlashing: false,
			progress: 0,
			isComplete: false,
		}));
		return false;
	}
}

export const installFirmwareWizardConfig: WizardConfig<InstallFirmwareState> = {
	id: "install",
	title: "Install Firmware",
	description:
		"Install new firmware on your ZWA-2 device. Choose from bootloader, application firmware, or complete firmware packages.",
	icon: CloudArrowDownIcon,
	iconForeground: "text-indigo-700 dark:text-indigo-400",
	iconBackground: "bg-indigo-50 dark:bg-indigo-500/10",
	createInitialState: () => ({
		selectedFile: null,
		isFlashing: false,
		progress: 0,
		isComplete: false,
	}),
	steps: [
		{
			name: "Connect",
			component: ConnectStep<InstallFirmwareState>,
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
			name: "Select firmware",
			component: FileSelectStep,
			navigationButtons: {
				next: {
					label: "Next",
					disabled: (context) => !context.state.selectedFile,
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
			name: "Install",
			component: FlashStep,
			navigationButtons: {
				next: {
					label: (context) => {
						const { isComplete, isFlashing } = context.state;
						if (isComplete) return "Finish";
						if (isFlashing) return "Installing...";
						return "Install";
					},
					beforeNavigate: handleInstallNavigation,
					disabled: (context) => {
						const { isComplete, selectedFile, isFlashing } =
							context.state;
						return (
							(!isComplete && !selectedFile) ||
							isFlashing
						);
					},
				},
				back: {
					label: "Back",
					disabled: (context) => context.state.isFlashing || context.state.isComplete,
				},
				cancel: {
					label: "Cancel",
					disabled: (context) => context.state.isFlashing || context.state.isComplete,
				},
			},
			blockBrowserNavigation: (context) => context.state.isFlashing,
		},
	],
};
