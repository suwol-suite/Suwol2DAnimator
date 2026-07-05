import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, PointerEvent as ReactPointerEvent, ReactNode, SetStateAction, WheelEvent as ReactWheelEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bone,
  Box,
  Download,
  FilePlus2,
  FolderOpen,
  ImagePlus,
  Info,
  Layers3,
  Maximize2,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Undo2
} from 'lucide-react';
import type {
  HydratedProjectResult,
  ImportedImage,
  Suwol2DAnimation,
  Suwol2DAttachmentKey,
  Suwol2DAttachmentTimeline,
  Suwol2DAttachment,
  Suwol2DBoneWeight,
  Suwol2DBone,
  Suwol2DBoneTimeline,
  Suwol2DDeformKey,
  Suwol2DDeformTimeline,
  Suwol2DDocument,
  Suwol2DDrawOrderKey,
  Suwol2DEventKey,
  Suwol2DIkConstraint,
  Suwol2DMeshAttachment,
  Suwol2DMeshVertex,
  Suwol2DProjectFile,
  Suwol2DRegionAttachment,
  Suwol2DRotateKey,
  Suwol2DScaleKey,
  Suwol2DSlotColorKey,
  Suwol2DStateMachine,
  Suwol2DSlotTimeline,
  Suwol2DSlot,
  Suwol2DTranslateKey,
  Suwol2DTransitionCondition,
  Suwol2DVertexOffset
} from '../../shared/suwol2d-format';
import { createEmptyDocument } from '../../shared/suwol2d-format';
import { uniqueName } from '../../shared/ids';
import { validateDocument } from '../../shared/validation';
import type { ValidationIssue } from '../../shared/validation';
import { createUnityRuntimeExport } from '../../shared/export-suwol2d';
import { suwolReleaseInfo } from '../../shared/release-info';
import type { LocaleCode, TranslationKey, TranslationParams } from '../../shared/i18n/types';
import {
  attachmentExistsInAnySkin,
  cloneAttachment,
  collectSkinAttachments,
  defaultSkinName,
  ensureDefaultSkin,
  getActiveSkin,
  getAttachmentsForSlot,
  getDefaultSkin,
  getEffectiveSkins,
  resolveSlotAttachment,
  syncTopLevelAttachmentsFromSkins
} from '../../shared/skins.ts';
import {
  collectEventsBetween,
  getAnimationDuration,
  rotatePoint,
  sampleAttachmentOverrides,
  sampleDeformOffsets,
  sampleDocumentPose,
  sampleDrawOrder,
  sampleSlotColor
} from './features/animation/sampler';
import {
  type PreviewAnimationMix,
  sampleMixedAttachmentOverrides,
  sampleMixedDeformOffsets,
  sampleMixedDocumentPose,
  sampleMixedDrawOrder,
  sampleMixedSlotColor
} from './features/animation/mixer';
import {
  type StateMachinePreviewState,
  createInitialStateMachinePreview,
  firePreviewTrigger,
  getPreviewTransitionProgress,
  setPreviewBool,
  stepStateMachinePreview
} from './features/animation/state-machine';
import { getOrCreateTimeline } from './features/animation/timeline';
import {
  advancePlaybackTime,
  clampCurrentTime,
  clampKeyTime,
  defaultTimelineSnapStep,
  sanitizePlaybackSpeed,
  sanitizeSnapStep,
  snapTime
} from './features/animation/timeline-duration';
import {
  collectTimelineKeyRows,
  copyTimelineKey,
  deleteTimelineKey,
  duplicateTimelineKey,
  filterTimelineKeyRows,
  getTimelineModeForKey,
  normalizeTimelineKeySelection,
  pasteTimelineKey,
  resolveTimelineKey,
  timelineSelectionEquals,
  updateTimelineKeyTime
} from './features/animation/timeline-keys';
import type { TimelineClipboard, TimelineKeyFilter, TimelineKeyRow, TimelineKeySelection, ResolvedTimelineKey } from './features/animation/timeline-keys';
import {
  canvasToolModes,
  defaultCanvasBrushSettings,
  normalizeCanvasVertexSelection,
  sanitizeBrushRadius,
  sanitizeBrushStrength,
  updateCanvasVertexSelection,
  type CanvasBrushSettings,
  type CanvasToolMode,
  type CanvasVertexSelection
} from './features/canvas/canvas-tools';
import { collectBrushVertexFalloffs, hitTestMeshVertex, type CanvasMeshTarget } from './features/canvas/canvas-hit-test';
import {
  canvasToAttachmentLocal,
  getAttachmentCanvasTransform,
  type AttachmentCanvasTransform,
  type Point2D
} from './features/canvas/canvas-transform';
import { applyDeformBrush, getOrCreateDeformBrushKey } from './features/mesh/deform-brush';
import { applyWeightBrush } from './features/mesh/weight-brush';
import {
  createAnimationMixingStateMachineSampleDocument,
  createAnimationTimelinesSampleDocument,
  createDeformSampleDocument,
  createIkSampleDocument,
  createMeshSampleDocument,
  createSampleDocument,
  createSkinSampleDocument,
  createTimelineUsabilitySampleDocument,
  createWeightedMeshSampleDocument
} from './features/project/sample-project';
import { useI18n } from './i18n/useI18n';

type Selection =
  | { type: 'image'; name: string }
  | { type: 'bone'; name: string }
  | { type: 'slot'; name: string }
  | { type: 'skin'; name: string }
  | { type: 'attachment'; name: string }
  | { type: 'animation'; name: string }
  | { type: 'ikConstraint'; name: string }
  | { type: 'stateMachine'; name: string }
  | { type: 'meshVertex'; attachment: string; vertex: number }
  | { type: 'deformKey'; animation: string; slot: string; attachment: string; time: number };

type KeyKind = 'translate' | 'rotate' | 'scale';
type TimelineMode = 'bone' | 'deform' | 'attachment' | 'drawOrder' | 'slotColor' | 'event';
type RendererMenuCommand = 'newProject' | 'openProject' | 'saveProject' | 'exportProject' | 'quit' | 'undo' | 'redo';

interface EditorHistory {
  undo: Suwol2DProjectFile[];
  redo: Suwol2DProjectFile[];
}

interface PreviewView {
  zoom: number;
  panX: number;
  panY: number;
}

type StatusMessage =
  | { key: TranslationKey; params?: TranslationParams }
  | { text: string };

const maxHistoryEntries = 100;
const defaultPreviewView: PreviewView = { zoom: 1, panX: 0, panY: 0 };

const defaultProject: Suwol2DProjectFile = {
  editorVersion: 0,
  document: createEmptyDocument('untitled_character'),
  importedImages: [],
  lastExportPath: ''
};

