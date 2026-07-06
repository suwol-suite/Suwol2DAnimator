import { ipcMain } from 'electron';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  chooseExportPath,
  chooseSuwol2DAssetExportPath,
  createExportAtlas,
  copyExportTextures,
  chooseProjectFile,
  chooseProjectParent,
  copySampleTextureToProject,
  ensureProjectFolders,
  hydrateImportedImage,
  importImageIntoProject,
  sanitizeFileName,
  writeJsonFile,
  writeProjectBackup
} from './file-ipc';
import {
  createEmptyProject,
  type HydratedProjectResult,
  type Suwol2DAtlasExportOptions,
  type Suwol2DProjectFile
} from '../../shared/suwol2d-format';
import { createUnityRuntimeExport } from '../../shared/export-suwol2d';

export interface ExportJsonResult {
  exportPath: string;
  texturePaths: string[];
  atlasPaths: string[];
}

export interface ExportSuwol2DAssetResult {
  exportPath: string;
  debugJsonPath: string;
  texturePaths: string[];
  atlasPaths: string[];
}

export function registerProjectIpc(): void {
  ipcMain.handle('project:create', async (_event, name: string): Promise<HydratedProjectResult | null> => {
    const parentPath = await chooseProjectParent();
    if (!parentPath) {
      return null;
    }

    const projectName = sanitizeFileName(name || 'Suwol2DProject');
    const projectPath = join(parentPath, projectName);
    const projectFilePath = join(projectPath, 'project.suwol2dproj.json');
    const project = createEmptyProject(projectName);

    await ensureProjectFolders(projectPath);
    await writeProject(projectFilePath, project);

    return { projectFilePath, projectPath, project };
  });

  ipcMain.handle('project:open', async (): Promise<HydratedProjectResult | null> => {
    const projectFilePath = await chooseProjectFile();
    if (!projectFilePath) {
      return null;
    }

    return readProject(projectFilePath);
  });

  ipcMain.handle(
    'project:save',
    async (_event, projectFilePath: string, project: Suwol2DProjectFile): Promise<HydratedProjectResult> => {
      await writeProject(projectFilePath, project);
      return readProject(projectFilePath);
    }
  );

  ipcMain.handle('project:import-image', async (_event, projectFilePath: string) => {
    const projectPath = dirname(projectFilePath);
    return importImageIntoProject(projectPath);
  });

  ipcMain.handle('project:create-sample-assets', async (_event, projectFilePath: string) => {
    const projectPath = dirname(projectFilePath);
    const body = await copySampleTextureToProject(projectPath, 'body.png');
    const arm = await copySampleTextureToProject(projectPath, 'arm.png');
    return [body, arm];
  });

  ipcMain.handle('project:create-skin-sample-assets', async (_event, projectFilePath: string) => {
    const projectPath = dirname(projectFilePath);
    const body = await copySampleTextureToProject(projectPath, 'body.png');
    const arm = await copySampleTextureToProject(projectPath, 'arm.png');
    const bodyArmor = await copySampleTextureToProject(projectPath, 'body_armor.png', 'SkinAttachmentSwapV6');
    const armArmor = await copySampleTextureToProject(projectPath, 'arm_armor.png', 'SkinAttachmentSwapV6');
    return [body, arm, bodyArmor, armArmor];
  });

  ipcMain.handle('project:create-animation-timelines-sample-assets', async (_event, projectFilePath: string) => {
    const projectPath = dirname(projectFilePath);
    const body = await copySampleTextureToProject(projectPath, 'body.png', 'AnimationTimelinesV8');
    const arm = await copySampleTextureToProject(projectPath, 'arm.png', 'AnimationTimelinesV8');
    const sword = await copySampleTextureToProject(projectPath, 'sword.png', 'AnimationTimelinesV8');
    const axe = await copySampleTextureToProject(projectPath, 'axe.png', 'AnimationTimelinesV8');
    return [body, arm, sword, axe];
  });

  ipcMain.handle('project:export-json', async (_event, projectFilePath: string, project: Suwol2DProjectFile, options?: Suwol2DAtlasExportOptions) => {
    const projectPath = dirname(projectFilePath);
    const document = createUnityRuntimeExport(project.document);
    const exportPath = await chooseExportPath(projectPath, document.name);
    if (!exportPath) {
      return null;
    }

    const atlasResult = await createExportAtlas(projectPath, exportPath, project.importedImages ?? [], document, normalizeAtlasExportOptions(options, document.name));
    if (atlasResult) {
      document.atlases = [atlasResult.atlas];
    }

    await writeJsonFile(exportPath, document);
    const texturePaths = await copyExportTextures(projectPath, exportPath, project.importedImages ?? [], document);
    return {
      exportPath,
      texturePaths,
      atlasPaths: atlasResult ? [atlasResult.atlasImagePath, atlasResult.atlasJsonPath] : []
    } satisfies ExportJsonResult;
  });

  ipcMain.handle('project:export-suwol2d', async (_event, projectFilePath: string, project: Suwol2DProjectFile, options?: Suwol2DAtlasExportOptions) => {
    const projectPath = dirname(projectFilePath);
    const document = createUnityRuntimeExport(project.document);
    const exportPath = await chooseSuwol2DAssetExportPath(projectPath, document.name);
    if (!exportPath) {
      return null;
    }

    const atlasResult = await createExportAtlas(projectPath, exportPath, project.importedImages ?? [], document, normalizeAtlasExportOptions(options, document.name));
    if (atlasResult) {
      document.atlases = [atlasResult.atlas];
    }

    const debugJsonPath = exportPath.endsWith('.json') ? exportPath : `${exportPath}.json`;
    await writeJsonFile(exportPath, document);
    await writeJsonFile(debugJsonPath, document);
    const texturePaths = await copyExportTextures(projectPath, exportPath, project.importedImages ?? [], document);
    return {
      exportPath,
      debugJsonPath,
      texturePaths,
      atlasPaths: atlasResult ? [atlasResult.atlasImagePath, atlasResult.atlasJsonPath] : []
    } satisfies ExportSuwol2DAssetResult;
  });

  ipcMain.handle('project:create-backup', async (_event, projectFilePath: string, project: Suwol2DProjectFile) => {
    return writeProjectBackup(projectFilePath, stripHydratedImageData(project));
  });
}

