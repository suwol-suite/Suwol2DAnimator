using System;
using System.Collections.Generic;
using System.Text;
using UnityEngine;

namespace Suwol.Suwol2D
{
    [DisallowMultipleComponent]
    public sealed class Suwol2DCharacter : MonoBehaviour
    {
        [SerializeField] private TextAsset jsonAsset;
        [SerializeField] private Texture2D[] textures = new Texture2D[0];
        [SerializeField] private Material defaultMaterial;
        [SerializeField] private bool playOnAwake = true;
        [SerializeField] private string initialAnimation = "idle";
        [SerializeField] private float animationSpeed = 1f;

        private readonly Suwol2DRegionRenderer regionRenderer = new Suwol2DRegionRenderer();
        private readonly Suwol2DMeshAttachmentRenderer meshAttachmentRenderer = new Suwol2DMeshAttachmentRenderer();
        private readonly Dictionary<string, string> attachmentOverrides = new Dictionary<string, string>();
        private readonly Dictionary<string, int> drawOrders = new Dictionary<string, int>();
        private readonly Dictionary<string, Color> slotColors = new Dictionary<string, Color>();
        private readonly Suwol2DEventTimelineDispatcher eventDispatcher = new Suwol2DEventTimelineDispatcher();
        private Suwol2DSkeleton skeleton;
        private Suwol2DSkinResolver skinResolver;
        private Suwol2DAnimationPlayer animationPlayer;
        private Suwol2DStateMachineController stateMachineController;
        private string attachmentSignature = string.Empty;

        public event Action<Suwol2DAnimationEvent> AnimationEvent;

        public Suwol2DSkeleton Skeleton
        {
            get { return skeleton; }
        }

        public Suwol2DSkinResolver SkinResolver
        {
            get { return skinResolver; }
        }

        private void Awake()
        {
            if (jsonAsset != null)
            {
                Load(jsonAsset);
            }
            else
            {
                Debug.LogWarning("Suwol2DCharacter has no jsonAsset assigned. Assign a .suwol2d.json TextAsset before entering Play Mode.", this);
            }

            if (playOnAwake && animationPlayer != null && !string.IsNullOrEmpty(initialAnimation))
            {
                Play(initialAnimation);
            }
        }

        private void Update()
        {
            if (animationPlayer == null)
            {
                return;
            }

            // v10 runtime order: time/mixer sampling -> world transforms -> IK -> world recalc,
            // then attachment/skin resolution, draw order, colors, deform, renderer sync, events, and state transitions.
            if (animationPlayer.Tick(Time.deltaTime))
            {
                ApplySampledRuntimeState(true);
                UpdateRenderers();
                eventDispatcher.Dispatch(
                    animationPlayer.EventAnimation,
                    animationPlayer.EventPreviousTime,
                    animationPlayer.EventCurrentTime,
                    animationPlayer.EventDuration,
                    DispatchAnimationEvent);
                if (stateMachineController != null)
                {
                    stateMachineController.Tick();
                }
            }
        }

        private void OnDestroy()
        {
            regionRenderer.Clear();
            meshAttachmentRenderer.Clear();
        }

        public void Load(TextAsset asset)
        {
            jsonAsset = asset;
            if (jsonAsset == null)
            {
                ResetRuntimeState();
                Debug.LogWarning("Suwol2DCharacter.Load received a null TextAsset.", this);
                return;
            }

            LoadFromJson(jsonAsset.text);
        }

        public void LoadFromJson(string json)
        {
            Stop();
            ResetRuntimeState();

            if (string.IsNullOrEmpty(json))
            {
                Debug.LogWarning("Suwol2DCharacter.LoadFromJson received empty JSON.", this);
                return;
            }

            Suwol2DAssetData data;
            try
            {
                data = UnityEngine.JsonUtility.FromJson<Suwol2DAssetData>(json);
            }
            catch (System.Exception exception)
            {
                Debug.LogError("Suwol2DCharacter failed to parse JSON: " + exception.Message, this);
                return;
            }

            LoadFromData(data);
        }

        public void LoadFromData(Suwol2DAssetData data)
        {
            Stop();
            ResetRuntimeState();

            if (data == null)
            {
                Debug.LogError("Suwol2DCharacter.LoadFromData received null data.", this);
                return;
            }

            string validationError;
            if (!ValidateDataForRuntime(data, out validationError))
            {
                Debug.LogError("Suwol2DCharacter data is invalid: " + validationError, this);
                return;
            }

            try
            {
                skeleton = Suwol2DSkeleton.FromData(data);
            }
            catch (System.Exception exception)
            {
                ResetRuntimeState();
                Debug.LogError("Suwol2DCharacter failed to build runtime skeleton: " + exception.Message, this);
                return;
            }

            skinResolver = new Suwol2DSkinResolver(skeleton, data.skins);
            animationPlayer = new Suwol2DAnimationPlayer(skeleton);
            animationPlayer.SetAnimationSpeed(animationSpeed);
            stateMachineController = new Suwol2DStateMachineController(this, data.stateMachines);

            RebuildRenderers();
        }

