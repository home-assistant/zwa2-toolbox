import { CloudArrowUpIcon } from "@heroicons/react/24/outline";
import ConnectStep from "../../components/steps/ConnectStep";
import FileSelectStep from "./FileSelectStep";
import FlashStep from "./FlashStep";
import type { WizardConfig, WizardContext, WizardStepProps } from "../../components/Wizard";
import { openFirmwareFile } from "../../lib/firmware-download";

export interface UpdateFirmwareState {
	selectedFile: File | null;
	isFlashing: boolean;
	progress: number;
	isComplete: boolean;
}

export type UpdateFirmwareWizardStepProps = WizardStepProps<UpdateFirmwareState>;

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

	// Initialize the ZWave driver
	if (!context.zwaveBinding || !(await context.zwaveBinding.initialize())) {
		return false;
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

		// Extract firmware from file
		const { fileName, data } = await openFirmwareFile(selectedFile);

		const success = await context.zwaveBinding.flashFirmware(fileName, data);
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
		"Update your ZWA-2 to the latest firmware version. Ensures compatibility and includes the latest features.",
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
