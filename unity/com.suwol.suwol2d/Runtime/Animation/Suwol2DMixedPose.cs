using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public sealed class Suwol2DMixedPose
    {
        private readonly Dictionary<string, Suwol2DTransformValue> bones = new Dictionary<string, Suwol2DTransformValue>();

        public void SetBone(string boneName, Suwol2DTransformValue transformValue)
        {
            if (!string.IsNullOrEmpty(boneName))
            {
                bones[boneName] = transformValue;
            }
        }

        public bool TryGetBone(string boneName, out Suwol2DTransformValue transformValue)
        {
            return bones.TryGetValue(boneName, out transformValue);
        }
    }
}
