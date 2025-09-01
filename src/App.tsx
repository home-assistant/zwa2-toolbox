import { useState } from "react";
import { ZWaveFlasher } from "./lib/zwave";
import ActionCard from "./components/ActionCard";
import ActionCardsGrid from "./components/ActionCardsGrid";
import Breadcrumb from "./components/Breadcrumb";
import WebSerialWarning from "./components/WebSerialWarning";
import InstallFirmwareWizard from "./wizards/InstallFirmwareWizard";
import UpdateFirmwareWizard from "./wizards/UpdateFirmwareWizard";
import EraseNVMWizard from "./wizards/EraseNVMWizard";
import {
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

interface ConnectionStatus {
	connected: boolean;
	mode?: string;
	error?: string;
}

type WizardType = 'install' | 'update' | 'erase' | null;

export default function App() {
	const [flasher] = useState(() => new ZWaveFlasher());
	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
		connected: false,
	});
	const [isConnecting, setIsConnecting] = useState(false);
	const [progress, setProgress] = useState(0);
	const [isFlashing, setIsFlashing] = useState(false);
	const [activeWizard, setActiveWizard] = useState<WizardType>(null);

	const handleConnect = async () => {
		setIsConnecting(true);
		setConnectionStatus({ connected: false });

		// Set up event handlers
		flasher.onProgress = (p) => setProgress(p);
		flasher.onError = (error) => setConnectionStatus({ connected: false, error });
		flasher.onReady = () => {
			const mode = flasher.getDriverMode();
			const modeString = mode === 0 ? "Bootloader" : mode === 1 ? "CLI" : mode === 2 ? "Serial API" : "Unknown";
			setConnectionStatus({ connected: true, mode: modeString });
		};

		const portRequested = await flasher.requestPort();
		if (portRequested) {
			await flasher.initialize();
		}
		setIsConnecting(false);
	};

	const handleDisconnect = async () => {
		try {
			// Call disconnect on the flasher if available
			if (flasher && typeof flasher.disconnect === 'function') {
				await flasher.disconnect();
			}
		} catch (error) {
			console.error('Error during disconnect:', error);
		} finally {
			// Always reset connection status
			setConnectionStatus({ connected: false });
			setProgress(0);
		}
	};

	const handleFlashFirmware = async (file: File): Promise<boolean> => {
		setIsFlashing(true);
		setProgress(0);

		const success = await flasher.flashFirmware(file);
		if (success) {
			// Don't show alert in wizard mode
		}

		setIsFlashing(false);
		setProgress(0);
		return success;
	};

	const handleEraseNVM = async (): Promise<boolean> => {
		setIsFlashing(true);
		const success = await flasher.eraseNVM();
		if (success) {
			// Don't show alert in wizard mode
		}
		setIsFlashing(false);
		return success;
	};

	const handleCloseWizard = () => {
		setActiveWizard(null);
		setProgress(0);
	};

	const getWizardTitle = (wizardType: WizardType) => {
		switch (wizardType) {
			case 'install': return 'Install Firmware';
			case 'update': return 'Update Firmware';
			case 'erase': return 'Erase NVM';
			default: return '';
		}
	};

	// Show wizard if one is active
	if (activeWizard) {
		const wizardTitle = getWizardTitle(activeWizard);
		const isNavigationBlocked = isConnecting || isFlashing;

		const breadcrumbItems = [{ name: wizardTitle, current: true }];

		return (
			<div className="bg-white dark:bg-gray-900 min-h-screen px-6 py-24 sm:py-32 lg:px-8">
				<div className="max-w-7xl mx-auto">
					<h2 className="text-4xl font-semibold tracking-tight text-balance text-gray-900 sm:text-5xl dark:text-white mb-8">
						ZWA-2 Toolbox
					</h2>

					<Breadcrumb
						items={breadcrumbItems}
						onHomeClick={handleCloseWizard}
						disabled={isNavigationBlocked}
					/>

					<div className="mt-8">
						{activeWizard === 'install' && (
							<InstallFirmwareWizard
								isConnected={connectionStatus.connected}
								onConnect={handleConnect}
								onDisconnect={handleDisconnect}
								onClose={handleCloseWizard}
								onFlashFirmware={handleFlashFirmware}
								isConnecting={isConnecting}
								isFlashing={isFlashing}
								progress={progress}
								disableNavigation={isNavigationBlocked}
								preventUnload={isNavigationBlocked}
							/>
						)}
						{activeWizard === 'update' && (
							<UpdateFirmwareWizard
								isConnected={connectionStatus.connected}
								onConnect={handleConnect}
								onDisconnect={handleDisconnect}
								onClose={handleCloseWizard}
								onFlashFirmware={handleFlashFirmware}
								isConnecting={isConnecting}
								isFlashing={isFlashing}
								progress={progress}
								disableNavigation={isNavigationBlocked}
								preventUnload={isNavigationBlocked}
							/>
						)}
						{activeWizard === 'erase' && (
							<EraseNVMWizard
								isConnected={connectionStatus.connected}
								onConnect={handleConnect}
								onDisconnect={handleDisconnect}
								onClose={handleCloseWizard}
								onEraseNVM={handleEraseNVM}
								isConnecting={isConnecting}
								isErasing={isFlashing}
								disableNavigation={isNavigationBlocked}
								preventUnload={isNavigationBlocked}
							/>
						)}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white dark:bg-gray-900 min-h-screen px-6 py-24 sm:py-32 lg:px-8">
			<div className="max-w-7xl mx-auto">
				<h2 className="text-4xl font-semibold tracking-tight text-balance text-gray-900 sm:text-5xl dark:text-white">
					ZWA-2 Toolbox
				</h2>
				<p className="mt-6 max-w-xl text-lg text-gray-600 dark:text-gray-300">
					User friendly tools to manage Home Assistant Connect ZWA-2 directly in your browser.
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
							<ActionCard
								title="Install Firmware"
								description="Install new firmware on your ZWA-2 device. Choose from bootloader, application firmware, or complete firmware packages."
								icon={CloudArrowDownIcon}
								iconForeground="text-indigo-700 dark:text-indigo-400"
								iconBackground="bg-indigo-50 dark:bg-indigo-500/10"
								onClick={() => setActiveWizard('install')}
							/>
							<ActionCard
								title="Update Firmware"
								description="Update your ZWA-2 device to the latest firmware version. Ensures compatibility and includes the latest features."
								icon={CloudArrowUpIcon}
								iconForeground="text-green-700 dark:text-green-400"
								iconBackground="bg-green-50 dark:bg-green-500/10"
								onClick={() => setActiveWizard('update')}
							/>
							<ActionCard
								title="Erase NVM"
								description="Remove all Z-Wave network data from your device. This will reset the device to factory defaults."
								icon={TrashIcon}
								iconForeground="text-red-700 dark:text-red-400"
								iconBackground="bg-red-50 dark:bg-red-500/10"
								onClick={() => setActiveWizard('erase')}
							/>
						</ActionCardsGrid>
					</div>
				)}
			</div>
		</div>
	);
}
