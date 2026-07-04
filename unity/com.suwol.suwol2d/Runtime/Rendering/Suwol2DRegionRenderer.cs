using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public sealed class Suwol2DRegionRenderer
    {
        private sealed class SlotView
        {
            public Suwol2DSlot slot;
            public Suwol2DAttachment attachment;
            public string cacheKey;
            public GameObject gameObject;
            public Mesh mesh;
            public Material material;
        }

        private readonly List<SlotView> views = new List<SlotView>();
        private readonly Dictionary<string, SlotView> viewsBySlot = new Dictionary<string, SlotView>();
        private readonly HashSet<string> missingTextureWarnings = new HashSet<string>();

        public int ViewCount
        {
            get { return views.Count; }
        }

        public void Build(
            Suwol2DSkeleton skeleton,
            Transform root,
            Texture2D[] textures,
            Material defaultMaterial,
            Suwol2DSkinResolver skinResolver = null)
        {
            Clear();
            Sync(skeleton, root, textures, defaultMaterial, skinResolver);
        }

        public void Sync(
            Suwol2DSkeleton skeleton,
            Transform root,
            Texture2D[] textures,
            Material defaultMaterial,
            Suwol2DSkinResolver skinResolver = null)
        {
            if (skeleton == null || root == null)
            {
                Debug.LogWarning("Suwol2DRegionRenderer.Sync skipped because skeleton or root transform was null.");
                return;
            }

            if (textures == null || textures.Length == 0)
            {
                Debug.LogWarning("Suwol2DRegionRenderer has no textures assigned. Region attachments will be skipped.");
            }

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
                if (attachment == null || !attachment.IsRegion)
                {
                    RemoveSlot(slot.Name);
                    continue;
                }

                var texture = FindTexture(textures, attachment.Image);
                if (texture == null)
                {
                    WarnMissingTextureOnce(slot, attachment);
                    RemoveSlot(slot.Name);
                    continue;
                }

                var cacheKey = CreateCacheKey(slot, attachment, texture, skinResolver);
                SlotView cachedView;
                if (viewsBySlot.TryGetValue(slot.Name, out cachedView) &&
                    cachedView != null &&
                    cachedView.gameObject != null &&
                    cachedView.mesh != null &&
                    cachedView.cacheKey == cacheKey)
                {
                    cachedView.slot = slot;
                    cachedView.attachment = attachment;
                    continue;
                }

                RemoveSlot(slot.Name);
                var view = CreateSlotView(slot, attachment, root, defaultMaterial, texture, cacheKey, i);
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

        public void UpdatePose()
        {
            for (var i = 0; i < views.Count; i++)
            {
                var view = views[i];
                if (view == null || view.gameObject == null || view.slot == null || view.slot.Bone == null)
                {
                    continue;
                }

                ApplyViewTransform(view);
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
            missingTextureWarnings.Clear();
        }

        private static SlotView CreateSlotView(
            Suwol2DSlot slot,
            Suwol2DAttachment attachment,
            Transform root,
            Material defaultMaterial,
            Texture2D texture,
            string cacheKey,
            int sortingOrder)
        {
            var viewObject = new GameObject(slot.Name + "_Region");
            viewObject.transform.SetParent(root, false);

            var meshFilter = viewObject.AddComponent<MeshFilter>();
            var meshRenderer = viewObject.AddComponent<MeshRenderer>();
            var mesh = CreateQuadMesh(attachment.Width, attachment.Height);
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
                material = material
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

        private static Mesh CreateQuadMesh(float width, float height)
        {
            var halfWidth = width * 0.5f;
            var halfHeight = height * 0.5f;
            var mesh = new Mesh();
            mesh.name = "Suwol2D Region Quad";
            mesh.vertices = new[]
            {
                new Vector3(-halfWidth, -halfHeight, 0f),
                new Vector3(-halfWidth, halfHeight, 0f),
                new Vector3(halfWidth, halfHeight, 0f),
                new Vector3(halfWidth, -halfHeight, 0f)
            };
            mesh.uv = new[]
            {
                new Vector2(0f, 0f),
                new Vector2(0f, 1f),
                new Vector2(1f, 1f),
                new Vector2(1f, 0f)
            };
            mesh.triangles = new[] { 0, 1, 2, 0, 2, 3 };
            mesh.RecalculateBounds();
            mesh.RecalculateNormals();
            return mesh;
        }

        private static string CreateCacheKey(
            Suwol2DSlot slot,
            Suwol2DAttachment attachment,
            Texture2D texture,
            Suwol2DSkinResolver skinResolver)
        {
            var skinName = skinResolver != null ? skinResolver.GetCurrentSkin() : string.Empty;
            return (slot != null ? slot.Name : string.Empty) + "|" +
                skinName + "|" +
                (attachment != null ? attachment.Name : string.Empty) + "|" +
                Suwol2DAttachment.RegionType + "|" +
                "visible|" +
                (attachment != null ? NormalizeTextureName(attachment.Image) : string.Empty) + "|" +
                (texture != null ? NormalizeTextureName(texture.name) : string.Empty);
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
                "', attachment '" + (attachment != null ? attachment.Name : string.Empty) +
                "', image '" + (attachment != null ? attachment.Image : string.Empty) + "'.");
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

            var dotIndex = normalized.LastIndexOf('.');
            if (dotIndex > 0)
            {
                normalized = normalized.Substring(0, dotIndex);
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
