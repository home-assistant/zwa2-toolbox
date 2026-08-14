import { wait } from "alcalzone-shared/async";
import { Bytes } from "@zwave-js/shared";

const PROMPT = "swd>";
const DEFAULT_TIMEOUT = 8000;

const WIRE_HINT = "Check that both wires are connected firmly and try again.";

const TOKEN_LINE =
	/^(SIGNED_BOOTLOADER_KEY_X|SIGNED_BOOTLOADER_KEY_Y|SECURE_BOOTLOADER_KEY)\s+0x[0-9A-Fa-f]{8}\s+([0-9a-f]+)\s*$/;

export interface SWDTokens {
	signX: Bytes;
	signY: Bytes;
	enc: Bytes;
}

/**
 * Client for the console of the ESP32-S3 SWD debugger firmware. That firmware
 * bit-bangs SWD to the ZG23 next to it and rewrites its bootloader key tokens.
 *
 * The console is the S3's native USB-Serial-JTAG, so the baud rate is ignored.
 * DTR must be asserted or the firmware never sends anything.
 *
 * https://github.com/AlCalzone/zwa2-esp-swd-debugger
 */
export class SWDConsole {
	private reader?: ReadableStreamDefaultReader<Uint8Array>;
	private writer?: WritableStreamDefaultWriter<Uint8Array>;
	private buffer = "";
	private readonly decoder = new TextDecoder();
	private readonly encoder = new TextEncoder();
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

		// Make the REPL print a prompt, then discard the boot banner and anything
		// else already in flight. The buffer must survive until the wait returns,
		// because the banner's own prompt may be the only one that arrives.
		await this.write("\r\n");
		await this.awaitPrompt(5000).catch(() => {});
		this.logTranscript("console opened", this.buffer);
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

	/** Connects to the ZG23 over SWD. The debug port IDs only prove it answered. */
	async identify(): Promise<void> {
		const response = await this.send("id");
		this.throwOnConnectFailure(response);

		if (
			!/^DPIDR\s+0x[0-9A-Fa-f]{8}/m.test(response) ||
			!/^AP IDR\s+0x[0-9A-Fa-f]{8}/m.test(response)
		) {
			// Loose wires make the firmware answer without the debug port IDs, and
			// sometimes without printing `connect failed` at all.
			console.error("[swd] 'id' did not report the debug port IDs");
			this.throwUnreachable();
		}
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

		const found = new Map<string, Bytes>();
		for (const line of response.split("\n")) {
			const match = TOKEN_LINE.exec(line.trim());
			if (match) found.set(match[1], Bytes.from(match[2], "hex"));
		}

		const signX = found.get("SIGNED_BOOTLOADER_KEY_X");
		const signY = found.get("SIGNED_BOOTLOADER_KEY_Y");
		const enc = found.get("SECURE_BOOTLOADER_KEY");
		if (signX?.length !== 32 || signY?.length !== 32 || enc?.length !== 16) {
			console.error("[swd] could not parse the 'read' response");
			throw new Error("Could not read the keys from the Z-Wave chip.");
		}
		return { signX, signY, enc };
	}

	/** Writes a word span in flash page 63. The range must already be blank. */
	async writeSpan(addr: number, words: readonly number[]): Promise<void> {
		const args = words.map((w) => `0x${hex8(w)}`).join(" ");
		const response = await this.send(`wr 0x${hex8(addr)} ${args}`);
		this.throwOnConnectFailure(response);

		if (response.includes("target range is not blank")) {
			console.error("[swd] the target range still holds data");
			throw new Error(
				"The keys on this device are only partly erased, so they cannot be rewritten.",
			);
		}

		const status = response
			.split("\n")
			.map((line) => line.trim())
			.find((line) => line.startsWith("wr "));
		if (!status?.includes(": ok")) {
			console.error("[swd] the write did not report success");
			throw new Error("Could not write the keys to the Z-Wave chip.");
		}
	}

	/** Resets the ZG23 and lets it run again after probing halted the core */
	async runApplication(): Promise<void> {
		const response = await this.send("run");
		this.throwOnConnectFailure(response);
		if (!/^reset-run: ok\s*$/m.test(response)) {
			console.error("[swd] the reset did not report success");
			throw new Error("Could not restart the Z-Wave chip.");
		}
	}

	private throwOnConnectFailure(response: string): void {
		const match = /^connect failed: (.+)$/m.exec(response);
		if (match) {
			// The firmware's reason codes, like `no-ack`, mean nothing to the user
			console.error("[swd] connect failed:", match[1].trim());
			this.throwUnreachable();
		}
	}

	private throwUnreachable(): never {
		throw new Error(`Could not reach the Z-Wave chip. ${WIRE_HINT}`);
	}

	private async send(command: string): Promise<string> {
		this.buffer = "";
		await this.write(`${command}\r\n`);
		const response = await this.awaitPrompt(DEFAULT_TIMEOUT);
		this.logTranscript(`> ${command}`, response);
		// Drop the trailing prompt and the line the REPL echoed back
		return response
			.slice(0, response.lastIndexOf(PROMPT))
			.split("\n")
			.filter((line) => line.trim() !== command)
			.join("\n");
	}

	private logTranscript(label: string, text: string): void {
		// The REPL ends its lines with CRLF, and a stray \r clutters the console
		console.log(`[swd] ${label}\n${text.replace(/\r/g, "").trimEnd()}`);
	}

	private async write(data: string): Promise<void> {
		if (!this.writer) throw new Error("Console is not open");
		await this.writer.write(this.encoder.encode(data));
	}

	/**
	 * Waits for the accumulated response to end with the prompt.
	 *
	 * The 20 ms poll must stay. The firmware can still have the previous
	 * command's prompt in flight, so the response can end on a later prompt.
	 */
	private async awaitPrompt(timeoutMs: number): Promise<string> {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			if (this.buffer.trimEnd().endsWith(PROMPT)) return this.buffer;
			await wait(20);
		}
		console.error("[swd] no prompt within the timeout. Partial response:", this.buffer);
		throw new Error(`The repair tool did not respond. ${WIRE_HINT}`);
	}

	private async pump(): Promise<void> {
		while (this.reader) {
			try {
				const { value, done } = await this.reader.read();
				if (done) return;
				if (!value) continue;
				this.buffer += this.decoder.decode(value, { stream: true });
			} catch {
				return;
			}
		}
	}
}

function hex8(value: number): string {
	return value.toString(16).toUpperCase().padStart(8, "0");
}
