import React from "react";
import ReactDOM from "react-dom/client";
import r2wc from "react-to-webcomponent";
import Wizard from "../components/Wizard";
import { updateESPBridgeWizardConfig } from "../wizards/update-esp-firmware";
import { useBaseWizardContext } from "../hooks/useBaseWizardContext";
import styles from "../index.css?inline";

function InstallESPBridgeFirmwareWizard() {
	const baseContext = useBaseWizardContext();

	return (
		<>
			<style>{styles}</style>
			<div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4">
				<div className="max-w-4xl mx-auto">
					<Wizard
						config={updateESPBridgeWizardConfig}
						baseContext={baseContext}
					/>
				</div>
			</div>
		</>
	);
}

// Convert the React component to a web component
const InstallESPBridgeFirmwareWebComponent = r2wc(
	InstallESPBridgeFirmwareWizard,
	React,
	ReactDOM,
);

// Register the web component
customElements.define("install-esp-bridge-firmware", InstallESPBridgeFirmwareWebComponent);

export default InstallESPBridgeFirmwareWizard;
