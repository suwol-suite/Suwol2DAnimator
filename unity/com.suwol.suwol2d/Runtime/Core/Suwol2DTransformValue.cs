using UnityEngine;

namespace Suwol.Suwol2D
{
    public struct Suwol2DTransformValue
    {
        public float x;
        public float y;
        public float rotation;
        public float scaleX;
        public float scaleY;

        public Suwol2DTransformValue(float x, float y, float rotation, float scaleX, float scaleY)
        {
            this.x = x;
            this.y = y;
            this.rotation = rotation;
            this.scaleX = scaleX;
            this.scaleY = scaleY;
        }

        public static Suwol2DTransformValue Identity
        {
            get { return new Suwol2DTransformValue(0f, 0f, 0f, 1f, 1f); }
        }

        public Vector2 Position
        {
            get { return new Vector2(x, y); }
        }

        public Vector3 Scale3D
        {
            get { return new Vector3(scaleX, scaleY, 1f); }
        }
    }
}
