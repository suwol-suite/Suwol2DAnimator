using UnityEngine;

namespace Suwol.Suwol2D
{
    public static class Suwol2DDeformSampler
    {
        public static Vector2[] Sample(
            Suwol2DAnimationData animation,
            float time,
            string slotName,
            string attachmentName,
            int vertexCount)
        {
            var output = CreateZeroOffsets(vertexCount);
            if (animation == null || animation.deforms == null || vertexCount <= 0)
            {
                return output;
            }

            var timeline = FindTimeline(animation.deforms, slotName, attachmentName);
            if (timeline == null || timeline.keys == null || timeline.keys.Length == 0)
            {
                return output;
            }

            var keys = timeline.keys;
            if (keys.Length == 1 || time <= keys[0].time)
            {
                FillOffsets(output, keys[0]);
                return output;
            }

            var last = keys[keys.Length - 1];
            if (time >= last.time)
            {
                FillOffsets(output, last);
                return output;
            }

            for (var i = 0; i < keys.Length - 1; i++)
            {
                var previous = keys[i];
                var next = keys[i + 1];
                if (time > next.time)
                {
                    continue;
                }

                var t = InverseLerpClamped(previous.time, next.time, time);
                var previousOffsets = CreateZeroOffsets(vertexCount);
                var nextOffsets = CreateZeroOffsets(vertexCount);
                FillOffsets(previousOffsets, previous);
                FillOffsets(nextOffsets, next);

                for (var vertex = 0; vertex < vertexCount; vertex++)
                {
                    output[vertex] = Vector2.Lerp(previousOffsets[vertex], nextOffsets[vertex], t);
                }
                return output;
            }

            FillOffsets(output, last);
            return output;
        }

        public static float GetDuration(Suwol2DDeformTimelineData[] timelines)
        {
            if (timelines == null)
            {
                return 0f;
            }

            var duration = 0f;
            for (var i = 0; i < timelines.Length; i++)
            {
                var timeline = timelines[i];
                if (timeline == null || timeline.keys == null || timeline.keys.Length == 0)
                {
                    continue;
                }

                duration = Mathf.Max(duration, timeline.keys[timeline.keys.Length - 1].time);
            }
            return duration;
        }

        private static Suwol2DDeformTimelineData FindTimeline(
            Suwol2DDeformTimelineData[] timelines,
            string slotName,
            string attachmentName)
        {
            for (var i = 0; i < timelines.Length; i++)
            {
                var timeline = timelines[i];
                if (timeline == null)
                {
                    continue;
                }

                if (timeline.slot == slotName && timeline.attachment == attachmentName)
                {
                    return timeline;
                }
            }
            return null;
        }

        private static Vector2[] CreateZeroOffsets(int vertexCount)
        {
            return new Vector2[Mathf.Max(0, vertexCount)];
        }

        private static void FillOffsets(Vector2[] output, Suwol2DDeformKeyData key)
        {
            if (output == null || key == null || key.offsets == null)
            {
                return;
            }

            for (var i = 0; i < key.offsets.Length; i++)
            {
                var offset = key.offsets[i];
                if (offset == null || offset.vertex < 0 || offset.vertex >= output.Length)
                {
                    continue;
                }

                output[offset.vertex] = new Vector2(offset.x, offset.y);
            }
        }

        private static float InverseLerpClamped(float a, float b, float value)
        {
            if (Mathf.Approximately(a, b))
            {
                return 1f;
            }

            return Mathf.Clamp01((value - a) / (b - a));
        }
    }
}
