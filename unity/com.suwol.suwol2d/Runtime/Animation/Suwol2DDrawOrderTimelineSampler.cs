using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public static class Suwol2DDrawOrderTimelineSampler
    {
        public static void Sample(Suwol2DSkeleton skeleton, Suwol2DAnimationData animation, float time, Dictionary<string, int> output)
        {
            if (output == null)
            {
                return;
            }

            output.Clear();
            if (skeleton == null)
            {
                return;
            }

            var slots = skeleton.Slots;
            for (var i = 0; i < slots.Count; i++)
            {
                output[slots[i].Name] = slots[i].DrawOrder;
            }

            if (animation == null || animation.drawOrders == null || animation.drawOrders.Length == 0)
            {
                Normalize(output);
                return;
            }

            var key = LastKeyAtOrBefore(animation.drawOrders, time);
            if (key != null && key.slots != null)
            {
                for (var i = 0; i < key.slots.Length; i++)
                {
                    var entry = key.slots[i];
                    if (entry == null || string.IsNullOrEmpty(entry.slot) || !output.ContainsKey(entry.slot))
                    {
                        continue;
                    }

                    output[entry.slot] = entry.drawOrder;
                }
            }

            Normalize(output);
        }

        public static float GetDuration(Suwol2DDrawOrderKeyData[] keys)
        {
            if (keys == null || keys.Length == 0)
            {
                return 0f;
            }

            return keys[keys.Length - 1] != null ? keys[keys.Length - 1].time : 0f;
        }

        private static Suwol2DDrawOrderKeyData LastKeyAtOrBefore(Suwol2DDrawOrderKeyData[] keys, float time)
        {
            Suwol2DDrawOrderKeyData selected = null;
            for (var i = 0; i < keys.Length; i++)
            {
                var key = keys[i];
                if (key == null)
                {
                    continue;
                }

                if (key.time <= time)
                {
                    selected = key;
                }
                else
                {
                    break;
                }
            }

            return selected;
        }

        private static void Normalize(Dictionary<string, int> output)
        {
            var entries = new List<KeyValuePair<string, int>>(output);
            entries.Sort((left, right) =>
            {
                var order = left.Value.CompareTo(right.Value);
                return order != 0 ? order : string.CompareOrdinal(left.Key, right.Key);
            });

            output.Clear();
            for (var i = 0; i < entries.Count; i++)
            {
                output[entries[i].Key] = i;
            }
        }
    }
}
