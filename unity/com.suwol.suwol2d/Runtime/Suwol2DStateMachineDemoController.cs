using UnityEngine;

namespace Suwol.Suwol2D
{
    [DisallowMultipleComponent]
    public sealed class Suwol2DStateMachineDemoController : MonoBehaviour
    {
        [SerializeField] private Suwol2DCharacter character;
        [SerializeField] private string stateMachineName = "default";
        [SerializeField] private float movingToggleInterval = 1.4f;
        [SerializeField] private float attackInterval = 3.2f;
        [SerializeField] private bool logStateChanges = true;

        private float elapsed;
        private float nextMoveToggleTime;
        private float nextAttackTime;
        private string lastLoggedState = string.Empty;
        private bool moving;

        private void Awake()
        {
            if (character == null)
            {
                character = GetComponent<Suwol2DCharacter>();
            }
        }

        private void Start()
        {
            if (character == null)
            {
                Debug.LogWarning("Suwol2DStateMachineDemoController needs a Suwol2DCharacter.", this);
                return;
            }

            if (!character.PlayStateMachine(stateMachineName))
            {
                Debug.LogWarning("Could not start Suwol2D state machine demo: " + stateMachineName, this);
                return;
            }

            elapsed = 0f;
            nextMoveToggleTime = Mathf.Max(0.1f, movingToggleInterval);
            nextAttackTime = Mathf.Max(0.2f, attackInterval);
            moving = false;
            LogState();
        }

        private void Update()
        {
            if (character == null || !character.HasStateMachine(stateMachineName))
            {
                return;
            }

            elapsed += Time.deltaTime;
            if (elapsed >= nextMoveToggleTime)
            {
                moving = !moving;
                character.SetBool("moving", moving);
                nextMoveToggleTime += Mathf.Max(0.1f, movingToggleInterval);
            }

            if (elapsed >= nextAttackTime)
            {
                character.SetTrigger("attack");
                nextAttackTime += Mathf.Max(0.2f, attackInterval);
            }

            LogState();
        }

        private void LogState()
        {
            if (!logStateChanges || character == null)
            {
                return;
            }

            var current = character.GetCurrentStateName();
            if (current == lastLoggedState && !character.IsTransitioning())
            {
                return;
            }

            lastLoggedState = current;
            Debug.Log(
                "Suwol2D state=" + current +
                " animation=" + character.GetCurrentAnimationName() +
                " next=" + character.GetNextAnimationName() +
                " transition=" + character.GetTransitionProgress().ToString("0.00"),
                this);
        }
    }
}
