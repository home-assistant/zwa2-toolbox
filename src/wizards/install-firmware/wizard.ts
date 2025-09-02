import { CloudArrowDownIcon } from "@heroicons/react/24/outline";
import ConnectStep from "../../components/steps/ConnectStep";
import FileSelectStep from "./FileSelectStep";
import FlashStep from "./FlashStep";
import SummaryStep from "./SummaryStep.tsx";
import type { WizardConfig, WizardContext } from "../../components/Wizard";
import { downloadLatestFirmware } from "../../lib/firmware-download";
import { DriverMode } from "zwave-js";

export type FirmwareOption =
	| { type: "latest-controller" };

export interface InstallFirmwareState {
	selectedFirmware: FirmwareOption | null;
	isFlashing: boolean;
	progress: number;
	flashResult: "success" | "error" | null;
	errorMessage: string;
	downloadedFirmwareName: string | null;
}

async function handleInstallStepEntry(context: WizardContext<InstallFirmwareState>): Promise<void> {
	const { flashResult, isFlashing, selectedFirmware } = context.state;

	// Don't start if already flashing or if there's already a result
	if (isFlashing || flashResult !== null) {
		return;
	}

	if (!selectedFirmware) {
		context.setState((prev) => ({
			...prev,
			flashResult: "error",
			errorMessage: "No firmware selected",
		}));
		context.goToStep("Summary");
		return;
	}

	// Initialize the ZWave driver
	if (!context.zwaveBinding || !(await context.zwaveBinding.initialize())) {
		context.setState((prev) => ({
			...prev,
			flashResult: "error",
			errorMessage: "Failed to initialize Z-Wave driver",
		}));
		context.goToStep("Summary");
		return;
	}

	// Start the installation process
	try {
		context.setState((prev) => ({
			...prev,
			isFlashing: true,
			progress: 0,
			flashResult: null,
			errorMessage: "",
		}));

		// Set up progress callback
		context.zwaveBinding.onProgress = (progress: number) => {
			context.setState((prev) => ({ ...prev, progress }));
		};

		let fileName: string;
		let firmwareData: Uint8Array;

		// Download latest firmware based on selected option
		if (selectedFirmware.type === "latest-controller") {
			try {
				const downloaded = await downloadLatestFirmware();
				fileName = downloaded.fileName;
				firmwareData = downloaded.data;
				context.setState(prev => ({ ...prev, downloadedFirmwareName: fileName }));
			} catch (error) {
				console.error("Failed to download latest firmware:", error);
				context.setState(prev => ({
					...prev,
					isFlashing: false,
					flashResult: "error",
					errorMessage: "Failed to download latest firmware",
				}));
				context.goToStep("Summary");
				return;
			}
		} else {
			context.setState(prev => ({
				...prev,
				isFlashing: false,
				flashResult: "error",
				errorMessage: "Unknown firmware option selected",
			}));
			context.goToStep("Summary");
			return;
		}

		// Flash the firmware
		const success = await context.zwaveBinding.flashFirmware(fileName, firmwareData);

		if (success) {
			// Check if application started successfully
			const mode = context.zwaveBinding.getDriverMode();
			if (mode === DriverMode.SerialAPI) {
				context.setState((prev) => ({
					...prev,
					isFlashing: false,
					progress: 100,
					flashResult: "success",
					errorMessage: "",
				}));
			} else {
				context.setState((prev) => ({
					...prev,
					isFlashing: false,
					progress: 100,
					flashResult: "error",
					errorMessage: `Firmware installed but device is in ${mode || 'unknown'} mode instead of application mode`,
				}));
			}
		} else {
			context.setState((prev) => ({
				...prev,
				isFlashing: false,
				progress: 0,
				flashResult: "error",
				errorMessage: "Failed to install firmware",
			}));
		}

		// Always navigate to summary after flash attempt
		context.goToStep("Summary");
	} catch (error) {
		context.setState((prev) => ({
			...prev,
			isFlashing: false,
			progress: 0,
			flashResult: "error",
			errorMessage: `Unexpected error: ${error}`,
		}));
		context.goToStep("Summary");
	}
}

export const installFirmwareWizardConfig: WizardConfig<InstallFirmwareState> = {
	id: "install",
	title: "Install Firmware",
	description:
		"Install the latest controller firmware on your ZWA-2 device.",
	icon: CloudArrowDownIcon,
	iconForeground: "text-indigo-700 dark:text-indigo-400",
	iconBackground: "bg-indigo-50 dark:bg-indigo-500/10",
	createInitialState: () => ({
		selectedFirmware: null,
		isFlashing: false,
		progress: 0,
		flashResult: null,
		errorMessage: "",
		downloadedFirmwareName: null,
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
			name: "Choose firmware",
			component: FileSelectStep,
			navigationButtons: {
				next: {
					label: "Install",
					disabled: (context) => !context.state.selectedFirmware,
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
			name: "Install firmware",
			component: FlashStep,
			onEnter: handleInstallStepEntry,
			blockBrowserNavigation: (context) => context.state.isFlashing,
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
