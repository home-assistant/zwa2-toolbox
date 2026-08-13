/**
 * Holds the EFR32ZG23's bootloader key tokens and the word-aligned flash spans
 * they are written through.
 *
 * The signing key is the public half of the vendor signing key. The encryption
 * key is the AES key the bootloader decrypts GBL images with. Both are already
 * published in the Nabu Casa firmware repositories.
 *
 * The addresses come from `btl_security_tokens.h`. The word tables were read
 * back from a working ZWA-2 with a J-Link, which is what fixes the byte order.
 */

/** Signing key X and Y sit next to each other and form one 64-byte burst. */
export const SIGN_SPAN_ADDR = 0x0807e34c;

/**
 * The encryption key sits at 0x0807e286, which is only halfword-aligned. Its
 * burst therefore widens to the word below and pads with 0xff on both sides.
 * Padding with 0xff clears no bits in the neighbouring cells.
 */
export const ENC_SPAN_ADDR = 0x0807e284;

/**
 * `SIGN_SPAN_WORDS` holds MFG_SIGNED_BOOTLOADER_KEY_X followed by _Y,
 * little-endian per word.
 */
export const SIGN_SPAN_WORDS: readonly number[] = [
	0x5df190a3, 0x81c683c6, 0xbc2c2336, 0x9c5fbc09,
	0x02a7ac6a, 0x8c0db20e, 0xf1c47e51, 0xa0a8488a,
	0x59ab55fc, 0x19b500a9, 0xfbbae79b, 0xc8bc771b,
	0x5ff18686, 0xacfef3fd, 0x7859eede, 0x7d11b6c1,
];

/**
 * `ENC_SPAN_WORDS` holds 0xffff, MFG_SECURE_BOOTLOADER_KEY and 0xffff,
 * little-endian per word.
 */
export const ENC_SPAN_WORDS: readonly number[] = [
	0x8f7fffff, 0xb37939e5, 0xfc56c51b, 0xf4af31b1, 0xffff1424,
];

function spanBytes(words: readonly number[]): Uint8Array {
	const bytes = new Uint8Array(words.length * 4);
	words.forEach((word, i) => {
		bytes[i * 4] = word & 0xff;
		bytes[i * 4 + 1] = (word >>> 8) & 0xff;
		bytes[i * 4 + 2] = (word >>> 16) & 0xff;
		bytes[i * 4 + 3] = (word >>> 24) & 0xff;
	});
	return bytes;
}

const signBytes = spanBytes(SIGN_SPAN_WORDS);

// The `EXPECTED_` values match what the debugger firmware's `read` command
// prints, so they carry no padding.
export const EXPECTED_SIGN_X = signBytes.subarray(0, 32);
export const EXPECTED_SIGN_Y = signBytes.subarray(32, 64);
export const EXPECTED_ENC = spanBytes(ENC_SPAN_WORDS).subarray(2, 18);
