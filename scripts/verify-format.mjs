import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const {
  createAnimationMixingStateMachineSampleDocument,
  createAnimationTimelinesSampleDocument,
  createDeformSampleDocument,
  createIkSampleDocument,
  createMeshSampleDocument,
  createSampleDocument,
  createSkinSampleDocument,
  createTimelineUsabilitySampleDocument,
  createWeightedMeshSampleDocument
} = await import('../src/renderer/src/features/project/sample-project.ts');
const { createUnityRuntimeExport } = await import('../src/shared/export-suwol2d.ts');
const { suwolReleaseInfo } = await import('../src/shared/release-info.ts');
const { validateDocument } = await import('../src/shared/validation.ts');

const importedImages = [
  {
    id: 'img_body',
    name: 'body',
    fileName: 'body.png',
    relativePath: 'images/body.png',
    width: 64,
    height: 96,
    mimeType: 'image/png'
  },
  {
    id: 'img_arm',
    name: 'arm',
    fileName: 'arm.png',
    relativePath: 'images/arm.png',
    width: 24,
    height: 72,
    mimeType: 'image/png'
  },
  {
    id: 'img_body_armor',
    name: 'body_armor',
    fileName: 'body_armor.png',
    relativePath: 'images/body_armor.png',
    width: 64,
    height: 96,
    mimeType: 'image/png'
  },
  {
    id: 'img_arm_armor',
    name: 'arm_armor',
    fileName: 'arm_armor.png',
    relativePath: 'images/arm_armor.png',
    width: 24,
    height: 72,
    mimeType: 'image/png'
  },
  {
    id: 'img_sword',
    name: 'sword',
    fileName: 'sword.png',
    relativePath: 'images/sword.png',
    width: 24,
    height: 72,
    mimeType: 'image/png'
  },
  {
    id: 'img_axe',
    name: 'axe',
    fileName: 'axe.png',
    relativePath: 'images/axe.png',
    width: 24,
    height: 72,
    mimeType: 'image/png'
  }
];

const regionExport = await validateSamplePair({
  label: 'region sample',
  document: createSampleDocument(importedImages),
  samplePath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'RuntimeMvp', 'sample_character.suwol2d.json'),
  expectedAttachmentTypes: ['region']
});

const meshExport = await validateSamplePair({
  label: 'mesh sample',
  document: createMeshSampleDocument(importedImages),
  samplePath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'MeshAttachmentV1', 'sample_mesh_character.suwol2d.json'),
  expectedAttachmentTypes: ['region', 'mesh']
});

const weightedMeshExport = await validateSamplePair({
  label: 'weighted mesh sample',
  document: createWeightedMeshSampleDocument(importedImages),
  samplePath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'WeightedMeshV2', 'sample_weighted_character.suwol2d.json'),
  expectedAttachmentTypes: ['region', 'mesh']
});

const deformExport = await validateSamplePair({
  label: 'deform sample',
  document: createDeformSampleDocument(importedImages),
  samplePath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'DeformTimelineV3', 'sample_deform_character.suwol2d.json'),
  expectedAttachmentTypes: ['region', 'mesh']
});

const ikExport = await validateSamplePair({
  label: 'IK sample',
  document: createIkSampleDocument(importedImages),
  samplePath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'IkConstraintV5', 'sample_ik_character.suwol2d.json'),
  expectedAttachmentTypes: ['region', 'mesh'],
  expectedIkConstraints: true
});

const skinExport = await validateSamplePair({
  label: 'skin sample',
  document: createSkinSampleDocument(importedImages),
  samplePath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'SkinAttachmentSwapV6', 'sample_skin_character.suwol2d.json'),
  expectedAttachmentTypes: ['region'],
  expectedSkinNames: ['default', 'armor_01']
});
validateSkinSample(skinExport);

const importerSample = await validateImporterSample({
  samplePath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'ImporterPrefabWorkflowV7', 'sample_importer_character.suwol2d'),
  debugJsonPath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'ImporterPrefabWorkflowV7', 'sample_importer_character.suwol2d.json'),
  texturesPath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'ImporterPrefabWorkflowV7', 'Textures')
});

const animationTimelinesExport = await validateSamplePair({
  label: 'animation timelines sample',
  document: createAnimationTimelinesSampleDocument(importedImages),
  samplePath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'AnimationTimelinesV8', 'sample_animation_timelines.suwol2d.json'),
  expectedAttachmentTypes: ['region'],
  expectedAnimationNames: ['walk', 'attack'],
  expectedTextureNames: ['body.png', 'arm.png', 'sword.png', 'axe.png'],
  compareExportToSample: false
});
await validateSuwol2DPair({
  samplePath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'AnimationTimelinesV8', 'sample_animation_timelines.suwol2d'),
  debugJsonPath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'AnimationTimelinesV8', 'sample_animation_timelines.suwol2d.json'),
  texturesPath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'AnimationTimelinesV8', 'Textures'),
  textureNames: ['body.png', 'arm.png', 'sword.png', 'axe.png']
});

const animationMixingStateMachineExport = await validateSamplePair({
  label: 'animation mixing state machine sample',
  document: createAnimationMixingStateMachineSampleDocument(importedImages),
  samplePath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'AnimationMixingStateMachineV10', 'sample_animation_mixing_state_machine.suwol2d.json'),
  expectedAttachmentTypes: ['region'],
  expectedAnimationNames: ['idle', 'walk', 'attack'],
  expectedTextureNames: ['body.png', 'arm.png', 'sword.png', 'axe.png'],
  expectedStateMachine: true
});
await validateSuwol2DPair({
  samplePath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'AnimationMixingStateMachineV10', 'sample_animation_mixing_state_machine.suwol2d'),
  debugJsonPath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'AnimationMixingStateMachineV10', 'sample_animation_mixing_state_machine.suwol2d.json'),
  texturesPath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'AnimationMixingStateMachineV10', 'Textures'),
  textureNames: ['body.png', 'arm.png', 'sword.png', 'axe.png']
});

const timelineUsabilityExport = await validateSamplePair({
  label: 'timeline usability sample',
  document: createTimelineUsabilitySampleDocument(importedImages),
  samplePath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'TimelineUsabilityV11', 'sample_timeline_editing.suwol2d.json'),
  expectedAttachmentTypes: ['region', 'mesh'],
  expectedAnimationNames: ['walk', 'attack'],
  expectedTextureNames: ['body.png', 'arm.png', 'sword.png', 'axe.png'],
  compareExportToSample: false
});
assert.ok(timelineUsabilityExport.animations.every((animation) => typeof animation.duration === 'number' && animation.duration > 0), 'timeline usability sample should export explicit durations.');
await validateSuwol2DPair({
  samplePath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'TimelineUsabilityV11', 'sample_timeline_editing.suwol2d'),
  debugJsonPath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'TimelineUsabilityV11', 'sample_timeline_editing.suwol2d.json'),
  texturesPath: join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~', 'TimelineUsabilityV11', 'Textures'),
  textureNames: ['body.png', 'arm.png', 'sword.png', 'axe.png']
});
await validateAllUnityPackageSamples();
await validateReleaseReadinessMetadata();

