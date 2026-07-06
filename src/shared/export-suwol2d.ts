import type {
  Suwol2DAnimation,
  Suwol2DAtlas,
  Suwol2DAtlasRegion,
  Suwol2DAttachmentKey,
  Suwol2DAttachmentTimeline,
  Suwol2DAttachment,
  Suwol2DBone,
  Suwol2DBoneTimeline,
  Suwol2DDocument,
  Suwol2DBoneWeight,
  Suwol2DDeformKey,
  Suwol2DDeformTimeline,
  Suwol2DDrawOrderKey,
  Suwol2DEventKey,
  Suwol2DMeshAttachment,
  Suwol2DMeshVertex,
  Suwol2DRegionAttachment,
  Suwol2DScaleKey,
  Suwol2DIkConstraint,
  Suwol2DSkin,
  Suwol2DSlotColorKey,
  Suwol2DState,
  Suwol2DStateMachine,
  Suwol2DStateParameter,
  Suwol2DStateTransition,
  Suwol2DSlotTimeline,
  Suwol2DSlot,
  Suwol2DTransitionCondition,
  Suwol2DTranslateKey,
  Suwol2DVertexOffset,
  Suwol2DVertexWeight,
  Suwol2DRotateKey
} from './suwol2d-format';
import { collectUniqueAttachmentsByName, defaultSkinName, getEffectiveSkins } from './skins.ts';
import { normalizeInterpolation } from './interpolation.ts';

export function createUnityRuntimeExport(document: Suwol2DDocument): Suwol2DDocument {
  const skins = cleanSkins(document);
  const attachments = collectExportAttachments(skins, document.attachments);
  const slots = [...document.slots]
    .sort((a, b) => getDrawOrder(a) - getDrawOrder(b))
    .map(cleanSlot)
    .map((slot, index) => ({ ...slot, drawOrder: index }));
  const ikConstraints = cleanIkConstraints(document.ikConstraints ?? []);
  const stateMachines = cleanStateMachines(document.stateMachines ?? [], document);
  const atlases = cleanAtlases(document.atlases ?? []);
  const includeBoneLengths = ikConstraints.length > 0;

  return {
    version: 0,
    name: document.name.trim() || 'character',
    bones: sortBonesParentFirst(document.bones).map((bone) => cleanBone(bone, document, includeBoneLengths)),
    slots,
    skins,
    attachments,
    animations: document.animations.map(cleanAnimation),
    ...(atlases.length > 0 ? { atlases } : {}),
    ...(ikConstraints.length > 0 ? { ikConstraints } : {}),
    ...(stateMachines.length > 0 ? { stateMachines } : {})
  };
}

function cleanAtlases(atlases: Suwol2DAtlas[]): Suwol2DAtlas[] {
  return atlases
    .map((atlas): Suwol2DAtlas => ({
      name: atlas.name.trim(),
      image: normalizeAtlasImagePath(atlas.image),
      width: safeInteger(atlas.width, 0),
      height: safeInteger(atlas.height, 0),
      regions: (atlas.regions ?? []).map(cleanAtlasRegion).sort((a, b) => a.name.localeCompare(b.name))
    }))
    .filter((atlas) => atlas.name && atlas.image && atlas.width > 0 && atlas.height > 0 && atlas.regions.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function cleanAtlasRegion(region: Suwol2DAtlasRegion): Suwol2DAtlasRegion {
  return {
    name: normalizeImageReference(region.name),
    x: safeInteger(region.x, 0),
    y: safeInteger(region.y, 0),
    width: safeInteger(region.width, 0),
    height: safeInteger(region.height, 0),
    u: clamp01(safeNumber(region.u, 0)),
    v: clamp01(safeNumber(region.v, 0)),
    u2: clamp01(safeNumber(region.u2, 0)),
    v2: clamp01(safeNumber(region.v2, 0))
  };
}

function cleanBone(bone: Suwol2DBone, document: Suwol2DDocument | undefined, includeLength: boolean): Suwol2DBone {
  return {
    name: bone.name.trim(),
    parent: bone.parent || '',
    x: safeNumber(bone.x, 0),
    y: safeNumber(bone.y, 0),
    rotation: safeNumber(bone.rotation, 0),
    scaleX: safeNumber(bone.scaleX, 1),
    scaleY: safeNumber(bone.scaleY, 1),
    ...(includeLength || bone.length !== undefined ? { length: safeNumber(resolveBoneLength(bone, document), 50) } : {})
  };
}

function cleanSlot(slot: Suwol2DSlot): Suwol2DSlot {
  return {
    name: slot.name.trim(),
    bone: slot.bone,
    attachment: slot.attachment,
    drawOrder: safeNumber(slot.drawOrder, 0)
  };
}

function cleanAttachment(attachment: Suwol2DAttachment): Suwol2DAttachment {
  if (attachment.type === 'mesh') {
    return cleanMeshAttachment(attachment);
  }

  return cleanRegionAttachment(attachment);
}

function cleanSkins(document: Suwol2DDocument): Suwol2DSkin[] {
  const skins = getEffectiveSkins(document)
    .map((skin) => ({
      name: skin.name.trim(),
      attachments: skin.attachments
        .filter((attachment) => attachment.type === 'region' || attachment.type === 'mesh')
        .map(cleanAttachment)
        .sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name))
    }))
    .filter((skin) => skin.name);

  if (!skins.some((skin) => skin.name === defaultSkinName)) {
    skins.unshift({
      name: defaultSkinName,
      attachments: document.attachments
        .filter((attachment) => attachment.type === 'region' || attachment.type === 'mesh')
        .map(cleanAttachment)
        .sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name))
    });
  }

  return skins.sort((a, b) => {
    if (a.name === defaultSkinName) return -1;
    if (b.name === defaultSkinName) return 1;
    return a.name.localeCompare(b.name);
  });
}

