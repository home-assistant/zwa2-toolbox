import { useState, useCallback } from 'react';
import type { BaseWizardContext, ConnectionState } from '../components/Wizard';
import { ZWavePortManager, ZWA2_DEVICE_FILTERS } from '../lib/zwave';
import { ESPPortManager, ESP32_DEVICE_FILTERS } from '../lib/esp-utils';

/**
 * Custom hook for managing serial port connections and creating the base wizard context.
 * Handles connection state, port requests for ZWA-2 and ESP32 devices, and disconnection.
 *
 * @returns BaseWizardContext object with connection state and port request handlers
 */
export function useBaseWizardContext(): BaseWizardContext {
	const [connectionState, setConnectionState] = useState<ConnectionState>({
		status: 'disconnected',
	});

	const handleDisconnect = useCallback(async () => {
		try {
			if (connectionState.status === 'connected' && connectionState.port.connected && connectionState.port.readable) {
				await connectionState.port.close();
			}
		} catch (error) {
			console.error("Error during disconnect:", error);
		} finally {
			setConnectionState({ status: 'disconnected' });
		}
	}, [connectionState]);

	const requestZWA2SerialPort = useCallback(async (): Promise<boolean> => {
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
	}, [handleDisconnect]);

	const requestESP32SerialPort = useCallback(async (): Promise<boolean> => {
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
	}, [handleDisconnect]);

	const requestCombinedSerialPort = useCallback(async (): Promise<{ success: boolean; deviceType?: 'zwa2' | 'esp32' | 'unknown'; needsBootloaderMode?: boolean }> => {
		setConnectionState({ status: 'connecting', type: 'zwa2' });

		// Close any pre-existing connection first
		await handleDisconnect();

		try {
			// Request port with combined filters
			const port = await navigator.serial.requestPort({
				filters: [...ZWA2_DEVICE_FILTERS, ...ESP32_DEVICE_FILTERS],
			});

			if (!port) {
				setConnectionState({ status: 'disconnected' });
				return { success: false };
			}

			// Open the port
			await port.open({ baudRate: 115200 });

			// Detect device type based on VID/PID
			const info = port.getInfo();
			const vendorId = info.usbVendorId;
			const productId = info.usbProductId;

			// Check if it matches any ZWA-2 filters
			const isZWA2 = ZWA2_DEVICE_FILTERS.some(
				filter => filter.usbVendorId === vendorId && filter.usbProductId === productId
			);

			// Check if it matches any ESP32 filters
			const isESP32 = ESP32_DEVICE_FILTERS.some(
				filter => filter.usbVendorId === vendorId && filter.usbProductId === productId
			);

			let detectedType: 'zwa2' | 'esp32' | 'unknown' = 'unknown';
			let connectionType: 'zwa2' | 'esp32' = 'zwa2'; // Default fallback
			let needsBootloaderMode = false;

			if (isZWA2) {
				detectedType = 'zwa2';
				connectionType = 'zwa2';
				needsBootloaderMode = true; // ZWA-2 needs to enter bootloader mode
			} else if (isESP32) {
				detectedType = 'esp32';
				connectionType = 'esp32';
				needsBootloaderMode = false; // ESP32 is already in bootloader mode
			}

			setConnectionState({ status: 'connected', port, type: connectionType });
			return { success: true, deviceType: detectedType, needsBootloaderMode };
		} catch (error) {
			console.error("Failed to connect to device:", error);
			setConnectionState({ status: 'disconnected' });
			return { success: false };
		}
	}, [handleDisconnect]);

	return {
		connectionState,
		requestZWA2SerialPort,
		requestESP32SerialPort,
		requestCombinedSerialPort,
		onDisconnect: handleDisconnect,
	};
}
