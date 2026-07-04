using UnityEngine;

namespace Suwol.Suwol2D
{
    [DisallowMultipleComponent]
    public sealed class Suwol2DAnimationEventLogger : MonoBehaviour
    {
        private Suwol2DCharacter character;

        private void Awake()
        {
            character = GetComponent<Suwol2DCharacter>();
            if (character != null)
            {
                character.AnimationEvent += HandleAnimationEvent;
            }
        }

        private void OnDestroy()
        {
            if (character != null)
            {
                character.AnimationEvent -= HandleAnimationEvent;
            }
        }

        private void HandleAnimationEvent(Suwol2DAnimationEvent animationEvent)
        {
            Debug.Log(
                "Suwol2D Event " +
                animationEvent.AnimationName +
                ":" +
                animationEvent.EventName +
                " " +
                animationEvent.StringValue,
                this);
        }
    }
}
