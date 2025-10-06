import { useState } from "react";
import ActionCard from "./components/ActionCard";
import ActionCardsGrid from "./components/ActionCardsGrid";
import Breadcrumb from "./components/Breadcrumb";
import WebSerialWarning from "./components/WebSerialWarning";
import Wizard from "./components/Wizard";
import { wizards, type WizardId } from "./wizards";
import { useBaseWizardContext } from "./hooks/useBaseWizardContext";

export default function App() {
	const [activeWizard, setActiveWizard] = useState<WizardId | null>(null);
	const baseContext = useBaseWizardContext();

	const handleCloseWizard = () => {
		setActiveWizard(null);
	};

	// Render active wizard
	if (activeWizard) {

		// Find the wizard configuration by ID
		const currentWizard = wizards.find(
			(wizard) => wizard.id === activeWizard,
		);

		if (currentWizard) {
			const breadcrumbItems = [
				{ name: currentWizard.title, current: true },
			];

			return (
				<div className="bg-white dark:bg-gray-900 min-h-screen px-6 py-24 sm:py-32 lg:px-8">
					<div className="max-w-7xl mx-auto">
						<h2 className="text-4xl font-semibold tracking-tight text-balance text-gray-900 sm:text-5xl dark:text-white mb-8">
							ZWA-2 Toolbox
						</h2>

						<Breadcrumb
							items={breadcrumbItems}
							onHomeClick={handleCloseWizard}
							disabled={baseContext.connectionState.status === 'connecting'}
						/>

						<div className="mt-8">
							<Wizard
								config={currentWizard as any}
								baseContext={baseContext}
								onClose={handleCloseWizard}
							/>
						</div>
					</div>
				</div>
			);
		}
	}

	return (
		<div className="bg-white dark:bg-gray-900 min-h-screen px-6 py-24 sm:py-32 lg:px-8">
			<div className="max-w-7xl mx-auto">
				<h2 className="text-4xl font-semibold tracking-tight text-balance text-gray-900 sm:text-5xl dark:text-white">
					Home Assistant Connect ZWA-2 Toolbox
				</h2>
				<p className="mt-6 max-w-xl text-lg text-gray-600 dark:text-gray-300">
					User friendly tools to manage Home Assistant Connect ZWA-2
					directly in your browser.
				</p>

				{/* Check for WebSerial support */}
				{!("serial" in navigator) ? (
					<div className="mt-10">
						<WebSerialWarning />
					</div>
				) : (
					/* Action Cards */
					<div className="mt-10">
						<ActionCardsGrid>
							{wizards.map((wizard) => (
								<ActionCard
									key={wizard.id}
									title={wizard.title}
									description={wizard.description}
									icon={wizard.icon}
									iconForeground={wizard.iconForeground}
									iconBackground={wizard.iconBackground}
									onClick={() => setActiveWizard(wizard.id)}
								/>
							))}
						</ActionCardsGrid>
					</div>
				)}
			</div>
		</div>
	);
}
