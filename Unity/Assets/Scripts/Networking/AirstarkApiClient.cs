using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
using Airstark.Config;

namespace Airstark.Networking
{
    /// <summary>
    /// Única capa HTTP (§36). Los managers/UI jamás usan UnityWebRequest directo.
    /// Sin service_role, sin credenciales en código: todo sale del ScriptableObject.
    /// </summary>
    public class AirstarkApiClient : MonoBehaviour
    {
        [SerializeField] private AirstarkConfig config;

        public void Configure(AirstarkConfig cfg) { config = cfg; }

        private void EnsureHttps()
        {
            // Producción: solo HTTPS (anti-MITM). Permitir http UNICAMENTE con
            // host local durante desarrollo.
            var url = (config?.apiBaseUrl ?? "").Trim().ToLowerInvariant();
            bool isLocal = url.Contains("localhost") || url.Contains("127.0.0.1") || url.Contains("10.") || url.Contains("192.168.");
            if (!url.StartsWith("https://") && !isLocal)
                throw new InvalidOperationException("AIRSTARK_API_BASE_URL debe usar HTTPS en producción.");
        }

        // ── GET session ──────────────────────────────────────────────
        public IEnumerator GetSession(string sessionId, Action<SessionEnvelope> done)
        {
            SessionEnvelope fail = null;
            try { EnsureHttps(); }
            catch (Exception e) { fail = new SessionEnvelope { ok = false, error = "VALIDATION_ERROR", message = e.Message, statusCode = 400 }; }
            if (fail != null) { done(fail); yield break; }
            string url = config.useEdgeFunctions
                ? $"{config.apiBaseUrl}/get-session?sessionId={UnityWebRequest.EscapeURL(sessionId)}"
                : $"{config.apiBaseUrl}/rest/v1/rpc/student_get_session";
            using var req = config.useEdgeFunctions
                ? UnityWebRequest.Get(url)
                : Post($"{config.apiBaseUrl}/rest/v1/rpc/student_get_session",
                    $"{{\"p_session_id\":\"{sessionId}\"}}");
            yield return Send(req, config.requestTimeoutSeconds);
            done(Parse<SessionEnvelope>(req));
        }

        // ── POST connect ─────────────────────────────────────────────
        public IEnumerator Connect(string sessionId, string studentName, string deviceId, Action<ConnectEnvelope> done)
        {
            var body = JsonUtility.ToJson(new ConnectBody { sessionId = sessionId, studentName = studentName, deviceId = deviceId });
            string url = config.useEdgeFunctions
                ? $"{config.apiBaseUrl}/connect-student"
                : $"{config.apiBaseUrl}/rest/v1/rpc/student_connect";
            string payload = config.useEdgeFunctions ? body
                : $"{{\"p_session_id\":\"{Esc(sessionId)}\",\"p_student_name\":\"{Esc(studentName)}\",\"p_device_id\":\"{Esc(deviceId)}\"}}";
            using var req = Post(url, payload);
            yield return Send(req, config.requestTimeoutSeconds);
            done(Parse<ConnectEnvelope>(req));
        }

        // ── POST answers (Bearer studentToken) ───────────────────────
        public IEnumerator SubmitAnswer(string studentToken, string sessionId, string questionId, string optionId, Action<AnswerEnvelope> done)
        {
            string url = config.useEdgeFunctions
                ? $"{config.apiBaseUrl}/submit-answer"
                : $"{config.apiBaseUrl}/rest/v1/rpc/student_answer";
            string payload = config.useEdgeFunctions
                ? $"{{\"sessionId\":\"{sessionId}\",\"questionId\":\"{questionId}\",\"optionId\":\"{optionId}\"}}"
                : $"{{\"p_student_token\":\"{studentToken}\",\"p_session_id\":\"{sessionId}\",\"p_question_id\":\"{questionId}\",\"p_option_id\":\"{optionId}\"}}";
            using var req = Post(url, payload);
            if (config.useEdgeFunctions) req.SetRequestHeader("Authorization", "Bearer " + studentToken);
            yield return Send(req, config.requestTimeoutSeconds);
            done(Parse<AnswerEnvelope>(req));
        }

