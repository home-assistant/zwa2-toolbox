import { CloudArrowDownIcon } from "@heroicons/react/24/outline";
import ConnectStep from "../../components/steps/ConnectStep";
import ConfigureStep from "./ConfigureStep";
import FileSelectStep from "./FileSelectStep";
import FlashStep from "./FlashStep";
import SummaryStep from "./SummaryStep.tsx";
import type {
	WizardConfig,
	WizardContext,
	WizardStepProps,
} from "../../components/Wizard";
import {
	downloadLatestFirmware,
	type FirmwareType,
} from "../../lib/firmware-download";
import { DriverMode } from "zwave-js";
import {
	RFRegion,
	getLegalPowerlevelMesh,
	getLegalPowerlevelLR,
} from "@zwave-js/core/definitions";
import { type BytesView } from "@zwave-js/shared";

export type { FirmwareType } from "../../lib/firmware-download";

export type FirmwareOption =
	| { type: "latest-controller" }
	| { type: "latest-repeater" }
	| { type: "latest-zniffer" };

export interface InstallFirmwareState {
	selectedFirmware: FirmwareOption | null;
	isFlashing: boolean;
	progress: number;
	flashResult: "success" | "error" | null;
	errorMessage: string;
	downloadedFirmwareName: string | null;
	currentSubStep: number;
	isDownloading: boolean;
	detectedFirmwareType: FirmwareType | null;
	detectionState: "pending" | "detecting" | "done";
	dataLossConfirmed: boolean;
	dsk: string | null;
	selectedRegion: string | null;
	configureStatus: "idle" | "configuring" | "success" | "error" | "skipped";
	configureError: string | null;
}

export type InstallFirmwareWizardStepProps =
	WizardStepProps<InstallFirmwareState>;

export function firmwareTypeFromOption(option: FirmwareOption): FirmwareType {
	switch (option.type) {
		case "latest-controller":
			return "controller";
		case "latest-repeater":
			return "repeater";
		case "latest-zniffer":
			return "zniffer";
	}
}

export function needsDataLossWarning(
	detected: FirmwareType | null,
	target: FirmwareType,
): boolean {
	if (detected === target) return false;
	if (detected === null) return true; // Unknown — warn
	if (detected === "zniffer") return false; // Zniffer has no network data
	return true; // controller or repeater — has network data
}

export function needsNvmErase(
	detected: FirmwareType | null,
	target: FirmwareType,
): boolean {
	// Any type change requires NVM erase
	return detected !== target;
}

function getExpectedDriverMode(type: FirmwareType): DriverMode {
	switch (type) {
		case "controller":
			return DriverMode.SerialAPI;
		case "repeater":
			return DriverMode.CLI;
		case "zniffer":
			return DriverMode.Unknown;
	}
}

async function handleFileSelectStepEntry(
	context: WizardContext<InstallFirmwareState>,
): Promise<void> {
	if (context.state.detectionState !== "pending") return;

	context.setState((prev) => ({ ...prev, detectionState: "detecting" }));

	if (!context.zwaveBinding) {
		context.setState((prev) => ({ ...prev, detectionState: "done" }));
		return;
	}

	try {
		const detected = await context.zwaveBinding.detectFirmwareType();
		context.setState((prev) => ({
			...prev,
			detectedFirmwareType: detected === "unknown" ? null : detected,
			detectionState: "done",
		}));
	} catch {
		context.setState((prev) => ({ ...prev, detectionState: "done" }));
	}
}

const CLI_REGION_TO_RF_REGION: Record<string, RFRegion> = {
	EU: RFRegion.Europe,
	US: RFRegion.USA,
	ANZ: RFRegion["Australia/New Zealand"],
	HK: RFRegion["Hong Kong"],
	IN: RFRegion.India,
	IL: RFRegion.Israel,
	RU: RFRegion.Russia,
	CN: RFRegion.China,
	JP: RFRegion.Japan,
	KR: RFRegion.Korea,
};

async function handleConfigureStepEntry(
	context: WizardContext<InstallFirmwareState>,
): Promise<void> {
	const { flashResult, selectedFirmware, configureStatus } = context.state;

	// Don't re-run if already in progress or done
	if (configureStatus === "success" || configureStatus === "configuring") {
		return;
	}

	// Skip if flash failed or not repeater firmware
	if (
		flashResult !== "success" ||
		!selectedFirmware ||
		firmwareTypeFromOption(selectedFirmware) !== "repeater"
	) {
		context.setState((prev) => ({ ...prev, configureStatus: "skipped" }));
		context.goToStep("Summary");
		return;
	}
}

