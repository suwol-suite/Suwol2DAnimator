using System;

namespace Suwol.Suwol2D
{
    [Serializable]
    public sealed class Suwol2DAssetData
    {
        public int version;
        public string name = string.Empty;
        public Suwol2DBoneData[] bones = new Suwol2DBoneData[0];
        public Suwol2DSlotData[] slots = new Suwol2DSlotData[0];
        public Suwol2DSkinData[] skins = new Suwol2DSkinData[0];
        public Suwol2DAttachmentData[] attachments = new Suwol2DAttachmentData[0];
        public Suwol2DAnimationData[] animations = new Suwol2DAnimationData[0];
        public Suwol2DAtlasData[] atlases = new Suwol2DAtlasData[0];
        public Suwol2DIkConstraintData[] ikConstraints = new Suwol2DIkConstraintData[0];
        public Suwol2DStateMachineData[] stateMachines = new Suwol2DStateMachineData[0];
    }

    [Serializable]
    public sealed class Suwol2DAtlasData
    {
        public string name = string.Empty;
        public string image = string.Empty;
        public int width;
        public int height;
        public Suwol2DAtlasRegionData[] regions = new Suwol2DAtlasRegionData[0];
    }

    [Serializable]
    public sealed class Suwol2DAtlasRegionData
    {
        public string name = string.Empty;
        public int x;
        public int y;
        public int width;
        public int height;
        public float u;
        public float v;
        public float u2;
        public float v2;
    }

    [Serializable]
    public sealed class Suwol2DBoneData
    {
        public string name = string.Empty;
        public string parent = string.Empty;
        public float x;
        public float y;
        public float rotation;
        public float scaleX = 1f;
        public float scaleY = 1f;
        public float length;
    }

    [Serializable]
    public sealed class Suwol2DIkConstraintData
    {
        public string name = string.Empty;
        public string parentBone = string.Empty;
        public string childBone = string.Empty;
        public string targetBone = string.Empty;
        public bool enabled = true;
        public float mix = 1f;
        public int bendDirection = 1;
        public int order;
    }

    [Serializable]
    public sealed class Suwol2DSlotData
    {
        public string name = string.Empty;
        public string bone = string.Empty;
        public string attachment = string.Empty;
        public int drawOrder;
    }

    [Serializable]
    public sealed class Suwol2DSkinData
    {
        public string name = "default";
        public Suwol2DAttachmentData[] attachments = new Suwol2DAttachmentData[0];
    }

    [Serializable]
    public sealed class Suwol2DAttachmentData
    {
        public string name = string.Empty;
        public string slot = string.Empty;
        public string type = "region";
        public string image = string.Empty;
        public float x;
        public float y;
        public float rotation;
        public float width = 1f;
        public float height = 1f;
        public float scaleX = 1f;
        public float scaleY = 1f;
        public string endSlot = string.Empty;
        public Suwol2DMeshVertexData[] vertices = new Suwol2DMeshVertexData[0];
        public Suwol2DClippingVertexData[] clippingVertices = new Suwol2DClippingVertexData[0];
        public int[] triangles = new int[0];
        public Suwol2DVertexWeightData[] weights = new Suwol2DVertexWeightData[0];
    }

    [Serializable]
    public sealed class Suwol2DMeshVertexData
    {
        public float x;
        public float y;
        public float u;
        public float v;
    }

    [Serializable]
    public sealed class Suwol2DClippingVertexData
    {
        public float x;
        public float y;
    }

    [Serializable]
    public sealed class Suwol2DBoneWeightData
    {
        public string bone = string.Empty;
        public float weight;
    }

    [Serializable]
    public sealed class Suwol2DVertexWeightData
    {
        public int vertex;
        public Suwol2DBoneWeightData[] bones = new Suwol2DBoneWeightData[0];
    }

    [Serializable]
    public sealed class Suwol2DAnimationData
    {
        public string name = string.Empty;
        public bool loop = true;
        public float duration;
        public Suwol2DBoneTimelineData[] bones = new Suwol2DBoneTimelineData[0];
        public Suwol2DDeformTimelineData[] deforms = new Suwol2DDeformTimelineData[0];
        public Suwol2DAttachmentTimelineData[] attachments = new Suwol2DAttachmentTimelineData[0];
        public Suwol2DDrawOrderKeyData[] drawOrders = new Suwol2DDrawOrderKeyData[0];
        public Suwol2DSlotTimelineData[] slots = new Suwol2DSlotTimelineData[0];
        public Suwol2DEventKeyData[] events = new Suwol2DEventKeyData[0];
    }

