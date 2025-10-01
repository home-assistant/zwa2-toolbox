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
- For multi-phase workflows within a step, use discriminated unions (tagged unions) with a `status` field to combine substep tracking, progress, results, and errors into a single state object. Each status variant should carry only the data relevant to that phase.
- Orchestrate multi-phase workflows using wizard `onEnter` hooks rather than component `useEffect` hooks for better reliability and testability.
- Step components should be primarily display-only, reading from the tagged union state and rendering appropriate UI for each status variant.
- Always consider the asynchronous nature of React state management when writing code that reads/writes state.

## Comments & Documentation
- Add inline comments where business logic or design decisions need explanation. Focus on the "why" rather than the "what".

## Dependencies & APIs
- Use Web Serial, zwave-js, and esptool-js for hardware interaction. Do not add new dependencies unless absolutely required.
- Import from specific paths when possible (e.g., `@heroicons/react/24/outline` vs `@heroicons/react`).
- Use established external libraries: Heroicons for icons, Headless UI for complex UI patterns, Tailwind CSS for styling.

## File Organization & Imports
- Follow the established folder structure: `components/`, `wizards/`, `lib/`, `steps/`.
- Use barrel exports in `index.ts` files to re-export types and configurations from wizard modules.
- Import types with explicit `type` keyword (e.g., `import type { WizardStepProps } from '../Wizard'`).
- Group imports: React hooks first, then components, then types, then utilities.

## React Patterns & Hooks Usage
- Always use functional components with hooks, never class components.
- Prefer `useCallback` for event handlers that are passed to child components or used in dependency arrays.
- Use `useMemo` for expensive computations or complex object/array creation that should be memoized.
- Use `useRef` for storing mutable values that don't trigger re-renders (like cleanup functions, binding instances).
- Use `useEffect` for side effects, cleanup, and subscriptions. Always include proper dependency arrays.
- When creating objects in useState initializers, use function form to avoid recreating on every render.

## Component Patterns
- Export components as default exports, with supporting types as named exports.
- Use generic type parameters for reusable components (e.g., `<T>` for wizard step components).
- Pass context objects rather than individual props for wizard-related components.
- Implement cleanup patterns using refs and cleanup functions rather than direct state management.

## Async Operations & Error Handling
- Always handle async operations in try-catch blocks within async functions.
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safe property access.
- Return boolean success indicators from async operations rather than throwing exceptions for expected failures.
- Log errors to console with meaningful context before displaying user-friendly messages.

## Browser API Integration
- Always check for browser API availability before using (e.g., `"serial" in navigator`).
- Handle browser navigation blocking during critical operations using `beforeunload` event listeners.
- Use proper cleanup for event listeners and browser resources in useEffect cleanup functions.

## Testing
- Do not write or update tests. The project requires real hardware for meaningful testing.

## Accessibility & Internationalization
- No special requirements.

## Security & Privacy
- No special requirements.

## General Guidance
- Do not modify or extend any part of the codebase unless it follows the above patterns and guidelines.
- Always strive for clarity, maintainability, and consistency with existing code and user experience.
- When modifying existing code, do not add wrappers or fallbacks for legacy behavior. Refactor all existing code to the new standard.
