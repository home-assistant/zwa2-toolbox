import { CpuChipIcon } from "@heroicons/react/24/outline";
import FileSelectStep from "./FileSelectStep";
import InstallStep from "./InstallStep";
import ConfigureStep from "./ConfigureStep";
import SummaryStep from "./SummaryStep";
import ESPConnectStep from "./ESPConnectStep";
import type { WizardConfig, WizardContext, WizardStepProps } from "../../components/Wizard";
import { enterESPBootloader, ESP32_DEVICE_FILTERS } from "../../lib/esp-utils";
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
	usb_bridge: {
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
		wifi: true,
	},
};

export interface ESPFirmwareManifest {
	label: string;
	description: string;
	manifestUrl: string;
	experimental?: boolean;
	changelogUrl?: (version: string) => string;
	wifi?: boolean;
}

export type InstallState =
	| { status: "idle" }
	| { status: "downloading"; firmwareLabel: string }
	| { status: "entering-bootloader" }
	| {
		// This step is used to temporarily store the firmware
		// when user interaction is needed to continue
		status: "waiting-for-esp32";
		bootloaderEntryFailed: boolean;
		firmwareData: Uint8Array;
		firmwareOffset: number;
		firmwareLabel: string;
	}
	| { status: "installing"; progress: number; firmwareLabel: string }
	| { status: "waiting-for-power-cycle"; firmwareLabel: string }
	| { status: "success"; firmwareLabel: string }
	| { status: "error"; errorMessage: string };

export type ESPFirmwareOption =
	| { type: "manifest"; manifestId: string; version?: string; label?: string; wifi?: boolean; manifestUrl?: string };

export type ConfigureState =
	| { status: "idle" }
	| { status: "waiting-for-startup" }
	| { status: "ready" }
	| { status: "provisioning"; ssid: string }
	| { status: "success"; ssid: string }
	| { status: "error"; errorMessage: string; previouslyFailed?: boolean }
	| { status: "skipped" };

export interface UpdateESPFirmwareState {
	selectedFirmware: ESPFirmwareOption | null;
	installState: InstallState;
	configureState: ConfigureState;
	deviceType: 'zwa2' | 'esp32' | 'unknown' | null; // Track detected device type
}

export interface UpdateESPFirmwareLabels {
	// Configurable labels for different hardware
	/** How the device should be called standalone */
	deviceName: string;
	/**
	 * How the device should be called when referring to the strings in the serial port selector.
	 * Empty string ("") skips the text.
	 */
	serialportLabel: string;
	/**
	 * How the ESP chip variant should be called when referring to the serial port selector.
	 */
	espVariant: string;
}

export type UpdateESPFirmwareWizardStepProps = WizardStepProps<UpdateESPFirmwareState, UpdateESPFirmwareLabels>;

