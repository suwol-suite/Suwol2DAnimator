import type {
  Suwol2DAttachment,
  Suwol2DAttachmentTimeline,
  Suwol2DAtlas,
  Suwol2DDocument,
  Suwol2DDrawOrderKey,
  Suwol2DEventKey,
  Suwol2DIkConstraint,
  Suwol2DClippingAttachment,
  Suwol2DMeshAttachment,
  Suwol2DStateMachine,
  Suwol2DSlotTimeline,
  Suwol2DInterpolation
} from './suwol2d-format';
import { defaultSkinName, getEffectiveSkins } from './skins.ts';
import type { TranslationKey, TranslationParams } from './i18n/types';
import { isSuwol2DInterpolation } from './interpolation.ts';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  code?: string;
  messageKey?: TranslationKey;
  params?: TranslationParams;
  targetType?: string;
  targetName?: string;
  path?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export function validateDocument(document: Suwol2DDocument): ValidationResult {
  const issues: ValidationIssue[] = [];
  const boneNames = new Set<string>();
  const slotNames = new Set<string>();
  const attachmentsByName = new Map<string, Suwol2DAttachment[]>();
  const animationNames = new Set<string>();

  if (!document.name.trim()) {
    issues.push({ severity: 'error', message: 'Document name is empty.' });
  }

  for (const bone of document.bones) {
    if (!bone.name.trim()) {
      issues.push({ severity: 'error', message: 'Bone has an empty name.' });
      continue;
    }

    if (boneNames.has(bone.name)) {
      issues.push({ severity: 'error', message: `Duplicate bone name: ${bone.name}` });
    }
    boneNames.add(bone.name);

    if (bone.parent && !document.bones.some((candidate) => candidate.name === bone.parent)) {
      issues.push({ severity: 'error', message: `Bone '${bone.name}' references missing parent '${bone.parent}'.` });
    }

    validateFiniteTransform(issues, `Bone '${bone.name}'`, [
      bone.x,
      bone.y,
      bone.rotation,
      bone.scaleX,
      bone.scaleY
    ]);

    if (bone.length !== undefined) {
      if (!Number.isFinite(bone.length)) {
        issues.push({ severity: 'error', message: `Bone '${bone.name}' has invalid length.` });
      } else if (bone.length <= 0) {
        issues.push({ severity: 'warning', message: `Bone '${bone.name}' has non-positive length; IK export will use a fallback.` });
      }
    }
  }

  for (const slot of document.slots) {
    if (!slot.name.trim()) {
      issues.push({ severity: 'error', message: 'Slot has an empty name.' });
      continue;
    }

    if (slotNames.has(slot.name)) {
      issues.push({ severity: 'error', message: `Duplicate slot name: ${slot.name}` });
    }
    slotNames.add(slot.name);

    if (!boneNames.has(slot.bone)) {
      issues.push({ severity: 'error', message: `Slot '${slot.name}' references missing bone '${slot.bone}'.` });
    }

    if (!Number.isFinite(slot.drawOrder)) {
      issues.push({ severity: 'error', message: `Slot '${slot.name}' has invalid drawOrder.` });
    }

  }

  validateBoneHierarchy(issues, document);
  validateSkins(issues, document, slotNames, boneNames, attachmentsByName);
  validateSlotAttachmentReferences(issues, document, attachmentsByName);

  for (const animation of document.animations) {
    if (!animation.name.trim()) {
      issues.push({ severity: 'error', message: 'Animation has an empty name.' });
      continue;
    }

    if (animationNames.has(animation.name)) {
      issues.push({ severity: 'error', message: `Duplicate animation name: ${animation.name}` });
    }
    animationNames.add(animation.name);
    validateAnimationDuration(issues, animation);

    for (const timeline of animation.bones) {
      if (!boneNames.has(timeline.bone)) {
        issues.push({
          severity: 'error',
          message: `Animation '${animation.name}' references missing bone '${timeline.bone}'.`
        });
      }

      for (const key of timeline.translate) {
        validateKeyTime(issues, animation.name, timeline.bone, key.time);
        validateFiniteTransform(issues, `Translate key '${animation.name}/${timeline.bone}'`, [key.x, key.y]);
        validateInterpolation(issues, animation.name, `translate '${timeline.bone}'`, key.interpolation);
      }
      for (const key of timeline.rotate) {
        validateKeyTime(issues, animation.name, timeline.bone, key.time);
        validateFiniteTransform(issues, `Rotate key '${animation.name}/${timeline.bone}'`, [key.rotation]);
        validateInterpolation(issues, animation.name, `rotate '${timeline.bone}'`, key.interpolation);
      }
      for (const key of timeline.scale) {
        validateKeyTime(issues, animation.name, timeline.bone, key.time);
        validateFiniteTransform(issues, `Scale key '${animation.name}/${timeline.bone}'`, [key.scaleX, key.scaleY]);
        validateInterpolation(issues, animation.name, `scale '${timeline.bone}'`, key.interpolation);
      }
    }

    validateDeformTimelines(issues, animation.name, animation.deforms ?? [], slotNames, attachmentsByName);
    validateAttachmentTimelines(issues, animation.name, animation.attachments ?? [], slotNames, attachmentsByName);
    validateDrawOrderTimelines(issues, animation.name, animation.drawOrders ?? [], slotNames);
    validateSlotColorTimelines(issues, animation.name, animation.slots ?? [], slotNames);
    validateEventTimeline(issues, animation.name, animation.events ?? []);
    validateKeysWithinExplicitDuration(issues, animation);
  }

  validateIkConstraints(issues, document.ikConstraints ?? [], document, boneNames);
  validateStateMachines(issues, document.stateMachines ?? [], animationNames, document.animations);
  validateAtlases(issues, document.atlases ?? []);

  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues: issues.map(localizeValidationIssue)
  };
}

