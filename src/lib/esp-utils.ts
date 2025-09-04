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
		// await serialPort.close();
		serialPort.addEventListener("disconnect", onDisconnect);

		for (let i = 0; i < MAGIC_BAUDRATES.length; i++) {
			const baudrate = MAGIC_BAUDRATES[i];
			if (i > 0) {
				await wait(100);
			}
			await serialPort.close();
			await serialPort.open({ baudRate: baudrate });
		}
		console.log("Sent magic baudrate sequence");

		const reader = serialPort.readable?.getReader();
		if (!reader) {
			console.error(
				"Failed to get readable stream from serial port. Probably means we entered bootloader.",
			);
			return true;
		}

		const awaitChunk = (predicate: (chunk: string) => boolean) => {
			return reader
				.read()
				.then(({ value, done }) => {
					// Return true only if we've received the expected chunk.
					const receivedChunk =
						value && new TextDecoder().decode(value);
						if (done || receivedChunk == undefined) return undefined;
						if (!predicate(receivedChunk)) return undefined;
						return receivedChunk;
				})
				.catch(() => undefined);
		};

		const cmdMenuPromise = awaitChunk((chunk) => chunk.startsWith("cmd>"));

		// In the legacy implementation, the magic sequence already triggers the bootloader
		const legacyResult = await Promise.race([
			disconnectPromise.then(() => true),
			// A positive result of the cmdMenuPromise means we've seen the cmd menu, so we did NOT enter bootloader yet
			cmdMenuPromise.then((result) => !result),
			wait(2000).then(() => false),
		]);
		if (legacyResult) return true;

		// The newer implementation enters command mode instead.
		// We'll retrieve the version info first (unused for now),
		// and then send `BE` to enter the ESP bootloader
		const writer = serialPort.writable?.getWriter();
		if (!writer) {
			throw new Error("Failed to get writable stream from serial port");
		}

		const writeCommand = async (cmd: string) => {
			const command = new TextEncoder().encode(cmd);
			await writer.write(command);
		};

		const infoPromise = awaitChunk(() => true);
		await writeCommand("I");
		console.log("Sent 'I' to get version info");
		const info = await infoPromise;
		if (info) {
			console.log("Received version info:", info);
		} else {
			console.warn("Did not receive version info");
		}

		await writeCommand("BE");
		console.log("Sent 'BE' to enter bootloader");

		writer.releaseLock();

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
