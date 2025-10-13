import { installFirmwareWizardConfig } from "./install-firmware";
import {
	updateESPFirmwareWizardConfig,
	// updateESPBridgeWizardConfig,
	// updateESPHomeWizardConfig,
} from "./update-esp-firmware";
// import { updateFirmwareWizardConfig } from './update-firmware';
// import { eraseNVMWizardConfig } from './erase-nvm';
import { recoverAdapterWizardConfig } from "./recover-adapter";

export const wizards = [
	installFirmwareWizardConfig,
	updateESPFirmwareWizardConfig,
	//   updateFirmwareWizardConfig,
	recoverAdapterWizardConfig,
	// updateESPBridgeWizardConfig,
	// updateESPHomeWizardConfig,
	//   eraseNVMWizardConfig,
] as const;

export type WizardId = (typeof wizards)[number]["id"];