function localizeValidationIssue(issue: ValidationIssue): ValidationIssue {
  if (issue.messageKey) {
    return issue;
  }

  const message = issue.message;
  const duplicate = message.match(/^Duplicate (.+?) name: (.+)$/);
  if (duplicate) {
    return withKey(issue, 'validation.duplicateName', { type: duplicate[1], name: duplicate[2] });
  }

  const empty = message.match(/^(.+?) has an empty name\.$/);
  if (empty) {
    return withKey(issue, 'validation.emptyName', { type: empty[1] });
  }

  const animationMissingBone = message.match(/^Animation '(.+?)' references missing bone '(.+?)'\.$/);
  if (animationMissingBone) {
    return withKey(issue, 'validation.missingBone', { owner: `Animation '${animationMissingBone[1]}'`, name: animationMissingBone[2] });
  }

  const missingBone = message.match(/^(.+?) '(.+?)' references missing (parent |child |target |weight )?bone '(.+?)'\.$/);
  if (missingBone) {
    return withKey(issue, 'validation.missingBone', { owner: `${missingBone[1]} '${missingBone[2]}'`, name: missingBone[4] });
  }

  const missingSlot = message.match(/^(.+?) references missing slot '(.+?)'\.$/);
  if (missingSlot) {
    return withKey(issue, 'validation.missingSlot', { owner: missingSlot[1], name: missingSlot[2] });
  }

  const missingAttachment = message.match(/^(.+?) references missing attachment '(.+?)'\.$/);
  if (missingAttachment) {
    return withKey(issue, 'validation.missingAttachment', { owner: missingAttachment[1], name: missingAttachment[2] });
  }

  const noImage = message.match(/^Attachment '(.+?)' has no image\.$/);
  if (noImage) {
    return withKey(issue, 'validation.missingTexture', { name: noImage[1] });
  }

  const invalidDuration = message.match(/^Animation '(.+?)' has invalid duration\.$/);
  if (invalidDuration) {
    return withKey(issue, 'validation.invalidDuration', { animation: invalidDuration[1] });
  }

  const durationExceeded = message.match(/^Animation '(.+?)' (.+?) key at .+ is outside explicit duration (.+)\.$/);
  if (durationExceeded) {
    return withKey(issue, 'validation.durationExceeded', {
      animation: durationExceeded[1],
      label: durationExceeded[2],
      duration: durationExceeded[3]
    });
  }

  const invalidKeyTime = message.match(/^Animation '(.+?)' has invalid key time/);
  if (invalidKeyTime) {
    return withKey(issue, 'validation.invalidKeyTime', { animation: invalidKeyTime[1] });
  }

  const invalidInterpolation = message.match(/^Animation '(.+?)' (.+?) key has unsupported interpolation '(.+?)'\.$/);
  if (invalidInterpolation) {
    return withKey(issue, 'validation.invalidInterpolation', {
      animation: invalidInterpolation[1],
      label: invalidInterpolation[2],
      value: invalidInterpolation[3]
    });
  }

  const ignoredInterpolation = message.match(/^Animation '(.+?)' (.+?) ignores interpolation on discrete keys\.$/);
  if (ignoredInterpolation) {
    return withKey(issue, 'validation.interpolationIgnoredForDiscreteTimeline', {
      animation: ignoredInterpolation[1],
      label: ignoredInterpolation[2]
    });
  }

  const invalidNumber = message.match(/^(.+?) contains NaN or Infinity\.$/);
  if (invalidNumber) {
    return withKey(issue, 'validation.invalidNumber', { target: invalidNumber[1] });
  }

  const meshNeedsVertices = message.match(/^Mesh attachment '(.+?)' needs at least 3 vertices\.$/);
  if (meshNeedsVertices) {
    return withKey(issue, 'validation.meshNeedsVertices', { name: meshNeedsVertices[1] });
  }

  const meshNeedsTriangles = message.match(/^Mesh attachment '(.+?)' needs triangle indices\.$/);
  if (meshNeedsTriangles) {
    return withKey(issue, 'validation.meshNeedsTriangles', { name: meshNeedsTriangles[1] });
  }

  const meshTriangleOutOfRange = message.match(/^Mesh attachment '(.+?)' has triangle index outside vertex range\.$/);
  if (meshTriangleOutOfRange) {
    return withKey(issue, 'validation.meshTriangleOutOfRange', { name: meshTriangleOutOfRange[1] });
  }

  const meshWeightOutOfRange = message.match(/^Mesh attachment '(.+?)' has weight for vertex outside range\.$/);
  if (meshWeightOutOfRange) {
    return withKey(issue, 'validation.meshWeightOutOfRange', { name: meshWeightOutOfRange[1] });
  }

  const meshWeightMissingBone = message.match(/^Mesh attachment '(.+?)' references missing weight bone '(.+?)'\.$/);
  if (meshWeightMissingBone) {
    return withKey(issue, 'validation.meshWeightMissingBone', { name: meshWeightMissingBone[1], bone: meshWeightMissingBone[2] });
  }

  const clippingTooFewVertices = message.match(/^Clipping attachment '(.+?)' needs at least 3 vertices\.$/);
  if (clippingTooFewVertices) {
    return withKey(issue, 'validation.clippingTooFewVertices', { name: clippingTooFewVertices[1] });
  }

  const clippingInvalidVertex = message.match(/^Clipping attachment '(.+?)' has invalid vertex at index (.+?)\.$/);
  if (clippingInvalidVertex) {
    return withKey(issue, 'validation.clippingInvalidVertex', { name: clippingInvalidVertex[1], index: clippingInvalidVertex[2] });
  }

  const clippingMissingEndSlot = message.match(/^Clipping attachment '(.+?)' references missing endSlot '(.+?)'\.$/);
  if (clippingMissingEndSlot) {
    return withKey(issue, 'validation.clippingMissingEndSlot', { name: clippingMissingEndSlot[1], slot: clippingMissingEndSlot[2] });
  }

  const clippingZeroArea = message.match(/^Clipping attachment '(.+?)' polygon has zero area\.$/);
  if (clippingZeroArea) {
    return withKey(issue, 'validation.clippingZeroArea', { name: clippingZeroArea[1] });
  }

  const clippingConcave = message.match(/^Clipping attachment '(.+?)' polygon is concave and v21 officially supports convex polygons only\.$/);
  if (clippingConcave) {
    return withKey(issue, 'validation.clippingConcaveUnsupported', { name: clippingConcave[1] });
  }

  const clippingEndSlotBeforeStart = message.match(/^Clipping attachment '(.+?)' endSlot '(.+?)' is before the clipping slot in draw order\.$/);
  if (clippingEndSlotBeforeStart) {
    return withKey(issue, 'validation.clippingEndSlotBeforeStart', { name: clippingEndSlotBeforeStart[1], slot: clippingEndSlotBeforeStart[2] });
  }

  const duplicateAtlasRegion = message.match(/^Atlas '(.+?)' has duplicate region '(.+?)'\.$/);
  if (duplicateAtlasRegion) {
    return withKey(issue, 'validation.duplicateAtlasRegion', { atlas: duplicateAtlasRegion[1], region: duplicateAtlasRegion[2] });
  }

  const atlasRegionOutOfBounds = message.match(/^Atlas '(.+?)' region '(.+?)' is outside atlas bounds\.$/);
  if (atlasRegionOutOfBounds) {
    return withKey(issue, 'validation.atlasRegionOutOfBounds', { atlas: atlasRegionOutOfBounds[1], region: atlasRegionOutOfBounds[2] });
  }

  const stateMissingAnimation = message.match(/^State machine '(.+?)' state '(.+?)' references missing animation '(.+?)'\.$/);
  if (stateMissingAnimation) {
    return withKey(issue, 'validation.stateMachineMissingAnimation', {
      machine: stateMissingAnimation[1],
      state: stateMissingAnimation[2],
      animation: stateMissingAnimation[3]
    });
  }

  const ikMissingBone = message.match(/^IK constraint '(.+?)' references missing (parent|child|target) bone '(.+?)'\.$/);
  if (ikMissingBone) {
    return withKey(issue, 'validation.ikMissingBone', {
      constraint: ikMissingBone[1],
      role: ikMissingBone[2],
      bone: ikMissingBone[3]
    });
  }

  if (message === 'Document name is empty.') {
    return withKey(issue, 'validation.documentNameEmpty');
  }

  return withKey(issue, 'validation.genericIssue', { message });
}

