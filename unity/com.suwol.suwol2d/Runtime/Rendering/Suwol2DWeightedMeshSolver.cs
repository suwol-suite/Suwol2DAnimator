using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public static class Suwol2DWeightedMeshSolver
    {
        public static Vector3[] Solve(
            Suwol2DSkeleton skeleton,
            Suwol2DSlot slot,
            Suwol2DAttachment attachment,
            Dictionary<string, Suwol2DTransformValue> bindPose,
            Vector2[] deformOffsets)
        {
            if (skeleton == null || slot == null || slot.Bone == null || attachment == null)
            {
                return new Vector3[0];
            }

            var vertices = attachment.Vertices;
            var output = new Vector3[vertices.Length];
            var weightsByVertex = BuildWeightLookup(attachment.Weights);
            var slotBind = GetBindPose(bindPose, slot.Bone);

            for (var i = 0; i < vertices.Length; i++)
            {
                var deformOffset = deformOffsets != null && i < deformOffsets.Length ? deformOffsets[i] : Vector2.zero;
                var bindVertex = TransformPoint(slotBind, ApplyAttachmentTransform(vertices[i], attachment, deformOffset));
                Suwol2DVertexWeightData vertexWeights;
                if (!weightsByVertex.TryGetValue(i, out vertexWeights) || vertexWeights == null || vertexWeights.bones == null || vertexWeights.bones.Length == 0)
                {
                    output[i] = new Vector3(bindVertex.x, bindVertex.y, 0f);
                    continue;
                }

                var solved = Vector2.zero;
                var sum = 0f;
                for (var weightIndex = 0; weightIndex < vertexWeights.bones.Length; weightIndex++)
                {
                    var weight = vertexWeights.bones[weightIndex];
                    if (weight == null || string.IsNullOrEmpty(weight.bone) || weight.weight <= 0f)
                    {
                        continue;
                    }

                    var bone = skeleton.FindBone(weight.bone);
                    if (bone == null)
                    {
                        continue;
                    }

                    var boneBind = GetBindPose(bindPose, bone);
                    var boneLocalVertex = InverseTransformPoint(boneBind, bindVertex);
                    var transformed = TransformPoint(bone.WorldTransform, boneLocalVertex);
                    solved += transformed * weight.weight;
                    sum += weight.weight;
                }

                if (sum > 0f)
                {
                    solved /= sum;
                    output[i] = new Vector3(solved.x, solved.y, 0f);
                }
                else
                {
                    output[i] = new Vector3(bindVertex.x, bindVertex.y, 0f);
                }
            }

            return output;
        }

        public static bool HasWeights(Suwol2DAttachment attachment)
        {
            return attachment != null && attachment.Weights != null && attachment.Weights.Length > 0;
        }

        public static Dictionary<string, Suwol2DTransformValue> CaptureBindPose(Suwol2DSkeleton skeleton)
        {
            var bindPose = new Dictionary<string, Suwol2DTransformValue>();
            if (skeleton == null)
            {
                return bindPose;
            }

            var bones = skeleton.Bones;
            for (var i = 0; i < bones.Count; i++)
            {
                var bone = bones[i];
                if (bone != null && !string.IsNullOrEmpty(bone.Name))
                {
                    bindPose[bone.Name] = bone.WorldTransform;
                }
            }

            return bindPose;
        }

        private static Dictionary<int, Suwol2DVertexWeightData> BuildWeightLookup(Suwol2DVertexWeightData[] weights)
        {
            var lookup = new Dictionary<int, Suwol2DVertexWeightData>();
            if (weights == null)
            {
                return lookup;
            }

            for (var i = 0; i < weights.Length; i++)
            {
                var weight = weights[i];
                if (weight != null && !lookup.ContainsKey(weight.vertex))
                {
                    lookup.Add(weight.vertex, weight);
                }
            }

            return lookup;
        }

        private static Suwol2DTransformValue GetBindPose(Dictionary<string, Suwol2DTransformValue> bindPose, Suwol2DBone bone)
        {
            if (bindPose != null && bone != null)
            {
                Suwol2DTransformValue value;
                if (bindPose.TryGetValue(bone.Name, out value))
                {
                    return value;
                }
            }

            return bone != null ? bone.WorldTransform : Suwol2DTransformValue.Identity;
        }

        private static Vector2 ApplyAttachmentTransform(Suwol2DMeshVertexData vertex, Suwol2DAttachment attachment, Vector2 deformOffset)
        {
            var local = new Vector2(
                (vertex.x + deformOffset.x) * attachment.ScaleX,
                (vertex.y + deformOffset.y) * attachment.ScaleY);
            local = Rotate(local, attachment.Rotation);
            return new Vector2(local.x + attachment.X, local.y + attachment.Y);
        }

        private static Vector2 TransformPoint(Suwol2DTransformValue transform, Vector2 point)
        {
            var scaled = new Vector2(point.x * transform.scaleX, point.y * transform.scaleY);
            var rotated = Rotate(scaled, transform.rotation);
            return new Vector2(transform.x + rotated.x, transform.y + rotated.y);
        }

        private static Vector2 InverseTransformPoint(Suwol2DTransformValue transform, Vector2 point)
        {
            var translated = new Vector2(point.x - transform.x, point.y - transform.y);
            var unrotated = Rotate(translated, -transform.rotation);
            var scaleX = Mathf.Approximately(transform.scaleX, 0f) ? 1f : transform.scaleX;
            var scaleY = Mathf.Approximately(transform.scaleY, 0f) ? 1f : transform.scaleY;
            return new Vector2(unrotated.x / scaleX, unrotated.y / scaleY);
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
    }
}
