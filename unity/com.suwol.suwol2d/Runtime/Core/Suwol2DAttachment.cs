namespace Suwol.Suwol2D
{
    public sealed class Suwol2DAttachment
    {
        public const string RegionType = "region";
        public const string MeshType = "mesh";

        public string Name { get; private set; }
        public string SlotName { get; private set; }
        public string Type { get; private set; }
        public string Image { get; private set; }
        public float X { get; private set; }
        public float Y { get; private set; }
        public float Rotation { get; private set; }
        public float Width { get; private set; }
        public float Height { get; private set; }
        public float ScaleX { get; private set; }
        public float ScaleY { get; private set; }
        public Suwol2DMeshVertexData[] Vertices { get; private set; }
        public int[] Triangles { get; private set; }
        public Suwol2DVertexWeightData[] Weights { get; private set; }

        public bool IsRegion
        {
            get { return string.Equals(Type, RegionType, System.StringComparison.OrdinalIgnoreCase); }
        }

        public bool IsMesh
        {
            get { return string.Equals(Type, MeshType, System.StringComparison.OrdinalIgnoreCase); }
        }

        public Suwol2DAttachment(Suwol2DAttachmentData data)
        {
            Name = data != null ? data.name : string.Empty;
            SlotName = data != null ? data.slot : string.Empty;
            Type = string.IsNullOrEmpty(data != null ? data.type : null) ? RegionType : data.type;
            Image = data != null ? data.image : string.Empty;
            X = data != null ? data.x : 0f;
            Y = data != null ? data.y : 0f;
            Rotation = data != null ? data.rotation : 0f;
            Width = data != null && data.width > 0f ? data.width : 1f;
            Height = data != null && data.height > 0f ? data.height : 1f;
            ScaleX = data != null && data.scaleX != 0f ? data.scaleX : 1f;
            ScaleY = data != null && data.scaleY != 0f ? data.scaleY : 1f;
            Vertices = data != null && data.vertices != null ? data.vertices : new Suwol2DMeshVertexData[0];
            Triangles = data != null && data.triangles != null ? data.triangles : new int[0];
            Weights = data != null && data.weights != null ? data.weights : new Suwol2DVertexWeightData[0];
        }
    }
}