function validateAtlases(issues: ValidationIssue[], atlases: Suwol2DAtlas[]): void {
  const atlasNames = new Set<string>();
  for (const atlas of atlases) {
    const atlasName = atlas.name?.trim() || '(unnamed)';
    if (!atlas.name?.trim()) {
      issues.push({ severity: 'error', message: 'Atlas has an empty name.' });
    } else if (atlasNames.has(atlas.name)) {
      issues.push({ severity: 'error', message: `Duplicate atlas name: ${atlas.name}` });
    }
    atlasNames.add(atlas.name);

    if (!atlas.image?.trim()) {
      issues.push({ severity: 'error', message: `Atlas '${atlasName}' has no image.` });
    }

    if (!Number.isInteger(atlas.width) || !Number.isInteger(atlas.height) || atlas.width <= 0 || atlas.height <= 0) {
      issues.push({ severity: 'error', message: `Atlas '${atlasName}' has invalid dimensions.` });
    }

    const regionNames = new Set<string>();
    for (const region of atlas.regions ?? []) {
      const regionName = region.name?.trim() || '(unnamed)';
      if (!region.name?.trim()) {
        issues.push({ severity: 'error', message: `Atlas '${atlasName}' has a region with an empty name.` });
      } else if (regionNames.has(region.name)) {
        issues.push({ severity: 'error', message: `Atlas '${atlasName}' has duplicate region '${region.name}'.` });
      }
      regionNames.add(region.name);

      if (
        !Number.isInteger(region.x) ||
        !Number.isInteger(region.y) ||
        !Number.isInteger(region.width) ||
        !Number.isInteger(region.height) ||
        region.x < 0 ||
        region.y < 0 ||
        region.width <= 0 ||
        region.height <= 0 ||
        region.x + region.width > atlas.width ||
        region.y + region.height > atlas.height
      ) {
        issues.push({ severity: 'error', message: `Atlas '${atlasName}' region '${regionName}' is outside atlas bounds.` });
      }

      if (
        !isUnitRange(region.u) ||
        !isUnitRange(region.v) ||
        !isUnitRange(region.u2) ||
        !isUnitRange(region.v2) ||
        region.u2 <= region.u ||
        region.v2 <= region.v
      ) {
        issues.push({ severity: 'error', message: `Atlas '${atlasName}' region '${regionName}' has invalid UV range.` });
      }
    }
  }
}

function withKey(issue: ValidationIssue, messageKey: TranslationKey, params: TranslationParams = {}): ValidationIssue {
  return {
    ...issue,
    code: messageKey,
    messageKey,
    params
  };
}

function validateStateMachines(
  issues: ValidationIssue[],
  stateMachines: Suwol2DStateMachine[],
  animationNames: Set<string>,
  animations: Suwol2DDocument['animations']
): void {
  const machineNames = new Set<string>();
  const durationByAnimation = new Map(animations.map((animation) => [animation.name, getAnimationDurationForValidation(animation)]));

  for (const machine of stateMachines) {
    const machineName = machine.name.trim();
    const machineLabel = machineName || '(unnamed)';
    if (!machineName) {
      issues.push({ severity: 'error', message: 'State machine has an empty name.' });
    } else if (machineNames.has(machineName)) {
      issues.push({ severity: 'error', message: `Duplicate state machine name: ${machineName}` });
    }
    machineNames.add(machineName);

    const stateNames = new Set<string>();
    for (const state of machine.states ?? []) {
      const stateName = state.name.trim();
      if (!stateName) {
        issues.push({ severity: 'error', message: `State machine '${machineLabel}' has a state with an empty name.` });
        continue;
      }

      if (stateNames.has(stateName)) {
        issues.push({ severity: 'error', message: `State machine '${machineLabel}' has duplicate state '${stateName}'.` });
      }
      stateNames.add(stateName);

      if (!animationNames.has(state.animation)) {
        issues.push({
          severity: 'error',
          message: `State machine '${machineLabel}' state '${stateName}' references missing animation '${state.animation}'.`
        });
      } else if ((durationByAnimation.get(state.animation) ?? 0) <= 0) {
        issues.push({
          severity: 'warning',
          message: `State machine '${machineLabel}' state '${stateName}' uses animation '${state.animation}' with 0 duration.`
        });
      }

      if (!Number.isFinite(state.speed)) {
        issues.push({ severity: 'error', message: `State machine '${machineLabel}' state '${stateName}' has invalid speed.` });
      }
    }

    if (!stateNames.has(machine.initialState)) {
      issues.push({
        severity: 'error',
        message: `State machine '${machineLabel}' initialState '${machine.initialState}' does not exist.`
      });
    }

    const parametersByName = new Map<string, 'bool' | 'trigger'>();
    for (const parameter of machine.parameters ?? []) {
      const parameterName = parameter.name.trim();
      if (!parameterName) {
        issues.push({ severity: 'error', message: `State machine '${machineLabel}' has a parameter with an empty name.` });
        continue;
      }

      if (parametersByName.has(parameterName)) {
        issues.push({ severity: 'error', message: `State machine '${machineLabel}' has duplicate parameter '${parameterName}'.` });
      }

      if (parameter.type !== 'bool' && parameter.type !== 'trigger') {
        issues.push({
          severity: 'error',
          message: `State machine '${machineLabel}' parameter '${parameterName}' has unsupported type '${String(parameter.type)}'.`
        });
      } else {
        parametersByName.set(parameterName, parameter.type);
      }
    }

    for (const transition of machine.transitions ?? []) {
      const from = transition.from.trim();
      const to = transition.to.trim();
      if (from !== '*' && !stateNames.has(from)) {
        issues.push({
          severity: 'error',
          message: `State machine '${machineLabel}' transition from '${from}' does not exist.`
        });
      }

      if (!stateNames.has(to)) {
        issues.push({
          severity: 'error',
          message: `State machine '${machineLabel}' transition to '${to}' does not exist.`
        });
      }

      if (!Number.isFinite(transition.fadeDuration) || transition.fadeDuration < 0) {
        issues.push({
          severity: 'error',
          message: `State machine '${machineLabel}' transition '${from}' -> '${to}' has invalid fadeDuration.`
        });
      } else if (transition.fadeDuration > 2) {
        issues.push({
          severity: 'warning',
          message: `State machine '${machineLabel}' transition '${from}' -> '${to}' has a long fadeDuration.`
        });
      }

      if ((transition.conditions ?? []).length === 0) {
        issues.push({
          severity: 'warning',
          message: `State machine '${machineLabel}' transition '${from}' -> '${to}' has no conditions.`
        });
      }

      for (const condition of transition.conditions ?? []) {
        const parameterName = condition.parameter.trim();
        const parameterType = parametersByName.get(parameterName);
        if (!parameterType) {
          issues.push({
            severity: 'error',
            message: `State machine '${machineLabel}' transition '${from}' -> '${to}' references missing parameter '${condition.parameter}'.`
          });
          continue;
        }

        if (condition.mode !== 'equals' && condition.mode !== 'triggered') {
          issues.push({
            severity: 'error',
            message: `State machine '${machineLabel}' condition on '${parameterName}' has unsupported mode '${String(condition.mode)}'.`
          });
        }

        if (parameterType === 'trigger' && condition.mode === 'equals') {
          issues.push({
            severity: 'error',
            message: `State machine '${machineLabel}' trigger parameter '${parameterName}' cannot use equals condition.`
          });
        }

        if (parameterType === 'bool' && condition.mode === 'triggered') {
          issues.push({
            severity: 'error',
            message: `State machine '${machineLabel}' bool parameter '${parameterName}' cannot use triggered condition.`
          });
        }
      }
    }
  }
}

