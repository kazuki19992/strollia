# OSS License Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app OSS license screen reachable from settings, backed by generated license data.

**Architecture:** Generate dependency license data at development/build time with `license-checker-rseidelsohn`, then import the generated TypeScript data from React Native UI. Native iOS acknowledgements are optional inputs because this Expo checkout does not contain `ios/`; the generator includes them when CocoaPods acknowledgement plist files exist after prebuild/build.

**Tech Stack:** Expo, React Native, TypeScript, Jest, `license-checker-rseidelsohn`, Node.js generation script.

---

### Task 1: License Data Generation

**Files:**

- Create: `scripts/generate-licenses.js`
- Create: `src/app/generated/ossLicenses.ts`
- Modify: `package.json`
- Modify: `docs/architecture.md`

- [x] Add `license-checker-rseidelsohn` as a devDependency.
- [x] Add `generate:licenses` script.
- [x] Generate static TypeScript data from production npm dependencies.
- [x] Optionally merge CocoaPods acknowledgement plist files when `ios/Pods/Target Support Files/**` exists.

### Task 2: License Screen UI

**Files:**

- Create: `src/app/components/LicenseScreen.tsx`
- Create: `src/app/components/__tests__/LicenseScreen.test.tsx`
- Modify: `src/app/components/SettingsScreen.tsx`
- Modify: `src/app/components/__tests__/SettingsScreen.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/appTypes.ts`
- Modify: `src/app/__tests__/AppMapReturn.test.tsx`

- [x] Write failing tests for the settings entrypoint, license screen close/back behavior, and rendered license data.
- [x] Add `license` screen mode and route from settings.
- [x] Add `LicenseScreen` with a `戻る` control that returns to settings, not map.
- [x] Run focused tests and then full verification.

### Task 3: Documentation

**Files:**

- Modify: `docs/architecture.md`
- Modify: `docs/todo.md`

- [x] Document generated OSS license data and native acknowledgement handling.
- [x] Add todo completion note for the license screen.
