import { wait } from "alcalzone-shared/async";

/**
 * Client for the console of the ESP32-S3 SWD debugger firmware. That firmware
 * bit-bangs SWD to the ZG23 next to it and rewrites its bootloader key tokens.
 *
 * The console is the S3's native USB-Serial-JTAG, so the baud rate is ignored.
 * DTR must be asserted or the firmware never sends anything.
 *
 * https://github.com/AlCalzone/zwa2-esp-swd-debugger
 */

const PROMPT = "swd>";
const DEFAULT_TIMEOUT = 8000;

/** `MAX_WRITE_WORDS` is the longest span the firmware accepts in one `wr` command */
const MAX_WRITE_WORDS = 64;

const TOKEN_LINE =
	/^(SIGNED_BOOTLOADER_KEY_X|SIGNED_BOOTLOADER_KEY_Y|SECURE_BOOTLOADER_KEY)\s+0x[0-9A-Fa-f]{8}\s+([0-9a-f]+)\s*$/;

export type SWDErrorKind =
	/** The debugger could not reach the ZG23, usually because a wire is loose */
	| "connect-failed"
	/** The target range still holds data. Flash can only clear bits. */
	| "not-blank"
	/** The firmware did not answer in time */
	| "timeout"
	/** The firmware answered something this client cannot parse */
	| "protocol";

export class SWDConsoleError extends Error {
	readonly kind: SWDErrorKind;

	constructor(kind: SWDErrorKind, message: string) {
		super(message);
		this.name = "SWDConsoleError";
		this.kind = kind;
	}
}

export interface SWDTokens {
	signX: Uint8Array;
	signY: Uint8Array;
	enc: Uint8Array;
}

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

export function isBlank(data: Uint8Array): boolean {
	return data.every((byte) => byte === 0xff);
}

export class SWDConsole {
	private reader?: ReadableStreamDefaultReader<Uint8Array>;
	private writer?: WritableStreamDefaultWriter<Uint8Array>;
	private buffer = "";
	private readonly decoder = new TextDecoder();
	private readonly port: SerialPort;

	constructor(port: SerialPort) {
		this.port = port;
	}

	async open(): Promise<void> {
		if (!this.port.readable && !this.port.writable) {
			await this.port.open({ baudRate: 115200 });
		}
		await this.port.setSignals({
			dataTerminalReady: true,
			requestToSend: false,
		});

		this.reader = this.port.readable!.getReader();
		this.writer = this.port.writable!.getWriter();
		void this.pump();

		// Make the REPL print a prompt, then discard the boot banner and
		// anything else already in flight.
		await this.write("\r\n");
		await this.awaitPrompt(5000).catch(() => {});
		this.buffer = "";
	}

	async close(): Promise<void> {
		const reader = this.reader;
		this.reader = undefined;
		try {
			await reader?.cancel();
		} catch {
			/* empty */
		}
		reader?.releaseLock();
		this.writer?.releaseLock();
		this.writer = undefined;
		try {
			if (this.port.readable || this.port.writable) await this.port.close();
		} catch {
			/* empty */
		}
	}

	/** Connects to the ZG23 over SWD and reports the debug port IDs */
	async identify(): Promise<{ dpidr: number; apIdr: number }> {
		const response = await this.send("id");
		this.throwOnConnectFailure(response);

		const dpidr = /^DPIDR\s+0x([0-9A-Fa-f]{8})/m.exec(response);
		const apIdr = /^AP IDR\s+0x([0-9A-Fa-f]{8})/m.exec(response);
		if (!dpidr || !apIdr) {
			throw new SWDConsoleError("protocol", `Unexpected 'id' response: ${response}`);
		}
		return {
			dpidr: parseInt(dpidr[1], 16),
			apIdr: parseInt(apIdr[1], 16),
		};
	}