function collectExportAttachments(skins: Suwol2DSkin[], legacyAttachments: Suwol2DAttachment[]): Suwol2DAttachment[] {
  const output: Suwol2DAttachment[] = [];
  const seen = new Set<string>();
  const addAttachment = (attachment: Suwol2DAttachment) => {
    if (!attachment.name || seen.has(attachment.name)) {
      return;
    }

    seen.add(attachment.name);
    output.push(attachment);
  };

  for (const skin of skins) {
    for (const attachment of skin.attachments) {
      addAttachment(attachment);
    }
  }

  for (const attachment of legacyAttachments) {
    if (attachment.type === 'region' || attachment.type === 'mesh') {
      addAttachment(cleanAttachment(attachment));
    }
  }

  return output;
}

function cleanRegionAttachment(attachment: Suwol2DRegionAttachment): Suwol2DRegionAttachment {
  return {
    name: attachment.name.trim(),
    slot: attachment.slot,
    type: 'region',
    image: normalizeImageReference(attachment.image),
    x: safeNumber(attachment.x, 0),
    y: safeNumber(attachment.y, 0),
    rotation: safeNumber(attachment.rotation, 0),
    width: safeNumber(attachment.width, 1),
    height: safeNumber(attachment.height, 1),
    scaleX: safeNumber(attachment.scaleX, 1),
    scaleY: safeNumber(attachment.scaleY, 1)
  };
}

function cleanMeshAttachment(attachment: Suwol2DMeshAttachment): Suwol2DMeshAttachment {
  const weights = cleanVertexWeights(attachment.weights ?? []);
  return {
    name: attachment.name.trim(),
    slot: attachment.slot,
    type: 'mesh',
    image: normalizeImageReference(attachment.image),
    x: safeNumber(attachment.x, 0),
    y: safeNumber(attachment.y, 0),
    rotation: safeNumber(attachment.rotation, 0),
    scaleX: safeNumber(attachment.scaleX, 1),
    scaleY: safeNumber(attachment.scaleY, 1),
    vertices: attachment.vertices.map(cleanMeshVertex),
    triangles: attachment.triangles.map((index) => safeInteger(index, 0)),
    ...(weights.length > 0 ? { weights } : {})
  };
}

function cleanMeshVertex(vertex: Suwol2DMeshVertex): Suwol2DMeshVertex {
  return {
    x: safeNumber(vertex.x, 0),
    y: safeNumber(vertex.y, 0),
    u: safeNumber(vertex.u, 0),
    v: safeNumber(vertex.v, 0)
  };
}

function cleanAnimation(animation: Suwol2DAnimation): Suwol2DAnimation {
  const deforms = cleanDeformTimelines(animation.deforms ?? []);
  const attachments = cleanAttachmentTimelines(animation.attachments ?? []);
  const drawOrders = cleanDrawOrderKeys(animation.drawOrders ?? []);
  const slots = cleanSlotTimelines(animation.slots ?? []);
  const events = cleanEventKeys(animation.events ?? []);
  const duration = safeNumber(animation.duration ?? 0, 0);
  return {
    name: animation.name.trim(),
    loop: animation.loop,
    ...(duration > 0 ? { duration } : {}),
    bones: animation.bones.map(cleanTimeline),
    ...(deforms.length > 0 ? { deforms } : {}),
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(drawOrders.length > 0 ? { drawOrders } : {}),
    ...(slots.length > 0 ? { slots } : {}),
    ...(events.length > 0 ? { events } : {})
  };
}

