using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public static class Suwol2DAnimationMixer
    {
        public static void Apply(
            Suwol2DSkeleton skeleton,
            Suwol2DAnimationData fromAnimation,
            float fromTime,
            Suwol2DAnimationData toAnimation,
            float toTime,
            float weight)
        {
            if (skeleton == null)
            {
                return;
            }

            var fromPose = SamplePose(skeleton, fromAnimation, fromTime);
            if (toAnimation == null || weight <= 0f)
            {
                ApplyPose(skeleton, fromPose);
                return;
            }

            var toPose = SamplePose(skeleton, toAnimation, toTime);
            if (weight >= 1f)
            {
                ApplyPose(skeleton, toPose);
                return;
            }

            var mixed = new Suwol2DMixedPose();
            var bones = skeleton.Bones;
            for (var i = 0; i < bones.Count; i++)
            {
                var bone = bones[i];
                if (bone == null)
                {
                    continue;
                }

                Suwol2DTransformValue fromValue;
                Suwol2DTransformValue toValue;
                if (!fromPose.TryGetBone(bone.Name, out fromValue))
                {
                    fromValue = bone.SetupTransform;
                }
                if (!toPose.TryGetBone(bone.Name, out toValue))
                {
                    toValue = bone.SetupTransform;
                }

                mixed.SetBone(bone.Name, new Suwol2DTransformValue(
                    Mathf.Lerp(fromValue.x, toValue.x, weight),
                    Mathf.Lerp(fromValue.y, toValue.y, weight),
                    Mathf.LerpAngle(fromValue.rotation, toValue.rotation, weight),
                    Mathf.Lerp(fromValue.scaleX, toValue.scaleX, weight),
                    Mathf.Lerp(fromValue.scaleY, toValue.scaleY, weight)));
            }

            ApplyPose(skeleton, mixed);
        }

        public static void SampleSlotColors(
            Suwol2DAnimationData fromAnimation,
            float fromTime,
            Suwol2DAnimationData toAnimation,
            float toTime,
            float weight,
            Dictionary<string, Color> output)
        {
            if (output == null)
            {
                return;
            }

            output.Clear();
            var fromColors = new Dictionary<string, Color>();
            Suwol2DSlotColorTimelineSampler.Sample(fromAnimation, fromTime, fromColors);

            if (toAnimation == null || weight <= 0f)
            {
                CopyColors(fromColors, output);
                return;
            }

            var toColors = new Dictionary<string, Color>();
            Suwol2DSlotColorTimelineSampler.Sample(toAnimation, toTime, toColors);
            if (weight >= 1f)
            {
                CopyColors(toColors, output);
                return;
            }

            var slotNames = new HashSet<string>();
            foreach (var pair in fromColors)
            {
                slotNames.Add(pair.Key);
            }
            foreach (var pair in toColors)
            {
                slotNames.Add(pair.Key);
            }

            foreach (var slotName in slotNames)
            {
                Color fromColor;
                Color toColor;
                if (!fromColors.TryGetValue(slotName, out fromColor))
                {
                    fromColor = Color.white;
                }
                if (!toColors.TryGetValue(slotName, out toColor))
                {
                    toColor = Color.white;
                }

                output[slotName] = Color.Lerp(fromColor, toColor, weight);
            }
        }

        public static Vector2[] SampleDeformOffsets(
            Suwol2DAnimationData fromAnimation,
            float fromTime,
            Suwol2DAnimationData toAnimation,
            float toTime,
            float weight,
            string slotName,
            string attachmentName,
            int vertexCount)
        {
            var fromOffsets = Suwol2DDeformSampler.Sample(fromAnimation, fromTime, slotName, attachmentName, vertexCount);
            if (toAnimation == null || weight <= 0f)
            {
                return fromOffsets;
            }

            var toOffsets = Suwol2DDeformSampler.Sample(toAnimation, toTime, slotName, attachmentName, vertexCount);
            if (weight >= 1f)
            {
                return toOffsets;
            }

            var output = new Vector2[Mathf.Max(0, vertexCount)];
            for (var i = 0; i < output.Length; i++)
            {
                var fromOffset = i < fromOffsets.Length ? fromOffsets[i] : Vector2.zero;
                var toOffset = i < toOffsets.Length ? toOffsets[i] : Vector2.zero;
                output[i] = Vector2.Lerp(fromOffset, toOffset, weight);
            }

            return output;
        }

        private static Suwol2DMixedPose SamplePose(Suwol2DSkeleton skeleton, Suwol2DAnimationData animation, float time)
        {
            var pose = new Suwol2DMixedPose();
            if (skeleton == null)
            {
                return pose;
            }

            var bones = skeleton.Bones;
            for (var i = 0; i < bones.Count; i++)
            {
                var bone = bones[i];
                if (bone != null)
                {
                    pose.SetBone(bone.Name, bone.SetupTransform);
                }
            }

            if (animation == null || animation.bones == null)
            {
                return pose;
            }

            for (var i = 0; i < animation.bones.Length; i++)
            {
                var timeline = animation.bones[i];
                if (timeline == null || string.IsNullOrEmpty(timeline.bone))
                {
                    continue;
                }

                Suwol2DTransformValue transformValue;
                if (!pose.TryGetBone(timeline.bone, out transformValue))
                {
                    continue;
                }

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

                pose.SetBone(timeline.bone, transformValue);
            }

            return pose;
        }

        private static void ApplyPose(Suwol2DSkeleton skeleton, Suwol2DMixedPose pose)
        {
            var bones = skeleton.Bones;
            for (var i = 0; i < bones.Count; i++)
            {
                var bone = bones[i];
                if (bone == null)
                {
                    continue;
                }

                Suwol2DTransformValue transformValue;
                bone.SetLocalTransform(pose.TryGetBone(bone.Name, out transformValue) ? transformValue : bone.SetupTransform);
            }
        }

        private static void CopyColors(Dictionary<string, Color> source, Dictionary<string, Color> target)
        {
            foreach (var pair in source)
            {
                target[pair.Key] = pair.Value;
            }
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

                var t = Suwol2DInterpolation.Apply(
                    previous.interpolation,
                    Suwol2DInterpolation.InverseLerpClamped(previous.time, next.time, time));
                return new Vector2(
                    Suwol2DInterpolation.Lerp(previous.x, next.x, t),
                    Suwol2DInterpolation.Lerp(previous.y, next.y, t));
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

                var t = Suwol2DInterpolation.Apply(
                    previous.interpolation,
                    Suwol2DInterpolation.InverseLerpClamped(previous.time, next.time, time));
                return Suwol2DInterpolation.LerpAngleShortest(previous.rotation, next.rotation, t);
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

                var t = Suwol2DInterpolation.Apply(
                    previous.interpolation,
                    Suwol2DInterpolation.InverseLerpClamped(previous.time, next.time, time));
                return new Vector2(
                    Suwol2DInterpolation.Lerp(previous.scaleX, next.scaleX, t),
                    Suwol2DInterpolation.Lerp(previous.scaleY, next.scaleY, t));
            }

            return new Vector2(last.scaleX, last.scaleY);
        }

    }
}
