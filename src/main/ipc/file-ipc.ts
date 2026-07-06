import { app, BrowserWindow, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, parse, relative, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { nativeImage } from 'electron';
import type { ImportedImage, Suwol2DAtlas, Suwol2DAtlasExportOptions, Suwol2DDocument } from '../../shared/suwol2d-format';
import { createId, normalizeImageName } from '../../shared/ids';
import { collectSkinAttachments } from '../../shared/skins.ts';
import { packAtlasImages, type AtlasSourceImage } from '../atlas/atlas-packer';
import { readPngImageSize } from '../atlas/image-size';
import { writeAtlasPng } from '../atlas/png-compositor';

const imageExtensions = new Set(['.png', '.jpg', '.jpeg']);

export interface ExportAtlasResult {
  atlas: Suwol2DAtlas;
  atlasImagePath: string;
  atlasJsonPath: string;
  skippedImageNames: string[];
}

export function getFocusedWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

export function sanitizeFileName(value: string): string {
  const sanitized = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  return sanitized || 'Suwol2DProject';
}

export async function ensureProjectFolders(projectPath: string): Promise<void> {
  await mkdir(projectPath, { recursive: true });
  await mkdir(join(projectPath, 'images'), { recursive: true });
  await mkdir(join(projectPath, 'exports'), { recursive: true });
}

export async function chooseProjectParent(): Promise<string | null> {
  const result = await showOpenDialog({
    title: 'Choose a folder for the Suwol2D project',
    properties: ['openDirectory', 'createDirectory']
  });

  return result.canceled ? null : result.filePaths[0];
}

export async function chooseProjectFile(): Promise<string | null> {
  const result = await showOpenDialog({
    title: 'Open Suwol2D Project',
    properties: ['openFile'],
    filters: [{ name: 'Suwol2D Project', extensions: ['json'] }]
  });

  return result.canceled ? null : result.filePaths[0];
}

export async function chooseImageFile(): Promise<string | null> {
  const result = await showOpenDialog({
    title: 'Import Image',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
      { name: 'PNG', extensions: ['png'] }
    ]
  });

  return result.canceled ? null : result.filePaths[0];
}

export async function chooseExportPath(projectPath: string, defaultName: string): Promise<string | null> {
  const result = await showSaveDialog({
    title: 'Export Suwol2D JSON',
    defaultPath: join(projectPath, 'exports', `${sanitizeFileName(defaultName)}.suwol2d.json`),
    filters: [{ name: 'Suwol2D JSON', extensions: ['json'] }]
  });

  return result.canceled || !result.filePath ? null : result.filePath;
}

export async function chooseSuwol2DAssetExportPath(projectPath: string, defaultName: string): Promise<string | null> {
  const result = await showSaveDialog({
    title: 'Export Suwol2D Unity Importer Asset',
    defaultPath: join(projectPath, 'exports', `${sanitizeFileName(defaultName)}.suwol2d`),
    filters: [{ name: 'Suwol2D Importer Asset', extensions: ['suwol2d'] }]
  });

  return result.canceled || !result.filePath ? null : result.filePath;
}

export async function importImageIntoProject(projectPath: string, sourceImagePath?: string): Promise<ImportedImage | null> {
  const sourcePath = sourceImagePath ?? (await chooseImageFile());
  if (!sourcePath) {
    return null;
  }

  const extension = extname(sourcePath).toLowerCase();
  if (!imageExtensions.has(extension)) {
    throw new Error(`Unsupported image extension: ${extension}`);
  }

  await ensureProjectFolders(projectPath);

  const imagesPath = join(projectPath, 'images');
  const base = sanitizeFileName(parse(sourcePath).name);
  const fileName = await nextAvailableFileName(imagesPath, base, extension);
  const targetPath = join(imagesPath, fileName);

  if (resolve(sourcePath) !== resolve(targetPath)) {
    await copyFile(sourcePath, targetPath);
  }

  return readImportedImage(projectPath, targetPath);
}