const dataModel = await readFile(
  join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Runtime', 'Data', 'Suwol2DAssetData.cs'),
  'utf8'
);
for (const field of [
  'public int version',
  'public string name',
  'public Suwol2DBoneData[] bones',
  'public Suwol2DSlotData[] slots',
  'public Suwol2DSkinData[] skins',
  'public Suwol2DAttachmentData[] attachments',
  'public Suwol2DAnimationData[] animations',
  'public float duration',
  'public Suwol2DIkConstraintData[] ikConstraints',
  'public sealed class Suwol2DIkConstraintData',
  'public string parentBone',
  'public string childBone',
  'public string targetBone',
  'public bool enabled',
  'public float mix',
  'public int bendDirection',
  'public int order',
  'public float length',
  'public Suwol2DDeformTimelineData[] deforms',
  'public Suwol2DAttachmentTimelineData[] attachments',
  'public Suwol2DDrawOrderKeyData[] drawOrders',
  'public Suwol2DSlotTimelineData[] slots',
  'public Suwol2DEventKeyData[] events',
  'public Suwol2DStateMachineData[] stateMachines',
  'public int drawOrder',
  'public Suwol2DMeshVertexData[] vertices',
  'public int[] triangles',
  'public Suwol2DVertexWeightData[] weights',
  'public float u',
  'public float v',
  'public sealed class Suwol2DVertexWeightData',
  'public sealed class Suwol2DBoneWeightData',
  'public int vertex',
  'public Suwol2DBoneWeightData[] bones',
  'public string bone',
  'public float weight',
  'public Suwol2DTranslateKey[] translate',
  'public Suwol2DRotateKey[] rotate',
  'public Suwol2DScaleKey[] scale',
  'public sealed class Suwol2DVertexOffsetData',
  'public sealed class Suwol2DDeformKeyData',
  'public sealed class Suwol2DDeformTimelineData',
  'public Suwol2DVertexOffsetData[] offsets',
  'public Suwol2DDeformKeyData[] keys',
  'public string attachment',
  'public sealed class Suwol2DAttachmentTimelineData',
  'public sealed class Suwol2DDrawOrderKeyData',
  'public sealed class Suwol2DSlotTimelineData',
  'public sealed class Suwol2DEventKeyData',
  'public sealed class Suwol2DStateMachineData',
  'public sealed class Suwol2DStateData',
  'public sealed class Suwol2DStateParameterData',
  'public sealed class Suwol2DStateTransitionData',
  'public sealed class Suwol2DTransitionConditionData',
  'public string initialState',
  'public Suwol2DStateData[] states',
  'public Suwol2DStateParameterData[] parameters',
  'public Suwol2DStateTransitionData[] transitions',
  'public bool defaultBool',
  'public float fadeDuration',
  'public Suwol2DTransitionConditionData[] conditions',
  'public string parameter',
  'public string mode',
  'public bool boolValue'
]) {
  assert.ok(dataModel.includes(field), `C# data model is missing field declaration: ${field}`);
}

const characterRuntime = await readFile(
  join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Runtime', 'Suwol2DCharacter.cs'),
  'utf8'
);
for (const field of [
  'public bool HasSkin',
  'public void LoadFromJson',
  'public void LoadFromData',
  'public string GetCurrentSkin',
  'public bool SetSkin',
  'public bool SetAttachment',
  'public void ResetAttachments',
  'public void Play(string animationName, float fadeDuration)',
  'public bool CrossFade',
  'public bool IsTransitioning',
  'public string GetNextAnimationName',
  'public float GetTransitionProgress',
  'public bool PlayStateMachine',
  'public bool HasStateMachine',
  'public string GetCurrentStateName',
  'public bool SetBool',
  'public bool SetTrigger',
  'public void ResetTrigger',
  'public event Action<Suwol2DAnimationEvent> AnimationEvent'
]) {
  assert.ok(characterRuntime.includes(field), `Suwol2DCharacter is missing runtime skin API: ${field}`);
}

const importerRuntime = await readFile(
  join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Editor', 'Suwol2DAssetImporter.cs'),
  'utf8'
);
for (const field of [
  '[ScriptedImporter(1, "suwol2d")]',
  'Suwol2DImportedAsset',
  'FindTextures',
  'Suwol2DPrefabBuilder.Build',
  'ValidateData',
  'ValidateStateMachines',
  'SetStateMachineSummary'
]) {
  assert.ok(importerRuntime.includes(field), `Suwol2D importer is missing expected implementation marker: ${field}`);
}

const skinResolverRuntime = await readFile(
  join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Runtime', 'Core', 'Suwol2DSkinResolver.cs'),
  'utf8'
);
for (const field of [
  'public sealed class Suwol2DSkinResolver',
  'ResolveAttachment',
  'SetSkin',
  'SetAttachment',
  'ResetAttachments',
  'SetAnimationAttachmentOverrides'
]) {
  assert.ok(skinResolverRuntime.includes(field), `Suwol2DSkinResolver is missing expected API: ${field}`);
}

const regionRendererRuntime = await readFile(
  join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Runtime', 'Rendering', 'Suwol2DRegionRenderer.cs'),
  'utf8'
);
const meshRendererRuntime = await readFile(
  join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Runtime', 'Rendering', 'Suwol2DMeshAttachmentRenderer.cs'),
  'utf8'
);
for (const field of ['public void Sync', 'public int ViewCount', 'CreateCacheKey', 'DestroyObject']) {
  assert.ok(regionRendererRuntime.includes(field), `Suwol2DRegionRenderer is missing v9 renderer cache marker: ${field}`);
  assert.ok(meshRendererRuntime.includes(field), `Suwol2DMeshAttachmentRenderer is missing v9 renderer cache marker: ${field}`);
}

const unitySmokeScript = await readFile(join(repoRoot, 'scripts', 'unity-smoke-v9.mjs'), 'utf8');
for (const field of ['UNITY_EXE', 'file:', 'Suwol2DRuntimeSmokeTests.RunAll', 'Unity smoke skipped']) {
  assert.ok(unitySmokeScript.includes(field), `Unity smoke script is missing expected v9 marker: ${field}`);
}

const unitySmokeHelper = await readFile(
  join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Editor', 'Tests', 'Suwol2DRuntimeSmokeTests.cs'),
  'utf8'
);
for (const field of ['RunAll', 'ValidateImporterReimportRecovery', 'ValidateMalformedRuntimeJson', 'ValidateAnimationMixingStateMachineApi', 'Renderer view count']) {
  assert.ok(unitySmokeHelper.includes(field), `Unity smoke helper is missing expected v9 marker: ${field}`);
}

console.log('Suwol2D format verification passed.');
console.log(`- region sample attachments: ${regionExport.attachments.map((attachment) => attachment.type).join(', ')}`);
console.log(`- mesh sample attachments: ${meshExport.attachments.map((attachment) => attachment.type).join(', ')}`);
console.log(`- mesh sample animations: ${meshExport.animations.map((animation) => animation.name).join(', ')}`);
console.log(`- weighted mesh sample weights: ${getWeightedMesh(weightedMeshExport).weights.length} vertices`);
console.log(`- deform sample timelines: ${deformExport.animations.flatMap((animation) => animation.deforms ?? []).length}`);
console.log(`- IK sample constraints: ${ikExport.ikConstraints.length}`);
console.log(`- skin sample skins: ${skinExport.skins.map((skin) => skin.name).join(', ')}`);
console.log(`- importer sample: ${importerSample.name} (${importerSample.skins.length} skins)`);
console.log(`- animation timelines sample: ${animationTimelinesExport.animations.map((animation) => animation.name).join(', ')}`);
console.log(`- animation mixing state machine sample: ${animationMixingStateMachineExport.stateMachines.map((machine) => machine.name).join(', ')}`);
console.log(`- timeline usability sample durations: ${timelineUsabilityExport.animations.map((animation) => animation.duration).join(', ')}`);

