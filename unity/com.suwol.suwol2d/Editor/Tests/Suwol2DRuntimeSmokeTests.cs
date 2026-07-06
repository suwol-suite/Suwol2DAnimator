using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;
using PackageManagerPackageInfo = UnityEditor.PackageManager.PackageInfo;

namespace Suwol.Suwol2D.Editor.Tests
{
    public static class Suwol2DRuntimeSmokeTests
    {
        private const string SmokeAssetRoot = "Assets/Suwol2DSmokeV9";
        private static readonly string[] ExpectedSamples =
        {
            "RuntimeMvp",
            "MeshAttachmentV1",
            "WeightedMeshV2",
            "DeformTimelineV3",
            "IkConstraintV5",
            "SkinAttachmentSwapV6",
            "ImporterPrefabWorkflowV7",
            "AnimationTimelinesV8",
            "AnimationMixingStateMachineV10",
            "TimelineUsabilityV11",
            "CurveInterpolationV20",
            "ClippingMaskV21",
            "TransformConstraintV22"
        };

        public static void RunAll()
        {
            var exitCode = 0;
            try
            {
                CleanupCopiedSamples();
                var packageRoot = ResolvePackageRoot();
                var samplesRoot = Path.Combine(packageRoot, "Samples~");
                Assert(Directory.Exists(samplesRoot), "Samples~ directory was not found: " + samplesRoot);

                var jsonFiles = ValidatePackageSamples(samplesRoot);
                var copiedRoot = CopySamplesToAssets(samplesRoot);
                AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);

                ValidateCopiedJsonRuntime(copiedRoot);
                ValidateImporterAssets(copiedRoot);
                ValidateImporterReimportRecovery(copiedRoot);
                ValidateMalformedRuntimeJson();
                ValidateAtlasLookupApi();
                ValidateEventDispatcher(jsonFiles);

                Debug.Log("Suwol2D Runtime Stability v9 + Animation Mixing State Machine v10 + Timeline Usability v11 + Curve Interpolation v20 + Clipping Mask v21 + Transform Constraint v22 smoke tests passed.");
            }
            catch (Exception exception)
            {
                exitCode = 1;
                Debug.LogException(exception);
            }
            finally
            {
                CleanupCopiedSamples();
                AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
                if (Application.isBatchMode)
                {
                    EditorApplication.Exit(exitCode);
                }
            }
        }

        private static string ResolvePackageRoot()
        {
            var packageInfo = PackageManagerPackageInfo.FindForAssetPath("Packages/com.suwol.suwol2d/package.json");
            if (packageInfo == null || string.IsNullOrEmpty(packageInfo.resolvedPath))
            {
                throw new InvalidOperationException("Could not resolve com.suwol.suwol2d package path.");
            }

            return packageInfo.resolvedPath;
        }

        private static List<string> ValidatePackageSamples(string samplesRoot)
        {
            var jsonFiles = new List<string>();
            for (var i = 0; i < ExpectedSamples.Length; i++)
            {
                var sampleFolder = Path.Combine(samplesRoot, ExpectedSamples[i]);
                Assert(Directory.Exists(sampleFolder), "Expected sample folder is missing: " + ExpectedSamples[i]);
            }

            jsonFiles.AddRange(Directory.GetFiles(samplesRoot, "*.suwol2d.json", SearchOption.AllDirectories));
            Assert(jsonFiles.Count >= ExpectedSamples.Length, "Expected every sample to include at least one .suwol2d.json file.");

            for (var i = 0; i < jsonFiles.Count; i++)
            {
                var json = File.ReadAllText(jsonFiles[i]);
                var data = JsonUtility.FromJson<Suwol2DAssetData>(json);
                AssertValidData(data, jsonFiles[i]);
                AssertTextureFilesExist(jsonFiles[i], data);
            }

            var suwol2dFiles = Directory.GetFiles(samplesRoot, "*.suwol2d", SearchOption.AllDirectories);
            for (var i = 0; i < suwol2dFiles.Length; i++)
            {
                var json = File.ReadAllText(suwol2dFiles[i]);
                var data = JsonUtility.FromJson<Suwol2DAssetData>(json);
                AssertValidData(data, suwol2dFiles[i]);

                var debugJsonPath = suwol2dFiles[i] + ".json";
                Assert(File.Exists(debugJsonPath), ".suwol2d sample is missing matching debug JSON: " + suwol2dFiles[i]);
                Assert(
                    NormalizeJson(json) == NormalizeJson(File.ReadAllText(debugJsonPath)),
                    ".suwol2d sample should match its .suwol2d.json debug pair: " + suwol2dFiles[i]);
            }

            return jsonFiles;
        }

        private static string CopySamplesToAssets(string samplesRoot)
        {
            CleanupCopiedSamples();
            var copiedRootPath = AssetPathToFullPath(SmokeAssetRoot);
            Directory.CreateDirectory(copiedRootPath);

            for (var i = 0; i < ExpectedSamples.Length; i++)
            {
                var source = Path.Combine(samplesRoot, ExpectedSamples[i]);
                var destination = Path.Combine(copiedRootPath, ExpectedSamples[i]);
                FileUtil.CopyFileOrDirectory(source, destination);
            }

            return copiedRootPath;
        }

