using System.Collections.Generic;
using Suwol.Suwol2D;
using UnityEditor;
using UnityEngine;

namespace Suwol.Suwol2D.Editor
{
    public static class Suwol2DRuntimeMvpDemoMenu
    {
        private const string DemoMenuPath = "Tools/Suwol2D/Create Runtime MVP Demo";
        private const string SelectedAssetsDemoMenuPath = "Tools/Suwol2D/Create Runtime MVP Demo From Selected Assets";
        private const string MeshDemoMenuPath = "Tools/Suwol2D/Create Mesh Attachment v1 Demo";
        private const string WeightedMeshDemoMenuPath = "Tools/Suwol2D/Create Weighted Mesh v2 Demo";
        private const string DeformTimelineDemoMenuPath = "Tools/Suwol2D/Create Deform Timeline v3 Demo";
        private const string IkConstraintDemoMenuPath = "Tools/Suwol2D/Create IK Constraint v5 Demo";
        private const string SkinAttachmentSwapDemoMenuPath = "Tools/Suwol2D/Create Skin Attachment Swap v6 Demo";
        private const string AnimationTimelinesDemoMenuPath = "Tools/Suwol2D/Create Animation Timelines v8 Demo";
        private const string AnimationMixingStateMachineDemoMenuPath = "Tools/Suwol2D/Create Animation Mixing State Machine v10 Demo";
        private const string ImportedSuwol2DAssetDemoMenuPath = "Tools/Suwol2D/Create Demo From Imported Suwol2D Asset";
        private const string DemoObjectName = "Suwol2D Runtime MVP Demo";
        private const string DemoFolderPath = "Assets/Suwol2D Runtime MVP";
        private const string DemoMaterialPath = DemoFolderPath + "/Suwol2DDefault.mat";

        [MenuItem(DemoMenuPath)]
        public static void CreateRuntimeMvpDemo()
        {
            if (Application.isPlaying)
            {
                Debug.LogWarning("Create the Suwol2D Runtime MVP demo in Edit Mode, then enter Play Mode to test playback.");
                return;
            }

            var demoObject = GetOrCreateDemoObject();
            var character = GetOrAddCharacter(demoObject);

            var sampleJson = FindAssetByExactName<TextAsset>("sample_character", "sample_character.suwol2d");
            var bodyTexture = FindAssetByExactName<Texture2D>("body");
            var armTexture = FindAssetByExactName<Texture2D>("arm");
            var material = LoadOrCreateDefaultMaterial();

            ApplyCharacterDefaults(character, sampleJson, new[] { bodyTexture, armTexture }, material, "idle");

            Selection.activeGameObject = demoObject;
            EditorGUIUtility.PingObject(demoObject);

            if (sampleJson == null || bodyTexture == null || armTexture == null)
            {
                Debug.LogWarning(
                    "Suwol2D Runtime MVP demo object was created, but sample assets were not fully assigned. " +
                    "Import the Runtime MVP v0 sample from Package Manager, then assign these fields manually: " +
                    "jsonAsset = sample_character.suwol2d.json, textures[0] = body.png, textures[1] = arm.png, defaultMaterial = Suwol2DDefault.");
                return;
            }

            Debug.Log("Suwol2D Runtime MVP demo object created. Enter Play Mode to see the idle animation.");
        }

        [MenuItem(MeshDemoMenuPath)]
        public static void CreateMeshAttachmentV1Demo()
        {
            if (Application.isPlaying)
            {
                Debug.LogWarning("Create the Suwol2D Mesh Attachment v1 demo in Edit Mode, then enter Play Mode to test playback.");
                return;
            }

            var demoObject = GetOrCreateDemoObject();
            var character = GetOrAddCharacter(demoObject);

            var sampleJson = FindAssetByExactName<TextAsset>("sample_mesh_character", "sample_mesh_character.suwol2d");
            var bodyTexture = FindAssetByExactName<Texture2D>("body");
            var armTexture = FindAssetByExactName<Texture2D>("arm");
            var material = LoadOrCreateDefaultMaterial();

            ApplyCharacterDefaults(character, sampleJson, new[] { bodyTexture, armTexture }, material, "idle");

            Selection.activeGameObject = demoObject;
            EditorGUIUtility.PingObject(demoObject);

            if (sampleJson == null || bodyTexture == null || armTexture == null)
            {
                Debug.LogWarning(
                    "Suwol2D Mesh Attachment v1 demo object was created, but sample assets were not fully assigned. " +
                    "Import the Mesh Attachment v1 sample from Package Manager, then assign jsonAsset and textures manually.");
                return;
            }

            Debug.Log("Suwol2D Mesh Attachment v1 demo object created. Enter Play Mode to see the idle animation.");
        }

