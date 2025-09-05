import { useState } from "react";
import { ZWavePortManager } from "./lib/zwave";
import { ESPPortManager } from "./lib/esp-utils";
import ActionCard from "./components/ActionCard";
import ActionCardsGrid from "./components/ActionCardsGrid";
import Breadcrumb from "./components/Breadcrumb";
import WebSerialWarning from "./components/WebSerialWarning";
import Wizard from "./components/Wizard";
import type { BaseWizardContext, ConnectionState } from "./components/Wizard";
import { wizards, type WizardId } from "./wizards";

export default function App() {
	const [connectionState, setConnectionState] = useState<ConnectionState>({
		status: 'disconnected',
	});
	const [activeWizard, setActiveWizard] = useState<WizardId | null>(null);

	const handleDisconnect = async () => {
		try {
			if (connectionState.status === 'connected' && connectionState.port.connected && connectionState.port.readable) {
				await connectionState.port.close();
			}
		} catch (error) {
			console.error("Error during disconnect:", error);
		} finally {
			setConnectionState({ status: 'disconnected' });
		}
	};

	const requestZWA2SerialPort = async (): Promise<boolean> => {
		setConnectionState({ status: 'connecting', type: 'zwa2' });

		// Close any pre-existing connection first
		await handleDisconnect();

		const port = await ZWavePortManager.requestPort();
		if (port) {
			setConnectionState({ status: 'connected', port, type: 'zwa2' });
			return true;
		} else {
			setConnectionState({ status: 'disconnected' });
			return false;
		}
	};

	const requestESP32SerialPort = async (): Promise<boolean> => {
		setConnectionState({ status: 'connecting', type: 'esp32' });

		// Close any pre-existing connection first
		await handleDisconnect();

		const port = await ESPPortManager.requestPort();
		if (port) {
			setConnectionState({ status: 'connected', port, type: 'esp32' });
			return true;
		} else {
			setConnectionState({ status: 'disconnected' });
			return false;
		}
	};

	const handleCloseWizard = () => {
		setActiveWizard(null);
	};

	const createBaseWizardContext = (): BaseWizardContext => ({
		connectionState,
		requestZWA2SerialPort,
		requestESP32SerialPort,
		onDisconnect: handleDisconnect,
	});

	// Render active wizard
	if (activeWizard) {
		const baseContext = createBaseWizardContext();

		// Find the wizard configuration by ID
		const currentWizard = wizards.find(
			(wizard) => wizard.id === activeWizard,
		);

		if (currentWizard) {
			const breadcrumbItems = [
				{ name: currentWizard.title, current: true },
			];

			return (
				<div className="bg-white dark:bg-gray-900 min-h-screen px-6 py-24 sm:py-32 lg:px-8">
					<div className="max-w-7xl mx-auto">
						<h2 className="text-4xl font-semibold tracking-tight text-balance text-gray-900 sm:text-5xl dark:text-white mb-8">
							ZWA-2 Toolbox
						</h2>

						<Breadcrumb
							items={breadcrumbItems}
							onHomeClick={handleCloseWizard}
							disabled={connectionState.status === 'connecting'}
						/>

						<div className="mt-8">
							<Wizard
								config={currentWizard as any}
								baseContext={baseContext}
								onClose={handleCloseWizard}
							/>
						</div>
					</div>
				</div>
			);
		}
	}

	return (
		<div className="bg-white dark:bg-gray-900 min-h-screen px-6 py-24 sm:py-32 lg:px-8">
			<div className="max-w-7xl mx-auto">
				<h2 className="text-4xl font-semibold tracking-tight text-balance text-gray-900 sm:text-5xl dark:text-white">
					ZWA-2 Toolbox
				</h2>
				<p className="mt-6 max-w-xl text-lg text-gray-600 dark:text-gray-300">
					User friendly tools to manage Home Assistant Connect ZWA-2
					directly in your browser.
				</p>

				{/* Check for WebSerial support */}
				{!("serial" in navigator) ? (
					<div className="mt-10">
						<WebSerialWarning />
					</div>
				) : (
					/* Action Cards */
					<div className="mt-10">
						<ActionCardsGrid>
							{wizards.map((wizard) => (
								<ActionCard
									key={wizard.id}
									title={wizard.title}
									description={wizard.description}
									icon={wizard.icon}
									iconForeground={wizard.iconForeground}
									iconBackground={wizard.iconBackground}
									onClick={() => setActiveWizard(wizard.id)}
								/>
							))}
						</ActionCardsGrid>
					</div>
				)}
			</div>
		</div>
	);
}
