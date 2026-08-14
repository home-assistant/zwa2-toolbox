import { ESPLoader, Transport, type FlashOptions, type LoaderOptions } from "esptool-js";

/**
 * Writes a firmware image to an ESP that already sits in its ROM bootloader.
 *
 * The port's streams must be unlocked, because ESPLoader closes and reopens it.
 */
export async function flashESPFirmwareWithData(
	serialPort: SerialPort,
	firmwareData: Uint8Array,
	firmwareOffset: number,
	onProgress?: (progress: number) => void
): Promise<void> {
	if (!firmwareData?.length) {
		throw new Error("Missing firmware data");
	}

	let transport: Transport | undefined;
	try {
		transport = new Transport(serialPort, true);
		const loaderOptions: LoaderOptions = {
			transport,
			baudrate: 115200,
			enableTracing: false,
			debugLogging: false,
		};
		const esploader = new ESPLoader(loaderOptions);

		if (serialPort.readable || serialPort.writable) {
			await serialPort.close();
		}

		await esploader.main();

		const progressCallback = (_fileIndex: number, written: number, total: number) => {
			const progress = Math.round((written / total) * 100);
			onProgress?.(progress);
		};

		const flashOptions: FlashOptions = {
			fileArray: [{
				data: firmwareData,
				address: firmwareOffset,
			}],
			flashSize: "keep",
			flashMode: "keep",
			flashFreq: "keep",
			eraseAll: false,
			compress: true,
			reportProgress: progressCallback,
		};

		await esploader.writeFlash(flashOptions);

		// Reset the ESP. It stays enumerated, so the caller must still wait for a
		// power cycle.
		await esploader.after();
	} catch (error) {
		console.error("Failed to flash ESP firmware:", error);
		throw error;
	} finally {
		await transport?.disconnect().catch(() => {});
	}
}