        private static void ValidateCopiedJsonRuntime(string copiedRoot)
        {
            var jsonFiles = Directory.GetFiles(copiedRoot, "*.suwol2d.json", SearchOption.AllDirectories);
            Assert(jsonFiles.Length >= ExpectedSamples.Length, "Copied samples should include .suwol2d.json files.");

            for (var i = 0; i < jsonFiles.Length; i++)
            {
                var json = File.ReadAllText(jsonFiles[i]);
                var data = JsonUtility.FromJson<Suwol2DAssetData>(json);
                AssertValidData(data, jsonFiles[i]);

                var characterObject = new GameObject("Suwol2D Smoke Character");
                Material smokeMaterial = null;
                try
                {
                    var character = characterObject.AddComponent<Suwol2DCharacter>();
                    smokeMaterial = CreateSmokeMaterial();
                    SetPrivateField(character, "textures", LoadTexturesForSample(jsonFiles[i]));
                    SetPrivateField(character, "defaultMaterial", smokeMaterial);

                    character.LoadFromJson(json);
                    Assert(character.Skeleton != null, "LoadFromJson should create a skeleton: " + jsonFiles[i]);

                    character.LoadFromData(JsonUtility.FromJson<Suwol2DAssetData>(json));
                    Assert(character.Skeleton != null, "LoadFromData should create a skeleton: " + jsonFiles[i]);

                    var animationName = FirstAnimationName(data);
                    Assert(character.HasAnimation(animationName), "HasAnimation failed for " + animationName);
                    character.SetAnimationSpeed(1.25f);
                    character.AnimationEvent += delegate { };
                    character.Play(animationName);

                    var maxRendererCount = Math.Max(1, data.slots != null ? data.slots.Length : 0);
                    for (var step = 0; step < 8; step++)
                    {
                        StepCharacter(character, 0.12f);
                        Assert(
                            GetRendererViewCount(character) <= maxRendererCount,
                            "Renderer view count grew beyond slot count for " + jsonFiles[i]);
                        AssertNoNaNTransforms(characterObject);
                    }

                    ValidateSkinAndAttachmentApi(character, data);
                    ValidateAnimationMixingStateMachineApi(character, data, jsonFiles[i]);
                    ValidateTimelineUsabilityDuration(data, jsonFiles[i]);
                    ValidateCurveInterpolationApi(character, data, jsonFiles[i]);
                    ValidateClippingMaskApi(character, data, jsonFiles[i]);
                    ValidateTransformConstraintApi(character, data, jsonFiles[i]);
                    var countBefore = GetRendererViewCount(character);
                    for (var repeat = 0; repeat < 5; repeat++)
                    {
                        character.SetAnimationSpeed(1f);
                        StepCharacter(character, 0f);
                    }
                    Assert(
                        GetRendererViewCount(character) == countBefore,
                        "Stable runtime update should not accumulate renderer views for " + jsonFiles[i]);

                    var dispatched = 0;
                    character.AnimationEvent += delegate { dispatched++; };
                    InvokePrivate(character, "DispatchAnimationEvent", new Suwol2DAnimationEvent("smoke", "manual", 0f, 0, 0f, string.Empty));
                    Assert(dispatched == 1, "AnimationEvent should dispatch to subscribers.");
                    character.Stop();
                }
                finally
                {
                    if (smokeMaterial != null)
                    {
                        Object.DestroyImmediate(smokeMaterial);
                    }

                    Object.DestroyImmediate(characterObject);
                }
            }
        }

        private static void ValidateSkinAndAttachmentApi(Suwol2DCharacter character, Suwol2DAssetData data)
        {
            Assert(character.HasSkin("default"), "Runtime should expose the default skin.");
            Assert(character.SetSkin("default"), "SetSkin(default) should succeed.");
            Assert(character.GetCurrentSkin() == "default", "GetCurrentSkin should return default.");

            if (data.skins != null)
            {
                for (var i = 0; i < data.skins.Length; i++)
                {
                    var skin = data.skins[i];
                    if (skin != null && skin.name != "default" && character.HasSkin(skin.name))
                    {
                        Assert(character.SetSkin(skin.name), "SetSkin should succeed for " + skin.name);
                        Assert(character.GetCurrentSkin() == skin.name, "GetCurrentSkin should return " + skin.name);
                        break;
                    }
                }
            }

            var attachment = FirstAttachment(data);
            if (attachment != null)
            {
                Assert(character.SetAttachment(attachment.slot, attachment.name), "SetAttachment should succeed for " + attachment.name);
                character.ResetAttachments();
            }

            character.SetSkin("default");
        }

