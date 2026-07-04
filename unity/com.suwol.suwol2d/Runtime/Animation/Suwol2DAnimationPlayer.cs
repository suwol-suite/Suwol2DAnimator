using UnityEngine;

namespace Suwol.Suwol2D
{
    public sealed class Suwol2DAnimationPlayer
    {
        private readonly Suwol2DSkeleton skeleton;
        private Suwol2DAnimationData currentAnimation;
        private Suwol2DAnimationData nextAnimation;
        private float nextTime;
        private float previousNextTime;
        private float nextDuration;
        private float fadeDuration;
        private float fadeElapsed;
        private bool currentLoop;
        private bool nextLoop;

        public bool IsPlaying { get; private set; }
        public float PreviousTime { get; private set; }
        public float CurrentTime { get; private set; }
        public float SampleTime { get; private set; }
        public float NextSampleTime { get; private set; }
        public float Duration { get; private set; }
        public float Speed { get; private set; }
        public float TransitionProgress
        {
            get
            {
                return fadeDuration > 0f && nextAnimation != null
                    ? Mathf.Clamp01(fadeElapsed / fadeDuration)
                    : 0f;
            }
        }

        public bool IsTransitioning
        {
            get { return nextAnimation != null && fadeDuration > 0f; }
        }

        public Suwol2DAnimationData CurrentAnimation
        {
            get { return currentAnimation; }
        }

        public Suwol2DAnimationData NextAnimation
        {
            get { return nextAnimation; }
        }

        public Suwol2DAnimationData DiscreteAnimation
        {
            get { return IsTransitioning && TransitionProgress >= 0.5f ? nextAnimation : currentAnimation; }
        }

        public float DiscreteSampleTime
        {
            get { return IsTransitioning && TransitionProgress >= 0.5f ? NextSampleTime : SampleTime; }
        }

        public Suwol2DAnimationData EventAnimation
        {
            get { return IsTransitioning ? nextAnimation : currentAnimation; }
        }

        public float EventPreviousTime
        {
            get { return IsTransitioning ? previousNextTime : PreviousTime; }
        }

        public float EventCurrentTime
        {
            get { return IsTransitioning ? nextTime : CurrentTime; }
        }

        public float EventDuration
        {
            get { return IsTransitioning ? nextDuration : Duration; }
        }

        public string CurrentAnimationName
        {
            get { return currentAnimation != null ? currentAnimation.name : string.Empty; }
        }

        public string NextAnimationName
        {
            get { return nextAnimation != null ? nextAnimation.name : string.Empty; }
        }

        public Suwol2DAnimationPlayer(Suwol2DSkeleton skeleton)
        {
            this.skeleton = skeleton;
            Speed = 1f;
        }

        public bool Play(string animationName)
        {
            return Play(animationName, false, false);
        }

        public bool Play(string animationName, bool loopOverride)
        {
            return Play(animationName, true, loopOverride);
        }

        private bool Play(string animationName, bool hasLoopOverride, bool loopOverride)
        {
            if (skeleton == null)
            {
                return false;
            }

            if (string.IsNullOrEmpty(animationName))
            {
                Debug.LogWarning("Suwol2D animation name is empty.");
                return false;
            }

            var animation = skeleton.FindAnimation(animationName);
            if (animation == null)
            {
                Debug.LogWarning("Suwol2D animation not found: " + animationName);
                return false;
            }

            currentAnimation = animation;
            nextAnimation = null;
            currentLoop = hasLoopOverride ? loopOverride : animation.loop;
            nextLoop = false;
            Duration = Suwol2DAnimationSampler.GetDuration(animation);
            PreviousTime = 0f;
            CurrentTime = 0f;
            nextTime = 0f;
            previousNextTime = 0f;
            nextDuration = 0f;
            fadeDuration = 0f;
            fadeElapsed = 0f;
            IsPlaying = true;
            ApplyCurrentTime();
            return true;
        }

        public bool CrossFade(string animationName, float duration)
        {
            return CrossFade(animationName, duration, false, false);
        }

