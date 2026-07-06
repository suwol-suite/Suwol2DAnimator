using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.AssetImporters;
using UnityEngine;

namespace Suwol.Suwol2D.Editor
{
    [ScriptedImporter(1, "suwol2d")]
    public sealed class Suwol2DAssetImporter : ScriptedImporter
    {
        [SerializeField] private bool generatePrefab = true;

        public override void OnImportAsset(AssetImportContext ctx)
        {
            var report = new Suwol2DImportReport();
            var warnings = new List<string>();
            var errors = new List<string>();
            var sourceName = Path.GetFileNameWithoutExtension(ctx.assetPath);
            var json = string.Empty;
            Suwol2DAssetData data = null;

            try
            {
                json = File.ReadAllText(ctx.assetPath);
                data = JsonUtility.FromJson<Suwol2DAssetData>(json);
            }
            catch (System.Exception exception)
            {
                errors.Add("JSON parse failed: " + exception.Message);
            }

            if (data == null)
            {
                errors.Add("JSON parse failed: parsed data was null.");
                data = new Suwol2DAssetData();
            }

            PopulateSummary(report, sourceName, data);
            ValidateData(data, warnings, errors);

            var textures = FindTextures(ctx, data, warnings, report);
            report.SetMessages(warnings.ToArray(), errors.ToArray());

            var importedAsset = ScriptableObject.CreateInstance<Suwol2DImportedAsset>();
            importedAsset.name = sourceName + "_ImportReport";

            var jsonAsset = new TextAsset(json);
            jsonAsset.name = sourceName + "_Json";

            var material = CreateDefaultMaterial(warnings);
            if (material != null)
            {
                material.name = sourceName + "_DefaultMaterial";
            }

            GameObject prefab = null;
            if (generatePrefab && errors.Count == 0)
            {
                prefab = Suwol2DPrefabBuilder.Build(data, jsonAsset, textures, material);
                prefab.name = string.IsNullOrEmpty(data.name) ? sourceName : data.name;
                report.SetGeneratedPrefab(prefab);
            }

            importedAsset.SetReport(report);

            ctx.AddObjectToAsset("Import Report", importedAsset);
            ctx.AddObjectToAsset("Json", jsonAsset);
            if (material != null)
            {
                ctx.AddObjectToAsset("Default Material", material);
            }

            if (prefab != null)
            {
                ctx.AddObjectToAsset("Prefab", prefab);
                ctx.SetMainObject(prefab);
            }
            else
            {
                ctx.SetMainObject(importedAsset);
            }
        }

        private static void PopulateSummary(Suwol2DImportReport report, string sourceName, Suwol2DAssetData data)
        {
            report.SetSummary(
                sourceName,
                data != null ? data.version : 0,
                data != null && data.bones != null ? data.bones.Length : 0,
                data != null && data.slots != null ? data.slots.Length : 0,
                data != null && data.skins != null ? data.skins.Length : 0,
                CountAttachments(data),
                data != null && data.animations != null ? data.animations.Length : 0,
                data != null && data.ikConstraints != null ? data.ikConstraints.Length : 0,
                data != null && data.transformConstraints != null ? data.transformConstraints.Length : 0,
                CollectAnimationNames(data),
                CollectSkinNames(data),
                CollectSlotNames(data),
                CollectAttachmentNames(data));
            report.SetTimelineSummary(
                CountAttachmentTimelines(data),
                CountDrawOrderKeys(data),
                CountSlotColorKeys(data),
                CountEventKeys(data));
            report.SetStateMachineSummary(
                CountStateMachines(data),
                CountStateMachineStates(data),
                CountStateMachineTransitions(data),
                CountStateMachineParameters(data));
            report.SetInterpolationSummary(CollectInterpolationSummary(data));
            report.SetClippingSummary(CountClippingAttachments(data), CountClippingVertices(data));
        }

        private static void ValidateData(Suwol2DAssetData data, List<string> warnings, List<string> errors)
        {
            if (data == null)
            {
                errors.Add("Data is null.");
                return;
            }

            if (data.version != 0)
            {
                errors.Add("Unsupported Suwol2D version: " + data.version);
            }

            var boneNames = new HashSet<string>();
            if (data.bones == null || data.bones.Length == 0)
            {
                errors.Add("Document has no bones.");
            }
            else
            {
                for (var i = 0; i < data.bones.Length; i++)
                {
                    var bone = data.bones[i];
                    if (bone == null || string.IsNullOrEmpty(bone.name))
                    {
                        errors.Add("Bone has an empty name.");
                        continue;
                    }

                    if (!boneNames.Add(bone.name))
                    {
                        errors.Add("Duplicate bone name: " + bone.name);
                    }

                    if (!IsFinite(bone.x) || !IsFinite(bone.y) || !IsFinite(bone.rotation) ||
                        !IsFinite(bone.scaleX) || !IsFinite(bone.scaleY) || !IsFinite(bone.length))
                    {
                        errors.Add("Bone '" + bone.name + "' contains a non-finite transform value.");
                    }
                }

                for (var i = 0; i < data.bones.Length; i++)
                {
                    var bone = data.bones[i];
                    if (bone == null || string.IsNullOrEmpty(bone.parent))
                    {
                        continue;
                    }

                    if (!boneNames.Contains(bone.parent))
                    {
                        errors.Add("Bone '" + bone.name + "' references missing parent '" + bone.parent + "'.");
                    }
                }
            }

            var slotNames = new HashSet<string>();
            var slotDrawOrders = new Dictionary<string, int>();
            if (data.slots != null)
            {
                for (var i = 0; i < data.slots.Length; i++)
                {
                    var slot = data.slots[i];
                    if (slot == null || string.IsNullOrEmpty(slot.name))
                    {
                        errors.Add("Slot has an empty name.");
                        continue;
                    }

                    if (!slotNames.Add(slot.name))
                    {
                        errors.Add("Duplicate slot name: " + slot.name);
                    }

                    if (!boneNames.Contains(slot.bone))
                    {
                        errors.Add("Slot '" + slot.name + "' references missing bone '" + slot.bone + "'.");
                    }

                    slotDrawOrders[slot.name] = slot.drawOrder;
                }
            }

            if (data.skins == null || data.skins.Length == 0)
            {
                errors.Add("Document has no skins.");
            }
            else
            {
                var hasDefaultSkin = false;
                var skinNames = new HashSet<string>();
                for (var i = 0; i < data.skins.Length; i++)
                {
                    var skin = data.skins[i];
                    if (skin == null || string.IsNullOrEmpty(skin.name))
                    {
                        errors.Add("Skin has an empty name.");
                        continue;
                    }

                    if (!skinNames.Add(skin.name))
                    {
                        errors.Add("Duplicate skin name: " + skin.name);
                    }

                    if (skin.name == "default")
                    {
                        hasDefaultSkin = true;
                    }
                }

                if (!hasDefaultSkin)
                {
                    errors.Add("Document is missing the required default skin.");
                }
            }

            var attachments = CollectAttachments(data);
            var attachmentsByName = new Dictionary<string, List<Suwol2DAttachmentData>>();
            for (var i = 0; i < attachments.Count; i++)
            {
                var attachment = attachments[i];
                if (attachment == null || string.IsNullOrEmpty(attachment.name))
                {
                    errors.Add("Attachment has an empty name.");
                    continue;
                }

                if (!attachmentsByName.TryGetValue(attachment.name, out var namedAttachments))
                {
                    namedAttachments = new List<Suwol2DAttachmentData>();
                    attachmentsByName.Add(attachment.name, namedAttachments);
                }
                namedAttachments.Add(attachment);

                if (!slotNames.Contains(attachment.slot))
                {
                    errors.Add("Attachment '" + attachment.name + "' references missing slot '" + attachment.slot + "'.");
                }

                var type = string.IsNullOrEmpty(attachment.type) ? Suwol2DAttachment.RegionType : attachment.type;
                if (type != Suwol2DAttachment.RegionType && type != Suwol2DAttachment.MeshType && type != Suwol2DAttachment.ClippingType)
                {
                    errors.Add("Attachment '" + attachment.name + "' has unsupported type '" + attachment.type + "'.");
                    continue;
                }

                if (type == Suwol2DAttachment.MeshType)
                {
                    ValidateMeshAttachment(attachment, boneNames, warnings, errors);
                }

                if (type == Suwol2DAttachment.ClippingType)
                {
                    ValidateClippingAttachment(attachment, slotNames, slotDrawOrders, warnings, errors);
                }

                if (!IsFinite(attachment.x) || !IsFinite(attachment.y) || !IsFinite(attachment.rotation) ||
                    !IsFinite(attachment.width) || !IsFinite(attachment.height) ||
                    !IsFinite(attachment.scaleX) || !IsFinite(attachment.scaleY))
                {
                    errors.Add("Attachment '" + attachment.name + "' contains a non-finite transform value.");
                }
            }

            ValidateBoneAnimationTimelines(data, boneNames, errors);
            ValidateDeforms(data, attachmentsByName, slotNames, errors);
            ValidateV8Timelines(data, attachmentsByName, slotNames, warnings, errors);
            ValidateTransformConstraints(data, boneNames, warnings, errors);
            ValidateIk(data, boneNames, errors);
            ValidateStateMachines(data, CollectAnimationNameSet(data), warnings, errors);
            ValidateAtlases(data, warnings, errors);
        }

