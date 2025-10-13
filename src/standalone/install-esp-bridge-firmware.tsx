import React from "react";
import ReactDOM from "react-dom/client";
import r2wc from "react-to-webcomponent";
import Wizard from "../components/Wizard";
import { updateESPBridgeWizardConfig } from "../wizards/update-esp-firmware";
import { useBaseWizardContext } from "../hooks/useBaseWizardContext";
import styles from "../index.css?inline";
import type { WizardConfig } from "../components/Wizard";
import type { UpdateESPFirmwareState } from "../wizards/update-esp-firmware";

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
}

/**
 * Creates a customized wizard config with overridden manifest and/or label.
 * If no customization is needed, returns the default config.
 */
function createWizardConfig(
	manifest?: string,
	label?: string,
): WizardConfig<UpdateESPFirmwareState> {
	if (!manifest && !label) {
		// Use default config if no customization
		return updateESPBridgeWizardConfig;
	}

	// Create a customized config with overridden manifest and/or label
	const customConfig: WizardConfig<UpdateESPFirmwareState> = {
		...updateESPBridgeWizardConfig,
		createInitialState: () => {
			const defaultState = updateESPBridgeWizardConfig.createInitialState();

			if (manifest || label) {
				return {
					...defaultState,
					selectedFirmware: {
						type: "manifest",
						manifestId: "custom", // Use a custom ID for override manifests
						label: label || defaultState.selectedFirmware?.label || "Custom firmware",
						// Store the custom manifest URL in a way that can be accessed during installation
						...(manifest && { manifestUrl: manifest }),
					},
				};
			}

			return defaultState;
		},
	};

	return customConfig;
}

function InstallESPBridgeFirmwareWizard({ manifest, label }: InstallESPBridgeFirmwareProps) {
	const baseContext = useBaseWizardContext();
	const wizardConfig = createWizardConfig(manifest, label);

	return (
		<>
			<style>{styles}</style>
			<Wizard
				config={wizardConfig}
				baseContext={baseContext}
			/>
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
		},
	},
);

// Register the web component
customElements.define(
	"install-esp-bridge-firmware",
	InstallESPBridgeFirmwareWebComponent,
);

export default InstallESPBridgeFirmwareWizard;
