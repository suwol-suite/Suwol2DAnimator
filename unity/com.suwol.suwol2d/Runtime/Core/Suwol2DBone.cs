using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public sealed class Suwol2DBone
    {
        private readonly List<Suwol2DBone> children = new List<Suwol2DBone>();

        public string Name { get; private set; }
        public Suwol2DBone Parent { get; private set; }
        public IReadOnlyList<Suwol2DBone> Children { get { return children; } }
        public Suwol2DTransformValue SetupTransform { get; private set; }
        public Suwol2DTransformValue LocalTransform { get; private set; }
        public Suwol2DTransformValue WorldTransform { get; private set; }
        public float Length { get; private set; }

        public Suwol2DBone(Suwol2DBoneData data)
        {
            Name = data != null ? data.name : string.Empty;
            var scaleX = data != null && data.scaleX != 0f ? data.scaleX : 1f;
            var scaleY = data != null && data.scaleY != 0f ? data.scaleY : 1f;
            SetupTransform = new Suwol2DTransformValue(
                data != null ? data.x : 0f,
                data != null ? data.y : 0f,
                data != null ? data.rotation : 0f,
                scaleX,
                scaleY);
            LocalTransform = SetupTransform;
            WorldTransform = SetupTransform;
            Length = data != null && data.length > 0f ? data.length : 0f;
        }

        public void SetParent(Suwol2DBone parent)
        {
            Parent = parent;
            if (parent != null && !parent.children.Contains(this))
            {
                parent.children.Add(this);
            }
        }

        public void SetToSetupPose()
        {
            LocalTransform = SetupTransform;
        }

        public void SetLocalTransform(Suwol2DTransformValue transformValue)
        {
            LocalTransform = transformValue;
        }

        public void SetLocalRotation(float rotation)
        {
            var transformValue = LocalTransform;
            transformValue.rotation = rotation;
            LocalTransform = transformValue;
        }

        public void UpdateWorldTransform()
        {
            if (Parent == null)
            {
                WorldTransform = LocalTransform;
                return;
            }

            var parentWorld = Parent.WorldTransform;
            var localPosition = new Vector2(
                LocalTransform.x * parentWorld.scaleX,
                LocalTransform.y * parentWorld.scaleY);
            var rotatedPosition = Rotate(localPosition, parentWorld.rotation);

            WorldTransform = new Suwol2DTransformValue(
                parentWorld.x + rotatedPosition.x,
                parentWorld.y + rotatedPosition.y,
                parentWorld.rotation + LocalTransform.rotation,
                parentWorld.scaleX * LocalTransform.scaleX,
                parentWorld.scaleY * LocalTransform.scaleY);
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
