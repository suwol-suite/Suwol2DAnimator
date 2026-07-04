using System.Collections.Generic;
using UnityEngine;

namespace Suwol.Suwol2D
{
    public sealed class Suwol2DStateMachineController
    {
        private const string BoolType = "bool";
        private const string TriggerType = "trigger";
        private const string EqualsMode = "equals";
        private const string TriggeredMode = "triggered";
        private const string AnyState = "*";

        private readonly Suwol2DCharacter character;
        private readonly Dictionary<string, Suwol2DStateMachineData> machinesByName = new Dictionary<string, Suwol2DStateMachineData>();
        private readonly Dictionary<string, bool> boolParameters = new Dictionary<string, bool>();
        private readonly HashSet<string> triggers = new HashSet<string>();
        private Suwol2DStateMachineData currentMachine;
        private Suwol2DStateData currentState;
        private bool running;

        public string CurrentStateName
        {
            get { return running && currentState != null ? currentState.name : string.Empty; }
        }

        public Suwol2DStateMachineController(Suwol2DCharacter character, Suwol2DStateMachineData[] machines)
        {
            this.character = character;
            if (machines == null)
            {
                return;
            }

            for (var i = 0; i < machines.Length; i++)
            {
                var machine = machines[i];
                if (machine == null || string.IsNullOrEmpty(machine.name) || machinesByName.ContainsKey(machine.name))
                {
                    continue;
                }

                machinesByName.Add(machine.name, machine);
            }
        }

        public bool HasStateMachine(string stateMachineName)
        {
            return !string.IsNullOrEmpty(stateMachineName) && machinesByName.ContainsKey(stateMachineName);
        }

        public bool Play(string stateMachineName)
        {
            Suwol2DStateMachineData machine;
            if (!machinesByName.TryGetValue(stateMachineName, out machine))
            {
                Debug.LogWarning("Suwol2D state machine not found: " + stateMachineName);
                return false;
            }

            var initialState = FindState(machine, machine.initialState);
            if (initialState == null)
            {
                Debug.LogWarning("Suwol2D state machine has no valid initial state: " + stateMachineName);
                return false;
            }

            currentMachine = machine;
            currentState = initialState;
            running = true;
            ResetParameters(machine);
            character.PlayFromStateMachine(initialState.animation, initialState.loop, initialState.speed);
            return true;
        }

        public void Stop()
        {
            running = false;
            currentMachine = null;
            currentState = null;
            triggers.Clear();
        }

        public void Tick()
        {
            if (!running || currentMachine == null || currentState == null || character == null || character.IsTransitioning())
            {
                return;
            }

            var transitions = currentMachine.transitions ?? new Suwol2DStateTransitionData[0];
            for (var i = 0; i < transitions.Length; i++)
            {
                var transition = transitions[i];
                if (transition == null)
                {
                    continue;
                }

                if (transition.from != AnyState && transition.from != currentState.name)
                {
                    continue;
                }

                if (!ConditionsMatch(transition))
                {
                    continue;
                }

                var nextState = FindState(currentMachine, transition.to);
                if (nextState == null || nextState == currentState)
                {
                    ConsumeTriggers(transition);
                    return;
                }

                ConsumeTriggers(transition);
                currentState = nextState;
                character.CrossFadeFromStateMachine(nextState.animation, Mathf.Max(0f, transition.fadeDuration), nextState.loop, nextState.speed);
                return;
            }

            triggers.Clear();
        }

        public bool SetBool(string parameterName, bool value)
        {
            if (!HasParameter(parameterName, BoolType))
            {
                Debug.LogWarning("Suwol2D bool parameter not found: " + parameterName);
                return false;
            }

            boolParameters[parameterName] = value;
            return true;
        }

        public bool SetTrigger(string parameterName)
        {
            if (!HasParameter(parameterName, TriggerType))
            {
                Debug.LogWarning("Suwol2D trigger parameter not found: " + parameterName);
                return false;
            }

            triggers.Add(parameterName);
            return true;
        }

        public void ResetTrigger(string parameterName)
        {
            triggers.Remove(parameterName);
        }

        private void ResetParameters(Suwol2DStateMachineData machine)
        {
            boolParameters.Clear();
            triggers.Clear();
            var parameters = machine.parameters ?? new Suwol2DStateParameterData[0];
            for (var i = 0; i < parameters.Length; i++)
            {
                var parameter = parameters[i];
                if (parameter != null && parameter.type == BoolType && !string.IsNullOrEmpty(parameter.name))
                {
                    boolParameters[parameter.name] = parameter.defaultBool;
                }
            }
        }

        private bool ConditionsMatch(Suwol2DStateTransitionData transition)
        {
            var conditions = transition.conditions ?? new Suwol2DTransitionConditionData[0];
            if (conditions.Length == 0)
            {
                return false;
            }

            for (var i = 0; i < conditions.Length; i++)
            {
                var condition = conditions[i];
                if (condition == null || string.IsNullOrEmpty(condition.parameter))
                {
                    return false;
                }

                var parameter = FindParameter(currentMachine, condition.parameter);
                if (parameter == null)
                {
                    return false;
                }

                if (parameter.type == TriggerType)
                {
                    if (condition.mode != TriggeredMode || !triggers.Contains(condition.parameter))
                    {
                        return false;
                    }
                    continue;
                }

                bool value;
                boolParameters.TryGetValue(condition.parameter, out value);
                if (condition.mode != EqualsMode || value != condition.boolValue)
                {
                    return false;
                }
            }

            return true;
        }

        private void ConsumeTriggers(Suwol2DStateTransitionData transition)
        {
            var conditions = transition.conditions ?? new Suwol2DTransitionConditionData[0];
            for (var i = 0; i < conditions.Length; i++)
            {
                var condition = conditions[i];
                if (condition != null && condition.mode == TriggeredMode)
                {
                    triggers.Remove(condition.parameter);
                }
            }
        }

        private bool HasParameter(string parameterName, string type)
        {
            var parameter = currentMachine != null
                ? FindParameter(currentMachine, parameterName)
                : FindParameterInAnyMachine(parameterName, type);
            return parameter != null && parameter.type == type;
        }

        private Suwol2DStateParameterData FindParameterInAnyMachine(string parameterName, string type)
        {
            foreach (var pair in machinesByName)
            {
                var parameter = FindParameter(pair.Value, parameterName);
                if (parameter != null && parameter.type == type)
                {
                    return parameter;
                }
            }

            return null;
        }

        private static Suwol2DStateData FindState(Suwol2DStateMachineData machine, string stateName)
        {
            if (machine == null || machine.states == null)
            {
                return null;
            }

            for (var i = 0; i < machine.states.Length; i++)
            {
                var state = machine.states[i];
                if (state != null && state.name == stateName)
                {
                    return state;
                }
            }

            return null;
        }

        private static Suwol2DStateParameterData FindParameter(Suwol2DStateMachineData machine, string parameterName)
        {
            if (machine == null || machine.parameters == null)
            {
                return null;
            }

            for (var i = 0; i < machine.parameters.Length; i++)
            {
                var parameter = machine.parameters[i];
                if (parameter != null && parameter.name == parameterName)
                {
                    return parameter;
                }
            }

            return null;
        }
    }
}
