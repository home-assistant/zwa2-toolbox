import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import ConnectStep from "../../components/steps/ConnectStep";
import DetectStep from "./DetectStep";
import ConfigureStep from "./ConfigureStep";
import type {
	WizardConfig,
	WizardContext,
	WizardStepProps,
} from "../../components/Wizard";
import type { FirmwareType } from "../../lib/firmware-download";
import { applyRepeaterRegion } from "../../lib/regions";
import { RFRegion } from "@zwave-js/core/definitions";
import { NabuCasaConfigKey } from "zwave-js/Controller";
import { getEnumMemberName } from "zwave-js";
import { getErrorMessage } from "@zwave-js/shared";

export interface RegionOption {
	value: RFRegion;
	label: string;
	disabled: boolean;
}

export type ConfigureState = {
	// Detection phase
	detectionState: "pending" | "detecting" | "done";
	detectedFirmwareType: FirmwareType | null;
	// Region configuration (shared between repeater and controller)
	currentRegion: string | RFRegion | null;
	selectedRegion: string | RFRegion | null;
	configureStatus: "idle" | "configuring" | "success" | "error";
	configureError: string | null;
	// Repeater-specific
	dsk: string | null;
	// Controller-specific
	supportedRegions: RegionOption[];
	ledEnabled: boolean | null;
	tiltIndicatorEnabled: boolean | null;
	togglingLed: boolean;
	togglingTilt: boolean;
};

export type ConfigureWizardStepProps = WizardStepProps<ConfigureState>;

async function handleDetectStepEntry(
	context: WizardContext<ConfigureState>,
): Promise<void> {
	if (context.state.detectionState !== "pending") return;

	context.setState((prev) => ({ ...prev, detectionState: "detecting" }));

	if (!context.zwaveBinding) {
		context.setState((prev) => ({ ...prev, detectionState: "done" }));
		context.goToStep("Configure");
		return;
	}

	try {
		const detected = await context.zwaveBinding.detectFirmwareType();
		const firmwareType = detected === "unknown" ? null : detected;

		let dsk: string | null = null;
		let currentRegion: string | RFRegion | null = null;
		let supportedRegions: RegionOption[] = [];
		let ledEnabled: boolean | null = null;
		let tiltIndicatorEnabled: boolean | null = null;

		if (firmwareType === "repeater") {
			// These must be sequential — both use CLI commands over the
			// same serial connection and would mix up responses in parallel.
			dsk = await context.zwaveBinding.getDSK();
			currentRegion = await context.zwaveBinding.getRegion();
		} else if (firmwareType === "controller") {
			const ctrl = context.zwaveBinding.controller;
			if (ctrl) {
				// Read supported regions
				const regions = ctrl.getSupportedRFRegions();
				if (regions) {
					supportedRegions = regions
						.map((region) => ({
							value: region,
							label: getEnumMemberName(RFRegion, region),
							disabled:
								region === RFRegion.Unknown ||
								region === RFRegion["Default (EU)"],
						}))
						.sort((a, b) => a.label.localeCompare(b.label));
				}

				// Read current region
				currentRegion = await ctrl.getRFRegion();

				// Read LED state and tilt indicator
				const nabuCasa = ctrl.proprietary["Nabu Casa"];
				if (nabuCasa) {
					try {
						ledEnabled = await nabuCasa.getLEDBinary();
					} catch {
						// LED control not supported
					}
					try {
						const val = await nabuCasa.getConfig(
							NabuCasaConfigKey.EnableTiltIndicator,
						);
						tiltIndicatorEnabled = val === 1;
					} catch {
						// Tilt indicator not supported
					}
				}
			}
		}

		context.setState((prev) => ({
			...prev,
			detectedFirmwareType: firmwareType,
			detectionState: "done",
			dsk,
			currentRegion,
			selectedRegion: currentRegion,
			supportedRegions,
			ledEnabled,
			tiltIndicatorEnabled,
		}));
	} catch {
		context.setState((prev) => ({ ...prev, detectionState: "done" }));
	}

	context.goToStep("Configure");
}