        public void Play(string animationName)
        {
            StopStateMachineControl();
            PlayInternal(animationName);
        }

        public void Play(string animationName, float fadeDuration)
        {
            StopStateMachineControl();
            if (fadeDuration <= 0f)
            {
                PlayInternal(animationName);
                return;
            }

            CrossFadeInternal(animationName, fadeDuration);
        }

        public bool CrossFade(string animationName, float fadeDuration)
        {
            StopStateMachineControl();
            return CrossFadeInternal(animationName, fadeDuration);
        }

        internal void PlayFromStateMachine(string animationName, bool loop, float speed)
        {
            SetAnimationSpeed(speed);
            PlayInternal(animationName, loop);
        }

        internal bool CrossFadeFromStateMachine(string animationName, float fadeDuration, bool loop, float speed)
        {
            SetAnimationSpeed(speed);
            return CrossFadeInternal(animationName, fadeDuration, loop);
        }

        private void StopStateMachineControl()
        {
            if (stateMachineController != null)
            {
                stateMachineController.Stop();
            }
        }

        private void PlayInternal(string animationName)
        {
            PlayInternal(animationName, null);
        }

        private void PlayInternal(string animationName, bool? loopOverride)
        {
            if (string.IsNullOrEmpty(animationName))
            {
                Debug.LogWarning("Suwol2DCharacter.Play was called with an empty animation name.", this);
                return;
            }

            if (animationPlayer == null)
            {
                Debug.LogWarning("Suwol2DCharacter has no loaded skeleton. Load a .suwol2d.json TextAsset first.", this);
                return;
            }

            var played = loopOverride.HasValue
                ? animationPlayer.Play(animationName, loopOverride.Value)
                : animationPlayer.Play(animationName);
            if (played)
            {
                eventDispatcher.Reset(animationName);
                ApplySampledRuntimeState(true);
                UpdateRenderers();
            }
        }

        private bool CrossFadeInternal(string animationName, float fadeDuration)
        {
            return CrossFadeInternal(animationName, fadeDuration, null);
        }

        private bool CrossFadeInternal(string animationName, float fadeDuration, bool? loopOverride)
        {
            if (string.IsNullOrEmpty(animationName))
            {
                Debug.LogWarning("Suwol2DCharacter.CrossFade was called with an empty animation name.", this);
                return false;
            }

            if (animationPlayer == null)
            {
                Debug.LogWarning("Suwol2DCharacter has no loaded skeleton. Load a .suwol2d.json TextAsset first.", this);
                return false;
            }

            if (fadeDuration <= 0f)
            {
                PlayInternal(animationName, loopOverride);
                return HasAnimation(animationName);
            }

            var started = loopOverride.HasValue
                ? animationPlayer.CrossFade(animationName, fadeDuration, loopOverride.Value)
                : animationPlayer.CrossFade(animationName, fadeDuration);
            if (started)
            {
                eventDispatcher.Reset(animationName);
                ApplySampledRuntimeState(true);
                UpdateRenderers();
                return true;
            }

            return false;
        }

        public void Stop()
        {
            if (animationPlayer != null)
            {
                animationPlayer.Stop();
            }
            eventDispatcher.Stop();
            if (stateMachineController != null)
            {
                stateMachineController.Stop();
            }
        }

        public void SetAnimationSpeed(float speed)
        {
            animationSpeed = Mathf.Max(0f, speed);
            if (animationPlayer != null)
            {
                animationPlayer.SetAnimationSpeed(animationSpeed);
            }
        }

        public bool HasAnimation(string animationName)
        {
            return skeleton != null && skeleton.HasAnimation(animationName);
        }

        public bool IsTransitioning()
        {
            return animationPlayer != null && animationPlayer.IsTransitioning;
        }

        public string GetCurrentAnimationName()
        {
            return animationPlayer != null ? animationPlayer.CurrentAnimationName : string.Empty;
        }

        public string GetNextAnimationName()
        {
            return animationPlayer != null ? animationPlayer.NextAnimationName : string.Empty;
        }

        public float GetTransitionProgress()
        {
            return animationPlayer != null ? animationPlayer.TransitionProgress : 0f;
        }

        public bool HasStateMachine(string stateMachineName)
        {
            return stateMachineController != null && stateMachineController.HasStateMachine(stateMachineName);
        }

        public bool PlayStateMachine(string stateMachineName)
        {
            return stateMachineController != null && stateMachineController.Play(stateMachineName);
        }

        public string GetCurrentStateName()
        {
            return stateMachineController != null ? stateMachineController.CurrentStateName : string.Empty;
        }

        public bool SetBool(string parameterName, bool value)
        {
            return stateMachineController != null && stateMachineController.SetBool(parameterName, value);
        }

        public bool SetTrigger(string parameterName)
        {
            return stateMachineController != null && stateMachineController.SetTrigger(parameterName);
        }

        public void ResetTrigger(string parameterName)
        {
            if (stateMachineController != null)
            {
                stateMachineController.ResetTrigger(parameterName);
            }
        }

