import { installFirmwareWizardConfig } from "./install-firmware";
import { configureWizardConfig } from "./configure";
import {
	updateESPFirmwareWizardConfig,
	// updateESPBridgeWizardConfig,
	// updateESPHomeWizardConfig,
} from "./update-esp-firmware";
// import { updateFirmwareWizardConfig } from './update-firmware';
// import { eraseNVMWizardConfig } from './erase-nvm';
import { recoverAdapterWizardConfig } from "./recover-adapter";
import { restoreBootloaderKeysWizardConfig } from "./restore-bootloader-keys";

export const wizards = [
	installFirmwareWizardConfig,
	updateESPFirmwareWizardConfig,
	configureWizardConfig,
	//   updateFirmwareWizardConfig,
	recoverAdapterWizardConfig,
	restoreBootloaderKeysWizardConfig,
	// updateESPBridgeWizardConfig,
	// updateESPHomeWizardConfig,
	//   eraseNVMWizardConfig,
] as const;

export type WizardId = (typeof wizards)[number]["id"];
