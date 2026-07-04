using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public sealed class Suwol2DSkeleton
    {
        private readonly List<Suwol2DBone> bones = new List<Suwol2DBone>();
        private readonly List<Suwol2DBone> rootBones = new List<Suwol2DBone>();
        private readonly List<Suwol2DSlot> slots = new List<Suwol2DSlot>();
        private readonly List<Suwol2DAttachment> attachments = new List<Suwol2DAttachment>();
        private readonly List<Suwol2DIkConstraintData> ikConstraints = new List<Suwol2DIkConstraintData>();
        private readonly Dictionary<string, Suwol2DBone> bonesByName = new Dictionary<string, Suwol2DBone>();
        private readonly Dictionary<string, Suwol2DSlot> slotsByName = new Dictionary<string, Suwol2DSlot>();
        private readonly Dictionary<string, Suwol2DAttachment> attachmentsByName = new Dictionary<string, Suwol2DAttachment>();
        private readonly Dictionary<string, Suwol2DAnimationData> animationsByName = new Dictionary<string, Suwol2DAnimationData>();

        public string Name { get; private set; }
        public IReadOnlyList<Suwol2DBone> Bones { get { return bones; } }
        public IReadOnlyList<Suwol2DSlot> Slots { get { return slots; } }
        public IReadOnlyList<Suwol2DAttachment> Attachments { get { return attachments; } }
        public IReadOnlyList<Suwol2DIkConstraintData> IkConstraints { get { return ikConstraints; } }

        private Suwol2DSkeleton()
        {
        }

        public static Suwol2DSkeleton FromData(Suwol2DAssetData data)
        {
            var skeleton = new Suwol2DSkeleton();
            skeleton.Build(data);
            return skeleton;
        }

        public Suwol2DBone FindBone(string name)
        {
            if (string.IsNullOrEmpty(name))
            {
                return null;
            }

            Suwol2DBone bone;
            return bonesByName.TryGetValue(name, out bone) ? bone : null;
        }

        public Suwol2DSlot FindSlot(string name)
        {
            if (string.IsNullOrEmpty(name))
            {
                return null;
            }

            Suwol2DSlot slot;
            return slotsByName.TryGetValue(name, out slot) ? slot : null;
        }

        public Suwol2DAttachment FindAttachment(string name)
        {
            if (string.IsNullOrEmpty(name))
            {
                return null;
            }

            Suwol2DAttachment attachment;
            return attachmentsByName.TryGetValue(name, out attachment) ? attachment : null;
        }

        public Suwol2DAnimationData FindAnimation(string name)
        {
            if (string.IsNullOrEmpty(name))
            {
                return null;
            }

            Suwol2DAnimationData animation;
            return animationsByName.TryGetValue(name, out animation) ? animation : null;
        }

        public bool HasAnimation(string name)
        {
            return FindAnimation(name) != null;
        }

        public void SetToSetupPose()
        {
            for (var i = 0; i < bones.Count; i++)
            {
                bones[i].SetToSetupPose();
            }

            for (var i = 0; i < slots.Count; i++)
            {
                slots[i].SetToSetupPose(this);
            }
        }

        public void UpdateWorldTransforms()
        {
            for (var i = 0; i < rootBones.Count; i++)
            {
                UpdateBoneTree(rootBones[i]);
            }
        }

        private void Build(Suwol2DAssetData data)
        {
            if (data == null)
            {
                Debug.LogWarning("Suwol2DAssetData is null.");
                return;
            }

            Name = data.name;
            BuildBones(data.bones);
            BuildAttachments(data.attachments, data.skins);
            BuildSlots(data.slots);
            BuildAnimations(data.animations);
            BuildIkConstraints(data.ikConstraints);
            SetToSetupPose();
            UpdateWorldTransforms();
        }

        private void BuildBones(Suwol2DBoneData[] boneData)
        {
            if (boneData == null)
            {
                return;
            }

            for (var i = 0; i < boneData.Length; i++)
            {
                var data = boneData[i];
                if (data == null || string.IsNullOrEmpty(data.name))
                {
                    Debug.LogWarning("Skipped Suwol2D bone with no name.");
                    continue;
                }

                if (bonesByName.ContainsKey(data.name))
                {
                    Debug.LogWarning("Skipped duplicate Suwol2D bone: " + data.name);
                    continue;
                }

                var bone = new Suwol2DBone(data);
                bones.Add(bone);
                bonesByName.Add(data.name, bone);
            }

            for (var i = 0; i < boneData.Length; i++)
            {
                var data = boneData[i];
                if (data == null || string.IsNullOrEmpty(data.name))
                {
                    continue;
                }

                var bone = FindBone(data.name);
                if (bone == null)
                {
                    continue;
                }

                if (string.IsNullOrEmpty(data.parent))
                {
                    rootBones.Add(bone);
                    continue;
                }

                var parent = FindBone(data.parent);
                if (parent == null)
                {
                    Debug.LogWarning("Suwol2D bone parent not found: " + data.parent + " for " + data.name);
                    rootBones.Add(bone);
                    continue;
                }

                bone.SetParent(parent);
            }
        }

        private void BuildAttachments(Suwol2DAttachmentData[] topLevelAttachments, Suwol2DSkinData[] skins)
        {
            AddAttachments(topLevelAttachments, true);

            if (skins == null)
            {
                return;
            }

            for (var i = 0; i < skins.Length; i++)
            {
                if (skins[i] != null)
                {
                    AddAttachments(skins[i].attachments, false);
                }
            }
        }

        private void AddAttachments(Suwol2DAttachmentData[] attachmentData, bool warnOnDuplicate)
        {
            if (attachmentData == null)
            {
                return;
            }

            for (var i = 0; i < attachmentData.Length; i++)
            {
                var data = attachmentData[i];
                if (data == null || string.IsNullOrEmpty(data.name))
                {
                    Debug.LogWarning("Skipped Suwol2D attachment with no name.");
                    continue;
                }

                if (attachmentsByName.ContainsKey(data.name))
                {
                    if (warnOnDuplicate)
                    {
                        Debug.LogWarning("Skipped duplicate Suwol2D attachment: " + data.name);
                    }
                    continue;
                }

                var attachment = new Suwol2DAttachment(data);
                attachments.Add(attachment);
                attachmentsByName.Add(attachment.Name, attachment);
            }
        }

        private void BuildSlots(Suwol2DSlotData[] slotData)
        {
            if (slotData == null)
            {
                return;
            }

            var shouldSortByDrawOrder = false;
            for (var i = 0; i < slotData.Length; i++)
            {
                var data = slotData[i];
                if (data == null || string.IsNullOrEmpty(data.name))
                {
                    Debug.LogWarning("Skipped Suwol2D slot with no name.");
                    continue;
                }

                if (slotsByName.ContainsKey(data.name))
                {
                    Debug.LogWarning("Skipped duplicate Suwol2D slot: " + data.name);
                    continue;
                }

                var bone = FindBone(data.bone);
                if (bone == null)
                {
                    Debug.LogWarning("Suwol2D slot bone not found: " + data.bone + " for " + data.name);
                    continue;
                }

                var attachment = FindAttachment(data.attachment);
                var slot = new Suwol2DSlot(data, bone, attachment);
                if (slot.DrawOrder != 0)
                {
                    shouldSortByDrawOrder = true;
                }

                slots.Add(slot);
                slotsByName.Add(slot.Name, slot);
            }

            if (shouldSortByDrawOrder)
            {
                slots.Sort((left, right) => left.DrawOrder.CompareTo(right.DrawOrder));
            }
        }

        private void BuildAnimations(Suwol2DAnimationData[] animationData)
        {
            if (animationData == null)
            {
                return;
            }

            for (var i = 0; i < animationData.Length; i++)
            {
                var animation = animationData[i];
                if (animation == null || string.IsNullOrEmpty(animation.name))
                {
                    continue;
                }

                if (animationsByName.ContainsKey(animation.name))
                {
                    Debug.LogWarning("Skipped duplicate Suwol2D animation: " + animation.name);
                    continue;
                }

                animationsByName.Add(animation.name, animation);
            }
        }

        private void BuildIkConstraints(Suwol2DIkConstraintData[] constraintData)
        {
            ikConstraints.Clear();
            if (constraintData == null)
            {
                return;
            }

            var seenNames = new HashSet<string>();
            for (var i = 0; i < constraintData.Length; i++)
            {
                var constraint = constraintData[i];
                if (constraint == null || string.IsNullOrEmpty(constraint.name))
                {
                    continue;
                }

                if (seenNames.Contains(constraint.name))
                {
                    Debug.LogWarning("Skipped duplicate Suwol2D IK constraint: " + constraint.name);
                    continue;
                }

                seenNames.Add(constraint.name);
                ikConstraints.Add(constraint);
            }

            ikConstraints.Sort((left, right) =>
            {
                var order = left.order.CompareTo(right.order);
                return order != 0 ? order : string.CompareOrdinal(left.name, right.name);
            });
        }

        private static void UpdateBoneTree(Suwol2DBone bone)
        {
            bone.UpdateWorldTransform();

            var children = bone.Children;
            for (var i = 0; i < children.Count; i++)
            {
                UpdateBoneTree(children[i]);
            }
        }
    }
}
