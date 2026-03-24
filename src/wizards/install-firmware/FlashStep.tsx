import type { WizardStepProps } from "../../components/Wizard";
import type { InstallFirmwareState } from "./wizard";
import CircularProgress from "../../components/CircularProgress";
import Spinner from "../../components/Spinner";

export default function FlashStep({
	context,
}: WizardStepProps<InstallFirmwareState>) {
	const {
		isFlashing,
		progress,
		flashResult,
		downloadedFirmwareName,
		isDownloading,
		currentSubStep,
	} = context.state;

	if (flashResult !== null) {
		return (
			<div className="text-center py-8">
				<div className="text-gray-600 dark:text-gray-300">
					<p>
						Installation process completed. Click "Next" to see the
						results.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="text-center py-8">
			{isDownloading && (
				<>
					<Spinner size="h-8 w-8" className="inline-block mb-4" />
					<h3 className="text-lg font-medium text-primary mb-2">
						Downloading firmware
					</h3>
					<p className="text-gray-600 dark:text-gray-300">
						{downloadedFirmwareName
							? `Downloading ${downloadedFirmwareName}...`
							: "Preparing to download firmware..."}
					</p>
				</>
			)}

			{isFlashing && !isDownloading && currentSubStep === 1 && (
				<>
					<CircularProgress progress={progress} className="mb-4" />
					<h3 className="text-lg font-medium text-primary mb-2">
						Installing firmware
					</h3>
					<p className="text-gray-600 dark:text-gray-300">
						Installing {downloadedFirmwareName}...
					</p>
				</>
			)}

			{isFlashing && !isDownloading && currentSubStep === 2 && (
				<>
					<Spinner size="h-8 w-8" className="inline-block mb-4" />
					<h3 className="text-lg font-medium text-primary mb-2">
						Erasing NVM
					</h3>
					<p className="text-gray-600 dark:text-gray-300">
						Erasing NVM data... Please do not disconnect the device.
					</p>
				</>
			)}

			{isFlashing && !isDownloading && currentSubStep === 3 && (
				<>
					<Spinner size="h-8 w-8" className="inline-block mb-4" />
					<h3 className="text-lg font-medium text-primary mb-2">
						Starting application
					</h3>
					<p className="text-gray-600 dark:text-gray-300">
						Starting application... Please do not disconnect the device.
					</p>
				</>
			)}
		</div>
	);
}
