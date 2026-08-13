import Alert from './Alert';

interface ManualBootloaderInstructionsProps {
  deviceName: string;
}

/**
 * Tells the user how to enter the ESP bootloader by hand. Pulling GPIO0 low
 * while the device powers up works when the baud-rate sequence does not.
 */
export default function ManualBootloaderInstructions({ deviceName }: ManualBootloaderInstructionsProps) {
  return (
    <Alert title="To trigger the bootloader manually">
      <ol className="list-decimal pl-6 my-2 space-y-1">
        <li>Unplug the {deviceName} and open it up</li>
        <li>On the top right of the PCB, under "ESP GPIO pins", bridge GPIO0 and GND with something conductive</li>
        <li>Plug the {deviceName} back in</li>
        <li>Retry connecting</li>
      </ol>
      <span className="block mt-2">Don't forget to remove the bridge after flashing!</span>
    </Alert>
  );
}