        [MenuItem(WeightedMeshDemoMenuPath)]
        public static void CreateWeightedMeshV2Demo()
        {
            if (Application.isPlaying)
            {
                Debug.LogWarning("Create the Suwol2D Weighted Mesh v2 demo in Edit Mode, then enter Play Mode to test playback.");
                return;
            }

            var demoObject = GetOrCreateDemoObject();
            var character = GetOrAddCharacter(demoObject);

            var sampleJson = FindAssetByExactName<TextAsset>("sample_weighted_character", "sample_weighted_character.suwol2d");
            var bodyTexture = FindAssetByExactName<Texture2D>("body");
            var armTexture = FindAssetByExactName<Texture2D>("arm");
            var material = LoadOrCreateDefaultMaterial();

            ApplyCharacterDefaults(character, sampleJson, new[] { bodyTexture, armTexture }, material, "walk");

            Selection.activeGameObject = demoObject;
            EditorGUIUtility.PingObject(demoObject);

            if (sampleJson == null || bodyTexture == null || armTexture == null)
            {
                Debug.LogWarning(
                    "Suwol2D Weighted Mesh v2 demo object was created, but sample assets were not fully assigned. " +
                    "Import the Weighted Mesh v2 sample from Package Manager, then assign jsonAsset and textures manually.");
                return;
            }

            Debug.Log("Suwol2D Weighted Mesh v2 demo object created. Enter Play Mode to see the weighted arm mesh follow upper_arm/lower_arm.");
        }

        [MenuItem(DeformTimelineDemoMenuPath)]
        public static void CreateDeformTimelineV3Demo()
        {
            if (Application.isPlaying)
            {
                Debug.LogWarning("Create the Suwol2D Deform Timeline v3 demo in Edit Mode, then enter Play Mode to test playback.");
                return;
            }

            var demoObject = GetOrCreateDemoObject();
            var character = GetOrAddCharacter(demoObject);

            var sampleJson = FindAssetByExactName<TextAsset>("sample_deform_character", "sample_deform_character.suwol2d");
            var bodyTexture = FindAssetByExactName<Texture2D>("body");
            var armTexture = FindAssetByExactName<Texture2D>("arm");
            var material = LoadOrCreateDefaultMaterial();

            ApplyCharacterDefaults(character, sampleJson, new[] { bodyTexture, armTexture }, material, "walk");

            Selection.activeGameObject = demoObject;
            EditorGUIUtility.PingObject(demoObject);

            if (sampleJson == null || bodyTexture == null || armTexture == null)
            {
                Debug.LogWarning(
                    "Suwol2D Deform Timeline v3 demo object was created, but sample assets were not fully assigned. " +
                    "Import the Deform Timeline v3 sample from Package Manager, then assign jsonAsset and textures manually.");
                return;
            }

            Debug.Log("Suwol2D Deform Timeline v3 demo object created. Enter Play Mode to see deform offsets combine with weighted mesh playback.");
        }

