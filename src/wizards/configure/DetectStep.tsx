import type { WizardStepProps } from "../../components/Wizard";
import type { ConfigureState } from "./wizard";
import Spinner from "../../components/Spinner";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function DetectStep(_props: WizardStepProps<ConfigureState>) {
	return (
		<div className="text-center py-8">
			<Spinner size="h-8 w-8" className="inline-block mb-4" />
			<h3 className="text-lg font-medium text-primary mb-2">
				Detecting firmware...
			</h3>
			<p className="text-gray-600 dark:text-gray-300">
				Please do not disconnect the device.
			</p>
		</div>
	);
}