        // ── Infra ────────────────────────────────────────────────────
        private UnityWebRequest Post(string url, string json)
        {
            var req = new UnityWebRequest(url, "POST");
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            // Anon key pública por diseño (§35). JAMÁS service_role.
            if (!config.useEdgeFunctions)
            {
                req.SetRequestHeader("apikey", config.anonKey);
                req.SetRequestHeader("Authorization", "Bearer " + config.anonKey);
            }
            return req;
        }

        private static IEnumerator Send(UnityWebRequest req, int timeout)
        {
            req.timeout = timeout;
            yield return req.SendWebRequest();
        }

        private static T Parse<T>(UnityWebRequest req) where T : new()
        {
            // Errores de transporte/timeout → sobre local (§39).
            if (req.result == UnityWebRequest.Result.ConnectionError ||
                req.result == UnityWebRequest.Result.DataProcessingError)
                return EnvelopeError<T>("NETWORK_ERROR", "No se pudo conectar con AIRSTARK.", 0);
            if (req.result == UnityWebRequest.Result.ProtocolError && string.IsNullOrEmpty(req.downloadHandler.text))
                return EnvelopeError<T>("SERVER_ERROR", "Error temporal del servidor.", (int)req.responseCode);
            try
            {
                var env = JsonUtility.FromJson<T>(req.downloadHandler.text);
                if (env == null) return EnvelopeError<T>("SERVER_ERROR", "Error temporal del servidor.", 500);
                return env;
            }
            catch { return EnvelopeError<T>("SERVER_ERROR", "Error temporal del servidor.", 500); }
        }

        private static T EnvelopeError<T>(string code, string message, int status) where T : new()
        {
            // Rellena {ok:false,...} por reflexión ligera vía JSON.
            var json = $"{{\"ok\":false,\"error\":\"{code}\",\"message\":\"{message}\",\"statusCode\":{status}}}";
            try { return JsonUtility.FromJson<T>(json); } catch { return new T(); }
        }

        // Escapado JSON completo (incluye controles \n \r \t que Esc() simple omite).
        private static string Esc(string s) => (s ?? "")
            .Replace("\\", "\\\\").Replace("\"", "\\\"")
            .Replace("\n", "\\n").Replace("\r", "\\r").Replace("\t", "\\t")
            .Replace("\b", "\\b").Replace("\f", "\\f");

        [Serializable] private class ConnectBody { public string sessionId; public string studentName; public string deviceId; }

        /// <summary>Mensajes de usuario por código (§21/§39). Sin stack traces.</summary>
        public static string UserMessage(string code) => code switch
        {
            "UNAUTHORIZED" => "Tu sesión de estudiante ya no es válida.",
            "SESSION_NOT_FOUND" => "Sesión no encontrada.",
            "SESSION_CANCELLED" => "Esta sesión fue cancelada.",
            "SESSION_COMPLETED" => "La sesión ya fue finalizada.",
            "SESSION_EXPIRED" => "La evaluación ya expiró.",
            "SESSION_NOT_STARTED" => "La sesión aún no está activa. Espera la hora indicada.",
            "SESSION_FULL" => "La sesión alcanzó el máximo de estudiantes.",
            "ALREADY_ANSWERED" => "Esta pregunta ya fue registrada.",
            "VALIDATION_ERROR" => "Datos no válidos. Revisa e inténtalo de nuevo.",
            "RATE_LIMITED" => "Demasiadas solicitudes. Intenta nuevamente.",
            "NETWORK_ERROR" => "No se pudo conectar con AIRSTARK.",
            _ => "Error temporal del servidor.",
        };
    }
}