        [MenuItem(IkConstraintDemoMenuPath)]
        public static void CreateIkConstraintV5Demo()
        {
            if (Application.isPlaying)
            {
                Debug.LogWarning("Create the Suwol2D IK Constraint v5 demo in Edit Mode, then enter Play Mode to test playback.");
                return;
            }

            var demoObject = GetOrCreateDemoObject();
            var character = GetOrAddCharacter(demoObject);

            var sampleJson = FindAssetByExactName<TextAsset>("sample_ik_character", "sample_ik_character.suwol2d");
            var bodyTexture = FindAssetByExactName<Texture2D>("body");
            var armTexture = FindAssetByExactName<Texture2D>("arm");
            var material = LoadOrCreateDefaultMaterial();

            ApplyCharacterDefaults(character, sampleJson, new[] { bodyTexture, armTexture }, material, "walk");

            Selection.activeGameObject = demoObject;
            EditorGUIUtility.PingObject(demoObject);

            if (sampleJson == null || bodyTexture == null || armTexture == null)
            {
                Debug.LogWarning(
                    "Suwol2D IK Constraint v5 demo object was created, but sample assets were not fully assigned. " +
                    "Import the IK Constraint v5 sample from Package Manager, then assign jsonAsset and textures manually.");
                return;
            }

            Debug.Log("Suwol2D IK Constraint v5 demo object created. Enter Play Mode to see upper_arm/lower_arm follow hand_target.");
        }

        [MenuItem(SkinAttachmentSwapDemoMenuPath)]
        public static void CreateSkinAttachmentSwapV6Demo()
        {
            if (Application.isPlaying)
            {
                Debug.LogWarning("Create the Suwol2D Skin Attachment Swap v6 demo in Edit Mode, then enter Play Mode to test skin swaps.");
                return;
            }

            var demoObject = GetOrCreateDemoObject();
            var character = GetOrAddCharacter(demoObject);

            var sampleJson = FindAssetByExactName<TextAsset>("sample_skin_character", "sample_skin_character.suwol2d");
            var bodyTexture = FindAssetByExactName<Texture2D>("body");
            var armTexture = FindAssetByExactName<Texture2D>("arm");
            var bodyArmorTexture = FindAssetByExactName<Texture2D>("body_armor");
            var armArmorTexture = FindAssetByExactName<Texture2D>("arm_armor");
            var material = LoadOrCreateDefaultMaterial();

            ApplyCharacterDefaults(
                character,
                sampleJson,
                new[] { bodyTexture, armTexture, bodyArmorTexture, armArmorTexture },
                material,
                "walk");

            Selection.activeGameObject = demoObject;
            EditorGUIUtility.PingObject(demoObject);

            if (sampleJson == null || bodyTexture == null || armTexture == null || bodyArmorTexture == null || armArmorTexture == null)
            {
                Debug.LogWarning(
                    "Suwol2D Skin Attachment Swap v6 demo object was created, but sample assets were not fully assigned. " +
                    "Import the Skin Attachment Swap v6 sample from Package Manager, then assign jsonAsset and textures manually.");
                return;
            }

            Debug.Log("Suwol2D Skin Attachment Swap v6 demo object created. Enter Play Mode and call SetSkin(\"armor_01\") to swap attachments.");
        }

        [MenuItem(SelectedAssetsDemoMenuPath)]
        public static void CreateRuntimeMvpDemoFromSelectedAssets()
        {
            if (Application.isPlaying)
            {
                Debug.LogWarning("Create the Suwol2D Runtime MVP demo in Edit Mode, then enter Play Mode to test playback.");
                return;
            }

            TextAsset jsonAsset = null;
            Material material = null;
            var textures = new List<Texture2D>();
            var selectedObjects = Selection.objects;

            for (var i = 0; i < selectedObjects.Length; i++)
            {
                var selected = selectedObjects[i];
                if (jsonAsset == null && selected is TextAsset selectedText && LooksLikeSuwol2DJson(selectedText))
                {
                    jsonAsset = selectedText;
                    continue;
                }

                if (selected is Texture2D texture)
                {
                    textures.Add(texture);
                    continue;
                }

                if (material == null && selected is Material selectedMaterial)
                {
                    material = selectedMaterial;
                }
            }

            if (jsonAsset == null)
            {
                Debug.LogWarning(
                    "Select an exported .suwol2d.json TextAsset and its Texture2D assets, then run " +
                    SelectedAssetsDemoMenuPath + ".");
                return;
            }

            if (material == null)
            {
                material = LoadOrCreateDefaultMaterial();
            }

            var demoObject = GetOrCreateDemoObject();
            var character = GetOrAddCharacter(demoObject);
            var initialAnimation = ResolveInitialAnimation(jsonAsset);
            ApplyCharacterDefaults(character, jsonAsset, textures.ToArray(), material, initialAnimation);

            Selection.activeGameObject = demoObject;
            EditorGUIUtility.PingObject(demoObject);

            if (textures.Count == 0)
            {
                Debug.LogWarning(
                    "Suwol2D demo object was created from '" + jsonAsset.name +
                    "', but no Texture2D assets were selected. Assign exported Textures manually before Play Mode.");
                return;
            }

            Debug.Log(
                "Suwol2D Runtime MVP demo object created from selected assets. " +
                "Initial animation: " + initialAnimation + ". Enter Play Mode to test playback.");
        }

