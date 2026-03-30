import { useEffect, useState, useCallback } from "react";
import type { WizardStepProps } from "../../components/Wizard";
import type { ConfigureState } from "./wizard";
import { applyRegionConfiguration } from "./wizard";
import Spinner from "../../components/Spinner";
import Alert from "../../components/Alert";
import { generateRepeaterQRCode } from "../../lib/qr-code";

const RF_REGIONS = [
	{ label: "Europe", value: "EU" },
	{ label: "USA", value: "US" },
	{ label: "Australia/New Zealand", value: "ANZ" },
	{ label: "Hong Kong", value: "HK" },
	{ label: "India", value: "IN" },
	{ label: "Israel", value: "IL" },
	{ label: "Russia", value: "RU" },
	{ label: "China", value: "CN" },
	{ label: "Japan", value: "JP" },
	{ label: "Korea", value: "KR" },
] as const;

const FIRMWARE_TYPE_LABELS = {
	controller: "Controller",
	repeater: "Repeater",
	zniffer: "Zniffer",
} as const;

function SmartStartQRCode({ dsk }: { dsk: string }) {
	const [svgMarkup, setSvgMarkup] = useState<string | null>(null);

	useEffect(() => {
		generateRepeaterQRCode(dsk)
			.then(setSvgMarkup)
			.catch((err) => {
				console.error("Failed to generate QR code:", err);
			});
	}, [dsk]);

	if (!svgMarkup) return null;

	return (
		<div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
			<p className="font-medium text-blue-800 dark:text-blue-300 mb-3">
				Scan QR code to join via SmartStart:
			</p>
			<div className="flex flex-col items-center">
				<div
					className="w-64 bg-white rounded-lg overflow-hidden [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
					dangerouslySetInnerHTML={{ __html: svgMarkup }}
				/>
				<p className="mt-3 font-mono text-sm text-blue-900 dark:text-blue-100 select-all break-all">
					DSK:{" "}
					<span className="font-bold underline">
						{dsk.slice(0, 5)}
					</span>
					{dsk.slice(5)}
				</p>
			</div>
		</div>
	);
}

function RepeaterConfiguration({
	context,
}: WizardStepProps<ConfigureState>) {
	const { selectedRegion, configureStatus, configureError, dsk } =
		context.state;

	const handleApply = useCallback(async () => {
		await applyRegionConfiguration(context);
	}, [context]);

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
						onClick={handleApply}
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
