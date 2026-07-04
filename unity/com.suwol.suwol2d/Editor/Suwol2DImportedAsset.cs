using UnityEngine;

namespace Suwol.Suwol2D.Editor
{
    public sealed class Suwol2DImportedAsset : ScriptableObject
    {
        [SerializeField] private Suwol2DImportReport report = new Suwol2DImportReport();

        public Suwol2DImportReport Report
        {
            get { return report; }
        }

        public void SetReport(Suwol2DImportReport report)
        {
            this.report = report ?? new Suwol2DImportReport();
        }
    }
}
