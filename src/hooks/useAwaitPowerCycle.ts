import { useEffect, useRef } from 'react';

/**
 * Waits for the user to unplug and replug the device, then calls `onRestarted`.
 * A device that is already gone counts as restarted.
 *
 * The port and the callback must stay out of the effect's dependencies. Both
 * change while the wait is running, and a re-run would call `onRestarted` twice.
 */
export function useAwaitPowerCycle(
	serialPort: SerialPort | null,
	active: boolean,
	onRestarted: () => void | Promise<void>,
): void {
	const latest = useRef({ serialPort, onRestarted });
	latest.current = { serialPort, onRestarted };

	useEffect(() => {
		if (!active) return;
		let cancelled = false;

		void (async () => {
			const port = latest.current.serialPort;
			if (port) {
				const { awaitESPRestart } = await import('../lib/esp-utils');
				await awaitESPRestart(port);
			}
			if (!cancelled) await latest.current.onRestarted();
		})();

		return () => {
			cancelled = true;
		};
	}, [active]);
}
