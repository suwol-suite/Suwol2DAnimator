using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public sealed class Suwol2DClippingContext
    {
        private readonly Dictionary<string, Vector2[]> clipsBySlot = new Dictionary<string, Vector2[]>();

        public int Count
        {
            get { return clipsBySlot.Count; }
        }

        public void Clear()
        {
            clipsBySlot.Clear();
        }

        public void SetClip(string slotName, Vector2[] polygon)
        {
            if (string.IsNullOrEmpty(slotName) || polygon == null || polygon.Length < 3)
            {
                return;
            }

            clipsBySlot[slotName] = polygon;
        }

        public bool TryGetClip(string slotName, out Vector2[] polygon)
        {
            if (string.IsNullOrEmpty(slotName))
            {
                polygon = null;
                return false;
            }

            return clipsBySlot.TryGetValue(slotName, out polygon) && polygon != null && polygon.Length >= 3;
        }
    }
}