        public bool HasSkin(string skinName)
        {
            return skinResolver != null && skinResolver.HasSkin(skinName);
        }

        public string GetCurrentSkin()
        {
            return skinResolver != null ? skinResolver.GetCurrentSkin() : string.Empty;
        }

        public bool SetSkin(string skinName)
        {
            if (skinResolver == null)
            {
                Debug.LogWarning("Suwol2DCharacter has no loaded skin resolver. Load a .suwol2d.json TextAsset first.", this);
                return false;
            }

            if (!skinResolver.SetSkin(skinName))
            {
                return false;
            }

            SyncRenderers();
            UpdateRenderers();
            return true;
        }

        public bool SetAttachment(string slotName, string attachmentName)
        {
            if (skinResolver == null)
            {
                Debug.LogWarning("Suwol2DCharacter has no loaded skin resolver. Load a .suwol2d.json TextAsset first.", this);
                return false;
            }

            if (!skinResolver.SetAttachment(slotName, attachmentName))
            {
                return false;
            }

            SyncRenderers();
            UpdateRenderers();
            return true;
        }

        public void ResetAttachments()
        {
            if (skinResolver == null)
            {
                return;
            }

            skinResolver.ResetAttachments();
            SyncRenderers();
            UpdateRenderers();
        }

        private void ApplySampledRuntimeState(bool rebuildOnAttachmentChange)
        {
            if (skeleton == null || skinResolver == null)
            {
                return;
            }

            var animation = animationPlayer != null ? animationPlayer.DiscreteAnimation : null;
            var time = animationPlayer != null ? animationPlayer.DiscreteSampleTime : 0f;
            var fromAnimation = animationPlayer != null ? animationPlayer.CurrentAnimation : null;
            var fromTime = animationPlayer != null ? animationPlayer.SampleTime : 0f;
            var toAnimation = animationPlayer != null ? animationPlayer.NextAnimation : null;
            var toTime = animationPlayer != null ? animationPlayer.NextSampleTime : 0f;
            var transitionWeight = animationPlayer != null ? animationPlayer.TransitionProgress : 0f;

            Suwol2DAttachmentTimelineSampler.Sample(animation, time, attachmentOverrides);
            skinResolver.SetAnimationAttachmentOverrides(attachmentOverrides);
            Suwol2DDrawOrderTimelineSampler.Sample(skeleton, animation, time, drawOrders);
            Suwol2DAnimationMixer.SampleSlotColors(fromAnimation, fromTime, toAnimation, toTime, transitionWeight, slotColors);

            var nextSignature = CreateAttachmentSignature();
            if (rebuildOnAttachmentChange && nextSignature != attachmentSignature)
            {
                SyncRenderers();
                return;
            }

            attachmentSignature = nextSignature;
        }

        private void UpdateRenderers()
        {
            var animation = animationPlayer != null ? animationPlayer.CurrentAnimation : null;
            var time = animationPlayer != null ? animationPlayer.SampleTime : 0f;
            var nextAnimation = animationPlayer != null ? animationPlayer.NextAnimation : null;
            var nextTime = animationPlayer != null ? animationPlayer.NextSampleTime : 0f;
            var transitionWeight = animationPlayer != null ? animationPlayer.TransitionProgress : 0f;

            regionRenderer.ApplyDrawOrder(drawOrders);
            meshAttachmentRenderer.ApplyDrawOrder(drawOrders);
            regionRenderer.ApplySlotColors(slotColors);
            meshAttachmentRenderer.ApplySlotColors(slotColors);
            regionRenderer.UpdatePose();
            meshAttachmentRenderer.UpdatePose(animation, time, nextAnimation, nextTime, transitionWeight);
        }

        private void RebuildRenderers()
        {
            regionRenderer.Clear();
            meshAttachmentRenderer.Clear();
            SyncRenderers();
            UpdateRenderers();
        }

        private void SyncRenderers()
        {
            if (skeleton == null)
            {
                return;
            }

            regionRenderer.Sync(skeleton, transform, textures, defaultMaterial, skinResolver);
            meshAttachmentRenderer.Sync(skeleton, transform, textures, defaultMaterial, skinResolver);
            attachmentSignature = CreateAttachmentSignature();
        }

        private void ResetRuntimeState()
        {
            regionRenderer.Clear();
            meshAttachmentRenderer.Clear();
            attachmentOverrides.Clear();
            drawOrders.Clear();
            slotColors.Clear();
            attachmentSignature = string.Empty;
            skeleton = null;
            skinResolver = null;
            animationPlayer = null;
            stateMachineController = null;
            eventDispatcher.Reset(string.Empty);
        }

