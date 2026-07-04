import type { Suwol2DDocument, Suwol2DStateMachine } from '../../../../shared/suwol2d-format';
import { getAnimationDuration } from './sampler';

export interface StateMachinePreviewState {
  machineName: string;
  isRunning: boolean;
  currentStateName: string;
  nextStateName: string;
  currentTime: number;
  nextTime: number;
  transitionElapsed: number;
  transitionDuration: number;
  boolParameters: Record<string, boolean>;
  triggers: Record<string, boolean>;
}

export function createInitialStateMachinePreview(document: Suwol2DDocument, machineName = ''): StateMachinePreviewState {
  const machine = resolveMachine(document, machineName) ?? document.stateMachines?.[0];
  const boolParameters: Record<string, boolean> = {};
  for (const parameter of machine?.parameters ?? []) {
    if (parameter.type === 'bool') {
      boolParameters[parameter.name] = parameter.defaultBool === true;
    }
  }

  return {
    machineName: machine?.name ?? machineName,
    isRunning: false,
    currentStateName: machine?.initialState ?? '',
    nextStateName: '',
    currentTime: 0,
    nextTime: 0,
    transitionElapsed: 0,
    transitionDuration: 0,
    boolParameters,
    triggers: {}
  };
}

export function stepStateMachinePreview(
  document: Suwol2DDocument,
  preview: StateMachinePreviewState,
  deltaTime: number
): StateMachinePreviewState {
  if (!preview.isRunning) {
    return preview;
  }

  const machine = resolveMachine(document, preview.machineName);
  if (!machine) {
    return { ...preview, isRunning: false };
  }

  const currentState = machine.states.find((state) => state.name === preview.currentStateName)
    ?? machine.states.find((state) => state.name === machine.initialState)
    ?? machine.states[0];
  if (!currentState) {
    return { ...preview, isRunning: false };
  }

  const nextState = preview.nextStateName ? machine.states.find((state) => state.name === preview.nextStateName) : undefined;
  const currentTime = advanceStateTime(document, currentState.animation, currentState.loop, preview.currentTime, deltaTime * safeSpeed(currentState.speed));
  const nextTime = nextState
    ? advanceStateTime(document, nextState.animation, nextState.loop, preview.nextTime, deltaTime * safeSpeed(nextState.speed))
    : 0;

  if (nextState && preview.transitionDuration > 0) {
    const elapsed = Math.min(preview.transitionDuration, preview.transitionElapsed + deltaTime);
    if (elapsed >= preview.transitionDuration) {
      return {
        ...preview,
        currentStateName: nextState.name,
        nextStateName: '',
        currentTime: nextTime,
        nextTime: 0,
        transitionElapsed: 0,
        transitionDuration: 0,
        triggers: {}
      };
    }

    return {
      ...preview,
      currentTime,
      nextTime,
      transitionElapsed: elapsed
    };
  }

  const transition = machine.transitions.find((candidate) => (
    (candidate.from === '*' || candidate.from === currentState.name) &&
    candidate.to !== currentState.name &&
    conditionsMatch(machine, preview, candidate.conditions ?? [])
  ));

  if (!transition) {
    return {
      ...preview,
      currentStateName: currentState.name,
      currentTime,
      triggers: {}
    };
  }

  const toState = machine.states.find((state) => state.name === transition.to);
  if (!toState) {
    return { ...preview, currentTime, triggers: {} };
  }

  const fadeDuration = Math.max(0, Number.isFinite(transition.fadeDuration) ? transition.fadeDuration : 0);
  if (fadeDuration <= 0) {
    return {
      ...preview,
      currentStateName: toState.name,
      nextStateName: '',
      currentTime: 0,
      nextTime: 0,
      transitionElapsed: 0,
      transitionDuration: 0,
      triggers: {}
    };
  }

  return {
    ...preview,
    currentStateName: currentState.name,
    nextStateName: toState.name,
    currentTime,
    nextTime: 0,
    transitionElapsed: 0,
    transitionDuration: fadeDuration,
    triggers: {}
  };
}

export function setPreviewBool(preview: StateMachinePreviewState, parameterName: string, value: boolean): StateMachinePreviewState {
  return {
    ...preview,
    boolParameters: {
      ...preview.boolParameters,
      [parameterName]: value
    }
  };
}

export function firePreviewTrigger(preview: StateMachinePreviewState, parameterName: string): StateMachinePreviewState {
  return {
    ...preview,
    triggers: {
      ...preview.triggers,
      [parameterName]: true
    }
  };
}

export function getPreviewTransitionProgress(preview: StateMachinePreviewState): number {
  if (!preview.nextStateName || preview.transitionDuration <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, preview.transitionElapsed / preview.transitionDuration));
}

export function resolveMachine(document: Suwol2DDocument, machineName: string): Suwol2DStateMachine | undefined {
  return (document.stateMachines ?? []).find((machine) => machine.name === machineName);
}

function conditionsMatch(
  machine: Suwol2DStateMachine,
  preview: StateMachinePreviewState,
  conditions: NonNullable<Suwol2DStateMachine['transitions'][number]['conditions']>
): boolean {
  if (conditions.length === 0) {
    return false;
  }

  const parameterTypes = new Map(machine.parameters.map((parameter) => [parameter.name, parameter.type]));
  return conditions.every((condition) => {
    const type = parameterTypes.get(condition.parameter);
    if (type === 'trigger') {
      return condition.mode === 'triggered' && preview.triggers[condition.parameter] === true;
    }
    if (type === 'bool') {
      return condition.mode === 'equals' && Boolean(preview.boolParameters[condition.parameter]) === (condition.boolValue === true);
    }
    return false;
  });
}

function advanceStateTime(document: Suwol2DDocument, animationName: string, loop: boolean, currentTime: number, deltaTime: number): number {
  const animation = document.animations.find((candidate) => candidate.name === animationName);
  const duration = getAnimationDuration(animation);
  const next = currentTime + Math.max(0, deltaTime);
  if (!animation || duration <= 0) {
    return next;
  }
  return loop ? positiveModulo(next, duration) : Math.min(next, duration);
}

function safeSpeed(speed: number): number {
  return Number.isFinite(speed) ? Math.max(0, speed) : 1;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
