import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import ConnectStep from "./ConnectStep";
import CheckStep from "./CheckStep";
import PrepareStep from "./PrepareStep";
import RestoreStep from "./RestoreStep";
import ReinstallStep from "./ReinstallStep";
import SummaryStep from "./SummaryStep";
import type { WizardConfig, WizardContext, WizardStepProps } from "../../components/Wizard";
import { enterESPBootloader } from "../../lib/esp-utils";
import { openSerialPort } from "../../lib/zwave";
import {
	ESP_FIRMWARE_MANIFESTS,
	flashESPFirmwareWithData,
} from "../update-esp-firmware/wizard";
import {
	SWDConsole,
	SWDConsoleError,
	bytesEqual,
	isBlank,
} from "../../lib/swd-console";
import {
	ENC_SPAN_ADDR,
	ENC_SPAN_WORDS,
	EXPECTED_ENC,
	EXPECTED_SIGN_X,
	EXPECTED_SIGN_Y,
	SIGN_SPAN_ADDR,
	SIGN_SPAN_WORDS,
} from "../../lib/zg23-tokens";
import swdFirmwareUrl from "../../assets/zwa2-esp-swd-debugger_0.1.0-merged.bin?url";

/** The vendored image is an `idf.py merge-bin` output and flashes as one part */
const SWD_FIRMWARE_OFFSET = 0x0;

export type KeyCheckState =
	| { status: "idle" }
	| { status: "checking" }
	/** `keysBlank` is null when the device could not be checked */
	| { status: "done"; keysBlank: boolean | null };

export type RestoreState =
	| { status: "idle" }
	| { status: "waiting-for-zwa2" }
	| { status: "entering-bootloader" }
	| { status: "waiting-for-esp32"; bootloaderEntryFailed: boolean }
	| { status: "flashing-debugger"; progress: number }
	| { status: "waiting-for-power-cycle" }
	| { status: "waiting-for-console" }
	| { status: "probing" }
	| { status: "writing" }
	| { status: "verifying" }
	| { status: "done" }
	/** `retryFrom` names the phase the retry button restarts */
	| { status: "error"; errorMessage: string; retryFrom: "flash" | "probe" };

export type ReinstallState =
	| { status: "idle" }
	| { status: "downloading" }
	| { status: "installing"; progress: number }
	| { status: "waiting-for-power-cycle" }
	| { status: "success" }
	| { status: "error"; errorMessage: string };

export interface RestoreBootloaderKeysState {
	checkState: KeyCheckState;
	preparationConfirmed: boolean;
	restoreState: RestoreState;
	selectedManifestId: string;
	reinstallState: ReinstallState;
}

export type RestoreBootloaderKeysStepProps =
	WizardStepProps<RestoreBootloaderKeysState>;

type Context = WizardContext<RestoreBootloaderKeysState>;

async function loadDebuggerFirmware(): Promise<Uint8Array> {
	const response = await fetch(swdFirmwareUrl);
	if (!response.ok) {
		throw new Error(`Failed to load the repair firmware (HTTP ${response.status})`);
	}
	return new Uint8Array(await response.arrayBuffer());
}

async function handleCheckStepEntry(context: Context): Promise<void> {
	if (context.state.checkState.status !== "idle") return;

	context.setState((prev) => ({ ...prev, checkState: { status: "checking" } }));

	let keysBlank: boolean | null = null;
	if (context.zwaveBinding) {
		try {
			await context.zwaveBinding.initialize();
			keysBlank = await context.zwaveBinding.checkBootloaderKeys();
		} catch {
			// A device that cannot be talked to may be exactly the one that
			// needs repairing.
		}
	}

	context.setState((prev) => ({
		...prev,
		checkState: { status: "done", keysBlank },
	}));

	if (keysBlank === false) {
		context.goToStep("Summary");
	}
}

async function handleRestoreStepEntry(context: Context): Promise<void> {
	if (context.state.restoreState.status !== "idle") return;

	// Destroy the Driver the check step started. It holds the port's streams,
	// and a port whose streams are locked cannot be closed.
	await context.zwaveBinding?.cleanupDriver();

	// Preparing the ZWA-2 usually means unplugging it, which kills the port from
	// the connect step. A device that is still attached can be reused, which
	// saves the user a trip through the port picker.
	const connection =
		context.connectionState.status === "connected"
			? context.connectionState
			: null;
	if (connection?.port.connected) {
		const reopened = await openSerialPort(connection.port).then(
			() => true,
			() => false,
		);
		if (reopened) {
			await enterBootloaderForRepair(context, connection.port, connection.type);
			return;
		}
	}

	await context.onDisconnect?.();
	context.setState((prev) => ({
		...prev,
		restoreState: { status: "waiting-for-zwa2" },
	}));
}

