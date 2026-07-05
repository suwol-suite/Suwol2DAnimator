import type { Suwol2DMeshAttachment } from '../../../../shared/suwol2d-format';
import type { AttachmentCanvasTransform, Point2D } from './canvas-transform';
import { attachmentLocalToCanvas } from './canvas-transform';

export interface CanvasMeshTarget {
  attachment: Suwol2DMeshAttachment;
  transform: AttachmentCanvasTransform;
  deformOffsets: Point2D[];
}

export interface MeshVertexHit {
  attachmentName: string;
  vertex: number;
  distance: number;
  canvasPoint: Point2D;
  transform: AttachmentCanvasTransform;
}

export interface BrushVertexFalloff {
  vertex: number;
  falloff: number;
}

export function hitTestMeshVertex(targets: CanvasMeshTarget[], point: Point2D, radius: number): MeshVertexHit | null {
  let best: MeshVertexHit | null = null;
  for (const target of targets) {
    for (let vertexIndex = 0; vertexIndex < target.attachment.vertices.length; vertexIndex += 1) {
      const canvasPoint = getVertexCanvasPoint(target, vertexIndex);
      const distance = Math.hypot(canvasPoint.x - point.x, canvasPoint.y - point.y);
      if (distance > radius || (best && distance >= best.distance)) {
        continue;
      }

      best = {
        attachmentName: target.attachment.name,
        vertex: vertexIndex,
        distance,
        canvasPoint,
        transform: target.transform
      };
    }
  }

  return best;
}

export function collectBrushVertexFalloffs(target: CanvasMeshTarget, point: Point2D, radius: number): BrushVertexFalloff[] {
  const safeRadius = Math.max(1, radius);
  const falloffs: BrushVertexFalloff[] = [];
  for (let vertex = 0; vertex < target.attachment.vertices.length; vertex += 1) {
    const canvasPoint = getVertexCanvasPoint(target, vertex);
    const distance = Math.hypot(canvasPoint.x - point.x, canvasPoint.y - point.y);
    if (distance > safeRadius) {
      continue;
    }

    falloffs.push({
      vertex,
      falloff: Math.max(0, 1 - distance / safeRadius)
    });
  }

  return falloffs;
}

export function getVertexCanvasPoint(target: CanvasMeshTarget, vertexIndex: number): Point2D {
  const vertex = target.attachment.vertices[vertexIndex];
  const offset = target.deformOffsets[vertexIndex] ?? { x: 0, y: 0 };
  return attachmentLocalToCanvas(
    {
      x: vertex.x + offset.x,
      y: vertex.y + offset.y
    },
    target.transform
  );
}
