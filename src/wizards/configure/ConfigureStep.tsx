import type { WizardStepProps } from "../../components/Wizard";
import type { ConfigureState } from "./wizard";
import {
	applyRepeaterRegionConfiguration,
	applyControllerRegionConfiguration,
	toggleLED,
	toggleTiltIndicator,
} from "./wizard";
import Spinner from "../../components/Spinner";
import Alert from "../../components/Alert";
import SmartStartQRCode from "../../components/SmartStartQRCode";
import { RF_REGIONS, FIRMWARE_TYPE_LABELS } from "../../lib/regions";

function RepeaterConfiguration({
	context,
}: WizardStepProps<ConfigureState>) {
	const { selectedRegion, configureStatus, configureError, dsk } =
		context.state;

	return (
		<div>
			<h3 className="text-lg font-medium text-primary mb-2">
				Configure RF Region
			</h3>
			<p className="text-gray-600 dark:text-gray-300 mb-6">
				Select the RF region for your Z-Wave repeater. This must match
				the region of the Z-Wave network you want to join.
			</p>

			{configureError && (
				<div className="mb-6">
					<Alert title="Configuration failed" severity="error">
						<p>{configureError}</p>
					</Alert>
				</div>
			)}

			{configureStatus === "configuring" ? (
				<div className="flex items-center gap-3">
					<Spinner size="h-5 w-5" />
					<span className="text-secondary">
						Configuring RF region...
					</span>
				</div>
			) : (
				<div className="flex items-center gap-3">
					<div>
						<label
							htmlFor="rf-region"
							className="sr-only"
						>
							RF Region
						</label>
						<select
							id="rf-region"
							value={selectedRegion ?? ""}
							onChange={(e) =>
								context.setState((prev) => ({
									...prev,
									selectedRegion: e.target.value || null,
									configureStatus: "idle",
									configureError: null,
								}))
							}
							style={{ width: "16rem" }}
							className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-3 pr-10 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
						>
							<option value="">Select a region...</option>
							{RF_REGIONS.map((region) => (
								<option
									key={region.value}
									value={region.value}
								>
									{region.label}
								</option>
							))}
						</select>
					</div>
					<button
						onClick={() => applyRepeaterRegionConfiguration(context)}
						disabled={!selectedRegion || selectedRegion === context.state.currentRegion}
						className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-400"
					>
						Apply
					</button>
				</div>
			)}

			{configureStatus === "success" && (
				<p className="mt-3 text-sm text-green-600 dark:text-green-400">
					RF region configured successfully.
				</p>
			)}

			{dsk && <SmartStartQRCode dsk={dsk} />}
		</div>
	);
}

function Toggle({
	label,
	description,
	enabled,
	toggling,
	onToggle,
}: {
	label: string;
	description: string;
	enabled: boolean;
	toggling: boolean;
	onToggle: (enabled: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between">
			<div>
				<p className="text-sm font-medium text-primary">{label}</p>
				<p className="text-sm text-secondary">{description}</p>
			</div>
			{toggling ? (
				<Spinner size="h-5 w-5" />
			) : (
				<button
					type="button"
					role="switch"
					aria-checked={enabled}
					onClick={() => onToggle(!enabled)}
					className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
						enabled
							? "bg-blue-600 dark:bg-blue-500"
							: "bg-gray-200 dark:bg-gray-700"
					}`}
				>
					<span
						aria-hidden="true"
						className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
							enabled ? "translate-x-5" : "translate-x-0"
						}`}
					/>
				</button>
			)}
		</div>
	);
}

