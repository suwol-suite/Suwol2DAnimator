using UnityEngine;

namespace Suwol.Suwol2D
{
    public static class Suwol2DTransformConstraintSolver
    {
        public static void Solve(Suwol2DSkeleton skeleton)
        {
            if (skeleton == null || skeleton.TransformConstraints == null || skeleton.TransformConstraints.Count == 0)
            {
                return;
            }

            for (var i = 0; i < skeleton.TransformConstraints.Count; i++)
            {
                if (ApplyConstraint(skeleton, skeleton.TransformConstraints[i]))
                {
                    skeleton.UpdateWorldTransforms();
                }
            }
        }

        private static bool ApplyConstraint(Suwol2DSkeleton skeleton, Suwol2DTransformConstraintData constraint)
        {
            if (constraint == null || !constraint.enabled)
            {
                return false;
            }

            var translateMix = Mathf.Clamp01(SafeNumber(constraint.translateMix, 0f));
            var rotateMix = Mathf.Clamp01(SafeNumber(constraint.rotateMix, 0f));
            var scaleMix = Mathf.Clamp01(SafeNumber(constraint.scaleMix, 0f));
            if (translateMix <= 0f && rotateMix <= 0f && scaleMix <= 0f)
            {
                return false;
            }

            var bone = skeleton.FindBone(constraint.bone);
            var target = skeleton.FindBone(constraint.targetBone);
            if (bone == null || target == null)
            {
                Debug.LogWarning("Skipped Suwol2D transform constraint with missing bone: " + constraint.name);
                return false;
            }

            var local = bone.LocalTransform;
            var world = bone.WorldTransform;
            var targetWorld = target.WorldTransform;

            var desiredWorldX = Mathf.Lerp(world.x, targetWorld.x + SafeNumber(constraint.offsetX, 0f), translateMix);
            var desiredWorldY = Mathf.Lerp(world.y, targetWorld.y + SafeNumber(constraint.offsetY, 0f), translateMix);
            var desiredWorldRotation = Mathf.LerpAngle(world.rotation, targetWorld.rotation + SafeNumber(constraint.offsetRotation, 0f), rotateMix);
            var desiredWorldScaleX = Mathf.Lerp(world.scaleX, targetWorld.scaleX + SafeNumber(constraint.offsetScaleX, 0f), scaleMix);
            var desiredWorldScaleY = Mathf.Lerp(world.scaleY, targetWorld.scaleY + SafeNumber(constraint.offsetScaleY, 0f), scaleMix);

            var parent = bone.Parent;
            if (parent == null)
            {
                bone.SetLocalTransform(new Suwol2DTransformValue(
                    desiredWorldX,
                    desiredWorldY,
                    NormalizeDegrees(desiredWorldRotation),
                    SanitizeScale(desiredWorldScaleX, local.scaleX),
                    SanitizeScale(desiredWorldScaleY, local.scaleY)));
                return true;
            }

            var parentWorld = parent.WorldTransform;
            var parentScaleX = SanitizeScale(parentWorld.scaleX, 1f);
            var parentScaleY = SanitizeScale(parentWorld.scaleY, 1f);
            var delta = new Vector2(desiredWorldX - parentWorld.x, desiredWorldY - parentWorld.y);
            var unrotated = Rotate(delta, -parentWorld.rotation);
            var nextLocalX = SafeDivide(unrotated.x, parentScaleX, local.x);
            var nextLocalY = SafeDivide(unrotated.y, parentScaleY, local.y);
            var nextLocalRotation = NormalizeDegrees(desiredWorldRotation - parentWorld.rotation);
            var nextLocalScaleX = SanitizeScale(SafeDivide(desiredWorldScaleX, parentScaleX, local.scaleX), local.scaleX);
            var nextLocalScaleY = SanitizeScale(SafeDivide(desiredWorldScaleY, parentScaleY, local.scaleY), local.scaleY);

            bone.SetLocalTransform(new Suwol2DTransformValue(
                nextLocalX,
                nextLocalY,
                nextLocalRotation,
                nextLocalScaleX,
                nextLocalScaleY));
            return true;
        }

        private static Vector2 Rotate(Vector2 value, float degrees)
        {
            var radians = degrees * Mathf.Deg2Rad;
            var sin = Mathf.Sin(radians);
            var cos = Mathf.Cos(radians);
            return new Vector2(
                value.x * cos - value.y * sin,
                value.x * sin + value.y * cos);
        }

        private static float SafeNumber(float value, float fallback)
        {
            return float.IsNaN(value) || float.IsInfinity(value) ? fallback : value;
        }

        private static float SafeDivide(float value, float divisor, float fallback)
        {
            return Mathf.Abs(divisor) < 0.0001f ? fallback : value / divisor;
        }

        private static float SanitizeScale(float value, float fallback)
        {
            if (float.IsNaN(value) || float.IsInfinity(value))
            {
                return fallback;
            }

            return Mathf.Abs(value) < 0.0001f ? 0.0001f : value;
        }

        private static float NormalizeDegrees(float value)
        {
            var result = Mathf.Repeat(value + 180f, 360f) - 180f;
            return Mathf.Approximately(result, -180f) ? 180f : result;
        }
    }
}
