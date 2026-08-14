import { LinkIcon, LinkSlashIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';

interface ConnectPromptProps {
  connected: boolean;
  title: string;
  description: ReactNode;
  /** Buttons and extra guidance below the text block */
  children?: ReactNode;
}

/** Asks the user to pick a serial port mid-wizard, after the initial connect step */
export default function ConnectPrompt({ connected, title, description, children }: ConnectPromptProps) {
  return (
    <div className="flex flex-col items-center py-8 space-y-6">
      <div className={connected ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}>
        {connected ? <LinkIcon className="w-16 h-16" /> : <LinkSlashIcon className="w-16 h-16" />}
      </div>
      <div className="text-center text-gray-600 dark:text-gray-300">
        <h3 className="text-lg font-medium text-primary mb-2">{title}</h3>
        {description}
      </div>
      {children}
    </div>
  );
}