export async function flashESPFirmwareWithData(
	context: WizardContext<UpdateESPFirmwareState>,
	firmwareData: Uint8Array,
	firmwareOffset: number,
	onProgress?: (progress: number) => void
): Promise<void> {
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
			onProgress?.(progress);
		};

		// Flash firmware at the offset specified in the manifest
		const flashOptions: FlashOptions = {
			fileArray: [{
				data: firmwareData,
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

		// Reset the ESP - this will trigger a restart but not disconnect yet
		await esploader.after();
	} catch (error) {
		console.error("Failed to flash ESP firmware:", error);
		throw error;
	} finally {
		await transport?.disconnect().catch(() => {});
		// Note: We no longer disconnect here - the power-cycle substep will handle monitoring
	}
}

export async function enterBootloaderMode(context: WizardContext<UpdateESPFirmwareState>): Promise<'success' | 'failed' | 'no-update-needed'> {
	const serialPort = context.connectionState.status === 'connected' ? context.connectionState.port : null;
	if (!serialPort) {
		throw new Error("No serial port connected");
	}

	const bootloaderResult = await enterESPBootloader(serialPort);

	// ESP bootloader mode disconnects the original serial port
	// Update the context to reflect this
	await context.onDisconnect?.();

	return bootloaderResult;
}

async function handleInstallStepEntry(context: WizardContext<UpdateESPFirmwareState>): Promise<void> {
	const { selectedFirmware, deviceType, installState } = context.state;

	// Don't start if already in progress or completed
	if (installState.status !== "idle") {
		return;
	}

	if (!selectedFirmware) {
		context.setState((prev) => ({
			...prev,
			installState: { status: "error", errorMessage: "No firmware selected" },
		}));
		context.goToStep("Summary");
		return;
	}

	// Start the installation process
	try {
		// Step 1: Download firmware
		const firmwareLabel = selectedFirmware.label ||
			(selectedFirmware.type === "manifest" ? ESP_FIRMWARE_MANIFESTS[selectedFirmware.manifestId]?.label : undefined) ||
			"firmware";

		context.setState((prev) => ({
			...prev,
			installState: { status: "downloading", firmwareLabel },
		}));

		let firmwareData: Uint8Array;
		let firmwareOffset: number;

		if (selectedFirmware.type === "manifest") {
			// Use custom manifest URL if provided, otherwise look up from predefined manifests
			let manifestUrl: string;
			let changelogUrl: ((version: string) => string) | undefined;

			if (selectedFirmware.manifestUrl) {
				// Custom manifest URL provided (e.g., from web component props)
				manifestUrl = selectedFirmware.manifestUrl;
			} else {
				// Look up from predefined manifests
				const manifestConfig = ESP_FIRMWARE_MANIFESTS[selectedFirmware.manifestId];
				if (!manifestConfig) {
					throw new Error(`Unknown manifest ID: ${selectedFirmware.manifestId}`);
				}
				manifestUrl = manifestConfig.manifestUrl;
				changelogUrl = manifestConfig.changelogUrl;
			}

			const { fetchManifestFirmwareInfo, downloadFirmware } = await import("../../lib/esp-firmware-download");
			const firmwareInfo = await fetchManifestFirmwareInfo(manifestUrl, changelogUrl);
			firmwareData = await downloadFirmware(firmwareInfo.downloadUrl);
			firmwareOffset = firmwareInfo.offset;
		} else {
			throw new Error("Unknown firmware option selected");
		}

		// Step 2: Enter bootloader mode (if needed for ZWA-2)
		if (deviceType === 'esp32') {
			// ESP32 is already in bootloader mode, skip to install
			console.log("ESP32 already in bootloader mode, proceeding directly to flashing");

			context.setState((prev) => ({
				...prev,
				installState: { status: "installing", progress: 0, firmwareLabel },
			}));

			const onProgress = (progress: number) => {
				context.setState((prev) => ({
					...prev,
					installState: { status: "installing", progress, firmwareLabel },
				}));
			};

			await flashESPFirmwareWithData(context, firmwareData, firmwareOffset, onProgress);
			// Transition to power-cycle substep
			context.setState((prev) => ({
				...prev,
				installState: { status: "waiting-for-power-cycle", firmwareLabel },
			}));
			return;
		} else if (deviceType === 'zwa2') {
			// ZWA-2 needs to enter bootloader mode
			context.setState((prev) => ({
				...prev,
				installState: { status: "entering-bootloader" },
			}));

			const bootloaderResult = await enterBootloaderMode(context);

			const bootloaderEntryFailed = bootloaderResult === "failed";
			context.setState((prev) => ({
				...prev,
				installState: {
					status: "waiting-for-esp32",
					bootloaderEntryFailed,
					firmwareData,
					firmwareOffset,
					firmwareLabel,
				},
			}));

			// For ZWA-2, we wait here - the user needs to connect ESP32 manually
			// The InstallStep component will handle requesting the connection
			// and trigger continueInstallationAfterESP32Connect when ready
			return;
		}
	} catch (error) {
		console.error("Installation error:", error);
		context.setState((prev) => ({
			...prev,
			installState: {
				status: "error",
				errorMessage: error instanceof Error ? error.message : String(error)
			},
		}));
		context.goToStep("Summary");
	}
}

async function handleConnectStepBeforeNavigate(context: WizardContext<UpdateESPFirmwareState>): Promise<boolean> {
	// Handle device detection for ESP firmware update
	const connectionState = context.connectionState;
	if (connectionState.status === 'connected') {
		// Determine device type based on connection type
		let deviceType: 'zwa2' | 'esp32' | 'unknown' = 'unknown';

		if (connectionState.type === 'zwa2') {
			deviceType = 'zwa2';
		} else if (connectionState.type === 'esp32') {
			deviceType = 'esp32';
		}

		// Update wizard state with device detection results
		context.setState(prev => ({
			...prev,
			deviceType,
		}));
	}

	return await context.afterConnect();
}

function blockNavigationDuringInstall(context: WizardContext<UpdateESPFirmwareState>): boolean {
	const { installState } = context.state;
	// Block navigation during critical operations: downloading, entering bootloader, or installing
	return installState.status === "downloading" ||
		installState.status === "entering-bootloader" ||
		installState.status === "installing";
}

async function handleConfigureStepEntry(context: WizardContext<UpdateESPFirmwareState>): Promise<void> {
	// Check if WiFi configuration is supported by the selected firmware
	const { selectedFirmware, installState, configureState } = context.state;

	// Only allow configuration if installation was successful
	if (installState.status !== "success") {
		context.setState((prev) => ({
			...prev,
			configureState: { status: "skipped" },
		}));
		context.goToStep("Summary");
		return;
	}

	// Check if the selected firmware supports WiFi configuration
	if (!selectedFirmware?.wifi) {
		// Skip this step if firmware doesn't support WiFi
		context.setState((prev) => ({
			...prev,
			configureState: { status: "skipped" },
		}));
		context.goToStep("Summary");
		return;
	}

	// If we're already in ready or error state (user came back to retry), don't wait again
	if (configureState.status === "ready" || configureState.status === "error") {
		return;
	}

	// Set waiting-for-startup state
	context.setState((prev) => ({
		...prev,
		configureState: { status: "waiting-for-startup" },
	}));

	// Wait 10 seconds to give the firmware time to start and scan WiFi networks
	const { wait } = await import("alcalzone-shared/async");
	await wait(10000);

	// Transition to ready state
	context.setState((prev) => ({
		...prev,
		configureState: { status: "ready" },
	}));

	// Note: We no longer disconnect here - improv-wifi will manage its own connection
}

async function handleConfigureStepSkip(context: WizardContext<UpdateESPFirmwareState>): Promise<boolean> {
	// Mark as skipped when user clicks Skip
	context.setState((prev) => ({
		...prev,
		configureState: { status: "skipped" },
	}));
	return true;
}

async function handleSummaryStepFinish(context: WizardContext<UpdateESPFirmwareState>): Promise<boolean> {
	// Disconnect the ESP32 serial port when finishing the wizard
	if (context.onDisconnect) {
		await context.onDisconnect();
	}
	return true;
}

// Navigation button configurations
const connectStepButtons = {
	next: {
		label: "Next",
		disabled: (context: WizardContext<UpdateESPFirmwareState>) => context.connectionState.status !== 'connected',
		beforeNavigate: handleConnectStepBeforeNavigate,
	},
	cancel: {
		label: "Cancel",
	},
};

const fileSelectStepButtons = {
	next: {
		label: "Install",
		disabled: (context: WizardContext<UpdateESPFirmwareState>) => !context.state.selectedFirmware,
	},
	back: {
		label: "Back",
	},
	cancel: {
		label: "Cancel",
	},
};

const configureStepButtons = {
	next: {
		label: "Skip",
		beforeNavigate: handleConfigureStepSkip,
		disabled: (context: WizardContext<UpdateESPFirmwareState>) => context.state.configureState.status === 'waiting-for-startup'
	},
};

const summaryStepButtons = {
	next: {
		label: "Finish",
		beforeNavigate: handleSummaryStepFinish,
	},
};

export const updateESPFirmwareWizardConfig: WizardConfig<UpdateESPFirmwareState, UpdateESPFirmwareLabels> = {
	id: "update-esp",
	title: "Update ESP firmware",
	description:
		"Update the ESP firmware on your ZWA-2.",
	icon: CpuChipIcon,
	iconForeground: "text-purple-700 dark:text-purple-400",
	iconBackground: "bg-purple-50 dark:bg-purple-500/10",
	createInitialState: () => ({
		selectedFirmware: null,
		installState: { status: "idle" },
		configureState: { status: "idle" },
		deviceType: null,
	}),
	labels: {
		deviceName: "ZWA-2",
		serialportLabel: "ZWA-2",
		espVariant: "ESP32-S3",
	},
	steps: [
		{
			name: "Connect",
			component: ESPConnectStep,
			navigationButtons: connectStepButtons,
		},
		{
			name: "Select firmware",
			component: FileSelectStep,
			navigationButtons: fileSelectStepButtons,
		},
		{
			name: "Install firmware",
			component: InstallStep,
			onEnter: handleInstallStepEntry,
			blockBrowserNavigation: blockNavigationDuringInstall,
		},
		{
			name: "Configure",
			component: ConfigureStep,
			onEnter: handleConfigureStepEntry,
			navigationButtons: configureStepButtons,
		},
		{
			name: "Summary",
			component: SummaryStep,
			isFinal: true,
			navigationButtons: summaryStepButtons,
		},
	],
};

// Specialized wizard for updating ESP Bridge firmware only
export const installESPBridgeFirmwareWizardConfig: WizardConfig<UpdateESPFirmwareState, UpdateESPFirmwareLabels> = {
	id: "update-esp-bridge",
	title: "Install USB Bridge firmware",
	description:
		"The default firmware that comes pre-installed on the ZWA-2.",
	icon: CpuChipIcon,
	iconForeground: "text-blue-700 dark:text-blue-400",
	iconBackground: "bg-blue-50 dark:bg-blue-500/10",
	standalone: true,
	createInitialState: () => {
		const manifestId = "usb_bridge";
		const manifest = ESP_FIRMWARE_MANIFESTS[manifestId];
		return {
			selectedFirmware: {
				type: "manifest",
				manifestId,
				label: manifest.label,
			},
			installState: { status: "idle" },
			configureState: { status: "idle" },
			deviceType: null,
		};
	},
	labels: {
		deviceName: "ZWA-2",
		serialportLabel: "ZWA-2",
		espVariant: "ESP32-S3",
	},
	steps: [
		{
			name: "Connect",
			component: ESPConnectStep,
			navigationButtons: connectStepButtons,
		},
		{
			name: "Install firmware",
			component: InstallStep,
			onEnter: handleInstallStepEntry,
			blockBrowserNavigation: blockNavigationDuringInstall,
		},
		{
			name: "Summary",
			component: SummaryStep,
			isFinal: true,
			navigationButtons: summaryStepButtons,
		},
	],
};

// Specialized wizard for updating ESPHome (Portable Z-Wave) firmware only
export const installESPHomeFirmwareWizardConfig: WizardConfig<UpdateESPFirmwareState, UpdateESPFirmwareLabels> = {
	id: "install-esphome",
	title: "Install Portable Z-Wave firmware",
	description:
		"Allows connecting to ZWA-2 via WiFi.",
	icon: CpuChipIcon,
	iconForeground: "text-blue-700 dark:text-blue-400",
	iconBackground: "bg-blue-50 dark:bg-blue-500/10",
	standalone: true,
	createInitialState: () => {
		const manifest = ESP_FIRMWARE_MANIFESTS.esphome;
		return {
			selectedFirmware: {
				type: "manifest",
				manifestId: "esphome",
				label: manifest.label,
				wifi: true,
			},
			installState: { status: "idle" },
			configureState: { status: "idle" },
			deviceType: null,
		};
	},
	// ESPHome wizard always uses default ZWA-2 labels
	labels: {
		deviceName: "ZWA-2",
		serialportLabel: "ZWA-2",
		espVariant: "ESP32-S3",
	},
	steps: [
		{
			name: "Connect",
			component: ESPConnectStep,
			navigationButtons: connectStepButtons,
		},
		{
			name: "Install firmware",
			component: InstallStep,
			onEnter: handleInstallStepEntry,
			blockBrowserNavigation: blockNavigationDuringInstall,
		},
		{
			name: "Configure",
			component: ConfigureStep,
			onEnter: handleConfigureStepEntry,
			navigationButtons: configureStepButtons,
		},
		{
			name: "Summary",
			component: SummaryStep,
			isFinal: true,
			navigationButtons: summaryStepButtons,
		},
	],
};