function validateAttachmentTimelines(
  issues: ValidationIssue[],
  animationName: string,
  timelines: Suwol2DAttachmentTimeline[],
  slotNames: Set<string>,
  attachmentsByName: Map<string, Suwol2DAttachment[]>
): void {
  const seenTimelines = new Set<string>();
  for (const timeline of timelines) {
    const label = timeline.slot || '(missing slot)';
    if (!slotNames.has(timeline.slot)) {
      issues.push({
        severity: 'error',
        message: `Animation '${animationName}' attachment timeline references missing slot '${timeline.slot}'.`
      });
    }

    if (seenTimelines.has(timeline.slot)) {
      issues.push({
        severity: 'warning',
        message: `Animation '${animationName}' has duplicate attachment timeline for slot '${timeline.slot}'.`
      });
    }
    seenTimelines.add(timeline.slot);

    const seenTimes = new Set<number>();
    for (const key of timeline.keys ?? []) {
      validateTimelineKeyTime(issues, animationName, `attachment timeline '${label}'`, key.time);
      validateNoDiscreteInterpolation(issues, animationName, `attachment timeline '${label}'`, key);
      const timeKey = normalizeTimeKey(key.time);
      if (seenTimes.has(timeKey)) {
        issues.push({
          severity: 'warning',
          message: `Animation '${animationName}' attachment timeline '${label}' has duplicate key time ${key.time}.`
        });
      }
      seenTimes.add(timeKey);

      const attachmentName = key.attachment?.trim();
      if (!attachmentName) {
        continue;
      }

      const candidates = attachmentsByName.get(attachmentName) ?? [];
      if (candidates.length === 0) {
        issues.push({
          severity: 'warning',
          message: `Animation '${animationName}' attachment timeline '${label}' references missing attachment '${attachmentName}'.`
        });
      } else if (!candidates.some((attachment) => attachment.slot === timeline.slot)) {
        issues.push({
          severity: 'warning',
          message: `Animation '${animationName}' attachment timeline '${label}' targets attachment '${attachmentName}' from another slot.`
        });
      }
    }
  }
}

function validateDrawOrderTimelines(
  issues: ValidationIssue[],
  animationName: string,
  keys: Suwol2DDrawOrderKey[],
  slotNames: Set<string>
): void {
  const seenTimes = new Set<number>();
  for (const key of keys) {
    validateTimelineKeyTime(issues, animationName, 'draw order timeline', key.time);
    validateNoDiscreteInterpolation(issues, animationName, 'draw order timeline', key);
    const timeKey = normalizeTimeKey(key.time);
    if (seenTimes.has(timeKey)) {
      issues.push({
        severity: 'warning',
        message: `Animation '${animationName}' draw order timeline has duplicate key time ${key.time}.`
      });
    }
    seenTimes.add(timeKey);

    const seenSlots = new Set<string>();
    const seenOrders = new Set<number>();
    for (const entry of key.slots ?? []) {
      if (!slotNames.has(entry.slot)) {
        issues.push({
          severity: 'error',
          message: `Animation '${animationName}' draw order key ${key.time} references missing slot '${entry.slot}'.`
        });
      }

      if (seenSlots.has(entry.slot)) {
        issues.push({
          severity: 'error',
          message: `Animation '${animationName}' draw order key ${key.time} repeats slot '${entry.slot}'.`
        });
      }
      seenSlots.add(entry.slot);

      if (!Number.isFinite(entry.drawOrder)) {
        issues.push({
          severity: 'error',
          message: `Animation '${animationName}' draw order key ${key.time} has invalid drawOrder.`
        });
      } else if (seenOrders.has(entry.drawOrder)) {
        issues.push({
          severity: 'warning',
          message: `Animation '${animationName}' draw order key ${key.time} repeats drawOrder ${entry.drawOrder}.`
        });
      }
      seenOrders.add(entry.drawOrder);
    }

    for (const slotName of slotNames) {
      if (!seenSlots.has(slotName)) {
        issues.push({
          severity: 'warning',
          message: `Animation '${animationName}' draw order key ${key.time} omits slot '${slotName}'.`
        });
      }
    }
  }
}

