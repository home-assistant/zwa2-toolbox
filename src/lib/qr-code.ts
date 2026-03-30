import QRCode from "qrcode-svg";
import {
	QRCodeVersion,
	type QRProvisioningInformation as QRProvisioningInformationFull,
	ProvisioningInformationType,
} from "@zwave-js/core";
import { SecurityClass, Protocols } from "@zwave-js/core/definitions";

const Z = "Z".charCodeAt(0);

/** Writes a number between 0 and 99 (2 decimal digits) */
function level(val: number): string {
	return val.toString(10).padStart(2, "0");
}

/** Writes a byte (3 decimal digits) */
function uint8(val: number): string {
	return val.toString(10).padStart(3, "0");
}

/** Writes a 2-byte value (5 decimal digits) */
function uint16(val: number): string {
	return val.toString(10).padStart(5, "0");
}

function encodeTLV(
	type: ProvisioningInformationType,
	critical: boolean,
	data: string,
): string {
	const typeCritical = (type << 1) | (critical ? 1 : 0);
	return `${level(typeCritical)}${level(data.length)}${data}`;
}

/** Serializes a numeric array into a bit mask */
function encodeBitMask(
	values: readonly number[],
	maxValue: number = Math.max(...values),
	startValue: number = 1,
): number {
	let ret = 0;
	for (let val = startValue; val <= maxValue; val++) {
		if (!values.includes(val)) continue;
		ret |= 2 ** (val - startValue);
	}
	return ret;
}

function dskFromString(dsk: string): number[] {
	return dsk.split("-").map((part) => parseInt(part, 10));
}

export type QRProvisioningInformation = Omit<
	QRProvisioningInformationFull,
	"requestedSecurityClasses"
>;

export async function generateQRCodeSVG(
	info: QRProvisioningInformation,
	size: number = 256,
): Promise<string> {
	const partsAfterChecksum: string[] = [];

	const securityClasses = uint8(
		encodeBitMask(
			info.securityClasses,
			undefined,
			SecurityClass.S2_Unauthenticated,
		),
	);
	partsAfterChecksum.push(securityClasses);

	const dsk = dskFromString(info.dsk).map((part) => uint16(part));
	partsAfterChecksum.push(...dsk);

	const productType = encodeTLV(
		ProvisioningInformationType.ProductType,
		false,
		[
			uint16(
				(info.genericDeviceClass << 8) | info.specificDeviceClass,
			),
			uint16(info.specificDeviceClass),
		].join(""),
	);
	partsAfterChecksum.push(productType);

	const applicationVersion = info.applicationVersion
		.split(".", 2)
		.map((part) => parseInt(part, 10));
	const productId = encodeTLV(
		ProvisioningInformationType.ProductId,
		false,
		[
			uint16(info.manufacturerId),
			uint16(info.productType),
			uint16(info.productId),
			uint16((applicationVersion[0] << 8) | applicationVersion[1]),
		].join(""),
	);
	partsAfterChecksum.push(productId);

	if (info.supportedProtocols !== undefined) {
		const supportedProtocols = encodeTLV(
			ProvisioningInformationType.SupportedProtocols,
			false,
			level(
				encodeBitMask(
					info.supportedProtocols,
					undefined,
					Protocols.ZWave,
				),
			),
		);
		partsAfterChecksum.push(supportedProtocols);
	}

	// Calculate the checksum: first 16 bits of the SHA-1 of the rest
	const textAfterChecksum = partsAfterChecksum.join("");
	const checksumData = new TextEncoder().encode(textAfterChecksum);
	const checksumBuffer = Array.from(
		new Uint8Array(
			await window.crypto.subtle.digest("SHA-1", checksumData),
		),
	);
	const checksum = (checksumBuffer[0] << 8) | checksumBuffer[1];

	const text = `${level(Z)}${level(info.version)}${uint16(checksum)}${textAfterChecksum}`;
	const svg = new QRCode({
		content: text,
		container: "svg",
		xmlDeclaration: false,
		width: size,
		height: size,
	}).svg();

	return svg;
}

/**
 * Generates a SmartStart QR code SVG for a ZWA-2 repeater.
 * Uses fixed product identifiers for the ZWA-2 repeater hardware.
 */
export async function generateRepeaterQRCode(
	dsk: string,
	size: number = 256,
): Promise<string> {
	return generateQRCodeSVG(
		{
			version: QRCodeVersion.SmartStart,
			securityClasses: [
				SecurityClass.S2_Authenticated,
				SecurityClass.S2_Unauthenticated,
			],
			dsk,
			// Repeater device class
			genericDeviceClass: 0x0f, // GENERIC_TYPE_REPEATER_SLAVE
			specificDeviceClass: 0x01, // SPECIFIC_TYPE_REPEATER_SLAVE
			installerIconType: 0x0700, // ICON_TYPE_GENERIC_REPEATER
			// Nabu Casa ZWA-2 product identifiers
			manufacturerId: 0x0466,
			productType: 0x0001,
			productId: 0x0001,
			applicationVersion: "0.0", // Until we know better
			supportedProtocols: [Protocols.ZWave],
		},
		size,
	);
}
