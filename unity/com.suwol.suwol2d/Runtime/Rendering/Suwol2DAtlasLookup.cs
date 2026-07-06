using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public sealed class Suwol2DAtlasLookup
    {
        private readonly Dictionary<string, Suwol2DResolvedAtlasRegion> regionsByName = new Dictionary<string, Suwol2DResolvedAtlasRegion>();

        public Suwol2DAtlasLookup(Suwol2DAtlasData[] atlases, Texture2D[] textures)
        {
            Build(atlases, textures);
        }

        public bool TryResolve(string imageName, out Suwol2DResolvedAtlasRegion resolved)
        {
            resolved = null;
            if (string.IsNullOrEmpty(imageName))
            {
                return false;
            }

            return regionsByName.TryGetValue(NormalizeTextureName(imageName), out resolved) &&
                resolved != null &&
                resolved.Texture != null &&
                resolved.Region != null;
        }

        private void Build(Suwol2DAtlasData[] atlases, Texture2D[] textures)
        {
            regionsByName.Clear();
            if (atlases == null || textures == null)
            {
                return;
            }

            for (var atlasIndex = 0; atlasIndex < atlases.Length; atlasIndex++)
            {
                var atlas = atlases[atlasIndex];
                if (atlas == null || string.IsNullOrEmpty(atlas.image) || atlas.regions == null)
                {
                    continue;
                }

                var texture = FindTexture(textures, atlas.image);
                if (texture == null)
                {
                    continue;
                }

                for (var regionIndex = 0; regionIndex < atlas.regions.Length; regionIndex++)
                {
                    var region = atlas.regions[regionIndex];
                    if (region == null || string.IsNullOrEmpty(region.name))
                    {
                        continue;
                    }

                    var key = NormalizeTextureName(region.name);
                    if (!regionsByName.ContainsKey(key))
                    {
                        regionsByName.Add(key, new Suwol2DResolvedAtlasRegion(texture, region));
                    }
                }
            }
        }

        private static Texture2D FindTexture(Texture2D[] textures, string imageName)
        {
            var normalizedImageName = NormalizeTextureName(imageName);
            for (var i = 0; i < textures.Length; i++)
            {
                var texture = textures[i];
                if (texture != null && NormalizeTextureName(texture.name) == normalizedImageName)
                {
                    return texture;
                }
            }

            return null;
        }

        internal static string NormalizeTextureName(string value)
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

            return normalized.ToLowerInvariant();
        }
    }

    public sealed class Suwol2DResolvedAtlasRegion
    {
        public Texture2D Texture { get; private set; }
        public Suwol2DAtlasRegionData Region { get; private set; }

        public Suwol2DResolvedAtlasRegion(Texture2D texture, Suwol2DAtlasRegionData region)
        {
            Texture = texture;
            Region = region;
        }
    }
}
