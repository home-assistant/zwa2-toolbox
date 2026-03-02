import React from "react";
import ReactDOM from "react-dom/client";
import r2wc from "react-to-webcomponent";
import WebSerialWarning from "../components/WebSerialWarning";
import Wizard from "../components/Wizard";
import { useBaseWizardContext } from "../hooks/useBaseWizardContext";
import styles from "../index.css?inline";
import { recoverAdapterWizardConfig } from "../wizards/recover-adapter";

function RecoverAdapterWizard() {
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
				config={recoverAdapterWizardConfig}
				baseContext={baseContext}
			/>
		</>
	);
}

// Convert the React component to a web component
const RecoverAdapterWebComponent = r2wc(
	RecoverAdapterWizard,
	React,
	ReactDOM,
);

// Register the web component
customElements.define("recover-adapter", RecoverAdapterWebComponent);

export default RecoverAdapterWizard;
