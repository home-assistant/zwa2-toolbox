import { type BytesView } from "@zwave-js/shared";
import { sha3_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/**
 * Utility functions for downloading and verifying Z-Wave firmware
 */

export interface FirmwareDownloadResult {
	fileName: string;
	data: BytesView;
}

export interface FirmwareFileResult {
	fileName: string;
	data: BytesView;
}

export class FirmwareDownloadError extends Error {
	public readonly cause?: unknown;

	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = 'FirmwareDownloadError';
		this.cause = cause;
	}
}

interface GitHubRelease {
	tag_name: string;
	draft: boolean;
	prerelease: boolean;
}

interface FirmwareManifest {
	metadata: {
		created_at: string;
	};
	firmwares: FirmwareManifestEntry[];
}

interface FirmwareManifestEntry {
	filename: string;
	checksum: string;
	size: number;
}

const SILABS_FIRMWARE_REPO = 'NabuCasa/silabs-firmware-builder';
const RELEASES_BRANCH = 'releases';
const RELEASES_API_URL = `https://api.github.com/repos/${SILABS_FIRMWARE_REPO}/releases?per_page=30`;
const RELEASES_BRANCH_RAW_BASE_URL =
	`https://raw.githubusercontent.com/${SILABS_FIRMWARE_REPO}/refs/heads/${RELEASES_BRANCH}`;
const ZWA2_FIRMWARE_PREFIX = 'zwa2_controller';

/**
 * Downloads the latest Z-Wave firmware from silabs-firmware-builder release manifests
 * @returns Promise resolving to firmware file name and data
 * @throws FirmwareDownloadError if download or verification fails
 */
export async function downloadLatestFirmware(): Promise<FirmwareDownloadResult> {
	try {
		const releaseResponse = await fetch(RELEASES_API_URL);

		if (!releaseResponse.ok) {
			throw new FirmwareDownloadError(
				`Failed to fetch release list: ${releaseResponse.status} ${releaseResponse.statusText}`
			);
		}

		const releases: GitHubRelease[] = await releaseResponse.json();
		const stableReleases = releases.filter(release => !release.draft && !release.prerelease);

		if (stableReleases.length === 0) {
			throw new FirmwareDownloadError('No stable releases found in firmware repository');
		}

		let lastReleaseError: unknown;

		for (const release of stableReleases) {
			try {
				const manifestUrl = `${RELEASES_BRANCH_RAW_BASE_URL}/${release.tag_name}/manifest.json`;

				const manifestResponse = await fetch(manifestUrl);
				if (!manifestResponse.ok) {
					continue;
				}

				const manifest: FirmwareManifest = await manifestResponse.json();
				const firmwareEntry = manifest.firmwares.find(
					firmware =>
						firmware.filename.startsWith(ZWA2_FIRMWARE_PREFIX) &&
						firmware.filename.toLowerCase().endsWith('.gbl')
				);

				if (!firmwareEntry) {
					continue;
				}

				const firmwareUrl = `${RELEASES_BRANCH_RAW_BASE_URL}/${release.tag_name}/${firmwareEntry.filename}`;
				const firmwareResponse = await fetch(firmwareUrl);

				if (!firmwareResponse.ok) {
					throw new FirmwareDownloadError(
						`Failed to download firmware from ${release.tag_name}: ${firmwareResponse.status} ${firmwareResponse.statusText}`
					);
				}

				const firmwareArrayBuffer = await firmwareResponse.arrayBuffer();
				const firmwareData = new Uint8Array(firmwareArrayBuffer);

				if (firmwareEntry.size !== firmwareData.length) {
					throw new FirmwareDownloadError(
						`Firmware size verification failed for ${firmwareEntry.filename}. Expected: ${firmwareEntry.size}, Got: ${firmwareData.length}`
					);
				}

				await verifyChecksum(firmwareData, firmwareEntry.checksum);

				return {
					fileName: firmwareEntry.filename,
					data: firmwareData,
				};
			} catch (error) {
				lastReleaseError = error;
				continue;
			}
		}

		if (lastReleaseError) {
			throw new FirmwareDownloadError(
				`Unable to download ${ZWA2_FIRMWARE_PREFIX} firmware from available releases`,
				lastReleaseError
			);
		}

		throw new FirmwareDownloadError(
			`No ${ZWA2_FIRMWARE_PREFIX} firmware found in available release manifests`
		);

	} catch (error) {
		if (error instanceof FirmwareDownloadError) {
			throw error;
		}
		throw new FirmwareDownloadError(
			`Unexpected error during firmware download: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}

/**
 * Converts a File object to raw data that can be passed to flashFirmware
 * @param firmwareFile The File object to convert
 * @returns Promise resolving to firmware file name and raw data
 */
export async function openFirmwareFile(firmwareFile: File): Promise<FirmwareFileResult> {
	const data = new Uint8Array(await firmwareFile.arrayBuffer());
	return {
		fileName: firmwareFile.name,
		data: data
	};
}

/**
 * Calculate SHA256 checksum of data using Web Crypto API
 */
async function calculateSHA256(data: Uint8Array): Promise<string> {
	const hashBuffer = await crypto.subtle.digest('SHA-256', data.slice());
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyChecksum(data: Uint8Array, checksum: string): Promise<void> {
	const [algorithm, expectedHash] = checksum.split(':', 2);

	if (!algorithm || !expectedHash) {
		throw new FirmwareDownloadError(`Invalid checksum format: ${checksum}`);
	}

	let actualHash: string;

	if (algorithm.toLowerCase() === 'sha256') {
		actualHash = await calculateSHA256(data);
	} else if (algorithm.toLowerCase() === 'sha3-256') {
		actualHash = bytesToHex(sha3_256(data));
	} else {
		throw new FirmwareDownloadError(`Unsupported checksum algorithm: ${algorithm}`);
	}

	if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
		throw new FirmwareDownloadError(
			`Checksum verification failed. Expected: ${expectedHash}, Got: ${actualHash}`
		);
	}
}
