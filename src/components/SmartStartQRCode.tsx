import { useEffect, useState } from "react";
import { generateRepeaterQRCode } from "../lib/qr-code";

export default function SmartStartQRCode({ dsk }: { dsk: string }) {
	const [svgMarkup, setSvgMarkup] = useState<string | null>(null);

	useEffect(() => {
		generateRepeaterQRCode(dsk)
			.then(setSvgMarkup)
			.catch((err) => {
				console.error("Failed to generate QR code:", err);
			});
	}, [dsk]);

	if (!svgMarkup) return null;

	return (
		<div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
			<p className="font-medium text-blue-800 dark:text-blue-300 mb-3">
				Scan QR code to join via SmartStart:
			</p>
			<div className="flex flex-col items-center">
				<div
					className="w-64 bg-white rounded-lg overflow-hidden [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
					dangerouslySetInnerHTML={{ __html: svgMarkup }}
				/>
				<p className="mt-3 font-mono text-sm text-blue-900 dark:text-blue-100 select-all break-all">
					DSK:{" "}
					<span className="font-bold underline">
						{dsk.slice(0, 5)}
					</span>
					{dsk.slice(5)}
				</p>
			</div>
		</div>
	);
}
