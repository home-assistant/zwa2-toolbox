import React from "react";
import ReactDOM from "react-dom/client";
import r2wc from "react-to-webcomponent";
import Wizard from "../components/Wizard";
import { updateESPHomeWizardConfig } from "../wizards/update-esp-firmware";
import { useBaseWizardContext } from "../hooks/useBaseWizardContext";
import styles from "../index.css?inline";

function InstallESPHomeFirmwareWizard() {
	const baseContext = useBaseWizardContext();

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