export async function applyRepeaterRegionConfiguration(
	context: WizardContext<ConfigureState>,
): Promise<boolean> {
	const { selectedRegion } = context.state;

	if (!selectedRegion || typeof selectedRegion !== "string" || !context.zwaveBinding) {
		return false;
	}

	context.setState((prev) => ({
		...prev,
		configureStatus: "configuring",
		configureError: null,
	}));

	try {
		const result = await applyRepeaterRegion(
			context.zwaveBinding,
			selectedRegion,
		);
		if (result !== true) {
			context.setState((prev) => ({
				...prev,
				configureStatus: "error",
				configureError: result,
			}));
			return false;
		}

		context.setState((prev) => ({
			...prev,
			configureStatus: "success",
			currentRegion: selectedRegion,
		}));
		return true;
	} catch (error) {
		context.setState((prev) => ({
			...prev,
			configureStatus: "error",
			configureError: `Unexpected error: ${getErrorMessage(error)}`,
		}));
		return false;
	}
}

export async function applyControllerRegionConfiguration(
	context: WizardContext<ConfigureState>,
): Promise<boolean> {
	const { selectedRegion } = context.state;
	const ctrl = context.zwaveBinding?.controller;

	if (selectedRegion == null || typeof selectedRegion !== "number" || !ctrl) {
		return false;
	}

	context.setState((prev) => ({
		...prev,
		configureStatus: "configuring",
		configureError: null,
	}));

	try {
		const success = await ctrl.setRFRegion(selectedRegion);
		if (!success) {
			context.setState((prev) => ({
				...prev,
				configureStatus: "error",
				configureError: "Failed to set RF region. Please try again.",
			}));
			return false;
		}

		context.setState((prev) => ({
			...prev,
			configureStatus: "success",
			currentRegion: selectedRegion,
		}));
		return true;
	} catch (error) {
		context.setState((prev) => ({
			...prev,
			configureStatus: "error",
			configureError: `Unexpected error: ${getErrorMessage(error)}`,
		}));
		return false;
	}
}

export async function toggleLED(
	context: WizardContext<ConfigureState>,
	enabled: boolean,
): Promise<void> {
	const nabuCasa = context.zwaveBinding?.controller?.proprietary["Nabu Casa"];
	if (!nabuCasa) return;

	context.setState((prev) => ({ ...prev, togglingLed: true }));
	try {
		await nabuCasa.setLEDBinary(enabled);
		context.setState((prev) => ({
			...prev,
			ledEnabled: enabled,
			togglingLed: false,
		}));
	} catch {
		context.setState((prev) => ({ ...prev, togglingLed: false }));
	}
}

export async function toggleTiltIndicator(
	context: WizardContext<ConfigureState>,
	enabled: boolean,
): Promise<void> {
	const nabuCasa = context.zwaveBinding?.controller?.proprietary["Nabu Casa"];
	if (!nabuCasa) return;

	context.setState((prev) => ({ ...prev, togglingTilt: true }));
	try {
		await nabuCasa.setConfig(
			NabuCasaConfigKey.EnableTiltIndicator,
			enabled ? 1 : 0,
		);
		context.setState((prev) => ({
			...prev,
			tiltIndicatorEnabled: enabled,
			togglingTilt: false,
		}));
	} catch {
		context.setState((prev) => ({ ...prev, togglingTilt: false }));
	}
}

export const configureWizardConfig: WizardConfig<ConfigureState> = {
	id: "configure",
	title: "Configure ZWA-2",
	description:
		"View and change the RF region and other settings on your ZWA-2.",
	icon: Cog6ToothIcon,
	iconForeground: "text-green-700 dark:text-green-400",
	iconBackground: "bg-green-50 dark:bg-green-500/10",
	createInitialState: () => ({
		detectionState: "pending",
		detectedFirmwareType: null,
		currentRegion: null,
		selectedRegion: null,
		configureStatus: "idle",
		configureError: null,
		dsk: null,
		supportedRegions: [],
		ledEnabled: null,
		tiltIndicatorEnabled: null,
		togglingLed: false,
		togglingTilt: false,
	}),
	steps: [
		{
			name: "Connect",
			component: ConnectStep<ConfigureState>,
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
			name: "Detect",
			component: DetectStep,
			onEnter: handleDetectStepEntry,
		},
		{
			name: "Configure",
			component: ConfigureStep,
			isFinal: true,
			navigationButtons: {
				next: {
					label: "Finish",
				},
			},
		},
	],
};