	/**
	 * Reads the three token regions.
	 *
	 * The firmware's own `state: BLANK/POPULATED` verdict is ignored. It ANDs
	 * the signing span with the whole encryption span, down to that span's 0xff
	 * padding. A board with only the encryption key erased therefore prints
	 * POPULATED.
	 */
	async readTokens(): Promise<SWDTokens> {
		const response = await this.send("read");
		this.throwOnConnectFailure(response);

		const found = new Map<string, Uint8Array>();
		for (const line of response.split("\n")) {
			const match = TOKEN_LINE.exec(line.trim());
			if (match) found.set(match[1], hexToBytes(match[2]));
		}

		const signX = found.get("SIGNED_BOOTLOADER_KEY_X");
		const signY = found.get("SIGNED_BOOTLOADER_KEY_Y");
		const enc = found.get("SECURE_BOOTLOADER_KEY");
		if (signX?.length !== 32 || signY?.length !== 32 || enc?.length !== 16) {
			throw new SWDConsoleError(
				"protocol",
				`Unexpected 'read' response: ${response}`,
			);
		}
		return { signX, signY, enc };
	}

	/** Writes a word span in flash page 63. The range must already be blank. */
	async writeSpan(addr: number, words: readonly number[]): Promise<void> {
		if (words.length === 0 || words.length > MAX_WRITE_WORDS) {
			throw new SWDConsoleError(
				"protocol",
				`Cannot write ${words.length} words in one command`,
			);
		}

		const args = words.map((w) => `0x${hex8(w)}`).join(" ");
		const response = await this.send(`wr 0x${hex8(addr)} ${args}`);
		this.throwOnConnectFailure(response);

		if (response.includes("target range is not blank")) {
			throw new SWDConsoleError(
				"not-blank",
				"The keys on this device are only partly erased, so they cannot be rewritten.",
			);
		}

		const status = response
			.split("\n")
			.map((line) => line.trim())
			.find((line) => line.startsWith("wr "));
		if (!status?.includes(": ok")) {
			throw new SWDConsoleError(
				"protocol",
				`Write failed: ${status ?? response}`,
			);
		}
	}

	/** Resets the ZG23 and lets it run again after probing halted the core */
	async runApplication(): Promise<void> {
		const response = await this.send("run");
		this.throwOnConnectFailure(response);
		if (!/^reset-run: ok\s*$/m.test(response)) {
			throw new SWDConsoleError("protocol", `Unexpected 'run' response: ${response}`);
		}
	}

	private throwOnConnectFailure(response: string): void {
		const match = /^connect failed: (.+)$/m.exec(response);
		if (match) {
			throw new SWDConsoleError(
				"connect-failed",
				`Could not reach the Z-Wave chip (${match[1].trim()}).`,
			);
		}
	}

	private async send(
		command: string,
		timeoutMs = DEFAULT_TIMEOUT,
	): Promise<string> {
		this.buffer = "";
		await this.write(`${command}\r\n`);
		const response = await this.awaitPrompt(timeoutMs);
		// Drop the trailing prompt and the line the REPL echoed back
		return response
			.slice(0, response.lastIndexOf(PROMPT))
			.split("\n")
			.filter((line) => line.trim() !== command)
			.join("\n");
	}

	private async write(data: string): Promise<void> {
		if (!this.writer) throw new SWDConsoleError("protocol", "Console is not open");
		await this.writer.write(new TextEncoder().encode(data));
	}

	private async awaitPrompt(timeoutMs: number): Promise<string> {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			if (this.buffer.trimEnd().endsWith(PROMPT)) return this.buffer;
			await wait(20);
		}
		throw new SWDConsoleError("timeout", "The debugger firmware did not respond.");
	}

	private async pump(): Promise<void> {
		while (this.reader) {
			try {
				const { value, done } = await this.reader.read();
				if (done) return;
				if (value) {
					this.buffer += this.decoder.decode(value, { stream: true });
				}
			} catch {
				return;
			}
		}
	}
}

function hex8(value: number): string {
	return value.toString(16).toUpperCase().padStart(8, "0");
}