export function App() {
  const { t, locale, setLocale: saveLocale, supportedLocales, settingsWarning } = useI18n();
  const [projectFilePath, setProjectFilePath] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [project, setProject] = useState<Suwol2DProjectFile>(defaultProject);
  const [selection, setSelection] = useState<Selection | null>({ type: 'bone', name: 'root' });
  const [activeSkinName, setActiveSkinName] = useState(defaultSkinName);
  const [currentAnimationName, setCurrentAnimationName] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineMode, setTimelineMode] = useState<TimelineMode>('bone');
  const [timelineFilter, setTimelineFilter] = useState<TimelineKeyFilter>('all');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelineKeySelection, setTimelineKeySelection] = useState<TimelineKeySelection | null>(null);
  const [timelineClipboard, setTimelineClipboard] = useState<TimelineClipboard | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapStep, setSnapStep] = useState(defaultTimelineSnapStep);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [canvasTool, setCanvasTool] = useState<CanvasToolMode>('select');
  const [canvasBrushSettings, setCanvasBrushSettings] = useState<CanvasBrushSettings>(defaultCanvasBrushSettings);
  const [selectedCanvasVertices, setSelectedCanvasVertices] = useState<CanvasVertexSelection | null>(null);
  const [lastTimelineEvent, setLastTimelineEvent] = useState('');
  const [stateMachinePreview, setStateMachinePreview] = useState<StateMachinePreviewState>(() => createInitialStateMachinePreview(defaultProject.document));
  const [statusMessage, setStatusMessage] = useState<StatusMessage>({ key: 'status.ready' });
  const [history, setHistory] = useState<EditorHistory>({ undo: [], redo: [] });
  const [isDirty, setIsDirty] = useState(false);

  const projectRef = useRef(project);
  const projectFilePathRef = useRef(projectFilePath);
  const isDirtyRef = useRef(isDirty);
  const closeInProgressRef = useRef(false);
  const previousEventTimeRef = useRef(0);
  const menuCommandRef = useRef<(command: RendererMenuCommand) => void>(() => undefined);

  const document = project.document;
  const skins = useMemo(() => getEffectiveSkins(document), [document]);
  const activeSkin = useMemo(() => getActiveSkin(document, activeSkinName), [document, activeSkinName]);
  const activeSkinAttachments = activeSkin.attachments;
  const currentAnimation = document.animations.find((animation) => animation.name === currentAnimationName);
  const selectedBone = selection?.type === 'bone' ? document.bones.find((bone) => bone.name === selection.name) : null;
  const selectedAnimation = selection?.type === 'animation' ? document.animations.find((a) => a.name === selection.name) : currentAnimation;
  const validation = useMemo(() => validateDocument(document), [document]);
  const duration = getAnimationDuration(currentAnimation);
  const safeSnapStep = sanitizeSnapStep(snapStep);
  const safePlaybackSpeed = sanitizePlaybackSpeed(playbackSpeed);
  const timelineKeyRows = useMemo(() => collectTimelineKeyRows(currentAnimation), [currentAnimation]);
  const filteredTimelineKeyRows = useMemo(
    () => filterTimelineKeyRows(timelineKeyRows, timelineFilter, timelineSearch),
    [timelineFilter, timelineKeyRows, timelineSearch]
  );
  const selectedTimelineKey = useMemo(() => resolveTimelineKey(document, timelineKeySelection), [document, timelineKeySelection]);
  const previewMix = useMemo<PreviewAnimationMix | null>(() => {
    if (!stateMachinePreview.isRunning || !stateMachinePreview.currentStateName) {
      return null;
    }

    const machine = document.stateMachines?.find((candidate) => candidate.name === stateMachinePreview.machineName);
    const currentState = machine?.states.find((state) => state.name === stateMachinePreview.currentStateName);
    const nextState = machine?.states.find((state) => state.name === stateMachinePreview.nextStateName);
    if (!currentState) {
      return null;
    }

    return {
      fromAnimationName: currentState.animation,
      fromTime: stateMachinePreview.currentTime,
      toAnimationName: nextState?.animation,
      toTime: stateMachinePreview.nextTime,
      weight: getPreviewTransitionProgress(stateMachinePreview)
    };
  }, [document.stateMachines, stateMachinePreview]);
  const validationErrorCount = validation.issues.filter((issue) => issue.severity === 'error').length;
  const validationWarningCount = validation.issues.filter((issue) => issue.severity === 'warning').length;
  const status = 'key' in statusMessage ? t(statusMessage.key, statusMessage.params) : statusMessage.text;
  const setStatus = (message: string) => setStatusMessage({ text: message });
  const setLocalizedStatus = (key: TranslationKey, params?: TranslationParams) => setStatusMessage({ key, params });

  async function handleLocaleChange(nextLocale: LocaleCode): Promise<void> {
    await saveLocale(nextLocale);
  }

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    projectFilePathRef.current = projectFilePath;
  }, [projectFilePath]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => window.suwol.app.onMenuCommand((command) => menuCommandRef.current(command)), []);

  useEffect(() => {
    globalThis.document.title = `${t('app.title')} - ${document.name || t('app.untitled')}${isDirty ? ' *' : ''}`;
  }, [document.name, isDirty, t]);

  useEffect(() => {
    if (settingsWarning) {
      setLocalizedStatus('settings.saveWarning', { message: settingsWarning });
    }
  }, [settingsWarning]);

  useEffect(() => {
    if (!isDirty || !projectFilePath) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      window.suwol.project.createBackup(projectFilePath, projectRef.current)
        .then((backupPath) => setLocalizedStatus('status.backupSaved', { path: backupPath }))
        .catch((error: unknown) => setLocalizedStatus('status.backupWarning', { message: getErrorMessage(error) }));
    }, 10000);

    return () => window.clearTimeout(timeout);
  }, [isDirty, project, projectFilePath]);

  useEffect(() => {
    setSelection((value) => normalizeSelection(value, document, project.importedImages));
  }, [document, project.importedImages]);

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }

    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = (now - previous) / 1000;
      previous = now;
      setCurrentTime((value) => {
        const next = advancePlaybackTime(value, delta, duration, currentAnimation?.loop ?? true, safePlaybackSpeed);
        if (!next.playing) {
          setIsPlaying(false);
        }
        return next.time;
      });
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [currentAnimation?.loop, duration, isPlaying, safePlaybackSpeed]);

  useEffect(() => {
    if (!currentAnimationName && document.animations.length > 0) {
      setCurrentAnimationName(document.animations[0].name);
      setIsPlaying(false);
      return;
    }

    if (currentAnimationName && !document.animations.some((animation) => animation.name === currentAnimationName)) {
      setCurrentAnimationName(document.animations[0]?.name ?? '');
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [currentAnimationName, document.animations]);

  useEffect(() => {
    setCurrentTime((value) => clampCurrentTime(value, duration));
  }, [currentAnimationName, duration]);

  useEffect(() => {
    setTimelineKeySelection((value) => normalizeTimelineKeySelection(document, value));
  }, [document]);

  useEffect(() => {
    setStateMachinePreview((current) => {
      const machines = document.stateMachines ?? [];
      const machine = machines.find((candidate) => candidate.name === current.machineName) ?? machines[0];
      if (!machine) {
        return createInitialStateMachinePreview(document);
      }

      if (
        machine.name !== current.machineName ||
        !machine.states.some((state) => state.name === current.currentStateName) ||
        (current.nextStateName && !machine.states.some((state) => state.name === current.nextStateName))
      ) {
        return createInitialStateMachinePreview(document, machine.name);
      }

      return current;
    });
  }, [document]);

  useEffect(() => {
    previousEventTimeRef.current = currentTime;
    setLastTimelineEvent('');
  }, [currentAnimationName]);

  useEffect(() => {
    if (!isPlaying || !currentAnimation) {
      previousEventTimeRef.current = currentTime;
      return;
    }

    const events = collectEventsBetween(currentAnimation, previousEventTimeRef.current, currentTime);
    previousEventTimeRef.current = currentTime;
    const lastEvent = events[events.length - 1];
    if (lastEvent) {
      setLastTimelineEvent(`${currentAnimation.name}:${lastEvent.name} ${lastEvent.stringValue ?? ''}`.trim());
    }
  }, [currentAnimation, currentTime, isPlaying]);

  useEffect(() => {
    if (!stateMachinePreview.isRunning) {
      return undefined;
    }

    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = (now - previous) / 1000;
      previous = now;
      setStateMachinePreview((current) => stepStateMachinePreview(projectRef.current.document, current, delta));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stateMachinePreview.isRunning]);

  useEffect(() => {
    if (!skins.some((skin) => skin.name === activeSkinName)) {
      setActiveSkinName(skins.find((skin) => skin.name === defaultSkinName)?.name ?? skins[0]?.name ?? defaultSkinName);
    }
  }, [activeSkinName, skins]);

  useEffect(() => {
    if (!document.bones.some((bone) => bone.name === canvasBrushSettings.boneName)) {
      setCanvasBrushSettings((current) => ({
        ...current,
        boneName: document.bones[0]?.name ?? ''
      }));
    }
  }, [canvasBrushSettings.boneName, document.bones]);

  useEffect(() => {
    setSelectedCanvasVertices((current) => {
      if (!current) {
        return current;
      }

      const attachment = findAttachmentForEdit(document, activeSkinName, current.attachment);
      return normalizeCanvasVertexSelection(current, attachment?.type === 'mesh' ? attachment : undefined);
    });
  }, [activeSkinName, document]);

  function getScrubTime(value: number): number {
    const next = snapEnabled ? snapTime(value, safeSnapStep) : value;
    return clampCurrentTime(next, duration);
  }

  function getKeyEditTime(value: number): number {
    const next = snapEnabled ? snapTime(value, safeSnapStep) : value;
    return clampKeyTime(next);
  }

  function setScrubTime(value: number) {
    setCurrentTime(getScrubTime(value));
  }

  function nudgeCurrentTime(delta: number) {
    setCurrentTime((value) => getScrubTime(value + delta));
  }

  function selectTimelineKey(row: TimelineKeyRow) {
    setTimelineKeySelection(row.selection);
    setTimelineMode(getTimelineModeForKey(row.selection.type) as TimelineMode);
    setCurrentTime(clampCurrentTime(row.time, duration));
  }

  function handleCopyTimelineKey() {
    const copied = copyTimelineKey(projectRef.current.document, timelineKeySelection);
    if (!copied) {
      setLocalizedStatus('status.selectKeyBeforeCopy');
      return;
    }

    setTimelineClipboard(copied);
    setLocalizedStatus('status.copiedKey', { type: copied.type });
  }

  function handlePasteTimelineKey() {
    if (!timelineClipboard || !currentAnimationName) {
      setLocalizedStatus('status.copyBeforePaste');
      return;
    }

    updateDocument((draft) => {
      const pasted = pasteTimelineKey(draft, currentAnimationName, timelineClipboard, getKeyEditTime(currentTime));
      if (pasted) {
        setTimelineKeySelection(pasted);
      }
    });
    setLocalizedStatus('status.pastedKey');
  }

  function handleDuplicateTimelineKey() {
    if (!timelineKeySelection) {
      setLocalizedStatus('status.selectKeyBeforeDuplicate');
      return;
    }

    updateDocument((draft) => {
      const duplicated = duplicateTimelineKey(draft, timelineKeySelection, getKeyEditTime(currentTime));
      if (duplicated) {
        setTimelineKeySelection(duplicated);
      }
    });
    setLocalizedStatus('status.duplicatedKey');
  }

  function handleDeleteTimelineKey() {
    if (!timelineKeySelection) {
      setLocalizedStatus('status.selectKeyBeforeDelete');
      return;
    }

    updateDocument((draft) => {
      if (deleteTimelineKey(draft, timelineKeySelection)) {
        setTimelineKeySelection(null);
      }
    });
    setLocalizedStatus('status.deletedKey');
  }

  function setSelectedTimelineKeyTime(value: number) {
    if (!timelineKeySelection) {
      return;
    }

    updateDocument((draft) => {
      const nextSelection = updateTimelineKeyTime(draft, timelineKeySelection, getKeyEditTime(value));
      setTimelineKeySelection(nextSelection);
    });
  }

  function updateSelectedTimelineKey(updater: (key: ResolvedTimelineKey, draft: Suwol2DDocument) => void) {
    if (!timelineKeySelection) {
      return;
    }

    updateDocument((draft) => {
      const resolved = resolveTimelineKey(draft, timelineKeySelection);
      if (!resolved) {
        setTimelineKeySelection(null);
        return;
      }
      updater(resolved, draft);
    });
  }

  async function loadProject(result: HydratedProjectResult | null, resetHistory = true): Promise<void> {
    if (!result) {
      return;
    }

    const nextProject = clone(result.project);
    ensureDefaultSkin(nextProject.document);
    syncTopLevelAttachmentsFromSkins(nextProject.document);
    setProjectFilePath(result.projectFilePath);
    setProjectPath(result.projectPath);
    setProject(nextProject);
    setIsDirty(false);
    if (resetHistory) {
      setHistory({ undo: [], redo: [] });
    }
    setActiveSkinName(defaultSkinName);
    setCurrentAnimationName(nextProject.document.animations[0]?.name ?? '');
    setCurrentTime(0);
    setIsPlaying(false);
    setTimelineKeySelection(null);
    setTimelineClipboard(null);
    setSelection(nextProject.document.bones[0] ? { type: 'bone', name: nextProject.document.bones[0].name } : null);
    setLocalizedStatus('status.loadedProject', { name: nextProject.document.name });
  }

  async function handleNewProject() {
    if (!(await confirmUnsavedChanges())) {
      return;
    }

    const name = window.prompt(t('inspector.name'), 'sample_character')?.trim();
    if (!name) return;

    try {
      await loadProject(await window.suwol.project.createProject(name));
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleOpenProject() {
    if (!(await confirmUnsavedChanges())) {
      return;
    }

    try {
      await loadProject(await window.suwol.project.openProject());
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function saveCurrentProject(nextProject = projectRef.current): Promise<boolean> {
    const filePath = projectFilePathRef.current;
    if (!filePath) {
      setLocalizedStatus('status.createOrOpenBeforeSaving');
      return false;
    }

    try {
      const result = await window.suwol.project.saveProject(filePath, nextProject);
      await loadProject(result, false);
      setIsDirty(false);
      setLocalizedStatus('status.projectSaved');
      return true;
    } catch (error) {
      setStatus(getErrorMessage(error));
      return false;
    }
  }

  async function handleSaveProject(nextProject = projectRef.current) {
    await saveCurrentProject(nextProject);
  }

  async function confirmUnsavedChanges(): Promise<boolean> {
    if (!isDirtyRef.current) {
      return true;
    }

    const choice = await window.suwol.app.confirmUnsavedChanges(projectRef.current.document.name, locale);
    if (choice === 'cancel') {
      setLocalizedStatus('status.actionCancelled');
      return false;
    }

    if (choice === 'discard') {
      return true;
    }

    return saveCurrentProject(projectRef.current);
  }

  async function handleWindowCloseRequest(): Promise<void> {
    if (closeInProgressRef.current) {
      return;
    }

    closeInProgressRef.current = true;
    const canClose = await confirmUnsavedChanges();
    if (canClose) {
      await window.suwol.app.forceClose();
      return;
    }

    closeInProgressRef.current = false;
  }

  async function handleImportImage() {
    if (!projectFilePath) {
      setLocalizedStatus('status.createOrOpenBeforeImport');
      return;
    }

    try {
      const image = await window.suwol.project.importImage(projectFilePath);
      if (!image) return;
      commitProjectChange((draft) => {
        draft.importedImages = [...draft.importedImages, image];
      });
      setSelection({ type: 'image', name: image.name });
      setLocalizedStatus('status.importedImage', { fileName: image.fileName });
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleCreateSampleCharacter() {
    if (!projectFilePath) {
      setLocalizedStatus('status.createProjectBeforeSample', { sample: t('sample.region') });
      return;
    }

    try {
      const sampleImages = await window.suwol.project.createSampleAssets(projectFilePath);
      const mergedImages = mergeImages(project.importedImages, sampleImages);
      commitProjectChange((draft) => {
        draft.importedImages = mergedImages;
        draft.document = createSampleDocument(mergedImages);
      });
      setActiveSkinName(defaultSkinName);
      setCurrentAnimationName('idle');
      setCurrentTime(0);
      setSelection({ type: 'bone', name: 'root' });
      setLocalizedStatus('status.sampleCreated', { sample: t('sample.region') });
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleCreateMeshSampleCharacter() {
    if (!projectFilePath) {
      setLocalizedStatus('status.createProjectBeforeSample', { sample: t('sample.mesh') });
      return;
    }

    try {
      const sampleImages = await window.suwol.project.createSampleAssets(projectFilePath);
      const mergedImages = mergeImages(project.importedImages, sampleImages);
      commitProjectChange((draft) => {
        draft.importedImages = mergedImages;
        draft.document = createMeshSampleDocument(mergedImages);
      });
      setActiveSkinName(defaultSkinName);
      setCurrentAnimationName('idle');
      setCurrentTime(0);
      setSelection({ type: 'attachment', name: 'arm_mesh' });
      setLocalizedStatus('status.sampleCreated', { sample: t('sample.mesh') });
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleCreateWeightedMeshSampleCharacter() {
    if (!projectFilePath) {
      setLocalizedStatus('status.createProjectBeforeSample', { sample: t('sample.weighted') });
      return;
    }

    try {
      const sampleImages = await window.suwol.project.createSampleAssets(projectFilePath);
      const mergedImages = mergeImages(project.importedImages, sampleImages);
      commitProjectChange((draft) => {
        draft.importedImages = mergedImages;
        draft.document = createWeightedMeshSampleDocument(mergedImages);
      });
      setActiveSkinName(defaultSkinName);
      setCurrentAnimationName('walk');
      setCurrentTime(0);
      setSelection({ type: 'attachment', name: 'arm_weighted_mesh' });
      setLocalizedStatus('status.sampleCreated', { sample: t('sample.weighted') });
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleCreateDeformSampleCharacter() {
    if (!projectFilePath) {
      setLocalizedStatus('status.createProjectBeforeSample', { sample: t('sample.deform') });
      return;
    }

    try {
      const sampleImages = await window.suwol.project.createSampleAssets(projectFilePath);
      const mergedImages = mergeImages(project.importedImages, sampleImages);
      commitProjectChange((draft) => {
        draft.importedImages = mergedImages;
        draft.document = createDeformSampleDocument(mergedImages);
      });
      setActiveSkinName(defaultSkinName);
      setCurrentAnimationName('walk');
      setCurrentTime(0);
      setSelection({ type: 'attachment', name: 'arm_deform_mesh' });
      setLocalizedStatus('status.sampleCreated', { sample: t('sample.deform') });
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleCreateIkSampleCharacter() {
    if (!projectFilePath) {
      setLocalizedStatus('status.createProjectBeforeSample', { sample: t('sample.ik') });
      return;
    }

    try {
      const sampleImages = await window.suwol.project.createSampleAssets(projectFilePath);
      const mergedImages = mergeImages(project.importedImages, sampleImages);
      commitProjectChange((draft) => {
        draft.importedImages = mergedImages;
        draft.document = createIkSampleDocument(mergedImages);
      });
      setActiveSkinName(defaultSkinName);
      setCurrentAnimationName('walk');
      setCurrentTime(0);
      setSelection({ type: 'ikConstraint', name: 'arm_ik' });
      setLocalizedStatus('status.sampleCreated', { sample: t('sample.ik') });
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleCreateSkinSampleCharacter() {
    if (!projectFilePath) {
      setLocalizedStatus('status.createProjectBeforeSample', { sample: t('sample.skin') });
      return;
    }

    try {
      const sampleImages = await window.suwol.project.createSkinSampleAssets(projectFilePath);
      const mergedImages = mergeImages(project.importedImages, sampleImages);
      commitProjectChange((draft) => {
        draft.importedImages = mergedImages;
        draft.document = createSkinSampleDocument(mergedImages);
      });
      setActiveSkinName('armor_01');
      setCurrentAnimationName('walk');
      setCurrentTime(0);
      setSelection({ type: 'skin', name: 'armor_01' });
      setLocalizedStatus('status.skinSampleCreated');
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleCreateAnimationTimelinesSampleCharacter() {
    if (!projectFilePath) {
      setLocalizedStatus('status.createProjectBeforeSample', { sample: t('sample.timelines') });
      return;
    }

    try {
      const sampleImages = await window.suwol.project.createAnimationTimelinesSampleAssets(projectFilePath);
      const mergedImages = mergeImages(project.importedImages, sampleImages);
      commitProjectChange((draft) => {
        draft.importedImages = mergedImages;
        draft.document = createAnimationTimelinesSampleDocument(mergedImages);
      });
      setActiveSkinName(defaultSkinName);
      setCurrentAnimationName('walk');
      setCurrentTime(0);
      setTimelineMode('attachment');
      setSelection({ type: 'slot', name: 'weapon_slot' });
      setLocalizedStatus('status.timelinesSampleCreated');
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleCreateAnimationMixingStateMachineSampleCharacter() {
    if (!projectFilePath) {
      setLocalizedStatus('status.createProjectBeforeSample', { sample: t('sample.stateMachine') });
      return;
    }

    try {
      const sampleImages = await window.suwol.project.createAnimationTimelinesSampleAssets(projectFilePath);
      const mergedImages = mergeImages(project.importedImages, sampleImages);
      const sampleDocument = createAnimationMixingStateMachineSampleDocument(mergedImages);
      commitProjectChange((draft) => {
        draft.importedImages = mergedImages;
        draft.document = sampleDocument;
      });
      setActiveSkinName(defaultSkinName);
      setCurrentAnimationName('idle');
      setCurrentTime(0);
      setTimelineMode('bone');
      setStateMachinePreview(createInitialStateMachinePreview(sampleDocument, 'default'));
      setSelection({ type: 'stateMachine', name: 'default' });
      setLocalizedStatus('status.stateMachineSampleCreated');
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleCreateTimelineUsabilitySampleCharacter() {
    if (!projectFilePath) {
      setLocalizedStatus('status.createProjectBeforeSample', { sample: t('sample.timelineEditing') });
      return;
    }

    try {
      const sampleImages = await window.suwol.project.createAnimationTimelinesSampleAssets(projectFilePath);
      const mergedImages = mergeImages(project.importedImages, sampleImages);
      commitProjectChange((draft) => {
        draft.importedImages = mergedImages;
        draft.document = createTimelineUsabilitySampleDocument(mergedImages);
      });
      setActiveSkinName(defaultSkinName);
      setCurrentAnimationName('walk');
      setCurrentTime(0);
      setTimelineMode('bone');
      setTimelineFilter('all');
      setTimelineKeySelection(null);
      setSelection({ type: 'bone', name: 'root' });
      setLocalizedStatus('status.timelineEditingSampleCreated');
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleExportJson() {
    if (!projectFilePath) {
      setLocalizedStatus('status.createOrOpenBeforeExport');
      return;
    }

    const exportValidation = validateDocument(createUnityRuntimeExport(document));
    const exportErrors = exportValidation.issues.filter((issue) => issue.severity === 'error');
    const exportWarnings = exportValidation.issues.filter((issue) => issue.severity === 'warning');
    if (exportErrors.length > 0) {
      setLocalizedStatus('status.exportBlocked', { count: exportErrors.length });
      return;
    }

    try {
      const exportResult = await window.suwol.project.exportSuwol2DJson(projectFilePath, project);
      if (!exportResult) return;
      setProject((value) => ({ ...value, lastExportPath: exportResult.exportPath }));
      const textureSummary = exportResult.texturePaths.length
        ? t('status.texturesCopied', { textures: exportResult.texturePaths.map((path) => path.split(/[\\/]/).pop()).join(', ') })
        : t('status.noTexturesCopied');
      const warningSummary = exportWarnings.length ? ` ${t('status.warningCount', { count: exportWarnings.length })}` : '';
      setLocalizedStatus('status.exportCompleted', { path: exportResult.exportPath, textures: textureSummary, warnings: warningSummary });
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleExportSuwol2DAsset() {
    if (!projectFilePath) {
      setLocalizedStatus('status.createOrOpenBeforeExport');
      return;
    }

    const exportValidation = validateDocument(createUnityRuntimeExport(document));
    const exportErrors = exportValidation.issues.filter((issue) => issue.severity === 'error');
    const exportWarnings = exportValidation.issues.filter((issue) => issue.severity === 'warning');
    if (exportErrors.length > 0) {
      setLocalizedStatus('status.exportBlocked', { count: exportErrors.length });
      return;
    }

    try {
      const exportResult = await window.suwol.project.exportSuwol2DAsset(projectFilePath, project);
      if (!exportResult) return;
      setProject((value) => ({ ...value, lastExportPath: exportResult.exportPath }));
      const textureSummary = exportResult.texturePaths.length
        ? t('status.texturesCopied', { textures: exportResult.texturePaths.map((path) => path.split(/[\\/]/).pop()).join(', ') })
        : t('status.noTexturesCopied');
      const warningSummary = exportWarnings.length ? ` ${t('status.warningCount', { count: exportWarnings.length })}` : '';
      setLocalizedStatus('status.exportCompletedWithDebug', {
        path: exportResult.exportPath,
        debugPath: exportResult.debugJsonPath,
        textures: textureSummary,
        warnings: warningSummary
      });
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  function commitProjectChange(updater: (project: Suwol2DProjectFile) => void, trackHistory = true) {
    setProject((value) => {
      const nextProject = clone(value);
      updater(nextProject);
      if (JSON.stringify(nextProject) === JSON.stringify(value)) {
        return value;
      }

      if (trackHistory) {
        setHistory((current) => ({
          undo: [...current.undo, clone(value)].slice(-maxHistoryEntries),
          redo: []
        }));
      }
      setIsDirty(true);
      return nextProject;
    });
  }

  function updateDocument(updater: (document: Suwol2DDocument) => void, trackHistory = true) {
    commitProjectChange((draft) => {
      updater(draft.document);
      ensureDefaultSkin(draft.document);
      syncTopLevelAttachmentsFromSkins(draft.document);
    }, trackHistory);
  }

  function undo() {
    setHistory((current) => {
      const previous = current.undo[current.undo.length - 1];
      if (!previous) {
        return current;
      }

      const currentSnapshot = clone(projectRef.current);
      const nextProject = clone(previous);
      projectRef.current = nextProject;
      setProject(nextProject);
      setIsDirty(true);
      isDirtyRef.current = true;
      setLocalizedStatus('status.undo');
      return {
        undo: current.undo.slice(0, -1),
        redo: [currentSnapshot, ...current.redo].slice(0, maxHistoryEntries)
      };
    });
  }

  function redo() {
    setHistory((current) => {
      const next = current.redo[0];
      if (!next) {
        return current;
      }

      const currentSnapshot = clone(projectRef.current);
      const nextProject = clone(next);
      projectRef.current = nextProject;
      setProject(nextProject);
      setIsDirty(true);
      isDirtyRef.current = true;
      setLocalizedStatus('status.redo');
      return {
        undo: [...current.undo, currentSnapshot].slice(-maxHistoryEntries),
        redo: current.redo.slice(1)
      };
    });
  }

  function deleteSelection() {
    if (timelineKeySelection) {
      handleDeleteTimelineKey();
      return;
    }

    if (!selection) {
      return;
    }

    if (selection.type === 'bone') {
      deleteBone(selection.name);
    } else if (selection.type === 'slot') {
      deleteSlot(selection.name);
    } else if (selection.type === 'skin') {
      deleteSkin(selection.name);
    } else if (selection.type === 'attachment') {
      deleteAttachment(selection.name);
    } else if (selection.type === 'animation') {
      deleteAnimation(selection.name);
    } else if (selection.type === 'ikConstraint') {
      deleteIkConstraint(selection.name);
    } else if (selection.type === 'stateMachine') {
      deleteStateMachine(selection.name);
    } else {
      setStatus(`Delete is not available for selected ${selection.type}.`);
    }
  }

  useEffect(() => window.suwol.app.onCloseRequest(() => {
    void handleWindowCloseRequest();
  }), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const editable = isEditableTarget(event.target);

      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault();
        void handleSaveProject();
        return;
      }

      if (!editable && (event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if (!editable && ((event.ctrlKey || event.metaKey) && key === 'y' || (event.ctrlKey || event.metaKey) && event.shiftKey && key === 'z')) {
        event.preventDefault();
        redo();
        return;
      }

      if (editable) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === 'c') {
        event.preventDefault();
        handleCopyTimelineKey();
      } else if ((event.ctrlKey || event.metaKey) && key === 'v') {
        event.preventDefault();
        handlePasteTimelineKey();
      } else if ((event.ctrlKey || event.metaKey) && key === 'd') {
        event.preventDefault();
        handleDuplicateTimelineKey();
      } else if (event.key === ' ') {
        event.preventDefault();
        setIsPlaying((value) => !value);
      } else if (event.key === 'Delete') {
        event.preventDefault();
        deleteSelection();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeCurrentTime(event.shiftKey ? -safeSnapStep * 10 : -safeSnapStep);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeCurrentTime(event.shiftKey ? safeSnapStep * 10 : safeSnapStep);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setScrubTime(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setScrubTime(duration);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  function addBone() {
    updateDocument((draft) => {
      const name = uniqueName('bone', draft.bones.map((bone) => bone.name));
      draft.bones.push({ name, parent: draft.bones[0]?.name ?? '', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
      setSelection({ type: 'bone', name });
    });
  }

  function deleteBone(name: string) {
    if (name === 'root') {
      setStatus('Root bone cannot be deleted in MVP v0.');
      return;
    }

    if (document.bones.some((bone) => bone.parent === name)) {
      setStatus(`Cannot delete bone '${name}' because it has child bones.`);
      return;
    }

    if (document.slots.some((slot) => slot.bone === name)) {
      setStatus(`Cannot delete bone '${name}' because a slot references it.`);
      return;
    }

    if (document.animations.some((animation) => animation.bones.some((timeline) => timeline.bone === name))) {
      setStatus(`Cannot delete bone '${name}' because an animation references it.`);
      return;
    }

    if (collectSkinAttachments(document).some((attachment) => attachment.type === 'mesh' && (attachment.weights ?? []).some((weight) => weight.bones.some((boneWeight) => boneWeight.bone === name)))) {
      setStatus(`Cannot delete bone '${name}' because mesh weights reference it.`);
      return;
    }

    if ((document.ikConstraints ?? []).some((constraint) => (
      constraint.parentBone === name || constraint.childBone === name || constraint.targetBone === name
    ))) {
      setStatus(`Cannot delete bone '${name}' because an IK constraint references it.`);
      return;
    }

    updateDocument((draft) => {
      draft.bones = draft.bones.filter((bone) => bone.name !== name);
      setSelection({ type: 'bone', name: draft.bones[0]?.name ?? '' });
    });
  }

  function addSlot() {
    updateDocument((draft) => {
      const name = uniqueName('slot', draft.slots.map((slot) => slot.name));
      draft.slots.push({
        name,
        bone: draft.bones[0]?.name ?? '',
        attachment: '',
        drawOrder: draft.slots.length
      });
      setSelection({ type: 'slot', name });
    });
  }

  function deleteSlot(name: string) {
    if (collectSkinAttachments(document).some((attachment) => attachment.slot === name)) {
      setStatus(`Cannot delete slot '${name}' because attachments reference it.`);
      return;
    }

    if (document.animations.some((animation) => (animation.deforms ?? []).some((deform) => deform.slot === name))) {
      setStatus(`Cannot delete slot '${name}' because a deform timeline references it.`);
      return;
    }

    if (document.animations.some((animation) => (
      (animation.attachments ?? []).some((timeline) => timeline.slot === name)
      || (animation.slots ?? []).some((timeline) => timeline.slot === name)
      || (animation.drawOrders ?? []).some((key) => key.slots.some((slot) => slot.slot === name))
    ))) {
      setStatus(`Cannot delete slot '${name}' because an animation timeline references it.`);
      return;
    }

    updateDocument((draft) => {
      draft.slots = draft.slots.filter((slot) => slot.name !== name);
      setSelection(draft.slots[0] ? { type: 'slot', name: draft.slots[0].name } : null);
    });
  }

  function addAttachment(type: 'region' | 'mesh' = 'region') {
    updateDocument((draft) => {
      const skin = ensureMutableSkin(draft, activeSkinName);
      const slotName = selection?.type === 'slot' ? selection.name : draft.slots[0]?.name ?? '';
      const image = project.importedImages[0];
      const baseName = type === 'mesh' ? `${image?.name ?? 'attachment'}_mesh` : image?.name ?? 'attachment';
      const name = uniqueName(baseName, skin.attachments.map((attachment) => attachment.name));
      const attachment = type === 'mesh'
        ? createDefaultMeshAttachment(name, slotName, image)
        : createDefaultRegionAttachment(name, slotName, image);
      skin.attachments.push(attachment);
      const slot = draft.slots.find((candidate) => candidate.name === slotName);
      if (slot) slot.attachment = name;
      setSelection({ type: 'attachment', name });
    });
  }

  function deleteAttachment(name: string) {
    if (document.animations.some((animation) => (animation.deforms ?? []).some((deform) => deform.attachment === name))) {
      setStatus(`Cannot delete attachment '${name}' because a deform timeline references it.`);
      return;
    }

    if (document.animations.some((animation) => (
      (animation.attachments ?? []).some((timeline) => timeline.keys.some((key) => key.attachment === name))
    ))) {
      setStatus(`Cannot delete attachment '${name}' because an attachment timeline references it.`);
      return;
    }

    updateDocument((draft) => {
      const skin = ensureMutableSkin(draft, activeSkinName);
      skin.attachments = skin.attachments.filter((attachment) => attachment.name !== name);
      for (const slot of draft.slots) {
        if (slot.attachment === name && !attachmentExistsInAnySkin(draft, slot.name, name)) slot.attachment = '';
      }
      setSelection(skin.attachments[0] ? { type: 'attachment', name: skin.attachments[0].name } : { type: 'skin', name: skin.name });
    });
  }

  function addSkin() {
    updateDocument((draft) => {
      ensureDefaultSkin(draft);
      const name = uniqueName('skin', getEffectiveSkins(draft).map((skin) => skin.name));
      draft.skins.push({ name, attachments: [] });
      setActiveSkinName(name);
      setSelection({ type: 'skin', name });
    });
  }

  function deleteSkin(name: string) {
    if (name === defaultSkinName) {
      setStatus('The default skin cannot be deleted.');
      return;
    }

    updateDocument((draft) => {
      draft.skins = getEffectiveSkins(draft).filter((skin) => skin.name !== name);
      setActiveSkinName(defaultSkinName);
      setSelection({ type: 'skin', name: defaultSkinName });
    });
  }

  function duplicateSkin(name: string) {
    updateDocument((draft) => {
      ensureDefaultSkin(draft);
      const source = getEffectiveSkins(draft).find((skin) => skin.name === name);
      if (!source) return;
      const nextName = uniqueName(`${name}_copy`, getEffectiveSkins(draft).map((skin) => skin.name));
      draft.skins.push({ name: nextName, attachments: source.attachments.map((attachment) => cloneAttachment(attachment)) });
      setActiveSkinName(nextName);
      setSelection({ type: 'skin', name: nextName });
    });
  }

  function addAnimation() {
    updateDocument((draft) => {
      const name = uniqueName('animation', draft.animations.map((animation) => animation.name));
      draft.animations.push({ name, loop: true, bones: [] });
      setCurrentAnimationName(name);
      setSelection({ type: 'animation', name });
      setCurrentTime(0);
    });
  }

  function deleteAnimation(name: string) {
    updateDocument((draft) => {
      draft.animations = draft.animations.filter((animation) => animation.name !== name);
      const nextName = draft.animations[0]?.name ?? '';
      setCurrentAnimationName(nextName);
      setSelection(nextName ? { type: 'animation', name: nextName } : null);
      setCurrentTime(0);
    });
  }

  function addIkConstraint() {
    if (document.bones.length < 3) {
      setStatus('Create at least three bones before adding a 2-bone IK constraint.');
      return;
    }

    updateDocument((draft) => {
      const name = uniqueName('ik', (draft.ikConstraints ?? []).map((constraint) => constraint.name));
      const child = draft.bones.find((bone) => bone.parent) ?? draft.bones[1];
      const parent = draft.bones.find((bone) => bone.name === child?.parent) ?? draft.bones[0];
      const target = draft.bones.find((bone) => bone.name !== parent?.name && bone.name !== child?.name) ?? draft.bones[0];
      draft.ikConstraints ??= [];
      draft.ikConstraints.push({
        name,
        parentBone: parent?.name ?? '',
        childBone: child?.name ?? '',
        targetBone: target?.name ?? '',
        enabled: true,
        mix: 1,
        bendDirection: 1,
        order: draft.ikConstraints.length
      });
      setSelection({ type: 'ikConstraint', name });
    });
  }

  function deleteIkConstraint(name: string) {
    updateDocument((draft) => {
      draft.ikConstraints = (draft.ikConstraints ?? []).filter((constraint) => constraint.name !== name);
      if (draft.ikConstraints.length === 0) {
        draft.ikConstraints = undefined;
      }
      const next = draft.ikConstraints?.[0];
      setSelection(next ? { type: 'ikConstraint', name: next.name } : null);
    });
  }

  function addStateMachine() {
    updateDocument((draft) => {
      const name = uniqueName('state_machine', (draft.stateMachines ?? []).map((machine) => machine.name));
      const initialAnimation = draft.animations[0]?.name ?? '';
      draft.stateMachines ??= [];
      draft.stateMachines.push({
        name,
        initialState: initialAnimation || 'state',
        states: [
          {
            name: initialAnimation || 'state',
            animation: initialAnimation,
            loop: true,
            speed: 1
          }
        ],
        parameters: [],
        transitions: []
      });
      setStateMachinePreview(createInitialStateMachinePreview(draft, name));
      setSelection({ type: 'stateMachine', name });
    });
  }

  function deleteStateMachine(name: string) {
    updateDocument((draft) => {
      draft.stateMachines = (draft.stateMachines ?? []).filter((machine) => machine.name !== name);
      if (draft.stateMachines.length === 0) {
        draft.stateMachines = undefined;
      }
      const next = draft.stateMachines?.[0];
      setStateMachinePreview(createInitialStateMachinePreview(draft, next?.name ?? ''));
      setSelection(next ? { type: 'stateMachine', name: next.name } : null);
    });
  }

  function addKey(kind: KeyKind) {
    if (!selectedBone || !currentAnimation) {
      setLocalizedStatus('status.selectBoneAndAnimationBeforeKeys');
      return;
    }

    const keyTime = getKeyEditTime(currentTime);
    updateDocument((draft) => {
      const animation = draft.animations.find((candidate) => candidate.name === currentAnimation.name);
      if (!animation) return;
      const timeline = getOrCreateTimeline(animation, selectedBone.name);
      let keyIndex = 0;
      if (kind === 'translate') {
        const key = timeline.translate.find((candidate) => Math.abs(candidate.time - keyTime) < 0.0001) ?? { time: keyTime, x: selectedBone.x, y: selectedBone.y };
        key.x = selectedBone.x;
        key.y = selectedBone.y;
        if (!timeline.translate.includes(key)) timeline.translate.push(key);
        timeline.translate.sort(sortByTime);
        keyIndex = timeline.translate.findIndex((candidate) => candidate === key);
        setTimelineKeySelection({ type: 'boneTranslate', animation: animation.name, target: selectedBone.name, keyIndex });
      } else if (kind === 'rotate') {
        const key = timeline.rotate.find((candidate) => Math.abs(candidate.time - keyTime) < 0.0001) ?? { time: keyTime, rotation: selectedBone.rotation };
        key.rotation = selectedBone.rotation;
        if (!timeline.rotate.includes(key)) timeline.rotate.push(key);
        timeline.rotate.sort(sortByTime);
        keyIndex = timeline.rotate.findIndex((candidate) => candidate === key);
        setTimelineKeySelection({ type: 'boneRotate', animation: animation.name, target: selectedBone.name, keyIndex });
      } else {
        const key = timeline.scale.find((candidate) => Math.abs(candidate.time - keyTime) < 0.0001) ?? { time: keyTime, scaleX: selectedBone.scaleX, scaleY: selectedBone.scaleY };
        key.scaleX = selectedBone.scaleX;
        key.scaleY = selectedBone.scaleY;
        if (!timeline.scale.includes(key)) timeline.scale.push(key);
        timeline.scale.sort(sortByTime);
        keyIndex = timeline.scale.findIndex((candidate) => candidate === key);
        setTimelineKeySelection({ type: 'boneScale', animation: animation.name, target: selectedBone.name, keyIndex });
      }
    });
  }

  function addDeformKey() {
    if (!currentAnimation || !selectedDeformMesh) {
      setLocalizedStatus('status.selectAnimationAndMeshBeforeDeformKeys');
      return;
    }

    updateDocument((draft) => {
      const animation = draft.animations.find((candidate) => candidate.name === currentAnimation.name);
      const attachment = findMeshAttachmentForEdit(draft, activeSkinName, selectedDeformMesh.name);
      if (!animation || !attachment || attachment.type !== 'mesh') return;
      const key = addOrReplaceDeformKey(animation, attachment, getKeyEditTime(currentTime));
      const timeline = findDeformTimeline(animation, attachment);
      const keyIndex = timeline?.keys.findIndex((candidate) => candidate === key) ?? 0;
      setTimelineKeySelection({ type: 'deform', animation: animation.name, target: `${attachment.slot}/${attachment.name}`, keyIndex: Math.max(0, keyIndex) });
    });
  }

  const selectedDeformAttachment = selection?.type === 'attachment'
    ? findAttachmentForEdit(document, activeSkinName, selection.name)
    : undefined;
  const selectedDeformMesh = selectedDeformAttachment?.type === 'mesh' ? selectedDeformAttachment : undefined;
  const activeCanvasMeshName = selection?.type === 'meshVertex'
    ? selection.attachment
    : selectedDeformMesh?.name ?? selectedCanvasVertices?.attachment ?? '';
  const currentTimeline = currentAnimation && selectedBone
    ? currentAnimation.bones.find((timeline) => timeline.bone === selectedBone.name)
    : undefined;
  const sampleOptions = [
    { label: t('sample.region'), onSelect: handleCreateSampleCharacter },
    { label: t('sample.mesh'), onSelect: handleCreateMeshSampleCharacter },
    { label: t('sample.weighted'), onSelect: handleCreateWeightedMeshSampleCharacter },
    { label: t('sample.deform'), onSelect: handleCreateDeformSampleCharacter },
    { label: t('sample.ik'), onSelect: handleCreateIkSampleCharacter },
    { label: t('sample.skin'), onSelect: handleCreateSkinSampleCharacter },
    { label: t('sample.timelines'), onSelect: handleCreateAnimationTimelinesSampleCharacter },
    { label: t('sample.stateMachine'), onSelect: handleCreateAnimationMixingStateMachineSampleCharacter },
    { label: t('sample.timelineEditing'), onSelect: handleCreateTimelineUsabilitySampleCharacter }
  ];

  menuCommandRef.current = (command) => {
    if (command === 'newProject') void handleNewProject();
    if (command === 'openProject') void handleOpenProject();
    if (command === 'saveProject') void handleSaveProject();
    if (command === 'exportProject') void handleExportSuwol2DAsset();
    if (command === 'quit') void handleWindowCloseRequest();
    if (command === 'undo') undo();
    if (command === 'redo') redo();
  };

  return (
    <main className="editor-shell">
      <header className="editor-toolbar">
        <ToolbarButton label={t('toolbar.newProject')} onClick={() => void handleNewProject()} icon={<FilePlus2 size={17} />} />
        <ToolbarButton label={t('toolbar.openProject')} onClick={() => void handleOpenProject()} icon={<FolderOpen size={17} />} />
        <ToolbarButton label={t('toolbar.saveProject')} onClick={() => void handleSaveProject()} icon={<Save size={17} />} />
        <ToolbarButton label={t('toolbar.undo')} onClick={undo} icon={<Undo2 size={17} />} disabled={history.undo.length === 0} />
        <ToolbarButton label={t('toolbar.redo')} onClick={redo} icon={<Redo2 size={17} />} disabled={history.redo.length === 0} />
        <ToolbarButton label={t('toolbar.importImage')} onClick={handleImportImage} icon={<ImagePlus size={17} />} />
        <SampleMenu options={sampleOptions} />
        <div className="toolbar-separator" />
        <button className="icon-label-button" type="button" onClick={() => setIsPlaying((value) => !value)}>
          {isPlaying ? <Pause size={17} /> : <Play size={17} />}
          <span>{isPlaying ? t('common.stop') : t('common.play')}</span>
        </button>
        <select value={currentAnimationName} onChange={(event) => { setCurrentAnimationName(event.target.value); setCurrentTime(0); setTimelineKeySelection(null); }}>
          <option value="">{t('toolbar.noAnimation')}</option>
          {document.animations.map((animation) => (
            <option key={animation.name} value={animation.name}>{animation.name}</option>
          ))}
        </select>
        <label className="time-input">
          <span>{t('toolbar.time')}</span>
          <input type="number" value={round(currentTime)} min={0} step={safeSnapStep} onChange={(event) => setScrubTime(toNumber(event.target.value, currentTime))} />
        </label>
        <div className="toolbar-spacer" />
        <ToolbarButton label={t('toolbar.exportJson')} onClick={handleExportJson} icon={<Download size={17} />} />
        <ToolbarButton label={t('toolbar.exportSuwol2D')} onClick={handleExportSuwol2DAsset} icon={<Download size={17} />} />
        <LanguageSelector
          locale={locale}
          locales={supportedLocales}
          onChange={(nextLocale) => void handleLocaleChange(nextLocale)}
        />
        {isDirty && <span className="dirty-pill">{t('toolbar.unsavedChanges')}</span>}
        {(validationErrorCount > 0 || validationWarningCount > 0) && (
          <span className="validation-pill">{t('toolbar.validationSummary', { errors: validationErrorCount, warnings: validationWarningCount })}</span>
        )}
        <span className="status-line">{status}</span>
      </header>

      <section className="editor-workspace">
        <aside className="left-panel panel">
          <ProjectHeader projectPath={projectPath} document={document} isDirty={isDirty} />
          <ListSection title={t('panel.images')} icon={<ImagePlus size={15} />} onAdd={handleImportImage}>
            {project.importedImages.map((image) => (
              <ListButton
                key={image.id}
                active={selection?.type === 'image' && selection.name === image.name}
                label={`${image.name} (${image.width}x${image.height})`}
                onClick={() => setSelection({ type: 'image', name: image.name })}
              />
            ))}
          </ListSection>
          <ListSection title={t('panel.bones')} icon={<Bone size={15} />} onAdd={addBone}>
            {document.bones.map((bone) => (
              <ListButton
                key={bone.name}
                active={selection?.type === 'bone' && selection.name === bone.name}
                label={bone.name}
                onClick={() => setSelection({ type: 'bone', name: bone.name })}
                onDelete={bone.name === 'root' ? undefined : () => deleteBone(bone.name)}
              />
            ))}
          </ListSection>
          <ListSection title={t('panel.slots')} icon={<Layers3 size={15} />} onAdd={addSlot}>
            {[...document.slots].sort((a, b) => a.drawOrder - b.drawOrder).map((slot) => (
              <ListButton
                key={slot.name}
                active={selection?.type === 'slot' && selection.name === slot.name}
                label={slot.name}
                onClick={() => setSelection({ type: 'slot', name: slot.name })}
                onDelete={() => deleteSlot(slot.name)}
              />
            ))}
          </ListSection>
          <ListSection title={t('panel.skins')} icon={<Layers3 size={15} />} onAdd={addSkin}>
            {skins.map((skin) => (
              <ListButton
                key={skin.name}
                active={selection?.type === 'skin' && selection.name === skin.name}
                label={`${skin.name}${skin.name === activeSkinName ? ` [${t('common.active')}]` : ''}`}
                onClick={() => { setActiveSkinName(skin.name); setSelection({ type: 'skin', name: skin.name }); }}
                onDelete={skin.name === defaultSkinName ? undefined : () => deleteSkin(skin.name)}
              />
            ))}
          </ListSection>
          <ListSection title={t('panel.attachments')} icon={<Box size={15} />} onAdd={() => addAttachment('region')}>
            <button className="wide-action" type="button" onClick={() => addAttachment('mesh')}>{t('inspector.addMeshAttachment')}</button>
            {activeSkinAttachments.map((attachment) => (
              <ListButton
                key={`${activeSkinName}-${attachment.slot}-${attachment.name}`}
                active={selection?.type === 'attachment' && selection.name === attachment.name}
                label={`${attachment.name} [${attachment.type}]`}
                onClick={() => setSelection({ type: 'attachment', name: attachment.name })}
                onDelete={() => deleteAttachment(attachment.name)}
              />
            ))}
          </ListSection>
          <ListSection title={t('panel.animations')} icon={<Play size={15} />} onAdd={addAnimation}>
            {document.animations.map((animation) => (
              <ListButton
                key={animation.name}
                active={selection?.type === 'animation' && selection.name === animation.name}
                label={animation.name}
                onClick={() => { setSelection({ type: 'animation', name: animation.name }); setCurrentAnimationName(animation.name); }}
                onDelete={() => deleteAnimation(animation.name)}
              />
            ))}
          </ListSection>
          <ListSection title={t('panel.ikConstraints')} icon={<Bone size={15} />} onAdd={addIkConstraint}>
            {[...(document.ikConstraints ?? [])].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map((constraint) => (
              <ListButton
                key={constraint.name}
                active={selection?.type === 'ikConstraint' && selection.name === constraint.name}
                label={`${constraint.name} [${constraint.parentBone} -> ${constraint.childBone}]`}
                onClick={() => setSelection({ type: 'ikConstraint', name: constraint.name })}
                onDelete={() => deleteIkConstraint(constraint.name)}
              />
            ))}
          </ListSection>
          <ListSection title={t('panel.stateMachines')} icon={<Play size={15} />} onAdd={addStateMachine}>
            {(document.stateMachines ?? []).map((machine) => (
              <ListButton
                key={machine.name}
                active={selection?.type === 'stateMachine' && selection.name === machine.name}
                label={`${machine.name} [${machine.initialState}]`}
                onClick={() => setSelection({ type: 'stateMachine', name: machine.name })}
                onDelete={() => deleteStateMachine(machine.name)}
              />
            ))}
          </ListSection>
        </aside>

        <section className="preview-panel">
          <CanvasPreview
            document={document}
            images={project.importedImages}
            activeSkinName={activeSkinName}
            animationName={currentAnimationName}
            time={currentTime}
            previewMix={previewMix}
            lastEvent={lastTimelineEvent}
            selection={selection}
            selectedVertices={selectedCanvasVertices}
            setSelection={setSelection}
            setSelectedVertices={setSelectedCanvasVertices}
            toolMode={canvasTool}
            setToolMode={setCanvasTool}
            brushSettings={canvasBrushSettings}
            setBrushSettings={setCanvasBrushSettings}
            activeMeshName={activeCanvasMeshName}
            deformTime={getKeyEditTime(currentTime)}
            updateDocument={updateDocument}
            setLocalizedStatus={setLocalizedStatus}
          />
        </section>

        <aside className="right-panel panel">
          <Inspector
            document={document}
            images={project.importedImages}
            selection={selection}
            activeSkinName={activeSkinName}
            setActiveSkinName={setActiveSkinName}
            currentAnimation={selectedAnimation}
            updateDocument={updateDocument}
            setSelection={setSelection}
            setCurrentAnimationName={setCurrentAnimationName}
            setStatus={setStatus}
            duplicateSkin={duplicateSkin}
            deleteSkin={deleteSkin}
          />
          <StateMachinePreviewPanel
            document={document}
            preview={stateMachinePreview}
            setPreview={setStateMachinePreview}
          />
          <AboutReleasePanel />
          <ValidationPanel
            document={document}
            issues={validation.issues}
            onSelect={(nextSelection) => setSelection(nextSelection)}
          />
        </aside>
      </section>

      <section className="timeline-panel">
        <div className="timeline-header">
          <div>
            <strong>{currentAnimationName || t('timeline.noAnimation')}</strong>
            <span>{t('timeline.durationSeconds', { duration: duration ? round(duration) : 0 })}</span>
          </div>
          <div className="timeline-actions">
            <select value={timelineMode} onChange={(event) => setTimelineMode(event.target.value as TimelineMode)}>
              <option value="bone">{t('timeline.bone')}</option>
              <option value="deform">{t('timeline.deform')}</option>
              <option value="attachment">{t('timeline.attachment')}</option>
              <option value="drawOrder">{t('timeline.drawOrder')}</option>
              <option value="slotColor">{t('timeline.slotColor')}</option>
              <option value="event">{t('timeline.event')}</option>
            </select>
            {timelineMode === 'bone' && (
              <>
                <button type="button" onClick={() => addKey('translate')}>{t('timeline.addTranslateKey')}</button>
                <button type="button" onClick={() => addKey('rotate')}>{t('timeline.addRotateKey')}</button>
                <button type="button" onClick={() => addKey('scale')}>{t('timeline.addScaleKey')}</button>
              </>
            )}
            {timelineMode === 'deform' && <button type="button" onClick={addDeformKey}>{t('timeline.addDeformKey')}</button>}
          </div>
        </div>
        <TimelineTransport
          animations={document.animations}
          currentAnimationName={currentAnimationName}
          currentAnimation={currentAnimation}
          currentTime={currentTime}
          duration={duration}
          playbackSpeed={safePlaybackSpeed}
          isPlaying={isPlaying}
          loop={currentAnimation?.loop ?? true}
          snapEnabled={snapEnabled}
          snapStep={safeSnapStep}
          timelineFilter={timelineFilter}
          timelineSearch={timelineSearch}
          onAnimationChange={(animationName) => {
            setCurrentAnimationName(animationName);
            setCurrentTime(0);
            setTimelineKeySelection(null);
          }}
          onTimeChange={setScrubTime}
          onDurationChange={(value) => {
            if (!currentAnimation) return;
            updateDocument((draft) => {
              const animation = draft.animations.find((candidate) => candidate.name === currentAnimation.name);
              if (!animation) return;
              const durationValue = Number.isFinite(value) && value > 0 ? value : undefined;
              animation.duration = durationValue;
            });
          }}
          onLoopChange={(value) => {
            if (!currentAnimation) return;
            updateDocument((draft) => {
              const animation = draft.animations.find((candidate) => candidate.name === currentAnimation.name);
              if (animation) animation.loop = value;
            });
          }}
          onPlaybackSpeedChange={setPlaybackSpeed}
          onPlayToggle={() => setIsPlaying((value) => !value)}
          onSnapEnabledChange={setSnapEnabled}
          onSnapStepChange={(value) => setSnapStep(sanitizeSnapStep(value))}
          onFilterChange={setTimelineFilter}
          onSearchChange={setTimelineSearch}
        />
        <TimelineKeyBrowser
          rows={filteredTimelineKeyRows}
          selected={timelineKeySelection}
          clipboard={timelineClipboard}
          onSelect={selectTimelineKey}
          onCopy={handleCopyTimelineKey}
          onPaste={handlePasteTimelineKey}
          onDuplicate={handleDuplicateTimelineKey}
          onDelete={handleDeleteTimelineKey}
        />
        <SelectedTimelineKeyInspector
          resolved={selectedTimelineKey}
          document={document}
          activeSkinName={activeSkinName}
          setSelection={setSelection}
          setTimelineMode={(mode) => setTimelineMode(mode)}
          setCurrentTime={setScrubTime}
          setKeyTime={setSelectedTimelineKeyTime}
          updateSelectedKey={updateSelectedTimelineKey}
        />
        {timelineMode === 'bone' && (
          <TimelineEditor
            timeline={currentTimeline}
            snapKeyTime={getKeyEditTime}
            updateTimeline={(updater) => {
              if (!currentAnimation || !selectedBone) return;
              updateDocument((draft) => {
                const animation = draft.animations.find((candidate) => candidate.name === currentAnimation.name);
                if (!animation) return;
                const timeline = getOrCreateTimeline(animation, selectedBone.name);
                updater(timeline);
              });
            }}
          />
        )}
        {timelineMode === 'deform' && (
          <DeformTimelineEditor
            animation={currentAnimation}
            attachment={selectedDeformMesh}
            activeSkinName={activeSkinName}
            currentTime={currentTime}
            snapKeyTime={getKeyEditTime}
            updateDocument={updateDocument}
          />
        )}
        {timelineMode === 'attachment' && (
          <AttachmentTimelineEditor
            animation={currentAnimation}
            document={document}
            activeSkinName={activeSkinName}
            currentTime={currentTime}
            snapKeyTime={getKeyEditTime}
            selectedSlotName={selection?.type === 'slot' ? selection.name : selectedDeformAttachment?.slot}
            updateDocument={updateDocument}
            setSelection={setSelection}
          />
        )}
        {timelineMode === 'drawOrder' && (
          <DrawOrderTimelineEditor
            animation={currentAnimation}
            document={document}
            currentTime={currentTime}
            snapKeyTime={getKeyEditTime}
            updateDocument={updateDocument}
          />
        )}
        {timelineMode === 'slotColor' && (
          <SlotColorTimelineEditor
            animation={currentAnimation}
            document={document}
            currentTime={currentTime}
            snapKeyTime={getKeyEditTime}
            selectedSlotName={selection?.type === 'slot' ? selection.name : selectedDeformAttachment?.slot}
            updateDocument={updateDocument}
            setSelection={setSelection}
          />
        )}
        {timelineMode === 'event' && (
          <EventTimelineEditor
            animation={currentAnimation}
            currentTime={currentTime}
            snapKeyTime={getKeyEditTime}
            updateDocument={updateDocument}
          />
        )}
      </section>
    </main>
  );
}

function ToolbarButton({
  label,
  icon,
  onClick,
  disabled = false
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="icon-label-button" type="button" onClick={onClick} disabled={disabled}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SampleMenu({
  options
}: {
  options: Array<{ label: string; onSelect: () => void | Promise<void> }>;
}) {
  const { t } = useI18n();
  return (
    <label className="sample-menu">
      <Sparkles size={17} />
      <span>{t('toolbar.samples')}</span>
      <select
        value=""
        onChange={(event) => {
          const value = event.target.value;
          if (!value) return;
          void options[Number(value)]?.onSelect();
        }}
      >
        <option value="">{t('toolbar.chooseSample')}</option>
        {options.map((option, index) => (
          <option key={option.label} value={index}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function LanguageSelector({
  locale,
  locales,
  onChange
}: {
  locale: LocaleCode;
  locales: ReadonlyArray<{ code: LocaleCode; nativeLabel: string }>;
  onChange: (locale: LocaleCode) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="language-selector">
      <span>{t('language.label')}</span>
      <select value={locale} onChange={(event) => onChange(event.target.value as LocaleCode)}>
        {locales.map((candidate) => (
          <option key={candidate.code} value={candidate.code}>{candidate.nativeLabel}</option>
        ))}
      </select>
    </label>
  );
}

function AboutReleasePanel() {
  const { t, locale, setLocale, supportedLocales } = useI18n();
  return (
    <section className="inspector-section about-panel">
      <h2><Info size={15} /> {t('about.title')}</h2>
      <ReadonlyRow label={t('about.product')} value={suwolReleaseInfo.productName} />
      <ReadonlyRow label={t('about.version')} value={suwolReleaseInfo.appVersion} />
      <ReadonlyRow label={t('about.unityPackage')} value={`${suwolReleaseInfo.unityPackageName} ${suwolReleaseInfo.unityPackageVersion}`} />
      <ReadonlyRow label={t('about.format')} value={`Suwol2D v${suwolReleaseInfo.formatVersion}`} />
      <ReadonlyRow label={t('about.supported')} value={t('about.supportedFeatures')} />
      <ReadonlyRow label={t('about.license')} value={suwolReleaseInfo.license} />
      <ReadonlyRow label={t('about.docs')} value={suwolReleaseInfo.docsPath} />
      <LanguageSelector
        locale={locale}
        locales={supportedLocales}
        onChange={(nextLocale) => void setLocale(nextLocale)}
      />
    </section>
  );
}

function ProjectHeader({
  projectPath,
  document,
  isDirty
}: {
  projectPath: string;
  document: Suwol2DDocument;
  isDirty: boolean;
}) {
  const { t } = useI18n();
  return (
    <section className="project-header">
      <p>{t('app.editorName')}</p>
      <h1>{document.name}{isDirty ? ' *' : ''}</h1>
      <span>{projectPath || t('common.noneSelected')}</span>
    </section>
  );
}

function ListSection({
  title,
  icon,
  onAdd,
  children
}: {
  title: string;
  icon: ReactNode;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section className="list-section">
      <div className="section-title">
        <span>{icon}{title}</span>
        <button type="button" onClick={onAdd}>+</button>
      </div>
      <div className="list-stack">{children}</div>
    </section>
  );
}

function ListButton({
  active,
  label,
  onClick,
  onDelete
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={active ? 'list-row active' : 'list-row'}>
      <button type="button" onClick={onClick}>{label}</button>
      {onDelete && (
        <button className="delete-button" type="button" onClick={onDelete} aria-label={`${t('common.delete')} ${label}`} title={`${t('common.delete')} ${label}`}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function ValidationPanel({
  document,
  issues,
  onSelect
}: {
  document: Suwol2DDocument;
  issues: ValidationIssue[];
  onSelect: (selection: Selection) => void;
}) {
  const { t } = useI18n();
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  return (
    <section className="validation-box">
      <div className="validation-header">
        <h2>{t('panel.validation')}</h2>
        <span>{t('validation.summary', { errors, warnings })}</span>
      </div>
      {issues.length === 0 ? (
        <p>{t('validation.noIssues')}</p>
      ) : (
        <div className="validation-list">
          {issues.map((issue, index) => {
            const targetSelection = inferValidationSelection(issue, document);
            return (
              <button
                className={`validation-item ${issue.severity}`}
                type="button"
                key={`${issue.severity}-${issue.message}-${index}`}
                onClick={() => targetSelection && onSelect(targetSelection)}
                disabled={!targetSelection}
              >
                <strong>{issue.severity === 'error' ? t('common.error') : t('common.warning')}</strong>
                <span>{issue.messageKey ? t(issue.messageKey, issue.params) : issue.message}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StateMachinePreviewPanel({
  document,
  preview,
  setPreview
}: {
  document: Suwol2DDocument;
  preview: StateMachinePreviewState;
  setPreview: (updater: StateMachinePreviewState | ((current: StateMachinePreviewState) => StateMachinePreviewState)) => void;
}) {
  const { t } = useI18n();
  const machines = document.stateMachines ?? [];
  const machine = machines.find((candidate) => candidate.name === preview.machineName) ?? machines[0];
  if (machines.length === 0) {
    return null;
  }

  const progress = getPreviewTransitionProgress(preview);
  return (
    <section className="validation-box state-machine-preview">
      <div className="validation-header">
        <h2>{t('panel.stateMachines')}</h2>
        <span>{preview.isRunning ? t('common.running') : t('common.stopped')}</span>
      </div>
      <SelectField
        label="Machine"
        value={machine?.name ?? ''}
        options={machines.map((candidate) => candidate.name)}
        onChange={(value) => setPreview(createInitialStateMachinePreview(document, value))}
      />
      <div className="inspector-action-row">
        <button
          type="button"
          onClick={() => setPreview((current) => ({
            ...createInitialStateMachinePreview(document, current.machineName || machine?.name),
            isRunning: true
          }))}
        >
          {t('common.start')}
        </button>
        <button type="button" onClick={() => setPreview((current) => ({ ...current, isRunning: false }))}>{t('common.stop')}</button>
      </div>
      <ReadonlyRow label={t('timeline.currentTime')} value={preview.currentStateName || t('common.none')} />
      <ReadonlyRow label={t('stateMachine.next')} value={preview.nextStateName || t('common.none')} />
      <ReadonlyRow label={t('stateMachine.progress')} value={`${Math.round(progress * 100)}%`} />
      {machine?.parameters.map((parameter) => (
        parameter.type === 'bool' ? (
          <label className="field-row checkbox-row" key={parameter.name}>
            <span>{parameter.name}</span>
            <input
              type="checkbox"
              checked={preview.boolParameters[parameter.name] === true}
              onChange={(event) => setPreview((current) => setPreviewBool(current, parameter.name, event.target.checked))}
            />
          </label>
        ) : (
          <button className="wide-action" type="button" key={parameter.name} onClick={() => setPreview((current) => firePreviewTrigger(current, parameter.name))}>
            {t('common.play')} {parameter.name}
          </button>
        )
      ))}
    </section>
  );
}

function StateMachineEditor({
  machine,
  document,
  updateDocument,
  setSelection,
  setStatus
}: {
  machine: Suwol2DStateMachine;
  document: Suwol2DDocument;
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void;
  setSelection: (selection: Selection | null) => void;
  setStatus: (status: string) => void;
}) {
  const { t } = useI18n();
  const animationOptions = document.animations.map((animation) => animation.name);
  const stateOptions = machine.states.map((state) => state.name);
  const transitionFromOptions = ['*', ...stateOptions];
  const parameterOptions = machine.parameters.map((parameter) => parameter.name);

  const updateMachine = (updater: (machine: Suwol2DStateMachine) => void) => {
    updateDocument((draft) => {
      const draftMachine = findStateMachine(draft, machine.name);
      updater(draftMachine);
    });
  };

  return (
    <section className="inspector-section state-machine-editor">
      <h2>{t('inspector.stateMachine')}</h2>
      <TextField label={t('inspector.name')} value={machine.name} onChange={(value) => renameStateMachine(document, updateDocument, machine.name, value, setSelection, setStatus)} />
      <SelectField label={t('stateMachine.initial')} value={machine.initialState} options={stateOptions} onChange={(value) => updateMachine((draftMachine) => { draftMachine.initialState = value; })} />

      <h3>{t('stateMachine.states')}</h3>
      <button className="wide-action" type="button" onClick={() => updateMachine((draftMachine) => addStateMachineState(draftMachine, animationOptions[0] ?? ''))}>{t('stateMachine.addState')}</button>
      {machine.states.map((state, stateIndex) => (
        <div className="state-machine-card" key={`${machine.name}-state-${stateIndex}`}>
          <TextField label={t('inspector.name')} value={state.name} onChange={(value) => updateMachine((draftMachine) => renameStateMachineState(draftMachine, state.name, value, setStatus))} />
          <SelectField label={t('inspector.animation')} value={state.animation} options={animationOptions} onChange={(value) => updateMachine((draftMachine) => { draftMachine.states[stateIndex].animation = value; })} />
          <label className="field-row checkbox-row">
            <span>{t('common.loop')}</span>
            <input type="checkbox" checked={state.loop} onChange={(event) => updateMachine((draftMachine) => { draftMachine.states[stateIndex].loop = event.target.checked; })} />
          </label>
          <NumberField label={t('timeline.speed')} value={state.speed} onChange={(value) => updateMachine((draftMachine) => { draftMachine.states[stateIndex].speed = Math.max(0, value); })} />
          <button type="button" onClick={() => updateMachine((draftMachine) => deleteStateMachineState(draftMachine, state.name))}>{t('stateMachine.deleteState')}</button>
        </div>
      ))}

      <h3>{t('stateMachine.parameters')}</h3>
      <button className="wide-action" type="button" onClick={() => updateMachine(addStateMachineParameter)}>{t('stateMachine.addParameter')}</button>
      {machine.parameters.map((parameter, parameterIndex) => (
        <div className="state-machine-card" key={`${machine.name}-parameter-${parameterIndex}`}>
          <TextField label={t('inspector.name')} value={parameter.name} onChange={(value) => updateMachine((draftMachine) => renameStateMachineParameter(draftMachine, parameter.name, value, setStatus))} />
          <SelectField
            label={t('inspector.type')}
            value={parameter.type}
            options={['bool', 'trigger']}
            onChange={(value) => updateMachine((draftMachine) => {
              const draftParameter = draftMachine.parameters[parameterIndex];
              draftParameter.type = value === 'trigger' ? 'trigger' : 'bool';
              if (draftParameter.type === 'trigger') {
                delete draftParameter.defaultBool;
              } else {
                draftParameter.defaultBool ??= false;
              }
              normalizeConditionsForParameter(draftMachine, draftParameter.name, draftParameter.type);
            })}
          />
          {parameter.type === 'bool' && (
            <label className="field-row checkbox-row">
              <span>{t('stateMachine.default')}</span>
              <input type="checkbox" checked={parameter.defaultBool === true} onChange={(event) => updateMachine((draftMachine) => { draftMachine.parameters[parameterIndex].defaultBool = event.target.checked; })} />
            </label>
          )}
          <button type="button" onClick={() => updateMachine((draftMachine) => deleteStateMachineParameter(draftMachine, parameter.name))}>{t('stateMachine.deleteParameter')}</button>
        </div>
      ))}

      <h3>{t('stateMachine.transitions')}</h3>
      <button className="wide-action" type="button" onClick={() => updateMachine(addStateMachineTransition)}>{t('stateMachine.addTransition')}</button>
      {machine.transitions.map((transition, transitionIndex) => (
        <div className="state-machine-card" key={`${machine.name}-transition-${transitionIndex}`}>
          <SelectField label={t('stateMachine.from')} value={transition.from} options={transitionFromOptions} onChange={(value) => updateMachine((draftMachine) => { draftMachine.transitions[transitionIndex].from = value; })} />
          <SelectField label={t('stateMachine.to')} value={transition.to} options={stateOptions} onChange={(value) => updateMachine((draftMachine) => { draftMachine.transitions[transitionIndex].to = value; })} />
          <NumberField label={t('stateMachine.fade')} value={transition.fadeDuration} onChange={(value) => updateMachine((draftMachine) => { draftMachine.transitions[transitionIndex].fadeDuration = Math.max(0, value); })} />
          <button type="button" onClick={() => updateMachine((draftMachine) => addStateMachineCondition(draftMachine, transitionIndex))}>{t('stateMachine.addCondition')}</button>
          <button type="button" onClick={() => updateMachine((draftMachine) => { draftMachine.transitions.splice(transitionIndex, 1); })}>{t('stateMachine.deleteTransition')}</button>
          {(transition.conditions ?? []).map((condition, conditionIndex) => {
            const parameter = machine.parameters.find((candidate) => candidate.name === condition.parameter);
            return (
              <div className="condition-row" key={`${transitionIndex}-condition-${conditionIndex}`}>
                <select value={condition.parameter} onChange={(event) => updateMachine((draftMachine) => updateStateMachineConditionParameter(draftMachine, transitionIndex, conditionIndex, event.target.value))}>
                  {parameterOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select value={condition.mode} onChange={(event) => updateMachine((draftMachine) => { draftMachine.transitions[transitionIndex].conditions[conditionIndex].mode = event.target.value === 'triggered' ? 'triggered' : 'equals'; })}>
                  <option value="equals">{t('stateMachine.equals')}</option>
                  <option value="triggered">{t('stateMachine.triggered')}</option>
                </select>
                {parameter?.type === 'bool' && condition.mode === 'equals' && (
                  <label className="mini-checkbox">
                    <input type="checkbox" checked={condition.boolValue === true} onChange={(event) => updateMachine((draftMachine) => { draftMachine.transitions[transitionIndex].conditions[conditionIndex].boolValue = event.target.checked; })} />
                    <span>{t('common.true')}</span>
                  </label>
                )}
                <button type="button" onClick={() => updateMachine((draftMachine) => { draftMachine.transitions[transitionIndex].conditions.splice(conditionIndex, 1); })}>
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}

function Inspector({
  document,
  images,
  selection,
  activeSkinName,
  setActiveSkinName,
  currentAnimation,
  updateDocument,
  setSelection,
  setCurrentAnimationName,
  setStatus,
  duplicateSkin,
  deleteSkin
}: {
  document: Suwol2DDocument;
  images: ImportedImage[];
  selection: Selection | null;
  activeSkinName: string;
  setActiveSkinName: (name: string) => void;
  currentAnimation: Suwol2DAnimation | undefined;
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void;
  setSelection: (selection: Selection | null) => void;
  setCurrentAnimationName: (name: string) => void;
  setStatus: (status: string) => void;
  duplicateSkin: (name: string) => void;
  deleteSkin: (name: string) => void;
}) {
  const { t } = useI18n();
  if (!selection) {
    return (
      <section className="inspector-section">
        <h2>{t('inspector.document')}</h2>
        <TextField label={t('inspector.name')} value={document.name} onChange={(value) => updateDocument((draft) => { draft.name = value; })} />
      </section>
    );
  }

  if (selection.type === 'image') {
    const image = images.find((candidate) => candidate.name === selection.name);
    return (
      <section className="inspector-section">
        <h2>{t('inspector.image')}</h2>
        <ReadonlyRow label={t('inspector.name')} value={image?.name ?? selection.name} />
        <ReadonlyRow label={t('inspector.path')} value={image?.relativePath ?? ''} />
        <ReadonlyRow label={t('inspector.size')} value={image ? `${image.width} x ${image.height}` : ''} />
      </section>
    );
  }

  if (selection.type === 'bone') {
    const bone = document.bones.find((candidate) => candidate.name === selection.name);
    if (!bone) return null;
    return (
      <section className="inspector-section">
        <h2>{t('inspector.bone')}</h2>
        <TextField label={t('inspector.name')} value={bone.name} onChange={(value) => renameBone(document, updateDocument, bone.name, value, setSelection, setStatus)} />
        <SelectField
          label={t('inspector.parent')}
          value={bone.parent}
          options={['', ...document.bones.filter((candidate) => candidate.name !== bone.name).map((candidate) => candidate.name)]}
          onChange={(value) => updateDocument((draft) => { findBone(draft, bone.name).parent = value; })}
        />
        <NumberField label="X" value={bone.x} onChange={(value) => updateDocument((draft) => { findBone(draft, bone.name).x = value; })} />
        <NumberField label="Y" value={bone.y} onChange={(value) => updateDocument((draft) => { findBone(draft, bone.name).y = value; })} />
        <NumberField label={t('inspector.rotation')} value={bone.rotation} onChange={(value) => updateDocument((draft) => { findBone(draft, bone.name).rotation = value; })} />
        <NumberField label={t('inspector.scaleX')} value={bone.scaleX} onChange={(value) => updateDocument((draft) => { findBone(draft, bone.name).scaleX = value; })} />
        <NumberField label={t('inspector.scaleY')} value={bone.scaleY} onChange={(value) => updateDocument((draft) => { findBone(draft, bone.name).scaleY = value; })} />
        <NumberField label={t('inspector.length')} value={bone.length ?? estimateBoneLength(document, bone.name)} onChange={(value) => updateDocument((draft) => { findBone(draft, bone.name).length = Math.max(0, value); })} />
      </section>
    );
  }

  if (selection.type === 'slot') {
    const slot = document.slots.find((candidate) => candidate.name === selection.name);
    if (!slot) return null;
    const slotAttachmentOptions = uniqueValues([
      '',
      ...getAttachmentsForSlot(document, activeSkinName, slot.name).map((attachment) => attachment.name),
      ...getAttachmentsForSlot(document, defaultSkinName, slot.name).map((attachment) => attachment.name)
    ]);
    return (
      <section className="inspector-section">
        <h2>{t('inspector.slot')}</h2>
        <TextField label={t('inspector.name')} value={slot.name} onChange={(value) => renameSlot(document, updateDocument, slot.name, value, setSelection, setStatus)} />
        <SelectField label={t('inspector.bone')} value={slot.bone} options={document.bones.map((bone) => bone.name)} onChange={(value) => updateDocument((draft) => { findSlot(draft, slot.name).bone = value; })} />
        <SelectField label={t('inspector.attachment')} value={slot.attachment} options={slotAttachmentOptions} onChange={(value) => updateDocument((draft) => { findSlot(draft, slot.name).attachment = value; })} />
        <NumberField label={t('inspector.drawOrder')} value={slot.drawOrder} onChange={(value) => updateDocument((draft) => { findSlot(draft, slot.name).drawOrder = value; })} />
        <div className="inspector-action-row">
          <button type="button" onClick={() => moveSlotDrawOrder(document, updateDocument, slot.name, -1)}>
            <ArrowUp size={14} /> {t('inspector.moveUp')}
          </button>
          <button type="button" onClick={() => moveSlotDrawOrder(document, updateDocument, slot.name, 1)}>
            <ArrowDown size={14} /> {t('inspector.moveDown')}
          </button>
        </div>
        <button className="wide-action" type="button" onClick={() => normalizeSlotDrawOrder(updateDocument)}>
          {t('inspector.normalizeDrawOrder')}
        </button>
      </section>
    );
  }

  if (selection.type === 'skin') {
    const skin = getEffectiveSkins(document).find((candidate) => candidate.name === selection.name);
    if (!skin) return null;
    return (
      <section className="inspector-section">
        <h2>{t('inspector.skin')}</h2>
        <TextField label={t('inspector.name')} value={skin.name} onChange={(value) => renameSkin(document, updateDocument, skin.name, value, setSelection, setActiveSkinName, setStatus)} />
        <ReadonlyRow label={t('common.active')} value={activeSkinName === skin.name ? t('common.yes') : t('common.no')} />
        <ReadonlyRow label={t('panel.attachments')} value={String(skin.attachments.length)} />
        <button className="wide-action" type="button" onClick={() => { setActiveSkinName(skin.name); setSelection({ type: 'skin', name: skin.name }); }}>
          {t('inspector.setActiveSkin')}
        </button>
        <div className="inspector-action-row">
          <button type="button" onClick={() => duplicateSkin(skin.name)}>{t('inspector.duplicateSkin')}</button>
          <button type="button" disabled={skin.name === defaultSkinName} onClick={() => deleteSkin(skin.name)}>{t('inspector.deleteSkin')}</button>
        </div>
      </section>
    );
  }

  if (selection.type === 'attachment') {
    const attachment = findAttachmentForEdit(document, activeSkinName, selection.name);
    if (!attachment) return null;
    const otherSkins = getEffectiveSkins(document).filter((skin) => skin.name !== activeSkinName);
    return (
      <section className="inspector-section">
        <h2>{t('inspector.attachment')}</h2>
        <TextField label={t('inspector.name')} value={attachment.name} onChange={(value) => renameAttachment(document, activeSkinName, updateDocument, attachment.name, value, setSelection, setStatus)} />
        <SelectField
          label={t('inspector.type')}
          value={attachment.type}
          options={['region', 'mesh']}
          onChange={(value) => updateDocument((draft) => {
            const current = findAttachmentInSkinForEdit(draft, activeSkinName, attachment.name);
            const image = images.find((candidate) => candidate.name === current.image) ?? images[0];
            replaceAttachmentInSkin(
              draft,
              activeSkinName,
              current.name,
              value === 'mesh'
                ? convertToMeshAttachment(current, image)
                : convertToRegionAttachment(current, image)
            );
            if (value !== 'mesh') {
              removeDeformTimelinesForAttachment(draft, current.name);
            }
          })}
        />
        <SelectField label={t('inspector.slot')} value={attachment.slot} options={document.slots.map((slot) => slot.name)} onChange={(value) => updateDocument((draft) => { findAttachmentInSkinForEdit(draft, activeSkinName, attachment.name).slot = value; })} />
        <SelectField label={t('inspector.image')} value={attachment.image} options={images.map((image) => image.name)} onChange={(value) => updateDocument((draft) => { findAttachmentInSkinForEdit(draft, activeSkinName, attachment.name).image = value; })} />
        <NumberField label="X" value={attachment.x} onChange={(value) => updateDocument((draft) => { findAttachmentInSkinForEdit(draft, activeSkinName, attachment.name).x = value; })} />
        <NumberField label="Y" value={attachment.y} onChange={(value) => updateDocument((draft) => { findAttachmentInSkinForEdit(draft, activeSkinName, attachment.name).y = value; })} />
        <NumberField label={t('inspector.rotation')} value={attachment.rotation} onChange={(value) => updateDocument((draft) => { findAttachmentInSkinForEdit(draft, activeSkinName, attachment.name).rotation = value; })} />
        <NumberField label={t('inspector.scaleX')} value={attachment.scaleX} onChange={(value) => updateDocument((draft) => { findAttachmentInSkinForEdit(draft, activeSkinName, attachment.name).scaleX = value; })} />
        <NumberField label={t('inspector.scaleY')} value={attachment.scaleY} onChange={(value) => updateDocument((draft) => { findAttachmentInSkinForEdit(draft, activeSkinName, attachment.name).scaleY = value; })} />
        {attachment.type === 'region' ? (
          <>
            <NumberField label={t('inspector.width')} value={attachment.width} onChange={(value) => updateDocument((draft) => { findRegionAttachmentForEdit(draft, activeSkinName, attachment.name).width = value; })} />
            <NumberField label={t('inspector.height')} value={attachment.height} onChange={(value) => updateDocument((draft) => { findRegionAttachmentForEdit(draft, activeSkinName, attachment.name).height = value; })} />
          </>
        ) : (
          <MeshAttachmentFields
            attachment={attachment}
            document={document}
            images={images}
            activeSkinName={activeSkinName}
            updateDocument={updateDocument}
          />
        )}
        {otherSkins.length > 0 && (
          <>
            <h3>{t('inspector.copyToSkin')}</h3>
            <div className="inspector-action-row wrap">
              {otherSkins.map((skin) => (
                <button
                  key={skin.name}
                  type="button"
                  onClick={() => copyAttachmentToSkin(document, updateDocument, activeSkinName, attachment.name, skin.name, setStatus)}
                >
                  {skin.name}
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    );
  }

  if (selection.type === 'meshVertex') {
    const attachment = findAttachmentForEdit(document, activeSkinName, selection.attachment);
    return (
      <section className="inspector-section">
        <h2>{t('inspector.meshVertex')}</h2>
        <ReadonlyRow label={t('inspector.attachment')} value={attachment?.name ?? selection.attachment} />
        <ReadonlyRow label={t('inspector.vertex')} value={String(selection.vertex)} />
      </section>
    );
  }

  if (selection.type === 'deformKey') {
    return (
      <section className="inspector-section">
        <h2>{t('inspector.deformKey')}</h2>
        <ReadonlyRow label={t('inspector.animation')} value={selection.animation} />
        <ReadonlyRow label={t('inspector.attachment')} value={selection.attachment} />
        <ReadonlyRow label={t('toolbar.time')} value={String(selection.time)} />
      </section>
    );
  }

  if (selection.type === 'ikConstraint') {
    const constraint = (document.ikConstraints ?? []).find((candidate) => candidate.name === selection.name);
    if (!constraint) return null;
    const boneOptions = document.bones.map((bone) => bone.name);
    return (
      <section className="inspector-section">
        <h2>{t('inspector.ikConstraint')}</h2>
        <TextField label={t('inspector.name')} value={constraint.name} onChange={(value) => renameIkConstraint(document, updateDocument, constraint.name, value, setSelection, setStatus)} />
        <label className="field-row checkbox-row">
          <span>{t('inspector.enabled')}</span>
          <input type="checkbox" checked={constraint.enabled} onChange={(event) => updateDocument((draft) => { findIkConstraint(draft, constraint.name).enabled = event.target.checked; })} />
        </label>
        <SelectField label={t('inspector.parent')} value={constraint.parentBone} options={boneOptions} onChange={(value) => updateDocument((draft) => { findIkConstraint(draft, constraint.name).parentBone = value; })} />
        <SelectField label={t('inspector.child')} value={constraint.childBone} options={boneOptions} onChange={(value) => updateDocument((draft) => { findIkConstraint(draft, constraint.name).childBone = value; })} />
        <SelectField label={t('inspector.target')} value={constraint.targetBone} options={boneOptions} onChange={(value) => updateDocument((draft) => { findIkConstraint(draft, constraint.name).targetBone = value; })} />
        <NumberField label={t('inspector.mix')} value={constraint.mix} onChange={(value) => updateDocument((draft) => { findIkConstraint(draft, constraint.name).mix = Math.max(0, Math.min(1, value)); })} />
        <SelectField
          label={t('inspector.bend')}
          value={String(constraint.bendDirection)}
          options={['1', '-1']}
          onChange={(value) => updateDocument((draft) => { findIkConstraint(draft, constraint.name).bendDirection = value === '-1' ? -1 : 1; })}
        />
        <NumberField label={t('inspector.order')} value={constraint.order} onChange={(value) => updateDocument((draft) => { findIkConstraint(draft, constraint.name).order = Math.trunc(value); })} />
      </section>
    );
  }

  if (selection.type === 'stateMachine') {
    const machine = (document.stateMachines ?? []).find((candidate) => candidate.name === selection.name);
    if (!machine) return null;
    return (
      <StateMachineEditor
        machine={machine}
        document={document}
        updateDocument={updateDocument}
        setSelection={setSelection}
        setStatus={setStatus}
      />
    );
  }

  if (selection.type !== 'animation') {
    return null;
  }

  const animation = currentAnimation;
  if (!animation) return null;
  return (
    <section className="inspector-section">
      <h2>{t('inspector.animation')}</h2>
      <TextField
        label="Name"
        value={animation.name}
        onChange={(value) => renameAnimation(document, updateDocument, animation.name, value, setSelection, setCurrentAnimationName, setStatus)}
      />
      <label className="field-row checkbox-row">
        <span>{t('common.loop')}</span>
        <input type="checkbox" checked={animation.loop} onChange={(event) => updateDocument((draft) => { findAnimation(draft, animation.name).loop = event.target.checked; })} />
      </label>
      <NumberField
        label="Duration"
        value={animation.duration ?? getAnimationDuration(animation)}
        onChange={(value) => updateDocument((draft) => {
          const target = findAnimation(draft, animation.name);
          target.duration = Number.isFinite(value) && value > 0 ? value : undefined;
        })}
      />
    </section>
  );
}

type CanvasDragState =
  | { kind: 'pan'; pointerId: number; x: number; y: number }
  | {
    kind: 'moveVertex';
    pointerId: number;
    attachmentName: string;
    vertices: number[];
    lastLocal: Point2D;
    transform: AttachmentCanvasTransform;
    mutated: boolean;
  }
  | { kind: 'weightBrush'; pointerId: number; attachmentName: string; mutated: boolean }
  | {
    kind: 'deformBrush';
    pointerId: number;
    attachmentName: string;
    lastLocal: Point2D;
    transform: AttachmentCanvasTransform;
    mutated: boolean;
  };

function CanvasPreview({
  document,
  images,
  activeSkinName,
  animationName,
  time,
  previewMix,
  lastEvent,
  selection,
  selectedVertices,
  setSelection,
  setSelectedVertices,
  toolMode,
  setToolMode,
  brushSettings,
  setBrushSettings,
  activeMeshName,
  deformTime,
  updateDocument,
  setLocalizedStatus
}: {
  document: Suwol2DDocument;
  images: ImportedImage[];
  activeSkinName: string;
  animationName: string;
  time: number;
  previewMix: PreviewAnimationMix | null;
  lastEvent: string;
  selection: Selection | null;
  selectedVertices: CanvasVertexSelection | null;
  setSelection: (selection: Selection | null) => void;
  setSelectedVertices: Dispatch<SetStateAction<CanvasVertexSelection | null>>;
  toolMode: CanvasToolMode;
  setToolMode: (mode: CanvasToolMode) => void;
  brushSettings: CanvasBrushSettings;
  setBrushSettings: Dispatch<SetStateAction<CanvasBrushSettings>>;
  activeMeshName: string;
  deformTime: number;
  updateDocument: (updater: (document: Suwol2DDocument) => void, trackHistory?: boolean) => void;
  setLocalizedStatus: (key: TranslationKey, params?: TranslationParams) => void;
}) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCache = useRef(new Map<string, HTMLImageElement>());
  const dragState = useRef<CanvasDragState | null>(null);
  const [view, setView] = useState<PreviewView>(defaultPreviewView);
  const [hoverPoint, setHoverPoint] = useState<Point2D | null>(null);
  const [spacePanActive, setSpacePanActive] = useState(false);
  const effectiveToolMode = spacePanActive ? 'pan' : toolMode;

  useEffect(() => {
    let cancelled = false;
    const loadImages = async () => {
      await Promise.all(
        images.map((image) => {
          if (!image.dataUrl || imageCache.current.has(image.name)) return Promise.resolve();
          return new Promise<void>((resolve) => {
            const element = new Image();
            element.onload = () => {
              imageCache.current.set(image.name, element);
              resolve();
            };
            element.onerror = () => resolve();
            element.src = image.dataUrl ?? '';
          });
        })
      );
      if (!cancelled) drawPreview();
    };
    void loadImages();
    return () => {
      cancelled = true;
    };
  }, [images, document, activeSkinName, animationName, time, previewMix, selection, selectedVertices, view, hoverPoint, effectiveToolMode, brushSettings]);

  useEffect(() => {
    drawPreview();
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === ' ') {
        event.preventDefault();
        setSpacePanActive(true);
      } else if (key === 'v') {
        event.preventDefault();
        setToolMode('select');
      } else if (key === 'm') {
        event.preventDefault();
        setToolMode('moveVertex');
      } else if (key === 'w') {
        event.preventDefault();
        setToolMode('weightBrush');
      } else if (key === 'd') {
        event.preventDefault();
        setToolMode('deformBrush');
      } else if (key === 'f') {
        event.preventDefault();
        fitToContent();
      } else if (event.key === '0') {
        event.preventDefault();
        resetView();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        setSpacePanActive(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setToolMode]);

  function resetView() {
    setView(defaultPreviewView);
  }

  function fitToContent() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = getPreviewWorldBounds(document, activeSkinName, animationName, time);
    if (!bounds) {
      resetView();
      return;
    }

    const margin = 80;
    const width = Math.max(0.01, bounds.maxX - bounds.minX);
    const height = Math.max(0.01, bounds.maxY - bounds.minY);
    const zoom = clampZoom(Math.min(
      (canvas.width - margin) / (width * 150),
      (canvas.height - margin) / (height * 150)
    ));
    const centerX = (bounds.minX + bounds.maxX) * 0.5;
    const centerY = (bounds.minY + bounds.maxY) * 0.5;
    setView({
      zoom,
      panX: -centerX * 150 * zoom,
      panY: centerY * 150 * zoom
    });
  }

  function handleWheel(event: ReactWheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = getCanvasPoint(canvas, event);
    setView((current) => {
      const nextZoom = clampZoom(current.zoom * (event.deltaY < 0 ? 1.12 : 0.88));
      const ratio = nextZoom / current.zoom;
      const baseX = canvas.width / 2;
      const baseY = canvas.height / 2;
      return {
        zoom: nextZoom,
        panX: point.x - baseX - (point.x - baseX - current.panX) * ratio,
        panY: point.y - baseY - (point.y - baseY - current.panY) * ratio
      };
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = getCanvasPoint(canvas, event);
    setHoverPoint(point);

    if (event.button === 1 || event.button === 2 || effectiveToolMode === 'pan') {
      event.preventDefault();
      dragState.current = { kind: 'pan', pointerId: event.pointerId, x: point.x, y: point.y };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const targets = getVisibleMeshTargets();
    if (effectiveToolMode === 'select' || effectiveToolMode === 'moveVertex') {
      const hit = hitTestMeshVertex(targets, point, 12);
      if (!hit) {
        if (!event.shiftKey) {
          setSelectedVertices(null);
          setSelection(null);
        }
        return;
      }

      event.preventDefault();
      const nextSelection = updateCanvasVertexSelection(selectedVertices, hit.attachmentName, hit.vertex, event.shiftKey);
      setSelectedVertices(nextSelection);
      setSelection(nextSelection ? { type: 'meshVertex', attachment: hit.attachmentName, vertex: hit.vertex } : null);

      if (effectiveToolMode === 'moveVertex' && nextSelection?.vertices.length) {
        dragState.current = {
          kind: 'moveVertex',
          pointerId: event.pointerId,
          attachmentName: hit.attachmentName,
          vertices: nextSelection.vertices,
          lastLocal: canvasToAttachmentLocal(point, hit.transform),
          transform: hit.transform,
          mutated: false
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      return;
    }

    const activeTarget = getActiveMeshTarget(targets);
    if (!activeTarget) {
      setLocalizedStatus('canvas.vertex.noMeshSelected');
      return;
    }

    if (effectiveToolMode === 'weightBrush') {
      event.preventDefault();
      if (!brushSettings.boneName) {
        setLocalizedStatus('canvas.brush.noBoneSelected');
        return;
      }

      const changed = applyWeightBrushAtPoint(activeTarget, point, true);
      dragState.current = {
        kind: 'weightBrush',
        pointerId: event.pointerId,
        attachmentName: activeTarget.attachment.name,
        mutated: changed
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (effectiveToolMode === 'deformBrush') {
      event.preventDefault();
      if (!animationName) {
        setLocalizedStatus('canvas.deform.noAnimationSelected');
        return;
      }

      dragState.current = {
        kind: 'deformBrush',
        pointerId: event.pointerId,
        attachmentName: activeTarget.attachment.name,
        lastLocal: canvasToAttachmentLocal(point, activeTarget.transform),
        transform: activeTarget.transform,
        mutated: false
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = getCanvasPoint(canvas, event);
    setHoverPoint(point);

    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (drag.kind === 'pan') {
      const deltaX = point.x - drag.x;
      const deltaY = point.y - drag.y;
      dragState.current = { ...drag, x: point.x, y: point.y };
      setView((current) => ({
        ...current,
        panX: current.panX + deltaX,
        panY: current.panY + deltaY
      }));
      return;
    }

    const targets = getVisibleMeshTargets();
    const target = targets.find((candidate) => candidate.attachment.name === drag.attachmentName);
    if (!target) {
      return;
    }

    if (drag.kind === 'moveVertex') {
      const currentLocal = canvasToAttachmentLocal(point, drag.transform);
      const deltaX = currentLocal.x - drag.lastLocal.x;
      const deltaY = currentLocal.y - drag.lastLocal.y;
      if (Math.hypot(deltaX, deltaY) <= 0.000001) {
        return;
      }

      updateDocument((draft) => {
        const mesh = findMeshAttachmentForEdit(draft, activeSkinName, drag.attachmentName);
        for (const vertexIndex of drag.vertices) {
          const vertex = mesh.vertices[vertexIndex];
          if (!vertex) continue;
          vertex.x = round(vertex.x + deltaX);
          vertex.y = round(vertex.y + deltaY);
        }
      }, !drag.mutated);
      dragState.current = { ...drag, lastLocal: currentLocal, mutated: true };
      return;
    }

    if (drag.kind === 'weightBrush') {
      const changed = applyWeightBrushAtPoint(target, point, !drag.mutated);
      if (changed) {
        dragState.current = { ...drag, mutated: true };
      }
      return;
    }

    if (drag.kind === 'deformBrush') {
      const currentLocal = canvasToAttachmentLocal(point, drag.transform);
      const deltaX = (currentLocal.x - drag.lastLocal.x) * sanitizeBrushStrength(brushSettings.strength);
      const deltaY = (currentLocal.y - drag.lastLocal.y) * sanitizeBrushStrength(brushSettings.strength);
      if (Math.hypot(deltaX, deltaY) <= 0.000001) {
        return;
      }

      const changed = applyDeformBrushAtPoint(target, point, deltaX, deltaY, !drag.mutated);
      dragState.current = { ...drag, lastLocal: currentLocal, mutated: drag.mutated || changed };
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (dragState.current?.pointerId === event.pointerId) {
      dragState.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handlePointerLeave() {
    if (!dragState.current) {
      setHoverPoint(null);
    }
  }

  function getActiveMeshTarget(targets: CanvasMeshTarget[]): CanvasMeshTarget | null {
    if (!activeMeshName) {
      return null;
    }

    return targets.find((target) => target.attachment.name === activeMeshName) ?? null;
  }

  function applyWeightBrushAtPoint(target: CanvasMeshTarget, point: Point2D, trackHistory: boolean): boolean {
    const vertexFalloffs = collectBrushVertexFalloffs(target, point, sanitizeBrushRadius(brushSettings.radius));
    if (vertexFalloffs.length === 0) {
      return false;
    }

    let changed = false;
    updateDocument((draft) => {
      const mesh = findMeshAttachmentForEdit(draft, activeSkinName, target.attachment.name);
      changed = applyWeightBrush(mesh, {
        boneName: brushSettings.boneName,
        vertexFalloffs,
        strength: sanitizeBrushStrength(brushSettings.strength),
        erase: brushSettings.eraseMode,
        normalizeAfterPaint: brushSettings.normalizeAfterPaint
      });
    }, trackHistory);
    return changed || vertexFalloffs.length > 0;
  }

  function applyDeformBrushAtPoint(target: CanvasMeshTarget, point: Point2D, deltaX: number, deltaY: number, trackHistory: boolean): boolean {
    const vertexFalloffs = collectBrushVertexFalloffs(target, point, sanitizeBrushRadius(brushSettings.radius));
    if (vertexFalloffs.length === 0) {
      return false;
    }

    const currentAnimation = document.animations.find((candidate) => candidate.name === animationName);
    const currentTimeline = currentAnimation?.deforms?.find((candidate) => (
      candidate.slot === target.attachment.slot && candidate.attachment === target.attachment.name
    ));
    const willCreateKey = !currentTimeline || !currentTimeline.keys.some((candidate) => Math.abs(candidate.time - round(deformTime)) < 0.0001);
    let changed = false;
    updateDocument((draft) => {
      const animation = draft.animations.find((candidate) => candidate.name === animationName);
      if (!animation) {
        return;
      }

      const mesh = findMeshAttachmentForEdit(draft, activeSkinName, target.attachment.name);
      const result = getOrCreateDeformBrushKey(animation, mesh, deformTime);
      changed = applyDeformBrush(result.key, vertexFalloffs, deltaX, deltaY);
    }, trackHistory);

    if (willCreateKey && trackHistory) {
      setLocalizedStatus('canvas.deform.keyCreated');
    }
    return changed || vertexFalloffs.length > 0;
  }

  function getVisibleMeshTargets(): CanvasMeshTarget[] {
    const canvas = canvasRef.current;
    if (!canvas) {
      return [];
    }

    const frame = { width: canvas.width, height: canvas.height, view };
    const animation = document.animations.find((candidate) => candidate.name === animationName);
    const pose = previewMix ? sampleMixedDocumentPose(document, previewMix) : sampleDocumentPose(document, animationName, time);
    const attachmentOverrides = previewMix ? sampleMixedAttachmentOverrides(document, previewMix) : sampleAttachmentOverrides(animation, time);
    const slots = previewMix ? sampleMixedDrawOrder(document, previewMix) : sampleDrawOrder(document, animation, time);
    const targets: CanvasMeshTarget[] = [];

    for (const slot of slots) {
      const override = attachmentOverrides.get(slot.name);
      if (attachmentOverrides.has(slot.name) && !override) {
        continue;
      }

      const attachment = attachmentOverrides.has(slot.name)
        ? resolveExactSlotAttachment(document, activeSkinName, slot.name, override ?? '')
        : resolveSlotAttachment(document, activeSkinName, slot.name, slot.attachment);
      if (!attachment || attachment.type !== 'mesh') {
        continue;
      }

      const bone = pose.get(slot.bone);
      if (!bone) {
        continue;
      }

      const deformOffsets = previewMix
        ? sampleMixedDeformOffsets(document, previewMix, attachment.slot, attachment.name, attachment.vertices.length)
        : sampleDeformOffsets(animation, attachment.slot, attachment.name, attachment.vertices.length, time);
      targets.push({
        attachment,
        deformOffsets,
        transform: getAttachmentCanvasTransform(bone, attachment, frame)
      });
    }

    return targets;
  }

  function drawPreview() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2 + view.panX;
    const centerY = height / 2 + view.panY;
    const unitScale = 150 * view.zoom;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101418';
    context.fillRect(0, 0, width, height);
    drawGrid(context, width, height, centerX, centerY);

    const animation = document.animations.find((candidate) => candidate.name === animationName);
    const pose = previewMix ? sampleMixedDocumentPose(document, previewMix) : sampleDocumentPose(document, animationName, time);
    const attachmentOverrides = previewMix ? sampleMixedAttachmentOverrides(document, previewMix) : sampleAttachmentOverrides(animation, time);
    const slots = previewMix ? sampleMixedDrawOrder(document, previewMix) : sampleDrawOrder(document, animation, time);
    for (const slot of slots) {
      const override = attachmentOverrides.get(slot.name);
      if (attachmentOverrides.has(slot.name) && !override) {
        continue;
      }

      const attachment = attachmentOverrides.has(slot.name)
        ? resolveExactSlotAttachment(document, activeSkinName, slot.name, override ?? '')
        : resolveSlotAttachment(document, activeSkinName, slot.name, slot.attachment);
      if (!attachment) continue;
      const bone = pose.get(slot.bone);
      if (!bone) continue;
      const image = findCachedImage(imageCache.current, attachment.image);
      const slotColor = previewMix ? sampleMixedSlotColor(document, previewMix, slot.name) : sampleSlotColor(animation, slot.name, time);

      const offset = rotatePoint(attachment.x * bone.worldScaleX, attachment.y * bone.worldScaleY, bone.worldRotation);
      const x = centerX + (bone.worldX + offset.x) * unitScale;
      const y = centerY - (bone.worldY + offset.y) * unitScale;

      context.save();
      context.translate(x, y);
      context.rotate((-(bone.worldRotation + attachment.rotation) * Math.PI) / 180);
      context.scale(bone.worldScaleX * attachment.scaleX, bone.worldScaleY * attachment.scaleY);
      context.globalAlpha = slotColor.a;
      if (attachment.type === 'region') {
        const drawWidth = attachment.width * unitScale;
        const drawHeight = attachment.height * unitScale;
        if (image) {
          context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
          tintRegionPreview(context, slotColor, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        }
        if (selection?.type === 'attachment' && selection.name === attachment.name) {
          context.globalAlpha = 1;
          context.strokeStyle = '#f2b84b';
          context.lineWidth = 3;
          context.strokeRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        }
      } else {
        const deformOffsets = previewMix
          ? sampleMixedDeformOffsets(document, previewMix, attachment.slot, attachment.name, attachment.vertices.length)
          : sampleDeformOffsets(animation, attachment.slot, attachment.name, attachment.vertices.length, time);
        const highlightedVertices = selectedVertices?.attachment === attachment.name
          ? new Set(selectedVertices.vertices)
          : new Set<number>();
        drawMeshPreview(
          context,
          attachment,
          image,
          unitScale,
          selection?.type === 'attachment' && selection.name === attachment.name,
          deformOffsets,
          highlightedVertices
        );
      }
      context.restore();
    }

    const ikTargets = new Set((document.ikConstraints ?? []).map((constraint) => constraint.targetBone));
    for (const constraint of [...(document.ikConstraints ?? [])].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))) {
      const parent = pose.get(constraint.parentBone);
      const child = pose.get(constraint.childBone);
      const target = pose.get(constraint.targetBone);
      if (!parent || !child || !target) {
        continue;
      }

      context.save();
      context.strokeStyle = constraint.enabled ? '#e879f9' : '#68727d';
      context.lineWidth = selection?.type === 'ikConstraint' && selection.name === constraint.name ? 3 : 1.5;
      context.setLineDash([7, 5]);
      context.beginPath();
      context.moveTo(centerX + parent.worldX * unitScale, centerY - parent.worldY * unitScale);
      context.lineTo(centerX + child.worldX * unitScale, centerY - child.worldY * unitScale);
      context.lineTo(centerX + target.worldX * unitScale, centerY - target.worldY * unitScale);
      context.stroke();
      context.setLineDash([]);
      context.beginPath();
      context.arc(centerX + target.worldX * unitScale, centerY - target.worldY * unitScale, 9, 0, Math.PI * 2);
      context.strokeStyle = '#e879f9';
      context.stroke();
      context.restore();
    }

    for (const bone of pose.values()) {
      const x = centerX + bone.worldX * unitScale;
      const y = centerY - bone.worldY * unitScale;
      if (bone.parent) {
        const parent = pose.get(bone.parent);
        if (parent) {
          context.beginPath();
          context.moveTo(centerX + parent.worldX * unitScale, centerY - parent.worldY * unitScale);
          context.lineTo(x, y);
          context.strokeStyle = '#8fd8cf';
          context.lineWidth = 2;
          context.stroke();
        }
      }
      context.beginPath();
      context.arc(x, y, selection?.type === 'bone' && selection.name === bone.name ? 7 : ikTargets.has(bone.name) ? 6 : 5, 0, Math.PI * 2);
      context.fillStyle = selection?.type === 'bone' && selection.name === bone.name ? '#f2b84b' : ikTargets.has(bone.name) ? '#e879f9' : '#1fb8a6';
      context.fill();
    }

    if ((effectiveToolMode === 'weightBrush' || effectiveToolMode === 'deformBrush') && hoverPoint) {
      context.save();
      context.beginPath();
      context.arc(hoverPoint.x, hoverPoint.y, sanitizeBrushRadius(brushSettings.radius), 0, Math.PI * 2);
      context.strokeStyle = effectiveToolMode === 'weightBrush' ? '#e879f9' : '#f2b84b';
      context.lineWidth = 1.5;
      context.setLineDash([6, 4]);
      context.stroke();
      context.restore();
    }
  }

  return (
    <div className="preview-frame">
      <div className="canvas-tool-panel">
        <div className="canvas-tool-header">
          <span>{t('canvas.tool.current')}: {t(canvasToolTranslationKey(effectiveToolMode))}</span>
          <span>
            {selectedVertices?.vertices.length
              ? t('canvas.vertex.selected', { count: selectedVertices.vertices.length })
              : activeMeshName ? t('canvas.vertex.activeMesh', { name: activeMeshName }) : t('canvas.vertex.noMeshSelected')}
          </span>
        </div>
        <div className="canvas-tool-buttons" role="group" aria-label={t('canvas.tool.current')}>
          {canvasToolModes.map((mode) => (
            <button
              className={toolMode === mode ? 'active' : ''}
              type="button"
              key={mode}
              onClick={() => setToolMode(mode)}
              title={canvasToolShortcutLabel(mode)}
            >
              {t(canvasToolTranslationKey(mode))}
            </button>
          ))}
        </div>
        {(toolMode === 'weightBrush' || toolMode === 'deformBrush') && (
          <div className="canvas-brush-grid">
            {toolMode === 'weightBrush' && (
              <label className="compact-field">
                <span>{t('canvas.brush.bone')}</span>
                <select
                  value={brushSettings.boneName}
                  onChange={(event) => setBrushSettings((current) => ({ ...current, boneName: event.target.value }))}
                >
                  {document.bones.map((bone) => (
                    <option key={bone.name} value={bone.name}>{bone.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="compact-field">
              <span>{t('canvas.brush.radius')}</span>
              <input
                type="number"
                min={4}
                max={240}
                step={1}
                value={sanitizeBrushRadius(brushSettings.radius)}
                onChange={(event) => setBrushSettings((current) => ({ ...current, radius: sanitizeBrushRadius(toNumber(event.target.value, current.radius)) }))}
              />
            </label>
            <label className="compact-field">
              <span>{t('canvas.brush.strength')}</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={sanitizeBrushStrength(brushSettings.strength)}
                onChange={(event) => setBrushSettings((current) => ({ ...current, strength: sanitizeBrushStrength(toNumber(event.target.value, current.strength)) }))}
              />
            </label>
            {toolMode === 'weightBrush' && (
              <>
                <label className="mini-checkbox">
                  <input
                    type="checkbox"
                    checked={brushSettings.normalizeAfterPaint}
                    onChange={(event) => setBrushSettings((current) => ({ ...current, normalizeAfterPaint: event.target.checked }))}
                  />
                  <span>{t('canvas.brush.normalizeAfterPaint')}</span>
                </label>
                <label className="mini-checkbox">
                  <input
                    type="checkbox"
                    checked={brushSettings.eraseMode}
                    onChange={(event) => setBrushSettings((current) => ({ ...current, eraseMode: event.target.checked }))}
                  />
                  <span>{t('canvas.brush.eraseMode')}</span>
                </label>
              </>
            )}
          </div>
        )}
      </div>
      <div className="preview-controls">
        <button type="button" onClick={resetView} title={t('preview.resetView')}>
          <RotateCcw size={15} />
          <span>{t('common.reset')}</span>
        </button>
        <button type="button" onClick={fitToContent} title={t('preview.fitToContent')}>
          <Maximize2 size={15} />
        <span>{t('common.fit')}</span>
        </button>
        <span>{Math.round(view.zoom * 100)}%</span>
        {lastEvent && <span className="last-event-pill">{lastEvent}</span>}
      </div>
      <canvas
        className="preview-canvas"
        ref={canvasRef}
        width={960}
        height={620}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  );
}

function canvasToolTranslationKey(mode: CanvasToolMode): TranslationKey {
  const keys: Record<CanvasToolMode, TranslationKey> = {
    select: 'canvas.tool.select',
    moveVertex: 'canvas.tool.moveVertex',
    weightBrush: 'canvas.tool.weightBrush',
    deformBrush: 'canvas.tool.deformBrush',
    pan: 'canvas.tool.pan'
  };
  return keys[mode];
}

function canvasToolShortcutLabel(mode: CanvasToolMode): string {
  const shortcuts: Record<CanvasToolMode, string> = {
    select: 'V',
    moveVertex: 'M',
    weightBrush: 'W',
    deformBrush: 'D',
    pan: 'Space'
  };
  return shortcuts[mode];
}

function TimelineTransport({
  animations,
  currentAnimationName,
  currentAnimation,
  currentTime,
  duration,
  playbackSpeed,
  isPlaying,
  loop,
  snapEnabled,
  snapStep,
  timelineFilter,
  timelineSearch,
  onAnimationChange,
  onTimeChange,
  onDurationChange,
  onLoopChange,
  onPlaybackSpeedChange,
  onPlayToggle,
  onSnapEnabledChange,
  onSnapStepChange,
  onFilterChange,
  onSearchChange
}: {
  animations: Suwol2DAnimation[];
  currentAnimationName: string;
  currentAnimation: Suwol2DAnimation | undefined;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  isPlaying: boolean;
  loop: boolean;
  snapEnabled: boolean;
  snapStep: number;
  timelineFilter: TimelineKeyFilter;
  timelineSearch: string;
  onAnimationChange: (name: string) => void;
  onTimeChange: (value: number) => void;
  onDurationChange: (value: number) => void;
  onLoopChange: (value: boolean) => void;
  onPlaybackSpeedChange: (value: number) => void;
  onPlayToggle: () => void;
  onSnapEnabledChange: (value: boolean) => void;
  onSnapStepChange: (value: number) => void;
  onFilterChange: (value: TimelineKeyFilter) => void;
  onSearchChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const sliderMax = Math.max(duration, currentTime, 1);
  const durationInput = currentAnimation?.duration ?? duration;

  return (
    <section className="timeline-transport">
      <div className="timeline-control-grid">
        <label className="compact-field">
          <span>{t('inspector.animation')}</span>
          <select value={currentAnimationName} onChange={(event) => onAnimationChange(event.target.value)}>
            <option value="">{t('timeline.noAnimation')}</option>
            {animations.map((animation) => <option key={animation.name} value={animation.name}>{animation.name}</option>)}
          </select>
        </label>
        <label className="compact-field">
          <span>{t('timeline.currentTime')}</span>
          <input type="number" min={0} step={snapStep} value={round(currentTime)} onChange={(event) => onTimeChange(toNumber(event.target.value, currentTime))} />
        </label>
        <label className="compact-field">
          <span>{t('timeline.duration')}</span>
          <input type="number" min={0} step={snapStep} value={round(durationInput)} onChange={(event) => onDurationChange(toNumber(event.target.value, durationInput))} disabled={!currentAnimation} />
        </label>
        <label className="compact-field">
          <span>{t('timeline.speed')}</span>
          <input type="number" min={0} step={0.1} value={round(playbackSpeed)} onChange={(event) => onPlaybackSpeedChange(toNumber(event.target.value, playbackSpeed))} />
        </label>
        <label className="compact-field">
          <span>{t('timeline.filter')}</span>
          <select value={timelineFilter} onChange={(event) => onFilterChange(event.target.value as TimelineKeyFilter)}>
            <option value="all">{t('timeline.all')}</option>
            <option value="bone">{t('timeline.bone')}</option>
            <option value="deform">{t('timeline.deform')}</option>
            <option value="attachment">{t('timeline.attachment')}</option>
            <option value="drawOrder">{t('timeline.drawOrder')}</option>
            <option value="slotColor">{t('timeline.slotColor')}</option>
            <option value="event">{t('timeline.event')}</option>
          </select>
        </label>
        <label className="compact-field">
          <span>{t('common.search')}</span>
          <input type="search" value={timelineSearch} onChange={(event) => onSearchChange(event.target.value)} />
        </label>
      </div>

      <div className="timeline-scrubber">
        <button type="button" onClick={() => onTimeChange(0)}>{t('common.home')}</button>
        <input type="range" min={0} max={sliderMax} step={snapStep} value={Math.min(currentTime, sliderMax)} onChange={(event) => onTimeChange(toNumber(event.target.value, currentTime))} />
        <button type="button" onClick={() => onTimeChange(duration)}>{t('common.end')}</button>
        <button type="button" onClick={onPlayToggle}>{isPlaying ? t('common.stop') : t('common.play')}</button>
        <label className="mini-checkbox">
          <input type="checkbox" checked={loop} onChange={(event) => onLoopChange(event.target.checked)} disabled={!currentAnimation} />
          <span>{t('common.loop')}</span>
        </label>
        <label className="mini-checkbox">
          <input type="checkbox" checked={snapEnabled} onChange={(event) => onSnapEnabledChange(event.target.checked)} />
          <span>{t('timeline.snap')}</span>
        </label>
        <label className="snap-step-field">
          <span>{t('timeline.step')}</span>
          <input type="number" min={0.001} step={0.01} value={round(snapStep)} onChange={(event) => onSnapStepChange(toNumber(event.target.value, snapStep))} />
        </label>
      </div>
    </section>
  );
}

function TimelineKeyBrowser({
  rows,
  selected,
  clipboard,
  onSelect,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete
}: {
  rows: TimelineKeyRow[];
  selected: TimelineKeySelection | null;
  clipboard: TimelineClipboard | null;
  onSelect: (row: TimelineKeyRow) => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <section className="timeline-key-browser">
      <div className="timeline-key-actions">
        <strong>{t('timeline.keys')}</strong>
        <span>{t('timeline.visible', { count: rows.length })}</span>
        <button type="button" onClick={onCopy} disabled={!selected}>{t('common.copy')}</button>
        <button type="button" onClick={onPaste} disabled={!clipboard}>{t('common.paste')}</button>
        <button type="button" onClick={onDuplicate} disabled={!selected}>{t('common.duplicate')}</button>
        <button type="button" onClick={onDelete} disabled={!selected}>{t('common.delete')}</button>
      </div>
      {rows.length === 0 ? (
        <p className="timeline-empty compact">{t('timeline.noKeys')}</p>
      ) : (
        <div className="timeline-key-list">
          {rows.map((row) => (
            <button
              className={timelineSelectionEquals(row.selection, selected) ? 'timeline-key-row selected' : 'timeline-key-row'}
              type="button"
              key={row.id}
              onClick={() => onSelect(row)}
            >
              <span>{round(row.time)}s</span>
              <strong>{row.typeLabel}</strong>
              <span>{row.targetLabel}</span>
              <span>{row.valueLabel}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SelectedTimelineKeyInspector({
  resolved,
  document,
  activeSkinName,
  setSelection,
  setTimelineMode,
  setCurrentTime,
  setKeyTime,
  updateSelectedKey
}: {
  resolved: ResolvedTimelineKey | null;
  document: Suwol2DDocument;
  activeSkinName: string;
  setSelection: (selection: Selection) => void;
  setTimelineMode: (mode: TimelineMode) => void;
  setCurrentTime: (value: number) => void;
  setKeyTime: (value: number) => void;
  updateSelectedKey: (updater: (key: ResolvedTimelineKey, draft: Suwol2DDocument) => void) => void;
}) {
  const { t } = useI18n();
  if (!resolved) {
    return (
      <section className="selected-key-inspector">
        <h3>{t('timeline.selectedKey')}</h3>
        <p>{t('timeline.selectKeyHint')}</p>
      </section>
    );
  }

  const { selection, key } = resolved;
  const keyTime = key.time;
  const mode = getTimelineModeForKey(selection.type) as TimelineMode;
  const setNumber = (property: string, value: number) => updateSelectedKey((resolvedKey) => {
    (resolvedKey.key as unknown as Record<string, number>)[property] = value;
  });

  return (
    <section className="selected-key-inspector">
      <div className="selected-key-header">
        <div>
          <h3>{t('timeline.selectedKey')}</h3>
          <span>{selection.type} / {selection.target}</span>
        </div>
        <div className="timeline-actions">
          <button type="button" onClick={() => { setTimelineMode(mode); setCurrentTime(keyTime); }}>{t('timeline.goToKey')}</button>
        </div>
      </div>

      <div className="selected-key-fields">
        <NumberField label={t('toolbar.time')} value={keyTime} onChange={setKeyTime} />
        {selection.type === 'boneTranslate' && (
          <>
            <NumberField label="X" value={(key as Suwol2DTranslateKey).x} onChange={(value) => setNumber('x', value)} />
            <NumberField label="Y" value={(key as Suwol2DTranslateKey).y} onChange={(value) => setNumber('y', value)} />
          </>
        )}
        {selection.type === 'boneRotate' && (
          <NumberField label={t('inspector.rotation')} value={(key as Suwol2DRotateKey).rotation} onChange={(value) => setNumber('rotation', value)} />
        )}
        {selection.type === 'boneScale' && (
          <>
            <NumberField label={t('inspector.scaleX')} value={(key as Suwol2DScaleKey).scaleX} onChange={(value) => setNumber('scaleX', value)} />
            <NumberField label={t('inspector.scaleY')} value={(key as Suwol2DScaleKey).scaleY} onChange={(value) => setNumber('scaleY', value)} />
          </>
        )}
        {selection.type === 'attachment' && (
          <AttachmentKeyInspector
            keyData={key as Suwol2DAttachmentKey}
            slotName={selection.target}
            document={document}
            activeSkinName={activeSkinName}
            setSelection={setSelection}
            updateSelectedKey={updateSelectedKey}
          />
        )}
        {selection.type === 'drawOrder' && (
          <DrawOrderKeyInspector
            keyData={key as Suwol2DDrawOrderKey}
            document={document}
            updateSelectedKey={updateSelectedKey}
          />
        )}
        {selection.type === 'slotColor' && (
          <SlotColorKeyInspector
            keyData={key as Suwol2DSlotColorKey}
            setNumber={setNumber}
            updateSelectedKey={updateSelectedKey}
          />
        )}
        {selection.type === 'event' && (
          <EventKeyInspector keyData={key as Suwol2DEventKey} updateSelectedKey={updateSelectedKey} />
        )}
        {selection.type === 'deform' && (
          <DeformKeyInspector
            keyData={key as Suwol2DDeformKey}
            document={document}
            activeSkinName={activeSkinName}
            target={selection.target}
            updateSelectedKey={updateSelectedKey}
          />
        )}
      </div>
    </section>
  );
}

function AttachmentKeyInspector({
  keyData,
  slotName,
  document,
  activeSkinName,
  setSelection,
  updateSelectedKey
}: {
  keyData: Suwol2DAttachmentKey;
  slotName: string;
  document: Suwol2DDocument;
  activeSkinName: string;
  setSelection: (selection: Selection) => void;
  updateSelectedKey: (updater: (key: ResolvedTimelineKey, draft: Suwol2DDocument) => void) => void;
}) {
  const { t } = useI18n();
  const attachments = getAttachmentsForSlot(document, activeSkinName, slotName);
  return (
    <>
      <label className="field-row">
        <span>{t('inspector.attachment')}</span>
        <select
          value={keyData.attachment ?? '__hide__'}
          onChange={(event) => updateSelectedKey((resolvedKey) => {
            (resolvedKey.key as Suwol2DAttachmentKey).attachment = event.target.value === '__hide__' ? null : event.target.value;
          })}
        >
          <option value="__hide__">{t('common.hidden')}</option>
          {attachments.map((attachment) => <option key={attachment.name} value={attachment.name}>{attachment.name}</option>)}
        </select>
      </label>
      <button className="wide-action" type="button" onClick={() => setSelection({ type: 'slot', name: slotName })}>{t('inspector.selectSlot')}</button>
    </>
  );
}

function DrawOrderKeyInspector({
  keyData,
  document,
  updateSelectedKey
}: {
  keyData: Suwol2DDrawOrderKey;
  document: Suwol2DDocument;
  updateSelectedKey: (updater: (key: ResolvedTimelineKey, draft: Suwol2DDocument) => void) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="draw-order-inspector">
      <button className="wide-action" type="button" onClick={() => updateSelectedKey((resolvedKey, draft) => {
        (resolvedKey.key as Suwol2DDrawOrderKey).slots = setupDrawOrderSlots(draft);
      })}>{t('inspector.normalizeToSetup')}</button>
      {keyData.slots.map((entry, index) => (
        <div className="draw-order-row" key={`${entry.slot}-${index}`}>
          <span>{entry.slot}</span>
          <span>{entry.drawOrder}</span>
          <button type="button" disabled={index === 0} onClick={() => updateSelectedKey((resolvedKey) => moveDrawOrderEntry(resolvedKey.key as Suwol2DDrawOrderKey, index, -1))}>
            <ArrowUp size={13} />
          </button>
          <button type="button" disabled={index === keyData.slots.length - 1} onClick={() => updateSelectedKey((resolvedKey) => moveDrawOrderEntry(resolvedKey.key as Suwol2DDrawOrderKey, index, 1))}>
            <ArrowDown size={13} />
          </button>
        </div>
      ))}
      {document.slots.length === 0 && <p>{t('timeline.noSlotsInDocument')}</p>}
    </section>
  );
}

function SlotColorKeyInspector({
  keyData,
  setNumber,
  updateSelectedKey
}: {
  keyData: Suwol2DSlotColorKey;
  setNumber: (property: string, value: number) => void;
  updateSelectedKey: (updater: (key: ResolvedTimelineKey, draft: Suwol2DDocument) => void) => void;
}) {
  const { t } = useI18n();
  const apply = (next: Omit<Suwol2DSlotColorKey, 'time'>) => updateSelectedKey((resolvedKey) => {
    const key = resolvedKey.key as Suwol2DSlotColorKey;
    key.r = next.r;
    key.g = next.g;
    key.b = next.b;
    key.a = next.a;
  });

  return (
    <>
      <NumberField label="R" value={keyData.r} onChange={(value) => setNumber('r', value)} />
      <NumberField label="G" value={keyData.g} onChange={(value) => setNumber('g', value)} />
      <NumberField label="B" value={keyData.b} onChange={(value) => setNumber('b', value)} />
      <NumberField label="A" value={keyData.a} onChange={(value) => setNumber('a', value)} />
      <div className="inspector-action-row">
        <button type="button" onClick={() => apply({ r: 1, g: 1, b: 1, a: 1 })}>{t('common.white')}</button>
        <button type="button" onClick={() => apply({ r: 1, g: 1, b: 1, a: 0.5 })}>{t('timeline.halfAlpha')}</button>
        <button type="button" onClick={() => apply({ r: 1, g: 1, b: 1, a: 0 })}>{t('common.hidden')}</button>
      </div>
    </>
  );
}

function EventKeyInspector({
  keyData,
  updateSelectedKey
}: {
  keyData: Suwol2DEventKey;
  updateSelectedKey: (updater: (key: ResolvedTimelineKey, draft: Suwol2DDocument) => void) => void;
}) {
  const { t } = useI18n();
  const setValue = (property: string, value: string | number) => updateSelectedKey((resolvedKey) => {
    (resolvedKey.key as unknown as Record<string, string | number | undefined>)[property] = value;
  });

  return (
    <>
      <TextField label={t('inspector.name')} value={keyData.name} onChange={(value) => setValue('name', value)} />
      <NumberField label="Int" value={keyData.intValue ?? 0} onChange={(value) => setValue('intValue', Math.trunc(value))} />
      <NumberField label="Float" value={keyData.floatValue ?? 0} onChange={(value) => setValue('floatValue', value)} />
      <TextField label="String" value={keyData.stringValue ?? ''} onChange={(value) => setValue('stringValue', value)} />
    </>
  );
}

function DeformKeyInspector({
  keyData,
  document,
  activeSkinName,
  target,
  updateSelectedKey
}: {
  keyData: Suwol2DDeformKey;
  document: Suwol2DDocument;
  activeSkinName: string;
  target: string;
  updateSelectedKey: (updater: (key: ResolvedTimelineKey, draft: Suwol2DDocument) => void) => void;
}) {
  const { t } = useI18n();
  const [slotName, attachmentName] = splitTimelineTarget(target);
  const attachment = findAttachmentForEdit(document, activeSkinName, attachmentName);
  const mesh = attachment?.type === 'mesh' ? attachment : undefined;

  return (
    <section className="deform-key-inspector">
      <div className="inspector-action-row">
        <button type="button" disabled={!mesh} onClick={() => updateSelectedKey((resolvedKey, draft) => {
          const draftAttachment = findAttachmentForEdit(draft, activeSkinName, attachmentName);
          if (draftAttachment?.type !== 'mesh') return;
          (resolvedKey.key as Suwol2DDeformKey).offsets = createZeroDeformOffsets(draftAttachment.vertices.length);
        })}>{t('timeline.resetOffsets')}</button>
        <button type="button" onClick={() => updateSelectedKey((resolvedKey) => {
          const key = resolvedKey.key as Suwol2DDeformKey;
          key.offsets = key.offsets.map((offset) => ({ ...offset, x: 0, y: 0 }));
        })}>{t('timeline.zeroExisting')}</button>
      </div>
      <ReadonlyRow label={t('inspector.slot')} value={slotName} />
      <ReadonlyRow label={t('inspector.attachment')} value={attachmentName} />
      {mesh ? mesh.vertices.map((_, vertexIndex) => {
        const offset = findVertexOffset(keyData, vertexIndex);
        return (
          <div className="deform-offset-row" key={`selected-deform-${vertexIndex}`}>
            <span>{vertexIndex}</span>
            <NumberInline
              value={offset?.x ?? 0}
              onChange={(value) => updateSelectedKey((resolvedKey) => {
                getOrCreateVertexOffset(resolvedKey.key as Suwol2DDeformKey, vertexIndex).x = value;
              })}
            />
            <NumberInline
              value={offset?.y ?? 0}
              onChange={(value) => updateSelectedKey((resolvedKey) => {
                getOrCreateVertexOffset(resolvedKey.key as Suwol2DDeformKey, vertexIndex).y = value;
              })}
            />
          </div>
        );
      }) : <p>{t('timeline.meshAttachmentMissing')}</p>}
    </section>
  );
}

function TimelineEditor({
  timeline,
  snapKeyTime,
  updateTimeline
}: {
  timeline: Suwol2DBoneTimeline | undefined;
  snapKeyTime: (value: number) => number;
  updateTimeline: (updater: (timeline: Suwol2DBoneTimeline) => void) => void;
}) {
  const { t } = useI18n();
  if (!timeline) {
    return <p className="timeline-empty">{t('timeline.selectBoneAndAddKey')}</p>;
  }

  return (
    <div className="key-grid">
      <KeyGroup title={t('timeline.translate')} keys={timeline.translate} fields={['x', 'y']} updateTimeline={updateTimeline} kind="translate" snapKeyTime={snapKeyTime} />
      <KeyGroup title={t('timeline.rotate')} keys={timeline.rotate} fields={['rotation']} updateTimeline={updateTimeline} kind="rotate" snapKeyTime={snapKeyTime} />
      <KeyGroup title={t('timeline.scale')} keys={timeline.scale} fields={['scaleX', 'scaleY']} updateTimeline={updateTimeline} kind="scale" snapKeyTime={snapKeyTime} />
    </div>
  );
}

function KeyGroup({
  title,
  keys,
  fields,
  updateTimeline,
  kind,
  snapKeyTime
}: {
  title: string;
  keys: Array<Suwol2DTranslateKey | Suwol2DRotateKey | Suwol2DScaleKey>;
  fields: string[];
  updateTimeline: (updater: (timeline: Suwol2DBoneTimeline) => void) => void;
  kind: KeyKind;
  snapKeyTime: (value: number) => number;
}) {
  const { t } = useI18n();
  return (
    <section className="key-group">
      <h3>{title}</h3>
      {keys.length === 0 ? <p>{t('timeline.noKeysShort')}</p> : keys.map((key, index) => (
        <div className="key-row" key={`${kind}-${index}`}>
          <NumberInline
            value={key.time}
            onChange={(value) => updateTimeline((timeline) => {
              const list = timeline[kind] as typeof keys;
              list[index].time = snapKeyTime(value);
              list.sort(sortByTime);
            })}
          />
          {fields.map((field) => (
            <NumberInline
              key={field}
              value={(key as unknown as Record<string, number>)[field]}
              onChange={(value) => updateTimeline((timeline) => {
                const list = timeline[kind] as unknown as Array<Record<string, number>>;
                list[index][field] = value;
              })}
            />
          ))}
          <button type="button" onClick={() => updateTimeline((timeline) => { timeline[kind].splice(index, 1); })}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </section>
  );
}

function DeformTimelineEditor({
  animation,
  attachment,
  activeSkinName,
  currentTime,
  snapKeyTime,
  updateDocument
}: {
  animation: Suwol2DAnimation | undefined;
  attachment: Suwol2DMeshAttachment | undefined;
  activeSkinName: string;
  currentTime: number;
  snapKeyTime: (value: number) => number;
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void;
}) {
  const { t } = useI18n();
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(0);

  useEffect(() => {
    setSelectedKeyIndex(0);
  }, [animation?.name, attachment?.name]);

  if (!animation) {
    return <p className="timeline-empty">{t('timeline.selectAnimationForDeform')}</p>;
  }

  if (!attachment) {
    return <p className="timeline-empty">{t('timeline.selectMeshAttachmentForDeform')}</p>;
  }

  const timeline = findDeformTimeline(animation, attachment);
  const clampedKeyIndex = timeline && timeline.keys.length > 0
    ? Math.max(0, Math.min(selectedKeyIndex, timeline.keys.length - 1))
    : 0;
  const selectedKey = timeline?.keys[clampedKeyIndex];

  const updateDeformTimeline = (updater: (timeline: Suwol2DDeformTimeline, mesh: Suwol2DMeshAttachment) => void) => {
    updateDocument((draft) => {
      const draftAnimation = findAnimation(draft, animation.name);
      const mesh = findMeshAttachmentForEdit(draft, activeSkinName, attachment.name);
      const draftTimeline = getOrCreateDeformTimeline(draftAnimation, mesh);
      updater(draftTimeline, mesh);
      draftTimeline.keys.sort(sortByTime);
    });
  };

  return (
    <section className="deform-editor">
      <div className="deform-header">
        <div>
          <strong>{t('timeline.deform')}</strong>
          <span>{attachment.slot} / {attachment.name}</span>
        </div>
        <div className="timeline-actions">
          <button
            type="button"
            onClick={() => updateDeformTimeline((deformTimeline, mesh) => {
              const key = addOrReplaceDeformKeyInTimeline(deformTimeline, mesh, snapKeyTime(currentTime));
              const nextIndex = deformTimeline.keys.findIndex((candidate) => candidate.time === key.time);
              setSelectedKeyIndex(Math.max(0, nextIndex));
            })}
          >
            {t('timeline.addKey')}
          </button>
          <button
            type="button"
            onClick={() => updateDeformTimeline((deformTimeline, mesh) => {
              const key = deformTimeline.keys[clampedKeyIndex] ?? addOrReplaceDeformKeyInTimeline(deformTimeline, mesh, snapKeyTime(currentTime));
              key.offsets = createZeroDeformOffsets(mesh.vertices.length);
            })}
          >
            {t('timeline.resetSelectedDeformKey')}
          </button>
          <button
            type="button"
            onClick={() => updateDocument((draft) => {
              const draftAnimation = findAnimation(draft, animation.name);
              removeDeformTimeline(draftAnimation, attachment.slot, attachment.name);
              setSelectedKeyIndex(0);
            })}
          >
            {t('timeline.clearDeformTimeline')}
          </button>
          <button
            type="button"
            onClick={() => updateDeformTimeline((deformTimeline, mesh) => {
              const key = deformTimeline.keys[clampedKeyIndex] ?? addOrReplaceDeformKeyInTimeline(deformTimeline, mesh, snapKeyTime(currentTime));
              key.offsets = createZeroDeformOffsets(mesh.vertices.length);
            })}
          >
            {t('timeline.copySetupVerticesAsZeroOffsets')}
          </button>
        </div>
      </div>

      {!timeline || timeline.keys.length === 0 ? (
        <p className="timeline-empty">{t('timeline.noDeformKeysForMesh')}</p>
      ) : (
        <div className="deform-grid">
          <section className="key-group deform-key-list">
            <h3>{t('timeline.keys')}</h3>
            {timeline.keys.map((key, index) => (
              <div className={index === clampedKeyIndex ? 'key-row deform-key-row selected' : 'key-row deform-key-row'} key={`deform-${index}`} onClick={() => setSelectedKeyIndex(index)}>
                <NumberInline
                  value={key.time}
                  onChange={(value) => updateDeformTimeline((deformTimeline) => {
                    deformTimeline.keys[index].time = snapKeyTime(value);
                    deformTimeline.keys.sort(sortByTime);
                  })}
                />
                <span>{key.offsets.length} offsets</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    updateDeformTimeline((deformTimeline) => {
                      deformTimeline.keys.splice(index, 1);
                      setSelectedKeyIndex(Math.max(0, index - 1));
                    });
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </section>

          <section className="key-group deform-offset-list">
            <h3>{t('timeline.offsetsForKey', { key: clampedKeyIndex })}</h3>
            {selectedKey ? (
              <>
                <div className="deform-offset-row deform-offset-header">
                  <span>{t('mesh.vertices')}</span>
                  <span>X</span>
                  <span>Y</span>
                </div>
                {attachment.vertices.map((_, vertexIndex) => {
                  const offset = findVertexOffset(selectedKey, vertexIndex);
                  return (
                    <div className="deform-offset-row" key={`deform-offset-${vertexIndex}`}>
                      <span>{vertexIndex}</span>
                      <NumberInline
                        value={offset?.x ?? 0}
                        onChange={(value) => updateDeformTimeline((deformTimeline) => {
                          const key = deformTimeline.keys[clampedKeyIndex];
                          getOrCreateVertexOffset(key, vertexIndex).x = value;
                        })}
                      />
                      <NumberInline
                        value={offset?.y ?? 0}
                        onChange={(value) => updateDeformTimeline((deformTimeline) => {
                          const key = deformTimeline.keys[clampedKeyIndex];
                          getOrCreateVertexOffset(key, vertexIndex).y = value;
                        })}
                      />
                    </div>
                  );
                })}
              </>
            ) : (
              <p>{t('timeline.noSelectedDeformKey')}</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function AttachmentTimelineEditor({
  animation,
  document,
  activeSkinName,
  currentTime,
  snapKeyTime,
  selectedSlotName,
  updateDocument,
  setSelection
}: {
  animation: Suwol2DAnimation | undefined;
  document: Suwol2DDocument;
  activeSkinName: string;
  currentTime: number;
  snapKeyTime: (value: number) => number;
  selectedSlotName: string | undefined;
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void;
  setSelection: (selection: Selection) => void;
}) {
  const { t } = useI18n();
  const [slotName, setSlotName] = useState(selectedSlotName ?? document.slots[0]?.name ?? '');
  const resolvedSlotName = document.slots.some((slot) => slot.name === slotName) ? slotName : document.slots[0]?.name ?? '';

  useEffect(() => {
    if (selectedSlotName && document.slots.some((slot) => slot.name === selectedSlotName)) {
      setSlotName(selectedSlotName);
    } else if (!document.slots.some((slot) => slot.name === slotName)) {
      setSlotName(document.slots[0]?.name ?? '');
    }
  }, [document.slots, selectedSlotName, slotName]);

  if (!animation) {
    return <p className="timeline-empty">{t('timeline.selectAnimationForAttachment')}</p>;
  }

  if (!resolvedSlotName) {
    return <p className="timeline-empty">{t('timeline.createSlotBeforeAttachmentKeys')}</p>;
  }

  const timeline = findAttachmentTimeline(animation, resolvedSlotName);
  const attachments = getAttachmentsForSlot(document, activeSkinName, resolvedSlotName);
  const defaultAttachment = document.slots.find((slot) => slot.name === resolvedSlotName)?.attachment
    || attachments[0]?.name
    || '';

  const updateTimeline = (updater: (timeline: Suwol2DAttachmentTimeline) => void) => {
    updateDocument((draft) => {
      const draftAnimation = findAnimation(draft, animation.name);
      const draftTimeline = getOrCreateAttachmentTimeline(draftAnimation, resolvedSlotName);
      updater(draftTimeline);
      draftTimeline.keys.sort(sortByTime);
      cleanupV8Timelines(draftAnimation);
    });
  };

  return (
    <section className="v8-editor">
      <div className="v8-header">
        <div>
          <strong>{t('timeline.attachment')}</strong>
          <span>{resolvedSlotName}</span>
        </div>
        <div className="timeline-actions">
          <select
            value={resolvedSlotName}
            onChange={(event) => {
              setSlotName(event.target.value);
              setSelection({ type: 'slot', name: event.target.value });
            }}
          >
            {document.slots.map((slot) => <option key={slot.name} value={slot.name}>{slot.name}</option>)}
          </select>
          <button
            type="button"
            onClick={() => updateTimeline((draftTimeline) => {
              addOrReplaceAttachmentKey(draftTimeline, snapKeyTime(currentTime), defaultAttachment || null);
            })}
          >
            {t('timeline.addAttachmentKey')}
          </button>
          <button
            type="button"
            onClick={() => updateTimeline((draftTimeline) => {
              addOrReplaceAttachmentKey(draftTimeline, snapKeyTime(currentTime), null);
            })}
          >
            {t('timeline.addHideKey')}
          </button>
        </div>
      </div>
      {!timeline || timeline.keys.length === 0 ? (
        <p className="timeline-empty">{t('timeline.noAttachmentKeysForSlot')}</p>
      ) : (
        <section className="key-group v8-list">
          <h3>{t('timeline.keys')}</h3>
          {timeline.keys.map((key, index) => (
            <div className="key-row v8-key-row attachment-key-row" key={`attachment-${resolvedSlotName}-${index}`}>
              <NumberInline
                value={key.time}
                onChange={(value) => updateTimeline((draftTimeline) => {
                  draftTimeline.keys[index].time = snapKeyTime(value);
                })}
              />
              <select
                value={key.attachment ?? '__hide__'}
                onChange={(event) => updateTimeline((draftTimeline) => {
                  draftTimeline.keys[index].attachment = event.target.value === '__hide__' ? null : event.target.value;
                })}
              >
                <option value="__hide__">{t('common.hidden')}</option>
                {attachments.map((attachment) => (
                  <option key={attachment.name} value={attachment.name}>{attachment.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => updateTimeline((draftTimeline) => { draftTimeline.keys.splice(index, 1); })}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}

function DrawOrderTimelineEditor({
  animation,
  document,
  currentTime,
  snapKeyTime,
  updateDocument
}: {
  animation: Suwol2DAnimation | undefined;
  document: Suwol2DDocument;
  currentTime: number;
  snapKeyTime: (value: number) => number;
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void;
}) {
  const { t } = useI18n();
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(0);

  useEffect(() => {
    setSelectedKeyIndex(0);
  }, [animation?.name]);

  if (!animation) {
    return <p className="timeline-empty">{t('timeline.selectAnimationForDrawOrder')}</p>;
  }

  const keys = [...(animation.drawOrders ?? [])].sort(sortByTime);
  const clampedKeyIndex = keys.length > 0 ? Math.max(0, Math.min(selectedKeyIndex, keys.length - 1)) : 0;
  const selectedKey = keys[clampedKeyIndex];

  const updateDrawOrders = (updater: (keys: Suwol2DDrawOrderKey[]) => void) => {
    updateDocument((draft) => {
      const draftAnimation = findAnimation(draft, animation.name);
      draftAnimation.drawOrders ??= [];
      updater(draftAnimation.drawOrders);
      draftAnimation.drawOrders.sort(sortByTime);
      cleanupV8Timelines(draftAnimation);
    });
  };

  return (
    <section className="v8-editor">
      <div className="v8-header">
        <div>
          <strong>{t('timeline.drawOrder')}</strong>
          <span>{t('timeline.keyCount', { count: keys.length })}</span>
        </div>
        <div className="timeline-actions">
          <button
            type="button"
            onClick={() => updateDrawOrders((draftKeys) => {
              const key = addOrReplaceDrawOrderKey(draftKeys, snapKeyTime(currentTime), sampleDrawOrder(document, animation, currentTime));
              setSelectedKeyIndex(draftKeys.findIndex((candidate) => candidate === key));
            })}
          >
            {t('timeline.addDrawOrderKeyAtCurrentTime')}
          </button>
          <button
            type="button"
            onClick={() => updateDrawOrders((draftKeys) => {
              const key = draftKeys[clampedKeyIndex] ?? addOrReplaceDrawOrderKey(draftKeys, snapKeyTime(currentTime), document.slots);
              key.slots = setupDrawOrderSlots(document);
            })}
          >
            {t('timeline.resetToSetup')}
          </button>
        </div>
      </div>
      {keys.length === 0 ? (
        <p className="timeline-empty">{t('timeline.noDrawOrderKeys')}</p>
      ) : (
        <div className="deform-grid">
          <section className="key-group deform-key-list">
            <h3>{t('timeline.keys')}</h3>
            {keys.map((key, index) => (
              <div
                className={index === clampedKeyIndex ? 'key-row deform-key-row selected' : 'key-row deform-key-row'}
                key={`draw-order-${index}`}
                onClick={() => setSelectedKeyIndex(index)}
              >
                <NumberInline
                  value={key.time}
                  onChange={(value) => updateDrawOrders((draftKeys) => {
                    draftKeys[index].time = snapKeyTime(value);
                  })}
                />
                <span>{key.slots.length} slots</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    updateDrawOrders((draftKeys) => {
                      draftKeys.splice(index, 1);
                      setSelectedKeyIndex(Math.max(0, index - 1));
                    });
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </section>
          <section className="key-group deform-offset-list">
            <h3>{t('timeline.slotOrder')}</h3>
            {selectedKey?.slots.map((entry, slotIndex) => (
              <div className="draw-order-row" key={`${selectedKey.time}-${entry.slot}`}>
                <span>{entry.slot}</span>
                <span>{entry.drawOrder}</span>
                <button type="button" disabled={slotIndex === 0} onClick={() => updateDrawOrders((draftKeys) => moveDrawOrderEntry(draftKeys[clampedKeyIndex], slotIndex, -1))}>
                  <ArrowUp size={13} />
                </button>
                <button type="button" disabled={slotIndex === selectedKey.slots.length - 1} onClick={() => updateDrawOrders((draftKeys) => moveDrawOrderEntry(draftKeys[clampedKeyIndex], slotIndex, 1))}>
                  <ArrowDown size={13} />
                </button>
              </div>
            ))}
          </section>
        </div>
      )}
    </section>
  );
}

function SlotColorTimelineEditor({
  animation,
  document,
  currentTime,
  snapKeyTime,
  selectedSlotName,
  updateDocument,
  setSelection
}: {
  animation: Suwol2DAnimation | undefined;
  document: Suwol2DDocument;
  currentTime: number;
  snapKeyTime: (value: number) => number;
  selectedSlotName: string | undefined;
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void;
  setSelection: (selection: Selection) => void;
}) {
  const { t } = useI18n();
  const [slotName, setSlotName] = useState(selectedSlotName ?? document.slots[0]?.name ?? '');
  const resolvedSlotName = document.slots.some((slot) => slot.name === slotName) ? slotName : document.slots[0]?.name ?? '';

  useEffect(() => {
    if (selectedSlotName && document.slots.some((slot) => slot.name === selectedSlotName)) {
      setSlotName(selectedSlotName);
    } else if (!document.slots.some((slot) => slot.name === slotName)) {
      setSlotName(document.slots[0]?.name ?? '');
    }
  }, [document.slots, selectedSlotName, slotName]);

  if (!animation) {
    return <p className="timeline-empty">{t('timeline.selectAnimationForSlotColor')}</p>;
  }

  if (!resolvedSlotName) {
    return <p className="timeline-empty">{t('timeline.createSlotBeforeSlotColorKeys')}</p>;
  }

  const timeline = findSlotTimeline(animation, resolvedSlotName);

  const updateTimeline = (updater: (timeline: Suwol2DSlotTimeline) => void) => {
    updateDocument((draft) => {
      const draftAnimation = findAnimation(draft, animation.name);
      const draftTimeline = getOrCreateSlotTimeline(draftAnimation, resolvedSlotName);
      updater(draftTimeline);
      draftTimeline.color = (draftTimeline.color ?? []).sort(sortByTime);
      cleanupV8Timelines(draftAnimation);
    });
  };

  const applyQuickColor = (key: Suwol2DSlotColorKey | undefined, next: Omit<Suwol2DSlotColorKey, 'time'>) => {
    updateTimeline((draftTimeline) => {
      const draftKey = key
        ? draftTimeline.color?.find((candidate) => Math.abs(candidate.time - key.time) < 0.0001)
        : addOrReplaceSlotColorKey(draftTimeline, snapKeyTime(currentTime));
      if (!draftKey) return;
      draftKey.r = next.r;
      draftKey.g = next.g;
      draftKey.b = next.b;
      draftKey.a = next.a;
    });
  };

  return (
    <section className="v8-editor">
      <div className="v8-header">
        <div>
          <strong>{t('timeline.slotColor')}</strong>
          <span>{resolvedSlotName}</span>
        </div>
        <div className="timeline-actions">
          <select
            value={resolvedSlotName}
            onChange={(event) => {
              setSlotName(event.target.value);
              setSelection({ type: 'slot', name: event.target.value });
            }}
          >
            {document.slots.map((slot) => <option key={slot.name} value={slot.name}>{slot.name}</option>)}
          </select>
          <button type="button" onClick={() => updateTimeline((draftTimeline) => { addOrReplaceSlotColorKey(draftTimeline, snapKeyTime(currentTime)); })}>{t('timeline.addColorKey')}</button>
          <button type="button" onClick={() => applyQuickColor(undefined, { r: 1, g: 1, b: 1, a: 1 })}>{t('common.white')}</button>
          <button type="button" onClick={() => applyQuickColor(undefined, { r: 1, g: 1, b: 1, a: 0.5 })}>{t('timeline.halfAlpha')}</button>
          <button type="button" onClick={() => applyQuickColor(undefined, { r: 1, g: 1, b: 1, a: 0 })}>{t('timeline.hiddenAlpha')}</button>
          <button type="button" onClick={() => updateTimeline((draftTimeline) => { draftTimeline.color = []; })}>{t('common.reset')}</button>
        </div>
      </div>
      {!timeline || (timeline.color ?? []).length === 0 ? (
        <p className="timeline-empty">{t('timeline.noSlotColorKeys')}</p>
      ) : (
        <section className="key-group v8-list">
          <h3>{t('timeline.keys')}</h3>
          {(timeline.color ?? []).map((key, index) => (
            <div className="key-row v8-key-row slot-color-key-row" key={`slot-color-${resolvedSlotName}-${index}`}>
              <NumberInline value={key.time} onChange={(value) => updateTimeline((draftTimeline) => { (draftTimeline.color ?? [])[index].time = snapKeyTime(value); })} />
              <NumberInline value={key.r} onChange={(value) => updateTimeline((draftTimeline) => { (draftTimeline.color ?? [])[index].r = value; })} />
              <NumberInline value={key.g} onChange={(value) => updateTimeline((draftTimeline) => { (draftTimeline.color ?? [])[index].g = value; })} />
              <NumberInline value={key.b} onChange={(value) => updateTimeline((draftTimeline) => { (draftTimeline.color ?? [])[index].b = value; })} />
              <NumberInline value={key.a} onChange={(value) => updateTimeline((draftTimeline) => { (draftTimeline.color ?? [])[index].a = value; })} />
              <button type="button" onClick={() => applyQuickColor(key, { r: 1, g: 1, b: 1, a: 1 })}>{t('common.white')}</button>
              <button type="button" onClick={() => applyQuickColor(key, { r: 1, g: 1, b: 1, a: 0.5 })}>{t('timeline.half')}</button>
              <button type="button" onClick={() => updateTimeline((draftTimeline) => { draftTimeline.color?.splice(index, 1); })}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}

function EventTimelineEditor({
  animation,
  currentTime,
  snapKeyTime,
  updateDocument
}: {
  animation: Suwol2DAnimation | undefined;
  currentTime: number;
  snapKeyTime: (value: number) => number;
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void;
}) {
  const { t } = useI18n();
  if (!animation) {
    return <p className="timeline-empty">{t('timeline.selectAnimationForEvents')}</p>;
  }

  const events = [...(animation.events ?? [])].sort(sortByTime);
  const updateEvents = (updater: (events: Suwol2DEventKey[]) => void) => {
    updateDocument((draft) => {
      const draftAnimation = findAnimation(draft, animation.name);
      draftAnimation.events ??= [];
      updater(draftAnimation.events);
      draftAnimation.events.sort(sortByTime);
      cleanupV8Timelines(draftAnimation);
    });
  };

  return (
    <section className="v8-editor">
      <div className="v8-header">
        <div>
          <strong>{t('timeline.events')}</strong>
          <span>{t('timeline.keyCount', { count: events.length })}</span>
        </div>
        <div className="timeline-actions">
          <button type="button" onClick={() => updateEvents((draftEvents) => { addEventKey(draftEvents, snapKeyTime(currentTime)); })}>{t('timeline.addEventKey')}</button>
        </div>
      </div>
      {events.length === 0 ? (
        <p className="timeline-empty">{t('timeline.noEventKeys')}</p>
      ) : (
        <section className="key-group v8-list">
          <h3>{t('timeline.eventList')}</h3>
          {events.map((eventKey, index) => (
            <div className="key-row v8-key-row event-key-row" key={`event-${index}`}>
              <NumberInline value={eventKey.time} onChange={(value) => updateEvents((draftEvents) => { draftEvents[index].time = snapKeyTime(value); })} />
              <input type="text" value={eventKey.name} onChange={(event) => updateEvents((draftEvents) => { draftEvents[index].name = event.target.value; })} />
              <NumberInline value={eventKey.intValue ?? 0} onChange={(value) => updateEvents((draftEvents) => { draftEvents[index].intValue = Math.trunc(value); })} />
              <NumberInline value={eventKey.floatValue ?? 0} onChange={(value) => updateEvents((draftEvents) => { draftEvents[index].floatValue = value; })} />
              <input type="text" value={eventKey.stringValue ?? ''} onChange={(event) => updateEvents((draftEvents) => { draftEvents[index].stringValue = event.target.value; })} />
              <button type="button" onClick={() => updateEvents((draftEvents) => { draftEvents.splice(index, 1); })}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-row">
      <span>{useLocalizedLabel(label)}</span>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="field-row">
      <span>{useLocalizedLabel(label)}</span>
      <input type="number" value={round(value)} step={0.05} onChange={(event) => onChange(toNumber(event.target.value, value))} />
    </label>
  );
}

function NumberInline({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input type="number" value={round(value)} step={0.05} onChange={(event) => onChange(toNumber(event.target.value, value))} />;
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="field-row">
      <span>{useLocalizedLabel(label)}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option || 'none'} value={option}>{option || t('common.none')}</option>
        ))}
      </select>
    </label>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="field-row readonly-row">
      <span>{useLocalizedLabel(label)}</span>
      <strong>{value}</strong>
    </div>
  );
}

function useLocalizedLabel(label: string): string {
  const { t } = useI18n();
  const keyByLabel: Record<string, TranslationKey> = {
    Name: 'inspector.name',
    Path: 'inspector.path',
    Size: 'inspector.size',
    Parent: 'inspector.parent',
    X: 'inspector.x',
    Y: 'inspector.y',
    Rotation: 'inspector.rotation',
    'Scale X': 'inspector.scaleX',
    'Scale Y': 'inspector.scaleY',
    Length: 'inspector.length',
    Bone: 'inspector.bone',
    Attachment: 'inspector.attachment',
    'Draw Order': 'inspector.drawOrder',
    Active: 'common.active',
    Product: 'about.product',
    Version: 'about.version',
    Format: 'about.format',
    Supported: 'about.supported',
    License: 'about.license',
    Docs: 'about.docs',
    Time: 'toolbar.time',
    Current: 'timeline.currentTime',
    Duration: 'timeline.duration',
    Speed: 'timeline.speed',
    Filter: 'timeline.filter',
    Machine: 'panel.stateMachines',
    Initial: 'common.start'
  };
  const key = keyByLabel[label];
  return key ? t(key) : label;
}

function MeshAttachmentFields({
  attachment,
  document,
  images,
  activeSkinName,
  updateDocument
}: {
  attachment: Suwol2DMeshAttachment;
  document: Suwol2DDocument;
  images: ImportedImage[];
  activeSkinName: string;
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void;
}) {
  const { t } = useI18n();
  const [selectedVertex, setSelectedVertex] = useState(0);
  const image = images.find((candidate) => candidate.name === attachment.image);
  const clampedVertex = Math.max(0, Math.min(selectedVertex, Math.max(0, attachment.vertices.length - 1)));
  const selectedWeight = findVertexWeight(attachment, clampedVertex);
  return (
    <section className="mesh-field-block">
      <button
        className="wide-action"
        type="button"
        onClick={() => updateDocument((draft) => {
          const mesh = findMeshAttachmentForEdit(draft, activeSkinName, attachment.name);
          resetMeshAttachment(mesh, image);
          removeDeformTimelinesForAttachment(draft, attachment.name);
        })}
      >
        {t('mesh.resetQuadMesh')}
      </button>
      <div className="mesh-action-row">
        <button
          className="wide-action"
          type="button"
          onClick={() => updateDocument((draft) => {
            const mesh = findMeshAttachmentForEdit(draft, activeSkinName, attachment.name);
            normalizeVertexWeight(mesh, clampedVertex);
          })}
        >
          {t('mesh.normalizeSelectedVertex')}
        </button>
        <button
          className="wide-action"
          type="button"
          onClick={() => updateDocument((draft) => {
            normalizeAllVertexWeights(findMeshAttachmentForEdit(draft, activeSkinName, attachment.name));
          })}
        >
          {t('mesh.normalizeAllVertices')}
        </button>
      </div>
      <div className="mesh-action-row">
        <button
          className="wide-action"
          type="button"
          onClick={() => updateDocument((draft) => {
            findMeshAttachmentForEdit(draft, activeSkinName, attachment.name).weights = undefined;
          })}
        >
          {t('mesh.clearWeights')}
        </button>
        <button
          className="wide-action"
          type="button"
          onClick={() => updateDocument((draft) => {
            const mesh = findMeshAttachmentForEdit(draft, activeSkinName, attachment.name);
            const slot = draft.slots.find((candidate) => candidate.name === mesh.slot);
            autoRigidWeights(mesh, slot?.bone ?? draft.bones[0]?.name ?? '');
          })}
        >
          {t('mesh.autoRigidWeights')}
        </button>
      </div>
      <h3>{t('mesh.vertices')}</h3>
      <div className="mesh-row mesh-row-header">
        <span>X</span>
        <span>Y</span>
        <span>U</span>
        <span>V</span>
      </div>
      {attachment.vertices.map((vertex, index) => (
        <div className={index === clampedVertex ? 'mesh-row selected' : 'mesh-row'} key={`vertex-${index}`} onClick={() => setSelectedVertex(index)}>
          {(['x', 'y', 'u', 'v'] as Array<keyof Suwol2DMeshVertex>).map((field) => (
            <NumberInline
              key={field}
              value={vertex[field]}
              onChange={(value) => updateDocument((draft) => {
                const mesh = findMeshAttachmentForEdit(draft, activeSkinName, attachment.name);
                mesh.vertices[index][field] = value;
              })}
            />
          ))}
        </div>
      ))}
      <h3>{t('mesh.weightsForVertex', { vertex: clampedVertex })}</h3>
      <button
        className="wide-action"
        type="button"
        onClick={() => updateDocument((draft) => {
          const mesh = findMeshAttachmentForEdit(draft, activeSkinName, attachment.name);
          addBoneWeight(mesh, clampedVertex, firstAvailableBone(document, selectedWeight?.bones ?? []));
        })}
      >
        {t('mesh.addWeight')}
      </button>
      {selectedWeight && selectedWeight.bones.length > 0 ? selectedWeight.bones.map((boneWeight, weightIndex) => (
        <div className="weight-row" key={`${clampedVertex}-${weightIndex}`}>
          <select
            value={boneWeight.bone}
            onChange={(event) => updateDocument((draft) => {
              const mesh = findMeshAttachmentForEdit(draft, activeSkinName, attachment.name);
              const weight = getOrCreateVertexWeight(mesh, clampedVertex);
              weight.bones[weightIndex].bone = event.target.value;
            })}
          >
            {document.bones.map((bone) => (
              <option key={bone.name} value={bone.name}>{bone.name}</option>
            ))}
          </select>
          <NumberInline
            value={boneWeight.weight}
            onChange={(value) => updateDocument((draft) => {
              const mesh = findMeshAttachmentForEdit(draft, activeSkinName, attachment.name);
              const weight = getOrCreateVertexWeight(mesh, clampedVertex);
              weight.bones[weightIndex].weight = value;
            })}
          />
          <button
            type="button"
              onClick={() => updateDocument((draft) => {
              const mesh = findMeshAttachmentForEdit(draft, activeSkinName, attachment.name);
              const weight = getOrCreateVertexWeight(mesh, clampedVertex);
              weight.bones.splice(weightIndex, 1);
              cleanupEmptyWeights(mesh);
            })}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )) : (
        <p className="mesh-note">{t('mesh.noWeightsForVertex')}</p>
      )}
      <h3>{t('mesh.triangles')}</h3>
      {chunkTriangleIndices(attachment.triangles).map((triangle, triangleIndex) => (
        <div className="mesh-row triangle-row" key={`triangle-${triangleIndex}`}>
          {triangle.map((value, cornerIndex) => (
            <NumberInline
              key={cornerIndex}
              value={value}
              onChange={(nextValue) => updateDocument((draft) => {
                const mesh = findMeshAttachmentForEdit(draft, activeSkinName, attachment.name);
                mesh.triangles[(triangleIndex * 3) + cornerIndex] = Math.max(0, Math.trunc(nextValue));
              })}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

function renameBone(
  document: Suwol2DDocument,
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void,
  oldName: string,
  newName: string,
  setSelection: (selection: Selection) => void,
  setStatus: (status: string) => void
) {
  const safeName = validateRenameName(newName, oldName, document.bones.filter((bone) => bone.name !== oldName).map((bone) => bone.name), 'bone', setStatus);
  if (!safeName) return;
  updateDocument((draft) => {
    findBone(draft, oldName).name = safeName;
    for (const bone of draft.bones) if (bone.parent === oldName) bone.parent = safeName;
    for (const slot of draft.slots) if (slot.bone === oldName) slot.bone = safeName;
    for (const animation of draft.animations) for (const timeline of animation.bones) if (timeline.bone === oldName) timeline.bone = safeName;
    for (const constraint of draft.ikConstraints ?? []) {
      if (constraint.parentBone === oldName) constraint.parentBone = safeName;
      if (constraint.childBone === oldName) constraint.childBone = safeName;
      if (constraint.targetBone === oldName) constraint.targetBone = safeName;
    }
  });
  setSelection({ type: 'bone', name: safeName });
}

function renameSlot(
  document: Suwol2DDocument,
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void,
  oldName: string,
  newName: string,
  setSelection: (selection: Selection) => void,
  setStatus: (status: string) => void
) {
  const safeName = validateRenameName(newName, oldName, document.slots.filter((slot) => slot.name !== oldName).map((slot) => slot.name), 'slot', setStatus);
  if (!safeName) return;
  updateDocument((draft) => {
    findSlot(draft, oldName).name = safeName;
    for (const skin of getEffectiveSkins(draft)) for (const attachment of skin.attachments) if (attachment.slot === oldName) attachment.slot = safeName;
    for (const animation of draft.animations) for (const deform of animation.deforms ?? []) if (deform.slot === oldName) deform.slot = safeName;
    for (const animation of draft.animations) {
      for (const timeline of animation.attachments ?? []) if (timeline.slot === oldName) timeline.slot = safeName;
      for (const timeline of animation.slots ?? []) if (timeline.slot === oldName) timeline.slot = safeName;
      for (const key of animation.drawOrders ?? []) for (const entry of key.slots) if (entry.slot === oldName) entry.slot = safeName;
    }
  });
  setSelection({ type: 'slot', name: safeName });
}

function renameAttachment(
  document: Suwol2DDocument,
  activeSkinName: string,
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void,
  oldName: string,
  newName: string,
  setSelection: (selection: Selection) => void,
  setStatus: (status: string) => void
) {
  const activeSkin = getActiveSkin(document, activeSkinName);
  const safeName = validateRenameName(newName, oldName, activeSkin.attachments.filter((attachment) => attachment.name !== oldName).map((attachment) => attachment.name), 'attachment', setStatus);
  if (!safeName) return;
  updateDocument((draft) => {
    findAttachmentInSkinForEdit(draft, activeSkinName, oldName).name = safeName;
    for (const slot of draft.slots) if (slot.attachment === oldName) slot.attachment = safeName;
    for (const animation of draft.animations) for (const deform of animation.deforms ?? []) if (deform.attachment === oldName) deform.attachment = safeName;
    for (const animation of draft.animations) {
      for (const timeline of animation.attachments ?? []) {
        for (const key of timeline.keys) {
          if (key.attachment === oldName) key.attachment = safeName;
        }
      }
    }
  });
  setSelection({ type: 'attachment', name: safeName });
}

function renameSkin(
  document: Suwol2DDocument,
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void,
  oldName: string,
  newName: string,
  setSelection: (selection: Selection) => void,
  setActiveSkinName: (name: string) => void,
  setStatus: (status: string) => void
) {
  if (oldName === defaultSkinName) {
    setStatus('The default skin name is fixed.');
    return;
  }

  const safeName = validateRenameName(newName, oldName, getEffectiveSkins(document).filter((skin) => skin.name !== oldName).map((skin) => skin.name), 'skin', setStatus);
  if (!safeName) return;
  updateDocument((draft) => {
    const skin = ensureMutableSkin(draft, oldName);
    skin.name = safeName;
  });
  setActiveSkinName(safeName);
  setSelection({ type: 'skin', name: safeName });
}

function copyAttachmentToSkin(
  document: Suwol2DDocument,
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void,
  sourceSkinName: string,
  attachmentName: string,
  targetSkinName: string,
  setStatus: (status: string) => void
) {
  const sourceAttachment = findAttachmentForEdit(document, sourceSkinName, attachmentName);
  const targetSkin = getEffectiveSkins(document).find((skin) => skin.name === targetSkinName);
  if (!sourceAttachment || !targetSkin) {
    setStatus('Cannot copy attachment because the source or target skin is missing.');
    return;
  }

  if (targetSkin.attachments.some((attachment) => attachment.name === sourceAttachment.name)) {
    setStatus(`Skin '${targetSkinName}' already has attachment '${sourceAttachment.name}'.`);
    return;
  }

  updateDocument((draft) => {
    ensureMutableSkin(draft, targetSkinName).attachments.push(cloneAttachment(sourceAttachment));
  });
  setStatus(`Copied '${sourceAttachment.name}' to skin '${targetSkinName}'.`);
}

function renameAnimation(
  document: Suwol2DDocument,
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void,
  oldName: string,
  newName: string,
  setSelection: (selection: Selection) => void,
  setCurrentAnimationName: (name: string) => void,
  setStatus: (status: string) => void
) {
  const safeName = validateRenameName(newName, oldName, document.animations.filter((animation) => animation.name !== oldName).map((animation) => animation.name), 'animation', setStatus);
  if (!safeName) return;
  updateDocument((draft) => {
    findAnimation(draft, oldName).name = safeName;
  });
  setCurrentAnimationName(safeName);
  setSelection({ type: 'animation', name: safeName });
}

function renameIkConstraint(
  document: Suwol2DDocument,
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void,
  oldName: string,
  newName: string,
  setSelection: (selection: Selection) => void,
  setStatus: (status: string) => void
) {
  const safeName = validateRenameName(newName, oldName, (document.ikConstraints ?? []).filter((constraint) => constraint.name !== oldName).map((constraint) => constraint.name), 'IK constraint', setStatus);
  if (!safeName) return;
  updateDocument((draft) => {
    findIkConstraint(draft, oldName).name = safeName;
  });
  setSelection({ type: 'ikConstraint', name: safeName });
}

function renameStateMachine(
  document: Suwol2DDocument,
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void,
  oldName: string,
  newName: string,
  setSelection: (selection: Selection) => void,
  setStatus: (status: string) => void
) {
  const safeName = validateRenameName(newName, oldName, (document.stateMachines ?? []).filter((machine) => machine.name !== oldName).map((machine) => machine.name), 'state machine', setStatus);
  if (!safeName) return;
  updateDocument((draft) => {
    findStateMachine(draft, oldName).name = safeName;
  });
  setSelection({ type: 'stateMachine', name: safeName });
}

function renameStateMachineState(
  machine: Suwol2DStateMachine,
  oldName: string,
  newName: string,
  setStatus: (status: string) => void
) {
  const safeName = validateRenameName(newName, oldName, machine.states.filter((state) => state.name !== oldName).map((state) => state.name), 'state', setStatus);
  if (!safeName) return;
  const state = machine.states.find((candidate) => candidate.name === oldName);
  if (!state) return;
  state.name = safeName;
  if (machine.initialState === oldName) {
    machine.initialState = safeName;
  }
  for (const transition of machine.transitions) {
    if (transition.from === oldName) transition.from = safeName;
    if (transition.to === oldName) transition.to = safeName;
  }
}

function renameStateMachineParameter(
  machine: Suwol2DStateMachine,
  oldName: string,
  newName: string,
  setStatus: (status: string) => void
) {
  const safeName = validateRenameName(newName, oldName, machine.parameters.filter((parameter) => parameter.name !== oldName).map((parameter) => parameter.name), 'parameter', setStatus);
  if (!safeName) return;
  const parameter = machine.parameters.find((candidate) => candidate.name === oldName);
  if (!parameter) return;
  parameter.name = safeName;
  for (const transition of machine.transitions) {
    for (const condition of transition.conditions) {
      if (condition.parameter === oldName) condition.parameter = safeName;
    }
  }
}

function addStateMachineState(machine: Suwol2DStateMachine, animationName: string): void {
  const name = uniqueName(animationName || 'state', machine.states.map((state) => state.name));
  machine.states.push({
    name,
    animation: animationName,
    loop: true,
    speed: 1
  });
  if (!machine.initialState) {
    machine.initialState = name;
  }
}

function deleteStateMachineState(machine: Suwol2DStateMachine, stateName: string): void {
  if (machine.states.length <= 1) {
    return;
  }

  machine.states = machine.states.filter((state) => state.name !== stateName);
  machine.transitions = machine.transitions.filter((transition) => (
    transition.from !== stateName && transition.to !== stateName
  ));
  if (machine.initialState === stateName) {
    machine.initialState = machine.states[0]?.name ?? '';
  }
}

function addStateMachineParameter(machine: Suwol2DStateMachine): void {
  const name = uniqueName('parameter', machine.parameters.map((parameter) => parameter.name));
  machine.parameters.push({
    name,
    type: 'bool',
    defaultBool: false
  });
}

function deleteStateMachineParameter(machine: Suwol2DStateMachine, parameterName: string): void {
  machine.parameters = machine.parameters.filter((parameter) => parameter.name !== parameterName);
  for (const transition of machine.transitions) {
    transition.conditions = transition.conditions.filter((condition) => condition.parameter !== parameterName);
  }
}

function addStateMachineTransition(machine: Suwol2DStateMachine): void {
  const from = machine.states[0]?.name ?? '*';
  const to = machine.states[1]?.name ?? machine.states[0]?.name ?? '';
  machine.transitions.push({
    from,
    to,
    fadeDuration: 0.15,
    conditions: []
  });
}

function addStateMachineCondition(machine: Suwol2DStateMachine, transitionIndex: number): void {
  const parameter = machine.parameters[0];
  if (!parameter) {
    return;
  }

  machine.transitions[transitionIndex].conditions.push(createConditionForParameter(parameter));
}

function updateStateMachineConditionParameter(machine: Suwol2DStateMachine, transitionIndex: number, conditionIndex: number, parameterName: string): void {
  const parameter = machine.parameters.find((candidate) => candidate.name === parameterName);
  if (!parameter) {
    return;
  }

  machine.transitions[transitionIndex].conditions[conditionIndex] = createConditionForParameter(parameter);
}

function normalizeConditionsForParameter(machine: Suwol2DStateMachine, parameterName: string, type: 'bool' | 'trigger'): void {
  for (const transition of machine.transitions) {
    for (const condition of transition.conditions) {
      if (condition.parameter !== parameterName) {
        continue;
      }

      if (type === 'trigger') {
        condition.mode = 'triggered';
        delete condition.boolValue;
      } else {
        condition.mode = 'equals';
        condition.boolValue ??= false;
      }
    }
  }
}

function createConditionForParameter(parameter: Suwol2DStateMachine['parameters'][number]): Suwol2DTransitionCondition {
  if (parameter.type === 'trigger') {
    return { parameter: parameter.name, mode: 'triggered' };
  }

  return { parameter: parameter.name, mode: 'equals', boolValue: parameter.defaultBool === true };
}

function moveSlotDrawOrder(
  document: Suwol2DDocument,
  updateDocument: (updater: (document: Suwol2DDocument) => void) => void,
  slotName: string,
  direction: -1 | 1
) {
  const orderedSlots = [...document.slots].sort((a, b) => a.drawOrder - b.drawOrder || a.name.localeCompare(b.name));
  const index = orderedSlots.findIndex((slot) => slot.name === slotName);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= orderedSlots.length) {
    return;
  }

  updateDocument((draft) => {
    normalizeSlotDrawOrders(draft);
    const draftOrderedSlots = [...draft.slots].sort((a, b) => a.drawOrder - b.drawOrder || a.name.localeCompare(b.name));
    const current = draftOrderedSlots[index];
    const next = draftOrderedSlots[nextIndex];
    const currentOrder = current.drawOrder;
    current.drawOrder = next.drawOrder;
    next.drawOrder = currentOrder;
  });
}

function normalizeSlotDrawOrder(updateDocument: (updater: (document: Suwol2DDocument) => void) => void) {
  updateDocument((draft) => {
    normalizeSlotDrawOrders(draft);
  });
}

function normalizeSlotDrawOrders(document: Suwol2DDocument): void {
  [...document.slots]
    .sort((a, b) => a.drawOrder - b.drawOrder || a.name.localeCompare(b.name))
    .forEach((slot, index) => {
      slot.drawOrder = index;
    });
}

function validateRenameName(
  value: string,
  oldName: string,
  existingNames: string[],
  typeLabel: string,
  setStatus: (status: string) => void
): string | null {
  const safeName = sanitizeEntityName(value);
  if (!safeName) {
    setStatus(`${typeLabel} name cannot be empty.`);
    return null;
  }

  if (safeName === oldName) {
    return safeName;
  }

  if (existingNames.some((name) => name === safeName)) {
    setStatus(`Duplicate ${typeLabel} name is not allowed: ${safeName}`);
    return null;
  }

  return safeName;
}

function findBone(document: Suwol2DDocument, name: string): Suwol2DBone {
  const bone = document.bones.find((candidate) => candidate.name === name);
  if (!bone) throw new Error(`Bone not found: ${name}`);
  return bone;
}

function findSlot(document: Suwol2DDocument, name: string): Suwol2DSlot {
  const slot = document.slots.find((candidate) => candidate.name === name);
  if (!slot) throw new Error(`Slot not found: ${name}`);
  return slot;
}

function ensureMutableSkin(document: Suwol2DDocument, skinName: string) {
  ensureDefaultSkin(document);
  const skin = document.skins.find((candidate) => candidate.name === skinName)
    ?? document.skins.find((candidate) => candidate.name === defaultSkinName);
  if (!skin) {
    throw new Error(`Skin not found: ${skinName}`);
  }

  skin.attachments = Array.isArray(skin.attachments) ? skin.attachments : [];
  return skin;
}

function findAttachmentForEdit(document: Suwol2DDocument, activeSkinName: string, name: string): Suwol2DAttachment | undefined {
  return getActiveSkin(document, activeSkinName).attachments.find((candidate) => candidate.name === name)
    ?? getDefaultSkin(document).attachments.find((candidate) => candidate.name === name)
    ?? collectSkinAttachments(document).find((candidate) => candidate.name === name)
    ?? document.attachments.find((candidate) => candidate.name === name);
}

function findAttachmentInSkinForEdit(document: Suwol2DDocument, activeSkinName: string, name: string): Suwol2DAttachment {
  const skin = ensureMutableSkin(document, activeSkinName);
  const attachment = skin.attachments.find((candidate) => candidate.name === name);
  if (!attachment) {
    throw new Error(`Attachment not found in skin '${skin.name}': ${name}`);
  }

  return attachment;
}

function findAttachment(document: Suwol2DDocument, name: string): Suwol2DAttachment {
  const attachment = collectSkinAttachments(document).find((candidate) => candidate.name === name)
    ?? document.attachments.find((candidate) => candidate.name === name);
  if (!attachment) throw new Error(`Attachment not found: ${name}`);
  return attachment;
}

function findRegionAttachment(document: Suwol2DDocument, name: string): Suwol2DRegionAttachment {
  const attachment = findAttachment(document, name);
  if (attachment.type !== 'region') throw new Error(`Region attachment not found: ${name}`);
  return attachment;
}

function findRegionAttachmentForEdit(document: Suwol2DDocument, activeSkinName: string, name: string): Suwol2DRegionAttachment {
  const attachment = findAttachmentInSkinForEdit(document, activeSkinName, name);
  if (attachment.type !== 'region') throw new Error(`Region attachment not found in active skin: ${name}`);
  return attachment;
}

function findMeshAttachment(document: Suwol2DDocument, name: string): Suwol2DMeshAttachment {
  const attachment = findAttachment(document, name);
  if (attachment.type !== 'mesh') throw new Error(`Mesh attachment not found: ${name}`);
  return attachment;
}

function findMeshAttachmentForEdit(document: Suwol2DDocument, activeSkinName: string, name: string): Suwol2DMeshAttachment {
  const attachment = findAttachmentInSkinForEdit(document, activeSkinName, name);
  if (attachment.type !== 'mesh') throw new Error(`Mesh attachment not found in active skin: ${name}`);
  return attachment;
}

function findAnimation(document: Suwol2DDocument, name: string): Suwol2DAnimation {
  const animation = document.animations.find((candidate) => candidate.name === name);
  if (!animation) throw new Error(`Animation not found: ${name}`);
  return animation;
}

function findIkConstraint(document: Suwol2DDocument, name: string): Suwol2DIkConstraint {
  const constraint = (document.ikConstraints ?? []).find((candidate) => candidate.name === name);
  if (!constraint) throw new Error(`IK constraint not found: ${name}`);
  return constraint;
}

function findStateMachine(document: Suwol2DDocument, name: string): Suwol2DStateMachine {
  const machine = (document.stateMachines ?? []).find((candidate) => candidate.name === name);
  if (!machine) throw new Error(`State machine not found: ${name}`);
  return machine;
}

function findDeformTimeline(animation: Suwol2DAnimation, attachment: Suwol2DMeshAttachment): Suwol2DDeformTimeline | undefined {
  return (animation.deforms ?? []).find((timeline) => (
    timeline.slot === attachment.slot && timeline.attachment === attachment.name
  ));
}

function findAttachmentTimeline(animation: Suwol2DAnimation, slotName: string): Suwol2DAttachmentTimeline | undefined {
  return (animation.attachments ?? []).find((timeline) => timeline.slot === slotName);
}

function getOrCreateAttachmentTimeline(animation: Suwol2DAnimation, slotName: string): Suwol2DAttachmentTimeline {
  animation.attachments ??= [];
  let timeline = findAttachmentTimeline(animation, slotName);
  if (!timeline) {
    timeline = { slot: slotName, keys: [] };
    animation.attachments.push(timeline);
    animation.attachments.sort((a, b) => a.slot.localeCompare(b.slot));
  }
  return timeline;
}

function addOrReplaceAttachmentKey(timeline: Suwol2DAttachmentTimeline, time: number, attachment: string | null): Suwol2DAttachmentKey {
  const safeTime = Math.max(0, round(time));
  const existing = timeline.keys.find((key) => Math.abs(key.time - safeTime) < 0.0001);
  if (existing) {
    existing.attachment = attachment || null;
    return existing;
  }

  const key = { time: safeTime, attachment: attachment || null };
  timeline.keys.push(key);
  timeline.keys.sort(sortByTime);
  return key;
}

function findSlotTimeline(animation: Suwol2DAnimation, slotName: string): Suwol2DSlotTimeline | undefined {
  return (animation.slots ?? []).find((timeline) => timeline.slot === slotName);
}

function getOrCreateSlotTimeline(animation: Suwol2DAnimation, slotName: string): Suwol2DSlotTimeline {
  animation.slots ??= [];
  let timeline = findSlotTimeline(animation, slotName);
  if (!timeline) {
    timeline = { slot: slotName, color: [] };
    animation.slots.push(timeline);
    animation.slots.sort((a, b) => a.slot.localeCompare(b.slot));
  }
  timeline.color ??= [];
  return timeline;
}

function addOrReplaceSlotColorKey(timeline: Suwol2DSlotTimeline, time: number): Suwol2DSlotColorKey {
  timeline.color ??= [];
  const safeTime = Math.max(0, round(time));
  const existing = timeline.color.find((key) => Math.abs(key.time - safeTime) < 0.0001);
  if (existing) {
    return existing;
  }

  const key = { time: safeTime, r: 1, g: 1, b: 1, a: 1 };
  timeline.color.push(key);
  timeline.color.sort(sortByTime);
  return key;
}

function addOrReplaceDrawOrderKey(keys: Suwol2DDrawOrderKey[], time: number, slots: Suwol2DSlot[]): Suwol2DDrawOrderKey {
  const safeTime = Math.max(0, round(time));
  const existing = keys.find((key) => Math.abs(key.time - safeTime) < 0.0001);
  const nextSlots = slots
    .map((slot, index) => ({ slot: slot.name, drawOrder: index }))
    .sort((a, b) => a.drawOrder - b.drawOrder || a.slot.localeCompare(b.slot));
  if (existing) {
    existing.slots = nextSlots;
    return existing;
  }

  const key = { time: safeTime, slots: nextSlots };
  keys.push(key);
  keys.sort(sortByTime);
  return key;
}

function setupDrawOrderSlots(document: Suwol2DDocument) {
  return [...document.slots]
    .sort((a, b) => a.drawOrder - b.drawOrder || a.name.localeCompare(b.name))
    .map((slot, index) => ({ slot: slot.name, drawOrder: index }));
}

function moveDrawOrderEntry(key: Suwol2DDrawOrderKey | undefined, index: number, direction: -1 | 1): void {
  if (!key) {
    return;
  }

  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= key.slots.length) {
    return;
  }

  const ordered = [...key.slots].sort((a, b) => a.drawOrder - b.drawOrder || a.slot.localeCompare(b.slot));
  const current = ordered[index];
  const next = ordered[nextIndex];
  const currentOrder = current.drawOrder;
  current.drawOrder = next.drawOrder;
  next.drawOrder = currentOrder;
  key.slots = ordered.sort((a, b) => a.drawOrder - b.drawOrder || a.slot.localeCompare(b.slot));
}

function addEventKey(events: Suwol2DEventKey[], time: number): Suwol2DEventKey {
  const safeTime = Math.max(0, round(time));
  const key = {
    time: safeTime,
    name: 'event',
    intValue: 0,
    floatValue: 0,
    stringValue: ''
  };
  events.push(key);
  events.sort(sortByTime);
  return key;
}

function cleanupV8Timelines(animation: Suwol2DAnimation): void {
  animation.attachments = (animation.attachments ?? []).filter((timeline) => timeline.keys.length > 0);
  if (animation.attachments.length === 0) animation.attachments = undefined;

  animation.drawOrders = (animation.drawOrders ?? []).filter((key) => key.slots.length > 0);
  if (animation.drawOrders.length === 0) animation.drawOrders = undefined;

  animation.slots = (animation.slots ?? []).filter((timeline) => (timeline.color ?? []).length > 0);
  if (animation.slots.length === 0) animation.slots = undefined;

  animation.events = animation.events ?? [];
  if (animation.events.length === 0) animation.events = undefined;
}

function getOrCreateDeformTimeline(animation: Suwol2DAnimation, attachment: Suwol2DMeshAttachment): Suwol2DDeformTimeline {
  animation.deforms ??= [];
  let timeline = findDeformTimeline(animation, attachment);
  if (!timeline) {
    timeline = {
      slot: attachment.slot,
      attachment: attachment.name,
      keys: []
    };
    animation.deforms.push(timeline);
    animation.deforms.sort((a, b) => a.slot.localeCompare(b.slot) || a.attachment.localeCompare(b.attachment));
  }
  return timeline;
}

function addOrReplaceDeformKey(animation: Suwol2DAnimation, attachment: Suwol2DMeshAttachment, time: number): Suwol2DDeformKey {
  return addOrReplaceDeformKeyInTimeline(getOrCreateDeformTimeline(animation, attachment), attachment, time);
}

function addOrReplaceDeformKeyInTimeline(timeline: Suwol2DDeformTimeline, attachment: Suwol2DMeshAttachment, time: number): Suwol2DDeformKey {
  const safeTime = Math.max(0, round(time));
  const existing = timeline.keys.find((key) => Math.abs(key.time - safeTime) < 0.0001);
  if (existing) {
    return existing;
  }

  const key = {
    time: safeTime,
    offsets: createZeroDeformOffsets(attachment.vertices.length)
  };
  timeline.keys.push(key);
  timeline.keys.sort(sortByTime);
  return key;
}

function createZeroDeformOffsets(vertexCount: number): Suwol2DVertexOffset[] {
  return Array.from({ length: vertexCount }, (_, vertex) => ({ vertex, x: 0, y: 0 }));
}

function findVertexOffset(key: Suwol2DDeformKey, vertex: number): Suwol2DVertexOffset | undefined {
  return key.offsets.find((offset) => offset.vertex === vertex);
}

function getOrCreateVertexOffset(key: Suwol2DDeformKey, vertex: number): Suwol2DVertexOffset {
  let offset = findVertexOffset(key, vertex);
  if (!offset) {
    offset = { vertex, x: 0, y: 0 };
    key.offsets.push(offset);
    key.offsets.sort((a, b) => a.vertex - b.vertex);
  }
  return offset;
}

function removeDeformTimeline(animation: Suwol2DAnimation, slotName: string, attachmentName: string): void {
  animation.deforms = (animation.deforms ?? []).filter((timeline) => (
    timeline.slot !== slotName || timeline.attachment !== attachmentName
  ));
  if (animation.deforms.length === 0) {
    animation.deforms = undefined;
  }
}

function removeDeformTimelinesForAttachment(document: Suwol2DDocument, attachmentName: string): void {
  for (const animation of document.animations) {
    animation.deforms = (animation.deforms ?? []).filter((timeline) => timeline.attachment !== attachmentName);
    if (animation.deforms.length === 0) {
      animation.deforms = undefined;
    }
  }
}

function removeDeformTimelinesForSlot(document: Suwol2DDocument, slotName: string): void {
  for (const animation of document.animations) {
    animation.deforms = (animation.deforms ?? []).filter((timeline) => timeline.slot !== slotName);
    if (animation.deforms.length === 0) {
      animation.deforms = undefined;
    }
  }
}

function createDefaultRegionAttachment(name: string, slotName: string, image: ImportedImage | undefined): Suwol2DRegionAttachment {
  return {
    name,
    slot: slotName,
    type: 'region',
    image: image?.name ?? '',
    x: 0,
    y: 0,
    rotation: 0,
    width: image ? image.width : 1,
    height: image ? image.height : 1,
    scaleX: 1,
    scaleY: 1
  };
}

function createDefaultMeshAttachment(name: string, slotName: string, image: ImportedImage | undefined): Suwol2DMeshAttachment {
  const size = meshSizeForImage(image);
  return {
    name,
    slot: slotName,
    type: 'mesh',
    image: image?.name ?? '',
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    vertices: createQuadMeshVertices(size.width, size.height),
    triangles: [0, 1, 2, 0, 2, 3]
  };
}

function convertToMeshAttachment(attachment: Suwol2DAttachment, image: ImportedImage | undefined): Suwol2DMeshAttachment {
  if (attachment.type === 'mesh') {
    return attachment;
  }

  const width = attachment.width > 0 ? attachment.width : meshSizeForImage(image).width;
  const height = attachment.height > 0 ? attachment.height : meshSizeForImage(image).height;
  return {
    name: attachment.name,
    slot: attachment.slot,
    type: 'mesh',
    image: attachment.image,
    x: attachment.x,
    y: attachment.y,
    rotation: attachment.rotation,
    scaleX: attachment.scaleX,
    scaleY: attachment.scaleY,
    vertices: createQuadMeshVertices(width, height),
    triangles: [0, 1, 2, 0, 2, 3]
  };
}

function convertToRegionAttachment(attachment: Suwol2DAttachment, image: ImportedImage | undefined): Suwol2DRegionAttachment {
  if (attachment.type === 'region') {
    return attachment;
  }

  const bounds = getMeshBounds(attachment.vertices);
  const size = meshSizeForImage(image);
  return {
    name: attachment.name,
    slot: attachment.slot,
    type: 'region',
    image: attachment.image,
    x: attachment.x,
    y: attachment.y,
    rotation: attachment.rotation,
    width: bounds ? bounds.width : size.width,
    height: bounds ? bounds.height : size.height,
    scaleX: attachment.scaleX,
    scaleY: attachment.scaleY
  };
}

function replaceAttachment(document: Suwol2DDocument, attachmentName: string, nextAttachment: Suwol2DAttachment): void {
  for (const skin of getEffectiveSkins(document)) {
    const index = skin.attachments.findIndex((attachment) => attachment.name === attachmentName);
    if (index >= 0) {
      skin.attachments[index] = nextAttachment;
      return;
    }
  }

  const topLevelIndex = document.attachments.findIndex((attachment) => attachment.name === attachmentName);
  if (topLevelIndex >= 0) {
    document.attachments[topLevelIndex] = nextAttachment;
  }
}

function replaceAttachmentInSkin(
  document: Suwol2DDocument,
  activeSkinName: string,
  attachmentName: string,
  nextAttachment: Suwol2DAttachment
): void {
  const skin = ensureMutableSkin(document, activeSkinName);
  const index = skin.attachments.findIndex((attachment) => attachment.name === attachmentName);
  if (index >= 0) {
    skin.attachments[index] = nextAttachment;
    return;
  }

  throw new Error(`Attachment not found in skin '${skin.name}': ${attachmentName}`);
}

function resetMeshAttachment(attachment: Suwol2DMeshAttachment, image: ImportedImage | undefined): void {
  const size = meshSizeForImage(image);
  attachment.vertices = createQuadMeshVertices(size.width, size.height);
  attachment.triangles = [0, 1, 2, 0, 2, 3];
  attachment.weights = undefined;
}

function createQuadMeshVertices(width: number, height: number): Suwol2DMeshVertex[] {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  return [
    { x: -halfWidth, y: -halfHeight, u: 0, v: 0 },
    { x: halfWidth, y: -halfHeight, u: 1, v: 0 },
    { x: halfWidth, y: halfHeight, u: 1, v: 1 },
    { x: -halfWidth, y: halfHeight, u: 0, v: 1 }
  ];
}

function meshSizeForImage(image: ImportedImage | undefined): { width: number; height: number } {
  if (!image || image.width <= 0 || image.height <= 0) {
    return { width: 1, height: 1 };
  }

  return {
    width: Math.max(0.1, image.width / 100),
    height: Math.max(0.1, image.height / 100)
  };
}

function getMeshBounds(vertices: Suwol2DMeshVertex[]): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } | null {
  if (vertices.length === 0) {
    return null;
  }

  let minX = vertices[0].x;
  let maxX = vertices[0].x;
  let minY = vertices[0].y;
  let maxY = vertices[0].y;
  for (const vertex of vertices) {
    minX = Math.min(minX, vertex.x);
    maxX = Math.max(maxX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxY = Math.max(maxY, vertex.y);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(0.001, maxX - minX),
    height: Math.max(0.001, maxY - minY)
  };
}

function chunkTriangleIndices(triangles: number[]): number[][] {
  const rows: number[][] = [];
  for (let index = 0; index < triangles.length; index += 3) {
    rows.push([triangles[index] ?? 0, triangles[index + 1] ?? 0, triangles[index + 2] ?? 0]);
  }
  return rows;
}

function findVertexWeight(attachment: Suwol2DMeshAttachment, vertex: number) {
  return attachment.weights?.find((weight) => weight.vertex === vertex);
}

function getOrCreateVertexWeight(attachment: Suwol2DMeshAttachment, vertex: number) {
  attachment.weights ??= [];
  let vertexWeight = attachment.weights.find((weight) => weight.vertex === vertex);
  if (!vertexWeight) {
    vertexWeight = { vertex, bones: [] };
    attachment.weights.push(vertexWeight);
    attachment.weights.sort((a, b) => a.vertex - b.vertex);
  }
  return vertexWeight;
}

function addBoneWeight(attachment: Suwol2DMeshAttachment, vertex: number, boneName: string): void {
  if (!boneName) {
    return;
  }

  const vertexWeight = getOrCreateVertexWeight(attachment, vertex);
  vertexWeight.bones.push({ bone: boneName, weight: vertexWeight.bones.length === 0 ? 1 : 0 });
}

function normalizeVertexWeight(attachment: Suwol2DMeshAttachment, vertex: number): void {
  const vertexWeight = findVertexWeight(attachment, vertex);
  if (!vertexWeight || vertexWeight.bones.length === 0) {
    return;
  }

  normalizeBoneWeights(vertexWeight.bones);
}

function normalizeAllVertexWeights(attachment: Suwol2DMeshAttachment): void {
  for (const vertexWeight of attachment.weights ?? []) {
    normalizeBoneWeights(vertexWeight.bones);
  }
}

function normalizeBoneWeights(weights: Suwol2DBoneWeight[]): void {
  const positiveWeights = weights.filter((weight) => weight.weight > 0 && Number.isFinite(weight.weight));
  const sum = positiveWeights.reduce((total, weight) => total + weight.weight, 0);
  if (sum <= 0) {
    const fallback = weights.length > 0 ? 1 / weights.length : 0;
    for (const weight of weights) {
      weight.weight = fallback;
    }
    return;
  }

  for (const weight of weights) {
    weight.weight = Math.max(0, weight.weight) / sum;
  }
}

function autoRigidWeights(attachment: Suwol2DMeshAttachment, boneName: string): void {
  if (!boneName) {
    return;
  }

  attachment.weights = attachment.vertices.map((_, index) => ({
    vertex: index,
    bones: [{ bone: boneName, weight: 1 }]
  }));
}

function cleanupEmptyWeights(attachment: Suwol2DMeshAttachment): void {
  attachment.weights = (attachment.weights ?? []).filter((weight) => weight.bones.length > 0);
  if (attachment.weights.length === 0) {
    attachment.weights = undefined;
  }
}

function firstAvailableBone(document: Suwol2DDocument, weights: Suwol2DBoneWeight[]): string {
  const usedBones = new Set(weights.map((weight) => weight.bone));
  return document.bones.find((bone) => !usedBones.has(bone.name))?.name ?? document.bones[0]?.name ?? '';
}

function mergeImages(existing: ImportedImage[], incoming: ImportedImage[]): ImportedImage[] {
  const result = [...existing];
  for (const image of incoming) {
    if (!result.some((candidate) => candidate.relativePath === image.relativePath)) {
      result.push(image);
    }
  }
  return result;
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number, centerX: number, centerY: number) {
  context.strokeStyle = '#202833';
  context.lineWidth = 1;
  for (let x = centerX % 40; x < width; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = centerY % 40; y < height; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.strokeStyle = '#46515e';
  context.beginPath();
  context.moveTo(centerX, 0);
  context.lineTo(centerX, height);
  context.moveTo(0, centerY);
  context.lineTo(width, centerY);
  context.stroke();
}

function drawMeshPreview(
  context: CanvasRenderingContext2D,
  attachment: Suwol2DMeshAttachment,
  image: HTMLImageElement | undefined,
  unitScale: number,
  selected: boolean,
  deformOffsets: Array<{ x: number; y: number }> = [],
  selectedVertices: Set<number> = new Set()
) {
  const vertices = getDeformedPreviewVertices(attachment, deformOffsets);
  const bounds = getMeshBounds(vertices);
  if (bounds && image) {
    context.save();
    context.globalAlpha = 0.28;
    context.drawImage(
      image,
      bounds.minX * unitScale,
      -bounds.maxY * unitScale,
      bounds.width * unitScale,
      bounds.height * unitScale
    );
    context.restore();
  }

  context.lineWidth = selected ? 3 : 2;
  context.strokeStyle = selected ? '#f2b84b' : '#8fd8cf';
  context.fillStyle = selected ? '#f2b84b' : '#1fb8a6';

  for (let index = 0; index < attachment.triangles.length; index += 3) {
    const a = vertices[attachment.triangles[index]];
    const b = vertices[attachment.triangles[index + 1]];
    const c = vertices[attachment.triangles[index + 2]];
    if (!a || !b || !c) {
      continue;
    }

    context.beginPath();
    context.moveTo(a.x * unitScale, -a.y * unitScale);
    context.lineTo(b.x * unitScale, -b.y * unitScale);
    context.lineTo(c.x * unitScale, -c.y * unitScale);
    context.closePath();
    context.stroke();
  }

  const weightedVertices = new Set((attachment.weights ?? []).map((weight) => weight.vertex));
  for (let index = 0; index < vertices.length; index += 1) {
    const vertex = vertices[index];
    const vertexSelected = selectedVertices.has(index);
    context.beginPath();
    context.arc(vertex.x * unitScale, -vertex.y * unitScale, vertexSelected ? 7 : selected ? 5 : 4, 0, Math.PI * 2);
    context.fillStyle = vertexSelected ? '#f2b84b' : weightedVertices.has(index) ? '#e879f9' : selected ? '#f2b84b' : '#1fb8a6';
    context.fill();
    if (vertexSelected) {
      context.lineWidth = 2;
      context.strokeStyle = '#ffffff';
      context.stroke();
    }
  }
}

function tintRegionPreview(
  context: CanvasRenderingContext2D,
  color: { r: number; g: number; b: number; a: number },
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (Math.abs(color.r - 1) < 0.001 && Math.abs(color.g - 1) < 0.001 && Math.abs(color.b - 1) < 0.001) {
    return;
  }

  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, color.a));
  context.globalCompositeOperation = 'multiply';
  context.fillStyle = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
  context.fillRect(x, y, width, height);
  context.restore();
}

function getDeformedPreviewVertices(attachment: Suwol2DMeshAttachment, deformOffsets: Array<{ x: number; y: number }>): Suwol2DMeshVertex[] {
  return attachment.vertices.map((vertex, index) => {
    const offset = deformOffsets[index] ?? { x: 0, y: 0 };
    return {
      ...vertex,
      x: vertex.x + offset.x,
      y: vertex.y + offset.y
    };
  });
}

function findCachedImage(cache: Map<string, HTMLImageElement>, imageName: string): HTMLImageElement | undefined {
  const direct = cache.get(imageName);
  if (direct) {
    return direct;
  }

  const normalized = normalizeLookupName(imageName);
  for (const [key, image] of cache) {
    if (normalizeLookupName(key) === normalized) {
      return image;
    }
  }

  return undefined;
}

function resolveExactSlotAttachment(
  document: Suwol2DDocument,
  activeSkinName: string,
  slotName: string,
  attachmentName: string
): Suwol2DAttachment | undefined {
  if (!attachmentName) {
    return undefined;
  }

  const active = getActiveSkin(document, activeSkinName).attachments.find((attachment) => (
    attachment.slot === slotName && attachment.name === attachmentName
  ));
  if (active) {
    return active;
  }

  const fallback = getDefaultSkin(document).attachments.find((attachment) => (
    attachment.slot === slotName && attachment.name === attachmentName
  ));
  if (fallback) {
    return fallback;
  }

  return document.attachments.find((attachment) => (
    attachment.slot === slotName && attachment.name === attachmentName
  ));
}

function normalizeLookupName(value: string): string {
  const fileName = value.replace(/\\/g, '/').split('/').pop() ?? value;
  return fileName.replace(/\.[^.]+$/, '').toLowerCase();
}

function splitTimelineTarget(target: string): [string, string] {
  const separator = target.indexOf('/');
  if (separator < 0) {
    return [target, ''];
  }

  return [target.slice(0, separator), target.slice(separator + 1)];
}

function normalizeSelection(selection: Selection | null, document: Suwol2DDocument, images: ImportedImage[]): Selection | null {
  if (!selection) {
    return null;
  }

  if (selection.type === 'image') {
    return images.some((image) => image.name === selection.name) ? selection : null;
  }

  if (selection.type === 'bone') {
    return document.bones.some((bone) => bone.name === selection.name) ? selection : null;
  }

  if (selection.type === 'slot') {
    return document.slots.some((slot) => slot.name === selection.name) ? selection : null;
  }

  if (selection.type === 'skin') {
    return getEffectiveSkins(document).some((skin) => skin.name === selection.name) ? selection : null;
  }

  if (selection.type === 'attachment') {
    return collectSkinAttachments(document).some((attachment) => attachment.name === selection.name) ? selection : null;
  }

  if (selection.type === 'animation') {
    return document.animations.some((animation) => animation.name === selection.name) ? selection : null;
  }

  if (selection.type === 'ikConstraint') {
    return (document.ikConstraints ?? []).some((constraint) => constraint.name === selection.name) ? selection : null;
  }

  if (selection.type === 'stateMachine') {
    return (document.stateMachines ?? []).some((machine) => machine.name === selection.name) ? selection : null;
  }

  if (selection.type === 'meshVertex') {
    const attachment = collectSkinAttachments(document).find((candidate) => candidate.name === selection.attachment);
    return attachment?.type === 'mesh' && selection.vertex >= 0 && selection.vertex < attachment.vertices.length
      ? selection
      : null;
  }

  const animation = document.animations.find((candidate) => candidate.name === selection.animation);
  const timeline = animation?.deforms?.find((deform) => (
    deform.slot === selection.slot && deform.attachment === selection.attachment
  ));
  return timeline?.keys.some((key) => Math.abs(key.time - selection.time) < 0.0001) ? selection : null;
}

function inferValidationSelection(issue: ValidationIssue, document: Suwol2DDocument): Selection | null {
  const message = issue.message.toLowerCase();
  if (message.includes('state machine')) {
    const machine = findNamedEntity((document.stateMachines ?? []).map((item) => item.name), issue.message);
    if (machine) return { type: 'stateMachine', name: machine };
  }

  if (message.includes('ik constraint')) {
    const constraint = findNamedEntity((document.ikConstraints ?? []).map((item) => item.name), issue.message);
    if (constraint) return { type: 'ikConstraint', name: constraint };
  }

  if (message.includes('skin')) {
    const skin = findNamedEntity(getEffectiveSkins(document).map((item) => item.name), issue.message);
    if (skin) return { type: 'skin', name: skin };
  }

  if (message.includes('attachment') || message.includes('mesh')) {
    const attachment = findNamedEntity(collectSkinAttachments(document).map((item) => item.name), issue.message);
    if (attachment) return { type: 'attachment', name: attachment };
  }

  if (message.includes('slot')) {
    const slot = findNamedEntity(document.slots.map((item) => item.name), issue.message);
    if (slot) return { type: 'slot', name: slot };
  }

  if (message.includes('bone')) {
    const bone = findNamedEntity(document.bones.map((item) => item.name), issue.message);
    if (bone) return { type: 'bone', name: bone };
  }

  if (message.includes('animation') || message.includes('deform')) {
    const animation = findNamedEntity(document.animations.map((item) => item.name), issue.message);
    if (animation) return { type: 'animation', name: animation };
  }

  return null;
}

function findNamedEntity(names: string[], message: string): string | null {
  return names.find((name) => message.includes(`'${name}'`) || message.includes(`: ${name}`)) ?? null;
}

function uniqueValues(values: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    output.push(value);
  }

  return output;
}

function sanitizeEntityName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function getCanvasPoint(canvas: HTMLCanvasElement, event: { clientX: number; clientY: number }): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  };
}

function clampZoom(value: number): number {
  return Math.max(0.1, Math.min(8, value));
}

function getPreviewWorldBounds(
  document: Suwol2DDocument,
  activeSkinName: string,
  animationName: string,
  time: number
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  const pose = sampleDocumentPose(document, animationName, time);
  let bounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
  const includePoint = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    if (!bounds) {
      bounds = { minX: x, maxX: x, minY: y, maxY: y };
      return;
    }

    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
  };

  for (const bone of pose.values()) {
    includePoint(bone.worldX, bone.worldY);
  }

  const animation = document.animations.find((candidate) => candidate.name === animationName);
  const attachmentOverrides = sampleAttachmentOverrides(animation, time);
  for (const slot of sampleDrawOrder(document, animation, time)) {
    const override = attachmentOverrides.get(slot.name);
    if (attachmentOverrides.has(slot.name) && !override) {
      continue;
    }

    const attachment = attachmentOverrides.has(slot.name)
      ? resolveExactSlotAttachment(document, activeSkinName, slot.name, override ?? '')
      : resolveSlotAttachment(document, activeSkinName, slot.name, slot.attachment);
    const bone = pose.get(slot.bone);
    if (!attachment || !bone) {
      continue;
    }

    const offset = rotatePoint(attachment.x * bone.worldScaleX, attachment.y * bone.worldScaleY, bone.worldRotation);
    const centerX = bone.worldX + offset.x;
    const centerY = bone.worldY + offset.y;
    const rotation = ((bone.worldRotation + attachment.rotation) * Math.PI) / 180;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const scaleX = bone.worldScaleX * attachment.scaleX;
    const scaleY = bone.worldScaleY * attachment.scaleY;
    const localPoints = attachment.type === 'region'
      ? [
        { x: -attachment.width / 2, y: -attachment.height / 2 },
        { x: attachment.width / 2, y: -attachment.height / 2 },
        { x: attachment.width / 2, y: attachment.height / 2 },
        { x: -attachment.width / 2, y: attachment.height / 2 }
      ]
      : getDeformedPreviewVertices(
        attachment,
        sampleDeformOffsets(animation, attachment.slot, attachment.name, attachment.vertices.length, time)
      );

    for (const point of localPoints) {
      const scaledX = point.x * scaleX;
      const scaledY = point.y * scaleY;
      includePoint(
        centerX + (scaledX * cos - scaledY * sin),
        centerY + (scaledX * sin + scaledY * cos)
      );
    }
  }

  return bounds;
}

function estimateBoneLength(document: Suwol2DDocument, boneName: string): number {
  const bone = document.bones.find((candidate) => candidate.name === boneName);
  if (!bone) {
    return 50;
  }

  if (Number.isFinite(bone.length) && (bone.length ?? 0) > 0) {
    return bone.length ?? 50;
  }

  const child = document.bones.find((candidate) => candidate.parent === boneName);
  if (child) {
    const distance = Math.hypot(child.x, child.y);
    if (distance > 0) {
      return round(distance);
    }
  }

  const slotNames = new Set(document.slots.filter((slot) => slot.bone === boneName).map((slot) => slot.name));
  for (const attachment of collectSkinAttachments(document)) {
    if (!slotNames.has(attachment.slot)) {
      continue;
    }

    if (attachment.type === 'region') {
      return round(Math.max(attachment.width, attachment.height));
    }

    const bounds = getMeshBounds(attachment.vertices);
    if (bounds) {
      return round(Math.max(bounds.width, bounds.height));
    }
  }

  return 50;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function sortByTime(a: { time: number }, b: { time: number }) {
  return a.time - b.time;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
