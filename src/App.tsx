import { useState } from "react";
import { ZWavePortManager } from "./lib/zwave";
import { ESPPortManager } from "./lib/esp-utils";
import ActionCard from "./components/ActionCard";
import ActionCardsGrid from "./components/ActionCardsGrid";
import Breadcrumb from "./components/Breadcrumb";
import WebSerialWarning from "./components/WebSerialWarning";
import Wizard from "./components/Wizard";
import type { BaseWizardContext } from "./components/Wizard";
import { wizards, type WizardId } from "./wizards";

interface ConnectionStatus {
	connected: boolean;
	mode?: string;
	error?: string;
	type?: 'zwa2' | 'esp32' | null;
}

export default function App() {
	const [serialPort, setSerialPort] = useState<SerialPort | null>(null);
	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
		connected: false,
	});
	const [isConnecting, setIsConnecting] = useState(false);
	const [activeWizard, setActiveWizard] = useState<WizardId | null>(null);

	const handleDisconnect = async () => {
		try {
			if (serialPort?.connected && serialPort.readable) {
				await serialPort.close();
			}
			setSerialPort(null);
		} catch (error) {
			console.error("Error during disconnect:", error);
		} finally {
			setConnectionStatus({ connected: false, type: null });
		}
	};

	const requestZWA2SerialPort = async (): Promise<boolean> => {
		setIsConnecting(true);
		setConnectionStatus({ connected: false });

		// Close any pre-existing connection first
		await handleDisconnect();

		const port = await ZWavePortManager.requestPort();
		if (port) {
			setSerialPort(port);
			setConnectionStatus({ connected: true, mode: "Port Connected", type: "zwa2" });
			setIsConnecting(false);
			return true;
		} else {
			setConnectionStatus({
				connected: false,
				error: "Failed to connect to device",
			});
			setIsConnecting(false);
			return false;
		}
	};

	const requestESP32SerialPort = async (): Promise<boolean> => {
		setIsConnecting(true);
		setConnectionStatus({ connected: false });

		// Close any pre-existing connection first
		await handleDisconnect();

		const port = await ESPPortManager.requestPort();
		if (port) {
			setSerialPort(port);
			setConnectionStatus({
				connected: true,
				mode: "ESP32 Port Connected",
				type: "esp32",
			});
			setIsConnecting(false);
			return true;
		} else {
			setConnectionStatus({
				connected: false,
				error: "Failed to connect to ESP32 device",
			});
			setIsConnecting(false);
			return false;
		}
	};

	const handleCloseWizard = () => {
		setActiveWizard(null);
	};

	const createBaseWizardContext = (): BaseWizardContext => ({
		serialPort,
		isConnected: connectionStatus.connected,
		isConnecting,
		connectionType: connectionStatus.type || null,
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
							disabled={isConnecting}
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
						<ActionCardsGrid
							columns={wizards.length % 2 === 0 ? 2 : 3}
						>
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
