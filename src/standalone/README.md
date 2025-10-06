# Standalone Web Components

This directory contains standalone web component entry points that can be used independently in other projects.

## Available Components

### 1. Update ESP Bridge Wizard (`update-esp-bridge-wizard`)

Installs the USB Bridge firmware (default firmware) on the ZWA-2 device.

**Web Component Tag:** `<update-esp-bridge-wizard></update-esp-bridge-wizard>`

**Features:**
- Auto-selects USB Bridge firmware
- Simplified wizard flow (Connect → Install → Summary)
- No firmware selection step needed

### 2. Update ESPHome Wizard (`update-esp-home-wizard`)

Installs the Portable Z-Wave (ESPHome) firmware on the ZWA-2 device to enable WiFi connectivity.

**Web Component Tag:** `<update-esp-home-wizard></update-esp-home-wizard>`

**Features:**
- Auto-selects Portable Z-Wave firmware
- Includes WiFi configuration step
- Full wizard flow (Connect → Install → Configure WiFi → Summary)

## Building the Components

To build the standalone web components, run:

```bash
npm run build
```

This will generate:
- `dist/standalone/update-esp-bridge.js` - USB Bridge wizard component
- `dist/standalone/update-esp-home.js` - Portable Z-Wave wizard component

## Usage in Other Projects

### Step 1: Copy the built files

After building, copy the generated JavaScript files from `dist/standalone/` to your project.

### Step 2: Include in your HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>My Project</title>
	<!-- Load the Inter font (recommended) -->
	<link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
	<!-- Load the Tailwind CSS styles (required) -->
	<link rel="stylesheet" href="path/to/assets/index-[hash].css" />
</head>
<body>
	<!-- Use the web component -->
	<update-esp-bridge-wizard></update-esp-bridge-wizard>
	
	<!-- Load the component script -->
	<script type="module" src="path/to/standalone/update-esp-bridge.js"></script>
</body>
</html>
```

**Important:** You must include both the CSS file and the JS file. The CSS file contains all the Tailwind styles needed for the component to display correctly. The filename includes a hash (e.g., `index-j5xmVKn3.css`) which changes with each build.

### Step 3 (Optional): Style the component

The components include their own styles (Tailwind CSS), but you can wrap them in a container for additional styling:

```html
<div class="my-custom-wrapper">
	<update-esp-bridge-wizard></update-esp-bridge-wizard>
</div>
```

## Testing

Test pages are available at:
- `/test-esp-bridge.html` - Test USB Bridge wizard
- `/test-esp-home.html` - Test Portable Z-Wave wizard

To test locally:

```bash
npm run dev
```

Then navigate to:
- http://localhost:5173/test-esp-bridge.html
- http://localhost:5173/test-esp-home.html

## Browser Requirements

These components require browsers with Web Serial API support:
- Chrome/Chromium 89+
- Edge 89+
- Opera 75+

Web Serial API is **not supported** in Firefox or Safari.

## Technical Details

### Architecture

The standalone components are built using:
- **React** - UI framework
- **react-to-webcomponent** - Converts React components to web components
- **Tailwind CSS** - Styling
- **Web Serial API** - Hardware communication
- **esptool-js** - ESP32 firmware flashing
- **improv-wifi-serial-sdk** - WiFi configuration (ESPHome only)

### Component Structure

Each standalone component:
1. Manages its own connection state
2. Provides serial port request handlers (ZWA-2 and ESP32)
3. Renders the wizard with pre-configured settings
4. Handles disconnection and cleanup

### Customization

The wizard configurations are defined in `src/wizards/update-esp-firmware/wizard.ts`:
- `updateESPBridgeWizardConfig` - USB Bridge wizard
- `updateESPHomeWizardConfig` - Portable Z-Wave wizard

Both configurations have `standalone: true` to indicate they're designed for standalone use.

## Troubleshooting

### Component doesn't render

- Ensure the script is loaded as a module: `<script type="module" ...>`
- Check browser console for errors
- Verify the browser supports Web Serial API

### Serial port access denied

- Web Serial API requires a secure context (HTTPS or localhost)
- The user must trigger the port selection (e.g., via button click)

### Styling issues

- The component includes its own Tailwind CSS styles
- If styles conflict, wrap the component in an isolated container
- Consider using Shadow DOM for full style isolation (requires modification)

## License

Same as the main project.
