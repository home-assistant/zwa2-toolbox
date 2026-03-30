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
import {
	RFRegion,
	getLegalPowerlevelMesh,
	getLegalPowerlevelLR,
} from "@zwave-js/core/definitions";

export type ConfigureState = {
	// Detection phase
	detectionState: "pending" | "detecting" | "done";
	detectedFirmwareType: FirmwareType | null;
	// Repeater configuration
	currentRegion: string | null;
	selectedRegion: string | null;
	configureStatus: "idle" | "configuring" | "success" | "error";
	configureError: string | null;
	dsk: string | null;
};

export type ConfigureWizardStepProps = WizardStepProps<ConfigureState>;

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
		let currentRegion: string | null = null;

		// For repeater firmware, read the current region and DSK.
		// These must be sequential — both use CLI commands over the
		// same serial connection and would mix up responses in parallel.
		if (firmwareType === "repeater") {
			dsk = await context.zwaveBinding.getDSK();
			currentRegion = await context.zwaveBinding.getRegion();
		}

		context.setState((prev) => ({
			...prev,
			detectedFirmwareType: firmwareType,
			detectionState: "done",
			dsk,
			currentRegion,
			selectedRegion: currentRegion,
		}));
	} catch {
		context.setState((prev) => ({ ...prev, detectionState: "done" }));
	}

	context.goToStep("Configure");
}

export async function applyRegionConfiguration(
	context: WizardContext<ConfigureState>,
): Promise<boolean> {
	const { selectedRegion } = context.state;

	if (!selectedRegion || !context.zwaveBinding) {
		return false;
	}

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
				const current = await context.zwaveBinding.getPowerlevel();
				if (current) {
					const newMeshMax =
						meshLimit != null
							? meshLimit * 10
							: current.txPowerMax;
					const newLRMax =
						lrLimit != null ? lrLimit * 10 : current.txPowerMaxLR;

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
			currentRegion: selectedRegion,
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

export const configureWizardConfig: WizardConfig<ConfigureState> = {
	id: "configure",
	title: "Configure ZWA-2",
	description:
		"View and change the RF region and other settings on your ZWA-2.",
	icon: Cog6ToothIcon,
	iconForeground: "text-purple-700 dark:text-purple-400",
	iconBackground: "bg-purple-50 dark:bg-purple-500/10",
	createInitialState: () => ({
		detectionState: "pending",
		detectedFirmwareType: null,
		currentRegion: null,
		selectedRegion: null,
		configureStatus: "idle",
		configureError: null,
		dsk: null,
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
