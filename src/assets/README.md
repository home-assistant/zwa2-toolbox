# Vendored assets

## `zwa2-swd-wiring.jpg`

Shows the two jumper wires the "Restore bootloader keys" wizard asks for, running
from the ESP GPIO pins to the SWD interface.

957x574, cropped to the two headers. Crop a replacement the same way rather than
downscaling the whole board: the pin labels stop being legible otherwise. The
wizard renders it at most 576 px wide.

## `zwa2-esp-swd-debugger_0.1.0-merged.bin`

The SWD debugger firmware for the ZWA-2's ESP32-S3, used by the "Restore
bootloader keys" wizard. GitHub release assets cannot be fetched from the
browser at runtime, so the image is committed here.

- Source: <https://github.com/AlCalzone/zwa2-esp-swd-debugger/releases/tag/v0.1.0>
- Asset: `zwa2-esp-swd-debugger_0.1.0-merged.bin`
- Size: 316064 bytes
- sha256: `067531647ca82a383fad4aee7724c79419739680e867b006988cc5ced813fa92`

`idf.py merge-bin` output, so it already contains the bootloader at `0x0`, the
partition table at `0x8000` and the app at `0x10000`. Flash it as a single part
at address `0x0`.

To pick up a new debugger release, download the `-merged.bin` asset, check it
against the published `.sha256`, replace the file, and update the version in the
filename, the import in `src/wizards/restore-bootloader-keys/wizard.ts`, and the
three values above.