        private string CreateAttachmentSignature()
        {
            if (skeleton == null || skinResolver == null)
            {
                return string.Empty;
            }

            var builder = new StringBuilder();
            builder.Append("skin=");
            builder.Append(skinResolver.GetCurrentSkin());
            builder.Append(';');

            var slots = skeleton.Slots;
            for (var i = 0; i < slots.Count; i++)
            {
                var slot = slots[i];
                var attachment = skinResolver.ResolveAttachment(slot);
                builder.Append(slot.Name);
                builder.Append('=');
                if (attachment == null)
                {
                    builder.Append("<hidden>");
                }
                else
                {
                    builder.Append(attachment.Name);
                    builder.Append('|');
                    builder.Append(attachment.Type);
                    builder.Append('|');
                    builder.Append(attachment.Image);
                }
                builder.Append(';');
            }

            return builder.ToString();
        }

        private static bool ValidateDataForRuntime(Suwol2DAssetData data, out string error)
        {
            var errors = new List<string>();
            if (data == null)
            {
                error = "Data is null.";
                return false;
            }

            if (data.version != 0)
            {
                errors.Add("Unsupported version " + data.version + ".");
            }

            var boneNames = new HashSet<string>();
            if (data.bones == null || data.bones.Length == 0)
            {
                errors.Add("Document has no bones.");
            }
            else
            {
                for (var i = 0; i < data.bones.Length; i++)
                {
                    var bone = data.bones[i];
                    if (bone == null || string.IsNullOrEmpty(bone.name))
                    {
                        errors.Add("Bone has an empty name.");
                        continue;
                    }

                    if (!boneNames.Add(bone.name))
                    {
                        errors.Add("Duplicate bone name '" + bone.name + "'.");
                    }

                    if (!IsFinite(bone.x) || !IsFinite(bone.y) || !IsFinite(bone.rotation) ||
                        !IsFinite(bone.scaleX) || !IsFinite(bone.scaleY) || !IsFinite(bone.length))
                    {
                        errors.Add("Bone '" + bone.name + "' contains a non-finite transform value.");
                    }
                }

                for (var i = 0; i < data.bones.Length; i++)
                {
                    var bone = data.bones[i];
                    if (bone == null || string.IsNullOrEmpty(bone.parent))
                    {
                        continue;
                    }

                    if (!boneNames.Contains(bone.parent))
                    {
                        errors.Add("Bone '" + bone.name + "' references missing parent '" + bone.parent + "'.");
                    }
                }
            }

            var slotNames = new HashSet<string>();
            if (data.slots == null || data.slots.Length == 0)
            {
                errors.Add("Document has no slots.");
            }
            else
            {
                for (var i = 0; i < data.slots.Length; i++)
                {
                    var slot = data.slots[i];
                    if (slot == null || string.IsNullOrEmpty(slot.name))
                    {
                        errors.Add("Slot has an empty name.");
                        continue;
                    }

                    if (!slotNames.Add(slot.name))
                    {
                        errors.Add("Duplicate slot name '" + slot.name + "'.");
                    }

                    if (!boneNames.Contains(slot.bone))
                    {
                        errors.Add("Slot '" + slot.name + "' references missing bone '" + slot.bone + "'.");
                    }
                }
            }

            if (data.skins == null || data.skins.Length == 0)
            {
                errors.Add("Document has no skins.");
            }
            else
            {
                var hasDefaultSkin = false;
                var skinNames = new HashSet<string>();
                for (var i = 0; i < data.skins.Length; i++)
                {
                    var skin = data.skins[i];
                    if (skin == null || string.IsNullOrEmpty(skin.name))
                    {
                        errors.Add("Skin has an empty name.");
                        continue;
                    }

                    if (!skinNames.Add(skin.name))
                    {
                        errors.Add("Duplicate skin name '" + skin.name + "'.");
                    }

                    if (skin.name == "default")
                    {
                        hasDefaultSkin = true;
                    }
                }

                if (!hasDefaultSkin)
                {
                    errors.Add("Document is missing the required default skin.");
                }
            }

            var attachments = CollectAttachmentData(data);
            var attachmentNames = new HashSet<string>();
            for (var i = 0; i < attachments.Count; i++)
            {
                var attachment = attachments[i];
                if (attachment == null || string.IsNullOrEmpty(attachment.name))
                {
                    errors.Add("Attachment has an empty name.");
                    continue;
                }

                attachmentNames.Add(attachment.name);
                if (!slotNames.Contains(attachment.slot))
                {
                    errors.Add("Attachment '" + attachment.name + "' references missing slot '" + attachment.slot + "'.");
                }

                var type = string.IsNullOrEmpty(attachment.type) ? Suwol2DAttachment.RegionType : attachment.type;
                if (type != Suwol2DAttachment.RegionType && type != Suwol2DAttachment.MeshType)
                {
                    errors.Add("Attachment '" + attachment.name + "' has unsupported type '" + attachment.type + "'.");
                    continue;
                }

                if (!IsFinite(attachment.x) || !IsFinite(attachment.y) || !IsFinite(attachment.rotation) ||
                    !IsFinite(attachment.width) || !IsFinite(attachment.height) ||
                    !IsFinite(attachment.scaleX) || !IsFinite(attachment.scaleY))
                {
                    errors.Add("Attachment '" + attachment.name + "' contains a non-finite transform value.");
                }

                if (type == Suwol2DAttachment.MeshType && !ValidateMeshAttachmentForRuntime(attachment, boneNames, errors))
                {
                    continue;
                }
            }

            if (data.slots != null)
            {
                for (var i = 0; i < data.slots.Length; i++)
                {
                    var slot = data.slots[i];
                    if (slot == null || string.IsNullOrEmpty(slot.attachment))
                    {
                        continue;
                    }

                    if (!attachmentNames.Contains(slot.attachment))
                    {
                        errors.Add("Slot '" + slot.name + "' references missing setup attachment '" + slot.attachment + "'.");
                    }
                }
            }

            ValidateRuntimeAnimations(data, boneNames, slotNames, attachmentNames, errors);
            ValidateStateMachinesForRuntime(data, CollectRuntimeAnimationNames(data), errors);

            error = string.Join(" ", errors.ToArray());
            return errors.Count == 0;
        }

