import type { Suwol2DAttachment, Suwol2DDocument, Suwol2DSkin } from './suwol2d-format';

export const defaultSkinName = 'default';

export function cloneAttachment<T extends Suwol2DAttachment>(attachment: T): T {
  return JSON.parse(JSON.stringify(attachment)) as T;
}

export function cloneAttachments(attachments: Suwol2DAttachment[]): Suwol2DAttachment[] {
  return attachments.map((attachment) => cloneAttachment(attachment));
}

export function getEffectiveSkins(document: Suwol2DDocument): Suwol2DSkin[] {
  const topLevelAttachments = document.attachments ?? [];
  const sourceSkins = Array.isArray(document.skins) && document.skins.length > 0
    ? document.skins
    : [{ name: defaultSkinName, attachments: topLevelAttachments }];

  const skins = sourceSkins.map((skin) => ({
    name: skin.name,
    attachments: Array.isArray(skin.attachments) ? skin.attachments : []
  }));

  if (!skins.some((skin) => skin.name === defaultSkinName)) {
    skins.unshift({ name: defaultSkinName, attachments: topLevelAttachments });
  }

  const defaultSkin = skins.find((skin) => skin.name === defaultSkinName);
  if (defaultSkin && defaultSkin.attachments.length === 0 && topLevelAttachments.length > 0) {
    defaultSkin.attachments = topLevelAttachments;
  }

  return skins;
}

export function ensureDefaultSkin(document: Suwol2DDocument): Suwol2DSkin {
  document.skins = Array.isArray(document.skins) ? document.skins : [];

  let skin = document.skins.find((candidate) => candidate.name === defaultSkinName);
  if (!skin) {
    skin = {
      name: defaultSkinName,
      attachments: cloneAttachments(document.attachments ?? [])
    };
    document.skins.unshift(skin);
  }

  skin.attachments = Array.isArray(skin.attachments) ? skin.attachments : [];
  if (skin.attachments.length === 0 && (document.attachments ?? []).length > 0) {
    skin.attachments = cloneAttachments(document.attachments);
  }

  return skin;
}

export function getSkin(document: Suwol2DDocument, skinName: string): Suwol2DSkin | undefined {
  return getEffectiveSkins(document).find((skin) => skin.name === skinName);
}

export function getDefaultSkin(document: Suwol2DDocument): Suwol2DSkin {
  return getEffectiveSkins(document).find((skin) => skin.name === defaultSkinName) ?? {
    name: defaultSkinName,
    attachments: []
  };
}

export function getActiveSkin(document: Suwol2DDocument, skinName: string): Suwol2DSkin {
  return getSkin(document, skinName) ?? getDefaultSkin(document);
}

export function getAttachmentsForSlot(
  document: Suwol2DDocument,
  skinName: string,
  slotName: string
): Suwol2DAttachment[] {
  return getActiveSkin(document, skinName).attachments.filter((attachment) => attachment.slot === slotName);
}

export function resolveSlotAttachment(
  document: Suwol2DDocument,
  skinName: string,
  slotName: string,
  attachmentName: string
): Suwol2DAttachment | undefined {
  const activeSkin = getActiveSkin(document, skinName);
  const defaultSkin = getDefaultSkin(document);
  const fallbackTopLevel = document.attachments.find((attachment) => (
    attachment.slot === slotName && attachment.name === attachmentName
  ));

  return findAttachmentInSkin(activeSkin, slotName, attachmentName)
    ?? findFirstAttachmentInSkinSlot(activeSkin, slotName)
    ?? findAttachmentInSkin(defaultSkin, slotName, attachmentName)
    ?? findFirstAttachmentInSkinSlot(defaultSkin, slotName)
    ?? fallbackTopLevel;
}

export function collectSkinAttachments(document: Suwol2DDocument): Suwol2DAttachment[] {
  return getEffectiveSkins(document).flatMap((skin) => skin.attachments);
}

export function collectUniqueAttachmentsByName(document: Suwol2DDocument): Suwol2DAttachment[] {
  const output: Suwol2DAttachment[] = [];
  const seen = new Set<string>();

  for (const attachment of collectSkinAttachments(document)) {
    const key = attachment.name;
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(attachment);
  }

  for (const attachment of document.attachments ?? []) {
    const key = attachment.name;
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(attachment);
  }

  return output;
}

export function syncTopLevelAttachmentsFromSkins(document: Suwol2DDocument): void {
  ensureDefaultSkin(document);
  const output: Suwol2DAttachment[] = [];
  const seen = new Set<string>();

  for (const skin of getEffectiveSkins(document)) {
    for (const attachment of skin.attachments) {
      if (!attachment.name || seen.has(attachment.name)) {
        continue;
      }

      seen.add(attachment.name);
      output.push(attachment);
    }
  }

  document.attachments = cloneAttachments(output);
}

export function attachmentExistsInAnySkin(
  document: Suwol2DDocument,
  slotName: string,
  attachmentName: string
): boolean {
  return collectSkinAttachments(document).some((attachment) => (
    attachment.slot === slotName && attachment.name === attachmentName
  ));
}

function findAttachmentInSkin(
  skin: Suwol2DSkin,
  slotName: string,
  attachmentName: string
): Suwol2DAttachment | undefined {
  if (!attachmentName) {
    return undefined;
  }

  return skin.attachments.find((attachment) => (
    attachment.slot === slotName && attachment.name === attachmentName
  ));
}

function findFirstAttachmentInSkinSlot(skin: Suwol2DSkin, slotName: string): Suwol2DAttachment | undefined {
  return skin.attachments.find((attachment) => attachment.slot === slotName);
}
