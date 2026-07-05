# Localization / i18n v15

Version: `0.12.0`

v15 adds Korean and English localization for the Electron editor UI. It does
not add animation features and does not change Unity Runtime behavior.

## Goals

- Support `ko` and `en` in the Electron editor.
- Use Korean as the default locale.
- Use English as the fallback locale.
- Store the selected language in the app-wide Electron settings file.
- Keep translation files bundled with the renderer so packaged builds do not
  need runtime locale file path resolution.
- Make validation, export, status, toolbar, panel, timeline, sample, settings,
  and about messages translatable.

## Locale Structure

```text
src/shared/i18n/
  types.ts
  locales.ts
  translate.ts
  locale-manifest.ts
  locales/
    ko.json
    en.json
```

Renderer integration:

```text
src/renderer/src/i18n/I18nProvider.tsx
src/renderer/src/i18n/useI18n.ts
```

## Policy

```text
default locale: ko
fallback locale: en
settings path: userData/settings.json
```

If a stored locale is missing or unsupported, the app uses `ko`. If a key is
missing in the active locale, the translator falls back to `en`. If the key is
missing in both locales, the key itself is displayed and a console warning is
emitted.

## Translation Keys

Keys are stable identifiers grouped by feature area:

```text
app.*
common.*
toolbar.*
panel.*
sample.*
settings.*
status.*
export.*
validation.*
timeline.*
about.*
inspector.*
preview.*
dialog.*
```

Display text is not used as a key.

## Interpolation

Simple `{{name}}` interpolation is supported:

```json
{
  "export": {
    "textureCopied": "{{count}} textures copied."
  }
}
```

Usage:

```ts
t("export.textureCopied", { count: 3 })
```

Plural rules are intentionally out of scope for v15.

## Validation Messages

Validation issues keep the existing English `message` for debug/fallback use,
and now also receive:

```ts
messageKey?: string;
params?: Record<string, string | number | boolean>;
```

The Electron UI displays `t(issue.messageKey, issue.params)` when available.
If a validation message is not mapped yet, it falls back to
`validation.genericIssue` with the original debug message.

## App Settings

The renderer accesses settings only through preload IPC:

```ts
window.suwol.app.getAppSettings()
window.suwol.app.saveAppSettings({ locale: "ko" })
```

The main process stores settings at:

```text
userData/settings.json
```

Example:

```json
{
  "locale": "ko"
}
```

## Packaging

Locale JSON files are imported into the renderer bundle through
`src/shared/i18n/locales.ts`. No extra `electron-builder` resource entry is
required for v15 locale loading.

Packaged QA should confirm:

- App starts in Korean by default.
- Language can be changed to English.
- UI updates without restart.
- The selected language persists after restart.
- Validation, export/status, timeline, settings, and about messages follow the
  selected language.

## Adding A Language

Example for Japanese:

```text
1. Add src/shared/i18n/locales/ja.json.
2. Add ja to src/shared/i18n/locale-manifest.ts.
3. Add ja to src/shared/i18n/locales.ts.
4. Run npm.cmd run verify:locales.
5. Confirm the app language selector shows the new language.
```

The new JSON file must match the full nested key structure of `en.json`.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit
npm.cmd run verify:format
npm.cmd run verify:locales
```

`release:check` includes `verify:locales`.

## Deferred

v15 localization applies to the Electron editor UI first. Unity package menu
and inspector localization is deferred.

Out of scope:

- Automatic translation
- External translation APIs or paid translation services
- Server-hosted language packs
- Unity Runtime feature changes
- Unity Editor full localization
- New animation features
- Spine compatibility
- Atlas packing
- Updater, license, login, or telemetry features