        private static void ValidateAnimationMixingStateMachineApi(Suwol2DCharacter character, Suwol2DAssetData data, string label)
        {
            if (data.stateMachines == null || data.stateMachines.Length == 0)
            {
                return;
            }

            Assert(character.HasAnimation("idle"), "v10 sample should include idle animation: " + label);
            Assert(character.HasAnimation("walk"), "v10 sample should include walk animation: " + label);
            Assert(character.HasAnimation("attack"), "v10 sample should include attack animation: " + label);

            character.Play("idle");
            Assert(character.CrossFade("walk", 0.15f), "CrossFade(walk) should succeed: " + label);
            Assert(character.IsTransitioning(), "CrossFade should start a transition: " + label);
            StepCharacter(character, 0.05f);
            var progress = character.GetTransitionProgress();
            Assert(progress > 0f && progress < 1f, "CrossFade progress should advance during fade: " + label);
            StepCharacter(character, 0.2f);
            Assert(!character.IsTransitioning(), "CrossFade should finish after fade duration: " + label);
            Assert(character.GetCurrentAnimationName() == "walk", "CrossFade should finish on walk: " + label);

            Assert(character.HasStateMachine("default"), "v10 sample should expose default state machine: " + label);
            Assert(character.PlayStateMachine("default"), "PlayStateMachine(default) should succeed: " + label);
            Assert(character.GetCurrentStateName() == "idle", "State machine should start in idle: " + label);

            Assert(character.SetBool("moving", true), "SetBool(moving) should succeed: " + label);
            StepCharacter(character, 0.02f);
            Assert(character.GetCurrentStateName() == "walk", "moving=true should transition idle -> walk: " + label);
            Assert(character.IsTransitioning(), "idle -> walk should be a fade transition: " + label);
            StepCharacter(character, 0.2f);
            Assert(!character.IsTransitioning(), "idle -> walk transition should finish: " + label);

            Assert(character.SetTrigger("attack"), "SetTrigger(attack) should succeed: " + label);
            StepCharacter(character, 0.02f);
            Assert(character.GetCurrentStateName() == "attack", "attack trigger should transition to attack: " + label);
            StepCharacter(character, 0.08f);
            Assert(character.GetCurrentAnimationName() == "attack", "attack transition should finish on attack animation: " + label);
        }

        private static void ValidateAtlasLookupApi()
        {
            var texture = new Texture2D(4, 4);
            texture.name = "sample.atlas";
            try
            {
                var lookup = new Suwol2DAtlasLookup(
                    new[]
                    {
                        new Suwol2DAtlasData
                        {
                            name = "sample",
                            image = "Atlas/sample.atlas.png",
                            width = 4,
                            height = 4,
                            regions = new[]
                            {
                                new Suwol2DAtlasRegionData
                                {
                                    name = "body",
                                    x = 0,
                                    y = 0,
                                    width = 2,
                                    height = 2,
                                    u = 0f,
                                    v = 0f,
                                    u2 = 0.5f,
                                    v2 = 0.5f
                                }
                            }
                        }
                    },
                    new[] { texture });

                Suwol2DResolvedAtlasRegion resolved;
                Assert(lookup.TryResolve("body", out resolved), "Atlas lookup should resolve a matching attachment image.");
                Assert(resolved != null && resolved.Texture == texture, "Atlas lookup should return the atlas texture.");
                Assert(resolved.Region != null && resolved.Region.u2 == 0.5f, "Atlas lookup should preserve region UVs.");
                Assert(!lookup.TryResolve("missing", out resolved), "Atlas lookup should fall back when a region is missing.");
            }
            finally
            {
                Object.DestroyImmediate(texture);
            }
        }

        private static void ValidateTimelineUsabilityDuration(Suwol2DAssetData data, string label)
        {
            if (!label.Replace('\\', '/').Contains("/TimelineUsabilityV11/"))
            {
                return;
            }

            var walk = FindAnimation(data, "walk");
            var attack = FindAnimation(data, "attack");
            Assert(walk != null, "v11 sample should include walk animation: " + label);
            Assert(attack != null, "v11 sample should include attack animation: " + label);
            Assert(Mathf.Abs(walk.duration - 1.2f) < 0.001f, "v11 walk should include explicit duration: " + label);
            Assert(Mathf.Abs(attack.duration - 0.8f) < 0.001f, "v11 attack should include explicit duration: " + label);
            Assert(Mathf.Abs(Suwol2DAnimationSampler.GetDuration(walk) - 1.2f) < 0.001f, "sampler should prefer v11 walk explicit duration: " + label);
            Assert(Mathf.Abs(Suwol2DAnimationSampler.GetDuration(attack) - 0.8f) < 0.001f, "sampler should prefer v11 attack explicit duration: " + label);
        }

