/**
 * Utility functions for downloading ESP firmware from ESPHome manifest files
 */

export interface ESPFirmwareDownloadResult {
	fileName: string;
	data: Uint8Array;
	offset: number;
}

export class ESPFirmwareDownloadError extends Error {
	public readonly cause?: unknown;

	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = 'ESPFirmwareDownloadError';
		this.cause = cause;
	}
}

export interface ESPFirmwareReleaseInfo {
	version: string;
	changelog: string;
	downloadUrl: string;
	fileName: string;
	offset: number;
}

/**
 * ESPHome manifest structure
 */
interface ESPHomeManifest {
	name: string;
	version: string;
	home_assistant_domain?: string;
	new_install_prompt_erase?: boolean;
	builds: ESPHomeBuild[];
}

interface ESPHomeBuild {
	chipFamily: string;
	ota?: {
		path: string;
		md5: string;
		summary?: string;
		release_url?: string;
	};
	parts: ESPHomePart[];
}

interface ESPHomePart {
	path: string;
	offset: number;
}

/**
 * Fetch firmware information from an ESPHome manifest
 * @param manifestUrl The URL of the manifest file
 * @param changelogUrlTemplate Optional function to generate changelog URL from version
 * @returns Promise resolving to firmware release information including download URL
 * @throws ESPFirmwareDownloadError if fetch fails
 */
export async function fetchManifestFirmwareInfo(
	manifestUrl: string,
	changelogUrlTemplate?: (version: string) => string
): Promise<ESPFirmwareReleaseInfo> {
	try {
		const manifestResponse = await fetch(manifestUrl);

		if (!manifestResponse.ok) {
			throw new ESPFirmwareDownloadError(
				`Failed to fetch manifest: ${manifestResponse.status} ${manifestResponse.statusText}`
			);
		}

		const manifest: ESPHomeManifest = await manifestResponse.json();

		// Find the build for ESP32-S3
		const esp32s3Build = manifest.builds.find(build => build.chipFamily === "ESP32-S3");
		if (!esp32s3Build) {
			throw new ESPFirmwareDownloadError(
				"No build found for chipFamily ESP32-S3 in manifest"
			);
		}

		// Get the first part (factory firmware)
		const factoryPart = esp32s3Build.parts[0];
		if (!factoryPart) {
			throw new ESPFirmwareDownloadError(
				"No factory firmware part found in ESP32-S3 build"
			);
		}

		// Construct the full image URL (relative to manifest URL)
		const manifestBaseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/'));
		const downloadUrl = `${manifestBaseUrl}/${factoryPart.path}`;

		// Extract filename from path
		const fileName = factoryPart.path.split('/').pop() || 'firmware.bin';

		let changelog = "No changelog available.";

		// Try to get changelog from various sources
		if (changelogUrlTemplate) {
			// Use the provided changelog URL template
			try {
				const changelogUrl = changelogUrlTemplate(manifest.version);
				
				// Check if this is a GitHub release URL and convert to API endpoint
				const githubReleaseMatch = changelogUrl.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/(.+)/);
				if (githubReleaseMatch) {
					const [, owner, repo, tag] = githubReleaseMatch;
					const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;
					
					const apiResponse = await fetch(apiUrl);
					if (apiResponse.ok) {
						const releaseData = await apiResponse.json();
						changelog = releaseData.body || "No changelog available.";
					}
				} else {
					// For non-GitHub URLs, fetch as before
					const changelogResponse = await fetch(changelogUrl);
					if (changelogResponse.ok) {
						changelog = await changelogResponse.text();
					}
				}
			} catch (error) {
				console.warn("Failed to fetch changelog from URL template:", error);
			}
		} else if (esp32s3Build.ota?.summary) {
			// Use the summary from the OTA section
			changelog = esp32s3Build.ota.summary;
		}

		return {
			version: manifest.version,
			changelog,
			downloadUrl,
			fileName,
			offset: factoryPart.offset,
		};

	} catch (error) {
		if (error instanceof ESPFirmwareDownloadError) {
			throw error;
		}
		throw new ESPFirmwareDownloadError(
			`Unexpected error during manifest firmware info fetch: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}

/**
 * Downloads firmware from a URL
 * @param downloadUrl The URL to download the firmware from
 * @returns Promise resolving to firmware data
 * @throws ESPFirmwareDownloadError if download fails
 */
export async function downloadFirmware(downloadUrl: string): Promise<Uint8Array> {
	try {
		const firmwareResponse = await fetch(downloadUrl);

		if (!firmwareResponse.ok) {
			throw new ESPFirmwareDownloadError(
				`Failed to download firmware: ${firmwareResponse.status} ${firmwareResponse.statusText}`
			);
		}

		const firmwareArrayBuffer = await firmwareResponse.arrayBuffer();
		return new Uint8Array(firmwareArrayBuffer);

	} catch (error) {
		if (error instanceof ESPFirmwareDownloadError) {
			throw error;
		}
		throw new ESPFirmwareDownloadError(
			`Unexpected error during firmware download: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}
