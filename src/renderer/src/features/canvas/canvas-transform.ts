import type { Suwol2DBaseAttachment } from '../../../../shared/suwol2d-format';
import type { WorldBonePose } from '../animation/sampler';
import { rotatePoint } from '../animation/sampler';

export interface CanvasView {
  zoom: number;
  panX: number;
  panY: number;
}

export interface CanvasFrame {
  width: number;
  height: number;
  view: CanvasView;
}

export interface AttachmentCanvasTransform {
  originX: number;
  originY: number;
  rotationRadians: number;
  scaleX: number;
  scaleY: number;
  unitScale: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export function getAttachmentCanvasTransform(
  bone: WorldBonePose,
  attachment: Suwol2DBaseAttachment,
  frame: CanvasFrame
): AttachmentCanvasTransform {
  const unitScale = 150 * frame.view.zoom;
  const centerX = frame.width / 2 + frame.view.panX;
  const centerY = frame.height / 2 + frame.view.panY;
  const offset = rotatePoint(attachment.x * bone.worldScaleX, attachment.y * bone.worldScaleY, bone.worldRotation);

  return {
    originX: centerX + (bone.worldX + offset.x) * unitScale,
    originY: centerY - (bone.worldY + offset.y) * unitScale,
    rotationRadians: (-(bone.worldRotation + attachment.rotation) * Math.PI) / 180,
    scaleX: bone.worldScaleX * attachment.scaleX,
    scaleY: bone.worldScaleY * attachment.scaleY,
    unitScale
  };
}

export function attachmentLocalToCanvas(point: Point2D, transform: AttachmentCanvasTransform): Point2D {
  const scaledX = point.x * transform.unitScale * safeScale(transform.scaleX);
  const scaledY = -point.y * transform.unitScale * safeScale(transform.scaleY);
  const cos = Math.cos(transform.rotationRadians);
  const sin = Math.sin(transform.rotationRadians);
  return {
    x: transform.originX + scaledX * cos - scaledY * sin,
    y: transform.originY + scaledX * sin + scaledY * cos
  };
}

export function canvasToAttachmentLocal(point: Point2D, transform: AttachmentCanvasTransform): Point2D {
  const dx = point.x - transform.originX;
  const dy = point.y - transform.originY;
  const cos = Math.cos(transform.rotationRadians);
  const sin = Math.sin(transform.rotationRadians);
  const scaledX = dx * cos + dy * sin;
  const scaledY = -dx * sin + dy * cos;
  return {
    x: scaledX / (transform.unitScale * safeScale(transform.scaleX)),
    y: -scaledY / (transform.unitScale * safeScale(transform.scaleY))
  };
}

function safeScale(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) < 0.0001) {
    return value < 0 ? -0.0001 : 0.0001;
  }

  return value;
}
