using UnityEngine;

namespace Suwol.Suwol2D
{
    public static class Suwol2DInterpolation
    {
        public const string Stepped = "stepped";
        public const string Linear = "linear";
        public const string EaseIn = "easeIn";
        public const string EaseOut = "easeOut";
        public const string EaseInOut = "easeInOut";

        public static string Normalize(string interpolation)
        {
            switch (interpolation)
            {
                case Stepped:
                case Linear:
                case EaseIn:
                case EaseOut:
                case EaseInOut:
                    return interpolation;
                default:
                    return Linear;
            }
        }

        public static float Apply(string interpolation, float t)
        {
            t = Mathf.Clamp01(t);

            switch (Normalize(interpolation))
            {
                case Stepped:
                    return 0f;
                case EaseIn:
                    return t * t;
                case EaseOut:
                    return 1f - (1f - t) * (1f - t);
                case EaseInOut:
                    return t < 0.5f
                        ? 2f * t * t
                        : 1f - Mathf.Pow(-2f * t + 2f, 2f) / 2f;
                case Linear:
                default:
                    return t;
            }
        }

        public static float Lerp(float from, float to, float interpolationT)
        {
            return Mathf.Lerp(from, to, interpolationT);
        }

        public static float LerpAngleShortest(float from, float to, float interpolationT)
        {
            return Mathf.LerpAngle(from, to, interpolationT);
        }

        public static float InverseLerpClamped(float a, float b, float value)
        {
            if (Mathf.Approximately(a, b))
            {
                return 1f;
            }

            return Mathf.Clamp01((value - a) / (b - a));
        }
    }
}
