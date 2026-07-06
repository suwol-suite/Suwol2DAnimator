using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public static class Suwol2DClipper
    {
        private struct ClipVertex
        {
            public Vector2 position;
            public Vector2 uv;
        }

        public static bool ClipMesh(
            Vector3[] sourceVertices,
            Vector2[] sourceUv,
            int[] sourceTriangles,
            Vector2[] clipPolygon,
            out Vector3[] clippedVertices,
            out Vector2[] clippedUv,
            out int[] clippedTriangles)
        {
            var outputVertices = new List<Vector3>();
            var outputUv = new List<Vector2>();
            var outputTriangles = new List<int>();

            if (sourceVertices == null || sourceUv == null || sourceTriangles == null ||
                clipPolygon == null || clipPolygon.Length < 3)
            {
                clippedVertices = new Vector3[0];
                clippedUv = new Vector2[0];
                clippedTriangles = new int[0];
                return false;
            }

            var orientation = SignedArea(clipPolygon) >= 0f ? 1f : -1f;
            for (var triangleIndex = 0; triangleIndex < sourceTriangles.Length; triangleIndex += 3)
            {
                if (triangleIndex + 2 >= sourceTriangles.Length)
                {
                    break;
                }

                var a = sourceTriangles[triangleIndex];
                var b = sourceTriangles[triangleIndex + 1];
                var c = sourceTriangles[triangleIndex + 2];
                if (!IsValidIndex(a, sourceVertices, sourceUv) ||
                    !IsValidIndex(b, sourceVertices, sourceUv) ||
                    !IsValidIndex(c, sourceVertices, sourceUv))
                {
                    continue;
                }

                var polygon = new List<ClipVertex>
                {
                    new ClipVertex { position = sourceVertices[a], uv = sourceUv[a] },
                    new ClipVertex { position = sourceVertices[b], uv = sourceUv[b] },
                    new ClipVertex { position = sourceVertices[c], uv = sourceUv[c] }
                };

                polygon = ClipPolygon(polygon, clipPolygon, orientation);
                if (polygon.Count < 3)
                {
                    continue;
                }

                var baseIndex = outputVertices.Count;
                for (var i = 0; i < polygon.Count; i++)
                {
                    outputVertices.Add(new Vector3(polygon[i].position.x, polygon[i].position.y, 0f));
                    outputUv.Add(polygon[i].uv);
                }

                for (var i = 1; i < polygon.Count - 1; i++)
                {
                    outputTriangles.Add(baseIndex);
                    outputTriangles.Add(baseIndex + i);
                    outputTriangles.Add(baseIndex + i + 1);
                }
            }

            clippedVertices = outputVertices.ToArray();
            clippedUv = outputUv.ToArray();
            clippedTriangles = outputTriangles.ToArray();
            return clippedVertices.Length >= 3 && clippedTriangles.Length >= 3;
        }

        public static bool IsValidPolygon(Vector2[] polygon)
        {
            return polygon != null && polygon.Length >= 3 && Mathf.Abs(SignedArea(polygon)) > 0.000001f;
        }

        private static List<ClipVertex> ClipPolygon(List<ClipVertex> subject, Vector2[] clipPolygon, float orientation)
        {
            var output = subject;
            for (var edgeIndex = 0; edgeIndex < clipPolygon.Length; edgeIndex++)
            {
                var edgeStart = clipPolygon[edgeIndex];
                var edgeEnd = clipPolygon[(edgeIndex + 1) % clipPolygon.Length];
                var input = output;
                output = new List<ClipVertex>();

                if (input.Count == 0)
                {
                    break;
                }

                var previous = input[input.Count - 1];
                var previousInside = IsInside(previous.position, edgeStart, edgeEnd, orientation);
                for (var i = 0; i < input.Count; i++)
                {
                    var current = input[i];
                    var currentInside = IsInside(current.position, edgeStart, edgeEnd, orientation);
                    if (currentInside)
                    {
                        if (!previousInside)
                        {
                            output.Add(Intersect(previous, current, edgeStart, edgeEnd));
                        }
                        output.Add(current);
                    }
                    else if (previousInside)
                    {
                        output.Add(Intersect(previous, current, edgeStart, edgeEnd));
                    }

                    previous = current;
                    previousInside = currentInside;
                }
            }

            return output;
        }

        private static bool IsInside(Vector2 point, Vector2 edgeStart, Vector2 edgeEnd, float orientation)
        {
            var edge = edgeEnd - edgeStart;
            var toPoint = point - edgeStart;
            var cross = edge.x * toPoint.y - edge.y * toPoint.x;
            return cross * orientation >= -0.000001f;
        }

        private static ClipVertex Intersect(ClipVertex from, ClipVertex to, Vector2 edgeStart, Vector2 edgeEnd)
        {
            var direction = to.position - from.position;
            var edge = edgeEnd - edgeStart;
            var denominator = Cross(direction, edge);
            var t = Mathf.Abs(denominator) <= 0.000001f
                ? 0f
                : Cross(edgeStart - from.position, edge) / denominator;
            t = Mathf.Clamp01(t);
            return new ClipVertex
            {
                position = Vector2.Lerp(from.position, to.position, t),
                uv = Vector2.Lerp(from.uv, to.uv, t)
            };
        }

        private static bool IsValidIndex(int index, Vector3[] vertices, Vector2[] uv)
        {
            return index >= 0 && index < vertices.Length && index < uv.Length;
        }

        private static float SignedArea(Vector2[] polygon)
        {
            var area = 0f;
            for (var i = 0; i < polygon.Length; i++)
            {
                var current = polygon[i];
                var next = polygon[(i + 1) % polygon.Length];
                area += current.x * next.y - next.x * current.y;
            }

            return area * 0.5f;
        }

        private static float Cross(Vector2 left, Vector2 right)
        {
            return left.x * right.y - left.y * right.x;
        }
    }
}
