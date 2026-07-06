export type Suwol2DAttachmentType = 'region' | 'mesh' | 'clipping';
export type Suwol2DStateParameterType = 'bool' | 'trigger';
export type Suwol2DInterpolation = 'stepped' | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface Suwol2DDocument {
  version: 0;
  name: string;
  bones: Suwol2DBone[];
  slots: Suwol2DSlot[];
  skins: Suwol2DSkin[];
  attachments: Suwol2DAttachment[];
  animations: Suwol2DAnimation[];
  atlases?: Suwol2DAtlas[];
  ikConstraints?: Suwol2DIkConstraint[];
  stateMachines?: Suwol2DStateMachine[];
}

export interface Suwol2DAtlas {
  name: string;
  image: string;
  width: number;
  height: number;
  regions: Suwol2DAtlasRegion[];
}

export interface Suwol2DAtlasRegion {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  u: number;
  v: number;
  u2: number;
  v2: number;
}

export interface Suwol2DAtlasExportOptions {
  createAtlas: boolean;
  atlasName: string;
  atlasMaxSize: number;
  atlasPadding: number;
}

export interface Suwol2DBone {
  name: string;
  parent: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  length?: number;
}

export interface Suwol2DIkConstraint {
  name: string;
  parentBone: string;
  childBone: string;
  targetBone: string;
  enabled: boolean;
  mix: number;
  bendDirection: 1 | -1;
  order: number;
}

export interface Suwol2DSlot {
  name: string;
  bone: string;
  attachment: string;
  drawOrder: number;
}

export interface Suwol2DSkin {
  name: string;
  attachments: Suwol2DAttachment[];
}

export type Suwol2DAttachment = Suwol2DRegionAttachment | Suwol2DMeshAttachment | Suwol2DClippingAttachment;

export interface Suwol2DBaseAttachment {
  name: string;
  slot: string;
  type: Suwol2DAttachmentType;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface Suwol2DRegionAttachment extends Suwol2DBaseAttachment {
  type: 'region';
  image: string;
  width: number;
  height: number;
}

export interface Suwol2DMeshAttachment extends Suwol2DBaseAttachment {
  type: 'mesh';
  image: string;
  vertices: Suwol2DMeshVertex[];
  triangles: number[];
  weights?: Suwol2DVertexWeight[];
}

export interface Suwol2DClippingAttachment extends Suwol2DBaseAttachment {
  type: 'clipping';
  endSlot?: string | null;
  clippingVertices: Suwol2DClippingVertex[];
}

export interface Suwol2DClippingVertex {
  x: number;
  y: number;
}

export interface Suwol2DMeshVertex {
  x: number;
  y: number;
  u: number;
  v: number;
}

export interface Suwol2DBoneWeight {
  bone: string;
  weight: number;
}

export interface Suwol2DVertexWeight {
  vertex: number;
  bones: Suwol2DBoneWeight[];
}

export interface Suwol2DAnimation {
  name: string;
  loop: boolean;
  duration?: number;
  bones: Suwol2DBoneTimeline[];
  deforms?: Suwol2DDeformTimeline[];
  attachments?: Suwol2DAttachmentTimeline[];
  drawOrders?: Suwol2DDrawOrderKey[];
  slots?: Suwol2DSlotTimeline[];
  events?: Suwol2DEventKey[];
}

export interface Suwol2DBoneTimeline {
  bone: string;
  translate: Suwol2DTranslateKey[];
  rotate: Suwol2DRotateKey[];
  scale: Suwol2DScaleKey[];
}

export interface Suwol2DTranslateKey {
  time: number;
  x: number;
  y: number;
  interpolation?: Suwol2DInterpolation;
}

export interface Suwol2DRotateKey {
  time: number;
  rotation: number;
  interpolation?: Suwol2DInterpolation;
}

export interface Suwol2DScaleKey {
  time: number;
  scaleX: number;
  scaleY: number;
  interpolation?: Suwol2DInterpolation;
}

export interface Suwol2DVertexOffset {
  vertex: number;
  x: number;
  y: number;
}

export interface Suwol2DDeformKey {
  time: number;
  offsets: Suwol2DVertexOffset[];
  interpolation?: Suwol2DInterpolation;
}

export interface Suwol2DDeformTimeline {
  slot: string;
  attachment: string;
  keys: Suwol2DDeformKey[];
}

export interface Suwol2DAttachmentTimeline {
  slot: string;
  keys: Suwol2DAttachmentKey[];
}

export interface Suwol2DAttachmentKey {
  time: number;
  attachment: string | null;
}

export interface Suwol2DDrawOrderKey {
  time: number;
  slots: Suwol2DDrawOrderSlot[];
}

export interface Suwol2DDrawOrderSlot {
  slot: string;
  drawOrder: number;
}

export interface Suwol2DSlotTimeline {
  slot: string;
  color?: Suwol2DSlotColorKey[];
}

export interface Suwol2DSlotColorKey {
  time: number;
  r: number;
  g: number;
  b: number;
  a: number;
  interpolation?: Suwol2DInterpolation;
}

export interface Suwol2DEventKey {
  time: number;
  name: string;
  intValue?: number;
  floatValue?: number;
  stringValue?: string;
}

export interface Suwol2DStateMachine {
  name: string;
  initialState: string;
  states: Suwol2DState[];
  parameters: Suwol2DStateParameter[];
  transitions: Suwol2DStateTransition[];
}

export interface Suwol2DState {
  name: string;
  animation: string;
  loop: boolean;
  speed: number;
}

export interface Suwol2DStateParameter {
  name: string;
  type: Suwol2DStateParameterType;
  defaultBool?: boolean;
}

export interface Suwol2DStateTransition {
  from: string;
  to: string;
  fadeDuration: number;
  conditions: Suwol2DTransitionCondition[];
}

export interface Suwol2DTransitionCondition {
  parameter: string;
  mode: 'equals' | 'triggered';
  boolValue?: boolean;
}

export interface ImportedImage {
  id: string;
  name: string;
  fileName: string;
  relativePath: string;
  width: number;
  height: number;
  mimeType: string;
  dataUrl?: string;
}

export interface Suwol2DProjectFile {
  editorVersion: 0;
  document: Suwol2DDocument;
  importedImages: ImportedImage[];
  lastExportPath: string;
}

export interface HydratedProjectResult {
  projectFilePath: string;
  projectPath: string;
  project: Suwol2DProjectFile;
}

export function createEmptyDocument(name: string): Suwol2DDocument {
  return {
    version: 0,
    name,
    bones: [
      {
        name: 'root',
        parent: '',
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1
      }
    ],
    slots: [],
    skins: [{ name: 'default', attachments: [] }],
    attachments: [],
    animations: []
  };
}

export function createEmptyProject(name: string): Suwol2DProjectFile {
  return {
    editorVersion: 0,
    document: createEmptyDocument(name),
    importedImages: [],
    lastExportPath: ''
  };
}