        private static void ValidateAtlases(Suwol2DAssetData data, List<string> warnings, List<string> errors)
        {
            if (data == null || data.atlases == null)
            {
                return;
            }

            var atlasNames = new HashSet<string>();
            for (var atlasIndex = 0; atlasIndex < data.atlases.Length; atlasIndex++)
            {
                var atlas = data.atlases[atlasIndex];
                if (atlas == null)
                {
                    continue;
                }

                var atlasName = string.IsNullOrEmpty(atlas.name) ? "(unnamed)" : atlas.name;
                if (string.IsNullOrEmpty(atlas.name))
                {
                    errors.Add("Atlas has an empty name.");
                }
                else if (!atlasNames.Add(atlas.name))
                {
                    errors.Add("Duplicate atlas name: " + atlas.name);
                }

                if (string.IsNullOrEmpty(atlas.image))
                {
                    errors.Add("Atlas '" + atlasName + "' has no image.");
                }

                if (atlas.width <= 0 || atlas.height <= 0)
                {
                    errors.Add("Atlas '" + atlasName + "' has invalid dimensions.");
                }

                var regionNames = new HashSet<string>();
                var regions = atlas.regions ?? new Suwol2DAtlasRegionData[0];
                for (var regionIndex = 0; regionIndex < regions.Length; regionIndex++)
                {
                    var region = regions[regionIndex];
                    if (region == null)
                    {
                        continue;
                    }

                    var regionName = string.IsNullOrEmpty(region.name) ? "(unnamed)" : region.name;
                    if (string.IsNullOrEmpty(region.name))
                    {
                        errors.Add("Atlas '" + atlasName + "' has a region with an empty name.");
                    }
                    else if (!regionNames.Add(region.name))
                    {
                        errors.Add("Atlas '" + atlasName + "' has duplicate region '" + region.name + "'.");
                    }

                    if (region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0 ||
                        region.x + region.width > atlas.width || region.y + region.height > atlas.height)
                    {
                        errors.Add("Atlas '" + atlasName + "' region '" + regionName + "' is outside atlas bounds.");
                    }

                    if (!IsUnitRange(region.u) || !IsUnitRange(region.v) || !IsUnitRange(region.u2) || !IsUnitRange(region.v2) ||
                        region.u2 <= region.u || region.v2 <= region.v)
                    {
                        errors.Add("Atlas '" + atlasName + "' region '" + regionName + "' has invalid UV range.");
                    }
                }

                if (regions.Length == 0)
                {
                    warnings.Add("Atlas '" + atlasName + "' has no regions.");
                }
            }
        }

        private static void ValidateBoneAnimationTimelines(
            Suwol2DAssetData data,
            HashSet<string> boneNames,
            List<string> errors)
        {
            if (data.animations == null)
            {
                return;
            }

            var animationNames = new HashSet<string>();
            for (var animationIndex = 0; animationIndex < data.animations.Length; animationIndex++)
            {
                var animation = data.animations[animationIndex];
                if (animation == null)
                {
                    continue;
                }

                if (string.IsNullOrEmpty(animation.name))
                {
                    errors.Add("Animation has an empty name.");
                    continue;
                }

                if (!animationNames.Add(animation.name))
                {
                    errors.Add("Duplicate animation name: " + animation.name);
                }

                if (!IsFinite(animation.duration) || animation.duration < 0f)
                {
                    errors.Add("Animation '" + animation.name + "' has invalid duration.");
                }

                if (animation.bones == null)
                {
                    continue;
                }

                for (var timelineIndex = 0; timelineIndex < animation.bones.Length; timelineIndex++)
                {
                    var timeline = animation.bones[timelineIndex];
                    if (timeline == null)
                    {
                        continue;
                    }

                    if (!boneNames.Contains(timeline.bone))
                    {
                        errors.Add("Animation '" + animation.name + "' bone timeline references missing bone '" + timeline.bone + "'.");
                    }

                    ValidateTranslateKeys(animation.name + "/" + timeline.bone + "/translate", timeline.translate, errors);
                    ValidateRotateKeys(animation.name + "/" + timeline.bone + "/rotate", timeline.rotate, errors);
                    ValidateScaleKeys(animation.name + "/" + timeline.bone + "/scale", timeline.scale, errors);
                }
            }
        }

        private static void ValidateV8Timelines(
            Suwol2DAssetData data,
            Dictionary<string, List<Suwol2DAttachmentData>> attachmentsByName,
            HashSet<string> slotNames,
            List<string> warnings,
            List<string> errors)
        {
            if (data.animations == null)
            {
                return;
            }

            for (var animationIndex = 0; animationIndex < data.animations.Length; animationIndex++)
            {
                var animation = data.animations[animationIndex];
                if (animation == null)
                {
                    continue;
                }

                ValidateAttachmentTimelines(animation, attachmentsByName, slotNames, warnings, errors);
                ValidateDrawOrderKeys(animation, slotNames, warnings, errors);
                ValidateSlotColorTimelines(animation, slotNames, warnings, errors);
                ValidateEventKeys(animation, warnings, errors);
            }
        }

