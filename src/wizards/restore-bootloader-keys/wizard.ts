import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import ConnectStep from "./ConnectStep";
import CheckStep from "./CheckStep";
import PrepareStep from "./PrepareStep";
import RestoreStep from "./RestoreStep";
import ReinstallStep from "./ReinstallStep";
import SummaryStep from "./SummaryStep";
import type { WizardConfig, WizardContext, WizardStepProps } from "../../components/Wizard";
import { getErrorMessage } from "@zwave-js/shared";
import { enterESPBootloader } from "../../lib/esp-utils";
import { flashESPFirmwareWithData } from "../../lib/esp-flash";
import {
	ESP_FIRMWARE_MANIFESTS,
	downloadFirmware,
	fetchManifestFirmwareInfo,
} from "../../lib/esp-firmware-download";
import { openSerialPort } from "../../lib/zwave";
import { SWDConsole } from "../../lib/swd-console";
import {
	ENC_SPAN_ADDR,
	ENC_SPAN_WORDS,
	EXPECTED_ENC,
	EXPECTED_SIGN_X,
	EXPECTED_SIGN_Y,
	SIGN_SPAN_ADDR,
	SIGN_SPAN_WORDS,
	isBlank,
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

/** `debuggerFirmware` caches the 316 KB image so a retry after a failed flash reuses it */
let debuggerFirmware: Promise<Uint8Array> | undefined;

function loadDebuggerFirmware(): Promise<Uint8Array> {
	debuggerFirmware ??= downloadFirmware(swdFirmwareUrl).catch((error) => {
		debuggerFirmware = undefined;
		throw error;
	});
	return debuggerFirmware;
}

/** Returns the port the wizard currently holds, or null while the device is unplugged */
export function connectedPort(context: Context): SerialPort | null {
	return context.connectionState.status === "connected"
		? context.connectionState.port
		: null;
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
	await context.zwaveBinding?.disconnect();

	// Preparing the ZWA-2 usually means unplugging it, so the port from the
	// connect step is dead. A device that is still attached can be reused, which
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
	// An ESP already in its ROM bootloader takes the firmware straight away. So
	// does one still running the repair tool from an earlier attempt.
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
		// peripheral only comes up cleanly after a power cycle.
		context.setState((prev) => ({
			...prev,
			restoreState: { status: "waiting-for-power-cycle" },
		}));
	} catch (error) {
		context.setState((prev) => ({
			...prev,
			restoreState: {
				status: "error",
				errorMessage: getErrorMessage(error),
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
		const after =
			signingBlank || encryptionBlank ? await swd.readTokens() : before;
		if (
			!after.signX.equals(EXPECTED_SIGN_X) ||
			!after.signY.equals(EXPECTED_SIGN_Y) ||
			!after.enc.equals(EXPECTED_ENC)
		) {
			console.error("Keys do not match after writing:", after);
			throw new Error(
				"The keys on the Z-Wave chip do not match after writing them.",
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
				errorMessage: getErrorMessage(error),
				retryFrom: "probe",
			},
		}));
	} finally {
		await swd.close();
	}
}

async function handleReinstallNavigation(context: Context): Promise<boolean> {
	const { selectedManifestId } = context.state;

	const serialPort = connectedPort(context);
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
		// pick a reset sequence that works without the magic baudrate sequence.
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

		// The new firmware only takes over after a power cycle.
		context.setState((prev) => ({
			...prev,
			reinstallState: { status: "waiting-for-power-cycle" },
		}));
	} catch (error) {
		context.setState((prev) => ({
			...prev,
			reinstallState: { status: "error", errorMessage: getErrorMessage(error) },
		}));
		context.goToStep("Summary");
	}

	return false;
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
