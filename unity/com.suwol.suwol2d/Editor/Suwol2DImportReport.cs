using System;
using UnityEngine;

namespace Suwol.Suwol2D.Editor
{
    [Serializable]
    public sealed class Suwol2DImportReport
    {
        [SerializeField] private string sourceName = string.Empty;
        [SerializeField] private int version;
        [SerializeField] private int bonesCount;
        [SerializeField] private int slotsCount;
        [SerializeField] private int skinsCount;
        [SerializeField] private int attachmentsCount;
        [SerializeField] private int animationsCount;
        [SerializeField] private int ikConstraintsCount;
        [SerializeField] private int attachmentTimelineCount;
        [SerializeField] private int drawOrderKeyCount;
        [SerializeField] private int slotColorKeyCount;
        [SerializeField] private int eventKeyCount;
        [SerializeField] private int stateMachineCount;
        [SerializeField] private int stateCount;
        [SerializeField] private int stateTransitionCount;
        [SerializeField] private int stateParameterCount;
        [SerializeField] private string[] animationNames = new string[0];
        [SerializeField] private string[] skinNames = new string[0];
        [SerializeField] private string[] slotNames = new string[0];
        [SerializeField] private string[] attachmentNames = new string[0];
        [SerializeField] private string[] textureNames = new string[0];
        [SerializeField] private string[] missingTextureNames = new string[0];
        [SerializeField] private string[] warningMessages = new string[0];
        [SerializeField] private string[] errorMessages = new string[0];
        [SerializeField] private GameObject generatedPrefab;

        public string SourceName { get { return sourceName; } }
        public int Version { get { return version; } }
        public int BonesCount { get { return bonesCount; } }
        public int SlotsCount { get { return slotsCount; } }
        public int SkinsCount { get { return skinsCount; } }
        public int AttachmentsCount { get { return attachmentsCount; } }
        public int AnimationsCount { get { return animationsCount; } }
        public int IkConstraintsCount { get { return ikConstraintsCount; } }
        public int AttachmentTimelineCount { get { return attachmentTimelineCount; } }
        public int DrawOrderKeyCount { get { return drawOrderKeyCount; } }
        public int SlotColorKeyCount { get { return slotColorKeyCount; } }
        public int EventKeyCount { get { return eventKeyCount; } }
        public int StateMachineCount { get { return stateMachineCount; } }
        public int StateCount { get { return stateCount; } }
        public int StateTransitionCount { get { return stateTransitionCount; } }
        public int StateParameterCount { get { return stateParameterCount; } }
        public string[] AnimationNames { get { return animationNames; } }
        public string[] SkinNames { get { return skinNames; } }
        public string[] SlotNames { get { return slotNames; } }
        public string[] AttachmentNames { get { return attachmentNames; } }
        public string[] TextureNames { get { return textureNames; } }
        public string[] MissingTextureNames { get { return missingTextureNames; } }
        public string[] WarningMessages { get { return warningMessages; } }
        public string[] ErrorMessages { get { return errorMessages; } }
        public GameObject GeneratedPrefab { get { return generatedPrefab; } }
        public bool HasErrors { get { return errorMessages != null && errorMessages.Length > 0; } }

        public void SetSummary(
            string sourceName,
            int version,
            int bonesCount,
            int slotsCount,
            int skinsCount,
            int attachmentsCount,
            int animationsCount,
            int ikConstraintsCount,
            string[] animationNames,
            string[] skinNames,
            string[] slotNames,
            string[] attachmentNames)
        {
            this.sourceName = sourceName ?? string.Empty;
            this.version = version;
            this.bonesCount = bonesCount;
            this.slotsCount = slotsCount;
            this.skinsCount = skinsCount;
            this.attachmentsCount = attachmentsCount;
            this.animationsCount = animationsCount;
            this.ikConstraintsCount = ikConstraintsCount;
            this.animationNames = animationNames ?? new string[0];
            this.skinNames = skinNames ?? new string[0];
            this.slotNames = slotNames ?? new string[0];
            this.attachmentNames = attachmentNames ?? new string[0];
        }

        public void SetTimelineSummary(
            int attachmentTimelineCount,
            int drawOrderKeyCount,
            int slotColorKeyCount,
            int eventKeyCount)
        {
            this.attachmentTimelineCount = attachmentTimelineCount;
            this.drawOrderKeyCount = drawOrderKeyCount;
            this.slotColorKeyCount = slotColorKeyCount;
            this.eventKeyCount = eventKeyCount;
        }

        public void SetStateMachineSummary(
            int stateMachineCount,
            int stateCount,
            int stateTransitionCount,
            int stateParameterCount)
        {
            this.stateMachineCount = stateMachineCount;
            this.stateCount = stateCount;
            this.stateTransitionCount = stateTransitionCount;
            this.stateParameterCount = stateParameterCount;
        }

        public void SetTextures(string[] textureNames, string[] missingTextureNames)
        {
            this.textureNames = textureNames ?? new string[0];
            this.missingTextureNames = missingTextureNames ?? new string[0];
        }

        public void SetMessages(string[] warningMessages, string[] errorMessages)
        {
            this.warningMessages = warningMessages ?? new string[0];
            this.errorMessages = errorMessages ?? new string[0];
        }

        public void SetGeneratedPrefab(GameObject generatedPrefab)
        {
            this.generatedPrefab = generatedPrefab;
        }
    }
}