/** Puts the ESP into its bootloader. Called once the user picks the ZWA-2 again. */
export async function enterBootloaderForRepair(
	context: Context,
	serialPort: SerialPort,
	deviceType: "zwa2" | "esp32",
): Promise<void> {
	// An ESP that already sits in its ROM bootloader, or still runs the repair
	// tool from an earlier attempt, takes the firmware straight away.
	if (deviceType === "esp32") {
		await flashDebuggerFirmware(context, serialPort);
		return;
	}

	context.setState((prev) => ({
		...prev,
		restoreState: { status: "entering-bootloader" },
	}));

	const result = await enterESPBootloader(serialPort);
	// Entering the bootloader re-enumerates the device and kills the port we hold
	await context.onDisconnect?.();

	context.setState((prev) => ({
		...prev,
		restoreState: {
			status: "waiting-for-esp32",
			bootloaderEntryFailed: result === "failed",
		},
	}));
}

/** Flashes the SWD debugger onto the ESP. Called once the user picks its port. */
export async function flashDebuggerFirmware(
	context: Context,
	serialPort: SerialPort,
): Promise<void> {
	try {
		const firmware = await loadDebuggerFirmware();

		context.setState((prev) => ({
			...prev,
			restoreState: { status: "flashing-debugger", progress: 0 },
		}));

		await flashESPFirmwareWithData(
			serialPort,
			firmware,
			SWD_FIRMWARE_OFFSET,
			(progress) => {
				context.setState((prev) => ({
					...prev,
					restoreState: { status: "flashing-debugger", progress },
				}));
			},
		);

		// The debugger firmware serves its console over USB-Serial-JTAG, and that
		// peripheral only comes up cleanly after a power cycle. The step waits
		// for the unplug before asking for the port again.
		context.setState((prev) => ({
			...prev,
			restoreState: { status: "waiting-for-power-cycle" },
		}));
	} catch (error) {
		context.setState((prev) => ({
			...prev,
			restoreState: {
				status: "error",
				errorMessage: describeError(error),
				retryFrom: "flash",
			},
		}));
	}
}

/** Reads, rewrites and verifies the tokens. Called once the user picks the console port. */
export async function restoreKeys(
	context: Context,
	serialPort: SerialPort,
): Promise<void> {
	const swd = new SWDConsole(serialPort);
	try {
		context.setState((prev) => ({ ...prev, restoreState: { status: "probing" } }));
		await swd.open();
		await swd.identify();

		const before = await swd.readTokens();
		const signingBlank = isBlank(before.signX) || isBlank(before.signY);
		const encryptionBlank = isBlank(before.enc);

		if (signingBlank || encryptionBlank) {
			context.setState((prev) => ({
				...prev,
				restoreState: { status: "writing" },
			}));
			// Write only the spans that are blank. The firmware refuses a range
			// that still holds data, because flash can only clear bits.
			if (signingBlank) {
				await swd.writeSpan(SIGN_SPAN_ADDR, SIGN_SPAN_WORDS);
			}
			if (encryptionBlank) {
				await swd.writeSpan(ENC_SPAN_ADDR, ENC_SPAN_WORDS);
			}
		}

		context.setState((prev) => ({ ...prev, restoreState: { status: "verifying" } }));
		const after = await swd.readTokens();
		if (
			!bytesEqual(after.signX, EXPECTED_SIGN_X) ||
			!bytesEqual(after.signY, EXPECTED_SIGN_Y) ||
			!bytesEqual(after.enc, EXPECTED_ENC)
		) {
			throw new Error(
				"The keys on the device do not match after writing them.",
			);
		}

		// Let the Z-Wave chip run again because probing left it halted
		await swd.runApplication();

		context.setState((prev) => ({ ...prev, restoreState: { status: "done" } }));
		context.goToStep("Reinstall firmware");
	} catch (error) {
		context.setState((prev) => ({
			...prev,
			restoreState: {
				status: "error",
				errorMessage: describeError(error),
				retryFrom: "probe",
			},
		}));
	} finally {
		await swd.close();
	}
}

