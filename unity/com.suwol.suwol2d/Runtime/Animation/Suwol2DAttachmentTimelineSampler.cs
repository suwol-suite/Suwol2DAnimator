using System.Collections.Generic;

namespace Suwol.Suwol2D
{
    public static class Suwol2DAttachmentTimelineSampler
    {
        public static void Sample(Suwol2DAnimationData animation, float time, Dictionary<string, string> output)
        {
            if (output == null)
            {
                return;
            }

            output.Clear();
            if (animation == null || animation.attachments == null)
            {
                return;
            }

            for (var i = 0; i < animation.attachments.Length; i++)
            {
                var timeline = animation.attachments[i];
                if (timeline == null || string.IsNullOrEmpty(timeline.slot) || timeline.keys == null || timeline.keys.Length == 0)
                {
                    continue;
                }

                var key = LastKeyAtOrBefore(timeline.keys, time);
                if (key != null)
                {
                    output[timeline.slot] = string.IsNullOrEmpty(key.attachment) ? string.Empty : key.attachment;
                }
            }
        }

        public static float GetDuration(Suwol2DAttachmentTimelineData[] timelines)
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

                duration = UnityEngine.Mathf.Max(duration, timeline.keys[timeline.keys.Length - 1].time);
            }
            return duration;
        }

        private static Suwol2DAttachmentKeyData LastKeyAtOrBefore(Suwol2DAttachmentKeyData[] keys, float time)
        {
            Suwol2DAttachmentKeyData selected = null;
            for (var i = 0; i < keys.Length; i++)
            {
                var key = keys[i];
                if (key == null)
                {
                    continue;
                }

                if (key.time <= time)
                {
                    selected = key;
                }
                else
                {
                    break;
                }
            }

            return selected ?? keys[0];
        }
    }
}
