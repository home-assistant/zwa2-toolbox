import { CpuChipIcon } from "@heroicons/react/24/outline";
import ConnectStep from "../../components/steps/ConnectStep";
import FileSelectStep from "./FileSelectStep";
import InstallStep from "./InstallStep";
import SummaryStep from "./SummaryStep";
import type { WizardConfig, WizardContext } from "../../components/Wizard";
import { enterESPBootloader } from "../../lib/esp-utils";
import { downloadLatestESPFirmware } from "../../lib/esp-firmware-download";
import { ESPLoader, Transport, type FlashOptions, type LoaderOptions } from "esptool-js";

export type ESPFirmwareOption =
	| { type: "latest-esp" };

export interface UpdateESPFirmwareState {
	selectedFirmware: ESPFirmwareOption | null;
	isInstalling: boolean;
	progress: number;
	installResult: "success" | "error" | null;
	errorMessage: string;
	downloadedFirmwareName: string | null;
	downloadedFirmwareData: Uint8Array | null;
	currentSubStep: number; // 0: download, 1: enter bootloader & ESP32 connection, 2: install
	isDownloading: boolean;
	isEnteringBootloader: boolean;
}

async function handleInstallStepEntry(context: WizardContext<UpdateESPFirmwareState>): Promise<void> {
	const { installResult, isInstalling, selectedFirmware } = context.state;

	// Don't start if already installing or if there's already a result
	if (isInstalling || installResult !== null) {
		return;
	}

	if (!selectedFirmware) {
		context.setState((prev) => ({
			...prev,
			installResult: "error",
			errorMessage: "No firmware selected",
		}));
		context.goToStep("Summary");
		return;
	}

	// Start the installation process
	try {
		context.setState((prev) => ({
			...prev,
			isInstalling: true,
			progress: 0,
			installResult: null,
			errorMessage: "",
			currentSubStep: 0,
			isDownloading: true,
		}));

		// Download latest ESP firmware
		if (selectedFirmware.type === "latest-esp") {
			try {
				const downloaded = await downloadLatestESPFirmware();
				const fileName = downloaded.fileName;
				const firmwareData = downloaded.data;
				context.setState(prev => ({
					...prev,
					downloadedFirmwareName: fileName,
					downloadedFirmwareData: firmwareData,
					currentSubStep: 1,
					isDownloading: false,
					isEnteringBootloader: true,
				}));
			} catch (error) {
				console.error("Failed to download latest ESP firmware:", error);
				context.setState(prev => ({
					...prev,
					isInstalling: false,
					installResult: "error",
					errorMessage: `Failed to download latest ESP firmware: ${error instanceof Error ? error.message : String(error)}`,
				}));
				context.goToStep("Summary");
				return;
			}
		} else {
			context.setState(prev => ({
				...prev,
				isInstalling: false,
				installResult: "error",
				errorMessage: "Unknown firmware option selected",
			}));
			context.goToStep("Summary");
			return;
		}

		// Enter ESP bootloader
		try {
			context.setState(prev => ({
				...prev,
				currentSubStep: 1,
				isDownloading: false,
				isEnteringBootloader: true,
			}));

			const bootloaderSuccess = await enterESPBootloader(context.serialPort!);
			if (!bootloaderSuccess) {
				context.setState(prev => ({
					...prev,
					isInstalling: false,
					installResult: "error",
					errorMessage: "Failed to enter ESP bootloader mode",
				}));
				context.goToStep("Summary");
				return;
			}

			// ESP bootloader mode disconnects the original serial port
			// Update the context to reflect this
			await context.onDisconnect?.();

			context.setState(prev => ({
				...prev,
				isEnteringBootloader: false,
			}));

			// Now we wait for user to connect ESP32 port
			// The UI will show ESP32 connection interface at currentSubStep 1
		} catch (error) {
			console.error("Failed to enter ESP bootloader:", error);
			context.setState(prev => ({
				...prev,
				isInstalling: false,
				installResult: "error",
				errorMessage: "Failed to enter ESP bootloader mode",
			}));
			context.goToStep("Summary");
			return;
		}

		// For now, don't automatically navigate to summary - wait for ESP32 connection
	} catch (error) {
		context.setState((prev) => ({
			...prev,
			isInstalling: false,
			progress: 0,
			installResult: "error",
			errorMessage: `Unexpected error: ${error}`,
		}));
		context.goToStep("Summary");
	}
}

