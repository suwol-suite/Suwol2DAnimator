import type { Suwol2DAnimation, Suwol2DBoneTimeline } from '../../../../shared/suwol2d-format';

export function getOrCreateTimeline(animation: Suwol2DAnimation, boneName: string): Suwol2DBoneTimeline {
  let timeline = animation.bones.find((candidate) => candidate.bone === boneName);
  if (!timeline) {
    timeline = {
      bone: boneName,
      translate: [],
      rotate: [],
      scale: []
    };
    animation.bones.push(timeline);
  }

  return timeline;
}
