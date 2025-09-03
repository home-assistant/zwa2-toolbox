# Copilot Instructions for zwa2-toolbox

## Project Overview
- This is a web-based toolbox for interacting with the Home Assistant Connect ZWA-2, a Z-Wave adapter by Nabu Casa.
- The toolbox is used by both end users and developers, with technical proficiency ranging from none to medium.

## Key Features & Workflows
- Focus on workflows for installing and updating firmware (Z-Wave chip and ESP32 USB bridge), diagnostics, hardware recovery, and simple configuration (e.g., RF settings).
- Not all features are implemented yet; follow existing patterns for new features.

## Coding Standards
- Always use TypeScript and React functional components with hooks, following the current codebase patterns.
- Adhere to Prettier and ESLint configurations in the repository.
- Strive for maximum consistency in UX and code style across files and wizards.

## UI/UX Guidelines
- Wizards should follow the pattern: connection step → one or more followup steps → summary step.
- Show feedback on the summary step. If intermediate feedback and user interaction are needed, show it in the current step's UI (see existing wizards for examples).
- Use indeterminate spinners for unknown-duration operations and circular progress bars for known progress. Use the existing components in the repo.
- Keep the UI as simple as possible. Do not expose advanced or expert settings unless absolutely necessary.

## Error Handling & Notifications
- Follow the established wizard patterns for error handling and feedback.
- Report feedback on the summary step, or inline on the current step if user interaction is required.

## State Management
- Group related states (e.g., serialport instance + device type) together, not as separate states.
- Use typestate patterns based on tagged union types for wizard step state. Avoid creating new, independent states for short-lived or step-specific data.
- Always consider the asynchronous nature of React state management when writing code that reads/writes state.

## Comments & Documentation
- Add inline comments where business logic or design decisions need explanation. Focus on the "why" rather than the "what".

## Dependencies & APIs
- Use Web Serial, zwave-js, and esptool-js for hardware interaction. Do not add new dependencies unless absolutely required.

## Testing
- Do not write or update tests. The project requires real hardware for meaningful testing.

## Accessibility & Internationalization
- No special requirements.

## Security & Privacy
- No special requirements.

## General Guidance
- Do not modify or extend any part of the codebase unless it follows the above patterns and guidelines.
- Always strive for clarity, maintainability, and consistency with existing code and user experience.