async function validateAllUnityPackageSamples() {
  const samplesRoot = join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Samples~');
  const files = await walkFiles(samplesRoot);
  const jsonFiles = files.filter((file) => file.endsWith('.suwol2d.json'));
  const suwol2dFiles = files.filter((file) => file.endsWith('.suwol2d'));

  assert.ok(jsonFiles.length >= 10, 'Unity package should include all v0-v11 .suwol2d.json samples.');
  assert.ok(suwol2dFiles.length >= 4, 'Unity package should include importer .suwol2d samples.');

  for (const jsonFile of jsonFiles) {
    const document = JSON.parse(await readFile(jsonFile, 'utf8'));
    await validateGenericRuntimeDocument(document, sampleLabel(samplesRoot, jsonFile), jsonFile);
  }

  for (const suwol2dFile of suwol2dFiles) {
    const document = JSON.parse(await readFile(suwol2dFile, 'utf8'));
    await validateGenericRuntimeDocument(document, sampleLabel(samplesRoot, suwol2dFile), suwol2dFile);

    const debugJsonFile = `${suwol2dFile}.json`;
    await access(debugJsonFile);
    const debugDocument = JSON.parse(await readFile(debugJsonFile, 'utf8'));
    assert.deepEqual(document, debugDocument, `${sampleLabel(samplesRoot, suwol2dFile)} should match its debug JSON pair.`);
  }
}

async function validateReleaseReadinessMetadata() {
  const rootPackage = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));
  const unityPackage = JSON.parse(await readFile(join(repoRoot, 'unity', 'com.suwol.suwol2d', 'package.json'), 'utf8'));
  const builderConfig = await readFile(join(repoRoot, 'electron-builder.yml'), 'utf8');
  const linuxZipWorkflow = await readFile(join(repoRoot, '.github', 'workflows', 'release-linux-zip.yml'), 'utf8');
  const rootReadme = await readFile(join(repoRoot, 'README.md'), 'utf8');
  const releaseChecklist = await readFile(join(repoRoot, 'docs', 'release-checklist-v12.md'), 'utf8');
  const packagingReadiness = await readFile(join(repoRoot, 'docs', 'packaging-release-readiness-v12.md'), 'utf8');
  const manualQaDogfooding = await readFile(join(repoRoot, 'docs', 'manual-qa-dogfooding-v13.md'), 'utf8');
  const unityDocsIndex = await readFile(join(repoRoot, 'unity', 'com.suwol.suwol2d', 'Documentation~', 'index.md'), 'utf8');

  assert.equal(rootPackage.name, 'suwol-2d-animator', 'root package name should be release-ready.');
  assert.equal(rootPackage.version, suwolReleaseInfo.appVersion, 'root package version should match release info.');
  assert.equal(rootPackage.license, 'UNLICENSED', 'root package license should be explicit.');
  assert.equal(unityPackage.name, suwolReleaseInfo.unityPackageName, 'Unity package name should match release info.');
  assert.equal(unityPackage.displayName, suwolReleaseInfo.unityPackageDisplayName, 'Unity package displayName should match release info.');
  assert.equal(unityPackage.version, suwolReleaseInfo.unityPackageVersion, 'Unity package version should match release info.');
  assert.equal(rootPackage.version, unityPackage.version, 'Electron and Unity package versions should match.');
  assert.equal(unityPackage.unity, '6000.0', 'Unity minimum version should be 6000.0 for v12.');

  for (const scriptName of [
    'icons:generate',
    'dist:win',
    'dist:win:dir',
    'dist:win:portable',
    'dist:win:nsis',
    'dist:linux:zip',
    'verify:unity:release',
    'release:check',
    'release:win',
    'release:checksums',
    'release:unity-package',
    'smoke:packaged'
  ]) {
    assert.ok(rootPackage.scripts?.[scriptName], `root package should include ${scriptName} script.`);
  }

  assert.ok(builderConfig.includes('appId: com.suwol.suwol2danimator'), 'electron-builder appId should be configured.');
  assert.ok(builderConfig.includes('productName: Suwol 2D Animator'), 'electron-builder productName should be configured.');
  assert.ok(builderConfig.includes('output: release'), 'electron-builder output should be release/.');
  assert.ok(builderConfig.includes('build/icon.ico'), 'electron-builder should use build/icon.ico.');
  assert.ok(builderConfig.includes('unity/com.suwol.suwol2d'), 'electron-builder should include Unity package resources.');
  assert.ok(builderConfig.includes('linux:'), 'electron-builder should include Linux packaging settings.');
  assert.ok(builderConfig.includes('target: zip'), 'electron-builder Linux target should be zip.');
  assert.ok(builderConfig.includes('arch:'), 'electron-builder Linux target should declare architectures.');
  assert.ok(builderConfig.includes('- x64'), 'electron-builder Linux target should include x64.');
  assert.ok(builderConfig.includes('${productName}-${version}-linux-${arch}.${ext}'), 'electron-builder should name Linux ZIP artifacts consistently.');

  for (const requiredFile of [
    '.github/workflows/release-linux-zip.yml',
    'LICENSE',
    'THIRD-PARTY-NOTICES.md',
    'docs/release-checklist-v12.md',
    'docs/packaging-release-readiness-v12.md',
    'docs/manual-qa-dogfooding-v13.md',
    'docs/manual-qa-results-v13.md',
    'docs/hotfix-candidates-0.12.1.md',
    'unity/com.suwol.suwol2d/Documentation~/packaging-release-readiness-v12.md',
    'scripts/generate-icons.mjs',
    'scripts/create-checksums.mjs',
    'scripts/zip-unity-package.mjs',
    'scripts/smoke-packaged-app.mjs'
  ]) {
    await access(join(repoRoot, requiredFile));
  }

  assert.ok(rootReadme.includes('Current release readiness version: `0.12.0`'), 'README should mention v12 release version.');
  assert.ok(rootReadme.includes('npm.cmd run dist:win:portable'), 'README should document portable build command.');
  assert.ok(rootReadme.includes('npm.cmd run dist:linux:zip'), 'README should document Linux ZIP build command.');
  assert.ok(rootReadme.includes('Actions > Release Linux ZIP'), 'README should document the Linux ZIP GitHub Actions workflow.');
  assert.ok(rootReadme.includes('Suwol 2D Animator-0.12.0-linux-x64.zip'), 'README should document the Linux ZIP artifact name.');
  assert.ok(rootReadme.includes('npm.cmd run release:unity-package'), 'README should document Unity package zip command.');
  assert.ok(rootReadme.includes('docs/manual-qa-dogfooding-v13.md'), 'README should link v13 manual QA docs.');
  assert.ok(releaseChecklist.includes('.github/workflows/release-linux-zip.yml'), 'Release checklist should include Linux ZIP workflow checks.');
  assert.ok(releaseChecklist.includes('checksums-linux-x64.txt'), 'Release checklist should include Linux checksum checks.');
  assert.ok(packagingReadiness.includes('GitHub Actions Linux ZIP'), 'Packaging readiness docs should document GitHub Actions Linux ZIP.');
  assert.ok(packagingReadiness.includes('electron-builder --linux zip --x64 --publish never'), 'Packaging readiness docs should document the Linux ZIP build command.');
  assert.ok(manualQaDogfooding.includes('Linux ZIP Workflow QA'), 'Manual QA docs should include Linux ZIP workflow QA.');
  assert.ok(manualQaDogfooding.includes('checksums-linux-x64.txt'), 'Manual QA docs should include Linux checksum checks.');
  for (const workflowMarker of [
    'name: Release Linux ZIP',
    'workflow_dispatch:',
    'push:',
    'tags:',
    'v*.*.*',
    'permissions:',
    'contents: write',
    'runs-on: ubuntu-latest',
    'actions/checkout@v4',
    'actions/setup-node@v4',
    'node-version: 22',
    'npm ci',
    'npm run typecheck --if-present',
    'npm run build',
    'npm run verify:format --if-present',
    'npm run dist:linux:zip',
    'checksums-linux-x64.txt',
    'actions/upload-artifact@v4',
    'softprops/action-gh-release@v2'
  ]) {
    assert.ok(linuxZipWorkflow.includes(workflowMarker), `Linux ZIP workflow is missing marker: ${workflowMarker}`);
  }
  assert.ok(!linuxZipWorkflow.includes('verify:unity'), 'Linux ZIP workflow should not run Unity smoke checks.');
  assert.ok(unityDocsIndex.includes('Timeline Usability v11'), 'Unity docs index should list v11 sample.');
  assert.ok(unityDocsIndex.includes('packaging-release-readiness-v12.md'), 'Unity docs index should link v12 docs.');
  assert.ok(unityPackage.samples.some((sample) => sample.path === 'Samples~/TimelineUsabilityV11'), 'Unity package should list v11 sample.');
}