        private static List<Suwol2DAttachmentData> CollectAttachmentData(Suwol2DAssetData data)
        {
            var attachments = new List<Suwol2DAttachmentData>();
            if (data == null)
            {
                return attachments;
            }

            if (data.attachments != null)
            {
                attachments.AddRange(data.attachments);
            }

            if (data.skins != null)
            {
                for (var i = 0; i < data.skins.Length; i++)
                {
                    var skin = data.skins[i];
                    if (skin != null && skin.attachments != null)
                    {
                        attachments.AddRange(skin.attachments);
                    }
                }
            }

            return attachments;
        }

        private static bool ValidateMeshAttachmentForRuntime(
            Suwol2DAttachmentData attachment,
            HashSet<string> boneNames,
            List<string> errors)
        {
            var valid = true;
            var vertices = attachment.vertices ?? new Suwol2DMeshVertexData[0];
            var triangles = attachment.triangles ?? new int[0];
            if (vertices.Length < 3)
            {
                errors.Add("Mesh attachment '" + attachment.name + "' needs at least 3 vertices.");
                valid = false;
            }

            if (triangles.Length == 0 || triangles.Length % 3 != 0)
            {
                errors.Add("Mesh attachment '" + attachment.name + "' triangle count must be a non-empty multiple of 3.");
                valid = false;
            }

            for (var i = 0; i < vertices.Length; i++)
            {
                var vertex = vertices[i];
                if (vertex == null || !IsFinite(vertex.x) || !IsFinite(vertex.y) || !IsFinite(vertex.u) || !IsFinite(vertex.v))
                {
                    errors.Add("Mesh attachment '" + attachment.name + "' has a non-finite vertex.");
                    valid = false;
                    break;
                }
            }

            for (var i = 0; i < triangles.Length; i++)
            {
                var index = triangles[i];
                if (index < 0 || index >= vertices.Length)
                {
                    errors.Add("Mesh attachment '" + attachment.name + "' has a triangle index outside vertex range.");
                    valid = false;
                    break;
                }
            }

            var weights = attachment.weights ?? new Suwol2DVertexWeightData[0];
            for (var i = 0; i < weights.Length; i++)
            {
                var vertexWeight = weights[i];
                if (vertexWeight == null || vertexWeight.vertex < 0 || vertexWeight.vertex >= vertices.Length)
                {
                    errors.Add("Mesh attachment '" + attachment.name + "' has a weight for a missing vertex.");
                    valid = false;
                    continue;
                }

                var bones = vertexWeight.bones ?? new Suwol2DBoneWeightData[0];
                for (var boneIndex = 0; boneIndex < bones.Length; boneIndex++)
                {
                    var boneWeight = bones[boneIndex];
                    if (boneWeight == null)
                    {
                        continue;
                    }

                    if (!string.IsNullOrEmpty(boneWeight.bone) && !boneNames.Contains(boneWeight.bone))
                    {
                        errors.Add("Mesh attachment '" + attachment.name + "' references missing weight bone '" + boneWeight.bone + "'.");
                        valid = false;
                    }

                    if (!IsFinite(boneWeight.weight))
                    {
                        errors.Add("Mesh attachment '" + attachment.name + "' has a non-finite weight.");
                        valid = false;
                    }
                }
            }

            return valid;
        }

        private static HashSet<string> CollectRuntimeAnimationNames(Suwol2DAssetData data)
        {
            var names = new HashSet<string>();
            if (data == null || data.animations == null)
            {
                return names;
            }

            for (var i = 0; i < data.animations.Length; i++)
            {
                var animation = data.animations[i];
                if (animation != null && !string.IsNullOrEmpty(animation.name))
                {
                    names.Add(animation.name);
                }
            }

            return names;
        }

