import { db } from "@zwave-js/bindings-browser/db";
import { fs } from "@zwave-js/bindings-browser/fs";
import { createWebSerialPortFactory } from "@zwave-js/bindings-browser/serial";
import { log as createLogContainer } from "@zwave-js/core/bindings/log/browser";
import {
	BootloaderChunkType,
	type ZWaveSerialBindingFactory,
} from "@zwave-js/serial";
import { Bytes, getErrorMessage } from "@zwave-js/shared";
import { wait } from "alcalzone-shared/async";
import {
	type DeferredPromise,
	createDeferredPromise,
} from "alcalzone-shared/deferred-promise";
import {
	Driver,
	DriverMode,
	OTWFirmwareUpdateStatus,
	extractFirmware,
	getEnumMemberName,
	guessFirmwareFileFormat,
	tryUnzipFirmwareFile,
	type FirmwareFileFormat,
} from "zwave-js";

export interface DeviceFilters {
	usbVendorId: number;
	usbProductId: number;
}

export const ZWA2_DEVICE_FILTERS: DeviceFilters[] = [
	// CP2102
	{ usbVendorId: 0x10c4, usbProductId: 0xea60 },
	// Nabu Casa ESP bridge, first EVT revision
	{ usbVendorId: 0x1234, usbProductId: 0x5678 },
	// Nabu Casa ESP bridge, uses Espressif VID/PID
	{ usbVendorId: 0x303a, usbProductId: 0x4001 },
];

const MAGIC_BAUDRATES = [150, 300, 600];

/**
 * Helper function to enter ESP command mode and send BZ command to reset Z-Wave chip to bootloader
 * @param serialPort The connected serial port
 * @returns Promise resolving to boolean indicating success
 */
