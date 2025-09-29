import { CpuChipIcon } from "@heroicons/react/24/outline";
import FileSelectStep from "./FileSelectStep";
import InstallStep from "./InstallStep";
import SummaryStep from "./SummaryStep";
import ESPConnectStep from "./ESPConnectStep";
import type { WizardConfig, WizardContext } from "../../components/Wizard";
import { enterESPBootloader, ESP32_DEVICE_FILTERS } from "../../lib/esp-utils";
import { fetchManifestFirmwareInfo, downloadFirmware, type ESPFirmwareReleaseInfo } from "../../lib/esp-firmware-download";
import { ESPLoader, Transport, type FlashOptions, type LoaderOptions } from "esptool-js";
import { ZWA2_DEVICE_FILTERS } from "../../lib/zwave";

/**
 * Combined device filters that accept both ZWA-2 and ESP32 devices
 * This allows connecting to the device whether it's in normal mode or bootloader mode
 */
export const COMBINED_DEVICE_FILTERS = [
	...ZWA2_DEVICE_FILTERS,
	...ESP32_DEVICE_FILTERS,
];

/**
 * Available ESP firmware manifests
 */
export const ESP_FIRMWARE_MANIFESTS: Record<string, ESPFirmwareManifest> = {
	usb: {
		label: "USB Bridge",
		description: "The default firmware that comes pre-installed on the ZWA-2.",
		manifestUrl: "https://firmware.esphome.io/ha-connect-zwa-2/zwave-esp-bridge/manifest.json",
		changelogUrl: (version: string) => `https://github.com/NabuCasa/zwave-esp-bridge/releases/tag/${version}`,
	},
	esphome: {
		label: "Portable Z-Wave",
		description: "Allows connecting to ZWA-2 via WiFi",
		manifestUrl: "https://firmware.esphome.io/ha-connect-zwa-2/home-assistant-zwa-2/manifest.json",
		experimental: true,
	},
};





export interface ESPFirmwareManifest {
	label: string;
	description: string;
	manifestUrl: string;
	experimental?: boolean;
	changelogUrl?: (version: string) => string;
}

export type ESPFirmwareOption =
	| { type: "manifest"; manifestId: string; version?: string };

export interface UpdateESPFirmwareState {
	selectedFirmware: ESPFirmwareOption | null;
	isInstalling: boolean;
	progress: number;
	installResult: "success" | "error" | null;
	errorMessage: string;
	downloadedFirmwareName: string | null;
	downloadedFirmwareData: Uint8Array | null;
	downloadedFirmwareOffset: number;
	currentSubStep: number; // 0: download, 1: enter bootloader & ESP32 connection, 2: install
	isDownloading: boolean;
	isEnteringBootloader: boolean;
	manifestInfo: Record<string, ESPFirmwareReleaseInfo> | null;
	isLoadingManifestInfo: boolean;
	bootloaderEntryFailed: boolean; // Track if automatic bootloader entry failed
	detectedDeviceType: 'zwa2' | 'esp32' | 'unknown' | null; // Track detected device type
	needsBootloaderMode: boolean; // Whether we need to enter bootloader mode
}