function validateSlotColorTimelines(
  issues: ValidationIssue[],
  animationName: string,
  timelines: Suwol2DSlotTimeline[],
  slotNames: Set<string>
): void {
  const seenTimelines = new Set<string>();
  for (const timeline of timelines) {
    const label = timeline.slot || '(missing slot)';
    if (!slotNames.has(timeline.slot)) {
      issues.push({
        severity: 'error',
        message: `Animation '${animationName}' slot color timeline references missing slot '${timeline.slot}'.`
      });
    }

    if (seenTimelines.has(timeline.slot)) {
      issues.push({
        severity: 'warning',
        message: `Animation '${animationName}' has duplicate slot color timeline for slot '${timeline.slot}'.`
      });
    }
    seenTimelines.add(timeline.slot);

    const seenTimes = new Set<number>();
    for (const key of timeline.color ?? []) {
      validateTimelineKeyTime(issues, animationName, `slot color timeline '${label}'`, key.time);
      validateInterpolation(issues, animationName, `slot color '${label}'`, key.interpolation);
      const timeKey = normalizeTimeKey(key.time);
      if (seenTimes.has(timeKey)) {
        issues.push({
          severity: 'warning',
          message: `Animation '${animationName}' slot color timeline '${label}' has duplicate key time ${key.time}.`
        });
      }
      seenTimes.add(timeKey);

      const values = [key.r, key.g, key.b, key.a];
      if (values.some((value) => !Number.isFinite(value))) {
        issues.push({
          severity: 'error',
          message: `Animation '${animationName}' slot color timeline '${label}' contains NaN or Infinity.`
        });
      } else if (values.some((value) => value < 0 || value > 1)) {
        issues.push({
          severity: 'warning',
          message: `Animation '${animationName}' slot color timeline '${label}' has color outside 0..1 and will be clamped on export.`
        });
      }
    }
  }
}

function validateEventTimeline(issues: ValidationIssue[], animationName: string, events: Suwol2DEventKey[]): void {
  const seen = new Set<string>();
  for (const event of events) {
    validateTimelineKeyTime(issues, animationName, 'event timeline', event.time);
    validateNoDiscreteInterpolation(issues, animationName, 'event timeline', event);

    const name = event.name.trim();
    if (!name) {
      issues.push({
        severity: 'error',
        message: `Animation '${animationName}' has an event with an empty name.`
      });
    }

    const eventKey = `${normalizeTimeKey(event.time)}:${name}`;
    if (seen.has(eventKey)) {
      issues.push({
        severity: 'warning',
        message: `Animation '${animationName}' has duplicate event '${name}' at ${event.time}.`
      });
    }
    seen.add(eventKey);

    if (event.floatValue !== undefined && !Number.isFinite(event.floatValue)) {
      issues.push({
        severity: 'error',
        message: `Animation '${animationName}' event '${name || '(unnamed)'}' has invalid floatValue.`
      });
    }
    if (event.intValue !== undefined && !Number.isFinite(event.intValue)) {
      issues.push({
        severity: 'error',
        message: `Animation '${animationName}' event '${name || '(unnamed)'}' has invalid intValue.`
      });
    }
  }
}

function validateTimelineKeyTime(issues: ValidationIssue[], animationName: string, label: string, time: number): void {
  if (!Number.isFinite(time) || time < 0) {
    issues.push({
      severity: 'error',
      message: `Animation '${animationName}' has invalid key time in ${label}.`
    });
  }
}

function validateInterpolation(
  issues: ValidationIssue[],
  animationName: string,
  label: string,
  interpolation: Suwol2DInterpolation | undefined
): void {
  if (interpolation === undefined) {
    return;
  }

  if (!isSuwol2DInterpolation(interpolation)) {
    issues.push({
      severity: 'error',
      message: `Animation '${animationName}' ${label} key has unsupported interpolation '${String(interpolation)}'.`
    });
  }
}

function validateNoDiscreteInterpolation(
  issues: ValidationIssue[],
  animationName: string,
  label: string,
  key: object
): void {
  const interpolation = (key as { interpolation?: unknown }).interpolation;
  if (interpolation === undefined) {
    return;
  }

  issues.push({
    severity: 'warning',
    message: `Animation '${animationName}' ${label} ignores interpolation on discrete keys.`
  });

  if (!isSuwol2DInterpolation(interpolation)) {
    issues.push({
      severity: 'error',
      message: `Animation '${animationName}' ${label} key has unsupported interpolation '${String(interpolation)}'.`
    });
  }
}

function validateAnimationDuration(issues: ValidationIssue[], animation: Suwol2DDocument['animations'][number]): void {
  if (animation.duration === undefined) {
    return;
  }

  if (!Number.isFinite(animation.duration) || animation.duration < 0) {
    issues.push({
      severity: 'error',
      message: `Animation '${animation.name}' has invalid duration.`
    });
  }
}

function validateKeysWithinExplicitDuration(issues: ValidationIssue[], animation: Suwol2DDocument['animations'][number]): void {
  if (!Number.isFinite(animation.duration) || (animation.duration ?? 0) <= 0) {
    return;
  }

  const duration = animation.duration ?? 0;
  for (const key of collectAnimationKeyTimes(animation)) {
    if (Number.isFinite(key.time) && key.time > duration) {
      issues.push({
        severity: 'warning',
        message: `Animation '${animation.name}' ${key.label} key at ${key.time} is outside explicit duration ${duration}.`
      });
    }
  }
}

function collectAnimationKeyTimes(animation: Suwol2DDocument['animations'][number]): Array<{ label: string; time: number }> {
  const keys: Array<{ label: string; time: number }> = [];
  for (const timeline of animation.bones ?? []) {
    for (const key of timeline.translate ?? []) keys.push({ label: `translate '${timeline.bone}'`, time: key.time });
    for (const key of timeline.rotate ?? []) keys.push({ label: `rotate '${timeline.bone}'`, time: key.time });
    for (const key of timeline.scale ?? []) keys.push({ label: `scale '${timeline.bone}'`, time: key.time });
  }
  for (const timeline of animation.deforms ?? []) {
    for (const key of timeline.keys ?? []) keys.push({ label: `deform '${timeline.slot}/${timeline.attachment}'`, time: key.time });
  }
  for (const timeline of animation.attachments ?? []) {
    for (const key of timeline.keys ?? []) keys.push({ label: `attachment '${timeline.slot}'`, time: key.time });
  }
  for (const key of animation.drawOrders ?? []) {
    keys.push({ label: 'draw order', time: key.time });
  }
  for (const timeline of animation.slots ?? []) {
    for (const key of timeline.color ?? []) keys.push({ label: `slot color '${timeline.slot}'`, time: key.time });
  }
  for (const key of animation.events ?? []) {
    keys.push({ label: `event '${key.name}'`, time: key.time });
  }
  return keys;
}

