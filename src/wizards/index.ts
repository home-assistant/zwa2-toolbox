import { installFirmwareWizardConfig } from './install-firmware';
import { updateFirmwareWizardConfig } from './update-firmware';
import { eraseNVMWizardConfig } from './erase-nvm';
import { recoverAdapterWizardConfig } from './recover-adapter';

export const wizards = [
  installFirmwareWizardConfig,
  updateFirmwareWizardConfig,
  eraseNVMWizardConfig,
  recoverAdapterWizardConfig,
] as const;

export type WizardId = typeof wizards[number]['id'];