        private static void ValidateAttachmentTimelines(
            Suwol2DAnimationData animation,
            Dictionary<string, List<Suwol2DAttachmentData>> attachmentsByName,
            HashSet<string> slotNames,
            List<string> warnings,
            List<string> errors)
        {
            if (animation.attachments == null)
            {
                return;
            }

            for (var i = 0; i < animation.attachments.Length; i++)
            {
                var timeline = animation.attachments[i];
                if (timeline == null)
                {
                    continue;
                }

                if (!slotNames.Contains(timeline.slot))
                {
                    errors.Add("Animation '" + animation.name + "' attachment timeline references missing slot '" + timeline.slot + "'.");
                }

                var previousTime = -1f;
                var keys = timeline.keys ?? new Suwol2DAttachmentKeyData[0];
                for (var keyIndex = 0; keyIndex < keys.Length; keyIndex++)
                {
                    var key = keys[keyIndex];
                    if (key == null)
                    {
                        continue;
                    }

                    ValidateSortedTime(animation.name + "/" + timeline.slot + "/attachment", key.time, ref previousTime, errors);
                    if (string.IsNullOrEmpty(key.attachment))
                    {
                        continue;
                    }

                    if (!attachmentsByName.TryGetValue(key.attachment, out var candidates))
                    {
                        warnings.Add("Animation '" + animation.name + "' attachment timeline target is missing: " + key.attachment);
                        continue;
                    }

                    var foundForSlot = false;
                    for (var candidateIndex = 0; candidateIndex < candidates.Count; candidateIndex++)
                    {
                        if (candidates[candidateIndex].slot == timeline.slot)
                        {
                            foundForSlot = true;
                            break;
                        }
                    }

                    if (!foundForSlot)
                    {
                        warnings.Add("Animation '" + animation.name + "' attachment timeline target '" + key.attachment + "' is not on slot '" + timeline.slot + "'.");
                    }
                }
            }
        }

        private static void ValidateDrawOrderKeys(
            Suwol2DAnimationData animation,
            HashSet<string> slotNames,
            List<string> warnings,
            List<string> errors)
        {
            if (animation.drawOrders == null)
            {
                return;
            }

            var previousTime = -1f;
            for (var i = 0; i < animation.drawOrders.Length; i++)
            {
                var key = animation.drawOrders[i];
                if (key == null)
                {
                    continue;
                }

                ValidateSortedTime(animation.name + "/drawOrder", key.time, ref previousTime, errors);
                if (key.slots == null)
                {
                    continue;
                }

                var seenSlots = new HashSet<string>();
                for (var slotIndex = 0; slotIndex < key.slots.Length; slotIndex++)
                {
                    var entry = key.slots[slotIndex];
                    if (entry == null)
                    {
                        continue;
                    }

                    if (!slotNames.Contains(entry.slot))
                    {
                        errors.Add("Animation '" + animation.name + "' draw order key references missing slot '" + entry.slot + "'.");
                    }
                    if (!seenSlots.Add(entry.slot))
                    {
                        errors.Add("Animation '" + animation.name + "' draw order key repeats slot '" + entry.slot + "'.");
                    }
                }

                if (seenSlots.Count < slotNames.Count)
                {
                    warnings.Add("Animation '" + animation.name + "' draw order key at " + key.time + " omits one or more slots.");
                }
            }
        }

        private static void ValidateSlotColorTimelines(
            Suwol2DAnimationData animation,
            HashSet<string> slotNames,
            List<string> warnings,
            List<string> errors)
        {
            if (animation.slots == null)
            {
                return;
            }

            for (var i = 0; i < animation.slots.Length; i++)
            {
                var timeline = animation.slots[i];
                if (timeline == null)
                {
                    continue;
                }

                if (!slotNames.Contains(timeline.slot))
                {
                    errors.Add("Animation '" + animation.name + "' slot color timeline references missing slot '" + timeline.slot + "'.");
                }

                var previousTime = -1f;
                var colorKeys = timeline.color ?? new Suwol2DSlotColorKeyData[0];
                for (var keyIndex = 0; keyIndex < colorKeys.Length; keyIndex++)
                {
                    var key = colorKeys[keyIndex];
                    if (key == null)
                    {
                        continue;
                    }

                    ValidateSortedTime(animation.name + "/" + timeline.slot + "/color", key.time, ref previousTime, errors);
                    ValidateInterpolation(animation.name + "/" + timeline.slot + "/color", key.interpolation, errors);
                    if (!IsFinite(key.r) || !IsFinite(key.g) || !IsFinite(key.b) || !IsFinite(key.a))
                    {
                        errors.Add("Animation '" + animation.name + "' slot color timeline '" + timeline.slot + "' has a non-finite color.");
                    }

                    if (key.r < 0f || key.r > 1f || key.g < 0f || key.g > 1f || key.b < 0f || key.b > 1f || key.a < 0f || key.a > 1f)
                    {
                        warnings.Add("Animation '" + animation.name + "' slot color timeline '" + timeline.slot + "' has color outside 0..1.");
                    }
                }
            }
        }

        private static void ValidateEventKeys(Suwol2DAnimationData animation, List<string> warnings, List<string> errors)
        {
            if (animation.events == null)
            {
                return;
            }

            var previousTime = -1f;
            for (var i = 0; i < animation.events.Length; i++)
            {
                var eventKey = animation.events[i];
                if (eventKey == null)
                {
                        continue;
                }

                ValidateSortedTime(animation.name + "/events", eventKey.time, ref previousTime, errors);
                if (!IsFinite(eventKey.floatValue))
                {
                    errors.Add("Animation '" + animation.name + "' has an event with a non-finite float value.");
                }

                if (string.IsNullOrEmpty(eventKey.name))
                {
                    errors.Add("Animation '" + animation.name + "' has an event with an empty name.");
                }
            }

            if (animation.events.Length > 0)
            {
                warnings.Add("Animation '" + animation.name + "' imports " + animation.events.Length + " event key(s).");
            }
        }

        private static void ValidateMeshAttachment(
            Suwol2DAttachmentData attachment,
            HashSet<string> boneNames,
            List<string> warnings,
            List<string> errors)
        {
            var vertices = attachment.vertices ?? new Suwol2DMeshVertexData[0];
            var triangles = attachment.triangles ?? new int[0];
            if (vertices.Length < 3)
            {
                errors.Add("Mesh attachment '" + attachment.name + "' needs at least 3 vertices.");
            }

            if (triangles.Length == 0 || triangles.Length % 3 != 0)
            {
                errors.Add("Mesh attachment '" + attachment.name + "' triangle index count must be a non-empty multiple of 3.");
            }

            for (var i = 0; i < triangles.Length; i++)
            {
                if (triangles[i] < 0 || triangles[i] >= vertices.Length)
                {
                    errors.Add("Mesh attachment '" + attachment.name + "' has triangle index outside vertex range.");
                    break;
                }
            }

            for (var i = 0; i < vertices.Length; i++)
            {
                var vertex = vertices[i];
                if (vertex == null || !IsFinite(vertex.x) || !IsFinite(vertex.y) || !IsFinite(vertex.u) || !IsFinite(vertex.v))
                {
                    errors.Add("Mesh attachment '" + attachment.name + "' has a non-finite vertex.");
                    break;
                }
            }

            var weights = attachment.weights ?? new Suwol2DVertexWeightData[0];
            if (weights.Length > 0 && weights.Length < vertices.Length)
            {
                warnings.Add("Mesh attachment '" + attachment.name + "' has weights for only some vertices.");
            }

            for (var i = 0; i < weights.Length; i++)
            {
                var vertexWeight = weights[i];
                if (vertexWeight == null)
                {
                    continue;
                }

                if (vertexWeight.vertex < 0 || vertexWeight.vertex >= vertices.Length)
                {
                    errors.Add("Mesh attachment '" + attachment.name + "' has weight for vertex outside range.");
                }

                var bones = vertexWeight.bones ?? new Suwol2DBoneWeightData[0];
                for (var boneIndex = 0; boneIndex < bones.Length; boneIndex++)
                {
                    var boneWeight = bones[boneIndex];
                    if (boneWeight != null && !string.IsNullOrEmpty(boneWeight.bone) && !boneNames.Contains(boneWeight.bone))
                    {
                        errors.Add("Mesh attachment '" + attachment.name + "' references missing weight bone '" + boneWeight.bone + "'.");
                    }

                    if (boneWeight != null && !IsFinite(boneWeight.weight))
                    {
                        errors.Add("Mesh attachment '" + attachment.name + "' has a non-finite weight.");
                    }
                }
            }
        }

