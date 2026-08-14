import type { RestoreBootloaderKeysStepProps } from './wizard';
import wiringPhoto from '../../assets/zwa2-swd-wiring.jpg';

export default function PrepareStep({ context }: RestoreBootloaderKeysStepProps) {
  const { preparationConfirmed } = context.state;

  return (
    <div className="py-8">
      <h3 className="text-lg font-medium text-primary mb-4">Prepare the ZWA-2 for repair</h3>

      <ol className="list-decimal pl-6 space-y-3 text-gray-600 dark:text-gray-300">
        <li>Unplug the ZWA-2</li>
        <li>Remove the rubber feet at the bottom and unscrew the 4 screws</li>
        <li>Unscrew the antenna and gently lift the top cover</li>
        <li>
          Connect the ESP GPIO pins (top right of the board) to the SWD interface (center
          left) using male-to-female jumper (Dupont) wires:
          <ul className="list-disc pl-6 mt-1 space-y-1">
            <li>GPIO5 &rarr; SWCLK</li>
            <li>GPIO6 &rarr; SWDIO</li>
          </ul>
          <img
            src={wiringPhoto}
            alt="Two jumper wires running from the ESP GPIO pins to the SWD interface on the ZWA-2 board"
            className="my-3 w-full max-w-xl rounded-lg"
          />
          <p>
            Make sure the wires sit firmly. If necessary, hold them steady or tape them
            down with scotch tape.
          </p>
        </li>
        <li>Plug the ZWA-2 back in</li>
      </ol>

      <label className="mt-6 flex items-start gap-3">
        <input
          type="checkbox"
          checked={preparationConfirmed}
          onChange={(e) =>
            context.setState((prev) => ({ ...prev, preparationConfirmed: e.target.checked }))
          }
          className="mt-1 size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-white/20 dark:bg-white/5"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          The wires are connected and the ZWA-2 is plugged back in.
        </span>
      </label>
    </div>
  );
}