export async function flashESPFirmware(context: WizardContext<UpdateESPFirmwareState>): Promise<void> {
	const {serialPort, connectionType, state: { downloadedFirmwareData} } = context;

	if (!downloadedFirmwareData || !serialPort || connectionType !== 'esp32') {
		throw new Error("Missing firmware data or ESP serial port");
	}

	let transport: Transport | undefined;
	try {
		// Create transport for esptool-js
		transport = new Transport(serialPort, true);
		const loaderOptions: LoaderOptions = {
			transport,
			baudrate: 115200,
			romBaudrate: 115200,
			enableTracing: false,
			debugLogging: false,
		};
		const esploader = new ESPLoader(loaderOptions);

		// Connect to ESP
		await esploader.main();

		// Set progress callback
		const progressCallback = (_fileIndex: number, written: number, total: number) => {
			const progress = Math.round((written / total) * 100);
			context.setState(prev => ({ ...prev, progress }));
		};

		// Flash firmware at offset 0 as specified in requirements
		const flashOptions: FlashOptions = {
			fileArray: [{
				data: esploader.ui8ToBstr(downloadedFirmwareData),
				address: 0,
			}],
			flashSize: "keep",
			flashMode: "keep",
			flashFreq: "keep",
			eraseAll: false,
			compress: true,
			reportProgress: progressCallback,
		};

		await esploader.writeFlash(flashOptions);

		// Reset the ESP
		await esploader.after();

		context.setState((prev) => ({
			...prev,
			isInstalling: false,
			progress: 100,
			installResult: "success",
			errorMessage: "",
		}));
	} catch (error) {
		console.error("Failed to flash ESP firmware:", error);
		context.setState((prev) => ({
			...prev,
			isInstalling: false,
			progress: 0,
			installResult: "error",
			errorMessage: `Failed to install ESP firmware: ${error instanceof Error ? error.message : String(error)}`,
		}));
		throw error;
	} finally {
		await transport?.disconnect().catch(() => {});
		await context.onDisconnect?.();
	}
}

export const updateESPFirmwareWizardConfig: WizardConfig<UpdateESPFirmwareState> = {
	id: "update-esp",
	title: "Update ESP Firmware",
	description:
		"Update the ESP bridge firmware on your ZWA-2.",
	icon: CpuChipIcon,
	iconForeground: "text-purple-700 dark:text-purple-400",
	iconBackground: "bg-purple-50 dark:bg-purple-500/10",
	createInitialState: () => ({
		selectedFirmware: null,
		isInstalling: false,
		progress: 0,
		installResult: null,
		errorMessage: "",
		downloadedFirmwareName: null,
		downloadedFirmwareData: null,
		currentSubStep: 0,
		isDownloading: false,
		isEnteringBootloader: false,
		espSerialPort: null,
	}),
	steps: [
		{
			name: "Connect",
			component: ConnectStep<UpdateESPFirmwareState>,
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
			component: InstallStep,
			onEnter: handleInstallStepEntry,
			blockBrowserNavigation: (context) => context.state.isInstalling,
		},
		{
			name: "Summary",
			component: SummaryStep,
			isFinal: true,
			navigationButtons: {
				next: {
					label: "Finish",
					beforeNavigate: async (context) => {
						// Disconnect the ESP32 serial port when finishing the wizard
						if (context.onDisconnect) {
							await context.onDisconnect();
						}
						return true;
					},
				},
			},
		},
	],
};
