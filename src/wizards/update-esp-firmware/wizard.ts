import { CpuChipIcon } from "@heroicons/react/24/outline";
import ConnectStep from "../../components/steps/ConnectStep";
import FileSelectStep from "./FileSelectStep";
import InstallStep from "./InstallStep";
import SummaryStep from "./SummaryStep";
import type { WizardConfig, WizardContext } from "../../components/Wizard";
import { enterESPBootloader } from "../../lib/esp-utils";
import { downloadLatestESPFirmware, type ESPFirmwareReleaseInfo } from "../../lib/esp-firmware-download";
import { ESPLoader, Transport, type FlashOptions, type LoaderOptions } from "esptool-js";

/**
 * Simple version comparison for semantic versions (e.g., v2025.09.1)
 * @param current The current version string
 * @param latest The latest version string
 * @returns true if latest is newer than current
 */
function isVersionNewer(current: string, latest: string): boolean {
	// Remove 'v' prefix if present and normalize
	const normalize = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
	const currentParts = normalize(current);
	const latestParts = normalize(latest);

	// Pad arrays to same length
	const maxLength = Math.max(currentParts.length, latestParts.length);
	while (currentParts.length < maxLength) currentParts.push(0);
	while (latestParts.length < maxLength) latestParts.push(0);

	for (let i = 0; i < maxLength; i++) {
		if (latestParts[i] > currentParts[i]) return true;
		if (latestParts[i] < currentParts[i]) return false;
	}
	return false; // They are equal
}

/**
 * Parse ESP version info response to extract version
 * @param versionInfo The raw version info string from ESP
 * @returns Extracted version string or null if not found
 */
function parseESPVersion(versionInfo: string): string | null {
	// Look for version patterns like "v2025.09.1", "2025.09.1", or "version 2025.09.1"
	const versionMatch = versionInfo.match(/(?:version\s+)?v?(\d{4}\.\d{2}\.\d+)/i);
	return versionMatch ? versionMatch[1] : null;
}

export type ESPFirmwareOption =
	| { type: "latest-esp"; version?: string };

export interface UpdateESPFirmwareState {
	selectedFirmware: ESPFirmwareOption | null;
	isInstalling: boolean;
	progress: number;
	installResult: "success" | "error" | "no-update-needed" | null;
	errorMessage: string;
	downloadedFirmwareName: string | null;
	downloadedFirmwareData: Uint8Array | null;
	currentSubStep: number; // 0: download, 1: enter bootloader & ESP32 connection, 2: install
	isDownloading: boolean;
	isEnteringBootloader: boolean;
	latestESPFirmwareInfo: ESPFirmwareReleaseInfo | null;
	isLoadingFirmwareInfo: boolean;
	currentESPVersion: string | null;
	bootloaderEntryFailed: boolean; // Track if automatic bootloader entry failed
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

			// Create version check callback for latest ESP firmware
			const versionCheckCallback = selectedFirmware.type === "latest-esp"
				? async (versionInfo: string): Promise<boolean> => {
					const currentVersion = parseESPVersion(versionInfo);
					context.setState(prev => ({ ...prev, currentESPVersion: currentVersion }));

					if (currentVersion && context.state.latestESPFirmwareInfo) {
						const needsUpdate = isVersionNewer(currentVersion, context.state.latestESPFirmwareInfo.version);
						if (!needsUpdate) {
							console.log(`ESP is already on latest version ${currentVersion}, no update needed`);
							context.setState(prev => ({
								...prev,
								isInstalling: false,
								installResult: "no-update-needed",
								errorMessage: "",
							}));
							return false; // Signal no update needed
						}
						console.log(`ESP version ${currentVersion} is older than ${context.state.latestESPFirmwareInfo.version}, update needed`);
					}
					return true; // Continue with the update
				}
				: undefined;

			const bootloaderResult = await enterESPBootloader(serialPort, versionCheckCallback);

			if (bootloaderResult === "no-update-needed") {
				// Version check determined no update is needed, go to summary
				console.log("No update needed, going to summary step");
				context.goToStep("Summary");
				return;
			} else if (bootloaderResult === "failed") {
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
	const { state: { downloadedFirmwareData } } = context;
	const serialPort = context.connectionState.status === 'connected' ? context.connectionState.port : null;
	const connectionType = context.connectionState.status !== 'disconnected' ? context.connectionState.type : null;

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
	title: "Update ESP firmware",
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
		latestESPFirmwareInfo: null,
		isLoadingFirmwareInfo: false,
		currentESPVersion: null,
		bootloaderEntryFailed: false,
	}),
	steps: [
		{
			name: "Connect",
			component: ConnectStep<UpdateESPFirmwareState>,
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
					label: "Install",
					disabled: (context) => !context.state.selectedFirmware ||
						(context.state.selectedFirmware?.type === "latest-esp" && context.state.isLoadingFirmwareInfo),
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
