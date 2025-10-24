import React from "react";
import ReactDOM from "react-dom/client";
import r2wc from "react-to-webcomponent";
import WebSerialWarning from "../components/WebSerialWarning";
import Wizard from "../components/Wizard";
import { useBaseWizardContext } from "../hooks/useBaseWizardContext";
import styles from "../index.css?inline";
import { updateESPHomeWizardConfig } from "../wizards/update-esp-firmware";

function InstallESPHomeFirmwareWizard() {
	const baseContext = useBaseWizardContext();

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
			<Wizard
				config={updateESPHomeWizardConfig}
				baseContext={baseContext}
			/>
		</>
	);
}

// Convert the React component to a web component
const InstallESPHomeFirmwareWebComponent = r2wc(
	InstallESPHomeFirmwareWizard,
	React,
	ReactDOM,
);

// Register the web component
customElements.define(
	"install-esphome-firmware",
	InstallESPHomeFirmwareWebComponent,
);

export default InstallESPHomeFirmwareWizard;