        private static void ValidateStateMachinesForRuntime(
            Suwol2DAssetData data,
            HashSet<string> animationNames,
            List<string> errors)
        {
            if (data == null || data.stateMachines == null)
            {
                return;
            }

            var machineNames = new HashSet<string>();
            for (var machineIndex = 0; machineIndex < data.stateMachines.Length; machineIndex++)
            {
                var machine = data.stateMachines[machineIndex];
                if (machine == null || string.IsNullOrEmpty(machine.name))
                {
                    errors.Add("State machine has an empty name.");
                    continue;
                }

                if (!machineNames.Add(machine.name))
                {
                    errors.Add("Duplicate state machine name '" + machine.name + "'.");
                }

                var stateNames = new HashSet<string>();
                var states = machine.states ?? new Suwol2DStateData[0];
                for (var stateIndex = 0; stateIndex < states.Length; stateIndex++)
                {
                    var state = states[stateIndex];
                    if (state == null || string.IsNullOrEmpty(state.name))
                    {
                        errors.Add("State machine '" + machine.name + "' has a state with an empty name.");
                        continue;
                    }

                    if (!stateNames.Add(state.name))
                    {
                        errors.Add("State machine '" + machine.name + "' has duplicate state '" + state.name + "'.");
                    }

                    if (!animationNames.Contains(state.animation))
                    {
                        errors.Add("State machine '" + machine.name + "' state '" + state.name + "' references missing animation '" + state.animation + "'.");
                    }

                    if (!IsFinite(state.speed))
                    {
                        errors.Add("State machine '" + machine.name + "' state '" + state.name + "' has a non-finite speed.");
                    }
                }

                if (!stateNames.Contains(machine.initialState))
                {
                    errors.Add("State machine '" + machine.name + "' initialState '" + machine.initialState + "' does not exist.");
                }

                var parameterTypes = new Dictionary<string, string>();
                var parameters = machine.parameters ?? new Suwol2DStateParameterData[0];
                for (var parameterIndex = 0; parameterIndex < parameters.Length; parameterIndex++)
                {
                    var parameter = parameters[parameterIndex];
                    if (parameter == null || string.IsNullOrEmpty(parameter.name))
                    {
                        errors.Add("State machine '" + machine.name + "' has a parameter with an empty name.");
                        continue;
                    }

                    if (parameterTypes.ContainsKey(parameter.name))
                    {
                        errors.Add("State machine '" + machine.name + "' has duplicate parameter '" + parameter.name + "'.");
                    }
                    else
                    {
                        parameterTypes.Add(parameter.name, parameter.type);
                    }

                    if (parameter.type != "bool" && parameter.type != "trigger")
                    {
                        errors.Add("State machine '" + machine.name + "' parameter '" + parameter.name + "' has unsupported type '" + parameter.type + "'.");
                    }
                }

                var transitions = machine.transitions ?? new Suwol2DStateTransitionData[0];
                for (var transitionIndex = 0; transitionIndex < transitions.Length; transitionIndex++)
                {
                    var transition = transitions[transitionIndex];
                    if (transition == null)
                    {
                        continue;
                    }

                    if (transition.from != "*" && !stateNames.Contains(transition.from))
                    {
                        errors.Add("State machine '" + machine.name + "' transition from '" + transition.from + "' does not exist.");
                    }

                    if (!stateNames.Contains(transition.to))
                    {
                        errors.Add("State machine '" + machine.name + "' transition to '" + transition.to + "' does not exist.");
                    }

                    if (!IsFinite(transition.fadeDuration) || transition.fadeDuration < 0f)
                    {
                        errors.Add("State machine '" + machine.name + "' transition '" + transition.from + "' -> '" + transition.to + "' has invalid fadeDuration.");
                    }

                    var conditions = transition.conditions ?? new Suwol2DTransitionConditionData[0];
                    for (var conditionIndex = 0; conditionIndex < conditions.Length; conditionIndex++)
                    {
                        var condition = conditions[conditionIndex];
                        if (condition == null || string.IsNullOrEmpty(condition.parameter))
                        {
                            errors.Add("State machine '" + machine.name + "' transition '" + transition.from + "' -> '" + transition.to + "' has an empty condition parameter.");
                            continue;
                        }

                        string parameterType;
                        if (!parameterTypes.TryGetValue(condition.parameter, out parameterType))
                        {
                            errors.Add("State machine '" + machine.name + "' transition '" + transition.from + "' -> '" + transition.to + "' references missing parameter '" + condition.parameter + "'.");
                            continue;
                        }

                        if (condition.mode != "equals" && condition.mode != "triggered")
                        {
                            errors.Add("State machine '" + machine.name + "' condition on '" + condition.parameter + "' has unsupported mode '" + condition.mode + "'.");
                        }

                        if (parameterType == "trigger" && condition.mode == "equals")
                        {
                            errors.Add("State machine '" + machine.name + "' trigger parameter '" + condition.parameter + "' cannot use equals condition.");
                        }

                        if (parameterType == "bool" && condition.mode == "triggered")
                        {
                            errors.Add("State machine '" + machine.name + "' bool parameter '" + condition.parameter + "' cannot use triggered condition.");
                        }
                    }
                }
            }
        }