        private static void ValidateCurveInterpolationApi(Suwol2DCharacter character, Suwol2DAssetData data, string label)
        {
            if (!label.Replace('\\', '/').Contains("/CurveInterpolationV20/"))
            {
                return;
            }

            Assert(Suwol2DInterpolation.Normalize(null) == Suwol2DInterpolation.Linear, "null interpolation should fall back to linear.");
            Assert(Mathf.Abs(Suwol2DInterpolation.Apply(Suwol2DInterpolation.Linear, 0.25f) - 0.25f) < 0.001f, "linear interpolation should preserve t.");
            Assert(Mathf.Abs(Suwol2DInterpolation.Apply(Suwol2DInterpolation.EaseInOut, 0.25f) - 0.125f) < 0.001f, "easeInOut should ease t.");
            Assert(Mathf.Abs(Suwol2DInterpolation.Apply(Suwol2DInterpolation.Stepped, 0.75f)) < 0.001f, "stepped interpolation should hold the current key.");

            var curveTest = FindAnimation(data, "curve_test");
            Assert(curveTest != null, "v20 sample should include curve_test animation: " + label);
            Assert(ContainsInterpolation(curveTest, Suwol2DInterpolation.Stepped), "v20 sample should include stepped keys: " + label);
            Assert(ContainsInterpolation(curveTest, Suwol2DInterpolation.Linear), "v20 sample should include linear keys: " + label);
            Assert(ContainsInterpolation(curveTest, Suwol2DInterpolation.EaseIn), "v20 sample should include easeIn keys: " + label);
            Assert(ContainsInterpolation(curveTest, Suwol2DInterpolation.EaseOut), "v20 sample should include easeOut keys: " + label);
            Assert(ContainsInterpolation(curveTest, Suwol2DInterpolation.EaseInOut), "v20 sample should include easeInOut keys: " + label);

            character.Play("curve_test");
            Assert(character.GetCurrentAnimationName() == "curve_test", "curve_test should play in runtime: " + label);
            StepCharacter(character, 0.2f);
            var arm = character.Skeleton != null ? character.Skeleton.FindBone("arm") : null;
            Assert(arm != null, "v20 sample should include arm bone: " + label);
            Assert(Mathf.Abs(arm.LocalTransform.rotation - -48f) < 0.001f, "stepped rotate should hold the previous key before the next key: " + label);
            AssertNoNaNTransforms(character.gameObject);
        }

        private static void ValidateClippingMaskApi(Suwol2DCharacter character, Suwol2DAssetData data, string label)
        {
            if (!label.Replace('\\', '/').Contains("/ClippingMaskV21/"))
            {
                return;
            }

            var clipping = FirstClippingAttachment(data);
            Assert(clipping != null, "v21 sample should include a clipping attachment: " + label);
            Assert(clipping.name == "body_mask", "v21 clipping attachment should be body_mask: " + label);
            Assert(clipping.slot == "mask_slot", "v21 clipping attachment should live on mask_slot: " + label);
            Assert(clipping.endSlot == "arm_slot", "v21 clipping attachment should end on arm_slot: " + label);
            Assert(clipping.clippingVertices != null && clipping.clippingVertices.Length >= 3, "v21 clipping polygon should include vertices: " + label);

            var sourceVertices = new[]
            {
                new Vector3(-1f, -1f, 0f),
                new Vector3(1f, -1f, 0f),
                new Vector3(1f, 1f, 0f),
                new Vector3(-1f, 1f, 0f)
            };
            var sourceUv = new[]
            {
                new Vector2(0f, 0f),
                new Vector2(1f, 0f),
                new Vector2(1f, 1f),
                new Vector2(0f, 1f)
            };
            var sourceTriangles = new[] { 0, 1, 2, 0, 2, 3 };
            var clipPolygon = new[]
            {
                new Vector2(-0.5f, -0.5f),
                new Vector2(0.5f, -0.5f),
                new Vector2(0.5f, 0.5f),
                new Vector2(-0.5f, 0.5f)
            };

            Vector3[] clippedVertices;
            Vector2[] clippedUv;
            int[] clippedTriangles;
            Assert(
                Suwol2DClipper.ClipMesh(sourceVertices, sourceUv, sourceTriangles, clipPolygon, out clippedVertices, out clippedUv, out clippedTriangles),
                "Suwol2DClipper should clip a quad against a smaller convex polygon.");
            Assert(clippedVertices.Length > 0, "Suwol2DClipper should output vertices.");
            Assert(clippedUv.Length == clippedVertices.Length, "Suwol2DClipper should preserve UV count.");
            Assert(clippedTriangles.Length > 0 && clippedTriangles.Length % 3 == 0, "Suwol2DClipper should output triangles.");
            for (var i = 0; i < clippedVertices.Length; i++)
            {
                Assert(clippedVertices[i].x >= -0.501f && clippedVertices[i].x <= 0.501f, "clipped vertex x should stay inside mask.");
                Assert(clippedVertices[i].y >= -0.501f && clippedVertices[i].y <= 0.501f, "clipped vertex y should stay inside mask.");
            }

            character.Play("walk");
            StepCharacter(character, 0.1f);
            Assert(character.GetCurrentAnimationName() == "walk", "v21 sample walk animation should play: " + label);
            AssertNoNaNTransforms(character.gameObject);
        }