function getAnimationDurationForValidation(animation: Suwol2DDocument['animations'][number]): number {
  if (Number.isFinite(animation.duration) && (animation.duration ?? 0) > 0) {
    return animation.duration ?? 0;
  }

  let duration = 0;
  for (const timeline of animation.bones ?? []) {
    for (const key of timeline.translate ?? []) duration = Math.max(duration, key.time);
    for (const key of timeline.rotate ?? []) duration = Math.max(duration, key.time);
    for (const key of timeline.scale ?? []) duration = Math.max(duration, key.time);
  }
  for (const timeline of animation.deforms ?? []) {
    for (const key of timeline.keys ?? []) duration = Math.max(duration, key.time);
  }
  for (const timeline of animation.attachments ?? []) {
    for (const key of timeline.keys ?? []) duration = Math.max(duration, key.time);
  }
  for (const key of animation.drawOrders ?? []) {
    duration = Math.max(duration, key.time);
  }
  for (const timeline of animation.slots ?? []) {
    for (const key of timeline.color ?? []) duration = Math.max(duration, key.time);
  }
  for (const key of animation.events ?? []) {
    duration = Math.max(duration, key.time);
  }
  return duration;
}

function normalizeTimeKey(time: number): number {
  return Number.isFinite(time) ? Number(time.toFixed(4)) : time;
}

function validateDeformTimelines(
  issues: ValidationIssue[],
  animationName: string,
  deforms: NonNullable<Suwol2DDocument['animations'][number]['deforms']>,
  slotNames: Set<string>,
  attachmentsByName: Map<string, Suwol2DAttachment[]>
): void {
  const seenTimelines = new Set<string>();
  for (const deform of deforms) {
    const timelineKey = `${deform.slot}/${deform.attachment}`;
    if (seenTimelines.has(timelineKey)) {
      issues.push({
        severity: 'warning',
        message: `Animation '${animationName}' has duplicate deform timeline '${timelineKey}'.`
      });
    }
    seenTimelines.add(timelineKey);

    if (!slotNames.has(deform.slot)) {
      issues.push({
        severity: 'error',
        message: `Animation '${animationName}' deform references missing slot '${deform.slot}'.`
      });
    }

    const candidatesByName = attachmentsByName.get(deform.attachment) ?? [];
    const candidatesForSlot = candidatesByName.filter((attachment) => attachment.slot === deform.slot);
    const attachment = candidatesForSlot.find((candidate) => candidate.type === 'mesh') ?? candidatesForSlot[0];
    if (candidatesByName.length === 0) {
      issues.push({
        severity: 'error',
        message: `Animation '${animationName}' deform references attachment '${deform.attachment}' that is absent in every skin.`
      });
    } else if (candidatesForSlot.length === 0) {
      issues.push({
        severity: 'error',
        message: `Animation '${animationName}' deform target '${deform.attachment}' is not attached to slot '${deform.slot}' in any skin.`
      });
    } else if (!candidatesForSlot.some((candidate) => candidate.type === 'mesh')) {
      issues.push({
        severity: 'error',
        message: `Animation '${animationName}' deform target '${deform.attachment}' is not a mesh attachment.`
      });
    }

    const meshAttachment = attachment?.type === 'mesh' ? attachment : undefined;
    const keys = deform.keys ?? [];
    if (keys.length === 0) {
      issues.push({
        severity: 'warning',
        message: `Animation '${animationName}' deform timeline '${timelineKey}' has no keys.`
      });
    }

    const seenTimes = new Set<number>();
    for (const key of keys) {
      if (!Number.isFinite(key.time) || key.time < 0) {
        issues.push({
          severity: 'error',
          message: `Animation '${animationName}' deform timeline '${timelineKey}' has invalid key time.`
        });
      }
      validateInterpolation(issues, animationName, `deform '${timelineKey}'`, key.interpolation);

      const timeKey = Number.isFinite(key.time) ? Number(key.time.toFixed(4)) : key.time;
      if (seenTimes.has(timeKey)) {
        issues.push({
          severity: 'warning',
          message: `Animation '${animationName}' deform timeline '${timelineKey}' has duplicate key time ${key.time}.`
        });
      }
      seenTimes.add(timeKey);

      const seenVertices = new Set<number>();
      for (const offset of key.offsets ?? []) {
        if (!Number.isInteger(offset.vertex) || offset.vertex < 0 || !meshAttachment || offset.vertex >= meshAttachment.vertices.length) {
          issues.push({
            severity: 'error',
            message: `Animation '${animationName}' deform timeline '${timelineKey}' has vertex offset outside range.`
          });
          continue;
        }

        if (seenVertices.has(offset.vertex)) {
          issues.push({
            severity: 'warning',
            message: `Animation '${animationName}' deform timeline '${timelineKey}' has duplicate offset for vertex ${offset.vertex}.`
          });
        }
        seenVertices.add(offset.vertex);

        validateFiniteTransform(issues, `Deform offset '${animationName}/${timelineKey}[${offset.vertex}]'`, [offset.x, offset.y]);
      }
    }
  }
}

function validateSkins(
  issues: ValidationIssue[],
  document: Suwol2DDocument,
  slotNames: Set<string>,
  boneNames: Set<string>,
  attachmentsByName: Map<string, Suwol2DAttachment[]>
): void {
  const rawSkins = Array.isArray(document.skins) ? document.skins : [];
  if (rawSkins.length === 0) {
    issues.push({ severity: 'error', message: 'Document has no skins.' });
  }

  if (!rawSkins.some((skin) => skin.name === defaultSkinName)) {
    issues.push({ severity: 'error', message: "Document is missing the required 'default' skin." });
  }

  const skinNames = new Set<string>();
  for (const skin of getEffectiveSkins(document)) {
    const skinName = skin.name.trim();
    if (!skinName) {
      issues.push({ severity: 'error', message: 'Skin has an empty name.' });
    } else if (skinNames.has(skinName)) {
      issues.push({ severity: 'error', message: `Duplicate skin name: ${skinName}` });
    }
    skinNames.add(skinName);

    const attachmentNames = new Set<string>();
    for (const attachment of skin.attachments) {
      if (!attachment.name.trim()) {
        issues.push({ severity: 'error', message: `Skin '${skinName || '(unnamed)'}' has an attachment with an empty name.` });
        continue;
      }

      if (attachmentNames.has(attachment.name)) {
        issues.push({
          severity: 'error',
          message: `Skin '${skinName || '(unnamed)'}' has duplicate attachment name: ${attachment.name}`
        });
      }
      attachmentNames.add(attachment.name);

      const existing = attachmentsByName.get(attachment.name) ?? [];
      existing.push(attachment);
      attachmentsByName.set(attachment.name, existing);

      if (!slotNames.has(attachment.slot)) {
        issues.push({
          severity: 'error',
          message: `Skin '${skinName || '(unnamed)'}' attachment '${attachment.name}' references missing slot '${attachment.slot}'.`
        });
      }

      validateAttachmentFields(issues, attachment, boneNames, slotNames, document);
    }
  }
}

