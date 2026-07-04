# Packaging / Release Readiness v12

v12 aligns the Unity UPM package with the Electron editor release metadata and
prepares the package for disk or zip distribution.

## Metadata

```json
{
  "name": "com.suwol.suwol2d",
  "displayName": "Suwol 2D Animator Runtime",
  "version": "0.12.0",
  "unity": "6000.0"
}
```

## Add Package From Disk

Use Unity Package Manager and select:

```text
unity/com.suwol.suwol2d/package.json
```

## Zip Distribution

From the Electron repository root:

```powershell
npm.cmd run release:unity-package
```

Output:

```text
release/com.suwol.suwol2d-0.12.0.zip
```

The archive contains:

```text
package.json
Runtime/
Editor/
Samples~/
Documentation~/
README.md
```

## Release Validation

From the Electron repository root:

```powershell
npm.cmd run verify:format
npm.cmd run verify:unity
```

`verify:unity` creates a temporary Unity project, installs this package from
disk, imports package samples, and runs runtime/importer smoke checks.

## Current Signing Status

No Unity package signing, code signing certificate, or private key is included
in this repository.