function ControllerConfiguration({
	context,
}: WizardStepProps<ConfigureState>) {
	const {
		selectedRegion,
		configureStatus,
		configureError,
		supportedRegions,
		ledEnabled,
		tiltIndicatorEnabled,
		togglingLed,
		togglingTilt,
	} = context.state;

	return (
		<div className="space-y-8">
			{/* Region selector */}
			<div>
				<h3 className="text-lg font-medium text-primary mb-2">
					RF Region
				</h3>
				<p className="text-gray-600 dark:text-gray-300 mb-4">
					Select the RF region for your Z-Wave controller.
				</p>

				{configureError && (
					<div className="mb-4">
						<Alert title="Configuration failed" severity="error">
							<p>{configureError}</p>
						</Alert>
					</div>
				)}

				{configureStatus === "configuring" ? (
					<div className="flex items-center gap-3">
						<Spinner size="h-5 w-5" />
						<span className="text-secondary">
							Configuring RF region...
						</span>
					</div>
				) : (
					<div className="flex items-center gap-3">
						<div>
							<label
								htmlFor="rf-region-ctrl"
								className="sr-only"
							>
								RF Region
							</label>
							<select
								id="rf-region-ctrl"
								value={selectedRegion != null ? String(selectedRegion) : ""}
								onChange={(e) => {
									const val = e.target.value;
									context.setState((prev) => ({
										...prev,
										selectedRegion: val ? Number(val) : null,
										configureStatus: "idle",
										configureError: null,
									}));
								}}
								style={{ width: "16rem" }}
								className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-3 pr-10 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
							>
								<option value="">Select a region...</option>
								{supportedRegions.map((region) => (
									<option
										key={region.value}
										value={String(region.value)}
										disabled={region.disabled}
									>
										{region.label}
									</option>
								))}
							</select>
						</div>
						<button
							onClick={() => applyControllerRegionConfiguration(context)}
							disabled={
								selectedRegion == null ||
								selectedRegion === context.state.currentRegion
							}
							className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-400"
						>
							Apply
						</button>
					</div>
				)}

				{configureStatus === "success" && (
					<p className="mt-3 text-sm text-green-600 dark:text-green-400">
						RF region configured successfully.
					</p>
				)}
			</div>

			{/* LED and Tilt toggles */}
			{(ledEnabled != null || tiltIndicatorEnabled != null) && (
				<div>
					<h3 className="text-lg font-medium text-primary mb-4">
						Device Settings
					</h3>
					<div className="space-y-4">
						{ledEnabled != null && (
							<Toggle
								label="LED"
								description="Turn the status LED on or off."
								enabled={ledEnabled}
								toggling={togglingLed}
								onToggle={(enabled) => toggleLED(context, enabled)}
							/>
						)}
						{tiltIndicatorEnabled != null && (
							<Toggle
								label="Tilt indicator"
								description="Show LED feedback when the device is tilted."
								enabled={tiltIndicatorEnabled}
								toggling={togglingTilt}
								onToggle={(enabled) => toggleTiltIndicator(context, enabled)}
							/>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function UnconfigurableFirmware({
	firmwareType,
}: {
	firmwareType: string;
}) {
	return (
		<div className="text-center py-4">
			<div className="text-gray-400 dark:text-gray-500 mb-4">
				<svg
					className="w-16 h-16 mx-auto"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={1.5}
						d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
					/>
				</svg>
			</div>
			<h3 className="text-lg font-medium text-primary mb-2">
				No configuration available
			</h3>
			<p className="text-gray-600 dark:text-gray-300">
				{firmwareType} firmware does not support configuration through
				this tool.
			</p>
		</div>
	);
}

export default function ConfigureStep({
	context,
}: WizardStepProps<ConfigureState>) {
	const { detectedFirmwareType } = context.state;

	if (detectedFirmwareType === "repeater") {
		return (
			<div className="py-8">
				<RepeaterConfiguration context={context} />
			</div>
		);
	}

	if (detectedFirmwareType === "controller") {
		return (
			<div className="py-8">
				<ControllerConfiguration context={context} />
			</div>
		);
	}

	if (detectedFirmwareType != null) {
		return (
			<div className="py-8">
				<UnconfigurableFirmware
					firmwareType={
						FIRMWARE_TYPE_LABELS[detectedFirmwareType]
					}
				/>
			</div>
		);
	}

	// Unknown or undetected firmware
	return (
		<div className="py-8">
			<div className="text-center py-4">
				<div className="text-gray-400 dark:text-gray-500 mb-4">
					<svg
						className="w-16 h-16 mx-auto"
						fill="currentColor"
						viewBox="0 0 20 20"
					>
						<path
							fillRule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
							clipRule="evenodd"
						/>
					</svg>
				</div>
				<h3 className="text-lg font-medium text-primary mb-2">
					Could not detect firmware
				</h3>
				<p className="text-gray-600 dark:text-gray-300">
					Unable to determine the installed firmware type. Make sure the
					device is connected and running supported firmware.
				</p>
			</div>
		</div>
	);
}
