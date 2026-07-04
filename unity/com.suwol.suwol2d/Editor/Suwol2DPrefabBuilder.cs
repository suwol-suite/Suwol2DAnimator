using UnityEditor;
using UnityEngine;

namespace Suwol.Suwol2D.Editor
{
    public static class Suwol2DPrefabBuilder
    {
        public static GameObject Build(
            Suwol2DAssetData data,
            TextAsset jsonAsset,
            Texture2D[] textures,
            Material defaultMaterial)
        {
            var objectName = string.IsNullOrEmpty(data != null ? data.name : null)
                ? "Suwol2D Character"
                : data.name;
            var root = new GameObject(objectName);
            var character = root.AddComponent<Suwol2DCharacter>();
            ApplyCharacterDefaults(character, jsonAsset, textures, defaultMaterial, ResolveInitialAnimation(data));
            return root;
        }

        public static void ApplyCharacterDefaults(
            Suwol2DCharacter character,
            TextAsset jsonAsset,
            Texture2D[] textures,
            Material defaultMaterial,
            string initialAnimation)
        {
            if (character == null)
            {
                return;
            }

            var serializedObject = new SerializedObject(character);
            serializedObject.FindProperty("jsonAsset").objectReferenceValue = jsonAsset;
            serializedObject.FindProperty("defaultMaterial").objectReferenceValue = defaultMaterial;
            serializedObject.FindProperty("playOnAwake").boolValue = true;
            serializedObject.FindProperty("initialAnimation").stringValue = string.IsNullOrEmpty(initialAnimation) ? "idle" : initialAnimation;
            serializedObject.FindProperty("animationSpeed").floatValue = 1f;

            var texturesProperty = serializedObject.FindProperty("textures");
            texturesProperty.arraySize = textures != null ? textures.Length : 0;
            for (var i = 0; i < texturesProperty.arraySize; i++)
            {
                texturesProperty.GetArrayElementAtIndex(i).objectReferenceValue = textures[i];
            }

            serializedObject.ApplyModifiedPropertiesWithoutUndo();
        }

        private static string ResolveInitialAnimation(Suwol2DAssetData data)
        {
            if (data == null || data.animations == null || data.animations.Length == 0)
            {
                return "idle";
            }

            for (var i = 0; i < data.animations.Length; i++)
            {
                var animation = data.animations[i];
                if (animation != null && animation.name == "walk")
                {
                    return "walk";
                }
            }

            for (var i = 0; i < data.animations.Length; i++)
            {
                var animation = data.animations[i];
                if (animation != null && animation.name == "idle")
                {
                    return "idle";
                }
            }

            return data.animations[0] != null && !string.IsNullOrEmpty(data.animations[0].name)
                ? data.animations[0].name
                : "idle";
        }
    }
}
