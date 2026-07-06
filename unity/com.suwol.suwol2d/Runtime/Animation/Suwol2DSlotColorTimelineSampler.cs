using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public static class Suwol2DSlotColorTimelineSampler
    {
        public static void Sample(Suwol2DAnimationData animation, float time, Dictionary<string, Color> output)
        {
            if (output == null)
            {
                return;
            }

            output.Clear();
            if (animation == null || animation.slots == null)
            {
                return;
            }

            for (var i = 0; i < animation.slots.Length; i++)
            {
                var timeline = animation.slots[i];
                if (timeline == null || string.IsNullOrEmpty(timeline.slot) || timeline.color == null || timeline.color.Length == 0)
                {
                    continue;
                }

                output[timeline.slot] = SampleColor(timeline.color, time);
            }
        }

        public static float GetDuration(Suwol2DSlotTimelineData[] timelines)
        {
            if (timelines == null)
            {
                return 0f;
            }

            var duration = 0f;
            for (var i = 0; i < timelines.Length; i++)
            {
                var timeline = timelines[i];
                if (timeline == null || timeline.color == null || timeline.color.Length == 0)
                {
                    continue;
                }

                duration = Mathf.Max(duration, timeline.color[timeline.color.Length - 1].time);
            }
            return duration;
        }

        private static Color SampleColor(Suwol2DSlotColorKeyData[] keys, float time)
        {
            if (keys.Length == 1 || time <= keys[0].time)
            {
                return ToColor(keys[0]);
            }

            var last = keys[keys.Length - 1];
            if (time >= last.time)
            {
                return ToColor(last);
            }

            for (var i = 0; i < keys.Length - 1; i++)
            {
                var previous = keys[i];
                var next = keys[i + 1];
                if (time > next.time)
                {
                    continue;
                }

                var t = Suwol2DInterpolation.Apply(
                    previous.interpolation,
                    Suwol2DInterpolation.InverseLerpClamped(previous.time, next.time, time));
                return Color.Lerp(ToColor(previous), ToColor(next), t);
            }

            return ToColor(last);
        }

        private static Color ToColor(Suwol2DSlotColorKeyData key)
        {
            if (key == null)
            {
                return Color.white;
            }

            return new Color(
                Mathf.Clamp01(key.r),
                Mathf.Clamp01(key.g),
                Mathf.Clamp01(key.b),
                Mathf.Clamp01(key.a));
        }
    }
}
