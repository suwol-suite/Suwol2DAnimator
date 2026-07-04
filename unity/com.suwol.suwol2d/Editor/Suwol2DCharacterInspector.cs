using Suwol.Suwol2D;
using UnityEditor;
using UnityEngine;

namespace Suwol.Suwol2D.Editor
{
    [CustomEditor(typeof(Suwol2DCharacter))]
    public sealed class Suwol2DCharacterInspector : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            DrawDefaultInspector();

            EditorGUILayout.Space();
            EditorGUILayout.HelpBox(
                "Runtime v6 loads .suwol2d.json data, plays transform/deform/IK timelines, and resolves active skin attachments at runtime.",
                MessageType.Info);

            if (!Application.isPlaying)
            {
                return;
            }

            EditorGUILayout.Space();
            var character = (Suwol2DCharacter)target;
            if (GUILayout.Button("Play idle"))
            {
                character.Play("idle");
            }

            if (GUILayout.Button("Play walk"))
            {
                character.Play("walk");
            }

            if (GUILayout.Button("Set Skin: default"))
            {
                character.SetSkin("default");
            }

            if (GUILayout.Button("Set Skin: armor_01"))
            {
                character.SetSkin("armor_01");
            }

            if (GUILayout.Button("Reset Attachment Overrides"))
            {
                character.ResetAttachments();
            }
        }
    }
}