        [MenuItem(ImportedSuwol2DAssetDemoMenuPath)]
        public static void CreateDemoFromImportedSuwol2DAsset()
        {
            if (Application.isPlaying)
            {
                Debug.LogWarning("Create the Suwol2D imported asset demo in Edit Mode, then enter Play Mode to test playback.");
                return;
            }

            var prefab = ResolveSelectedImportedPrefab();
            if (prefab == null)
            {
                Debug.LogWarning(
                    "Select an imported .suwol2d asset or its Suwol2D import report, then run " +
                    ImportedSuwol2DAssetDemoMenuPath + ".");
                return;
            }

            var instance = PrefabUtility.InstantiatePrefab(prefab) as GameObject;
            if (instance == null)
            {
                instance = Object.Instantiate(prefab);
            }

            Undo.RegisterCreatedObjectUndo(instance, "Create Suwol2D Imported Asset Demo");
            Selection.activeGameObject = instance;
            EditorGUIUtility.PingObject(instance);
            Debug.Log("Suwol2D imported asset demo instance created from '" + prefab.name + "'. Enter Play Mode to test playback.");
        }

        [MenuItem(AnimationTimelinesDemoMenuPath)]
        public static void CreateAnimationTimelinesV8Demo()
        {
            if (Application.isPlaying)
            {
                Debug.LogWarning("Create the Suwol2D Animation Timelines v8 demo in Edit Mode, then enter Play Mode to test playback.");
                return;
            }

            var demoObject = GetOrCreateDemoObject();
            var character = GetOrAddCharacter(demoObject);
            if (demoObject.GetComponent<Suwol2DAnimationEventLogger>() == null)
            {
                Undo.AddComponent<Suwol2DAnimationEventLogger>(demoObject);
            }

            var sampleJson = FindAssetByExactName<TextAsset>("sample_animation_timelines", "sample_animation_timelines.suwol2d");
            var bodyTexture = FindAssetByExactName<Texture2D>("body");
            var armTexture = FindAssetByExactName<Texture2D>("arm");
            var swordTexture = FindAssetByExactName<Texture2D>("sword");
            var axeTexture = FindAssetByExactName<Texture2D>("axe");
            var material = LoadOrCreateDefaultMaterial();

            ApplyCharacterDefaults(
                character,
                sampleJson,
                new[] { bodyTexture, armTexture, swordTexture, axeTexture },
                material,
                "walk");

            Selection.activeGameObject = demoObject;
            EditorGUIUtility.PingObject(demoObject);

            if (sampleJson == null || bodyTexture == null || armTexture == null || swordTexture == null || axeTexture == null)
            {
                Debug.LogWarning(
                    "Suwol2D Animation Timelines v8 demo object was created, but sample assets were not fully assigned. " +
                    "Import the Animation Timelines v8 sample from Package Manager, then assign jsonAsset and textures manually.");
                return;
            }

            Debug.Log("Suwol2D Animation Timelines v8 demo object created. Enter Play Mode to test attachment, draw order, slot color, and events.");
        }