async function resetZWaveChipViaCommandMode(serialPort: SerialPort): Promise<boolean> {
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

export class ZWaveBinding {
	private driver?: Driver;
	private port: SerialPort;
	private serialBinding: ZWaveSerialBindingFactory;
	private readyPromise?: DeferredPromise<void>;

	public onProgress?: (progress: number) => void;
	public onError?: (error: string) => void;
	public onReady?: () => void;

	constructor(port: SerialPort) {
		this.port = port;
		this.serialBinding = createWebSerialPortFactory(port);
	}

	async initialize(): Promise<boolean> {
		return await this.createDriver();
	}

	async resetToBootloader(): Promise<boolean> {
		if (!this.port) return false;

		// Hardware reset into bootloader
		await this.driver?.destroy();
		// This invalidates our current serial binding, so we need to recreate it
		this.serialBinding = createWebSerialPortFactory(this.port);

		// First attempt: Legacy RTS/DTR procedure
		console.log("Attempting legacy RTS/DTR reset procedure");
		await this.port.setSignals({
			dataTerminalReady: false,
			requestToSend: true,
		});
		await wait(100);
		await this.port.setSignals({
			dataTerminalReady: true,
			requestToSend: false,
		});
		await wait(500);
		await this.port.setSignals({
			dataTerminalReady: false,
			requestToSend: false,
		});

		// Wait 500ms and check if bootloader was entered
		await wait(500);
		let success = await this.createDriver();
		if (success && this.driver?.mode === DriverMode.Bootloader) {
			console.log("Successfully entered bootloader via legacy RTS/DTR procedure");
			return true;
		}

		console.log("Legacy RTS/DTR procedure failed, trying command mode approach");

		// Second attempt: Command mode with BZ command
		// Destroy the current driver first
		if (this.driver) {
			await this.driver.destroy().catch(() => {});
		}

		// Try the command mode approach
		const commandModeSuccess = await resetZWaveChipViaCommandMode(this.port);
		if (!commandModeSuccess) {
			console.log("Command mode approach failed");
			return false;
		}

		// Recreate serial binding after command mode operations
		this.serialBinding = createWebSerialPortFactory(this.port);

		// Wait 500ms and check if bootloader was entered
		await wait(500);
		success = await this.createDriver();
		if (success && this.driver?.mode === DriverMode.Bootloader) {
			console.log("Successfully entered bootloader via command mode BZ procedure");
			return true;
		}

		console.log("Both reset procedures failed");
		return false;
	}

	async runApplication(): Promise<boolean> {
		if (!this.driver || this.driver.mode !== DriverMode.Bootloader) {
			this.onError?.("Not in bootloader mode");
			return false;
		}

		try {
			await this.driver.leaveBootloader();
			return this.driver.mode !== DriverMode.Bootloader;
		} catch (e) {
			this.onError?.(`Failed to run application: ${getErrorMessage(e)}`);
			return false;
		}
	}

	private async createDriver(): Promise<boolean> {
		if (this.driver) {
			this.driver.removeAllListeners();
			await this.driver.destroy().catch(() => {});
		}

		this.driver = new Driver(this.serialBinding!, {
			host: {
				fs,
				db,
				log: createLogContainer,
				serial: {
					// no listing, no creating by path!
				},
			},
			testingHooks: {
				skipNodeInterview: true,
				loadConfiguration: false,
			},
			bootloaderMode: "stay",
		})
			.once("driver ready", this.ready.bind(this))
			.once("bootloader ready", this.ready.bind(this))
			.once("cli ready", this.ready.bind(this))
			.once("error", this.failed.bind(this));

		this.readyPromise = createDeferredPromise();
		try {
			await this.driver.start();
			await this.readyPromise;
			return true;
		} catch (e) {
			this.onError?.(getErrorMessage(e));
			return false;
		}
	}

	private failed() {
		if (this.readyPromise) {
			this.readyPromise.reject(new Error("Driver failed to start"));
			this.readyPromise = undefined;
			this.onError?.(
				"Failed to start the driver. Reconnect the device and try again.",
			);
		}
	}

	private ready() {
		if (this.driver) {
			this.driver.on("firmware update progress", (progress) => {
				this.onProgress?.(progress.progress);
			});
			this.driver.on("firmware update finished", () => {
				this.onProgress?.(100);
			});
		}

		this.readyPromise?.resolve();
		this.readyPromise = undefined;
		this.onReady?.();
	}

	async flashFirmware(fileName: string, firmwareData: Uint8Array): Promise<boolean> {
		if (!this.driver) {
			this.onError?.("Driver not initialized");
			return false;
		}

		try {
			let format: FirmwareFileFormat | undefined;

			// Check if the data is a ZIP archive based on filename
			if (fileName.toLowerCase().endsWith(".zip")) {
				const unzippedFirmware = tryUnzipFirmwareFile(firmwareData);
				if (!unzippedFirmware) {
					this.onError?.(
						"Could not extract a valid firmware file from the ZIP archive."
					);
					return false;
				}
				firmwareData = unzippedFirmware.rawData;
				format = unzippedFirmware.format;
				fileName = unzippedFirmware.filename;
			}

			format ??= guessFirmwareFileFormat(fileName, firmwareData);
			const firmware = await extractFirmware(firmwareData, format);

			// Ensure we're in bootloader mode
			if (this.driver.mode !== DriverMode.Bootloader) {
				const success = await this.resetToBootloader();
				if (!success) {
					this.onError?.("Failed to reset to bootloader");
					return false;
				}
			}

			const result = await this.driver.firmwareUpdateOTW(firmware.data);

			if (!result.success) {
				this.onError?.(
					`Failed to flash firmware: ${getEnumMemberName(
						OTWFirmwareUpdateStatus,
						result.status,
					)}`,
				);
			}
			return result.success;
		} catch (e) {
			this.onError?.(`Failed to flash firmware: ${getErrorMessage(e)}`);
			return false;
		}
	}

	async eraseNVM(): Promise<boolean> {
		if (!this.driver) {
			this.onError?.("Driver not initialized");
			return false;
		}

		try {
			// Force into bootloader mode
			const bootloaderSuccess = await this.resetToBootloader();
			if (!bootloaderSuccess) {
				this.onError?.("Failed to reset to bootloader");
				return false;
			}

			const option = this.driver.bootloader.findOption(
				(o) => o === "erase nvm",
			);
			if (option === undefined) {
				this.onError?.("Erase NVM option not found");
				return false;
			}

			const areYouSurePromise = this.driver.waitForBootloaderChunk(
				(c) =>
					c.type === BootloaderChunkType.Message &&
					c.message.toLowerCase().includes("are you sure"),
				1000,
			);

			await this.driver.bootloader.selectOption(option);

			try {
				await areYouSurePromise;
			} catch {
				this.onError?.("Erase NVM confirmation not received");
				return false;
			}

			const successPromise = this.driver.waitForBootloaderChunk(
				(c) =>
					c.type === BootloaderChunkType.Message &&
					c.message.toLowerCase().includes("erased"),
				1000,
			);

			await this.driver.bootloader.writeSerial(Bytes.from("y", "ascii"));

			try {
				await successPromise;
				return true;
			} catch {
				this.onError?.("NVM erase success message not received");
				return false;
			}
		} catch (e) {
			this.onError?.(`Failed to erase NVM: ${getErrorMessage(e)}`);
			return false;
		}
	}

	getDriverMode(): DriverMode | undefined {
		return this.driver?.mode;
	}

	isInBootloaderMode(): boolean {
		return this.driver?.mode === DriverMode.Bootloader;
	}

	async disconnect(): Promise<void> {
		if (this.driver) {
			this.driver.removeAllListeners();
			await this.driver.destroy().catch(() => {});
		}
	}
}

// Helper class for requesting and managing SerialPort connection
export class ZWavePortManager {
	static async requestPort(): Promise<SerialPort | null> {
		try {
			const port = await navigator.serial.requestPort({
				filters: ZWA2_DEVICE_FILTERS,
			});
			await port.open({ baudRate: 115200 });
			return port;
		} catch (e) {
			console.error("Failed to connect to device:", e);
			return null;
		}
	}
}
