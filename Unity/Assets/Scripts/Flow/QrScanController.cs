using UnityEngine;
using Airstark.Core;

#if UNITY_ANDROID
using UnityEngine.Android;
#endif

namespace Airstark.Flow
{
    /// <summary>
    /// Pantalla inicial (§18): [ Escanear QR ]. Delega el decode a ZXing
    /// (ver README) y entrega el string crudo al manager (§19).
    /// Apaga la cámara en cuanto hay lectura válida.
    /// </summary>
    public class QrScanController : MonoBehaviour
    {
        [Header("UI")]
        [SerializeField] private GameObject scanPanel;
        [SerializeField] private UnityEngine.UI.Text statusText;

        private IQrScanner scanner;

        private void OnEnable()
        {
            AirstarkSessionManager.Instance.BackToScan();
            SetStatus("Apunta al código QR de la sesión");
            EnsureCameraPermission();
#if !UNITY_EDITOR
            // Producción: sin puerta de debug (pegar sessionId manual es SOLO editor).
            if (debugInput != null) debugInput.gameObject.SetActive(false);
#endif
            scanner = CreateScanner();
            scanner?.Start(OnQrDecoded);
        }

        private void OnDisable() { scanner?.Stop(); }

        private void OnQrDecoded(string raw)
        {
            if (string.IsNullOrEmpty(raw)) return;
            scanner?.Stop(); // No mantener cámara encendida (§19).
            AirstarkSessionManager.Instance.OnQrScanned(raw);
            // Navegación por estado: el router de escenas escucha OnStateChanged
            // (LoadingSession → pantalla "Cargando evaluación...").
        }

        private static void EnsureCameraPermission()
        {
#if UNITY_ANDROID
            if (!Permission.HasUserAuthorizedPermission(Permission.Camera))
                Permission.RequestUserPermission(Permission.Camera);
#endif
        }

        private void SetStatus(string s) { if (statusText) statusText.text = s; }

        // Con ZXing.Net instalado, esta factoría devuelve el scanner real.
        // Sin el paquete, devuelve null y la pantalla muestra modo debug
        // (campo de texto para pegar el sessionId, SOLO debug §18).
        private IQrScanner CreateScanner() => new StubQrScanner(debugInput);

        [Header("Debug (solo editor)")]
        [SerializeField] private UnityEngine.UI.InputField debugInput;
    }

    public interface IQrScanner
    {
        void Start(System.Action<string> onDecoded);
        void Stop();
    }

    /// <summary>
    /// Sustituir por implementación ZXing (WebCamTexture → BarcodeReader.Decode).
    /// </summary>
    public sealed class StubQrScanner : IQrScanner
    {
        private readonly UnityEngine.UI.InputField debug;
        public StubQrScanner(UnityEngine.UI.InputField debugInput) { debug = debugInput; }
        public void Start(System.Action<string> onDecoded)
        {
            if (debug != null) debug.onEndEdit.AddListener(v => { if (!string.IsNullOrEmpty(v)) onDecoded(v); });
        }
        public void Stop() { }
    }
}