        [MenuItem(AnimationMixingStateMachineDemoMenuPath)]
        public static void CreateAnimationMixingStateMachineV10Demo()
        {
            if (Application.isPlaying)
            {
                Debug.LogWarning("Create the Suwol2D Animation Mixing State Machine v10 demo in Edit Mode, then enter Play Mode to test transitions.");
                return;
            }

            var demoObject = GetOrCreateDemoObject();
            var character = GetOrAddCharacter(demoObject);
            if (demoObject.GetComponent<Suwol2DAnimationEventLogger>() == null)
            {
                Undo.AddComponent<Suwol2DAnimationEventLogger>(demoObject);
            }
            if (demoObject.GetComponent<Suwol2DStateMachineDemoController>() == null)
            {
                Undo.AddComponent<Suwol2DStateMachineDemoController>(demoObject);
            }

            var sampleJson = FindAssetByExactName<TextAsset>("sample_animation_mixing_state_machine", "sample_animation_mixing_state_machine.suwol2d");
            var bodyTexture = FindAssetByExactName<Texture2D>("body");
            var armTexture = FindAssetByExactName<Texture2D>("arm");
            var swordTexture = FindAssetByExactName<Texture2D>("sword");
            var axeTexture = FindAssetByExactName<Texture2D>("axe");
            var material = LoadOrCreateDefaultMaterial();

            ApplyCharacterDefaults(
                character,
                sampleJson,
                new[] { bodyTexture, armTexture, swordTexture, axeTexture },
                material,
                "idle");

            Selection.activeGameObject = demoObject;
            EditorGUIUtility.PingObject(demoObject);

            if (sampleJson == null || bodyTexture == null || armTexture == null || swordTexture == null || axeTexture == null)
            {
                Debug.LogWarning(
                    "Suwol2D Animation Mixing State Machine v10 demo object was created, but sample assets were not fully assigned. " +
                    "Import the Animation Mixing State Machine v10 sample from Package Manager, then assign jsonAsset and textures manually.");
                return;
            }

            Debug.Log("Suwol2D Animation Mixing State Machine v10 demo object created. Enter Play Mode to test idle/walk crossfade and attack trigger transitions.");
        }

        private static void ApplyCharacterDefaults(
            Suwol2DCharacter character,
            TextAsset jsonAsset,
            Texture2D[] textures,
            Material material,
            string initialAnimation)
        {
            var serializedObject = new SerializedObject(character);
            serializedObject.FindProperty("jsonAsset").objectReferenceValue = jsonAsset;
            serializedObject.FindProperty("defaultMaterial").objectReferenceValue = material;
            serializedObject.FindProperty("playOnAwake").boolValue = true;
            serializedObject.FindProperty("initialAnimation").stringValue = string.IsNullOrEmpty(initialAnimation) ? "idle" : initialAnimation;
            serializedObject.FindProperty("animationSpeed").floatValue = 1f;

            var texturesProperty = serializedObject.FindProperty("textures");
            texturesProperty.arraySize = textures != null ? textures.Length : 0;
            for (var i = 0; i < texturesProperty.arraySize; i++)
            {
                texturesProperty.GetArrayElementAtIndex(i).objectReferenceValue = textures[i];
            }

            serializedObject.ApplyModifiedProperties();
        }

        private static GameObject GetOrCreateDemoObject()
        {
            var demoObject = GameObject.Find(DemoObjectName);
            if (demoObject == null)
            {
                demoObject = new GameObject(DemoObjectName);
                Undo.RegisterCreatedObjectUndo(demoObject, "Create Suwol2D Runtime MVP Demo");
            }
            else
            {
                Debug.Log("Reusing existing Suwol2D Runtime MVP Demo object instead of creating a duplicate.");
            }

            return demoObject;
        }

        private static Suwol2DCharacter GetOrAddCharacter(GameObject demoObject)
        {
            var character = demoObject.GetComponent<Suwol2DCharacter>();
            if (character == null)
            {
                character = Undo.AddComponent<Suwol2DCharacter>(demoObject);
            }

            return character;
        }

