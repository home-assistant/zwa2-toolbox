import { installFirmwareWizardConfig } from './install-firmware';
import { updateESPFirmwareWizardConfig } from './update-esp-firmware';
// import { updateFirmwareWizardConfig } from './update-firmware';
// import { eraseNVMWizardConfig } from './erase-nvm';
import { recoverAdapterWizardConfig } from './recover-adapter';

export const wizards = [
  installFirmwareWizardConfig,
  updateESPFirmwareWizardConfig,
//   updateFirmwareWizardConfig,
  recoverAdapterWizardConfig,
//   eraseNVMWizardConfig,
] as const;

export type WizardId = typeof wizards[number]['id'];
