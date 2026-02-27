import { type BytesView } from "@zwave-js/shared";

/**
 * Utility functions for downloading and verifying Z-Wave firmware from GitHub
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
	assets: GitHubAsset[];
}

interface GitHubAsset {
	name: string;
	browser_download_url: string;
	digest?: string;
}

/**
 * Downloads the latest Z-Wave firmware from the GitHub repository
 * @returns Promise resolving to firmware file name and data
 * @throws FirmwareDownloadError if download or verification fails
 */
export async function downloadLatestFirmware(): Promise<FirmwareDownloadResult> {
	try {
		// Fetch the latest release information
		const releaseResponse = await fetch(
			'https://api.github.com/repos/NabuCasa/zwave-firmware/releases/latest'
		);

		if (!releaseResponse.ok) {
			throw new FirmwareDownloadError(
				`Failed to fetch release information: ${releaseResponse.status} ${releaseResponse.statusText}`
			);
		}

		const release: GitHubRelease = await releaseResponse.json();

		// Find the GBL file in the assets
		const gblAsset = release.assets.find(asset =>
			asset.name.toLowerCase().endsWith('.gbl')
		);

		if (!gblAsset) {
			throw new FirmwareDownloadError(
				`No GBL firmware file found in release ${release.tag_name}`
			);
		}

		// Extract expected checksum from the digest property
		let expectedChecksum: string | null = null;
		if (gblAsset.digest) {
			// The digest format is "sha256:hash"
			const digestMatch = gblAsset.digest.match(/^sha256:([a-fA-F0-9]{64})$/);
			if (digestMatch) {
				expectedChecksum = digestMatch[1];
			}
		}

		// Download the firmware file through a CORS proxy
		// GitHub doesn't provide CORS headers for release downloads, so we need a proxy
		const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(gblAsset.browser_download_url)}`;
		const firmwareResponse = await fetch(proxyUrl);

		if (!firmwareResponse.ok) {
			throw new FirmwareDownloadError(
				`Failed to download firmware: ${firmwareResponse.status} ${firmwareResponse.statusText}`
			);
		}

		const firmwareArrayBuffer = await firmwareResponse.arrayBuffer();
		const firmwareData = new Uint8Array(firmwareArrayBuffer);

		// Verify checksum if available
		if (expectedChecksum) {
			const actualChecksum = await calculateSHA256(firmwareData);
			if (actualChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
				throw new FirmwareDownloadError(
					`Checksum verification failed. Expected: ${expectedChecksum}, Got: ${actualChecksum}`
				);
			}
		}

		return {
			fileName: gblAsset.name,
			data: firmwareData
		};

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