async function readProject(projectFilePath: string): Promise<HydratedProjectResult> {
  const raw = await readFile(projectFilePath, 'utf8');
  const project = JSON.parse(raw) as Suwol2DProjectFile;
  const projectPath = dirname(projectFilePath);
  project.importedImages = await Promise.all(
    (project.importedImages ?? []).map((image) => hydrateImportedImage(projectPath, image))
  );
  project.document.version = 0;
  return { projectFilePath, projectPath, project };
}

async function writeProject(projectFilePath: string, project: Suwol2DProjectFile): Promise<void> {
  const cleanProject = stripHydratedImageData(project);
  await ensureProjectFolders(dirname(projectFilePath));
  await writeJsonFile(projectFilePath, cleanProject);
}

function stripHydratedImageData(project: Suwol2DProjectFile): Suwol2DProjectFile {
  return {
    ...project,
    editorVersion: 0,
    importedImages: (project.importedImages ?? []).map((image) => {
      const { dataUrl: _dataUrl, ...persistedImage } = image;
      return persistedImage;
    })
  };
}

function normalizeAtlasExportOptions(options: Suwol2DAtlasExportOptions | undefined, documentName: string): Suwol2DAtlasExportOptions {
  return {
    createAtlas: options?.createAtlas === true,
    atlasName: options?.atlasName?.trim() || documentName || 'character',
    atlasMaxSize: sanitizeExportInteger(options?.atlasMaxSize, 2048, 64, 4096),
    atlasPadding: sanitizeExportInteger(options?.atlasPadding, 2, 0, 128)
  };
}

function sanitizeExportInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(value as number)));
}
