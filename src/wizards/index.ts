import { installFirmwareWizardConfig } from './install-firmware';
import { updateFirmwareWizardConfig } from './update-firmware';
import { eraseNVMWizardConfig } from './erase-nvm';

export const wizards = [
  installFirmwareWizardConfig,
  updateFirmwareWizardConfig,
  eraseNVMWizardConfig,
] as const;

export type WizardId = typeof wizards[number]['id'];