async function handleConfigureBeforeNavigate(
	context: WizardContext<InstallFirmwareState>,
): Promise<boolean> {
	const { selectedRegion, configureStatus } = context.state;

	if (configureStatus === "success") {
		return true;
	}

	if (!selectedRegion || !context.zwaveBinding) {
		return false;
	}

	// Show spinner
	context.setState((prev) => ({
		...prev,
		configureStatus: "configuring",
		configureError: null,
	}));

	try {
		const setSuccess = await context.zwaveBinding.setRegion(selectedRegion);
		if (!setSuccess) {
			context.setState((prev) => ({
				...prev,
				configureStatus: "error",
				configureError: "Failed to set RF region. Please try again.",
			}));
			return false;
		}

		// Wait for ZWA-2 to reboot
		const { wait } = await import("alcalzone-shared/async");
		await wait(1000);

		// Verify region
		const confirmedRegion = await context.zwaveBinding.getRegion();
		if (confirmedRegion !== selectedRegion) {
			context.setState((prev) => ({
				...prev,
				configureStatus: "error",
				configureError: `Region verification failed. Expected "${selectedRegion}" but got "${confirmedRegion ?? "unknown"}".`,
			}));
			return false;
		}

		// Configure power levels if legal limits are known for this region
		const rfRegion = CLI_REGION_TO_RF_REGION[selectedRegion];
		if (rfRegion != null) {
			const meshLimit = getLegalPowerlevelMesh(rfRegion);
			const lrLimit = getLegalPowerlevelLR(rfRegion);

			if (meshLimit != null || lrLimit != null) {
				// Get current power levels to preserve the adjust value
				const current =
					await context.zwaveBinding.getPowerlevel();
				if (current) {
					// Z-Wave JS returns dBm, CLI uses deci-dBm
					const newMeshMax =
						meshLimit != null
							? meshLimit * 10
							: current.txPowerMax;
					const newLRMax =
						lrLimit != null
							? lrLimit * 10
							: current.txPowerMaxLR;

					await context.zwaveBinding.setPowerlevel(
						newMeshMax,
						current.txPowerAdjust,
						newLRMax,
					);
				}
			}
		}

		context.setState((prev) => ({
			...prev,
			configureStatus: "success",
		}));
		return true;
	} catch (error) {
		context.setState((prev) => ({
			...prev,
			configureStatus: "error",
			configureError: `Unexpected error: ${error}`,
		}));
		return false;
	}
}