        private static void ValidateRuntimeAnimations(
            Suwol2DAssetData data,
            HashSet<string> boneNames,
            HashSet<string> slotNames,
            HashSet<string> attachmentNames,
            List<string> errors)
        {
            if (data.animations == null)
            {
                return;
            }

            var animationNames = new HashSet<string>();
            for (var i = 0; i < data.animations.Length; i++)
            {
                var animation = data.animations[i];
                if (animation == null || string.IsNullOrEmpty(animation.name))
                {
                    errors.Add("Animation has an empty name.");
                    continue;
                }

                if (!animationNames.Add(animation.name))
                {
                    errors.Add("Duplicate animation name '" + animation.name + "'.");
                }

                if (!IsFinite(animation.duration) || animation.duration < 0f)
                {
                    errors.Add("Animation '" + animation.name + "' has invalid duration.");
                }

                ValidateBoneTimelines(animation, boneNames, errors);
                ValidateAttachmentTimelines(animation, slotNames, attachmentNames, errors);
                ValidateDrawOrderTimelines(animation, slotNames, errors);
                ValidateSlotColorTimelines(animation, slotNames, errors);
                ValidateDeformTimelines(animation, slotNames, attachmentNames, errors);
                ValidateEventTimelines(animation, errors);
            }
        }

        private static void ValidateBoneTimelines(Suwol2DAnimationData animation, HashSet<string> boneNames, List<string> errors)
        {
            if (animation.bones == null)
            {
                return;
            }

            for (var i = 0; i < animation.bones.Length; i++)
            {
                var timeline = animation.bones[i];
                if (timeline == null)
                {
                    continue;
                }

                if (!boneNames.Contains(timeline.bone))
                {
                    errors.Add("Animation '" + animation.name + "' references missing bone '" + timeline.bone + "'.");
                }

                ValidateKeyTimes(animation.name + "/" + timeline.bone + "/translate", timeline.translate, errors);
                ValidateKeyTimes(animation.name + "/" + timeline.bone + "/rotate", timeline.rotate, errors);
                ValidateKeyTimes(animation.name + "/" + timeline.bone + "/scale", timeline.scale, errors);
            }
        }

        private static void ValidateAttachmentTimelines(
            Suwol2DAnimationData animation,
            HashSet<string> slotNames,
            HashSet<string> attachmentNames,
            List<string> errors)
        {
            if (animation.attachments == null)
            {
                return;
            }

            for (var i = 0; i < animation.attachments.Length; i++)
            {
                var timeline = animation.attachments[i];
                if (timeline == null)
                {
                    continue;
                }

                if (!slotNames.Contains(timeline.slot))
                {
                    errors.Add("Animation '" + animation.name + "' attachment timeline references missing slot '" + timeline.slot + "'.");
                }

                var previous = -1f;
                var keys = timeline.keys ?? new Suwol2DAttachmentKeyData[0];
                for (var keyIndex = 0; keyIndex < keys.Length; keyIndex++)
                {
                    var key = keys[keyIndex];
                    if (key == null)
                    {
                        continue;
                    }

                    ValidateSortedTime(animation.name + "/" + timeline.slot + "/attachment", key.time, ref previous, errors);
                    if (!string.IsNullOrEmpty(key.attachment) && !attachmentNames.Contains(key.attachment))
                    {
                        errors.Add("Animation '" + animation.name + "' attachment key references missing attachment '" + key.attachment + "'.");
                    }
                }
            }
        }

        private static void ValidateDrawOrderTimelines(Suwol2DAnimationData animation, HashSet<string> slotNames, List<string> errors)
        {
            if (animation.drawOrders == null)
            {
                return;
            }

            var previous = -1f;
            for (var i = 0; i < animation.drawOrders.Length; i++)
            {
                var key = animation.drawOrders[i];
                if (key == null)
                {
                    continue;
                }

                ValidateSortedTime(animation.name + "/drawOrder", key.time, ref previous, errors);
                var slots = key.slots ?? new Suwol2DDrawOrderSlotData[0];
                for (var slotIndex = 0; slotIndex < slots.Length; slotIndex++)
                {
                    var slot = slots[slotIndex];
                    if (slot != null && !slotNames.Contains(slot.slot))
                    {
                        errors.Add("Animation '" + animation.name + "' draw order references missing slot '" + slot.slot + "'.");
                    }
                }
            }
        }

        private static void ValidateSlotColorTimelines(Suwol2DAnimationData animation, HashSet<string> slotNames, List<string> errors)
        {
            if (animation.slots == null)
            {
                return;
            }

            for (var i = 0; i < animation.slots.Length; i++)
            {
                var timeline = animation.slots[i];
                if (timeline == null)
                {
                    continue;
                }

                if (!slotNames.Contains(timeline.slot))
                {
                    errors.Add("Animation '" + animation.name + "' slot color timeline references missing slot '" + timeline.slot + "'.");
                }

                var previous = -1f;
                var keys = timeline.color ?? new Suwol2DSlotColorKeyData[0];
                for (var keyIndex = 0; keyIndex < keys.Length; keyIndex++)
                {
                    var key = keys[keyIndex];
                    if (key == null)
                    {
                        continue;
                    }

                    ValidateSortedTime(animation.name + "/" + timeline.slot + "/color", key.time, ref previous, errors);
                    if (!IsFinite(key.r) || !IsFinite(key.g) || !IsFinite(key.b) || !IsFinite(key.a))
                    {
                        errors.Add("Animation '" + animation.name + "' slot color key contains a non-finite value.");
                    }
                }
            }
        }