        private static void ValidateClippingAttachment(
            Suwol2DAttachmentData attachment,
            HashSet<string> slotNames,
            Dictionary<string, int> slotDrawOrders,
            List<string> warnings,
            List<string> errors)
        {
            var vertices = attachment.clippingVertices ?? new Suwol2DClippingVertexData[0];
            if (vertices.Length < 3)
            {
                errors.Add("Clipping attachment '" + attachment.name + "' needs at least 3 vertices.");
            }

            for (var i = 0; i < vertices.Length; i++)
            {
                var vertex = vertices[i];
                if (vertex == null || !IsFinite(vertex.x) || !IsFinite(vertex.y))
                {
                    errors.Add("Clipping attachment '" + attachment.name + "' has a non-finite vertex.");
                    break;
                }
            }

            if (!string.IsNullOrEmpty(attachment.endSlot) && !slotNames.Contains(attachment.endSlot))
            {
                errors.Add("Clipping attachment '" + attachment.name + "' references missing endSlot '" + attachment.endSlot + "'.");
            }
            else if (!string.IsNullOrEmpty(attachment.endSlot) && slotDrawOrders != null)
            {
                int startOrder;
                int endOrder;
                if (slotDrawOrders.TryGetValue(attachment.slot, out startOrder) &&
                    slotDrawOrders.TryGetValue(attachment.endSlot, out endOrder) &&
                    endOrder < startOrder)
                {
                    warnings.Add("Clipping attachment '" + attachment.name + "' ends before its starting slot.");
                }
            }

            if (vertices.Length >= 3)
            {
                var area = SignedArea(vertices);
                if (Mathf.Abs(area) <= 0.000001f)
                {
                    errors.Add("Clipping attachment '" + attachment.name + "' polygon has zero area.");
                }
                else if (!IsConvex(vertices))
                {
                    warnings.Add("Clipping attachment '" + attachment.name + "' is concave; v21 officially supports convex polygons only.");
                }
            }
        }

        private static void ValidateDeforms(
            Suwol2DAssetData data,
            Dictionary<string, List<Suwol2DAttachmentData>> attachmentsByName,
            HashSet<string> slotNames,
            List<string> errors)
        {
            if (data.animations == null)
            {
                return;
            }

            for (var animationIndex = 0; animationIndex < data.animations.Length; animationIndex++)
            {
                var animation = data.animations[animationIndex];
                if (animation == null || animation.deforms == null)
                {
                    continue;
                }

                for (var deformIndex = 0; deformIndex < animation.deforms.Length; deformIndex++)
                {
                    var deform = animation.deforms[deformIndex];
                    if (deform == null)
                    {
                        continue;
                    }

                    if (!slotNames.Contains(deform.slot))
                    {
                        errors.Add("Animation '" + animation.name + "' deform references missing slot '" + deform.slot + "'.");
                    }

                    if (!attachmentsByName.TryGetValue(deform.attachment, out var candidates))
                    {
                        errors.Add("Animation '" + animation.name + "' deform target '" + deform.attachment + "' is absent in every skin.");
                        continue;
                    }

                    var foundForSlot = false;
                    var foundMesh = false;
                    for (var candidateIndex = 0; candidateIndex < candidates.Count; candidateIndex++)
                    {
                        var candidate = candidates[candidateIndex];
                        if (candidate.slot != deform.slot)
                        {
                            continue;
                        }

                        foundForSlot = true;
                        if ((string.IsNullOrEmpty(candidate.type) ? Suwol2DAttachment.RegionType : candidate.type) == Suwol2DAttachment.MeshType)
                        {
                            foundMesh = true;
                            break;
                        }
                    }

                    if (!foundForSlot)
                    {
                        errors.Add("Animation '" + animation.name + "' deform target '" + deform.attachment + "' is not attached to slot '" + deform.slot + "'.");
                    }
                    else if (!foundMesh)
                    {
                        errors.Add("Animation '" + animation.name + "' deform target '" + deform.attachment + "' is not a mesh attachment.");
                    }

                    var previousTime = -1f;
                    var keys = deform.keys ?? new Suwol2DDeformKeyData[0];
                    for (var keyIndex = 0; keyIndex < keys.Length; keyIndex++)
                    {
                        var key = keys[keyIndex];
                        if (key == null)
                        {
                            continue;
                        }

                        ValidateSortedTime(animation.name + "/" + deform.attachment + "/deform", key.time, ref previousTime, errors);
                        ValidateInterpolation(animation.name + "/" + deform.attachment + "/deform", key.interpolation, errors);
                        var offsets = key.offsets ?? new Suwol2DVertexOffsetData[0];
                        for (var offsetIndex = 0; offsetIndex < offsets.Length; offsetIndex++)
                        {
                            var offset = offsets[offsetIndex];
                            if (offset != null && (!IsFinite(offset.x) || !IsFinite(offset.y)))
                            {
                                errors.Add("Animation '" + animation.name + "' deform offset contains a non-finite value.");
                            }
                        }
                    }
                }
            }
        }

        private static void ValidateIk(Suwol2DAssetData data, HashSet<string> boneNames, List<string> errors)
        {
            if (data.ikConstraints == null)
            {
                return;
            }

            for (var i = 0; i < data.ikConstraints.Length; i++)
            {
                var constraint = data.ikConstraints[i];
                if (constraint == null)
                {
                    continue;
                }

                var name = string.IsNullOrEmpty(constraint.name) ? "(unnamed)" : constraint.name;
                if (!boneNames.Contains(constraint.parentBone))
                {
                    errors.Add("IK constraint '" + name + "' references missing parent bone '" + constraint.parentBone + "'.");
                }

                if (!boneNames.Contains(constraint.childBone))
                {
                    errors.Add("IK constraint '" + name + "' references missing child bone '" + constraint.childBone + "'.");
                }

                if (!boneNames.Contains(constraint.targetBone))
                {
                    errors.Add("IK constraint '" + name + "' references missing target bone '" + constraint.targetBone + "'.");
                }

                if (!IsFinite(constraint.mix))
                {
                    errors.Add("IK constraint '" + name + "' has a non-finite mix value.");
                }
            }
        }

