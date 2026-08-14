import { db } from "@zwave-js/bindings-browser/db";
import { fs } from "@zwave-js/bindings-browser/fs";
import { createWebSerialPortFactory } from "@zwave-js/bindings-browser/serial";
import { log as createLogContainer } from "@zwave-js/core/bindings/log/browser";
import {
	BootloaderChunkType,
	FunctionType,
	type ZWaveSerialBindingFactory,
} from "@zwave-js/serial";
import { Bytes, type BytesView, getErrorMessage } from "@zwave-js/shared";
import { wait } from "alcalzone-shared/async";
import {
	type DeferredPromise,
	createDeferredPromise,
} from "alcalzone-shared/deferred-promise";
import {
	Driver,
	DriverMode,
	OTWFirmwareUpdateStatus,
	Zniffer,
	extractFirmware,
	getEnumMemberName,
	guessFirmwareFileFormat,
	tryUnzipFirmwareFile,
	type FirmwareFileFormat,
} from "zwave-js";
import { resetZWaveChipViaCommandMode } from "./esp-utils";
import { isBlank } from "./zg23-tokens";
import { NodeIDType, NodeType } from "@zwave-js/core/definitions";
import type { FirmwareType } from "./firmware-download";

/**
 * `OTW_ERROR_BLANK_ENCRYPTION_KEY` is what the bootloader reports for an image
 * it could not parse after decrypting. A blank encryption key token produces
 * exactly that.
 */
export const OTW_ERROR_BLANK_ENCRYPTION_KEY = 0x44;

export interface FlashFirmwareResult {
	success: boolean;
	/** `errorCode` is the raw bootloader error code, undefined unless the bootloader rejected the image */
	errorCode?: number;
}

export interface ZWaveBindingInitOptions {
	/** Skip controller identification during driver startup. Useful for recovery when the chip firmware may be partially functional. */
	skipControllerIdentification?: boolean;
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

	async initialize(options: ZWaveBindingInitOptions = {}): Promise<boolean> {
		return await this.createDriver(options);
	}

	async resetToBootloader(): Promise<boolean> {
		if (!this.port) return false;

		// ===
		// Attempt 1: Use Serial API to enter bootloader
		if (this.driver?.mode === DriverMode.SerialAPI) {
			try {
				await this.driver.enterBootloader();
				return true;
			} catch {
				// Continue with next attempt
			}
		}

		// Now we use the ESP for triggering a hardware reset into bootloader.
		// Destroy the driver first; createDriver() will recreate the binding.
		await this.driver?.destroy();

		// ===
		// Attempt 2: Legacy RTS/DTR procedure
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
			console.log(
				"Successfully entered bootloader via legacy RTS/DTR procedure",
			);
			return true;
		}

		console.log(
			"Legacy RTS/DTR procedure failed, trying command mode approach",
		);

		// ===
		// Attempt 3: Command mode with BZ command
		// Destroy the current driver first; createDriver() will recreate the binding.
		if (this.driver) {
			await this.driver.destroy().catch(() => {});
		}

		const commandModeSuccess = await resetZWaveChipViaCommandMode(
			this.port,
		);
		if (!commandModeSuccess) {
			console.log("Command mode approach failed");
			return false;
		}

		// Recreate serial binding after command mode operations
		await openSerialPort(this.port);

		// Wait 500ms and check if bootloader was entered
		await wait(500);
		success = await this.createDriver();
		if (success && this.driver?.mode === DriverMode.Bootloader) {
			console.log(
				"Successfully entered bootloader via command mode BZ procedure",
			);
			return true;
		}