function cleanIkConstraints(constraints: Suwol2DIkConstraint[]): Suwol2DIkConstraint[] {
  return constraints
    .map((constraint): Suwol2DIkConstraint => {
      const bendDirection: 1 | -1 = constraint.bendDirection === -1 ? -1 : 1;
      return {
        name: constraint.name.trim(),
        parentBone: constraint.parentBone,
        childBone: constraint.childBone,
        targetBone: constraint.targetBone,
        enabled: constraint.enabled !== false,
        mix: clamp01(safeNumber(constraint.mix, 1)),
        bendDirection,
        order: safeInteger(constraint.order, 0)
      };
    })
    .filter((constraint) => constraint.name && constraint.parentBone && constraint.childBone && constraint.targetBone)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function cleanStateMachines(stateMachines: Suwol2DStateMachine[], document: Suwol2DDocument): Suwol2DStateMachine[] {
  const animationNames = new Set(document.animations.map((animation) => animation.name.trim()).filter(Boolean));
  return stateMachines
    .map((machine): Suwol2DStateMachine => {
      const states = cleanStates(machine.states ?? [], animationNames);
      const stateNames = new Set(states.map((state) => state.name));
      const parameters = cleanStateParameters(machine.parameters ?? []);
      const parameterNames = new Set(parameters.map((parameter) => parameter.name));
      const transitions = cleanStateTransitions(machine.transitions ?? [], stateNames, parameterNames, parameters);
      const initialState = machine.initialState.trim();
      return {
        name: machine.name.trim(),
        initialState: stateNames.has(initialState) ? initialState : states[0]?.name ?? '',
        states,
        parameters,
        transitions
      };
    })
    .filter((machine) => machine.name && machine.initialState && machine.states.length > 0);
}

function cleanStates(states: Suwol2DState[], animationNames: Set<string>): Suwol2DState[] {
  const seen = new Set<string>();
  return states
    .map((state): Suwol2DState => ({
      name: state.name.trim(),
      animation: state.animation.trim(),
      loop: state.loop !== false,
      speed: Math.max(0, safeNumber(state.speed, 1))
    }))
    .filter((state) => {
      if (!state.name || seen.has(state.name) || !animationNames.has(state.animation)) {
        return false;
      }
      seen.add(state.name);
      return true;
    });
}

function cleanStateParameters(parameters: Suwol2DStateParameter[]): Suwol2DStateParameter[] {
  const seen = new Set<string>();
  return parameters
    .map((parameter): Suwol2DStateParameter => {
      const type = parameter.type === 'trigger' ? 'trigger' : 'bool';
      return {
        name: parameter.name.trim(),
        type,
        ...(type === 'bool' ? { defaultBool: parameter.defaultBool === true } : {})
      };
    })
    .filter((parameter) => {
      if (!parameter.name || seen.has(parameter.name)) {
        return false;
      }
      seen.add(parameter.name);
      return true;
    });
}

function cleanStateTransitions(
  transitions: Suwol2DStateTransition[],
  stateNames: Set<string>,
  parameterNames: Set<string>,
  parameters: Suwol2DStateParameter[]
): Suwol2DStateTransition[] {
  const parameterTypeByName = new Map(parameters.map((parameter) => [parameter.name, parameter.type]));
  return transitions
    .map((transition): Suwol2DStateTransition => ({
      from: transition.from.trim() || '*',
      to: transition.to.trim(),
      fadeDuration: Math.max(0, safeNumber(transition.fadeDuration, 0)),
      conditions: cleanTransitionConditions(transition.conditions ?? [], parameterNames, parameterTypeByName)
    }))
    .filter((transition) => (
      (transition.from === '*' || stateNames.has(transition.from)) &&
      stateNames.has(transition.to)
    ));
}

function cleanTransitionConditions(
  conditions: Suwol2DTransitionCondition[],
  parameterNames: Set<string>,
  parameterTypeByName: Map<string, 'bool' | 'trigger'>
): Suwol2DTransitionCondition[] {
  return conditions
    .map((condition): Suwol2DTransitionCondition => {
      const parameter = condition.parameter.trim();
      const parameterType = parameterTypeByName.get(parameter);
      const mode = parameterType === 'trigger' ? 'triggered' : 'equals';
      return {
        parameter,
        mode,
        ...(mode === 'equals' ? { boolValue: condition.boolValue === true } : {})
      };
    })
    .filter((condition) => parameterNames.has(condition.parameter));
}

function cleanTimeline(timeline: Suwol2DBoneTimeline): Suwol2DBoneTimeline {
  return {
    bone: timeline.bone,
    translate: [...timeline.translate].map(cleanTranslateKey).sort(sortByTime),
    rotate: [...timeline.rotate].map(cleanRotateKey).sort(sortByTime),
    scale: [...timeline.scale].map(cleanScaleKey).sort(sortByTime)
  };
}

function cleanTranslateKey(key: Suwol2DTranslateKey): Suwol2DTranslateKey {
  return {
    time: safeNumber(key.time, 0),
    x: safeNumber(key.x, 0),
    y: safeNumber(key.y, 0),
    interpolation: normalizeInterpolation(key.interpolation)
  };
}

function cleanRotateKey(key: Suwol2DRotateKey): Suwol2DRotateKey {
  return {
    time: safeNumber(key.time, 0),
    rotation: safeNumber(key.rotation, 0),
    interpolation: normalizeInterpolation(key.interpolation)
  };
}

function cleanScaleKey(key: Suwol2DScaleKey): Suwol2DScaleKey {
  return {
    time: safeNumber(key.time, 0),
    scaleX: safeNumber(key.scaleX, 1),
    scaleY: safeNumber(key.scaleY, 1),
    interpolation: normalizeInterpolation(key.interpolation)
  };
}

function cleanDeformTimelines(timelines: Suwol2DDeformTimeline[]): Suwol2DDeformTimeline[] {
  return timelines
    .map((timeline) => ({
      slot: timeline.slot,
      attachment: timeline.attachment,
      keys: cleanDeformKeys(timeline.keys ?? [])
    }))
    .filter((timeline) => timeline.slot && timeline.attachment && timeline.keys.length > 0)
    .sort((a, b) => a.slot.localeCompare(b.slot) || a.attachment.localeCompare(b.attachment));
}

function cleanDeformKeys(keys: Suwol2DDeformKey[]): Suwol2DDeformKey[] {
  return keys
    .map((key) => ({
      time: safeNumber(key.time, 0),
      offsets: cleanVertexOffsets(key.offsets ?? []),
      interpolation: normalizeInterpolation(key.interpolation)
    }))
    .sort(sortByTime);
}

function cleanVertexOffsets(offsets: Suwol2DVertexOffset[]): Suwol2DVertexOffset[] {
  return offsets
    .map((offset) => ({
      vertex: safeInteger(offset.vertex, 0),
      x: safeNumber(offset.x, 0),
      y: safeNumber(offset.y, 0)
    }))
    .sort((a, b) => a.vertex - b.vertex);
}

function cleanAttachmentTimelines(timelines: Suwol2DAttachmentTimeline[]): Suwol2DAttachmentTimeline[] {
  return timelines
    .map((timeline) => ({
      slot: timeline.slot,
      keys: cleanAttachmentKeys(timeline.keys ?? [])
    }))
    .filter((timeline) => timeline.slot && timeline.keys.length > 0)
    .sort((a, b) => a.slot.localeCompare(b.slot));
}

function cleanAttachmentKeys(keys: Suwol2DAttachmentKey[]): Suwol2DAttachmentKey[] {
  return keys
    .map((key) => ({
      time: safeNumber(key.time, 0),
      attachment: key.attachment === null ? null : (key.attachment?.trim() || null)
    }))
    .sort(sortByTime);
}

function cleanDrawOrderKeys(keys: Suwol2DDrawOrderKey[]): Suwol2DDrawOrderKey[] {
  return keys
    .map((key) => ({
      time: safeNumber(key.time, 0),
      slots: (key.slots ?? [])
        .map((slot) => ({
          slot: slot.slot,
          drawOrder: safeInteger(slot.drawOrder, 0)
        }))
        .filter((slot) => slot.slot)
        .sort((a, b) => a.drawOrder - b.drawOrder || a.slot.localeCompare(b.slot))
    }))
    .filter((key) => key.slots.length > 0)
    .sort(sortByTime);
}

function cleanSlotTimelines(timelines: Suwol2DSlotTimeline[]): Suwol2DSlotTimeline[] {
  return timelines
    .map((timeline) => ({
      slot: timeline.slot,
      color: cleanSlotColorKeys(timeline.color ?? [])
    }))
    .filter((timeline) => timeline.slot && timeline.color.length > 0)
    .sort((a, b) => a.slot.localeCompare(b.slot));
}

function cleanSlotColorKeys(keys: Suwol2DSlotColorKey[]): Suwol2DSlotColorKey[] {
  return keys
    .map((key) => ({
      time: safeNumber(key.time, 0),
      r: clamp01(safeNumber(key.r, 1)),
      g: clamp01(safeNumber(key.g, 1)),
      b: clamp01(safeNumber(key.b, 1)),
      a: clamp01(safeNumber(key.a, 1)),
      interpolation: normalizeInterpolation(key.interpolation)
    }))
    .sort(sortByTime);
}

function cleanEventKeys(keys: Suwol2DEventKey[]): Suwol2DEventKey[] {
  return keys
    .map((key) => ({
      time: safeNumber(key.time, 0),
      name: key.name.trim(),
      intValue: safeInteger(key.intValue ?? 0, 0),
      floatValue: safeNumber(key.floatValue ?? 0, 0),
      stringValue: key.stringValue ?? ''
    }))
    .filter((key) => key.name)
    .sort(sortByTime);
}

function safeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : fallback;
}

function safeInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function resolveBoneLength(bone: Suwol2DBone, document: Suwol2DDocument | undefined): number {
  if (Number.isFinite(bone.length) && (bone.length ?? 0) > 0) {
    return bone.length ?? 50;
  }

  if (!document) {
    return 50;
  }

  const child = document.bones.find((candidate) => candidate.parent === bone.name);
  if (child) {
    const distance = Math.hypot(child.x, child.y);
    if (distance > 0) {
      return distance;
    }
  }

  const slotNames = new Set(document.slots.filter((slot) => slot.bone === bone.name).map((slot) => slot.name));
  for (const attachment of collectUniqueAttachmentsByName(document)) {
    if (!slotNames.has(attachment.slot)) {
      continue;
    }

    if (attachment.type === 'region') {
      const length = Math.max(attachment.width, attachment.height);
      if (length > 0) {
        return length;
      }
    } else if (attachment.vertices.length > 0) {
      let minX = attachment.vertices[0].x;
      let maxX = attachment.vertices[0].x;
      let minY = attachment.vertices[0].y;
      let maxY = attachment.vertices[0].y;
      for (const vertex of attachment.vertices) {
        minX = Math.min(minX, vertex.x);
        maxX = Math.max(maxX, vertex.x);
        minY = Math.min(minY, vertex.y);
        maxY = Math.max(maxY, vertex.y);
      }
      const length = Math.max(maxX - minX, maxY - minY);
      if (length > 0) {
        return length;
      }
    }
  }

  return 50;
}