        public bool CrossFade(string animationName, float duration, bool loopOverride)
        {
            return CrossFade(animationName, duration, true, loopOverride);
        }

        private bool CrossFade(string animationName, float duration, bool hasLoopOverride, bool loopOverride)
        {
            if (skeleton == null)
            {
                return false;
            }

            if (duration <= 0f || currentAnimation == null)
            {
                return Play(animationName, hasLoopOverride, loopOverride);
            }

            var animation = skeleton.FindAnimation(animationName);
            if (animation == null)
            {
                Debug.LogWarning("Suwol2D animation not found: " + animationName);
                return false;
            }

            if (!IsTransitioning && currentAnimation == animation)
            {
                return true;
            }

            if (IsTransitioning && nextAnimation == animation)
            {
                return true;
            }

            nextAnimation = animation;
            nextLoop = hasLoopOverride ? loopOverride : animation.loop;
            nextDuration = Suwol2DAnimationSampler.GetDuration(animation);
            previousNextTime = 0f;
            nextTime = 0f;
            NextSampleTime = 0f;
            fadeDuration = Mathf.Max(0.0001f, duration);
            fadeElapsed = 0f;
            IsPlaying = true;
            ApplyCurrentTime();
            return true;
        }

        public void Stop()
        {
            IsPlaying = false;
            nextAnimation = null;
            fadeDuration = 0f;
            fadeElapsed = 0f;
        }

        public void SetAnimationSpeed(float speed)
        {
            Speed = Mathf.Max(0f, speed);
        }

        public bool Tick(float deltaTime)
        {
            if (!IsPlaying || currentAnimation == null || skeleton == null)
            {
                return false;
            }

            PreviousTime = CurrentTime;
            CurrentTime += deltaTime * Speed;
            if (nextAnimation != null)
            {
                previousNextTime = nextTime;
                nextTime += deltaTime * Speed;
                fadeElapsed += Mathf.Max(0f, deltaTime);
            }
            ApplyCurrentTime();
            return true;
        }

        private void ApplyCurrentTime()
        {
            if (currentAnimation == null || skeleton == null)
            {
                return;
            }

            var sampleTime = CurrentTime;

            if (Duration > 0f)
            {
                if (currentLoop)
                {
                    sampleTime = Mathf.Repeat(CurrentTime, Duration);
                }
                else
                {
                    sampleTime = Mathf.Clamp(CurrentTime, 0f, Duration);
                    if (CurrentTime >= Duration)
                    {
                        IsPlaying = false;
                    }
                }
            }

            SampleTime = sampleTime;
            if (nextAnimation != null)
            {
                NextSampleTime = ResolveSampleTime(nextLoop, nextTime, nextDuration);
                Suwol2DAnimationMixer.Apply(
                    skeleton,
                    currentAnimation,
                    SampleTime,
                    nextAnimation,
                    NextSampleTime,
                    TransitionProgress);
            }
            else
            {
                Suwol2DAnimationMixer.Apply(skeleton, currentAnimation, sampleTime, null, 0f, 0f);
            }
            skeleton.UpdateWorldTransforms();
            Suwol2DIkSolver.Solve(skeleton);
            skeleton.UpdateWorldTransforms();

            if (nextAnimation != null && fadeElapsed >= fadeDuration)
            {
                CompleteTransition();
            }
        }

        private static float ResolveSampleTime(bool loop, float currentTime, float duration)
        {
            var sampleTime = currentTime;
            if (duration > 0f)
            {
                sampleTime = loop
                    ? Mathf.Repeat(currentTime, duration)
                    : Mathf.Clamp(currentTime, 0f, duration);
            }

            return sampleTime;
        }

        private void CompleteTransition()
        {
            currentAnimation = nextAnimation;
            currentLoop = nextLoop;
            Duration = nextDuration;
            PreviousTime = previousNextTime;
            CurrentTime = nextTime;
            SampleTime = NextSampleTime;
            nextAnimation = null;
            nextLoop = false;
            nextTime = 0f;
            previousNextTime = 0f;
            nextDuration = 0f;
            fadeDuration = 0f;
            fadeElapsed = 0f;
        }
    }
}