async function handleInstallStepEntry(context: WizardContext<UpdateESPFirmwareState>): Promise<void> {
	const { installResult, isInstalling, selectedFirmware, detectedDeviceType, needsBootloaderMode } = context.state;

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

		// Download ESP firmware based on selected type
		if (selectedFirmware.type === "manifest") {
			try {
				const manifestConfig = ESP_FIRMWARE_MANIFESTS[selectedFirmware.manifestId];
				if (!manifestConfig) {
					throw new Error(`Unknown manifest ID: ${selectedFirmware.manifestId}`);
				}

				// First fetch firmware info to get download URL and metadata
				const firmwareInfo = await fetchManifestFirmwareInfo(manifestConfig.manifestUrl, manifestConfig.changelogUrl);

				// Then download the actual firmware
				const firmwareData = await downloadFirmware(firmwareInfo.downloadUrl);

				const fileName = firmwareInfo.fileName;
				const firmwareOffset = firmwareInfo.offset;

				// Update state with downloaded firmware data
				context.setState(prev => ({
					...prev,
					downloadedFirmwareName: fileName,
					downloadedFirmwareData: firmwareData,
					downloadedFirmwareOffset: firmwareOffset,
					currentSubStep: 1,
					isDownloading: false,
					isEnteringBootloader: needsBootloaderMode,
				}));

				// Check if we need to enter bootloader mode or if we can proceed directly
				if (detectedDeviceType === 'esp32' && !needsBootloaderMode) {
					// ESP32 is already in bootloader mode, skip the bootloader entry step
					console.log("ESP32 already in bootloader mode, proceeding directly to flashing");

					// Update state to reflect flashing step
					context.setState(prev => ({
						...prev,
						currentSubStep: 2,
						isEnteringBootloader: false,
					}));

					// Start flashing immediately with the firmware data we just downloaded
					try {
						await flashESPFirmwareWithData(context, firmwareData, firmwareOffset);
					} catch (error) {
						console.error("Failed to flash ESP firmware:", error);
					} finally {
						context.goToStep("Summary");
					}
					return;
				}

			} catch (error) {
				console.error("Failed to download manifest firmware:", error);
				context.setState(prev => ({
					...prev,
					isInstalling: false,
					installResult: "error",
					errorMessage: `Failed to download firmware: ${error instanceof Error ? error.message : String(error)}`,
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

		// For ZWA-2 devices, enter ESP bootloader
		try {
			context.setState(prev => ({
				...prev,
				currentSubStep: 1,
				isDownloading: false,
				isEnteringBootloader: true,
			}));

			const serialPort = context.connectionState.status === 'connected' ? context.connectionState.port : null;
			if (!serialPort) {
				context.setState(prev => ({
					...prev,
					isInstalling: false,
					installResult: "error",
					errorMessage: "No serial port connected",
				}));
				context.goToStep("Summary");
				return;
			}

			const bootloaderResult = await enterESPBootloader(serialPort);

			if (bootloaderResult === "failed") {
				// Bootloader entry failed, but continue to ESP connection step with warning
				console.log("Bootloader entry failed, showing manual entry instructions");
				context.setState(prev => ({
					...prev,
					isEnteringBootloader: false,
					bootloaderEntryFailed: true,
				}));

				// Update the context to reflect disconnection
				await context.onDisconnect?.();
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
	const { state: { downloadedFirmwareData, downloadedFirmwareOffset } } = context;
	const serialPort = context.connectionState.status === 'connected' ? context.connectionState.port : null;
	const connectionType = context.connectionState.status !== 'disconnected' ? context.connectionState.type : null;

	if (!downloadedFirmwareData || !serialPort || connectionType !== 'esp32') {
		throw new Error("Missing firmware data or ESP serial port");
	}

	return flashESPFirmwareWithData(context, downloadedFirmwareData, downloadedFirmwareOffset);
}

export async function flashESPFirmwareWithData(context: WizardContext<UpdateESPFirmwareState>, firmwareData: Uint8Array, firmwareOffset: number): Promise<void> {
	const serialPort = context.connectionState.status === 'connected' ? context.connectionState.port : null;
	const connectionType = context.connectionState.status !== 'disconnected' ? context.connectionState.type : null;

	if (!firmwareData || !serialPort || connectionType !== 'esp32') {
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

		// Close the serial port. ESPLoader expects to open it itself.
		if (serialPort.readable || serialPort.writable) {
			await serialPort.close();
		}

		// Connect to ESP
		await esploader.main();

		// Set progress callback
		const progressCallback = (_fileIndex: number, written: number, total: number) => {
			const progress = Math.round((written / total) * 100);
			context.setState(prev => ({ ...prev, progress }));
		};

		// Flash firmware at the offset specified in the manifest
		const flashOptions: FlashOptions = {
			fileArray: [{
				data: esploader.ui8ToBstr(firmwareData),
				address: firmwareOffset,
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
			errorMessage: `Failed to install firmware: ${error instanceof Error ? error.message : String(error)}`,
		}));
		throw error;
	} finally {
		await transport?.disconnect().catch(() => {});
		await context.onDisconnect?.();
	}
}

export const updateESPFirmwareWizardConfig: WizardConfig<UpdateESPFirmwareState> = {
	id: "update-esp",
	title: "Update ESP firmware",
	description:
		"Update the ESP firmware on your ZWA-2.",
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
		downloadedFirmwareOffset: 0,
		currentSubStep: 0,
		isDownloading: false,
		isEnteringBootloader: false,
		manifestInfo: null,
		isLoadingManifestInfo: false,
		bootloaderEntryFailed: false,
		detectedDeviceType: null,
		needsBootloaderMode: false,
	}),
	steps: [
		{
			name: "Connect",
			component: ESPConnectStep,
			navigationButtons: {
				next: {
					label: "Next",
					disabled: (context) => context.connectionState.status !== 'connected',
					beforeNavigate: async (context) => {
						// Handle device detection for ESP firmware update
						const connectionState = context.connectionState;
						if (connectionState.status === 'connected') {
							// Determine device type based on connection type and set appropriate state
							let detectedDeviceType: 'zwa2' | 'esp32' | 'unknown' = 'unknown';
							let needsBootloaderMode = false;

							if (connectionState.type === 'zwa2') {
								detectedDeviceType = 'zwa2';
								needsBootloaderMode = true; // ZWA-2 needs to enter bootloader mode
							} else if (connectionState.type === 'esp32') {
								detectedDeviceType = 'esp32';
								needsBootloaderMode = false; // ESP32 is already in bootloader mode
							}

							// Update wizard state with device detection results
							context.setState(prev => ({
								...prev,
								detectedDeviceType,
								needsBootloaderMode,
							}));
						}

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
					disabled: (context) => !context.state.selectedFirmware ||
						(context.state.selectedFirmware?.type === "manifest" && context.state.isLoadingManifestInfo),
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