        private static void ValidateTransformConstraints(
            Suwol2DAssetData data,
            HashSet<string> boneNames,
            List<string> warnings,
            List<string> errors)
        {
            if (data.transformConstraints == null)
            {
                return;
            }

            var names = new HashSet<string>();
            var orders = new HashSet<int>();
            for (var i = 0; i < data.transformConstraints.Length; i++)
            {
                var constraint = data.transformConstraints[i];
                if (constraint == null)
                {
                    continue;
                }

                var name = string.IsNullOrEmpty(constraint.name) ? "(unnamed)" : constraint.name;
                if (string.IsNullOrEmpty(constraint.name))
                {
                    errors.Add("Transform constraint has an empty name.");
                }
                else if (!names.Add(constraint.name))
                {
                    errors.Add("Duplicate transform constraint name: " + constraint.name);
                }

                if (!boneNames.Contains(constraint.bone))
                {
                    errors.Add("Transform constraint '" + name + "' references missing bone '" + constraint.bone + "'.");
                }

                if (!boneNames.Contains(constraint.targetBone))
                {
                    errors.Add("Transform constraint '" + name + "' references missing target bone '" + constraint.targetBone + "'.");
                }

                if (!string.IsNullOrEmpty(constraint.bone) && constraint.bone == constraint.targetBone)
                {
                    errors.Add("Transform constraint '" + name + "' uses the same bone and targetBone.");
                }

                if (!IsFinite(constraint.translateMix) || !IsFinite(constraint.rotateMix) || !IsFinite(constraint.scaleMix))
                {
                    errors.Add("Transform constraint '" + name + "' has a non-finite mix value.");
                }
                else if (!IsUnitRange(constraint.translateMix) || !IsUnitRange(constraint.rotateMix) || !IsUnitRange(constraint.scaleMix))
                {
                    warnings.Add("Transform constraint '" + name + "' mix is outside 0..1 and will be clamped on export.");
                }

                if (!IsFinite(constraint.offsetX) || !IsFinite(constraint.offsetY) ||
                    !IsFinite(constraint.offsetRotation) || !IsFinite(constraint.offsetScaleX) ||
                    !IsFinite(constraint.offsetScaleY))
                {
                    errors.Add("Transform constraint '" + name + "' contains a non-finite offset.");
                }

                if (!orders.Add(constraint.order))
                {
                    warnings.Add("Transform constraint '" + name + "' shares order " + constraint.order + " with another transform constraint.");
                }
            }
        }

        private static void ValidateStateMachines(
            Suwol2DAssetData data,
            HashSet<string> animationNames,
            List<string> warnings,
            List<string> errors)
        {
            if (data.stateMachines == null)
            {
                return;
            }

            var machineNames = new HashSet<string>();
            for (var machineIndex = 0; machineIndex < data.stateMachines.Length; machineIndex++)
            {
                var machine = data.stateMachines[machineIndex];
                if (machine == null || string.IsNullOrEmpty(machine.name))
                {
                    errors.Add("State machine has an empty name.");
                    continue;
                }

                if (!machineNames.Add(machine.name))
                {
                    errors.Add("Duplicate state machine name: " + machine.name);
                }

                var stateNames = new HashSet<string>();
                var states = machine.states ?? new Suwol2DStateData[0];
                for (var stateIndex = 0; stateIndex < states.Length; stateIndex++)
                {
                    var state = states[stateIndex];
                    if (state == null || string.IsNullOrEmpty(state.name))
                    {
                        errors.Add("State machine '" + machine.name + "' has a state with an empty name.");
                        continue;
                    }

                    if (!stateNames.Add(state.name))
                    {
                        errors.Add("State machine '" + machine.name + "' has duplicate state '" + state.name + "'.");
                    }

                    if (!animationNames.Contains(state.animation))
                    {
                        errors.Add("State machine '" + machine.name + "' state '" + state.name + "' references missing animation '" + state.animation + "'.");
                    }

                    if (!IsFinite(state.speed))
                    {
                        errors.Add("State machine '" + machine.name + "' state '" + state.name + "' has a non-finite speed.");
                    }
                }

                if (!stateNames.Contains(machine.initialState))
                {
                    errors.Add("State machine '" + machine.name + "' initialState '" + machine.initialState + "' does not exist.");
                }

                var parameterTypes = new Dictionary<string, string>();
                var parameters = machine.parameters ?? new Suwol2DStateParameterData[0];
                for (var parameterIndex = 0; parameterIndex < parameters.Length; parameterIndex++)
                {
                    var parameter = parameters[parameterIndex];
                    if (parameter == null || string.IsNullOrEmpty(parameter.name))
                    {
                        errors.Add("State machine '" + machine.name + "' has a parameter with an empty name.");
                        continue;
                    }

                    if (parameterTypes.ContainsKey(parameter.name))
                    {
                        errors.Add("State machine '" + machine.name + "' has duplicate parameter '" + parameter.name + "'.");
                    }
                    else
                    {
                        parameterTypes.Add(parameter.name, parameter.type);
                    }

                    if (parameter.type != "bool" && parameter.type != "trigger")
                    {
                        errors.Add("State machine '" + machine.name + "' parameter '" + parameter.name + "' has unsupported type '" + parameter.type + "'.");
                    }
                }

                var transitions = machine.transitions ?? new Suwol2DStateTransitionData[0];
                for (var transitionIndex = 0; transitionIndex < transitions.Length; transitionIndex++)
                {
                    var transition = transitions[transitionIndex];
                    if (transition == null)
                    {
                        continue;
                    }

                    if (transition.from != "*" && !stateNames.Contains(transition.from))
                    {
                        errors.Add("State machine '" + machine.name + "' transition from '" + transition.from + "' does not exist.");
                    }

                    if (!stateNames.Contains(transition.to))
                    {
                        errors.Add("State machine '" + machine.name + "' transition to '" + transition.to + "' does not exist.");
                    }

                    if (!IsFinite(transition.fadeDuration) || transition.fadeDuration < 0f)
                    {
                        errors.Add("State machine '" + machine.name + "' transition '" + transition.from + "' -> '" + transition.to + "' has invalid fadeDuration.");
                    }
                    else if (transition.fadeDuration > 2f)
                    {
                        warnings.Add("State machine '" + machine.name + "' transition '" + transition.from + "' -> '" + transition.to + "' has a long fadeDuration.");
                    }

                    var conditions = transition.conditions ?? new Suwol2DTransitionConditionData[0];
                    if (conditions.Length == 0)
                    {
                        warnings.Add("State machine '" + machine.name + "' transition '" + transition.from + "' -> '" + transition.to + "' has no conditions.");
                    }

                    for (var conditionIndex = 0; conditionIndex < conditions.Length; conditionIndex++)
                    {
                        var condition = conditions[conditionIndex];
                        if (condition == null || string.IsNullOrEmpty(condition.parameter))
                        {
                            errors.Add("State machine '" + machine.name + "' transition '" + transition.from + "' -> '" + transition.to + "' has an empty condition parameter.");
                            continue;
                        }

                        string parameterType;
                        if (!parameterTypes.TryGetValue(condition.parameter, out parameterType))
                        {
                            errors.Add("State machine '" + machine.name + "' transition '" + transition.from + "' -> '" + transition.to + "' references missing parameter '" + condition.parameter + "'.");
                            continue;
                        }

                        if (condition.mode != "equals" && condition.mode != "triggered")
                        {
                            errors.Add("State machine '" + machine.name + "' condition on '" + condition.parameter + "' has unsupported mode '" + condition.mode + "'.");
                        }

                        if (parameterType == "trigger" && condition.mode == "equals")
                        {
                            errors.Add("State machine '" + machine.name + "' trigger parameter '" + condition.parameter + "' cannot use equals condition.");
                        }

                        if (parameterType == "bool" && condition.mode == "triggered")
                        {
                            errors.Add("State machine '" + machine.name + "' bool parameter '" + condition.parameter + "' cannot use triggered condition.");
                        }
                    }
                }
            }
        }