		console.log("All reset procedures failed");
		return false;
	}

	/** Reboots the device by entering bootloader and starting the application again. */
	async rebootDevice(): Promise<boolean> {
		if (!this.driver) return false;

		try {
			await this.driver.enterBootloader();
		} catch {
			return false;
		}

		return this.runApplication();
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

	private async createDriver(
		options: ZWaveBindingInitOptions = {},
	): Promise<boolean> {
		if (this.driver) {
			this.driver.removeAllListeners();
			await this.driver.destroy().catch(() => {});
			// Destroying the driver closes the serial port streams, invalidating the
			// existing binding. Recreate it so the next driver gets a fresh one.
			this.serialBinding = createWebSerialPortFactory(this.port);
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
				skipControllerIdentification:
					options.skipControllerIdentification,
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

	async flashFirmware(
		fileName: string,
		firmwareData: BytesView,
	): Promise<FlashFirmwareResult> {
		const fail = (
			message: string,
			errorCode?: number,
		): FlashFirmwareResult => {
			this.onError?.(message);
			return { success: false, errorCode };
		};

		if (!this.driver) {
			return fail("Driver not initialized");
		}

		try {
			let format: FirmwareFileFormat | undefined;

			// Check if the data is a ZIP archive based on filename
			if (fileName.toLowerCase().endsWith(".zip")) {
				const unzippedFirmware = tryUnzipFirmwareFile(firmwareData);
				if (!unzippedFirmware) {
					return fail(
						"Could not extract a valid firmware file from the ZIP archive.",
					);
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
					return fail("Failed to reset to bootloader");
				}
			}

			const result = await this.driver.firmwareUpdateOTW(firmware.data);

			if (!result.success) {
				return fail(
					`Failed to flash firmware: ${getEnumMemberName(
						OTWFirmwareUpdateStatus,
						result.status,
					)}`,
					result.errorCode,
				);
			}
			return { success: true };
		} catch (e) {
			return fail(`Failed to flash firmware: ${getErrorMessage(e)}`);
		}
	}

	/**
	 * Reports whether the ZG23's bootloader key tokens have been erased. A blank
	 * encryption key makes every OTW update abort with error 0x44.
	 *
	 * No Serial API command reads those tokens. This exploits a bounds bug in the
	 * controller firmware instead. The firmware derives the response length from
	 * `nvmSize - offset` and truncates it to uint8_t. An offset past the end of
	 * the NVM therefore wraps to a large positive length. The response then
	 * carries the flash contents that follow the NVM. The requested length has
	 * to stay 1.
	 *
	 * The NVM ends where the lockbits page begins. Offset `size + X` therefore
	 * reads flash address `0x0807E000 + X` and returns `(-X) mod 256` bytes:
	 *
	 *   size + 0x286 -> 0x0807E286, 0x7a bytes. The first 16 are
	 *                   MFG_SECURE_BOOTLOADER_KEY.
	 *   size + 0x360 -> 0x0807E360, 0xa0 bytes. The first 12 are the tail of
	 *                   MFG_SIGNED_BOOTLOADER_KEY_X. The next 32 are all of
	 *                   MFG_SIGNED_BOOTLOADER_KEY_Y at 0x0807E36C.
	 *
	 * The probe starts 20 bytes into MFG_SIGNED_BOOTLOADER_KEY_X. Starting at its
	 * real address 0x0807E34C would expand to 180 bytes and overflow the
	 * controller's 168-byte TX buffer.
	 *
	 * Returns `null` when the device could not be checked. Callers must treat
	 * that as unknown.
	 */
	async checkBootloaderKeys(): Promise<boolean | null> {
		// The probe is a Serial API command and needs the controller firmware
		// running. Repeater and Zniffer firmware cannot be checked.
		if (this.driver?.mode !== DriverMode.SerialAPI) return null;

		try {
			const controller = this.driver.controller;
			if (
				!controller.supportedFunctionTypes?.includes(
					FunctionType.ExtendedNVMOperations,
				)
			) {
				return null;
			}

			const { size } = await controller.externalNVMOpenExt();
			try {
				const encryptionProbe = await controller.externalNVMReadBufferExt(
					size + 0x286,
					1,
				);
				const signingProbe = await controller.externalNVMReadBufferExt(
					size + 0x360,
					1,
				);
				if (
					encryptionProbe.buffer.length !== 0x7a ||
					signingProbe.buffer.length !== 0xa0
				) {
					return null;
				}

				return (
					isBlank(encryptionProbe.buffer.subarray(0, 16)) ||
					isBlank(signingProbe.buffer.subarray(0, 44))
				);
			} finally {
				await controller.externalNVMCloseExt();
			}
		} catch (e) {
			console.error("Failed to check bootloader keys:", getErrorMessage(e));
			return null;
		}
	}

	async eraseNVM(): Promise<boolean> {
		if (!this.driver) {
			this.onError?.("Driver not initialized");
			return false;
		}

		try {
			// Enter bootloader mode if not already there
			if (this.driver.mode !== DriverMode.Bootloader) {
				const bootloaderSuccess = await this.resetToBootloader();
				if (!bootloaderSuccess) {
					this.onError?.("Failed to reset to bootloader");
					return false;
				}
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

	/**
	 * Attempts to initialize a Zniffer instance to check if the device is
	 * running Zniffer firmware. Always recreates the serial binding afterwards.
	 */
	private async tryInitZniffer(): Promise<boolean> {
		const zniffer = new Zniffer(this.serialBinding, {
			host: {
				fs,
				db,
				log: createLogContainer,
				serial: {},
			},
		});
		try {
			await zniffer.init();
			await zniffer.destroy();
			this.serialBinding = createWebSerialPortFactory(this.port);
			return true;
		} catch {
			await zniffer.destroy().catch(() => {});
			this.serialBinding = createWebSerialPortFactory(this.port);
			return false;
		}
	}

	/**
	 * Destroys the current Driver (if any) and gives the serial port time to
	 * settle before further operations.
	 */
	private async cleanupDriver(): Promise<void> {
		if (this.driver) {
			this.driver.removeAllListeners();
			await this.driver.destroy().catch(() => {});
			this.driver = undefined;
		}
		await wait(500);
		this.serialBinding = createWebSerialPortFactory(this.port);
	}

	/**
	 * Detects the current firmware type by trying the Driver first, then falling back to the Zniffer class.
	 *
	 * Returns:
	 * - A `FirmwareType` when the firmware was positively identified
	 * - `"unknown"` when the device is responsive (app could be started) but the firmware is not recognized
	 * - `null` when the device could not be reached at all or is stuck in bootloader
	 */
	async detectFirmwareType(
		options?: ZWaveBindingInitOptions,
	): Promise<FirmwareType | "unknown" | null> {
		// Suppress error callbacks during probing — failures are expected
		// when the device runs firmware the Driver doesn't understand.
		const savedOnError = this.onError;
		this.onError = undefined;

		try {
			// Try Zniffer first — it's a quick check and avoids the Driver's
			// internal recovery attempts (soft reset, serial port reopen)
			// trashing the port state when the device runs Zniffer firmware.
			const isZniffer = await this.tryInitZniffer();
			if (isZniffer) return "zniffer";

			let couldStartApp = false;
			const driverSuccess = await this.initialize(options);

			if (driverSuccess) {
				const mode = this.getDriverMode();
				switch (mode) {
					case DriverMode.SerialAPI:
						return "controller";
					case DriverMode.CLI:
						return "repeater";
					case DriverMode.Bootloader: {
						// Try running the application to detect the firmware type
						const started = await this.runApplication();
						if (started) {
							couldStartApp = true;
							const newMode = this.getDriverMode();
							if (newMode === DriverMode.SerialAPI) return "controller";
							if (newMode === DriverMode.CLI) return "repeater";
							// Unknown mode after running application — fall through
						} else {
							// Still in bootloader, can't determine firmware type
							return null;
						}
						break;
					}
				}
			}

			// Driver failed or mode is Unknown — not Zniffer (already checked),
			// so it's either truly unknown or a connection failure.
			return couldStartApp ? "unknown" : null;
		} finally {
			this.onError = savedOnError;
		}
	}

	/**
	 * Verifies that the device is running Zniffer firmware by attempting to
	 * initialize a Zniffer instance. Cleans up the Driver first if needed.
	 */
	async verifyZnifferFirmware(): Promise<boolean> {
		await this.cleanupDriver();
		return this.tryInitZniffer();
	}

	/**
	 * Attempts to detect if the controller's own node ID is incorrectly set to the invalid ID 239.
	 * This expects the driver to have been initialized already (requires skipControllerIdentification: true)
	 */
	async detectInvalidControllerNodeID239(): Promise<boolean> {
		if (!this.driver) {
			throw new Error("Driver not initialized");
		}

		// @ts-expect-error This is an internal method
		const { nodeIds } = await this.driver.controller.queryCapabilities();
		await this.driver.controller.trySetNodeIDType(NodeIDType.Long);
		// @ts-expect-error This is an internal method
		await this.driver.controller.identify();

		const isInvalid =
			!nodeIds.includes(1) && this.driver.controller.ownNodeId === 239;

		return isInvalid;
	}

	async fixInvalidControllerNodeID239(): Promise<void> {
		const nodeIds = [1, ...this.driver!.controller.nodes.keys()];
		const nvm = this.driver!.controller.nvm;

		// Set the controller node ID back to 1
		await nvm.set(
			{
				domain: "controller",
				type: "nodeId",
			},
			1,
		);
		// And set it as the SUC
		await nvm.set(
			{
				domain: "controller",
				type: "staticControllerNodeId",
			},
			1,
		);
		// Restore the node information
		await nvm.set(
			{
				domain: "node",
				nodeId: 1,
				type: "info",
			},
			{
				nodeId: 1,
				isListening: true,
				isFrequentListening: false,
				isRouting: true,
				supportedDataRates: [40000, 100000],
				protocolVersion: 3,
				optionalFunctionality: false,
				nodeType: NodeType.Controller,
				supportsSecurity: false,
				supportsBeaming: true,
				genericDeviceClass: 2,
				specificDeviceClass: 1,
				neighbors: [],
				sucUpdateIndex: 255,
			},
		);
		// And update the node list
		await nvm.set(
			{
				domain: "controller",
				type: "nodeIds",
			},
			nodeIds,
		);

		// Save and apply changes
		await nvm.commit();
		await this.driver!.softReset();
	}

	async getDSK(): Promise<string | null> {
		if (!this.driver || this.driver.mode !== DriverMode.CLI) {
			return null;
		}

		try {
			const dsk = await this.driver.cli.executeCommand("get_dsk");
			return dsk ?? null;
		} catch {
			return null;
		}
	}

	async setRegion(region: string): Promise<boolean> {
		if (!this.driver || this.driver.mode !== DriverMode.CLI) {
			return false;
		}

		try {
			await this.driver.cli.executeCommand(`set_region ${region}`);
			return true;
		} catch {
			return false;
		}
	}

	async getPowerlevel(): Promise<{
		txPowerMax: number;
		txPowerAdjust: number;
		txPowerMaxLR: number;
	} | null> {
		if (!this.driver || this.driver.mode !== DriverMode.CLI) {
			return null;
		}

		try {
			const response =
				await this.driver.cli.executeCommand("get_powerlevel");
			if (!response) return null;

			// Response format: iTxPowerLevelMax=%d iTxPowerLevelAdjust=%d iTxPowerLevelMaxLR=%d
			const match = response.match(
				/iTxPowerLevelMax=(-?\d+)\s+iTxPowerLevelAdjust=(-?\d+)\s+iTxPowerLevelMaxLR=(-?\d+)/,
			);
			if (!match) return null;

			return {
				txPowerMax: Number(match[1]),
				txPowerAdjust: Number(match[2]),
				txPowerMaxLR: Number(match[3]),
			};
		} catch {
			return null;
		}
	}

	async setPowerlevel(
		txPowerMax: number,
		txPowerAdjust: number,
		txPowerMaxLR: number,
	): Promise<boolean> {
		if (!this.driver || this.driver.mode !== DriverMode.CLI) {
			return false;
		}

		try {
			await this.driver.cli.executeCommand(
				`set_powerlevel ${txPowerMax} ${txPowerAdjust} ${txPowerMaxLR}`,
			);
			return true;
		} catch {
			return false;
		}
	}

	async getRegion(): Promise<string | null> {
		if (!this.driver || this.driver.mode !== DriverMode.CLI) {
			return null;
		}

		try {
			const region = await this.driver.cli.executeCommand("get_region");
			return region ?? null;
		} catch {
			return null;
		}
	}

	// --- Controller-specific methods (Serial API mode) ---

	/** Returns the controller instance, or null if the driver is not in Serial API mode. */
	get controller() {
		if (!this.driver || this.driver.mode !== DriverMode.SerialAPI) {
			return null;
		}
		return this.driver.controller;
	}

	async disconnect(): Promise<void> {
		await this.cleanupDriver();
	}
}

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

/**
 * Opens a port at the rate the ZWA-2 uses.
 *
 * The user can pick a port an earlier step left open, so a plain `open` throws.
 * A close only succeeds once whatever held the streams has released them. A
 * failed close therefore leaves the existing connection in place.
 */
export async function openSerialPort(port: SerialPort): Promise<void> {
	if (port.readable || port.writable) {
		try {
			await port.close();
		} catch (e) {
			console.warn("Reusing a port that is still open:", getErrorMessage(e));
			return;
		}
	}
	await port.open({ baudRate: 115200 });
}

// Helper class for requesting and managing SerialPort connection
export class ZWavePortManager {
	static async requestPort(): Promise<SerialPort | null> {
		try {
			const port = await navigator.serial.requestPort({
				filters: ZWA2_DEVICE_FILTERS,
			});
			await openSerialPort(port);
			return port;
		} catch (e) {
			console.error("Failed to connect to device:", e);
			return null;
		}
	}
}