function validateSlotAttachmentReferences(
  issues: ValidationIssue[],
  document: Suwol2DDocument,
  attachmentsByName: Map<string, Suwol2DAttachment[]>
): void {
  const defaultSkin = getEffectiveSkins(document).find((skin) => skin.name === defaultSkinName);
  for (const slot of document.slots) {
    if (!slot.attachment) {
      continue;
    }

    const candidates = attachmentsByName.get(slot.attachment) ?? [];
    const existsInAnySkin = candidates.some((attachment) => attachment.slot === slot.name);
    if (!existsInAnySkin) {
      issues.push({
        severity: 'error',
        message: `Slot '${slot.name}' references missing attachment '${slot.attachment}'.`
      });
      continue;
    }

    const existsInDefaultSkin = defaultSkin?.attachments.some((attachment) => (
      attachment.slot === slot.name && attachment.name === slot.attachment
    ));
    if (!existsInDefaultSkin) {
      issues.push({
        severity: 'warning',
        message: `Slot '${slot.name}' default attachment '${slot.attachment}' is missing in the default skin.`
      });
    }
  }
}

function validateIkConstraints(
  issues: ValidationIssue[],
  constraints: Suwol2DIkConstraint[],
  document: Suwol2DDocument,
  boneNames: Set<string>
): void {
  const names = new Set<string>();
  const orders = new Set<number>();
  const bonesByName = new Map(document.bones.map((bone) => [bone.name, bone]));

  for (const constraint of constraints) {
    const label = constraint.name || '(unnamed)';
    if (!constraint.name.trim()) {
      issues.push({ severity: 'error', message: 'IK constraint has an empty name.' });
    } else if (names.has(constraint.name)) {
      issues.push({ severity: 'error', message: `Duplicate IK constraint name: ${constraint.name}` });
    }
    names.add(constraint.name);

    if (!boneNames.has(constraint.parentBone)) {
      issues.push({ severity: 'error', message: `IK constraint '${label}' references missing parent bone '${constraint.parentBone}'.` });
    }

    if (!boneNames.has(constraint.childBone)) {
      issues.push({ severity: 'error', message: `IK constraint '${label}' references missing child bone '${constraint.childBone}'.` });
    }

    if (!boneNames.has(constraint.targetBone)) {
      issues.push({ severity: 'error', message: `IK constraint '${label}' references missing target bone '${constraint.targetBone}'.` });
    }

    if (constraint.parentBone && constraint.parentBone === constraint.childBone) {
      issues.push({ severity: 'error', message: `IK constraint '${label}' uses the same parent and child bone.` });
    }

    if (constraint.targetBone && (constraint.targetBone === constraint.parentBone || constraint.targetBone === constraint.childBone)) {
      issues.push({ severity: 'warning', message: `IK constraint '${label}' target bone should be separate from the IK chain.` });
    }

    const child = bonesByName.get(constraint.childBone);
    if (child && child.parent !== constraint.parentBone) {
      issues.push({ severity: 'warning', message: `IK constraint '${label}' child bone '${constraint.childBone}' is not parented to '${constraint.parentBone}'.` });
    }

    if (!Number.isFinite(constraint.mix)) {
      issues.push({ severity: 'error', message: `IK constraint '${label}' has invalid mix.` });
    } else if (constraint.mix < 0 || constraint.mix > 1) {
      issues.push({ severity: 'warning', message: `IK constraint '${label}' mix is outside 0..1 and will be clamped on export.` });
    }

    if (constraint.bendDirection !== 1 && constraint.bendDirection !== -1) {
      issues.push({ severity: 'error', message: `IK constraint '${label}' bendDirection must be 1 or -1.` });
    }

    if (!Number.isFinite(constraint.order)) {
      issues.push({ severity: 'error', message: `IK constraint '${label}' has invalid order.` });
    } else if (orders.has(constraint.order)) {
      issues.push({ severity: 'warning', message: `IK constraint '${label}' shares order ${constraint.order} with another IK constraint.` });
    }
    orders.add(constraint.order);
  }
}

function validateAttachmentFields(
  issues: ValidationIssue[],
  attachment: Suwol2DAttachment,
  boneNames: Set<string>,
  slotNames: Set<string>,
  document: Suwol2DDocument
): void {
  validateFiniteTransform(issues, `Attachment '${attachment.name}'`, [
    attachment.x,
    attachment.y,
    attachment.rotation,
    attachment.scaleX,
    attachment.scaleY
  ]);

  if (attachment.type === 'region') {
    if (!attachment.image.trim()) {
      issues.push({ severity: 'error', message: `Attachment '${attachment.name}' has no image.` });
    }

    if (attachment.width <= 0 || attachment.height <= 0) {
      issues.push({ severity: 'error', message: `Attachment '${attachment.name}' has non-positive width or height.` });
    }

    validateFiniteTransform(issues, `Attachment '${attachment.name}' region size`, [
      attachment.width,
      attachment.height
    ]);
    return;
  }

  if (attachment.type === 'mesh') {
    if (!attachment.image.trim()) {
      issues.push({ severity: 'error', message: `Attachment '${attachment.name}' has no image.` });
    }

    validateMeshAttachment(issues, attachment, boneNames);
    return;
  }

  if (attachment.type === 'clipping') {
    validateClippingAttachment(issues, attachment, slotNames, document);
  }
}

function validateClippingAttachment(
  issues: ValidationIssue[],
  attachment: Suwol2DClippingAttachment,
  slotNames: Set<string>,
  document: Suwol2DDocument
): void {
  const vertices = attachment.clippingVertices ?? [];
  if (vertices.length < 3) {
    issues.push({ severity: 'error', message: `Clipping attachment '${attachment.name}' needs at least 3 vertices.` });
  }

  for (let index = 0; index < vertices.length; index += 1) {
    const vertex = vertices[index];
    if (!vertex || !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) {
      issues.push({ severity: 'error', message: `Clipping attachment '${attachment.name}' has invalid vertex at index ${index}.` });
    }
  }

  const endSlot = attachment.endSlot?.trim();
  if (endSlot && !slotNames.has(endSlot)) {
    issues.push({ severity: 'error', message: `Clipping attachment '${attachment.name}' references missing endSlot '${endSlot}'.` });
  }

  if (vertices.length >= 3 && vertices.every((vertex) => vertex && Number.isFinite(vertex.x) && Number.isFinite(vertex.y))) {
    const area = signedPolygonArea(vertices);
    if (Math.abs(area) <= 0.000001) {
      issues.push({ severity: 'error', message: `Clipping attachment '${attachment.name}' polygon has zero area.` });
    } else if (!isConvexPolygon(vertices)) {
      issues.push({
        severity: 'warning',
        message: `Clipping attachment '${attachment.name}' polygon is concave and v21 officially supports convex polygons only.`
      });
    }
  }

  if (endSlot && slotNames.has(attachment.slot) && slotNames.has(endSlot)) {
    const startSlot = document.slots.find((slot) => slot.name === attachment.slot);
    const end = document.slots.find((slot) => slot.name === endSlot);
    if (startSlot && end && end.drawOrder < startSlot.drawOrder) {
      issues.push({
        severity: 'warning',
        message: `Clipping attachment '${attachment.name}' endSlot '${endSlot}' is before the clipping slot in draw order.`
      });
    }
  }
}