async function walkFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function validateGenericRuntimeDocument(document, label, filePath) {
  assertNoInvalidNumbers(document, label);
  assert.equal(document.version, 0, `${label} version should be 0`);
  assert.ok(Array.isArray(document.bones) && document.bones.length > 0, `${label} should include bones`);
  assert.ok(Array.isArray(document.slots) && document.slots.length > 0, `${label} should include slots`);
  assert.ok(Array.isArray(document.skins) && document.skins.length > 0, `${label} should include skins`);
  assert.ok(Array.isArray(document.attachments), `${label} should include top-level attachments`);
  assert.ok(Array.isArray(document.animations) && document.animations.length > 0, `${label} should include animations`);

  const boneNames = new Set();
  for (const bone of document.bones) {
    assert.equal(typeof bone.name, 'string', `${label} bone should have a name`);
    assert.ok(!boneNames.has(bone.name), `${label} bone names should be unique: ${bone.name}`);
    boneNames.add(bone.name);
    if (bone.parent) {
      assert.ok(boneNames.has(bone.parent) || document.bones.some((candidate) => candidate.name === bone.parent), `${label} bone parent should exist: ${bone.parent}`);
    }
  }

  const slotNames = new Set();
  for (const slot of document.slots) {
    assert.equal(typeof slot.name, 'string', `${label} slot should have a name`);
    assert.ok(!slotNames.has(slot.name), `${label} slot names should be unique: ${slot.name}`);
    slotNames.add(slot.name);
    assert.ok(boneNames.has(slot.bone), `${label} slot should reference an existing bone: ${slot.bone}`);
    assert.ok(Number.isInteger(slot.drawOrder), `${label} slot drawOrder should be an integer`);
  }

  assert.ok(document.skins.some((skin) => skin.name === 'default'), `${label} should include a default skin`);
  const allAttachments = collectAllAttachments(document);
  const attachmentNames = new Set();
  for (const attachment of allAttachments) {
    validateAttachment(attachment, label, document.bones);
    attachmentNames.add(attachment.name);
    assert.ok(slotNames.has(attachment.slot), `${label} attachment should reference an existing slot: ${attachment.slot}`);
  }

  for (const slot of document.slots) {
    if (slot.attachment) {
      assert.ok(attachmentNames.has(slot.attachment), `${label} slot setup attachment should exist: ${slot.attachment}`);
    }
  }

  const timelineDocument = { ...document, attachments: allAttachments };
  for (const animation of document.animations) {
    assert.equal(typeof animation.name, 'string', `${label} animation should have a name`);
    assert.ok(Array.isArray(animation.bones), `${label} animation bones should be an array`);
    for (const timeline of animation.bones) {
      assert.ok(boneNames.has(timeline.bone), `${label} animation timeline should reference an existing bone: ${timeline.bone}`);
      validateKeyList(timeline.translate ?? [], ['time', 'x', 'y'], `${label} ${animation.name}/${timeline.bone}/translate`);
      validateKeyList(timeline.rotate ?? [], ['time', 'rotation'], `${label} ${animation.name}/${timeline.bone}/rotate`);
      validateKeyList(timeline.scale ?? [], ['time', 'scaleX', 'scaleY'], `${label} ${animation.name}/${timeline.bone}/scale`);
    }

    if ((animation.deforms ?? []).length > 0) {
      validateDeformTimelines(animation.deforms, timelineDocument, `${label} ${animation.name}`);
    }
    if ((animation.attachments ?? []).length > 0) {
      validateAttachmentTimelines(animation.attachments, timelineDocument, `${label} ${animation.name}`);
    }
    if ((animation.drawOrders ?? []).length > 0) {
      validateDrawOrderTimeline(animation.drawOrders, timelineDocument, `${label} ${animation.name}`);
    }
    if ((animation.slots ?? []).length > 0) {
      validateSlotColorTimelines(animation.slots, timelineDocument, `${label} ${animation.name}`);
    }
    if ((animation.events ?? []).length > 0) {
      validateEventTimeline(animation.events, `${label} ${animation.name}`);
    }
  }

  if ((document.ikConstraints ?? []).length > 0) {
    validateIkConstraints(document.ikConstraints, document, label);
  }
  if ((document.stateMachines ?? []).length > 0) {
    validateStateMachines(document.stateMachines, document, label);
  }

  await validateTextureFiles(document, filePath, label);
}

function collectAllAttachments(document) {
  const attachments = [...(document.attachments ?? [])];
  for (const skin of document.skins ?? []) {
    attachments.push(...(skin.attachments ?? []));
  }
  return attachments;
}

async function validateTextureFiles(document, filePath, label) {
  const textureDir = join(dirname(filePath), 'Textures');
  const imageNames = new Set();
  for (const attachment of collectAllAttachments(document)) {
    if (attachment.image) {
      imageNames.add(attachment.image);
    }
  }

  for (const imageName of imageNames) {
    assert.ok(await hasTextureFile(textureDir, imageName), `${label} is missing texture file for image '${imageName}'`);
  }
}

async function hasTextureFile(textureDir, imageName) {
  const normalized = normalizeTextureName(imageName);
  const entries = await readdir(textureDir).catch(() => []);
  return entries.some((entry) => normalizeTextureName(entry) === normalized);
}

