import { CloudArrowUpIcon } from "@heroicons/react/24/outline";
import ConnectStep from "../../components/steps/ConnectStep";
import FileSelectStep from "./FileSelectStep";
import FlashStep from "./FlashStep";
import type { WizardConfig, WizardContext } from "../../components/Wizard";

export interface UpdateFirmwareState {
	selectedFile: File | null;
	isFlashing: boolean;
	progress: number;
	isComplete: boolean;
}

async function handleConnectNavigation(
	context: WizardContext<UpdateFirmwareState>,
) {
	if (!context.isConnected) {
		await context.onConnect();
		return false; // Don't advance step immediately, let connection success advance it
	}
	return true;
}

async function handleUpdateNavigation(
	context: WizardContext<UpdateFirmwareState>,
) {
	const { isComplete, selectedFile, isFlashing } = context.state;

	if (isComplete) {
		return true; // Allow finish
	}

	if (isFlashing) {
		return false; // Don't allow navigation while flashing
	}

	// Start the update process
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
			context.setState((prev) => ({
				...prev,
				progress,
			}));
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
		console.error("Update failed:", error);
		context.setState((prev) => ({
			...prev,
			isFlashing: false,
			progress: 0,
			isComplete: false,
		}));
		return false;
	}
}

export const updateFirmwareWizardConfig: WizardConfig<UpdateFirmwareState> = {
	id: "update",
	title: "Update Firmware",
	description:
		"Update your ZWA-2 device to the latest firmware version. Ensures compatibility and includes the latest features.",
	icon: CloudArrowUpIcon,
	iconForeground: "text-green-700 dark:text-green-400",
	iconBackground: "bg-green-50 dark:bg-green-500/10",
	createInitialState: () => ({
		selectedFile: null,
		isFlashing: false,
		progress: 0,
		isComplete: false,
	}),
	steps: [
		{
			name: "Connect",
			component: ConnectStep<UpdateFirmwareState>,
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
			name: "Update",
			component: FlashStep,
			navigationButtons: {
				next: {
					label: (context) => {
						const { isComplete, isFlashing } = context.state;
						if (isComplete) return "Finish";
						if (isFlashing) return "Updating...";
						return "Update";
					},
					beforeNavigate: handleUpdateNavigation,
					disabled: (context) => {
						const { isComplete, selectedFile, isFlashing } =
							context.state;
						return (
							!context.zwaveBinding ||
							(!isComplete && !selectedFile) ||
							isFlashing
						);
					},
				},
				back: {
					label: "Back",
					disabled: (context) => context.state.isFlashing,
				},
				cancel: {
					label: "Cancel",
					disabled: (context) => context.state.isFlashing,
				},
			},
			blockBrowserNavigation: (context) => context.state.isFlashing,
		},
	],
};