        private static void ValidateDeformTimelines(
            Suwol2DAnimationData animation,
            HashSet<string> slotNames,
            HashSet<string> attachmentNames,
            List<string> errors)
        {
            if (animation.deforms == null)
            {
                return;
            }

            for (var i = 0; i < animation.deforms.Length; i++)
            {
                var deform = animation.deforms[i];
                if (deform == null)
                {
                    continue;
                }

                if (!slotNames.Contains(deform.slot))
                {
                    errors.Add("Animation '" + animation.name + "' deform references missing slot '" + deform.slot + "'.");
                }

                if (!attachmentNames.Contains(deform.attachment))
                {
                    errors.Add("Animation '" + animation.name + "' deform references missing attachment '" + deform.attachment + "'.");
                }

                var previous = -1f;
                var keys = deform.keys ?? new Suwol2DDeformKeyData[0];
                for (var keyIndex = 0; keyIndex < keys.Length; keyIndex++)
                {
                    var key = keys[keyIndex];
                    if (key == null)
                    {
                        continue;
                    }

                    ValidateSortedTime(animation.name + "/" + deform.attachment + "/deform", key.time, ref previous, errors);
                    var offsets = key.offsets ?? new Suwol2DVertexOffsetData[0];
                    for (var offsetIndex = 0; offsetIndex < offsets.Length; offsetIndex++)
                    {
                        var offset = offsets[offsetIndex];
                        if (offset != null && (!IsFinite(offset.x) || !IsFinite(offset.y)))
                        {
                            errors.Add("Animation '" + animation.name + "' deform offset contains a non-finite value.");
                        }
                    }
                }
            }
        }

        private static void ValidateEventTimelines(Suwol2DAnimationData animation, List<string> errors)
        {
            if (animation.events == null)
            {
                return;
            }

            var previous = -1f;
            for (var i = 0; i < animation.events.Length; i++)
            {
                var key = animation.events[i];
                if (key == null)
                {
                    continue;
                }

                ValidateSortedTime(animation.name + "/events", key.time, ref previous, errors);
                if (!IsFinite(key.floatValue))
                {
                    errors.Add("Animation '" + animation.name + "' event key contains a non-finite float value.");
                }
            }
        }

        private static void ValidateKeyTimes(string label, Suwol2DTranslateKey[] keys, List<string> errors)
        {
            var previous = -1f;
            if (keys == null)
            {
                return;
            }

            for (var i = 0; i < keys.Length; i++)
            {
                var key = keys[i];
                if (key == null)
                {
                    continue;
                }

                ValidateSortedTime(label, key.time, ref previous, errors);
                if (!IsFinite(key.x) || !IsFinite(key.y))
                {
                    errors.Add("Timeline '" + label + "' contains a non-finite value.");
                }
            }
        }

        private static void ValidateKeyTimes(string label, Suwol2DRotateKey[] keys, List<string> errors)
        {
            var previous = -1f;
            if (keys == null)
            {
                return;
            }

            for (var i = 0; i < keys.Length; i++)
            {
                var key = keys[i];
                if (key == null)
                {
                    continue;
                }

                ValidateSortedTime(label, key.time, ref previous, errors);
                if (!IsFinite(key.rotation))
                {
                    errors.Add("Timeline '" + label + "' contains a non-finite value.");
                }
            }
        }

        private static void ValidateKeyTimes(string label, Suwol2DScaleKey[] keys, List<string> errors)
        {
            var previous = -1f;
            if (keys == null)
            {
                return;
            }

            for (var i = 0; i < keys.Length; i++)
            {
                var key = keys[i];
                if (key == null)
                {
                    continue;
                }

                ValidateSortedTime(label, key.time, ref previous, errors);
                if (!IsFinite(key.scaleX) || !IsFinite(key.scaleY))
                {
                    errors.Add("Timeline '" + label + "' contains a non-finite value.");
                }
            }
        }

        private static void ValidateSortedTime(string label, float time, ref float previous, List<string> errors)
        {
            if (!IsFinite(time))
            {
                errors.Add("Timeline '" + label + "' contains a non-finite key time.");
                return;
            }

            if (time < 0f)
            {
                errors.Add("Timeline '" + label + "' contains a negative key time.");
            }

            if (time < previous)
            {
                errors.Add("Timeline '" + label + "' key times are not sorted.");
            }

            previous = time;
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }

        private void DispatchAnimationEvent(Suwol2DAnimationEvent animationEvent)
        {
            var handler = AnimationEvent;
            if (handler != null)
            {
                handler(animationEvent);
            }
        }
    }
}