        private static void ValidateTransformConstraintApi(Suwol2DCharacter character, Suwol2DAssetData data, string label)
        {
            if (!label.Replace('\\', '/').Contains("/TransformConstraintV22/"))
            {
                return;
            }

            Assert(data.transformConstraints != null && data.transformConstraints.Length == 1, "v22 sample should include one transform constraint: " + label);
            var constraint = data.transformConstraints[0];
            Assert(constraint.name == "weapon_follow_hand", "v22 transform constraint should be weapon_follow_hand: " + label);
            Assert(constraint.bone == "weapon", "v22 transform constraint should constrain weapon: " + label);
            Assert(constraint.targetBone == "hand", "v22 transform constraint should target hand: " + label);
            Assert(Mathf.Abs(constraint.translateMix - 1f) < 0.001f, "v22 translate mix should be 1: " + label);
            Assert(Mathf.Abs(constraint.rotateMix - 1f) < 0.001f, "v22 rotate mix should be 1: " + label);
            Assert(Mathf.Abs(constraint.scaleMix) < 0.001f, "v22 scale mix should be 0: " + label);

            Assert(character.HasAnimation("swing"), "v22 sample should include swing animation: " + label);
            character.Play("swing");
            StepCharacter(character, 0.5f);
            var hand = character.Skeleton != null ? character.Skeleton.FindBone("hand") : null;
            var weapon = character.Skeleton != null ? character.Skeleton.FindBone("weapon") : null;
            Assert(hand != null, "v22 sample should include hand bone: " + label);
            Assert(weapon != null, "v22 sample should include weapon bone: " + label);
            var distance = Vector2.Distance(hand.WorldTransform.Position, weapon.WorldTransform.Position);
            Assert(distance < 0.001f, "weapon should follow hand world position: " + label + " distance=" + distance);
            Assert(Mathf.Abs(Mathf.DeltaAngle(hand.WorldTransform.rotation, weapon.WorldTransform.rotation)) < 0.001f, "weapon should follow hand world rotation: " + label);
            AssertNoNaNTransforms(character.gameObject);
        }

        private static bool ContainsInterpolation(Suwol2DAnimationData animation, string interpolation)
        {
            if (animation == null)
            {
                return false;
            }

            if (animation.bones != null)
            {
                for (var timelineIndex = 0; timelineIndex < animation.bones.Length; timelineIndex++)
                {
                    var timeline = animation.bones[timelineIndex];
                    if (timeline == null)
                    {
                        continue;
                    }

                    if (ContainsInterpolation(timeline.translate, interpolation) ||
                        ContainsInterpolation(timeline.rotate, interpolation) ||
                        ContainsInterpolation(timeline.scale, interpolation))
                    {
                        return true;
                    }
                }
            }

            if (animation.deforms != null)
            {
                for (var timelineIndex = 0; timelineIndex < animation.deforms.Length; timelineIndex++)
                {
                    var keys = animation.deforms[timelineIndex] != null ? animation.deforms[timelineIndex].keys : null;
                    if (keys == null)
                    {
                        continue;
                    }

                    for (var keyIndex = 0; keyIndex < keys.Length; keyIndex++)
                    {
                        if (keys[keyIndex] != null && keys[keyIndex].interpolation == interpolation)
                        {
                            return true;
                        }
                    }
                }
            }

            if (animation.slots != null)
            {
                for (var timelineIndex = 0; timelineIndex < animation.slots.Length; timelineIndex++)
                {
                    var keys = animation.slots[timelineIndex] != null ? animation.slots[timelineIndex].color : null;
                    if (keys == null)
                    {
                        continue;
                    }

                    for (var keyIndex = 0; keyIndex < keys.Length; keyIndex++)
                    {
                        if (keys[keyIndex] != null && keys[keyIndex].interpolation == interpolation)
                        {
                            return true;
                        }
                    }
                }
            }

            return false;
        }

        private static bool ContainsInterpolation(Suwol2DTranslateKey[] keys, string interpolation)
        {
            if (keys == null)
            {
                return false;
            }

            for (var i = 0; i < keys.Length; i++)
            {
                if (keys[i] != null && keys[i].interpolation == interpolation)
                {
                    return true;
                }
            }
            return false;
        }

        private static bool ContainsInterpolation(Suwol2DRotateKey[] keys, string interpolation)
        {
            if (keys == null)
            {
                return false;
            }

            for (var i = 0; i < keys.Length; i++)
            {
                if (keys[i] != null && keys[i].interpolation == interpolation)
                {
                    return true;
                }
            }
            return false;
        }

        private static bool ContainsInterpolation(Suwol2DScaleKey[] keys, string interpolation)
        {
            if (keys == null)
            {
                return false;
            }

            for (var i = 0; i < keys.Length; i++)
            {
                if (keys[i] != null && keys[i].interpolation == interpolation)
                {
                    return true;
                }
            }
            return false;
        }

