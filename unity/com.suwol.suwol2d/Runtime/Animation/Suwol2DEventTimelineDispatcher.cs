using System;

namespace Suwol.Suwol2D
{
    public readonly struct Suwol2DAnimationEvent
    {
        public readonly string AnimationName;
        public readonly string EventName;
        public readonly float Time;
        public readonly int IntValue;
        public readonly float FloatValue;
        public readonly string StringValue;

        public Suwol2DAnimationEvent(
            string animationName,
            string eventName,
            float time,
            int intValue,
            float floatValue,
            string stringValue)
        {
            AnimationName = animationName ?? string.Empty;
            EventName = eventName ?? string.Empty;
            Time = time;
            IntValue = intValue;
            FloatValue = floatValue;
            StringValue = stringValue ?? string.Empty;
        }
    }

    public sealed class Suwol2DEventTimelineDispatcher
    {
        private string animationName = string.Empty;
        private float previousTime;
        private bool hasPreviousTime;

        public void Reset(string nextAnimationName)
        {
            animationName = nextAnimationName ?? string.Empty;
            previousTime = 0f;
            hasPreviousTime = false;
        }

        public void Stop()
        {
            hasPreviousTime = false;
        }

        public void Dispatch(
            Suwol2DAnimationData animation,
            float previousAbsoluteTime,
            float currentAbsoluteTime,
            float duration,
            Action<Suwol2DAnimationEvent> callback)
        {
            if (animation == null || callback == null || animation.events == null || animation.events.Length == 0)
            {
                previousTime = currentAbsoluteTime;
                hasPreviousTime = true;
                return;
            }

            if (animation.name != animationName)
            {
                Reset(animation.name);
            }

            var from = hasPreviousTime ? previousAbsoluteTime : previousTime;
            var to = currentAbsoluteTime;
            previousTime = currentAbsoluteTime;
            hasPreviousTime = true;

            if (to < from)
            {
                return;
            }

            if (!animation.loop || duration <= 0f)
            {
                DispatchRange(animation, from, to, callback);
                return;
            }

            var cursor = from;
            while (cursor < to)
            {
                var loopStart = UnityEngine.Mathf.Floor(cursor / duration) * duration;
                var loopEnd = loopStart + duration;
                var segmentEnd = UnityEngine.Mathf.Min(to, loopEnd);
                DispatchRange(animation, cursor - loopStart, segmentEnd - loopStart, callback);
                cursor = segmentEnd;
                if (UnityEngine.Mathf.Approximately(cursor, loopEnd))
                {
                    DispatchZeroEvents(animation, callback);
                    cursor += 0.0001f;
                }
            }
        }

        public static float GetDuration(Suwol2DEventKeyData[] events)
        {
            if (events == null || events.Length == 0)
            {
                return 0f;
            }

            return events[events.Length - 1] != null ? events[events.Length - 1].time : 0f;
        }

        private static void DispatchRange(
            Suwol2DAnimationData animation,
            float from,
            float to,
            Action<Suwol2DAnimationEvent> callback)
        {
            for (var i = 0; i < animation.events.Length; i++)
            {
                var eventKey = animation.events[i];
                if (eventKey == null || string.IsNullOrEmpty(eventKey.name))
                {
                    continue;
                }

                if (eventKey.time > from && eventKey.time <= to)
                {
                    callback(new Suwol2DAnimationEvent(
                        animation.name,
                        eventKey.name,
                        eventKey.time,
                        eventKey.intValue,
                        eventKey.floatValue,
                        eventKey.stringValue));
                }
            }
        }

        private static void DispatchZeroEvents(Suwol2DAnimationData animation, Action<Suwol2DAnimationEvent> callback)
        {
            for (var i = 0; i < animation.events.Length; i++)
            {
                var eventKey = animation.events[i];
                if (eventKey == null || string.IsNullOrEmpty(eventKey.name) || !UnityEngine.Mathf.Approximately(eventKey.time, 0f))
                {
                    continue;
                }

                callback(new Suwol2DAnimationEvent(
                    animation.name,
                    eventKey.name,
                    eventKey.time,
                    eventKey.intValue,
                    eventKey.floatValue,
                    eventKey.stringValue));
            }
        }
    }
}
