import {
	RFRegion,
	getLegalPowerlevelMesh,
	getLegalPowerlevelLR,
} from "@zwave-js/core/definitions";
import type { FirmwareType } from "./firmware-download";
import type { ZWaveBinding } from "./zwave";

/** CLI region codes and display labels used by the repeater firmware. */
export const RF_REGIONS = [
	{ label: "Europe", value: "EU" },
	{ label: "USA", value: "US" },
	{ label: "Australia/New Zealand", value: "ANZ" },
	{ label: "Hong Kong", value: "HK" },
	{ label: "India", value: "IN" },
	{ label: "Israel", value: "IL" },
	{ label: "Russia", value: "RU" },
	{ label: "China", value: "CN" },
	{ label: "Japan", value: "JP" },
	{ label: "Korea", value: "KR" },
] as const;

/** Maps CLI region codes to the RFRegion enum used by the Serial API. */
export const CLI_REGION_TO_RF_REGION: Record<string, RFRegion> = {
	EU: RFRegion.Europe,
	US: RFRegion.USA,
	ANZ: RFRegion["Australia/New Zealand"],
	HK: RFRegion["Hong Kong"],
	IN: RFRegion.India,
	IL: RFRegion.Israel,
	RU: RFRegion.Russia,
	CN: RFRegion.China,
	JP: RFRegion.Japan,
	KR: RFRegion.Korea,
};

export const FIRMWARE_TYPE_LABELS: Record<FirmwareType, string> = {
	controller: "Controller",
	repeater: "Repeater",
	zniffer: "Zniffer",
};

/**
 * Sets the RF region on a repeater, waits for reboot, verifies the change,
 * and applies legal power level limits for the region.
 *
 * Returns `true` on success, or a string error message on failure.
 */
export async function applyRepeaterRegion(
	binding: ZWaveBinding,
	regionCode: string,
): Promise<true | string> {
	const setSuccess = await binding.setRegion(regionCode);
	if (!setSuccess) {
		return "Failed to set RF region. Please try again.";
	}

	// Wait for ZWA-2 to reboot
	const { wait } = await import("alcalzone-shared/async");
	await wait(1000);

	// Verify region
	const confirmedRegion = await binding.getRegion();
	if (confirmedRegion !== regionCode) {
		return `Region verification failed. Expected "${regionCode}" but got "${confirmedRegion ?? "unknown"}".`;
	}

	// Configure power levels if legal limits are known for this region
	const rfRegion = CLI_REGION_TO_RF_REGION[regionCode];
	if (rfRegion != null) {
		const meshLimit = getLegalPowerlevelMesh(rfRegion);
		const lrLimit = getLegalPowerlevelLR(rfRegion);

		if (meshLimit != null || lrLimit != null) {
			const current = await binding.getPowerlevel();
			if (current) {
				// Z-Wave JS returns dBm, CLI uses deci-dBm
				const newMeshMax =
					meshLimit != null
						? meshLimit * 10
						: current.txPowerMax;
				const newLRMax =
					lrLimit != null ? lrLimit * 10 : current.txPowerMaxLR;

				await binding.setPowerlevel(
					newMeshMax,
					current.txPowerAdjust,
					newLRMax,
				);
			}
		}
	}

	return true;
}