async function handleInstallStepEntry(
	context: WizardContext<InstallFirmwareState>,
): Promise<void> {
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

	if (!context.zwaveBinding) {
		context.setState((prev) => ({
			...prev,
			flashResult: "error",
			errorMessage: "No device connection",
		}));
		context.goToStep("Summary");
		return;
	}

	const targetType = firmwareTypeFromOption(selectedFirmware);
	const shouldEraseNvm = needsNvmErase(
		context.state.detectedFirmwareType,
		targetType,
	);

	// Start the installation process
	try {
		context.setState((prev) => ({
			...prev,
			isFlashing: true,
			progress: 0,
			flashResult: null,
			errorMessage: "",
			currentSubStep: 0,
			isDownloading: true,
		}));

		// Set up progress callback
		context.zwaveBinding.onProgress = (progress: number) => {
			context.setState((prev) => ({ ...prev, progress }));
		};

		// Initialize the ZWave driver so resetToBootloader() can use the Serial API
		// to enter bootloader. Skip for firmware types the Driver can't talk to.
		if (context.state.detectedFirmwareType !== "zniffer") {
			await context.zwaveBinding.initialize();
		}

		let fileName: string;
		let firmwareData: BytesView;

		// Download firmware
		try {
			const downloaded = await downloadLatestFirmware(targetType);
			fileName = downloaded.fileName;
			firmwareData = downloaded.data;
			context.setState((prev) => ({
				...prev,
				downloadedFirmwareName: fileName,
				currentSubStep: 1,
				isDownloading: false,
			}));
		} catch (error) {
			console.error("Failed to download firmware:", error);
			context.setState((prev) => ({
				...prev,
				isFlashing: false,
				flashResult: "error",
				errorMessage: "Failed to download firmware",
			}));
			context.goToStep("Summary");
			return;
		}

		// Enter bootloader before flashing. The driver is configured with
		// bootloaderMode: "stay", so after flashing we remain in bootloader
		// and can erase the NVM before starting the application.
		const bootloaderOk = await context.zwaveBinding.resetToBootloader();
		if (!bootloaderOk) {
			context.setState((prev) => ({
				...prev,
				isFlashing: false,
				flashResult: "error",
				errorMessage: "Failed to enter bootloader mode",
			}));
			context.goToStep("Summary");
			return;
		}

		// Flash the firmware (already in bootloader, stays in bootloader after)
		const success = await context.zwaveBinding.flashFirmware(
			fileName,
			firmwareData,
		);

		if (!success) {
			context.setState((prev) => ({
				...prev,
				isFlashing: false,
				progress: 0,
				flashResult: "error",
				errorMessage: "Failed to install firmware",
			}));
			context.goToStep("Summary");
			return;
		}

		// Erase NVM if switching firmware types (already in bootloader)
		if (shouldEraseNvm) {
			context.setState((prev) => ({ ...prev, currentSubStep: 2 }));
			const eraseSuccess = await context.zwaveBinding.eraseNVM();
			if (!eraseSuccess) {
				context.setState((prev) => ({
					...prev,
					isFlashing: false,
					flashResult: "error",
					errorMessage:
						"Firmware installed but NVM erase failed. The device may need manual recovery.",
				}));
				context.goToStep("Summary");
				return;
			}
		}

		// Start application and verify
		context.setState((prev) => ({ ...prev, currentSubStep: 3 }));
		await context.zwaveBinding.runApplication();

		if (targetType === "zniffer") {
			// Use the Zniffer class to verify — the Driver can't detect Zniffer firmware
			const znifferOk = await context.zwaveBinding.verifyZnifferFirmware();
			if (znifferOk) {
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
					errorMessage: "Firmware was installed but Zniffer verification failed",
				}));
			}
		} else {
			let mode = context.zwaveBinding.getDriverMode();
			if (mode !== getExpectedDriverMode(targetType)) {
				// leaveBootloader() transitions the mode in-place for CLI
				// (repeater), but for SerialAPI (controller) the chip sends a
				// SerialAPIStarted command that the driver treats as
				// "unexpected" without updating its mode. Reinitialize to get
				// an accurate reading.
				await context.zwaveBinding.initialize();
				mode = context.zwaveBinding.getDriverMode();
			}
			if (mode === getExpectedDriverMode(targetType)) {
				if (targetType === "repeater") {
					// The repeater firmware requires a reboot cycle after
					// the initial flash so that RF region changes made
					// later in the Configure step are persisted to NVM.
					await context.zwaveBinding.rebootDevice();
				}
				const dsk = targetType === "repeater"
					? await context.zwaveBinding.getDSK()
					: null;
				context.setState((prev) => ({
					...prev,
					isFlashing: false,
					progress: 100,
					flashResult: "success",
					errorMessage: "",
					dsk,
				}));
			} else {
				context.setState((prev) => ({
					...prev,
					isFlashing: false,
					progress: 100,
					flashResult: "error",
					errorMessage: `Firmware installed but device is in ${mode || "unknown"} mode instead of expected mode`,
				}));
			}
		}

		// Navigate to Configure (auto-skips to Summary for non-repeater)
		context.goToStep("Configure");
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
	title: "Install Z-Wave firmware",
	description: "Install updated or different firmware on your ZWA-2.",
	icon: CloudArrowDownIcon,
	iconForeground: "text-blue-700 dark:text-blue-400",
	iconBackground: "bg-blue-50 dark:bg-blue-500/10",
	createInitialState: () => ({
		selectedFirmware: null,
		isFlashing: false,
		progress: 0,
		flashResult: null,
		errorMessage: "",
		downloadedFirmwareName: null,
		currentSubStep: 0,
		isDownloading: false,
		detectedFirmwareType: null,
		detectionState: "pending",
		dataLossConfirmed: false,
		dsk: null,
		selectedRegion: null,
		configureStatus: "idle",
		configureError: null,
	}),
	steps: [
		{
			name: "Connect",
			component: ConnectStep<InstallFirmwareState>,
			navigationButtons: {
				next: {
					label: "Next",
					disabled: (context) =>
						context.connectionState.status !== "connected",
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
			onEnter: handleFileSelectStepEntry,
			navigationButtons: {
				next: {
					label: "Install",
					disabled: (context) => {
						if (!context.state.selectedFirmware) return true;
						if (context.state.detectionState !== "done")
							return true;
						const target = firmwareTypeFromOption(
							context.state.selectedFirmware,
						);
						if (
							needsDataLossWarning(
								context.state.detectedFirmwareType,
								target,
							) &&
							!context.state.dataLossConfirmed
						)
							return true;
						return false;
					},
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
			name: "Configure",
			component: ConfigureStep,
			onEnter: handleConfigureStepEntry,
			navigationButtons: {
				next: {
					label: "Next",
					beforeNavigate: handleConfigureBeforeNavigate,
					disabled: (context) =>
						!context.state.selectedRegion ||
						context.state.configureStatus === "configuring",
				},
			},
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
