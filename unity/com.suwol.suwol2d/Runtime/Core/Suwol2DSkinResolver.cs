using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public sealed class Suwol2DSkinResolver
    {
        private const string DefaultSkinName = "default";

        private readonly Suwol2DSkeleton skeleton;
        private readonly Dictionary<string, List<Suwol2DAttachment>> skinsByName = new Dictionary<string, List<Suwol2DAttachment>>();
        private readonly Dictionary<string, string> slotOverrides = new Dictionary<string, string>();
        private readonly Dictionary<string, string> animationAttachmentOverrides = new Dictionary<string, string>();
        private readonly HashSet<string> missingAnimationAttachments = new HashSet<string>();
        private string currentSkinName = DefaultSkinName;

        public Suwol2DSkinResolver(Suwol2DSkeleton skeleton, Suwol2DSkinData[] skins)
        {
            this.skeleton = skeleton;
            BuildSkins(skins);
        }

        public bool HasSkin(string skinName)
        {
            return !string.IsNullOrEmpty(skinName) && skinsByName.ContainsKey(skinName);
        }

        public string GetCurrentSkin()
        {
            return currentSkinName;
        }

        public bool SetSkin(string skinName)
        {
            if (!HasSkin(skinName))
            {
                Debug.LogWarning("Suwol2D skin not found: " + skinName);
                return false;
            }

            currentSkinName = skinName;
            return true;
        }

        public bool SetAttachment(string slotName, string attachmentName)
        {
            if (skeleton == null || skeleton.FindSlot(slotName) == null)
            {
                Debug.LogWarning("Suwol2D slot not found for attachment override: " + slotName);
                return false;
            }

            if (string.IsNullOrEmpty(attachmentName))
            {
                slotOverrides.Remove(slotName);
                return true;
            }

            if (FindExactAttachment(slotName, attachmentName) == null)
            {
                Debug.LogWarning(
                    "Suwol2D attachment not found for slot '" + slotName +
                    "': " + attachmentName);
                return false;
            }

            slotOverrides[slotName] = attachmentName;
            return true;
        }

        public void ResetAttachments()
        {
            slotOverrides.Clear();
        }

        public void SetAnimationAttachmentOverrides(Dictionary<string, string> overrides)
        {
            animationAttachmentOverrides.Clear();
            if (overrides == null)
            {
                return;
            }

            foreach (var pair in overrides)
            {
                animationAttachmentOverrides[pair.Key] = pair.Value ?? string.Empty;
            }
        }

        public void ClearAnimationAttachmentOverrides()
        {
            animationAttachmentOverrides.Clear();
        }

        public Suwol2DAttachment ResolveAttachment(Suwol2DSlot slot)
        {
            if (slot == null)
            {
                return null;
            }

            string animationAttachmentName;
            if (animationAttachmentOverrides.TryGetValue(slot.Name, out animationAttachmentName))
            {
                if (string.IsNullOrEmpty(animationAttachmentName))
                {
                    return null;
                }

                var animationAttachment = FindExactAttachment(slot.Name, animationAttachmentName);
                if (animationAttachment != null)
                {
                    return animationAttachment;
                }

                var warningKey = slot.Name + "/" + animationAttachmentName;
                if (!missingAnimationAttachments.Contains(warningKey))
                {
                    missingAnimationAttachments.Add(warningKey);
                    Debug.LogWarning(
                        "Suwol2D animation attachment not found for slot '" + slot.Name +
                        "': " + animationAttachmentName);
                }
                return null;
            }

            string overrideAttachmentName;
            if (slotOverrides.TryGetValue(slot.Name, out overrideAttachmentName))
            {
                return FindExactAttachment(slot.Name, overrideAttachmentName);
            }

            var setupAttachmentName = slot.SetupAttachmentName;
            return FindAttachmentInSkin(currentSkinName, slot.Name, setupAttachmentName)
                ?? FindFirstAttachmentInSkinSlot(currentSkinName, slot.Name)
                ?? FindAttachmentInSkin(DefaultSkinName, slot.Name, setupAttachmentName)
                ?? FindFirstAttachmentInSkinSlot(DefaultSkinName, slot.Name)
                ?? slot.Attachment
                ?? (skeleton != null ? skeleton.FindAttachment(setupAttachmentName) : null);
        }

        private void BuildSkins(Suwol2DSkinData[] skins)
        {
            skinsByName.Clear();

            if (skins != null)
            {
                for (var i = 0; i < skins.Length; i++)
                {
                    var skin = skins[i];
                    if (skin == null || string.IsNullOrEmpty(skin.name))
                    {
                        continue;
                    }

                    if (skinsByName.ContainsKey(skin.name))
                    {
                        Debug.LogWarning("Skipped duplicate Suwol2D skin: " + skin.name);
                        continue;
                    }

                    skinsByName.Add(skin.name, CreateAttachments(skin.attachments));
                }
            }

            List<Suwol2DAttachment> defaultAttachments;
            if (!skinsByName.TryGetValue(DefaultSkinName, out defaultAttachments))
            {
                defaultAttachments = new List<Suwol2DAttachment>();
                skinsByName.Add(DefaultSkinName, defaultAttachments);
            }

            if (defaultAttachments.Count == 0 && skeleton != null)
            {
                for (var i = 0; i < skeleton.Attachments.Count; i++)
                {
                    defaultAttachments.Add(skeleton.Attachments[i]);
                }
            }
        }

        private static List<Suwol2DAttachment> CreateAttachments(Suwol2DAttachmentData[] attachmentData)
        {
            var attachments = new List<Suwol2DAttachment>();
            if (attachmentData == null)
            {
                return attachments;
            }

            for (var i = 0; i < attachmentData.Length; i++)
            {
                var data = attachmentData[i];
                if (data == null || string.IsNullOrEmpty(data.name))
                {
                    continue;
                }

                attachments.Add(new Suwol2DAttachment(data));
            }

            return attachments;
        }

        private Suwol2DAttachment FindExactAttachment(string slotName, string attachmentName)
        {
            var attachment = FindAttachmentInSkin(currentSkinName, slotName, attachmentName)
                ?? FindAttachmentInSkin(DefaultSkinName, slotName, attachmentName);
            if (attachment != null)
            {
                return attachment;
            }

            attachment = skeleton != null ? skeleton.FindAttachment(attachmentName) : null;
            return attachment != null && attachment.SlotName == slotName ? attachment : null;
        }

        private Suwol2DAttachment FindAttachmentInSkin(string skinName, string slotName, string attachmentName)
        {
            if (string.IsNullOrEmpty(skinName) || string.IsNullOrEmpty(slotName) || string.IsNullOrEmpty(attachmentName))
            {
                return null;
            }

            List<Suwol2DAttachment> attachments;
            if (!skinsByName.TryGetValue(skinName, out attachments))
            {
                return null;
            }

            for (var i = 0; i < attachments.Count; i++)
            {
                var attachment = attachments[i];
                if (attachment != null && attachment.SlotName == slotName && attachment.Name == attachmentName)
                {
                    return attachment;
                }
            }

            return null;
        }

        private Suwol2DAttachment FindFirstAttachmentInSkinSlot(string skinName, string slotName)
        {
            if (string.IsNullOrEmpty(skinName) || string.IsNullOrEmpty(slotName))
            {
                return null;
            }

            List<Suwol2DAttachment> attachments;
            if (!skinsByName.TryGetValue(skinName, out attachments))
            {
                return null;
            }

            for (var i = 0; i < attachments.Count; i++)
            {
                var attachment = attachments[i];
                if (attachment != null && attachment.SlotName == slotName)
                {
                    return attachment;
                }
            }

            return null;
        }
    }
}
