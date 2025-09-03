/**
 * Utility functions for downloading ESP firmware
 */

export interface ESPFirmwareDownloadResult {
	fileName: string;
	data: Uint8Array;
}

export class ESPFirmwareDownloadError extends Error {
	public readonly cause?: unknown;

	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = 'ESPFirmwareDownloadError';
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
	digest: string;
}

/**
 * Downloads the latest ESP bridge firmware from the GitHub repository
 * @returns Promise resolving to firmware file name and data
 * @throws ESPFirmwareDownloadError if download or verification fails
 */
export async function downloadLatestESPFirmware(): Promise<ESPFirmwareDownloadResult> {
	try {
		// Fetch the latest release information for ESP firmware
		const releaseResponse = await fetch(
			'https://api.github.com/repos/NabuCasa/zwave-esp-bridge/releases/latest'
		);

		if (!releaseResponse.ok) {
			throw new ESPFirmwareDownloadError(
				`Failed to fetch ESP release information: ${releaseResponse.status} ${releaseResponse.statusText}`
			);
		}

		const release: GitHubRelease = await releaseResponse.json();

		// Find the ZWA-2 factory.bin file in the assets
		const binAsset = release.assets.find(asset =>
			asset.name.toLowerCase().startsWith('zwa2') &&
			asset.name.toLowerCase().endsWith('.factory.bin')
		);

		if (!binAsset) {
			throw new ESPFirmwareDownloadError(
				`No ZWA-2 factory.bin firmware file found in release ${release.tag_name}`
			);
		}

		// Extract expected checksum from the digest field
		// GitHub provides this in the format "sha256:hash"
		let expectedChecksum: string | null = null;
		if (binAsset.digest) {
			const digestMatch = binAsset.digest.match(/^sha256:([a-fA-F0-9]{64})$/);
			if (digestMatch) {
				expectedChecksum = digestMatch[1];
			}
		}

		// Download the firmware file through a CORS proxy
		const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(binAsset.browser_download_url)}`;
		const firmwareResponse = await fetch(proxyUrl);

		if (!firmwareResponse.ok) {
			throw new ESPFirmwareDownloadError(
				`Failed to download ESP firmware: ${firmwareResponse.status} ${firmwareResponse.statusText}`
			);
		}

		const firmwareArrayBuffer = await firmwareResponse.arrayBuffer();
		const firmwareData = new Uint8Array(firmwareArrayBuffer);

		// Verify checksum if available
		if (expectedChecksum) {
			const actualChecksum = await calculateSHA256(firmwareData);
			if (actualChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
				throw new ESPFirmwareDownloadError(
					`Checksum verification failed. Expected: ${expectedChecksum}, Got: ${actualChecksum}`
				);
			}
			console.log(`✓ Firmware checksum verified: ${actualChecksum}`);
		} else {
			console.warn("⚠️ No checksum available for verification - proceeding without verification");
		}

		return {
			fileName: binAsset.name,
			data: firmwareData
		};

	} catch (error) {
		if (error instanceof ESPFirmwareDownloadError) {
			throw error;
		}
		throw new ESPFirmwareDownloadError(
			`Unexpected error during ESP firmware download: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}

/**
 * Calculate SHA256 checksum of data using Web Crypto API
 */
async function calculateSHA256(data: Uint8Array): Promise<string> {
	const hashBuffer = await crypto.subtle.digest('SHA-256', data.slice());
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
