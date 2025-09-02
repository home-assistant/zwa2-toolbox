import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	base: "/zwa2-toolbox/",
	css: {
		postcss: './postcss.config.cjs',
	},
	build: {
		outDir: "dist",
		sourcemap: true,
	},
	server: {
		port: 5173,
	},
});
