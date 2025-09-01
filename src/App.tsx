import { useState } from "react";
import { ZWavePortManager, ZWaveBinding } from "./lib/zwave";
import ActionCard from "./components/ActionCard";
import ActionCardsGrid from "./components/ActionCardsGrid";
import Breadcrumb from "./components/Breadcrumb";
import WebSerialWarning from "./components/WebSerialWarning";
import Wizard from "./components/Wizard";
import type { BaseWizardContext } from "./components/Wizard";
import { wizards, type WizardId } from "./wizards";
import {
	installFirmwareWizardConfig,
} from "./wizards/install-firmware";
import {
	updateFirmwareWizardConfig,
} from "./wizards/update-firmware";
import {
	eraseNVMWizardConfig,
} from "./wizards/erase-nvm";

// All wizard configurations
const allWizards = [
	{
		id: "install" as const,
		config: installFirmwareWizardConfig,
	},
	{
		id: "update" as const,
		config: updateFirmwareWizardConfig,
	},
	{
		id: "erase" as const,
		config: eraseNVMWizardConfig,
	},
] as const;

interface ConnectionStatus {
	connected: boolean;
	mode?: string;
	error?: string;
}

export default function App() {
	const [serialPort, setSerialPort] = useState<SerialPort | null>(null);
	const [zwaveBinding, setZwaveBinding] = useState<ZWaveBinding | null>(null);
	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
		connected: false,
	});
	const [isConnecting, setIsConnecting] = useState(false);
	const [activeWizard, setActiveWizard] = useState<WizardId | null>(null);

	const handleConnect = async () => {
		setIsConnecting(true);
		setConnectionStatus({ connected: false });

		const port = await ZWavePortManager.requestPort();
		if (port) {
			const binding = new ZWaveBinding(port);
			const success = await binding.initialize();

			if (success) {
				setSerialPort(port);
				setZwaveBinding(binding);
				setConnectionStatus({ connected: true, mode: "Connected" });
			} else {
				setConnectionStatus({
					connected: false,
					error: "Failed to initialize Z-Wave binding",
				});
			}
		} else {
			setConnectionStatus({
				connected: false,
				error: "Failed to connect to device",
			});
		}
		setIsConnecting(false);
	};

	const handleDisconnect = async () => {
		try {
			if (zwaveBinding) {
				await zwaveBinding.disconnect();
				setZwaveBinding(null);
			}
			if (serialPort) {
				await serialPort.close();
				setSerialPort(null);
			}
		} catch (error) {
			console.error("Error during disconnect:", error);
		} finally {
			setConnectionStatus({ connected: false });
		}
	};

	const handleCloseWizard = () => {
		setActiveWizard(null);
	};

	const createBaseWizardContext = (): BaseWizardContext => ({
		serialPort,
		zwaveBinding,
		isConnected: connectionStatus.connected,
		isConnecting,
		onConnect: handleConnect,
		onDisconnect: handleDisconnect,
	});

	// Render active wizard
	if (activeWizard) {
		const baseContext = createBaseWizardContext();

		// Find the wizard configuration by ID
		const currentWizard = allWizards.find(wizard => wizard.id === activeWizard);

		if (currentWizard) {
			const breadcrumbItems = [
				{ name: currentWizard.config.title, current: true },
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
								config={currentWizard.config as any}
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
						<ActionCardsGrid columns={3}>
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
