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

		const success = await this.createDriver();
		if (success) {
			return this.driver?.mode === DriverMode.Bootloader;
		}
		return false;
	}

	async runApplication(): Promise<boolean> {
		if (!this.driver || this.driver.mode !== DriverMode.Bootloader) {
			this.onError?.("Not in bootloader mode");
			return false;
		}

		try {
			const option = this.driver.bootloader.findOption((o) => o === "run application");
			if (option === undefined) {
				this.onError?.("Run application option not found");
				return false;
			}

			await this.driver.bootloader.selectOption(option);

			// Wait a bit for the application to start
			await wait(2000);

			// Try to reconnect in application mode
			const success = await this.createDriver();
			if (success && this.driver?.mode !== DriverMode.Bootloader) {
				return true;
			}

			return false;
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
			console.error("Failed to start driver:", e);
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

	async flashFirmware(firmwareFile: File): Promise<boolean> {
		if (!this.driver) {
			this.onError?.("Driver not initialized");
			return false;
		}

		try {
			const rawFile = new Uint8Array(await firmwareFile.arrayBuffer());
			let firmwareData: Uint8Array;
			let filename: string;

			// Check if the file is a ZIP archive
			if (firmwareFile.name.toLowerCase().endsWith(".zip")) {
				const unzippedFirmware = tryUnzipFirmwareFile(rawFile);
				if (!unzippedFirmware) {
					this.onError?.(
						"Could not extract a valid firmware file from the ZIP archive.",
					);
					return false;
				}
				firmwareData = unzippedFirmware.rawData;
				filename = unzippedFirmware.filename;
			} else {
				firmwareData = rawFile;
				filename = firmwareFile.name;
			}

			const format = guessFirmwareFileFormat(filename, firmwareData);
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

			if (result.success) {
				// Recreate driver after successful flash
				await this.createDriver();
				return true;
			} else {
				this.onError?.(
					`Failed to flash firmware: ${getEnumMemberName(
						OTWFirmwareUpdateStatus,
						result.status,
					)}`,
				);
				return false;
			}
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
		if (this.port) {
			await this.port.close().catch(() => {});
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
