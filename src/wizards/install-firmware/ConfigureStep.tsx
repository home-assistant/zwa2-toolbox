import type { WizardStepProps } from "../../components/Wizard";
import type { InstallFirmwareState } from "./wizard";
import Spinner from "../../components/Spinner";
import Alert from "../../components/Alert";

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

export default function ConfigureStep({
	context,
}: WizardStepProps<InstallFirmwareState>) {
	const { selectedRegion, configureStatus, configureError } = context.state;

	if (configureStatus === "configuring") {
		return (
			<div className="text-center py-8">
				<Spinner size="h-8 w-8" className="inline-block mb-4" />
				<h3 className="text-lg font-medium text-primary mb-2">
					Configuring RF region...
				</h3>
				<p className="text-gray-600 dark:text-gray-300">
					Please do not disconnect the device.
				</p>
			</div>
		);
	}

	return (
		<div className="py-8">
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

			<div>
				<label
					htmlFor="rf-region"
					className="block text-sm font-medium text-primary mb-1"
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
						<option key={region.value} value={region.value}>
							{region.label}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}
