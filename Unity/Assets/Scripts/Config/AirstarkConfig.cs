using UnityEngine;

namespace Airstark.Config
{
    /// <summary>
    /// Configuración por ambiente (§58-§59). Crear con Create → Airstark → Config.
    /// NUNCA incluir service_role ni secrets aquí (§35/§59).
    /// </summary>
    [CreateAssetMenu(fileName = "AirstarkConfig", menuName = "Airstark/Config")]
    public class AirstarkConfig : ScriptableObject
    {
        [Header("API (§58 AIRSTARK_API_BASE_URL)")]
        [Tooltip("Sin Edge: https://<ref>.supabase.co — Con Edge: https://<ref>.supabase.co/functions/v1")]
        public string apiBaseUrl = "https://xyzcompany.supabase.co";

        [Tooltip("Anon/publishable key (pública por diseño). JAMÁS service_role.")]
        public string anonKey = "";

        [Tooltip("true = Edge Functions desplegadas; false = PostgREST RPC directo.")]
        public bool useEdgeFunctions = false;

        [Header("Red")]
        [Min(5)] public int requestTimeoutSeconds = 20;

        [Header("Diagnóstico")]
        [Tooltip("Logs de verificación en consola/logcat (nunca incluye tokens). Apágalo en release.")]
        public bool verboseLogging = true;
    }
}