function validateMeshAttachment(issues: ValidationIssue[], attachment: Suwol2DMeshAttachment, boneNames: Set<string>): void {
  if (!Array.isArray(attachment.vertices) || attachment.vertices.length < 3) {
    issues.push({ severity: 'error', message: `Mesh attachment '${attachment.name}' needs at least 3 vertices.` });
  }

  if (!Array.isArray(attachment.triangles) || attachment.triangles.length === 0) {
    issues.push({ severity: 'error', message: `Mesh attachment '${attachment.name}' needs triangle indices.` });
  } else if (attachment.triangles.length % 3 !== 0) {
    issues.push({ severity: 'error', message: `Mesh attachment '${attachment.name}' triangle index count must be a multiple of 3.` });
  }

  for (let index = 0; index < attachment.vertices.length; index += 1) {
    const vertex = attachment.vertices[index];
    validateFiniteTransform(issues, `Mesh vertex '${attachment.name}[${index}]'`, [
      vertex.x,
      vertex.y,
      vertex.u,
      vertex.v
    ]);
  }

  for (const triangleIndex of attachment.triangles) {
    if (!Number.isInteger(triangleIndex) || triangleIndex < 0 || triangleIndex >= attachment.vertices.length) {
      issues.push({
        severity: 'error',
        message: `Mesh attachment '${attachment.name}' has triangle index outside vertex range.`
      });
      return;
    }
  }

  validateMeshWeights(issues, attachment, boneNames);
}

function validateMeshWeights(issues: ValidationIssue[], attachment: Suwol2DMeshAttachment, boneNames: Set<string>): void {
  const weights = attachment.weights ?? [];
  if (weights.length === 0) {
    return;
  }

  if (weights.length < attachment.vertices.length) {
    issues.push({
      severity: 'warning',
      message: `Mesh attachment '${attachment.name}' has weights for only some vertices; unweighted vertices use their original position.`
    });
  }

  const seenVertices = new Set<number>();
  for (const vertexWeight of weights) {
    if (!Number.isInteger(vertexWeight.vertex) || vertexWeight.vertex < 0 || vertexWeight.vertex >= attachment.vertices.length) {
      issues.push({
        severity: 'error',
        message: `Mesh attachment '${attachment.name}' has weight for vertex outside range.`
      });
      continue;
    }

    if (seenVertices.has(vertexWeight.vertex)) {
      issues.push({
        severity: 'warning',
        message: `Mesh attachment '${attachment.name}' has duplicate weight entries for vertex ${vertexWeight.vertex}.`
      });
    }
    seenVertices.add(vertexWeight.vertex);

    const seenBones = new Set<string>();
    let sum = 0;
    const vertexBones = vertexWeight.bones ?? [];
    for (const boneWeight of vertexBones) {
      if (!boneWeight.bone.trim()) {
        issues.push({
          severity: 'error',
          message: `Mesh attachment '${attachment.name}' has a weight with empty bone name.`
        });
      } else if (!boneNames.has(boneWeight.bone)) {
        issues.push({
          severity: 'error',
          message: `Mesh attachment '${attachment.name}' references missing weight bone '${boneWeight.bone}'.`
        });
      }

      if (seenBones.has(boneWeight.bone)) {
        issues.push({
          severity: 'warning',
          message: `Mesh attachment '${attachment.name}' has duplicate bone weight '${boneWeight.bone}' on vertex ${vertexWeight.vertex}.`
        });
      }
      seenBones.add(boneWeight.bone);

      if (!Number.isFinite(boneWeight.weight)) {
        issues.push({
          severity: 'error',
          message: `Mesh attachment '${attachment.name}' has NaN or Infinity weight.`
        });
      } else if (boneWeight.weight < 0) {
        issues.push({
          severity: 'error',
          message: `Mesh attachment '${attachment.name}' has negative weight.`
        });
      } else {
        sum += boneWeight.weight;
      }
    }

    if (vertexBones.length > 0 && Math.abs(sum - 1) > 0.001) {
      issues.push({
        severity: 'warning',
        message: `Mesh attachment '${attachment.name}' vertex ${vertexWeight.vertex} weights sum to ${sum.toFixed(3)}.`
      });
    }
  }
}

function signedPolygonArea(vertices: Array<{ x: number; y: number }>): number {
  let area = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    area += current.x * next.y - next.x * current.y;
  }

  return area * 0.5;
}

function isConvexPolygon(vertices: Array<{ x: number; y: number }>): boolean {
  if (vertices.length < 4) {
    return true;
  }

  let sign = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const a = vertices[index];
    const b = vertices[(index + 1) % vertices.length];
    const c = vertices[(index + 2) % vertices.length];
    const cross = ((b.x - a.x) * (c.y - b.y)) - ((b.y - a.y) * (c.x - b.x));
    if (Math.abs(cross) <= 0.000001) {
      continue;
    }

    const currentSign = Math.sign(cross);
    if (sign === 0) {
      sign = currentSign;
    } else if (sign !== currentSign) {
      return false;
    }
  }

  return true;
}

function validateBoneHierarchy(issues: ValidationIssue[], document: Suwol2DDocument): void {
  const bonesByName = new Map(document.bones.map((bone) => [bone.name, bone]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (boneName: string): void => {
    if (!boneName || visited.has(boneName)) {
      return;
    }

    if (visiting.has(boneName)) {
      issues.push({ severity: 'error', message: `Bone hierarchy contains a cycle at '${boneName}'.` });
      return;
    }

    const bone = bonesByName.get(boneName);
    if (!bone) {
      return;
    }

    visiting.add(boneName);
    visit(bone.parent);
    visiting.delete(boneName);
    visited.add(boneName);
  };

  for (const bone of document.bones) {
    visit(bone.name);
  }
}

function validateKeyTime(issues: ValidationIssue[], animationName: string, boneName: string, time: number): void {
  if (!Number.isFinite(time) || time < 0) {
    issues.push({
      severity: 'error',
      message: `Animation '${animationName}' has invalid key time on bone '${boneName}'.`
    });
  }
}

function validateFiniteTransform(issues: ValidationIssue[], label: string, values: number[]): void {
  for (const value of values) {
    if (!Number.isFinite(value)) {
      issues.push({ severity: 'error', message: `${label} contains NaN or Infinity.` });
      return;
    }
  }
}

function isUnitRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