        private static void ValidateImporterAssets(string copiedRoot)
        {
            var suwol2dFiles = Directory.GetFiles(copiedRoot, "*.suwol2d", SearchOption.AllDirectories);
            Assert(suwol2dFiles.Length >= 4, "Expected importer .suwol2d sample files.");

            for (var i = 0; i < suwol2dFiles.Length; i++)
            {
                var assetPath = FullPathToAssetPath(suwol2dFiles[i]);
                AssetDatabase.ImportAsset(assetPath, ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);

                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
                Assert(prefab != null, "Importer should generate a prefab main asset: " + assetPath);
                var character = prefab.GetComponent<Suwol2DCharacter>();
                Assert(character != null, "Generated prefab should include Suwol2DCharacter: " + assetPath);

                var report = FindSubAsset<Suwol2DImportedAsset>(assetPath);
                Assert(report != null, "Importer should add an import report subasset: " + assetPath);
                Assert(!report.Report.HasErrors, "Importer report should not contain errors: " + assetPath);
                Assert(report.Report.MissingTextureNames.Length == 0, "Importer should resolve all sample textures: " + assetPath);
                AssertSingleSubAssets(assetPath);
            }
        }

        private static void ValidateImporterReimportRecovery(string copiedRoot)
        {
            var runtimeFolder = Path.Combine(copiedRoot, "RuntimeMvp");
            var sourceJson = Path.Combine(runtimeFolder, "sample_character.suwol2d.json");
            var smokeAsset = Path.Combine(runtimeFolder, "smoke_reimport.suwol2d");
            var smokeAssetPath = FullPathToAssetPath(smokeAsset);

            File.WriteAllText(smokeAsset, "{ broken json");
            AssetDatabase.ImportAsset(smokeAssetPath, ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
            Assert(AssetDatabase.LoadAssetAtPath<GameObject>(smokeAssetPath) == null, "Malformed importer asset should not generate a prefab.");
            var malformedReport = FindSubAsset<Suwol2DImportedAsset>(smokeAssetPath);
            Assert(malformedReport != null && malformedReport.Report.HasErrors, "Malformed importer asset should report errors.");

            File.WriteAllText(smokeAsset, File.ReadAllText(sourceJson));
            AssetDatabase.ImportAsset(smokeAssetPath, ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
            Assert(AssetDatabase.LoadAssetAtPath<GameObject>(smokeAssetPath) != null, "Reimported valid asset should recover and generate a prefab.");
            var recoveredReport = FindSubAsset<Suwol2DImportedAsset>(smokeAssetPath);
            Assert(recoveredReport != null && !recoveredReport.Report.HasErrors, "Reimported valid asset should clear importer errors.");
            AssertSingleSubAssets(smokeAssetPath);
        }

        private static void ValidateMalformedRuntimeJson()
        {
            var characterObject = new GameObject("Suwol2D Malformed Smoke");
            try
            {
                var character = characterObject.AddComponent<Suwol2DCharacter>();
                character.LoadFromJson("{ broken json");
                Assert(character.Skeleton == null, "Malformed JSON should not leave a runtime skeleton.");

                character.LoadFromData(new Suwol2DAssetData());
                Assert(character.Skeleton == null, "Malformed data should not leave a runtime skeleton.");
            }
            finally
            {
                Object.DestroyImmediate(characterObject);
            }
        }

        private static void ValidateEventDispatcher(List<string> jsonFiles)
        {
            string v8Path = null;
            for (var i = 0; i < jsonFiles.Count; i++)
            {
                if (jsonFiles[i].Replace('\\', '/').Contains("/AnimationTimelinesV8/"))
                {
                    v8Path = jsonFiles[i];
                    break;
                }
            }

            Assert(!string.IsNullOrEmpty(v8Path), "AnimationTimelinesV8 JSON was not found.");
            var data = JsonUtility.FromJson<Suwol2DAssetData>(File.ReadAllText(v8Path));
            var animation = FindAnimation(data, "attack");
            Assert(animation != null, "AnimationTimelinesV8 should include attack animation.");

            var received = 0;
            var dispatcher = new Suwol2DEventTimelineDispatcher();
            dispatcher.Reset(animation.name);
            dispatcher.Dispatch(
                animation,
                0f,
                0.25f,
                Suwol2DAnimationSampler.GetDuration(animation),
                delegate(Suwol2DAnimationEvent animationEvent)
                {
                    if (animationEvent.EventName == "attack")
                    {
                        received++;
                    }
                });
            Assert(received == 1, "v8 event dispatcher should emit the attack event once.");
        }

        private static void AssertValidData(Suwol2DAssetData data, string label)
        {
            Assert(data != null, "JSON parsed data should not be null: " + label);
            Assert(data.version == 0, "Sample version should be 0: " + label);
            Assert(data.bones != null && data.bones.Length > 0, "Sample should include bones: " + label);
            Assert(data.slots != null && data.slots.Length > 0, "Sample should include slots: " + label);
            Assert(data.skins != null && data.skins.Length > 0, "Sample should include skins: " + label);
            Assert(data.animations != null && data.animations.Length > 0, "Sample should include animations: " + label);
        }

        private static void AssertTextureFilesExist(string jsonFile, Suwol2DAssetData data)
        {
            var sampleFolder = Path.GetDirectoryName(jsonFile);
            var textureFolder = Path.Combine(sampleFolder, "Textures");
            Assert(Directory.Exists(textureFolder), "Sample texture folder is missing: " + textureFolder);

            var images = new HashSet<string>();
            CollectImages(data.attachments, images);
            if (data.skins != null)
            {
                for (var i = 0; i < data.skins.Length; i++)
                {
                    CollectImages(data.skins[i] != null ? data.skins[i].attachments : null, images);
                }
            }

            foreach (var image in images)
            {
                Assert(FindTextureFile(textureFolder, image), "Sample texture file is missing for image: " + image);
            }
        }

        private static void CollectImages(Suwol2DAttachmentData[] attachments, HashSet<string> images)
        {
            if (attachments == null)
            {
                return;
            }

            for (var i = 0; i < attachments.Length; i++)
            {
                var attachment = attachments[i];
                if (attachment != null && !string.IsNullOrEmpty(attachment.image))
                {
                    images.Add(attachment.image);
                }
            }
        }

        private static bool FindTextureFile(string textureFolder, string imageName)
        {
            var normalized = NormalizeTextureName(imageName);
            var files = Directory.GetFiles(textureFolder);
            for (var i = 0; i < files.Length; i++)
            {
                if (NormalizeTextureName(Path.GetFileName(files[i])) == normalized)
                {
                    return true;
                }
            }

            return false;
        }

        private static Texture2D[] LoadTexturesForSample(string jsonFile)
        {
            var textureFolder = Path.Combine(Path.GetDirectoryName(jsonFile), "Textures");
            if (!Directory.Exists(textureFolder))
            {
                return new Texture2D[0];
            }

            var textureAssetPath = FullPathToAssetPath(textureFolder);
            var guids = AssetDatabase.FindAssets("t:Texture2D", new[] { textureAssetPath });
            var textures = new List<Texture2D>();
            for (var i = 0; i < guids.Length; i++)
            {
                var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(AssetDatabase.GUIDToAssetPath(guids[i]));
                if (texture != null)
                {
                    textures.Add(texture);
                }
            }

            return textures.ToArray();
        }

        private static Material CreateSmokeMaterial()
        {
            var shader = Shader.Find("Sprites/Default");
            if (shader == null)
            {
                shader = Shader.Find("Unlit/Transparent");
            }

            return shader != null ? new Material(shader) : null;
        }

        private static void StepCharacter(Suwol2DCharacter character, float deltaTime)
        {
            var player = GetPrivateField<Suwol2DAnimationPlayer>(character, "animationPlayer");
            if (player != null && player.Tick(deltaTime))
            {
                InvokePrivate(character, "ApplySampledRuntimeState", true);
                InvokePrivate(character, "UpdateRenderers");
                var stateMachine = GetPrivateField<Suwol2DStateMachineController>(character, "stateMachineController");
                if (stateMachine != null)
                {
                    stateMachine.Tick();
                }
            }
        }

        private static int GetRendererViewCount(Suwol2DCharacter character)
        {
            var regionRenderer = GetPrivateField<Suwol2DRegionRenderer>(character, "regionRenderer");
            var meshRenderer = GetPrivateField<Suwol2DMeshAttachmentRenderer>(character, "meshAttachmentRenderer");
            var regionCount = regionRenderer != null ? regionRenderer.ViewCount : 0;
            var meshCount = meshRenderer != null ? meshRenderer.ViewCount : 0;
            return regionCount + meshCount;
        }

        private static void AssertNoNaNTransforms(GameObject root)
        {
            var transforms = root.GetComponentsInChildren<Transform>(true);
            for (var i = 0; i < transforms.Length; i++)
            {
                var transform = transforms[i];
                Assert(IsFinite(transform.localPosition), "Transform localPosition contains NaN or Infinity: " + transform.name);
                Assert(IsFinite(transform.localScale), "Transform localScale contains NaN or Infinity: " + transform.name);
                var rotation = transform.localRotation;
                Assert(
                    IsFinite(rotation.x) && IsFinite(rotation.y) && IsFinite(rotation.z) && IsFinite(rotation.w),
                    "Transform localRotation contains NaN or Infinity: " + transform.name);
            }
        }

        private static bool IsFinite(Vector3 value)
        {
            return IsFinite(value.x) && IsFinite(value.y) && IsFinite(value.z);
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }

        private static Suwol2DAttachmentData FirstAttachment(Suwol2DAssetData data)
        {
            if (data.attachments != null && data.attachments.Length > 0)
            {
                return data.attachments[0];
            }

            if (data.skins == null)
            {
                return null;
            }

            for (var i = 0; i < data.skins.Length; i++)
            {
                var skin = data.skins[i];
                if (skin != null && skin.attachments != null && skin.attachments.Length > 0)
                {
                    return skin.attachments[0];
                }
            }

            return null;
        }

        private static Suwol2DAttachmentData FirstClippingAttachment(Suwol2DAssetData data)
        {
            if (data == null)
            {
                return null;
            }

            var attachment = FirstClippingAttachment(data.attachments);
            if (attachment != null)
            {
                return attachment;
            }

            if (data.skins == null)
            {
                return null;
            }

            for (var i = 0; i < data.skins.Length; i++)
            {
                attachment = FirstClippingAttachment(data.skins[i] != null ? data.skins[i].attachments : null);
                if (attachment != null)
                {
                    return attachment;
                }
            }

            return null;
        }

        private static Suwol2DAttachmentData FirstClippingAttachment(Suwol2DAttachmentData[] attachments)
        {
            if (attachments == null)
            {
                return null;
            }

            for (var i = 0; i < attachments.Length; i++)
            {
                var attachment = attachments[i];
                if (attachment != null && attachment.type == Suwol2DAttachment.ClippingType)
                {
                    return attachment;
                }
            }

            return null;
        }

        private static string FirstAnimationName(Suwol2DAssetData data)
        {
            if (data.animations == null || data.animations.Length == 0 || data.animations[0] == null)
            {
                throw new InvalidOperationException("Sample has no animation.");
            }

            return data.animations[0].name;
        }

        private static Suwol2DAnimationData FindAnimation(Suwol2DAssetData data, string animationName)
        {
            if (data.animations == null)
            {
                return null;
            }

            for (var i = 0; i < data.animations.Length; i++)
            {
                var animation = data.animations[i];
                if (animation != null && animation.name == animationName)
                {
                    return animation;
                }
            }

            return null;
        }

        private static T FindSubAsset<T>(string assetPath) where T : Object
        {
            var subAssets = AssetDatabase.LoadAllAssetsAtPath(assetPath);
            for (var i = 0; i < subAssets.Length; i++)
            {
                var typed = subAssets[i] as T;
                if (typed != null)
                {
                    return typed;
                }
            }

            return null;
        }

        private static void AssertSingleSubAssets(string assetPath)
        {
            var subAssets = AssetDatabase.LoadAllAssetsAtPath(assetPath);
            var reports = 0;
            var jsonAssets = 0;
            var prefabs = 0;
            for (var i = 0; i < subAssets.Length; i++)
            {
                if (subAssets[i] is Suwol2DImportedAsset)
                {
                    reports++;
                }
                else if (subAssets[i] is TextAsset)
                {
                    jsonAssets++;
                }
                else if (subAssets[i] is GameObject)
                {
                    prefabs++;
                }
            }

            Assert(reports == 1, "Importer should have exactly one report subasset: " + assetPath);
            Assert(jsonAssets == 1, "Importer should have exactly one JSON subasset: " + assetPath);
            Assert(prefabs == 1, "Importer should have exactly one prefab subasset: " + assetPath);
        }

        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
            Assert(field != null, "Private field was not found: " + fieldName);
            field.SetValue(target, value);
        }

        private static T GetPrivateField<T>(object target, string fieldName) where T : class
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
            Assert(field != null, "Private field was not found: " + fieldName);
            return field.GetValue(target) as T;
        }