async function handleReinstallNavigation(context: Context): Promise<boolean> {
	const { reinstallState, selectedManifestId } = context.state;
	if (reinstallState.status === "success") return true;
	if (
		reinstallState.status === "downloading" ||
		reinstallState.status === "installing"
	) {
		return false;
	}

	const serialPort =
		context.connectionState.status === "connected"
			? context.connectionState.port
			: null;
	if (!serialPort) {
		context.setState((prev) => ({
			...prev,
			reinstallState: {
				status: "error",
				errorMessage: "The ZWA-2 is no longer connected.",
			},
		}));
		context.goToStep("Summary");
		return false;
	}

	try {
		context.setState((prev) => ({
			...prev,
			reinstallState: { status: "downloading" },
		}));

		const manifest = ESP_FIRMWARE_MANIFESTS[selectedManifestId];
		const { fetchManifestFirmwareInfo, downloadFirmware } = await import(
			"../../lib/esp-firmware-download"
		);
		const info = await fetchManifestFirmwareInfo(
			manifest.manifestUrl,
			manifest.changelogUrl,
		);
		const firmwareData = await downloadFirmware(info.downloadUrl);

		context.setState((prev) => ({
			...prev,
			reinstallState: { status: "installing", progress: 0 },
		}));

		// The debugger firmware runs on USB-Serial-JTAG. Its PID makes esptool-js
		// pick a reset sequence that works without the baud knock.
		await flashESPFirmwareWithData(
			serialPort,
			firmwareData,
			info.offset,
			(progress) => {
				context.setState((prev) => ({
					...prev,
					reinstallState: { status: "installing", progress },
				}));
			},
		);

		// The new firmware only takes over after a power cycle. The step waits
		// for the unplug before finishing.
		context.setState((prev) => ({
			...prev,
			reinstallState: { status: "waiting-for-power-cycle" },
		}));
	} catch (error) {
		context.setState((prev) => ({
			...prev,
			reinstallState: { status: "error", errorMessage: describeError(error) },
		}));
		context.goToStep("Summary");
	}

	return false;
}

function describeError(error: unknown): string {
	if (error instanceof SWDConsoleError) {
		if (error.kind === "connect-failed" || error.kind === "timeout") {
			return `${error.message} Check that both wires are connected firmly and try again.`;
		}
		return error.message;
	}
	return error instanceof Error ? error.message : String(error);
}

function isBusy(context: Context): boolean {
	const { restoreState, reinstallState } = context.state;
	return (
		![
			"idle",
			"waiting-for-zwa2",
			"waiting-for-esp32",
			"waiting-for-power-cycle",
			"waiting-for-console",
			"done",
			"error",
		].includes(restoreState.status) ||
		reinstallState.status === "downloading" ||
		reinstallState.status === "installing"
	);
}

export const restoreBootloaderKeysWizardConfig: WizardConfig<RestoreBootloaderKeysState> =
	{
		id: "restore-bootloader-keys",
		title: "Restore bootloader keys",
		description:
			"Repair a ZWA-2 that refuses firmware updates. Requires opening the case and connecting two jumper wires.",
		icon: WrenchScrewdriverIcon,
		iconForeground: "text-red-700 dark:text-red-400",
		iconBackground: "bg-red-50 dark:bg-red-500/10",
		createInitialState: () => ({
			checkState: { status: "idle" },
			preparationConfirmed: false,
			restoreState: { status: "idle" },
			selectedManifestId: "usb_bridge",
			reinstallState: { status: "idle" },
		}),
		steps: [
			{
				name: "Connect",
				component: ConnectStep,
				navigationButtons: {
					next: {
						label: "Next",
						disabled: (context) =>
							context.connectionState.status !== "connected",
						beforeNavigate: async (context) => await context.afterConnect(),
					},
					cancel: { label: "Cancel" },
				},
			},
			{
				name: "Check",
				component: CheckStep,
				onEnter: handleCheckStepEntry,
				navigationButtons: {
					next: {
						label: "Next",
						disabled: (context) => context.state.checkState.status !== "done",
					},
					cancel: { label: "Cancel" },
				},
			},
			{
				name: "Prepare the ZWA-2 for repair",
				component: PrepareStep,
				navigationButtons: {
					next: {
						label: "Start repair",
						disabled: (context) => !context.state.preparationConfirmed,
					},
					back: { label: "Back" },
					cancel: { label: "Cancel" },
				},
			},
			{
				name: "Repair",
				component: RestoreStep,
				onEnter: handleRestoreStepEntry,
				navigationButtons: {
					next: {
						label: (context) =>
							context.state.restoreState.status === "error"
								? "Skip repair"
								: "Next",
						disabled: (context) =>
							context.state.restoreState.status !== "error",
					},
				},
				blockBrowserNavigation: isBusy,
			},
			{
				name: "Reinstall firmware",
				component: ReinstallStep,
				navigationButtons: {
					next: {
						label: (context) =>
							context.state.reinstallState.status === "idle"
								? "Install"
								: "Next",
						beforeNavigate: handleReinstallNavigation,
						disabled: (context) =>
							isBusy(context) ||
							context.state.reinstallState.status === "waiting-for-power-cycle" ||
							context.connectionState.status !== "connected",
					},
					cancel: { label: "Cancel" },
				},
				blockBrowserNavigation: isBusy,
			},
			{
				name: "Summary",
				component: SummaryStep,
				isFinal: true,
				navigationButtons: {
					next: {
						label: "Finish",
						beforeNavigate: async (context) => {
							await context.onDisconnect?.();
							return true;
						},
					},
				},
			},
		],
	};
