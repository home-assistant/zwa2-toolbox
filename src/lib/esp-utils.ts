import { createDeferredPromise } from "alcalzone-shared/deferred-promise";
import { wait } from "alcalzone-shared/async";

/**
 * Utility functions for ESP-specific operations
 */

const MAGIC_BAUDRATES = [150, 300, 600];

export type BootloaderResult = "success" | "failed" | "no-update-needed";

/**
 * Enters the ESP bootloader mode on the connected device
 * @param serialPort The connected serial port
 * @param checkFirmwareInfo Optional callback called with firmware info before entering bootloader. Return false or throw to indicate no update needed.
 * @returns Promise resolving to BootloaderResult indicating success, failure, or no update needed
 */
export async function enterESPBootloader(
	serialPort: SerialPort,
	checkFirmwareInfo?: (firmwareInfo: string) => Promise<boolean> | boolean,
): Promise<BootloaderResult> {
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
			return "success";
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
		const menuResult = await Promise.race([
			disconnectPromise.then(() => "bootloader"),
			// A positive result of the cmdMenuPromise means we've seen the cmd menu, so we did NOT enter bootloader yet
			cmdMenuPromise.then((result) => (result ? "menu" : "bootloader")),
			wait(2000).then(() => "timeout"),
		]);
		if (menuResult === "bootloader") return "success";

		// The newer implementation enters command mode instead.
		// We'll retrieve the firmware info first,
		// and then send `BE` to enter the ESP bootloader
		const writer = serialPort.writable?.getWriter();
		if (!writer) {
			throw new Error("Failed to get writable stream from serial port");
		}

		const writeCommand = async (cmd: string) => {
			const command = new TextEncoder().encode(cmd);
			await writer.write(command);
		};

		// Only if we actually saw the menu prompt, check for firmware info
		// Otherwise we are dealing with something that doesn't support it
		if (menuResult === "menu") {
			const infoPromise = awaitChunk(() => true);
			await writeCommand("I");
			console.log("Sent 'I' to get firmware info");
			const info = await infoPromise;
			if (info) {
				console.log("Received firmware info:", info);

				// Call the callback with version info if provided
				if (checkFirmwareInfo) {
					try {
						const shouldContinue = await checkFirmwareInfo(info);
						if (!shouldContinue) {
							console.log(
								"Firmware check callback returned false, indicating no update needed",
							);
							writer.releaseLock();
							return "no-update-needed";
						}
					} catch (error) {
						console.log(
							"Firmware check callback threw an error, treating as no update needed:",
							error,
						);
						writer.releaseLock();
						return "no-update-needed";
					}
				}
			} else {
				console.warn("Did not receive version info");
			}
		}

		await writeCommand("BE");
		console.log("Sent 'BE' to enter bootloader");

		writer.releaseLock();

		// Wait up to 5 seconds for the disconnect event
		const result = await Promise.race([
			disconnectPromise.then(() => true),
			wait(5000).then(() => false),
		]);
		return result ? "success" : "failed";
	} catch (error) {
		console.error("Failed to enter ESP bootloader:", error);
		return "failed";
	} finally {
		serialPort.removeEventListener("disconnect", onDisconnect);
	}
}

/**
 * Helper function to enter ESP command mode and send BZ command to reset Z-Wave chip to bootloader
 * @param serialPort The connected serial port
 * @returns Promise resolving to boolean indicating success
 */
export async function resetZWaveChipViaCommandMode(serialPort: SerialPort): Promise<boolean> {
	try {
		console.log("Attempting Z-Wave chip reset via ESP command mode");

		// Send magic baudrate sequence to enter command mode
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
		const writer = serialPort.writable?.getWriter();

		if (!reader || !writer) {
			console.error("Failed to get readable/writable streams from serial port");
			return false;
		}

		// Helper to read data with timeout
		const awaitChunk = (predicate: (chunk: string) => boolean, timeoutMs: number = 1000) => {
			return Promise.race([
				reader.read().then(({ value, done }) => {
					const receivedChunk = value && new TextDecoder().decode(value);
					if (done || receivedChunk == undefined) return undefined;
					if (!predicate(receivedChunk)) return undefined;
					return receivedChunk;
				}).catch(() => undefined),
				wait(timeoutMs).then(() => undefined)
			]);
		};

		// Helper to write commands
		const writeCommand = async (cmd: string) => {
			const command = new TextEncoder().encode(cmd);
			await writer.write(command);
		};

		// Check if we get the command menu prompt
		const cmdMenuPromise = awaitChunk((chunk) => chunk.startsWith("cmd>"), 2000);
		const menuResult = await cmdMenuPromise;

		if (menuResult) {
			console.log("Entered command mode, sending BZ command");
			// Send BZ command to reset Z-Wave chip to bootloader
			await writeCommand("BZ");
			console.log("Sent BZ command to reset Z-Wave chip");
		} else {
			console.log("Did not enter command mode, command mode may not be supported");
		}

		// Clean up the streams
		writer.releaseLock();
		reader.releaseLock();

		return true;
	} catch (error) {
		console.error("Failed to reset Z-Wave chip via command mode:", error);
		return false;
	}
}


export const ESP32_DEVICE_FILTERS = [
	// VID/PID when triggering the bootloader through software
	{ usbVendorId: 0x303a, usbProductId: 0x0009 },
	// VID/PID when triggering the bootloader through hardware (GPIO0 to GND)
	{ usbVendorId: 0x303a, usbProductId: 0x1001 },
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
