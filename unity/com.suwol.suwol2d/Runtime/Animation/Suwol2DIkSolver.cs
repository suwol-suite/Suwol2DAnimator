using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public static class Suwol2DIkSolver
    {
        private static readonly HashSet<string> WarnedConstraints = new HashSet<string>();

        public static void Solve(Suwol2DSkeleton skeleton)
        {
            if (skeleton == null || skeleton.IkConstraints == null || skeleton.IkConstraints.Count == 0)
            {
                return;
            }

            for (var i = 0; i < skeleton.IkConstraints.Count; i++)
            {
                var constraint = skeleton.IkConstraints[i];
                if (constraint == null || !constraint.enabled || constraint.mix <= 0f)
                {
                    continue;
                }

                if (SolveConstraint(skeleton, constraint))
                {
                    skeleton.UpdateWorldTransforms();
                }
            }
        }

        private static bool SolveConstraint(Suwol2DSkeleton skeleton, Suwol2DIkConstraintData constraint)
        {
            var parent = skeleton.FindBone(constraint.parentBone);
            var child = skeleton.FindBone(constraint.childBone);
            var target = skeleton.FindBone(constraint.targetBone);
            if (parent == null || child == null || target == null)
            {
                WarnOnce(constraint.name, "Suwol2D IK constraint skipped because one or more bones were missing: " + constraint.name);
                return false;
            }

            if (child.Parent != parent)
            {
                WarnOnce(constraint.name + ":parent", "Suwol2D IK constraint skipped because child bone is not parented to parent bone: " + constraint.name);
                return false;
            }

            var parentLength = ResolveLength(parent);
            var childLength = ResolveLength(child);
            if (parentLength <= 0f || childLength <= 0f)
            {
                WarnOnce(constraint.name + ":length", "Suwol2D IK constraint skipped because a chain bone length was zero: " + constraint.name);
                return false;
            }

            var start = parent.WorldTransform.Position;
            var targetPosition = target.WorldTransform.Position;
            var toTarget = targetPosition - start;
            var rawDistance = toTarget.magnitude;
            if (!IsFinite(rawDistance) || rawDistance <= 0.00001f)
            {
                return false;
            }

            var minDistance = Mathf.Max(0.0001f, Mathf.Abs(parentLength - childLength) + 0.0001f);
            var maxDistance = Mathf.Max(minDistance, parentLength + childLength - 0.0001f);
            var distance = Mathf.Clamp(rawDistance, minDistance, maxDistance);
            var angleToTarget = Mathf.Atan2(toTarget.y, toTarget.x);
            var bend = constraint.bendDirection < 0 ? -1f : 1f;
            var parentAngleOffset = Mathf.Acos(ClampCos((distance * distance + parentLength * parentLength - childLength * childLength) / (2f * distance * parentLength)));
            var desiredParentWorldRotation = (angleToTarget - bend * parentAngleOffset) * Mathf.Rad2Deg;
            var elbow = start + new Vector2(
                Mathf.Cos(desiredParentWorldRotation * Mathf.Deg2Rad),
                Mathf.Sin(desiredParentWorldRotation * Mathf.Deg2Rad)) * parentLength;
            var desiredChildWorldRotation = Mathf.Atan2(targetPosition.y - elbow.y, targetPosition.x - elbow.x) * Mathf.Rad2Deg;
            var parentParentWorldRotation = parent.Parent != null ? parent.Parent.WorldTransform.rotation : 0f;
            var desiredParentLocalRotation = NormalizeAngle(desiredParentWorldRotation - parentParentWorldRotation);
            var desiredChildLocalRotation = NormalizeAngle(desiredChildWorldRotation - desiredParentWorldRotation);
            var mix = Mathf.Clamp01(constraint.mix);

            parent.SetLocalRotation(NormalizeAngle(Mathf.LerpAngle(parent.LocalTransform.rotation, desiredParentLocalRotation, mix)));
            child.SetLocalRotation(NormalizeAngle(Mathf.LerpAngle(child.LocalTransform.rotation, desiredChildLocalRotation, mix)));
            return true;
        }

        private static float ResolveLength(Suwol2DBone bone)
        {
            if (bone == null)
            {
                return 0f;
            }

            if (bone.Length > 0f)
            {
                return bone.Length;
            }

            var children = bone.Children;
            for (var i = 0; i < children.Count; i++)
            {
                var child = children[i];
                if (child == null)
                {
                    continue;
                }

                var distance = child.LocalTransform.Position.magnitude;
                if (distance > 0f)
                {
                    return distance;
                }
            }

            return 50f;
        }

        private static float ClampCos(float value)
        {
            return Mathf.Clamp(value, -1f, 1f);
        }

        private static float NormalizeAngle(float value)
        {
            return Mathf.Repeat(value + 180f, 360f) - 180f;
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }

        private static void WarnOnce(string key, string message)
        {
            if (WarnedConstraints.Contains(key))
            {
                return;
            }

            WarnedConstraints.Add(key);
            Debug.LogWarning(message);
        }
    }
}
