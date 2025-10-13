import type { Config } from "tailwindcss";

export default {
	content: [
		"./index.html",
		"./src/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			colors: {
				primary: "var(--color-primary)",
				secondary: "var(--color-secondary)",
				"app-primary": "var(--app-bg-primary)",
				"app-card": "var(--app-bg-card)",
			},
		},
	},
	plugins: [],
} satisfies Config;