        private static bool LooksLikeSuwol2DJson(TextAsset asset)
        {
            if (asset == null)
            {
                return false;
            }

            var path = AssetDatabase.GetAssetPath(asset);
            if (!string.IsNullOrEmpty(path) && path.EndsWith(".suwol2d.json", System.StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            return asset.text.Contains("\"bones\"") && asset.text.Contains("\"animations\"");
        }

        private static string ResolveInitialAnimation(TextAsset jsonAsset)
        {
            if (jsonAsset == null)
            {
                return "idle";
            }

            try
            {
                var data = JsonUtility.FromJson<Suwol2DAssetData>(jsonAsset.text);
                if (data == null || data.animations == null || data.animations.Length == 0)
                {
                    return "idle";
                }

                for (var i = 0; i < data.animations.Length; i++)
                {
                    var animation = data.animations[i];
                    if (animation != null && animation.name == "idle")
                    {
                        return "idle";
                    }
                }

                return string.IsNullOrEmpty(data.animations[0].name) ? "idle" : data.animations[0].name;
            }
            catch (System.Exception exception)
            {
                Debug.LogWarning("Could not inspect Suwol2D animation names from '" + jsonAsset.name + "': " + exception.Message);
                return "idle";
            }
        }

        private static Material LoadOrCreateDefaultMaterial()
        {
            EnsureDemoFolder();

            var material = AssetDatabase.LoadAssetAtPath<Material>(DemoMaterialPath);
            if (material != null)
            {
                return material;
            }

            var shader = FindDemoShader();
            if (shader == null)
            {
                Debug.LogWarning("Suwol2D could not find a demo shader. The demo material was not created.");
                return null;
            }

            material = new Material(shader);
            AssetDatabase.CreateAsset(material, DemoMaterialPath);
            AssetDatabase.SaveAssets();
            return material;
        }

        private static void EnsureDemoFolder()
        {
            if (AssetDatabase.IsValidFolder(DemoFolderPath))
            {
                return;
            }

            AssetDatabase.CreateFolder("Assets", "Suwol2D Runtime MVP");
        }

        private static T FindAssetByExactName<T>(params string[] assetNames) where T : Object
        {
            if (assetNames == null || assetNames.Length == 0)
            {
                return null;
            }

            var filter = assetNames[0] + " t:" + typeof(T).Name;
            var guids = AssetDatabase.FindAssets(filter);
            for (var i = 0; i < guids.Length; i++)
            {
                var path = AssetDatabase.GUIDToAssetPath(guids[i]);
                var asset = AssetDatabase.LoadAssetAtPath<T>(path);
                if (asset != null && MatchesAnyName(asset.name, assetNames))
                {
                    return asset;
                }
            }

            return null;
        }

        private static bool MatchesAnyName(string actualName, string[] expectedNames)
        {
            for (var i = 0; i < expectedNames.Length; i++)
            {
                if (actualName == expectedNames[i])
                {
                    return true;
                }
            }

            return false;
        }

        private static GameObject ResolveSelectedImportedPrefab()
        {
            var selected = Selection.activeObject;
            if (selected == null)
            {
                return null;
            }

            if (selected is Suwol2DImportedAsset importedAsset)
            {
                return importedAsset.Report != null ? importedAsset.Report.GeneratedPrefab : null;
            }

            if (selected is GameObject gameObject)
            {
                var path = AssetDatabase.GetAssetPath(gameObject);
                if (!string.IsNullOrEmpty(path) && path.EndsWith(".suwol2d", System.StringComparison.OrdinalIgnoreCase))
                {
                    return gameObject;
                }
            }

            var selectedPath = AssetDatabase.GetAssetPath(selected);
            if (string.IsNullOrEmpty(selectedPath) || !selectedPath.EndsWith(".suwol2d", System.StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            return AssetDatabase.LoadMainAssetAtPath(selectedPath) as GameObject;
        }

        private static Shader FindDemoShader()
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
    }
}
