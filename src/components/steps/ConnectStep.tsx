import type { WizardStepProps } from '../Wizard';

export default function ConnectStep<T>({ context }: WizardStepProps<T>) {
  if (context.isConnected) {
    return (
      <div className="text-center py-8">
        <div className="text-green-600 dark:text-green-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Connected to ZWA-2
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Successfully connected to your ZWA-2 device via Web Serial.
        </p>
        {context.onDisconnect && (
          <button
            onClick={context.onDisconnect}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
          >
            Disconnect & Connect Different Device
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Connect to ZWA-2
      </h3>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        First, we need to establish a connection to your ZWA-2 device via Web Serial.
      </p>
      {context.isConnecting && (
        <p className="text-indigo-600 dark:text-indigo-400">Connecting...</p>
      )}
    </div>
  );
}
