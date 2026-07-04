namespace Suwol.Suwol2D
{
    public sealed class Suwol2DSlot
    {
        public string Name { get; private set; }
        public Suwol2DBone Bone { get; private set; }
        public string SetupAttachmentName { get; private set; }
        public Suwol2DAttachment Attachment { get; private set; }
        public int DrawOrder { get; private set; }

        public Suwol2DSlot(Suwol2DSlotData data, Suwol2DBone bone, Suwol2DAttachment attachment)
        {
            Name = data != null ? data.name : string.Empty;
            Bone = bone;
            SetupAttachmentName = data != null ? data.attachment : string.Empty;
            Attachment = attachment;
            DrawOrder = data != null ? data.drawOrder : 0;
        }

        public void SetAttachment(Suwol2DAttachment attachment)
        {
            Attachment = attachment;
        }

        public void SetToSetupPose(Suwol2DSkeleton skeleton)
        {
            Attachment = skeleton != null ? skeleton.FindAttachment(SetupAttachmentName) : null;
        }
    }
}
