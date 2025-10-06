import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	base: "/zwa2-toolbox/",
	css: {
		postcss: "./postcss.config.cjs",
	},
	build: {
		outDir: "dist",
		sourcemap: true,
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
				"install-esp-bridge-firmware": resolve(
					__dirname,
					"src/standalone/install-esp-bridge-firmware.tsx",
				),
				"install-esphome-firmware": resolve(
					__dirname,
					"src/standalone/install-esphome-firmware.tsx",
				),
			},
			output: {
				entryFileNames: (chunkInfo) => {
					// Keep the standalone web components as separate JS files
					if (
						chunkInfo.name === "install-esp-bridge-firmware" ||
						chunkInfo.name === "install-esphome-firmware"
					) {
						return "standalone/[name].js";
					}
					return "assets/[name]-[hash].js";
				},
			},
		},
	},
	server: {
		port: 5173,
	},
});