function cleanVertexWeights(weights: Suwol2DVertexWeight[]): Suwol2DVertexWeight[] {
  return weights
    .map((weight) => ({
      vertex: safeInteger(weight.vertex, 0),
      bones: cleanBoneWeights(weight.bones ?? [])
    }))
    .filter((weight) => weight.bones.length > 0)
    .sort((a, b) => a.vertex - b.vertex);
}

function cleanBoneWeights(weights: Suwol2DBoneWeight[]): Suwol2DBoneWeight[] {
  return weights
    .map((weight) => ({
      bone: weight.bone.trim(),
      weight: safeNumber(weight.weight, 0)
    }))
    .filter((weight) => weight.bone && weight.weight > 0)
    .sort((a, b) => a.bone.localeCompare(b.bone));
}

function sortBonesParentFirst(bones: Suwol2DBone[]): Suwol2DBone[] {
  const byName = new Map<string, Suwol2DBone>();
  for (const bone of bones) {
    if (bone.name && !byName.has(bone.name)) {
      byName.set(bone.name, bone);
    }
  }

  const output: Suwol2DBone[] = [];
  const emitted = new Set<Suwol2DBone>();
  const visiting = new Set<string>();

  const visit = (bone: Suwol2DBone) => {
    if (emitted.has(bone)) {
      return;
    }

    if (bone.parent) {
      if (!visiting.has(bone.name)) {
        visiting.add(bone.name);
        const parent = byName.get(bone.parent);
        if (parent && parent !== bone) {
          visit(parent);
        }
        visiting.delete(bone.name);
      }
    }

    if (!emitted.has(bone)) {
      emitted.add(bone);
      output.push(bone);
    }
  };

  for (const bone of bones) {
    visit(bone);
  }

  return output;
}

function getDrawOrder(slot: Suwol2DSlot): number {
  return Number.isFinite(slot.drawOrder) ? slot.drawOrder : 0;
}

function normalizeImageReference(value: string): string {
  const fileName = value.trim().replace(/\\/g, '/').split('/').pop() ?? value.trim();
  return fileName.replace(/\.[^.]+$/, '');
}

function normalizeAtlasImagePath(value: string): string {
  const portable = value.trim().replace(/\\/g, '/');
  return portable.replace(/^\/+/, '');
}

function sortByTime(a: { time: number }, b: { time: number }): number {
  return a.time - b.time;
}