    [Serializable]
    public sealed class Suwol2DBoneTimelineData
    {
        public string bone = string.Empty;
        public Suwol2DTranslateKey[] translate = new Suwol2DTranslateKey[0];
        public Suwol2DRotateKey[] rotate = new Suwol2DRotateKey[0];
        public Suwol2DScaleKey[] scale = new Suwol2DScaleKey[0];
    }

    [Serializable]
    public sealed class Suwol2DTranslateKey
    {
        public float time;
        public float x;
        public float y;
        public string interpolation = string.Empty;
    }

    [Serializable]
    public sealed class Suwol2DRotateKey
    {
        public float time;
        public float rotation;
        public string interpolation = string.Empty;
    }

    [Serializable]
    public sealed class Suwol2DScaleKey
    {
        public float time;
        public float scaleX = 1f;
        public float scaleY = 1f;
        public string interpolation = string.Empty;
    }

    [Serializable]
    public sealed class Suwol2DVertexOffsetData
    {
        public int vertex;
        public float x;
        public float y;
    }

    [Serializable]
    public sealed class Suwol2DDeformKeyData
    {
        public float time;
        public Suwol2DVertexOffsetData[] offsets = new Suwol2DVertexOffsetData[0];
        public string interpolation = string.Empty;
    }

    [Serializable]
    public sealed class Suwol2DDeformTimelineData
    {
        public string slot = string.Empty;
        public string attachment = string.Empty;
        public Suwol2DDeformKeyData[] keys = new Suwol2DDeformKeyData[0];
    }

    [Serializable]
    public sealed class Suwol2DAttachmentTimelineData
    {
        public string slot = string.Empty;
        public Suwol2DAttachmentKeyData[] keys = new Suwol2DAttachmentKeyData[0];
    }

    [Serializable]
    public sealed class Suwol2DAttachmentKeyData
    {
        public float time;
        public string attachment = string.Empty;
    }

    [Serializable]
    public sealed class Suwol2DDrawOrderKeyData
    {
        public float time;
        public Suwol2DDrawOrderSlotData[] slots = new Suwol2DDrawOrderSlotData[0];
    }

    [Serializable]
    public sealed class Suwol2DDrawOrderSlotData
    {
        public string slot = string.Empty;
        public int drawOrder;
    }

    [Serializable]
    public sealed class Suwol2DSlotTimelineData
    {
        public string slot = string.Empty;
        public Suwol2DSlotColorKeyData[] color = new Suwol2DSlotColorKeyData[0];
    }

    [Serializable]
    public sealed class Suwol2DSlotColorKeyData
    {
        public float time;
        public float r = 1f;
        public float g = 1f;
        public float b = 1f;
        public float a = 1f;
        public string interpolation = string.Empty;
    }

    [Serializable]
    public sealed class Suwol2DEventKeyData
    {
        public float time;
        public string name = string.Empty;
        public int intValue;
        public float floatValue;
        public string stringValue = string.Empty;
    }

    [Serializable]
    public sealed class Suwol2DStateMachineData
    {
        public string name = string.Empty;
        public string initialState = string.Empty;
        public Suwol2DStateData[] states = new Suwol2DStateData[0];
        public Suwol2DStateParameterData[] parameters = new Suwol2DStateParameterData[0];
        public Suwol2DStateTransitionData[] transitions = new Suwol2DStateTransitionData[0];
    }

    [Serializable]
    public sealed class Suwol2DStateData
    {
        public string name = string.Empty;
        public string animation = string.Empty;
        public bool loop = true;
        public float speed = 1f;
    }

    [Serializable]
    public sealed class Suwol2DStateParameterData
    {
        public string name = string.Empty;
        public string type = "bool";
        public bool defaultBool;
    }

    [Serializable]
    public sealed class Suwol2DStateTransitionData
    {
        public string from = string.Empty;
        public string to = string.Empty;
        public float fadeDuration;
        public Suwol2DTransitionConditionData[] conditions = new Suwol2DTransitionConditionData[0];
    }

    [Serializable]
    public sealed class Suwol2DTransitionConditionData
    {
        public string parameter = string.Empty;
        public string mode = "equals";
        public bool boolValue;
    }
}
