import { installFirmwareWizardConfig } from './install-firmware';
// import { updateFirmwareWizardConfig } from './update-firmware';
// import { eraseNVMWizardConfig } from './erase-nvm';
import { recoverAdapterWizardConfig } from './recover-adapter';

export const wizards = [
  installFirmwareWizardConfig,
//   updateFirmwareWizardConfig,
  recoverAdapterWizardConfig,
//   eraseNVMWizardConfig,
] as const;

export type WizardId = typeof wizards[number]['id'];
