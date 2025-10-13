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
				"app-primary": "var(--color-app-primary)",
				"app-card": "var(--color-app-card)",
				"app-border": "var(--color-app-border)",
				"app-border-hover": "var(--color-app-border-hover)",
			},
		},
	},
	plugins: [],
} satisfies Config;