        private static void InvokePrivate(object target, string methodName, params object[] arguments)
        {
            var method = target.GetType().GetMethod(methodName, BindingFlags.Instance | BindingFlags.NonPublic);
            Assert(method != null, "Private method was not found: " + methodName);
            method.Invoke(target, arguments);
        }

        private static string AssetPathToFullPath(string assetPath)
        {
            var projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
            return Path.Combine(projectRoot, assetPath.Replace('/', Path.DirectorySeparatorChar));
        }

        private static string FullPathToAssetPath(string fullPath)
        {
            var projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, "..")).Replace('\\', '/');
            var normalized = Path.GetFullPath(fullPath).Replace('\\', '/');
            Assert(normalized.StartsWith(projectRoot + "/", StringComparison.Ordinal), "Path is outside the Unity project: " + fullPath);
            return normalized.Substring(projectRoot.Length + 1);
        }

        private static string NormalizeTextureName(string value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return string.Empty;
            }

            var normalized = value.Replace('\\', '/');
            var slash = normalized.LastIndexOf('/');
            if (slash >= 0 && slash < normalized.Length - 1)
            {
                normalized = normalized.Substring(slash + 1);
            }

            var dot = normalized.LastIndexOf('.');
            if (dot > 0)
            {
                normalized = normalized.Substring(0, dot);
            }

            return normalized.ToLowerInvariant();
        }

        private static string NormalizeJson(string json)
        {
            var data = JsonUtility.FromJson<Suwol2DAssetData>(json);
            return JsonUtility.ToJson(data);
        }

        private static void CleanupCopiedSamples()
        {
            if (AssetDatabase.IsValidFolder(SmokeAssetRoot))
            {
                FileUtil.DeleteFileOrDirectory(SmokeAssetRoot);
                FileUtil.DeleteFileOrDirectory(SmokeAssetRoot + ".meta");
            }
        }

        private static void Assert(bool condition, string message)
        {
            if (!condition)
            {
                throw new InvalidOperationException(message);
            }
        }
    }
}