export async function readImportedImage(projectPath: string, absoluteImagePath: string): Promise<ImportedImage> {
  const fileBuffer = await readFile(absoluteImagePath);
  const image = nativeImage.createFromBuffer(fileBuffer);
  const size = image.getSize();
  const fileName = basename(absoluteImagePath);
  const relativePath = toPortablePath(relative(projectPath, absoluteImagePath));
  const mimeType = getMimeType(absoluteImagePath);

  return {
    id: createId('img'),
    name: normalizeImageName(fileName),
    fileName,
    relativePath,
    width: size.width,
    height: size.height,
    mimeType,
    dataUrl: `data:${mimeType};base64,${fileBuffer.toString('base64')}`
  };
}

export async function hydrateImportedImage(projectPath: string, image: ImportedImage): Promise<ImportedImage> {
  const absolutePath = join(projectPath, image.relativePath);
  if (!existsSync(absolutePath)) {
    return image;
  }

  const hydrated = await readImportedImage(projectPath, absolutePath);
  return {
    ...image,
    width: image.width || hydrated.width,
    height: image.height || hydrated.height,
    mimeType: image.mimeType || hydrated.mimeType,
    dataUrl: hydrated.dataUrl
  };
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function writeProjectBackup(projectFilePath: string, data: unknown): Promise<string> {
  const projectDirectory = dirname(projectFilePath);
  const backupDirectory = join(projectDirectory, '.backups');
  const projectName = parse(projectFilePath).name || 'project';
  const timestamp = createBackupTimestamp(new Date());
  const backupPath = join(backupDirectory, `${sanitizeFileName(projectName)}.${timestamp}.suwol2dproj.json`);

  await mkdir(backupDirectory, { recursive: true });
  await writeJsonFile(backupPath, data);
  await pruneBackups(backupDirectory, 20);
  return backupPath;
}

export async function copyExportTextures(
  projectPath: string,
  exportPath: string,
  importedImages: ImportedImage[],
  document: Suwol2DDocument
): Promise<string[]> {
  const referencedImages = collectReferencedImageNames(document);

  if (referencedImages.size === 0 || importedImages.length === 0) {
    return [];
  }

  const texturesPath = join(dirname(exportPath), 'Textures');
  await mkdir(texturesPath, { recursive: true });
  const copiedPaths: string[] = [];

  for (const image of importedImages) {
    const candidates = [
      image.name,
      image.fileName,
      image.relativePath
    ].map(normalizeLookupName);

    if (!candidates.some((candidate) => referencedImages.has(candidate))) {
      continue;
    }

    const sourcePath = join(projectPath, image.relativePath);
    if (!existsSync(sourcePath)) {
      continue;
    }

    const targetPath = join(texturesPath, sanitizeFileName(image.fileName));
    await copyFile(sourcePath, targetPath);
    copiedPaths.push(targetPath);
  }

  return copiedPaths;
}

export async function createExportAtlas(
  projectPath: string,
  exportPath: string,
  importedImages: ImportedImage[],
  document: Suwol2DDocument,
  options: Suwol2DAtlasExportOptions
): Promise<ExportAtlasResult | null> {
  const referencedImages = collectReferencedImageNames(document);
  if (!options.createAtlas || referencedImages.size === 0 || importedImages.length === 0) {
    return null;
  }

  const atlasSources: AtlasSourceImage[] = [];
  const skippedImageNames: string[] = [];
  const seen = new Set<string>();

  for (const image of importedImages) {
    const candidates = [
      image.name,
      image.fileName,
      image.relativePath
    ].map(normalizeLookupName);

    const referencedName = candidates.find((candidate) => referencedImages.has(candidate));
    if (!referencedName || seen.has(referencedName)) {
      continue;
    }

    if (extname(image.fileName).toLowerCase() !== '.png') {
      skippedImageNames.push(image.fileName);
      continue;
    }

    const sourcePath = join(projectPath, image.relativePath);
    if (!existsSync(sourcePath)) {
      skippedImageNames.push(image.fileName);
      continue;
    }

    const size = await readPngImageSize(sourcePath);
    atlasSources.push({
      name: referencedName,
      sourcePath,
      width: size.width,
      height: size.height
    });
    seen.add(referencedName);
  }

  if (atlasSources.length === 0) {
    return null;
  }

  const atlasFolder = join(dirname(exportPath), 'Atlas');
  await mkdir(atlasFolder, { recursive: true });

  const atlasName = sanitizeFileName(options.atlasName || parse(exportPath).name || document.name || 'character');
  const atlasImageFileName = `${atlasName}.atlas.png`;
  const atlasJsonFileName = `${atlasName}.atlas.json`;
  const atlasImagePath = join(atlasFolder, atlasImageFileName);
  const atlasJsonPath = join(atlasFolder, atlasJsonFileName);
  const atlasImageReference = toPortablePath(join('Atlas', atlasImageFileName));

  const packedAtlas = packAtlasImages(atlasSources, {
    name: atlasName,
    image: atlasImageReference,
    maxSize: options.atlasMaxSize,
    padding: options.atlasPadding
  });

  await writeAtlasPng(packedAtlas, atlasImagePath);
  await writeJsonFile(atlasJsonPath, packedAtlas.atlas);

  return {
    atlas: packedAtlas.atlas,
    atlasImagePath,
    atlasJsonPath,
    skippedImageNames
  };
}

export async function copySampleTextureToProject(projectPath: string, textureName: string, sampleFolder = 'RuntimeMvp'): Promise<ImportedImage> {
  const finalSourcePath = resolveBundledSampleTexture(textureName, sampleFolder);
  return importImageIntoProject(projectPath, finalSourcePath) as Promise<ImportedImage>;
}

function resolveBundledSampleTexture(textureName: string, sampleFolder: string): string {
  const relativeTexturePath = join('unity', 'com.suwol.suwol2d', 'Samples~', sampleFolder, 'Textures', textureName);
  const candidates = [
    join(process.resourcesPath, relativeTexturePath),
    join(app.getAppPath(), '..', '..', relativeTexturePath),
    join(process.cwd(), relativeTexturePath)
  ];

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Sample texture not found: ${textureName}. Checked: ${candidates.join('; ')}`);
  }

  return found;
}

function getMimeType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }

  return 'image/png';
}

async function nextAvailableFileName(directory: string, baseName: string, extension: string): Promise<string> {
  let candidate = `${baseName}${extension}`;
  let index = 2;

  while (existsSync(join(directory, candidate))) {
    candidate = `${baseName}_${index}${extension}`;
    index += 1;
  }

  return candidate;
}

function toPortablePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function normalizeLookupName(value: string): string {
  const fileName = value.replace(/\\/g, '/').split('/').pop() ?? value;
  return fileName.replace(/\.[^.]+$/, '').toLowerCase();
}

function collectReferencedImageNames(document: Suwol2DDocument): Set<string> {
  return new Set(
    [...document.attachments, ...collectSkinAttachments(document)]
      .flatMap((attachment) => (
        (attachment.type === 'region' || attachment.type === 'mesh') && attachment.image
          ? [normalizeLookupName(attachment.image)]
          : []
      ))
  );
}

function createBackupTimestamp(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + '-' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
}

async function pruneBackups(backupDirectory: string, keepCount: number): Promise<void> {
  const entries = await readdir(backupDirectory);
  const backupEntries = await Promise.all(
    entries
      .filter((entry) => entry.endsWith('.suwol2dproj.json'))
      .map(async (entry) => {
        const filePath = join(backupDirectory, entry);
        const fileStat = await stat(filePath);
        return { filePath, time: fileStat.mtimeMs };
      })
  );

  backupEntries.sort((a, b) => b.time - a.time);
  for (const entry of backupEntries.slice(keepCount)) {
    await rm(entry.filePath, { force: true });
  }
}

function showOpenDialog(options: OpenDialogOptions) {
  const window = getFocusedWindow();
  return window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options);
}

function showSaveDialog(options: SaveDialogOptions) {
  const window = getFocusedWindow();
  return window ? dialog.showSaveDialog(window, options) : dialog.showSaveDialog(options);
}
