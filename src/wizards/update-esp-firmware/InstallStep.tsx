import { useCallback, useEffect, useRef } from 'react';
import { LinkIcon, LinkSlashIcon } from '@heroicons/react/24/outline';
import type { WizardStepProps } from '../../components/Wizard';
import type { UpdateESPFirmwareState } from './wizard';
import { flashESPFirmwareWithData } from './wizard';
import CircularProgress from '../../components/CircularProgress';
import Alert from '../../components/Alert';

export default function InstallStep({ context }: WizardStepProps<UpdateESPFirmwareState>) {
	const { installState } = context.state;

	const prevSerialPort = useRef<SerialPort | null>(null);

	// Handle ESP32 connection and start flashing when in waiting-for-esp32 state
	useEffect(() => {
		const currentSerialPort = context.connectionState.status === 'connected' ? context.connectionState.port : null;
		const isESP32Connected = context.connectionState.status === 'connected' && context.connectionState.type === 'esp32';

		// Only trigger when serial port transitions from null to non-null and we're waiting for ESP32
		if (!prevSerialPort.current && currentSerialPort && isESP32Connected &&
			installState.status === "waiting-for-esp32") {

			const flashFirmware = async () => {
				const { firmwareData, firmwareOffset, firmwareLabel } = installState;

				context.setState((prev) => ({
					...prev,
					installState: { status: "installing", progress: 0, firmwareLabel },
				}));

				const onProgress = (progress: number) => {
					context.setState((prev) => ({
						...prev,
						installState: { status: "installing", progress, firmwareLabel },
					}));
				};

				try {
					await flashESPFirmwareWithData(context, firmwareData, firmwareOffset, onProgress);
					context.setState((prev) => ({
						...prev,
						installState: { status: "waiting-for-power-cycle", firmwareLabel },
					}));
				} catch (error) {
					context.setState((prev) => ({
						...prev,
						installState: {
							status: "error",
							errorMessage: error instanceof Error ? error.message : String(error)
						},
					}));
				}
			};

			flashFirmware();
		}

		prevSerialPort.current = currentSerialPort;
	}, [context, installState]);

	// Handle power-cycle waiting
	useEffect(() => {
		if (installState.status !== "waiting-for-power-cycle") {
			return;
		}

		const serialPort = context.connectionState.status === 'connected' ? context.connectionState.port : null;
		if (!serialPort) {
			// Already disconnected, proceed to next step
			context.setState((prev) => ({
				...prev,
				installState: { status: "success", firmwareLabel: installState.firmwareLabel },
			}));
			if (context.state.selectedFirmware?.wifi) {
				context.goToStep("Configure");
			} else {
				context.goToStep("Summary");
			}
			return;
		}

		const waitForPowerCycle = async () => {
			const { awaitESPRestart } = await import("../../lib/esp-utils");
			const disconnected = await awaitESPRestart(serialPort);

			if (disconnected) {
				// Device has been power-cycled
				await context.onDisconnect?.();
				context.setState((prev) => ({
					...prev,
					installState: { status: "success", firmwareLabel: installState.firmwareLabel },
				}));
				if (context.state.selectedFirmware?.wifi) {
					context.goToStep("Configure");
				} else {
					context.goToStep("Summary");
				}
			} else {
				// Timeout - treat as error
				context.setState((prev) => ({
					...prev,
					installState: {
						status: "error",
						errorMessage: "Timeout waiting for device to restart"
					},
				}));
			}
		};

		waitForPowerCycle();
	}, [context, installState]);

	const handleESP32Connect = useCallback(async () => {
		await context.requestESP32SerialPort();
	}, [context]);

	// Show completion state
	if (installState.status === "success" || installState.status === "error") {
		return (
			<div className="text-center py-8">
				<div className="text-gray-600 dark:text-gray-300">
					<p>Installation process completed. Click "Next" to see the results.</p>
				</div>
			</div>
		);
	}

	// Show downloading spinner
	if (installState.status === "downloading") {
		return (
			<div className="text-center py-8">
				<div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
				<h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
					Downloading {installState.firmwareLabel} firmware...
				</h3>
			</div>
		);
	}

	// Show entering bootloader spinner
	if (installState.status === "entering-bootloader") {
		return (
			<div className="text-center py-8">
				<div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
				<h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
					Enter bootloader
				</h3>
				<p className="text-gray-600 dark:text-gray-300">
					Putting ESP into bootloader mode...
				</p>
			</div>
		);
	}

	// Show ESP32 connection UI
	const connectedToESP32 = context.connectionState.status === 'connected' && context.connectionState.type === 'esp32';
	if (installState.status === "waiting-for-esp32") {
		const { bootloaderEntryFailed } = installState;

		return (
			<div className="flex flex-col items-center py-8 space-y-6">
				<div className={`${connectedToESP32 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>
					{connectedToESP32 ? (
						<LinkIcon className="w-16 h-16" />
					) : (
						<LinkSlashIcon className="w-16 h-16" />
					)}
				</div>
				<div className="text-center">
					<h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
						{connectedToESP32 ? 'ESP32 Connected' : 'Connect to ESP32 Bootloader'}
					</h3>
					<p className="text-gray-600 dark:text-gray-300">
						{connectedToESP32
							? 'Successfully connected to the ESP32 bootloader.'
							: bootloaderEntryFailed
								? <>Could not enter the bootloader automatically.<br />You can follow the instructions below to enter bootloader mode manually, then try again.</>
								: <>Bootloader mode activated. Now select the ESP32 serial port to continue with the firmware update.</>
						}
					</p>
					<p className="text-gray-600 dark:text-gray-300">
						The device is usually called "ESP32-S3" or "USB JTAG/serial debug unit".
					</p>
				</div>

				{!connectedToESP32 && (
					<>
						<button
							onClick={handleESP32Connect}
							disabled={context.connectionState.status === 'connecting'}
							className="rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-purple-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-purple-500 dark:hover:bg-purple-400"
						>
							{context.connectionState.status === 'connecting' ? 'Connecting...' : 'Select ESP32 Port'}
						</button>

						{bootloaderEntryFailed && (
							<Alert title="To trigger the bootloader manually">
								<ol className="list-decimal pl-6 my-2 space-y-1">
									<li>Unplug the ZWA-2 and open it up</li>
									<li>On the top right of the PCB, under "ESP GPIO pins", bridge GPIO0 and GND with something conductive</li>
									<li>Plug the ZWA-2 back in</li>
									<li>Retry connecting</li>
								</ol>
								<span className="block mt-2">Don't forget to remove the bridge after flashing!</span>
							</Alert>
						)}
					</>
				)}

				{connectedToESP32 && context.onDisconnect && (
					<button
						onClick={context.onDisconnect}
						className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
					>
						Connect different device
					</button>
				)}
			</div>
		);
	}

	// Show circular progress during installation
	if (installState.status === "installing") {
		return (
			<div className="text-center py-8">
				<CircularProgress progress={installState.progress} className="mb-4" />
				<h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
					Install firmware
				</h3>
				<p className="text-gray-600 dark:text-gray-300">
					Installing {installState.firmwareLabel}...
				</p>
			</div>
		);
	}

	// Show waiting for power cycle
	if (installState.status === "waiting-for-power-cycle") {
		return (
			<div className="text-center py-8">
				<div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
				<h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
					Firmware installed successfully
				</h3>
				<p className="text-gray-600 dark:text-gray-300">
					Please power cycle your ZWA-2 to activate the new firmware.
				</p>
		</div>
		);
	}

	// Fallback/idle state
	return (
		<div className="text-center py-8">
			<h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
				Install firmware
			</h3>
			<p className="text-gray-600 dark:text-gray-300">
				Ready to install firmware...
			</p>
		</div>
	);
}
