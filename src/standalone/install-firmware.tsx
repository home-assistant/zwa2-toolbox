import "../lib/setimmediate-polyfill.js";
import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import r2wc from "react-to-webcomponent";
import WebSerialWarning from "../components/WebSerialWarning";
import type { WizardConfig } from "../components/Wizard";
import Wizard from "../components/Wizard";
import { useBaseWizardContext } from "../hooks/useBaseWizardContext";
import styles from "../index.css?inline";
import type { InstallFirmwareState, FirmwareOption } from "../wizards/install-firmware";
import { installFirmwareWizardConfig } from "../wizards/install-firmware";

export interface InstallFirmwareProps {
	/**
	 * Preselect the firmware type to install. When set, the firmware
	 * selection UI is hidden and the wizard auto-advances unless the
	 * user needs to confirm data loss.
	 *
	 * Accepted values: "controller", "repeater", "zniffer"
	 */
	firmware?: string;
}

const firmwareOptionMap: Record<string, FirmwareOption> = {
	controller: { type: "latest-controller" },
	repeater: { type: "latest-repeater" },
	zniffer: { type: "latest-zniffer" },
};

/**
 * Creates a wizard config with the firmware preselected.
 * When preselected, the selection UI is hidden but the data loss confirmation
 * is still shown when needed. If no firmware is specified, returns the default
 * config with standalone mode enabled.
 */
function createWizardConfig(
	firmware?: string,
): WizardConfig<InstallFirmwareState> {
	const standaloneConfig: WizardConfig<InstallFirmwareState> = {
		...installFirmwareWizardConfig,
		standalone: true,
	};

	const option = firmware ? firmwareOptionMap[firmware] : undefined;
	if (firmware && !option) {
		console.warn(
			`<install-firmware>: unknown firmware "${firmware}". Expected one of: ${Object.keys(firmwareOptionMap).join(", ")}`,
		);
	}
	if (!option) {
		return standaloneConfig;
	}

	return {
		...standaloneConfig,
		createInitialState: () => ({
			...installFirmwareWizardConfig.createInitialState(),
			selectedFirmware: option,
			firmwarePreselected: true,
		}),
	};
}

function InstallFirmwareWizard({ firmware }: InstallFirmwareProps) {
	const baseContext = useBaseWizardContext();
	const wizardConfig = useMemo(() => createWizardConfig(firmware), [firmware]);

	if (!("serial" in navigator)) {
		return (
			<>
				<style>{styles}</style>
				<div className="bg-app-primary min-h-screen">
					<WebSerialWarning />
				</div>
			</>
		);
	}

	return (
		<>
			<style>{styles}</style>
			<Wizard config={wizardConfig} baseContext={baseContext} />
		</>
	);
}

// Convert the React component to a web component
const InstallFirmwareWebComponent = r2wc(
	InstallFirmwareWizard,
	React,
	ReactDOM,
	{
		props: {
			firmware: "string",
		},
	},
);

// Register the web component
customElements.define("install-firmware", InstallFirmwareWebComponent);

export default InstallFirmwareWizard;