function assertNoInvalidNumbers(value, label) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${label} should not contain NaN or Infinity`);
    return;
  }

  if (value === null || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertNoInvalidNumbers(value[index], `${label}[${index}]`);
    }
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assertNoInvalidNumbers(child, `${label}.${key}`);
  }
}

function sampleLabel(samplesRoot, filePath) {
  return relative(samplesRoot, filePath).replace(/\\/g, '/');
}

async function validateSamplePair({
  label,
  document,
  samplePath,
  expectedAttachmentTypes,
  expectedIkConstraints = false,
  expectedStateMachine = false,
  expectedSkinNames = ['default'],
  expectedAnimationNames = ['idle', 'walk'],
  expectedTextureNames = ['body.png', 'arm.png', 'body_armor.png', 'arm_armor.png', 'sword.png', 'axe.png'],
  compareExportToSample = true
}) {
  const exported = createUnityRuntimeExport(document);
  const validation = validateDocument(exported);

  assert.equal(
    validation.ok,
    true,
    `${label} should validate, got: ${validation.issues.map((issue) => issue.message).join('; ')}`
  );

  const parsedExport = JSON.parse(JSON.stringify(exported, null, 2));
  const packageSample = JSON.parse(await readFile(samplePath, 'utf8'));

  validateRuntimeDocument(parsedExport, `Electron ${label} export`, expectedAttachmentTypes, expectedIkConstraints, expectedStateMachine, expectedSkinNames, expectedAnimationNames, expectedTextureNames);
  validateRuntimeDocument(packageSample, `Unity ${label}`, expectedAttachmentTypes, expectedIkConstraints, expectedStateMachine, expectedSkinNames, expectedAnimationNames, expectedTextureNames);
  if (compareExportToSample) {
    assert.deepEqual(parsedExport, packageSample, `Electron ${label} export should match the Unity package sample.`);
  }
  return parsedExport;
}

function validateRuntimeDocument(
  document,
  label,
  expectedAttachmentTypes,
  expectedIkConstraints,
  expectedStateMachine,
  expectedSkinNames,
  expectedAnimationNames = ['idle', 'walk'],
  expectedTextureNames = ['body.png', 'arm.png', 'body_armor.png', 'arm_armor.png', 'sword.png', 'axe.png']
) {
  const documentKeys = ['version', 'name', 'bones', 'slots', 'skins', 'attachments', 'animations'];
  if (Object.hasOwn(document, 'ikConstraints')) {
    documentKeys.push('ikConstraints');
  }
  if (Object.hasOwn(document, 'stateMachines')) {
    documentKeys.push('stateMachines');
  }
  expectExactKeys(document, documentKeys, `${label} document`);
  assert.equal(document.version, 0, `${label} version should be 0`);
  assert.equal(typeof document.name, 'string', `${label} name should be a string`);
  assert.ok(document.name.length > 0, `${label} name should not be empty`);
  assert.ok(Array.isArray(document.bones), `${label} bones should be an array`);
  assert.ok(Array.isArray(document.slots), `${label} slots should be an array`);
  assert.ok(Array.isArray(document.skins), `${label} skins should be an array`);
  assert.ok(Array.isArray(document.attachments), `${label} attachments should be an array`);
  assert.ok(Array.isArray(document.animations), `${label} animations should be an array`);

  for (const bone of document.bones) {
    const boneKeys = ['name', 'parent', 'x', 'y', 'rotation', 'scaleX', 'scaleY'];
    if (Object.hasOwn(bone, 'length')) {
      boneKeys.push('length');
    }
    expectExactKeys(bone, boneKeys, `${label} bone`);
    assertFiniteNumbers(bone, boneKeys.filter((key) => key !== 'name' && key !== 'parent'), `${label} bone ${bone.name}`);
    if (Object.hasOwn(bone, 'length')) {
      assert.ok(bone.length > 0, `${label} bone length should be positive`);
    }
  }

  for (let index = 0; index < document.slots.length; index += 1) {
    const slot = document.slots[index];
    expectExactKeys(slot, ['name', 'bone', 'attachment', 'drawOrder'], `${label} slot`);
    assert.equal(slot.drawOrder, index, `${label} slot drawOrder should match array order`);
  }

  assert.ok(document.skins.length > 0, `${label} should have at least one skin`);
  for (const skinName of expectedSkinNames) {
    assert.ok(document.skins.some((skin) => skin.name === skinName), `${label} should include skin ${skinName}`);
  }
  for (const skin of document.skins) {
    expectExactKeys(skin, ['name', 'attachments'], `${label} skin`);
    assert.ok(Array.isArray(skin.attachments), `${label} skin attachments should be an array`);
  }
  if (document.skins.length === 1) {
    assert.equal(
      document.skins[0].attachments.length,
      document.attachments.length,
      `${label} default skin should include the exported region attachments`
    );
  }

  for (const attachment of document.attachments) {
    validateAttachment(attachment, label, document.bones);
  }
  for (const skin of document.skins) {
    for (const attachment of skin.attachments) {
      validateAttachment(attachment, `${label} ${skin.name} skin`, document.bones);
    }
  }

  const textureNames = new Set(expectedTextureNames.map(normalizeTextureName));
  for (const attachment of document.attachments) {
    assert.ok(
      textureNames.has(normalizeTextureName(attachment.image)),
      `${label} attachment image should match an exported texture name: ${attachment.image}`
    );
  }

  const animationNames = new Set(document.animations.map((animation) => animation.name));
  for (const animationName of expectedAnimationNames) {
    assert.ok(animationNames.has(animationName), `${label} should include ${animationName} animation`);
  }
  for (const expectedType of expectedAttachmentTypes) {
    assert.ok(
      document.attachments.some((attachment) => attachment.type === expectedType),
      `${label} should include ${expectedType} attachment`
    );
  }

  for (const animation of document.animations) {
    const animationKeys = ['name', 'loop'];
    if (Object.hasOwn(animation, 'duration')) {
      animationKeys.push('duration');
    }
    animationKeys.push('bones');
    if (Object.hasOwn(animation, 'deforms')) {
      animationKeys.push('deforms');
    }
    if (Object.hasOwn(animation, 'attachments')) {
      animationKeys.push('attachments');
    }
    if (Object.hasOwn(animation, 'drawOrders')) {
      animationKeys.push('drawOrders');
    }
    if (Object.hasOwn(animation, 'slots')) {
      animationKeys.push('slots');
    }
    if (Object.hasOwn(animation, 'events')) {
      animationKeys.push('events');
    }
    expectExactKeys(animation, animationKeys, `${label} animation`);
    assert.equal(typeof animation.loop, 'boolean', `${label} animation loop should be boolean`);
    if (Object.hasOwn(animation, 'duration')) {
      assert.equal(typeof animation.duration, 'number', `${label} animation duration should be a number`);
      assert.ok(animation.duration > 0, `${label} animation duration should be positive`);
    }
    assert.ok(Array.isArray(animation.bones), `${label} animation bones should be an array`);

    for (const timeline of animation.bones) {
      expectExactKeys(timeline, ['bone', 'translate', 'rotate', 'scale'], `${label} bone timeline`);
      validateKeyList(timeline.translate, ['time', 'x', 'y'], `${label} ${animation.name}/${timeline.bone}/translate`);
      validateKeyList(timeline.rotate, ['time', 'rotation'], `${label} ${animation.name}/${timeline.bone}/rotate`);
      validateKeyList(timeline.scale, ['time', 'scaleX', 'scaleY'], `${label} ${animation.name}/${timeline.bone}/scale`);
    }

    if (Object.hasOwn(animation, 'deforms')) {
      validateDeformTimelines(animation.deforms, document, `${label} ${animation.name}`);
    }
    if (Object.hasOwn(animation, 'attachments')) {
      validateAttachmentTimelines(animation.attachments, document, `${label} ${animation.name}`);
    }
    if (Object.hasOwn(animation, 'drawOrders')) {
      validateDrawOrderTimeline(animation.drawOrders, document, `${label} ${animation.name}`);
    }
    if (Object.hasOwn(animation, 'slots')) {
      validateSlotColorTimelines(animation.slots, document, `${label} ${animation.name}`);
    }
    if (Object.hasOwn(animation, 'events')) {
      validateEventTimeline(animation.events, `${label} ${animation.name}`);
    }
  }

  if (expectedIkConstraints) {
    validateIkConstraints(document.ikConstraints, document, label);
  } else {
    assert.ok(!Object.hasOwn(document, 'ikConstraints'), `${label} should not include IK constraints`);
  }

  if (expectedStateMachine) {
    validateStateMachines(document.stateMachines, document, label);
  } else {
    assert.ok(!Object.hasOwn(document, 'stateMachines'), `${label} should not include state machines`);
  }
}

async function validateSuwol2DPair({ samplePath, debugJsonPath, texturesPath, textureNames }) {
  const suwol2d = JSON.parse(await readFile(samplePath, 'utf8'));
  const debugJson = JSON.parse(await readFile(debugJsonPath, 'utf8'));
  assert.deepEqual(suwol2d, debugJson, '.suwol2d sample should match its debug .suwol2d.json file.');

  for (const textureName of textureNames) {
    await access(join(texturesPath, textureName));
  }
}

function validateSkinSample(document) {
  const defaultSkin = document.skins.find((skin) => skin.name === 'default');
  const armorSkin = document.skins.find((skin) => skin.name === 'armor_01');
  assert.ok(defaultSkin, 'skin sample should include default skin');
  assert.ok(armorSkin, 'skin sample should include armor_01 skin');

  assert.ok(defaultSkin.attachments.some((attachment) => attachment.slot === 'body_slot' && attachment.name === 'body'), 'default skin should include body on body_slot');
  assert.ok(defaultSkin.attachments.some((attachment) => attachment.slot === 'arm_slot' && attachment.name === 'arm'), 'default skin should include arm on arm_slot');
  assert.ok(armorSkin.attachments.some((attachment) => attachment.slot === 'body_slot' && attachment.name === 'body_armor'), 'armor skin should include body_armor on body_slot');
  assert.ok(armorSkin.attachments.some((attachment) => attachment.slot === 'arm_slot' && attachment.name === 'arm_armor'), 'armor skin should include arm_armor on arm_slot');
}

async function validateImporterSample({ samplePath, debugJsonPath, texturesPath }) {
  const suwol2d = JSON.parse(await readFile(samplePath, 'utf8'));
  const debugJson = JSON.parse(await readFile(debugJsonPath, 'utf8'));
  assert.deepEqual(suwol2d, debugJson, '.suwol2d importer sample should match its debug .suwol2d.json file.');
  validateRuntimeDocument(suwol2d, 'Unity importer sample', ['region'], false, false, ['default', 'armor_01']);
  validateSkinSample(suwol2d);

  for (const textureName of ['body.png', 'arm.png', 'body_armor.png', 'arm_armor.png']) {
    await access(join(texturesPath, textureName));
  }

  return suwol2d;
}

function validateIkConstraints(ikConstraints, document, label) {
  assert.ok(Array.isArray(ikConstraints), `${label} ikConstraints should be an array`);
  assert.ok(ikConstraints.length > 0, `${label} should include at least one IK constraint`);
  const boneNames = new Set(document.bones.map((bone) => bone.name));
  const childParent = new Map(document.bones.map((bone) => [bone.name, bone.parent]));
  const seenNames = new Set();
  const seenOrders = new Set();
  for (const constraint of ikConstraints) {
    expectExactKeys(
      constraint,
      ['name', 'parentBone', 'childBone', 'targetBone', 'enabled', 'mix', 'bendDirection', 'order'],
      `${label} IK constraint`
    );
    assert.equal(typeof constraint.name, 'string', `${label} IK name should be a string`);
    assert.ok(!seenNames.has(constraint.name), `${label} IK name should be unique`);
    seenNames.add(constraint.name);
    assert.ok(boneNames.has(constraint.parentBone), `${label} IK parent bone should exist`);
    assert.ok(boneNames.has(constraint.childBone), `${label} IK child bone should exist`);
    assert.ok(boneNames.has(constraint.targetBone), `${label} IK target bone should exist`);
    assert.equal(childParent.get(constraint.childBone), constraint.parentBone, `${label} IK child should be parented to parent`);
    assert.ok(Number.isFinite(constraint.mix), `${label} IK mix should be finite`);
    assert.ok(constraint.mix >= 0 && constraint.mix <= 1, `${label} IK mix should be in range`);
    assert.ok(constraint.bendDirection === 1 || constraint.bendDirection === -1, `${label} IK bendDirection should be 1 or -1`);
    assert.ok(Number.isInteger(constraint.order), `${label} IK order should be integer`);
    assert.ok(!seenOrders.has(constraint.order), `${label} IK order should be unique`);
    seenOrders.add(constraint.order);
  }
}

function validateStateMachines(stateMachines, document, label) {
  assert.ok(Array.isArray(stateMachines), `${label} stateMachines should be an array`);
  assert.ok(stateMachines.length > 0, `${label} should include at least one state machine`);
  const animationNames = new Set(document.animations.map((animation) => animation.name));
  const machineNames = new Set();

  for (const machine of stateMachines) {
    expectExactKeys(machine, ['name', 'initialState', 'states', 'parameters', 'transitions'], `${label} state machine`);
    assert.equal(typeof machine.name, 'string', `${label} state machine name should be a string`);
    assert.ok(machine.name.length > 0, `${label} state machine name should not be empty`);
    assert.ok(!machineNames.has(machine.name), `${label} state machine names should be unique`);
    machineNames.add(machine.name);

    const stateNames = new Set();
    for (const state of machine.states) {
      expectExactKeys(state, ['name', 'animation', 'loop', 'speed'], `${label} state`);
      assert.equal(typeof state.name, 'string', `${label} state name should be a string`);
      assert.ok(state.name.length > 0, `${label} state name should not be empty`);
      assert.ok(!stateNames.has(state.name), `${label} state names should be unique`);
      stateNames.add(state.name);
      assert.ok(animationNames.has(state.animation), `${label} state animation should exist: ${state.animation}`);
      assert.equal(typeof state.loop, 'boolean', `${label} state loop should be boolean`);
      assert.ok(Number.isFinite(state.speed), `${label} state speed should be finite`);
    }

    assert.ok(stateNames.has(machine.initialState), `${label} initialState should exist: ${machine.initialState}`);

    const parameterTypes = new Map();
    for (const parameter of machine.parameters) {
      const keys = ['name', 'type'];
      if (parameter.type === 'bool') {
        keys.push('defaultBool');
      }
      expectExactKeys(parameter, keys, `${label} state parameter`);
      assert.ok(parameter.type === 'bool' || parameter.type === 'trigger', `${label} parameter type should be bool or trigger`);
      assert.ok(!parameterTypes.has(parameter.name), `${label} parameter names should be unique`);
      parameterTypes.set(parameter.name, parameter.type);
      if (parameter.type === 'bool') {
        assert.equal(typeof parameter.defaultBool, 'boolean', `${label} defaultBool should be boolean`);
      }
    }

    for (const transition of machine.transitions) {
      expectExactKeys(transition, ['from', 'to', 'fadeDuration', 'conditions'], `${label} transition`);
      assert.ok(transition.from === '*' || stateNames.has(transition.from), `${label} transition from should exist: ${transition.from}`);
      assert.ok(stateNames.has(transition.to), `${label} transition to should exist: ${transition.to}`);
      assert.ok(Number.isFinite(transition.fadeDuration) && transition.fadeDuration >= 0, `${label} transition fadeDuration should be non-negative`);
      assert.ok(Array.isArray(transition.conditions) && transition.conditions.length > 0, `${label} transition should include conditions`);

      for (const condition of transition.conditions) {
        const parameterType = parameterTypes.get(condition.parameter);
        assert.ok(parameterType, `${label} condition parameter should exist: ${condition.parameter}`);
        if (parameterType === 'trigger') {
          expectExactKeys(condition, ['parameter', 'mode'], `${label} trigger condition`);
          assert.equal(condition.mode, 'triggered', `${label} trigger condition should use triggered mode`);
        } else {
          expectExactKeys(condition, ['parameter', 'mode', 'boolValue'], `${label} bool condition`);
          assert.equal(condition.mode, 'equals', `${label} bool condition should use equals mode`);
          assert.equal(typeof condition.boolValue, 'boolean', `${label} bool condition boolValue should be boolean`);
        }
      }
    }
  }
}

function validateAttachment(attachment, label, bones) {
  if (attachment.type === 'region') {
    expectExactKeys(
      attachment,
      ['name', 'slot', 'type', 'image', 'x', 'y', 'rotation', 'width', 'height', 'scaleX', 'scaleY'],
      `${label} region attachment`
    );
    assert.ok(attachment.width > 0, `${label} region attachment width should be positive`);
    assert.ok(attachment.height > 0, `${label} region attachment height should be positive`);
    assertFiniteNumbers(attachment, ['x', 'y', 'rotation', 'width', 'height', 'scaleX', 'scaleY'], `${label} attachment ${attachment.name}`);
    return;
  }

  if (attachment.type === 'mesh') {
    const meshKeys = ['name', 'slot', 'type', 'image', 'x', 'y', 'rotation', 'scaleX', 'scaleY', 'vertices', 'triangles'];
    if (Object.hasOwn(attachment, 'weights')) {
      meshKeys.push('weights');
    }

    expectExactKeys(
      attachment,
      meshKeys,
      `${label} mesh attachment`
    );
    assertFiniteNumbers(attachment, ['x', 'y', 'rotation', 'scaleX', 'scaleY'], `${label} mesh attachment ${attachment.name}`);
    validateMeshAttachment(attachment, label, bones);
    return;
  }

  assert.fail(`${label} attachment has unsupported type: ${attachment.type}`);
}

function validateMeshAttachment(attachment, label, bones) {
  assert.ok(Array.isArray(attachment.vertices), `${label} mesh vertices should be an array`);
  assert.ok(attachment.vertices.length >= 3, `${label} mesh needs at least 3 vertices`);
  assert.ok(Array.isArray(attachment.triangles), `${label} mesh triangles should be an array`);
  assert.ok(attachment.triangles.length > 0, `${label} mesh triangles should not be empty`);
  assert.equal(attachment.triangles.length % 3, 0, `${label} mesh triangle count should be a multiple of 3`);

  for (const vertex of attachment.vertices) {
    expectExactKeys(vertex, ['x', 'y', 'u', 'v'], `${label} mesh vertex`);
    assertFiniteNumbers(vertex, ['x', 'y', 'u', 'v'], `${label} mesh vertex`);
  }

  for (const index of attachment.triangles) {
    assert.ok(Number.isInteger(index), `${label} mesh triangle index should be integer`);
    assert.ok(index >= 0 && index < attachment.vertices.length, `${label} mesh triangle index should be in vertex range`);
  }

  if (Object.hasOwn(attachment, 'weights')) {
    validateMeshWeights(attachment, label, bones);
  }
}

function validateMeshWeights(attachment, label, bones) {
  assert.ok(Array.isArray(attachment.weights), `${label} mesh weights should be an array`);
  assert.equal(
    attachment.weights.length,
    attachment.vertices.length,
    `${label} weighted mesh sample should provide weights for every vertex`
  );

  const boneNames = new Set(bones.map((bone) => bone.name));
  const seenVertices = new Set();
  for (const vertexWeight of attachment.weights) {
    expectExactKeys(vertexWeight, ['vertex', 'bones'], `${label} mesh vertex weight`);
    assert.ok(Number.isInteger(vertexWeight.vertex), `${label} mesh weight vertex should be integer`);
    assert.ok(vertexWeight.vertex >= 0 && vertexWeight.vertex < attachment.vertices.length, `${label} mesh weight vertex should be in range`);
    assert.ok(!seenVertices.has(vertexWeight.vertex), `${label} mesh weight vertex should not be duplicated`);
    seenVertices.add(vertexWeight.vertex);
    assert.ok(Array.isArray(vertexWeight.bones), `${label} mesh vertex bones should be an array`);
    assert.ok(vertexWeight.bones.length > 0, `${label} mesh vertex should have at least one bone weight`);

    let sum = 0;
    const seenBones = new Set();
    for (const boneWeight of vertexWeight.bones) {
      expectExactKeys(boneWeight, ['bone', 'weight'], `${label} mesh bone weight`);
      assert.equal(typeof boneWeight.bone, 'string', `${label} mesh bone weight name should be a string`);
      assert.ok(boneNames.has(boneWeight.bone), `${label} mesh bone weight should reference an existing bone: ${boneWeight.bone}`);
      assert.ok(!seenBones.has(boneWeight.bone), `${label} mesh bone weight should not duplicate bone ${boneWeight.bone}`);
      seenBones.add(boneWeight.bone);
      assert.ok(Number.isFinite(boneWeight.weight), `${label} mesh bone weight should be finite`);
      assert.ok(boneWeight.weight >= 0, `${label} mesh bone weight should not be negative`);
      sum += boneWeight.weight;
    }

    assert.ok(Math.abs(sum - 1) <= 0.001, `${label} mesh vertex ${vertexWeight.vertex} weights should sum to 1`);
  }
}

function validateDeformTimelines(deforms, document, label) {
  assert.ok(Array.isArray(deforms), `${label} deforms should be an array`);
  assert.ok(deforms.length > 0, `${label} should include at least one deform timeline`);

  const slotsByName = new Map(document.slots.map((slot) => [slot.name, slot]));
  const attachmentsByName = new Map(document.attachments.map((attachment) => [attachment.name, attachment]));
  for (const deform of deforms) {
    expectExactKeys(deform, ['slot', 'attachment', 'keys'], `${label} deform timeline`);
    assert.ok(slotsByName.has(deform.slot), `${label} deform slot should exist`);
    const attachment = attachmentsByName.get(deform.attachment);
    assert.ok(attachment, `${label} deform attachment should exist`);
    assert.equal(attachment.type, 'mesh', `${label} deform target should be a mesh attachment`);
    assert.equal(attachment.slot, deform.slot, `${label} deform target should belong to the deform slot`);
    assert.ok(Array.isArray(deform.keys), `${label} deform keys should be an array`);
    assert.ok(deform.keys.length > 0, `${label} deform timeline should have keys`);

    let previousTime = -Infinity;
    const seenTimes = new Set();
    for (const key of deform.keys) {
      expectExactKeys(key, ['time', 'offsets'], `${label} deform key`);
      assert.ok(Number.isFinite(key.time), `${label} deform key time should be finite`);
      assert.ok(key.time >= 0, `${label} deform key time should be non-negative`);
      assert.ok(key.time >= previousTime, `${label} deform keys should be sorted`);
      previousTime = key.time;
      assert.ok(!seenTimes.has(key.time), `${label} deform key time should not be duplicated`);
      seenTimes.add(key.time);
      assert.ok(Array.isArray(key.offsets), `${label} deform offsets should be an array`);

      let previousVertex = -1;
      const seenVertices = new Set();
      for (const offset of key.offsets) {
        expectExactKeys(offset, ['vertex', 'x', 'y'], `${label} deform offset`);
        assert.ok(Number.isInteger(offset.vertex), `${label} deform offset vertex should be integer`);
        assert.ok(offset.vertex >= 0 && offset.vertex < attachment.vertices.length, `${label} deform offset vertex should be in range`);
        assert.ok(offset.vertex >= previousVertex, `${label} deform offsets should be sorted`);
        previousVertex = offset.vertex;
        assert.ok(!seenVertices.has(offset.vertex), `${label} deform offset vertex should not be duplicated`);
        seenVertices.add(offset.vertex);
        assertFiniteNumbers(offset, ['x', 'y'], `${label} deform offset`);
      }
    }
  }
}

function validateAttachmentTimelines(timelines, document, label) {
  assert.ok(Array.isArray(timelines), `${label} attachment timelines should be an array`);
  assert.ok(timelines.length > 0, `${label} should include attachment timelines`);
  const slotNames = new Set(document.slots.map((slot) => slot.name));
  const attachmentNames = new Set(document.attachments.map((attachment) => attachment.name));
  for (const timeline of timelines) {
    expectExactKeys(timeline, ['slot', 'keys'], `${label} attachment timeline`);
    assert.ok(slotNames.has(timeline.slot), `${label} attachment timeline slot should exist`);
    validateKeyList(timeline.keys, ['time', 'attachment'], `${label} attachment keys`, { allowNullAttachment: true });
    for (const key of timeline.keys) {
      if (key.attachment !== null) {
        assert.ok(attachmentNames.has(key.attachment), `${label} attachment key should reference an attachment`);
      }
    }
  }
}

function validateDrawOrderTimeline(keys, document, label) {
  assert.ok(Array.isArray(keys), `${label} draw order keys should be an array`);
  assert.ok(keys.length > 0, `${label} should include draw order keys`);
  const slotNames = new Set(document.slots.map((slot) => slot.name));
  let previousTime = -Infinity;
  for (const key of keys) {
    expectExactKeys(key, ['time', 'slots'], `${label} draw order key`);
    assert.ok(key.time >= previousTime, `${label} draw order keys should be sorted`);
    previousTime = key.time;
    let previousOrder = -Infinity;
    const seenSlots = new Set();
    for (const entry of key.slots) {
      expectExactKeys(entry, ['slot', 'drawOrder'], `${label} draw order slot`);
      assert.ok(slotNames.has(entry.slot), `${label} draw order slot should exist`);
      assert.ok(Number.isInteger(entry.drawOrder), `${label} drawOrder should be integer`);
      assert.ok(entry.drawOrder >= previousOrder, `${label} draw order slots should be sorted by drawOrder`);
      previousOrder = entry.drawOrder;
      assert.ok(!seenSlots.has(entry.slot), `${label} draw order slot should not repeat`);
      seenSlots.add(entry.slot);
    }
  }
}

function validateSlotColorTimelines(timelines, document, label) {
  assert.ok(Array.isArray(timelines), `${label} slot color timelines should be an array`);
  assert.ok(timelines.length > 0, `${label} should include slot color timelines`);
  const slotNames = new Set(document.slots.map((slot) => slot.name));
  for (const timeline of timelines) {
    expectExactKeys(timeline, ['slot', 'color'], `${label} slot color timeline`);
    assert.ok(slotNames.has(timeline.slot), `${label} slot color timeline slot should exist`);
    validateKeyList(timeline.color, ['time', 'r', 'g', 'b', 'a'], `${label} slot color keys`);
    for (const key of timeline.color) {
      for (const field of ['r', 'g', 'b', 'a']) {
        assert.ok(key[field] >= 0 && key[field] <= 1, `${label} ${field} should be in 0..1`);
      }
    }
  }
}

function validateEventTimeline(events, label) {
  assert.ok(Array.isArray(events), `${label} events should be an array`);
  assert.ok(events.length > 0, `${label} should include event keys`);
  validateKeyList(events, ['time', 'name', 'intValue', 'floatValue', 'stringValue'], `${label} event keys`);
  for (const event of events) {
    assert.ok(event.name.trim().length > 0, `${label} event name should not be empty`);
  }
}

function validateKeyList(keys, fields, label, options = {}) {
  assert.ok(Array.isArray(keys), `${label} should be an array`);
  let previousTime = -Infinity;
  for (const key of keys) {
    expectExactKeys(key, fields, label);
    assert.ok(Number.isFinite(key.time), `${label} time should be finite`);
    assert.ok(key.time >= previousTime, `${label} key times should be sorted`);
    previousTime = key.time;
    const numericFields = fields.filter((field) => field !== 'name' && field !== 'attachment' && field !== 'stringValue');
    assertFiniteNumbers(key, numericFields, label);
    if (fields.includes('attachment') && !options.allowNullAttachment) {
      assert.equal(typeof key.attachment, 'string', `${label} attachment should be a string`);
    }
  }
}

function assertFiniteNumbers(object, fields, label) {
  for (const field of fields) {
    assert.ok(Number.isFinite(object[field]), `${label}.${field} should be a finite number`);
  }
}

function expectExactKeys(object, keys, label) {
  assert.deepEqual(Object.keys(object), keys, `${label} fields should match Suwol2D JSON format`);
}

function getWeightedMesh(document) {
  const attachment = document.attachments.find((candidate) => candidate.type === 'mesh' && Array.isArray(candidate.weights));
  assert.ok(attachment, 'weighted mesh sample should include a mesh with weights');
  return attachment;
}

function normalizeTextureName(value) {
  return value.replace(/\\/g, '/').split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
}
