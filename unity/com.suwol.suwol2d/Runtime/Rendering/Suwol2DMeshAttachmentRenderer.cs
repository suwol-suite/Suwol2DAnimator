using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public sealed class Suwol2DMeshAttachmentRenderer
    {
        private sealed class SlotView
        {
            public Suwol2DSlot slot;
            public Suwol2DAttachment attachment;
            public string cacheKey;
            public GameObject gameObject;
            public Mesh mesh;
            public Material material;
            public bool weighted;
        }

        private readonly List<SlotView> views = new List<SlotView>();
        private readonly Dictionary<string, SlotView> viewsBySlot = new Dictionary<string, SlotView>();
        private readonly Dictionary<string, Suwol2DTransformValue> bindPose = new Dictionary<string, Suwol2DTransformValue>();
        private readonly HashSet<string> invalidMeshWarnings = new HashSet<string>();
        private readonly HashSet<string> missingTextureWarnings = new HashSet<string>();
        private readonly HashSet<string> missingWeightBoneWarnings = new HashSet<string>();
        private Suwol2DSkeleton skeleton;

        public int ViewCount
        {
            get { return views.Count; }
        }

        public void Build(
            Suwol2DSkeleton skeleton,
            Transform root,
            Texture2D[] textures,
            Material defaultMaterial,
            Suwol2DSkinResolver skinResolver = null,
            Suwol2DAtlasLookup atlasLookup = null)
        {
            Clear();
            Sync(skeleton, root, textures, defaultMaterial, skinResolver, atlasLookup);
            UpdatePose();
        }

        public void Sync(
            Suwol2DSkeleton skeleton,
            Transform root,
            Texture2D[] textures,
            Material defaultMaterial,
            Suwol2DSkinResolver skinResolver = null,
            Suwol2DAtlasLookup atlasLookup = null)
        {
            if (skeleton == null || root == null)
            {
                Debug.LogWarning("Suwol2DMeshAttachmentRenderer.Sync skipped because skeleton or root transform was null.");
                return;
            }

            EnsureBindPose(skeleton);

            var activeSlots = new HashSet<string>();
            var slots = skeleton.Slots;
            for (var i = 0; i < slots.Count; i++)
            {
                var slot = slots[i];
                if (slot == null || string.IsNullOrEmpty(slot.Name))
                {
                    continue;
                }

                activeSlots.Add(slot.Name);
                var attachment = skinResolver != null ? skinResolver.ResolveAttachment(slot) : slot.Attachment;
                if (attachment == null || !attachment.IsMesh)
                {
                    RemoveSlot(slot.Name);
                    continue;
                }

                if (!IsValidMesh(attachment))
                {
                    WarnInvalidMeshOnce(attachment);
                    RemoveSlot(slot.Name);
                    continue;
                }

                var atlasRegion = ResolveAtlasRegion(atlasLookup, attachment.Image);
                var texture = atlasRegion != null ? atlasRegion.Texture : FindTexture(textures, attachment.Image);
                if (texture == null)
                {
                    WarnMissingTextureOnce(slot, attachment);
                    RemoveSlot(slot.Name);
                    continue;
                }

                var isWeighted = Suwol2DWeightedMeshSolver.HasWeights(attachment);
                WarnForMissingWeightBonesOnce(skeleton, attachment);
                var cacheKey = CreateCacheKey(slot, attachment, texture, skinResolver, isWeighted, atlasRegion);
                SlotView cachedView;
                if (viewsBySlot.TryGetValue(slot.Name, out cachedView) &&
                    cachedView != null &&
                    cachedView.gameObject != null &&
                    cachedView.mesh != null &&
                    cachedView.cacheKey == cacheKey)
                {
                    cachedView.slot = slot;
                    cachedView.attachment = attachment;
                    cachedView.weighted = isWeighted;
                    continue;
                }

                RemoveSlot(slot.Name);
                var view = CreateSlotView(slot, attachment, root, defaultMaterial, texture, atlasRegion, cacheKey, i, isWeighted);
                views.Add(view);
                viewsBySlot.Add(slot.Name, view);
            }

            for (var i = views.Count - 1; i >= 0; i--)
            {
                var view = views[i];
                var slotName = view != null && view.slot != null ? view.slot.Name : string.Empty;
                if (!activeSlots.Contains(slotName))
                {
                    RemoveViewAt(i);
                }
            }
        }

        public void UpdatePose(
            Suwol2DAnimationData animation = null,
            float time = 0f,
            Suwol2DAnimationData nextAnimation = null,
            float nextTime = 0f,
            float transitionWeight = 0f)
        {
            for (var i = 0; i < views.Count; i++)
            {
                var view = views[i];
                if (view == null || view.gameObject == null || view.slot == null || view.slot.Bone == null)
                {
                    continue;
                }

                var deformOffsets = Suwol2DAnimationMixer.SampleDeformOffsets(
                    animation,
                    time,
                    nextAnimation,
                    nextTime,
                    transitionWeight,
                    view.slot.Name,
                    view.attachment.Name,
                    view.attachment.Vertices.Length);

                if (view.weighted)
                {
                    UpdateWeightedMesh(view, deformOffsets);
                }
                else
                {
                    UpdateRigidMeshVertices(view, deformOffsets);
                    ApplyViewTransform(view);
                }
            }
        }

        public void ApplyDrawOrder(Dictionary<string, int> drawOrders)
        {
            for (var i = 0; i < views.Count; i++)
            {
                var view = views[i];
                if (view == null || view.gameObject == null || view.slot == null)
                {
                    continue;
                }

                int order;
                if (drawOrders == null || !drawOrders.TryGetValue(view.slot.Name, out order))
                {
                    order = view.slot.DrawOrder;
                }

                var meshRenderer = view.gameObject.GetComponent<MeshRenderer>();
                if (meshRenderer != null)
                {
                    meshRenderer.sortingOrder = order;
                }

                view.gameObject.transform.SetSiblingIndex(Mathf.Max(0, order));
            }
        }

        public void ApplySlotColors(Dictionary<string, Color> slotColors)
        {
            for (var i = 0; i < views.Count; i++)
            {
                var view = views[i];
                if (view == null || view.material == null || view.slot == null)
                {
                    continue;
                }

                Color color;
                if (slotColors == null || !slotColors.TryGetValue(view.slot.Name, out color))
                {
                    color = Color.white;
                }

                if (view.material.HasProperty("_Color"))
                {
                    view.material.color = color;
                }
            }
        }

        public void Clear()
        {
            for (var i = 0; i < views.Count; i++)
            {
                var view = views[i];
                if (view == null)
                {
                    continue;
                }

                DestroyObject(view.mesh);
                DestroyObject(view.material);
                if (view.gameObject != null)
                {
                    DestroyObject(view.gameObject);
                }
            }

            views.Clear();
            viewsBySlot.Clear();
            bindPose.Clear();
            invalidMeshWarnings.Clear();
            missingTextureWarnings.Clear();
            missingWeightBoneWarnings.Clear();
            skeleton = null;
        }

        private void EnsureBindPose(Suwol2DSkeleton nextSkeleton)
        {
            if (skeleton == nextSkeleton)
            {
                return;
            }

            Clear();
            skeleton = nextSkeleton;
            bindPose.Clear();
            var capturedBindPose = Suwol2DWeightedMeshSolver.CaptureBindPose(nextSkeleton);
            foreach (var pair in capturedBindPose)
            {
                bindPose[pair.Key] = pair.Value;
            }
        }

        private static SlotView CreateSlotView(
            Suwol2DSlot slot,
            Suwol2DAttachment attachment,
            Transform root,
            Material defaultMaterial,
            Texture2D texture,
            Suwol2DResolvedAtlasRegion atlasRegion,
            string cacheKey,
            int sortingOrder,
            bool isWeighted)
        {
            var viewObject = new GameObject(slot.Name + "_Mesh");
            viewObject.transform.SetParent(root, false);
            if (isWeighted)
            {
                viewObject.transform.localPosition = Vector3.zero;
                viewObject.transform.localRotation = Quaternion.identity;
                viewObject.transform.localScale = Vector3.one;
            }

            var meshFilter = viewObject.AddComponent<MeshFilter>();
            var meshRenderer = viewObject.AddComponent<MeshRenderer>();
            var mesh = CreateMesh(attachment, atlasRegion);
            var material = CreateMaterial(defaultMaterial, texture);

            meshFilter.sharedMesh = mesh;
            meshRenderer.sharedMaterial = material;
            meshRenderer.sortingOrder = sortingOrder;
            meshRenderer.sortingLayerName = "Default";

            return new SlotView
            {
                slot = slot,
                attachment = attachment,
                cacheKey = cacheKey,
                gameObject = viewObject,
                mesh = mesh,
                material = material,
                weighted = isWeighted
            };
        }

        private void RemoveSlot(string slotName)
        {
            if (string.IsNullOrEmpty(slotName))
            {
                return;
            }

            SlotView view;
            if (!viewsBySlot.TryGetValue(slotName, out view))
            {
                return;
            }

            var index = views.IndexOf(view);
            if (index >= 0)
            {
                RemoveViewAt(index);
                return;
            }

            viewsBySlot.Remove(slotName);
            DestroyView(view);
        }

        private void RemoveViewAt(int index)
        {
            if (index < 0 || index >= views.Count)
            {
                return;
            }

            var view = views[index];
            views.RemoveAt(index);
            if (view != null && view.slot != null)
            {
                viewsBySlot.Remove(view.slot.Name);
            }

            DestroyView(view);
        }

        private static void DestroyView(SlotView view)
        {
            if (view == null)
            {
                return;
            }

            DestroyObject(view.mesh);
            DestroyObject(view.material);
            if (view.gameObject != null)
            {
                DestroyObject(view.gameObject);
            }
        }

        private static bool IsValidMesh(Suwol2DAttachment attachment)
        {
            if (attachment.Vertices == null || attachment.Vertices.Length < 3)
            {
                return false;
            }

            if (attachment.Triangles == null || attachment.Triangles.Length == 0 || attachment.Triangles.Length % 3 != 0)
            {
                return false;
            }

            for (var i = 0; i < attachment.Triangles.Length; i++)
            {
                var index = attachment.Triangles[i];
                if (index < 0 || index >= attachment.Vertices.Length)
                {
                    return false;
                }
            }

            return true;
        }

        private static Mesh CreateMesh(Suwol2DAttachment attachment, Suwol2DResolvedAtlasRegion atlasRegion)
        {
            var vertices = attachment.Vertices;
            var meshVertices = new Vector3[vertices.Length];
            var uv = new Vector2[vertices.Length];

            for (var i = 0; i < vertices.Length; i++)
            {
                var vertex = vertices[i];
                meshVertices[i] = new Vector3(vertex.x, vertex.y, 0f);
                uv[i] = RemapUv(vertex.u, vertex.v, atlasRegion);
            }

            var mesh = new Mesh();
            mesh.name = "Suwol2D Mesh Attachment";
            mesh.vertices = meshVertices;
            mesh.uv = uv;
            mesh.triangles = attachment.Triangles;
            mesh.RecalculateBounds();
            mesh.RecalculateNormals();
            return mesh;
        }

        private void UpdateWeightedMesh(SlotView view, Vector2[] deformOffsets)
        {
            if (view == null || view.mesh == null || skeleton == null)
            {
                return;
            }

            var solvedVertices = Suwol2DWeightedMeshSolver.Solve(skeleton, view.slot, view.attachment, bindPose, deformOffsets);
            if (solvedVertices.Length == 0)
            {
                return;
            }

            var transform = view.gameObject.transform;
            transform.localPosition = Vector3.zero;
            transform.localRotation = Quaternion.identity;
            transform.localScale = Vector3.one;

            view.mesh.vertices = solvedVertices;
            view.mesh.RecalculateBounds();
            view.mesh.RecalculateNormals();
        }

        private static void UpdateRigidMeshVertices(SlotView view, Vector2[] deformOffsets)
        {
            if (view == null || view.mesh == null || view.attachment == null || view.attachment.Vertices == null)
            {
                return;
            }

            var vertices = view.attachment.Vertices;
            var meshVertices = new Vector3[vertices.Length];
            for (var i = 0; i < vertices.Length; i++)
            {
                var vertex = vertices[i];
                var deformOffset = deformOffsets != null && i < deformOffsets.Length ? deformOffsets[i] : Vector2.zero;
                meshVertices[i] = new Vector3(vertex.x + deformOffset.x, vertex.y + deformOffset.y, 0f);
            }

            view.mesh.vertices = meshVertices;
            view.mesh.RecalculateBounds();
            view.mesh.RecalculateNormals();
        }

        private static void ApplyViewTransform(SlotView view)
        {
            var boneWorld = view.slot.Bone.WorldTransform;
            var attachment = view.attachment;
            var offset = new Vector2(
                attachment.X * boneWorld.scaleX,
                attachment.Y * boneWorld.scaleY);
            offset = Rotate(offset, boneWorld.rotation);

            var transform = view.gameObject.transform;
            transform.localPosition = new Vector3(boneWorld.x + offset.x, boneWorld.y + offset.y, -0.001f * view.gameObject.transform.GetSiblingIndex());
            transform.localRotation = Quaternion.Euler(0f, 0f, boneWorld.rotation + attachment.Rotation);
            transform.localScale = new Vector3(
                boneWorld.scaleX * attachment.ScaleX,
                boneWorld.scaleY * attachment.ScaleY,
                1f);
        }

        private static Material CreateMaterial(Material defaultMaterial, Texture2D texture)
        {
            Material material;
            if (defaultMaterial != null)
            {
                material = new Material(defaultMaterial);
            }
            else
            {
                var shader = FindRuntimeShader();
                if (shader == null)
                {
                    Debug.LogWarning("Suwol2D could not find a default shader. Assign defaultMaterial on Suwol2DCharacter.");
                    return null;
                }

                material = new Material(shader);
            }

            if (material != null)
            {
                material.name = "Suwol2D_" + texture.name;
                material.mainTexture = texture;
            }

            return material;
        }

        private void WarnForMissingWeightBonesOnce(Suwol2DSkeleton skeleton, Suwol2DAttachment attachment)
        {
            if (skeleton == null || attachment == null || attachment.Weights == null)
            {
                return;
            }

            for (var i = 0; i < attachment.Weights.Length; i++)
            {
                var vertexWeight = attachment.Weights[i];
                if (vertexWeight == null || vertexWeight.bones == null)
                {
                    continue;
                }

                for (var boneIndex = 0; boneIndex < vertexWeight.bones.Length; boneIndex++)
                {
                    var boneWeight = vertexWeight.bones[boneIndex];
                    if (boneWeight == null || string.IsNullOrEmpty(boneWeight.bone))
                    {
                        continue;
                    }

                    if (skeleton.FindBone(boneWeight.bone) == null)
                    {
                        var warningKey = attachment.Name + "/" + vertexWeight.vertex + "/" + boneWeight.bone;
                        if (!missingWeightBoneWarnings.Add(warningKey))
                        {
                            continue;
                        }

                        Debug.LogWarning(
                            "Suwol2D weighted mesh attachment '" + attachment.Name +
                            "' references missing bone '" + boneWeight.bone +
                            "' on vertex " + vertexWeight.vertex + ".");
                    }
                }
            }
        }

        private static string CreateCacheKey(
            Suwol2DSlot slot,
            Suwol2DAttachment attachment,
            Texture2D texture,
            Suwol2DSkinResolver skinResolver,
            bool isWeighted,
            Suwol2DResolvedAtlasRegion atlasRegion)
        {
            var skinName = skinResolver != null ? skinResolver.GetCurrentSkin() : string.Empty;
            return (slot != null ? slot.Name : string.Empty) + "|" +
                skinName + "|" +
                (attachment != null ? attachment.Name : string.Empty) + "|" +
                Suwol2DAttachment.MeshType + "|" +
                "visible|" +
                (isWeighted ? "weighted" : "rigid") + "|" +
                (attachment != null ? NormalizeTextureName(attachment.Image) : string.Empty) + "|" +
                (texture != null ? NormalizeTextureName(texture.name) : string.Empty) + "|" +
                CreateAtlasCacheKey(atlasRegion);
        }

        private void WarnInvalidMeshOnce(Suwol2DAttachment attachment)
        {
            var key = attachment != null ? attachment.Name : string.Empty;
            if (!invalidMeshWarnings.Add(key))
            {
                return;
            }

            Debug.LogWarning("Suwol2D mesh attachment has invalid vertices or triangles: " + key);
        }

        private void WarnMissingTextureOnce(Suwol2DSlot slot, Suwol2DAttachment attachment)
        {
            var key = (slot != null ? slot.Name : string.Empty) + "/" +
                (attachment != null ? attachment.Name : string.Empty) + "/" +
                (attachment != null ? attachment.Image : string.Empty);
            if (!missingTextureWarnings.Add(key))
            {
                return;
            }

            Debug.LogWarning(
                "Suwol2D texture not found for slot '" + (slot != null ? slot.Name : string.Empty) +
                "', mesh attachment '" + (attachment != null ? attachment.Name : string.Empty) +
                "', image '" + (attachment != null ? attachment.Image : string.Empty) + "'.");
        }

        private static Shader FindRuntimeShader()
        {
            var shader = Shader.Find("Sprites/Default");
            if (shader != null)
            {
                return shader;
            }

            shader = Shader.Find("Unlit/Transparent");
            if (shader != null)
            {
                return shader;
            }

            shader = Shader.Find("Unlit/Texture");
            if (shader != null)
            {
                return shader;
            }

            return Shader.Find("Universal Render Pipeline/Unlit");
        }

        private static Texture2D FindTexture(Texture2D[] textures, string imageName)
        {
            if (textures == null || string.IsNullOrEmpty(imageName))
            {
                return null;
            }

            var normalizedImageName = NormalizeTextureName(imageName);
            for (var i = 0; i < textures.Length; i++)
            {
                var texture = textures[i];
                if (texture == null)
                {
                    continue;
                }

                if (string.Equals(NormalizeTextureName(texture.name), normalizedImageName, System.StringComparison.OrdinalIgnoreCase))
                {
                    return texture;
                }
            }

            return null;
        }

        private static Suwol2DResolvedAtlasRegion ResolveAtlasRegion(Suwol2DAtlasLookup atlasLookup, string imageName)
        {
            if (atlasLookup == null)
            {
                return null;
            }

            Suwol2DResolvedAtlasRegion resolved;
            return atlasLookup.TryResolve(imageName, out resolved) ? resolved : null;
        }

        private static Vector2 RemapUv(float u, float v, Suwol2DResolvedAtlasRegion atlasRegion)
        {
            if (atlasRegion == null || atlasRegion.Region == null)
            {
                return new Vector2(u, v);
            }

            var region = atlasRegion.Region;
            return new Vector2(
                region.u + u * (region.u2 - region.u),
                region.v + v * (region.v2 - region.v));
        }

        private static string CreateAtlasCacheKey(Suwol2DResolvedAtlasRegion atlasRegion)
        {
            if (atlasRegion == null || atlasRegion.Region == null)
            {
                return "texture";
            }

            var region = atlasRegion.Region;
            return "atlas:" + region.name + ":" + region.u + "," + region.v + "," + region.u2 + "," + region.v2;
        }

        private static string NormalizeTextureName(string value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return string.Empty;
            }

            var normalized = value.Replace('\\', '/');
            var slashIndex = normalized.LastIndexOf('/');
            if (slashIndex >= 0 && slashIndex < normalized.Length - 1)
            {
                normalized = normalized.Substring(slashIndex + 1);
            }

            var lower = normalized.ToLowerInvariant();
            if (lower.EndsWith(".png") || lower.EndsWith(".jpg") || lower.EndsWith(".jpeg"))
            {
                var dotIndex = normalized.LastIndexOf('.');
                if (dotIndex > 0)
                {
                    normalized = normalized.Substring(0, dotIndex);
                }
            }

            return normalized;
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

        private static void DestroyObject(Object target)
        {
            if (target == null)
            {
                return;
            }

            if (Application.isPlaying)
            {
                Object.Destroy(target);
            }
            else
            {
                Object.DestroyImmediate(target);
            }
        }
    }
}