        private static void ValidateTranslateKeys(string label, Suwol2DTranslateKey[] keys, List<string> errors)
        {
            var previousTime = -1f;
            if (keys == null)
            {
                return;
            }

            for (var i = 0; i < keys.Length; i++)
            {
                var key = keys[i];
                if (key == null)
                {
                    continue;
                }

                ValidateSortedTime(label, key.time, ref previousTime, errors);
                ValidateInterpolation(label, key.interpolation, errors);
                if (!IsFinite(key.x) || !IsFinite(key.y))
                {
                    errors.Add("Timeline '" + label + "' contains a non-finite value.");
                }
            }
        }

        private static void ValidateRotateKeys(string label, Suwol2DRotateKey[] keys, List<string> errors)
        {
            var previousTime = -1f;
            if (keys == null)
            {
                return;
            }

            for (var i = 0; i < keys.Length; i++)
            {
                var key = keys[i];
                if (key == null)
                {
                    continue;
                }

                ValidateSortedTime(label, key.time, ref previousTime, errors);
                ValidateInterpolation(label, key.interpolation, errors);
                if (!IsFinite(key.rotation))
                {
                    errors.Add("Timeline '" + label + "' contains a non-finite value.");
                }
            }
        }

        private static void ValidateScaleKeys(string label, Suwol2DScaleKey[] keys, List<string> errors)
        {
            var previousTime = -1f;
            if (keys == null)
            {
                return;
            }

            for (var i = 0; i < keys.Length; i++)
            {
                var key = keys[i];
                if (key == null)
                {
                    continue;
                }

                ValidateSortedTime(label, key.time, ref previousTime, errors);
                ValidateInterpolation(label, key.interpolation, errors);
                if (!IsFinite(key.scaleX) || !IsFinite(key.scaleY))
                {
                    errors.Add("Timeline '" + label + "' contains a non-finite value.");
                }
            }
        }

        private static void ValidateSortedTime(string label, float time, ref float previousTime, List<string> errors)
        {
            if (!IsFinite(time))
            {
                errors.Add("Timeline '" + label + "' contains a non-finite key time.");
                return;
            }

            if (time < 0f)
            {
                errors.Add("Timeline '" + label + "' contains a negative key time.");
            }

            if (time < previousTime)
            {
                errors.Add("Timeline '" + label + "' key times are not sorted.");
            }

            previousTime = time;
        }

        private static void ValidateInterpolation(string label, string interpolation, List<string> errors)
        {
            if (string.IsNullOrEmpty(interpolation))
            {
                return;
            }

            if (Suwol2DInterpolation.Normalize(interpolation) != interpolation)
            {
                errors.Add("Timeline '" + label + "' has unsupported interpolation '" + interpolation + "'.");
            }
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }

        private static bool IsUnitRange(float value)
        {
            return IsFinite(value) && value >= 0f && value <= 1f;
        }

        private static float SignedArea(Suwol2DClippingVertexData[] vertices)
        {
            if (vertices == null || vertices.Length < 3)
            {
                return 0f;
            }

            var area = 0f;
            for (var i = 0; i < vertices.Length; i++)
            {
                var current = vertices[i];
                var next = vertices[(i + 1) % vertices.Length];
                if (current == null || next == null)
                {
                    continue;
                }

                area += (current.x * next.y) - (next.x * current.y);
            }

            return area * 0.5f;
        }

        private static bool IsConvex(Suwol2DClippingVertexData[] vertices)
        {
            if (vertices == null || vertices.Length < 4)
            {
                return true;
            }

            var sign = 0f;
            for (var i = 0; i < vertices.Length; i++)
            {
                var previous = vertices[i];
                var current = vertices[(i + 1) % vertices.Length];
                var next = vertices[(i + 2) % vertices.Length];
                if (previous == null || current == null || next == null)
                {
                    return false;
                }

                var cross = ((current.x - previous.x) * (next.y - current.y)) -
                    ((current.y - previous.y) * (next.x - current.x));
                if (Mathf.Abs(cross) <= 0.000001f)
                {
                    continue;
                }

                if (Mathf.Approximately(sign, 0f))
                {
                    sign = Mathf.Sign(cross);
                    continue;
                }

                if (Mathf.Sign(cross) != sign)
                {
                    return false;
                }
            }

            return true;
        }

        private static Texture2D[] FindTextures(AssetImportContext ctx, Suwol2DAssetData data, List<string> warnings, Suwol2DImportReport report)
        {
            var foundTextures = new List<Texture2D>();
            var foundNames = new List<string>();
            var missingNames = new List<string>();
            var imageNames = CollectImageNames(data);
            AddUniqueImageNames(imageNames, CollectAtlasImageNames(data));

            for (var i = 0; i < imageNames.Count; i++)
            {
                var imageName = imageNames[i];
                var texture = FindTextureNearAsset(ctx.assetPath, imageName, out var texturePath);
                if (texture == null)
                {
                    missingNames.Add(imageName);
                    warnings.Add("Texture not found for attachment image '" + imageName + "'.");
                    continue;
                }

                foundTextures.Add(texture);
                foundNames.Add(texture.name);
                ctx.DependsOnSourceAsset(texturePath);
            }

            report.SetTextures(foundNames.ToArray(), missingNames.ToArray());
            return foundTextures.ToArray();
        }

        private static Texture2D FindTextureNearAsset(string assetPath, string imageName, out string texturePath)
        {
            texturePath = string.Empty;
            if (string.IsNullOrEmpty(imageName))
            {
                return null;
            }

            var baseDirectory = NormalizeAssetPath(Path.GetDirectoryName(assetPath));
            var parentDirectory = NormalizeAssetPath(Path.GetDirectoryName(baseDirectory));
            var searchDirectories = new[]
            {
                baseDirectory,
                CombineAssetPath(baseDirectory, "Textures"),
                CombineAssetPath(baseDirectory, "textures"),
                CombineAssetPath(baseDirectory, "Atlas"),
                CombineAssetPath(baseDirectory, "atlas"),
                CombineAssetPath(parentDirectory, "Textures"),
                CombineAssetPath(parentDirectory, "textures"),
                CombineAssetPath(parentDirectory, "Atlas"),
                CombineAssetPath(parentDirectory, "atlas")
            };

            var fileNames = BuildTextureFileNameCandidates(imageName);
            for (var dirIndex = 0; dirIndex < searchDirectories.Length; dirIndex++)
            {
                var directory = searchDirectories[dirIndex];
                if (string.IsNullOrEmpty(directory))
                {
                    continue;
                }

                for (var fileIndex = 0; fileIndex < fileNames.Count; fileIndex++)
                {
                    var candidatePath = CombineAssetPath(directory, fileNames[fileIndex]);
                    var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(candidatePath);
                    if (texture != null && MatchesTextureName(texture, imageName))
                    {
                        texturePath = candidatePath;
                        return texture;
                    }
                }
            }

            return null;
        }

