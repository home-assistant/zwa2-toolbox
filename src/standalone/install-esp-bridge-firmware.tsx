import React from "react";
import ReactDOM from "react-dom/client";
import r2wc from "react-to-webcomponent";
import Wizard from "../components/Wizard";
import { updateESPBridgeWizardConfig } from "../wizards/update-esp-firmware";
import { useBaseWizardContext } from "../hooks/useBaseWizardContext";
import styles from "../index.css?inline";
import type { WizardConfig } from "../components/Wizard";
import type {
	UpdateESPFirmwareState,
	UpdateESPFirmwareLabels,
} from "../wizards/update-esp-firmware";

export interface InstallESPBridgeFirmwareProps {
	/**
	 * Custom manifest URL to override the default firmware manifest.
	 * If provided, the wizard will install firmware from this manifest instead of the default USB Bridge firmware.
	 */
	manifest?: string;

	/**
	 * Custom label for the firmware being installed.
	 * This will be displayed in the wizard UI to identify the firmware.
	 */
	label?: string;

	/**
	 * Device name to display in the UI (standalone usage).
	 * Defaults to "ZWA-2".
	 */
	device_name?: string;

	/**
	 * Device label for contextual usage (e.g., "the device will be called...").
	 * Defaults to "ZWA-2".
	 */
	serialport_label?: string;

	/**
	 * ESP variant name (e.g., "ESP32-S3" or "USB JTAG/serial debug unit").
	 * Defaults to "ESP32-S3".
	 */
	esp_variant?: string;
}

/**
 * Creates a customized wizard config with overridden manifest and/or label.
 * If no customization is needed, returns the default config.
 */
function createWizardConfig(
	manifest?: string,
	label?: string,
	deviceName?: string,
	serialportLabel?: string,
	espVariant?: string,
): WizardConfig<UpdateESPFirmwareState, UpdateESPFirmwareLabels> {
	if (
		![manifest, label, deviceName, serialportLabel, espVariant].some(
			Boolean,
		)
	) {
		// Use default config if no customization
		return updateESPBridgeWizardConfig;
	}

	// Create a customized config with overridden manifest, labels, etc.
	const defaultLabels = updateESPBridgeWizardConfig.labels!;
	const customConfig: WizardConfig<
		UpdateESPFirmwareState,
		UpdateESPFirmwareLabels
	> = {
		...updateESPBridgeWizardConfig,
		createInitialState: () => {
			const defaultState =
				updateESPBridgeWizardConfig.createInitialState();

			return {
				...defaultState,
				...(manifest || label
					? {
							selectedFirmware: {
								type: "manifest",
								manifestId: "custom", // Use a custom ID for override manifests
								label:
									label ||
									defaultState.selectedFirmware?.label ||
									"Custom firmware",
								// Store the custom manifest URL in a way that can be accessed during installation
								...(manifest && { manifestUrl: manifest }),
							},
						}
					: {}),
			};
		},
		labels: {
			deviceName: deviceName ?? defaultLabels.deviceName,
			serialportLabel: serialportLabel ?? defaultLabels.serialportLabel,
			espVariant: espVariant ?? defaultLabels.espVariant,
		},
	};

	return customConfig;
}

function InstallESPBridgeFirmwareWizard({
	manifest,
	label,
	device_name,
	serialport_label,
	esp_variant,
}: InstallESPBridgeFirmwareProps) {
	const baseContext = useBaseWizardContext();
	const wizardConfig = createWizardConfig(
		manifest,
		label,
		device_name,
		serialport_label,
		esp_variant,
	);

	return (
		<>
			<style>{styles}</style>
			<Wizard config={wizardConfig} baseContext={baseContext} />
		</>
	);
}

// Convert the React component to a web component
const InstallESPBridgeFirmwareWebComponent = r2wc(
	InstallESPBridgeFirmwareWizard,
	React,
	ReactDOM,
	{
		props: {
			manifest: "string",
			label: "string",
			device_name: "string",
			serialport_label: "string",
			esp_variant: "string",
		},
	},
);

// Register the web component
customElements.define(
	"install-esp-bridge-firmware",
	InstallESPBridgeFirmwareWebComponent,
);

export default InstallESPBridgeFirmwareWizard;
