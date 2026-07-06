using System.Linq;
using UnityEditor;
using UnityEditor.AssetImporters;
using UnityEngine;

namespace Suwol.Suwol2D.Editor
{
    [CustomEditor(typeof(Suwol2DAssetImporter))]
    public sealed class Suwol2DAssetImporterEditor : ScriptedImporterEditor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            EditorGUILayout.PropertyField(serializedObject.FindProperty("generatePrefab"));
            serializedObject.ApplyModifiedProperties();

            EditorGUILayout.Space();
            var importedAsset = LoadImportedAsset();
            if (importedAsset == null)
            {
                EditorGUILayout.HelpBox("Import the asset to see the Suwol2D import report.", MessageType.Info);
            }
            else
            {
                DrawReport(importedAsset.Report);
            }

            EditorGUILayout.Space();
            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Rebuild Prefab"))
                {
                    AssetDatabase.ImportAsset(GetAssetPath(), ImportAssetOptions.ForceUpdate);
                }

                using (new EditorGUI.DisabledScope(importedAsset == null || importedAsset.Report.GeneratedPrefab == null))
                {
                    if (GUILayout.Button("Ping Generated Prefab"))
                    {
                        EditorGUIUtility.PingObject(importedAsset.Report.GeneratedPrefab);
                    }
                }
            }

            if (GUILayout.Button("Open Documentation"))
            {
                OpenDocumentation();
            }

            ApplyRevertGUI();
        }

        private Suwol2DImportedAsset LoadImportedAsset()
        {
            return AssetDatabase
                .LoadAllAssetsAtPath(GetAssetPath())
                .OfType<Suwol2DImportedAsset>()
                .FirstOrDefault();
        }

        private string GetAssetPath()
        {
            return ((AssetImporter)target).assetPath;
        }

        internal static void DrawReport(Suwol2DImportReport report)
        {
            if (report == null)
            {
                EditorGUILayout.HelpBox("No import report was generated.", MessageType.Warning);
                return;
            }

            EditorGUILayout.LabelField("Source", report.SourceName);
            EditorGUILayout.LabelField("Version", report.Version.ToString());
            EditorGUILayout.LabelField("Bones", report.BonesCount.ToString());
            EditorGUILayout.LabelField("Slots", report.SlotsCount.ToString());
            EditorGUILayout.LabelField("Skins", report.SkinsCount.ToString());
            EditorGUILayout.LabelField("Attachments", report.AttachmentsCount.ToString());
            EditorGUILayout.LabelField("Clipping Attachments", report.ClippingAttachmentCount.ToString());
            EditorGUILayout.LabelField("Clipping Vertices", report.ClippingVertexCount.ToString());
            EditorGUILayout.LabelField("Animations", report.AnimationsCount.ToString());
            EditorGUILayout.LabelField("IK Constraints", report.IkConstraintsCount.ToString());
            EditorGUILayout.LabelField("Attachment Timelines", report.AttachmentTimelineCount.ToString());
            EditorGUILayout.LabelField("Draw Order Keys", report.DrawOrderKeyCount.ToString());
            EditorGUILayout.LabelField("Slot Color Keys", report.SlotColorKeyCount.ToString());
            EditorGUILayout.LabelField("Event Keys", report.EventKeyCount.ToString());
            EditorGUILayout.LabelField("State Machines", report.StateMachineCount.ToString());
            EditorGUILayout.LabelField("States", report.StateCount.ToString());
            EditorGUILayout.LabelField("State Transitions", report.StateTransitionCount.ToString());
            EditorGUILayout.LabelField("State Parameters", report.StateParameterCount.ToString());
            EditorGUILayout.LabelField("Interpolation Keys", string.IsNullOrEmpty(report.InterpolationSummary) ? "None" : report.InterpolationSummary);
            EditorGUILayout.ObjectField("Generated Prefab", report.GeneratedPrefab, typeof(GameObject), false);

            DrawStringList("Animations", report.AnimationNames);
            DrawStringList("Skins", report.SkinNames);
            DrawStringList("Slots", report.SlotNames);
            DrawStringList("Attachments", report.AttachmentNames);
            DrawStringList("Textures Found", report.TextureNames);
            DrawStringList("Textures Missing", report.MissingTextureNames);
            DrawMessageList("Warnings", report.WarningMessages, MessageType.Warning);
            DrawMessageList("Errors", report.ErrorMessages, MessageType.Error);
        }

        private static void DrawStringList(string title, string[] values)
        {
            EditorGUILayout.LabelField(title, values != null && values.Length > 0 ? string.Join(", ", values) : "None");
        }

        private static void DrawMessageList(string title, string[] values, MessageType messageType)
        {
            if (values == null || values.Length == 0)
            {
                return;
            }

            EditorGUILayout.Space();
            EditorGUILayout.LabelField(title, EditorStyles.boldLabel);
            for (var i = 0; i < values.Length; i++)
            {
                EditorGUILayout.HelpBox(values[i], messageType);
            }
        }

        private static void OpenDocumentation()
        {
            var path = "Packages/com.suwol.suwol2d/Documentation~/animation-mixing-state-machine-v10.md";
            if (System.IO.File.Exists(path))
            {
                EditorUtility.OpenWithDefaultApp(path);
                return;
            }

            path = "Packages/com.suwol.suwol2d/Documentation~/runtime-regression-stability-v9.md";
            if (System.IO.File.Exists(path))
            {
                EditorUtility.OpenWithDefaultApp(path);
                return;
            }

            path = "Packages/com.suwol.suwol2d/Documentation~/animation-timelines-v8.md";
            if (System.IO.File.Exists(path))
            {
                EditorUtility.OpenWithDefaultApp(path);
                return;
            }

            path = "Packages/com.suwol.suwol2d/Documentation~/unity-importer-prefab-workflow-v7.md";
            if (System.IO.File.Exists(path))
            {
                EditorUtility.OpenWithDefaultApp(path);
                return;
            }

            Debug.LogWarning("Suwol2D importer documentation was not found at: " + path);
        }
    }

    [CustomEditor(typeof(Suwol2DImportedAsset))]
    public sealed class Suwol2DImportedAssetEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            var importedAsset = (Suwol2DImportedAsset)target;
            Suwol2DAssetImporterEditor.DrawReport(importedAsset.Report);
        }
    }
}
