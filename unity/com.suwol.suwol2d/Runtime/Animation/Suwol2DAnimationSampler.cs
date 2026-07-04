using UnityEngine;

namespace Suwol.Suwol2D
{
    public static class Suwol2DAnimationSampler
    {
        public static void Sample(Suwol2DSkeleton skeleton, Suwol2DAnimationData animation, float time)
        {
            if (skeleton == null || animation == null)
            {
                return;
            }

            skeleton.SetToSetupPose();

            if (animation.bones == null)
            {
                return;
            }

            for (var i = 0; i < animation.bones.Length; i++)
            {
                var timeline = animation.bones[i];
                if (timeline == null)
                {
                    continue;
                }

                var bone = skeleton.FindBone(timeline.bone);
                if (bone == null)
                {
                    continue;
                }

                var transformValue = bone.LocalTransform;

                if (timeline.translate != null && timeline.translate.Length > 0)
                {
                    var value = SampleTranslate(timeline.translate, time);
                    transformValue.x = value.x;
                    transformValue.y = value.y;
                }

                if (timeline.rotate != null && timeline.rotate.Length > 0)
                {
                    transformValue.rotation = SampleRotate(timeline.rotate, time);
                }

                if (timeline.scale != null && timeline.scale.Length > 0)
                {
                    var value = SampleScale(timeline.scale, time);
                    transformValue.scaleX = value.x;
                    transformValue.scaleY = value.y;
                }

                bone.SetLocalTransform(transformValue);
            }
        }

        public static float GetDuration(Suwol2DAnimationData animation)
        {
            if (animation == null)
            {
                return 0f;
            }

            if (animation.duration > 0f && !float.IsNaN(animation.duration) && !float.IsInfinity(animation.duration))
            {
                return animation.duration;
            }

            var duration = 0f;

            if (animation.bones != null)
            {
                for (var i = 0; i < animation.bones.Length; i++)
                {
                    var timeline = animation.bones[i];
                    if (timeline == null)
                    {
                        continue;
                    }

                    duration = Mathf.Max(duration, GetLastTranslateTime(timeline.translate));
                    duration = Mathf.Max(duration, GetLastRotateTime(timeline.rotate));
                    duration = Mathf.Max(duration, GetLastScaleTime(timeline.scale));
                }
            }

            duration = Mathf.Max(duration, Suwol2DDeformSampler.GetDuration(animation.deforms));
            duration = Mathf.Max(duration, Suwol2DAttachmentTimelineSampler.GetDuration(animation.attachments));
            duration = Mathf.Max(duration, Suwol2DDrawOrderTimelineSampler.GetDuration(animation.drawOrders));
            duration = Mathf.Max(duration, Suwol2DSlotColorTimelineSampler.GetDuration(animation.slots));
            duration = Mathf.Max(duration, Suwol2DEventTimelineDispatcher.GetDuration(animation.events));
            return duration;
        }

        private static Vector2 SampleTranslate(Suwol2DTranslateKey[] keys, float time)
        {
            if (time <= keys[0].time)
            {
                return new Vector2(keys[0].x, keys[0].y);
            }

            var last = keys[keys.Length - 1];
            if (time >= last.time)
            {
                return new Vector2(last.x, last.y);
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
                return new Vector2(
                    Mathf.Lerp(previous.x, next.x, t),
                    Mathf.Lerp(previous.y, next.y, t));
            }

            return new Vector2(last.x, last.y);
        }

        private static float SampleRotate(Suwol2DRotateKey[] keys, float time)
        {
            if (time <= keys[0].time)
            {
                return keys[0].rotation;
            }

            var last = keys[keys.Length - 1];
            if (time >= last.time)
            {
                return last.rotation;
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
                return Mathf.Lerp(previous.rotation, next.rotation, t);
            }

            return last.rotation;
        }

        private static Vector2 SampleScale(Suwol2DScaleKey[] keys, float time)
        {
            if (time <= keys[0].time)
            {
                return new Vector2(keys[0].scaleX, keys[0].scaleY);
            }

            var last = keys[keys.Length - 1];
            if (time >= last.time)
            {
                return new Vector2(last.scaleX, last.scaleY);
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
                return new Vector2(
                    Mathf.Lerp(previous.scaleX, next.scaleX, t),
                    Mathf.Lerp(previous.scaleY, next.scaleY, t));
            }

            return new Vector2(last.scaleX, last.scaleY);
        }

        private static float GetLastTranslateTime(Suwol2DTranslateKey[] keys)
        {
            return keys != null && keys.Length > 0 ? keys[keys.Length - 1].time : 0f;
        }

        private static float GetLastRotateTime(Suwol2DRotateKey[] keys)
        {
            return keys != null && keys.Length > 0 ? keys[keys.Length - 1].time : 0f;
        }

        private static float GetLastScaleTime(Suwol2DScaleKey[] keys)
        {
            return keys != null && keys.Length > 0 ? keys[keys.Length - 1].time : 0f;
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