        private static Material CreateDefaultMaterial(List<string> warnings)
        {
            var shader = Shader.Find("Sprites/Default");
            if (shader == null)
            {
                shader = Shader.Find("Unlit/Transparent");
            }
            if (shader == null)
            {
                shader = Shader.Find("Unlit/Texture");
            }
            if (shader == null)
            {
                shader = Shader.Find("Universal Render Pipeline/Unlit");
            }

            if (shader == null)
            {
                warnings.Add("Could not find a default shader. Generated prefab will not have a default material.");
                return null;
            }

            return new Material(shader);
        }

        private static List<Suwol2DAttachmentData> CollectAttachments(Suwol2DAssetData data)
        {
            var attachments = new List<Suwol2DAttachmentData>();
            if (data == null)
            {
                return attachments;
            }

            if (data.attachments != null)
            {
                attachments.AddRange(data.attachments);
            }

            if (data.skins != null)
            {
                for (var i = 0; i < data.skins.Length; i++)
                {
                    var skin = data.skins[i];
                    if (skin != null && skin.attachments != null)
                    {
                        attachments.AddRange(skin.attachments);
                    }
                }
            }

            return attachments;
        }

        private static List<string> CollectImageNames(Suwol2DAssetData data)
        {
            var names = new List<string>();
            var normalizedNames = new HashSet<string>();
            var attachments = CollectAttachments(data);
            for (var i = 0; i < attachments.Count; i++)
            {
                var attachment = attachments[i];
                if (attachment == null || string.IsNullOrEmpty(attachment.image))
                {
                    continue;
                }

                var normalized = NormalizeTextureName(attachment.image);
                if (normalizedNames.Add(normalized))
                {
                    names.Add(attachment.image);
                }
            }

            return names;
        }

        private static List<string> CollectAtlasImageNames(Suwol2DAssetData data)
        {
            var names = new List<string>();
            var normalizedNames = new HashSet<string>();
            if (data == null || data.atlases == null)
            {
                return names;
            }

            for (var i = 0; i < data.atlases.Length; i++)
            {
                var atlas = data.atlases[i];
                if (atlas == null || string.IsNullOrEmpty(atlas.image))
                {
                    continue;
                }

                var normalized = NormalizeTextureName(atlas.image);
                if (normalizedNames.Add(normalized))
                {
                    names.Add(atlas.image);
                }
            }

            return names;
        }

        private static void AddUniqueImageNames(List<string> target, List<string> additions)
        {
            if (target == null || additions == null)
            {
                return;
            }

            var normalizedNames = new HashSet<string>();
            for (var i = 0; i < target.Count; i++)
            {
                normalizedNames.Add(NormalizeTextureName(target[i]));
            }

            for (var i = 0; i < additions.Count; i++)
            {
                if (normalizedNames.Add(NormalizeTextureName(additions[i])))
                {
                    target.Add(additions[i]);
                }
            }
        }

        private static int CountAttachments(Suwol2DAssetData data)
        {
            return CollectAttachments(data).Count;
        }

        private static int CountClippingAttachments(Suwol2DAssetData data)
        {
            var count = 0;
            var attachments = CollectAttachments(data);
            for (var i = 0; i < attachments.Count; i++)
            {
                if (attachments[i] != null && attachments[i].type == Suwol2DAttachment.ClippingType)
                {
                    count++;
                }
            }

            return count;
        }

        private static int CountClippingVertices(Suwol2DAssetData data)
        {
            var count = 0;
            var attachments = CollectAttachments(data);
            for (var i = 0; i < attachments.Count; i++)
            {
                var attachment = attachments[i];
                if (attachment != null && attachment.type == Suwol2DAttachment.ClippingType && attachment.clippingVertices != null)
                {
                    count += attachment.clippingVertices.Length;
                }
            }

            return count;
        }

        private static int CountAttachmentTimelines(Suwol2DAssetData data)
        {
            var count = 0;
            if (data == null || data.animations == null)
            {
                return count;
            }

            for (var i = 0; i < data.animations.Length; i++)
            {
                count += data.animations[i] != null && data.animations[i].attachments != null ? data.animations[i].attachments.Length : 0;
            }
            return count;
        }

        private static int CountDrawOrderKeys(Suwol2DAssetData data)
        {
            var count = 0;
            if (data == null || data.animations == null)
            {
                return count;
            }

            for (var i = 0; i < data.animations.Length; i++)
            {
                count += data.animations[i] != null && data.animations[i].drawOrders != null ? data.animations[i].drawOrders.Length : 0;
            }
            return count;
        }

        private static int CountSlotColorKeys(Suwol2DAssetData data)
        {
            var count = 0;
            if (data == null || data.animations == null)
            {
                return count;
            }

            for (var i = 0; i < data.animations.Length; i++)
            {
                var animation = data.animations[i];
                if (animation == null || animation.slots == null)
                {
                    continue;
                }

                for (var slotIndex = 0; slotIndex < animation.slots.Length; slotIndex++)
                {
                    count += animation.slots[slotIndex] != null && animation.slots[slotIndex].color != null
                        ? animation.slots[slotIndex].color.Length
                        : 0;
                }
            }
            return count;
        }

        private static int CountEventKeys(Suwol2DAssetData data)
        {
            var count = 0;
            if (data == null || data.animations == null)
            {
                return count;
            }

            for (var i = 0; i < data.animations.Length; i++)
            {
                count += data.animations[i] != null && data.animations[i].events != null ? data.animations[i].events.Length : 0;
            }
            return count;
        }

        private static int CountStateMachines(Suwol2DAssetData data)
        {
            return data != null && data.stateMachines != null ? data.stateMachines.Length : 0;
        }

        private static int CountStateMachineStates(Suwol2DAssetData data)
        {
            var count = 0;
            if (data == null || data.stateMachines == null)
            {
                return count;
            }

            for (var i = 0; i < data.stateMachines.Length; i++)
            {
                count += data.stateMachines[i] != null && data.stateMachines[i].states != null ? data.stateMachines[i].states.Length : 0;
            }
            return count;
        }

        private static int CountStateMachineTransitions(Suwol2DAssetData data)
        {
            var count = 0;
            if (data == null || data.stateMachines == null)
            {
                return count;
            }

            for (var i = 0; i < data.stateMachines.Length; i++)
            {
                count += data.stateMachines[i] != null && data.stateMachines[i].transitions != null ? data.stateMachines[i].transitions.Length : 0;
            }
            return count;
        }

        private static int CountStateMachineParameters(Suwol2DAssetData data)
        {
            var count = 0;
            if (data == null || data.stateMachines == null)
            {
                return count;
            }

            for (var i = 0; i < data.stateMachines.Length; i++)
            {
                count += data.stateMachines[i] != null && data.stateMachines[i].parameters != null ? data.stateMachines[i].parameters.Length : 0;
            }
            return count;
        }

        private static string CollectInterpolationSummary(Suwol2DAssetData data)
        {
            var counts = new Dictionary<string, int>
            {
                { Suwol2DInterpolation.Stepped, 0 },
                { Suwol2DInterpolation.Linear, 0 },
                { Suwol2DInterpolation.EaseIn, 0 },
                { Suwol2DInterpolation.EaseOut, 0 },
                { Suwol2DInterpolation.EaseInOut, 0 }
            };

            if (data != null && data.animations != null)
            {
                for (var animationIndex = 0; animationIndex < data.animations.Length; animationIndex++)
                {
                    var animation = data.animations[animationIndex];
                    if (animation == null)
                    {
                        continue;
                    }

                    CountBoneInterpolationKeys(animation.bones, counts);
                    CountDeformInterpolationKeys(animation.deforms, counts);
                    CountSlotColorInterpolationKeys(animation.slots, counts);
                }
            }

            return "stepped " + counts[Suwol2DInterpolation.Stepped] +
                ", linear " + counts[Suwol2DInterpolation.Linear] +
                ", easeIn " + counts[Suwol2DInterpolation.EaseIn] +
                ", easeOut " + counts[Suwol2DInterpolation.EaseOut] +
                ", easeInOut " + counts[Suwol2DInterpolation.EaseInOut];
        }

