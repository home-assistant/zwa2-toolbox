import { useCallback, useEffect, useRef } from 'react';
import type { UpdateESPFirmwareWizardStepProps } from './wizard';
import { flashESPFirmwareWithData } from '../../lib/esp-flash';
import Button from '../../components/Button';
import ConnectPrompt from '../../components/ConnectPrompt';
import ManualBootloaderInstructions from '../../components/ManualBootloaderInstructions';
import StatusPanel from '../../components/StatusPanel';

export default function InstallStep({ context }: UpdateESPFirmwareWizardStepProps) {
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
					await flashESPFirmwareWithData(currentSerialPort, firmwareData, firmwareOffset, onProgress);
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

	// Auto-navigate on success or error (failsafe in case power-cycle effect doesn't trigger)
	useEffect(() => {
		if (installState.status === "success") {
			if (context.state.selectedFirmware?.wifi) {
				context.goToStep("Configure");
			} else {
				context.goToStep("Summary");
			}
		} else if (installState.status === "error") {
			context.goToStep("Summary");
		}
	}, [context, installState.status]);

	const handleESP32Connect = useCallback(async () => {
		await context.requestESP32SerialPort();
	}, [context]);

	// Show downloading spinner
	if (installState.status === "downloading") {
		return <StatusPanel title={`Downloading ${installState.firmwareLabel} firmware...`} />;
	}

	// Show entering bootloader spinner
	if (installState.status === "entering-bootloader") {
		return (
			<StatusPanel title="Enter bootloader">
				<p>Putting ESP into bootloader mode...</p>
			</StatusPanel>
		);
	}

	// Show ESP32 connection UI
	const connectedToESP32 = context.connectionState.status === 'connected' && context.connectionState.type === 'esp32';
	if (installState.status === "waiting-for-esp32") {
		const { bootloaderEntryFailed } = installState;

		return (
			<ConnectPrompt
				connected={connectedToESP32}
				title={connectedToESP32 ? 'ESP32 Connected' : 'Connect to ESP32 Bootloader'}
				description={
					<>
						<p>
							{connectedToESP32
								? 'Successfully connected to the ESP32 bootloader.'
								: bootloaderEntryFailed
									? <>Could not enter the bootloader automatically.<br />You can follow the instructions below to enter bootloader mode manually, then try again.</>
									: <>Bootloader mode activated. Now select the ESP32 serial port to continue with the firmware update.</>
							}
						</p>
						<p>
							The device is usually called "{context.labels.espVariant}" or "USB JTAG/serial debug unit".
						</p>
					</>
				}
			>
				{!connectedToESP32 && (
					<>
						<Button
							onClick={handleESP32Connect}
							disabled={context.connectionState.status === 'connecting'}
						>
							{context.connectionState.status === 'connecting' ? 'Connecting...' : 'Select ESP32 Port'}
						</Button>

						{bootloaderEntryFailed && (
							<ManualBootloaderInstructions deviceName={context.labels.deviceName} />
						)}
					</>
				)}

				{connectedToESP32 && context.onDisconnect && (
					<Button variant="secondary" onClick={context.onDisconnect}>
						Connect different device
					</Button>
				)}
			</ConnectPrompt>
		);
	}

	// Show circular progress during installation
	if (installState.status === "installing") {
		return (
			<StatusPanel progress={installState.progress} title="Install firmware">
				<p>Installing {installState.firmwareLabel}...</p>
			</StatusPanel>
		);
	}

	// Show waiting for power cycle
	if (installState.status === "waiting-for-power-cycle") {
		return (
			<StatusPanel title="Firmware installed successfully">
				<p>Please power cycle your {context.labels.deviceName} to activate the new firmware.</p>
			</StatusPanel>
		);
	}

	// Fallback/idle state
	return (
		<div className="text-center py-8">
			<h3 className="text-lg font-medium text-primary mb-4">
				Install firmware
			</h3>
			<p className="text-gray-600 dark:text-gray-300">
				Ready to install firmware...
			</p>
		</div>
	);
}
