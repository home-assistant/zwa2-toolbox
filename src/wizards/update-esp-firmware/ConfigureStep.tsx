import { useEffect, useRef } from 'react';
import { WifiIcon } from '@heroicons/react/24/outline';
import type { WizardStepProps } from '../../components/Wizard';
import type { UpdateESPFirmwareState } from './wizard';
import 'improv-wifi-serial-sdk/dist/web/serial-launch-button';
import Alert from '../../components/Alert';

// Extend JSX to include the custom element
declare module 'react' {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace JSX {
		interface IntrinsicElements {
			'improv-wifi-serial-launch-button': React.DetailedHTMLProps<
				React.HTMLAttributes<HTMLElement> & {
					children?: React.ReactNode;
				},
				HTMLElement
			>;
		}
	}
}

interface ImprovClosedEvent extends CustomEvent {
	detail: {
		improv: boolean;
		provisioned: boolean;
	};
}

export default function ConfigureStep({ context }: WizardStepProps<UpdateESPFirmwareState>) {
	const improvButtonRef = useRef<HTMLElement | null>(null);
	const handledClosedRef = useRef<boolean>(false);

	// Extract stable references from context
	const setState = context.setState;
	const goToStep = context.goToStep;
	const configureState = context.state.configureState;

	// Auto-navigate to Summary after successful provisioning
	useEffect(() => {
		if (configureState.status === 'success') {
			goToStep('Summary');
		}
	}, [configureState.status, goToStep]);

	// Set up event listener for the improv-wifi component
	useEffect(() => {
		// Only set up the listener when we're in ready or error state
		if (configureState.status !== 'ready' && configureState.status !== 'error') {
			return;
		}

		const improvButton = improvButtonRef.current;
		if (!improvButton) {
			return;
		}

		const handleClosed = (event: Event) => {
			// Only handle the closed event once
			if (handledClosedRef.current) {
				return;
			}
			handledClosedRef.current = true;

			const improvEvent = event as ImprovClosedEvent;
			const { improv, provisioned } = improvEvent.detail;

			if (!improv) {
				// Device doesn't support Improv
				setState((prev) => ({
					...prev,
					configureState: {
						status: 'error',
						errorMessage: 'Device does not support Improv WiFi',
						previouslyFailed: true,
					},
				}));
				// Don't navigate automatically on error - allow retry
			} else if (provisioned) {
				// Successfully provisioned
				setState((prev) => ({
					...prev,
					configureState: { status: 'success', ssid: 'configured network' },
				}));
				// Don't navigate here - let the useEffect below handle it
			} else {
				// Dialog was closed without provisioning
				setState((prev) => ({
					...prev,
					configureState: { status: 'skipped' },
				}));
				// Navigate to Summary when user explicitly skips
				goToStep('Summary');
			}
		};

		improvButton.addEventListener('closed', handleClosed);

		return () => {
			improvButton.removeEventListener('closed', handleClosed);
		};
	}, [setState, goToStep, configureState.status]);

	// Show waiting for startup spinner
	if (configureState.status === 'waiting-for-startup') {
		return (
			<div className="text-center py-8">
				<div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
				<p className="text-gray-600 dark:text-gray-300">
					Set up WiFi credentials for your ZWA-2
				</p>
			</div>
		);
	}

	// Show configuration form with improv-wifi component (only when ready or after error)
	if (configureState.status === 'ready' || configureState.status === 'error') {
		return (
		<div className="flex flex-col items-center py-8 space-y-6 max-w-md mx-auto">
			<div className="text-purple-600 dark:text-purple-400">
				<WifiIcon className="w-16 h-16" />
			</div>
			<div className="text-center">
				<h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
					Configure WiFi
				</h3>
				<p className="text-gray-600 dark:text-gray-300">
					Set up WiFi credentials for your ZWA-2
				</p>
			</div>

			<improv-wifi-serial-launch-button ref={improvButtonRef}>
				<button
					slot="activate"
					className="w-full rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-purple-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 dark:bg-purple-500 dark:hover:bg-purple-400"
				>
					{context.state.configureState.status === 'error' ? 'Try again' : 'Configure WiFi Credentials'}
				</button>
			</improv-wifi-serial-launch-button>

			<Alert title="Note">
				<p>
					You can skip this step, but you won't be able to use the ZWA-2 until it's connected to WiFi.
				</p>
			</Alert>

		</div>
		);
	}

	// Fallback for other states
	return (
		<div className="text-center py-8">
			<p className="text-gray-600 dark:text-gray-300">
				Preparing WiFi configuration...
			</p>
		</div>
	);
}