        private static void CountBoneInterpolationKeys(Suwol2DBoneTimelineData[] timelines, Dictionary<string, int> counts)
        {
            if (timelines == null)
            {
                return;
            }

            for (var timelineIndex = 0; timelineIndex < timelines.Length; timelineIndex++)
            {
                var timeline = timelines[timelineIndex];
                if (timeline == null)
                {
                    continue;
                }

                CountTranslateInterpolationKeys(timeline.translate, counts);
                CountRotateInterpolationKeys(timeline.rotate, counts);
                CountScaleInterpolationKeys(timeline.scale, counts);
            }
        }

        private static void CountTranslateInterpolationKeys(Suwol2DTranslateKey[] keys, Dictionary<string, int> counts)
        {
            if (keys == null)
            {
                return;
            }

            for (var i = 0; i < keys.Length; i++)
            {
                if (keys[i] != null)
                {
                    IncrementInterpolationCount(counts, keys[i].interpolation);
                }
            }
        }

        private static void CountRotateInterpolationKeys(Suwol2DRotateKey[] keys, Dictionary<string, int> counts)
        {
            if (keys == null)
            {
                return;
            }

            for (var i = 0; i < keys.Length; i++)
            {
                if (keys[i] != null)
                {
                    IncrementInterpolationCount(counts, keys[i].interpolation);
                }
            }
        }

        private static void CountScaleInterpolationKeys(Suwol2DScaleKey[] keys, Dictionary<string, int> counts)
        {
            if (keys == null)
            {
                return;
            }

            for (var i = 0; i < keys.Length; i++)
            {
                if (keys[i] != null)
                {
                    IncrementInterpolationCount(counts, keys[i].interpolation);
                }
            }
        }

        private static void CountDeformInterpolationKeys(Suwol2DDeformTimelineData[] timelines, Dictionary<string, int> counts)
        {
            if (timelines == null)
            {
                return;
            }

            for (var timelineIndex = 0; timelineIndex < timelines.Length; timelineIndex++)
            {
                var keys = timelines[timelineIndex] != null ? timelines[timelineIndex].keys : null;
                if (keys == null)
                {
                    continue;
                }

                for (var keyIndex = 0; keyIndex < keys.Length; keyIndex++)
                {
                    if (keys[keyIndex] != null)
                    {
                        IncrementInterpolationCount(counts, keys[keyIndex].interpolation);
                    }
                }
            }
        }

        private static void CountSlotColorInterpolationKeys(Suwol2DSlotTimelineData[] timelines, Dictionary<string, int> counts)
        {
            if (timelines == null)
            {
                return;
            }

            for (var timelineIndex = 0; timelineIndex < timelines.Length; timelineIndex++)
            {
                var keys = timelines[timelineIndex] != null ? timelines[timelineIndex].color : null;
                if (keys == null)
                {
                    continue;
                }

                for (var keyIndex = 0; keyIndex < keys.Length; keyIndex++)
                {
                    if (keys[keyIndex] != null)
                    {
                        IncrementInterpolationCount(counts, keys[keyIndex].interpolation);
                    }
                }
            }
        }

        private static void IncrementInterpolationCount(Dictionary<string, int> counts, string interpolation)
        {
            var normalized = Suwol2DInterpolation.Normalize(interpolation);
            counts[normalized] = counts[normalized] + 1;
        }

        private static HashSet<string> CollectAnimationNameSet(Suwol2DAssetData data)
        {
            var names = new HashSet<string>();
            if (data == null || data.animations == null)
            {
                return names;
            }

            for (var i = 0; i < data.animations.Length; i++)
            {
                var animation = data.animations[i];
                if (animation != null && !string.IsNullOrEmpty(animation.name))
                {
                    names.Add(animation.name);
                }
            }

            return names;
        }

        private static string[] CollectAnimationNames(Suwol2DAssetData data)
        {
            if (data == null || data.animations == null)
            {
                return new string[0];
            }

            var names = new List<string>();
            for (var i = 0; i < data.animations.Length; i++)
            {
                if (data.animations[i] != null && !string.IsNullOrEmpty(data.animations[i].name))
                {
                    names.Add(data.animations[i].name);
                }
            }

            return names.ToArray();
        }

        private static string[] CollectSkinNames(Suwol2DAssetData data)
        {
            if (data == null || data.skins == null)
            {
                return new string[0];
            }

            var names = new List<string>();
            for (var i = 0; i < data.skins.Length; i++)
            {
                if (data.skins[i] != null && !string.IsNullOrEmpty(data.skins[i].name))
                {
                    names.Add(data.skins[i].name);
                }
            }

            return names.ToArray();
        }

        private static string[] CollectSlotNames(Suwol2DAssetData data)
        {
            if (data == null || data.slots == null)
            {
                return new string[0];
            }

            var names = new List<string>();
            for (var i = 0; i < data.slots.Length; i++)
            {
                if (data.slots[i] != null && !string.IsNullOrEmpty(data.slots[i].name))
                {
                    names.Add(data.slots[i].name);
                }
            }

            return names.ToArray();
        }

        private static string[] CollectAttachmentNames(Suwol2DAssetData data)
        {
            var names = new List<string>();
            var seen = new HashSet<string>();
            var attachments = CollectAttachments(data);
            for (var i = 0; i < attachments.Count; i++)
            {
                var attachment = attachments[i];
                if (attachment != null && !string.IsNullOrEmpty(attachment.name) && seen.Add(attachment.name))
                {
                    names.Add(attachment.name);
                }
            }

            return names.ToArray();
        }

        private static List<string> BuildTextureFileNameCandidates(string imageName)
        {
            var candidates = new List<string>();
            var portable = imageName.Replace('\\', '/');
            var fileName = portable;
            var slash = fileName.LastIndexOf('/');
            if (slash >= 0 && slash < fileName.Length - 1)
            {
                fileName = fileName.Substring(slash + 1);
            }

            candidates.Add(fileName);
            if (Path.GetExtension(fileName).Length == 0)
            {
                candidates.Add(fileName + ".png");
                candidates.Add(fileName + ".jpg");
                candidates.Add(fileName + ".jpeg");
            }

            return candidates;
        }

        private static bool MatchesTextureName(Texture2D texture, string imageName)
        {
            return texture != null && NormalizeTextureName(texture.name) == NormalizeTextureName(imageName);
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

            return normalized.ToLowerInvariant();
        }

        private static string CombineAssetPath(string left, string right)
        {
            if (string.IsNullOrEmpty(left))
            {
                return NormalizeAssetPath(right);
            }

            return NormalizeAssetPath(left.TrimEnd('/') + "/" + right.TrimStart('/'));
        }

        private static string NormalizeAssetPath(string value)
        {
            return string.IsNullOrEmpty(value) ? string.Empty : value.Replace('\\', '/');
        }
    }
}
