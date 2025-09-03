import { createDeferredPromise } from "alcalzone-shared/deferred-promise";
import { wait } from "alcalzone-shared/async";

/**
 * Utility functions for ESP-specific operations
 */


const MAGIC_BAUDRATES = [150, 300, 600];

/**
 * Enters the ESP bootloader mode on the connected device
 * @param _serialPort The connected serial port (unused in placeholder implementation)
 * @returns Promise resolving to true if successful, false otherwise
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function enterESPBootloader(
	serialPort: SerialPort,
): Promise<boolean> {

	const disconnectPromise = createDeferredPromise<void>();
	function onDisconnect() {
		console.log("Serial port disconnected, likely entered bootloader mode");
		disconnectPromise.resolve();
	}

	try {
		// When entering the bootloader, the ZWA-2 disconnects and the ESP bootloader device reconnects
		await serialPort.close();
		serialPort.addEventListener("disconnect", onDisconnect);

		for (const baudrate of MAGIC_BAUDRATES) {
			await serialPort.open({ baudRate: baudrate });
			await wait(100);
			await serialPort.close();
		}

		console.log("Sent magic baudrate sequence");

		// In the legacy implementation, the magic sequence already triggers the bootloader
		const legacyResult = await Promise.race([
			disconnectPromise.then(() => true),
			wait(2000).then(() => false),
		]);
		if (legacyResult) return true;

		// The newer implementation enters command mode instead. We need to send `BE` to enter the ESP bootloader
		await serialPort.open({ baudRate: 115200 });
		const writer = serialPort.writable?.getWriter();
		if (!writer) {
			throw new Error("Failed to get writable stream from serial port");
		}
		const data = new TextEncoder().encode("BE");
		await writer.write(data);
		writer.releaseLock();
		console.log("Sent 'BE' to enter bootloader");

		// Wait up to 5 seconds for the disconnect event
		const result = await Promise.race([
			disconnectPromise.then(() => true),
			wait(5000).then(() => false),
		]);
		return result;

	} catch (error) {
		console.error("Failed to enter ESP bootloader:", error);
		return false;
	} finally {
		serialPort.removeEventListener("disconnect", onDisconnect);
	}
}

export const ESP32_DEVICE_FILTERS = [
	{ usbVendorId: 0x303a, usbProductId: 0x0009 },
];

export class ESPPortManager {
	static async requestPort(): Promise<SerialPort | null> {
		try {
			return await navigator.serial.requestPort({
				filters: ESP32_DEVICE_FILTERS,
			});
			// The ESP serial port should not be opened automatically - esptool-js will handle that
		} catch (e) {
			console.error("Failed to connect to ESP32 device:", e);
			return null;
		}
	}
}
