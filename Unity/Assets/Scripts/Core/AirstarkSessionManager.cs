using System;
using UnityEngine;
using Airstark.Config;
using Airstark.Networking;

namespace Airstark.Core
{
    /// <summary>
    /// Manager central (§38). Única fuente de estado (§37, sin booleans sueltos).
    /// DontDestroyOnLoad; ningún otro script duplica sessionId/token/preguntas.
    /// </summary>
    public enum SessionState
    {
        Idle, ScanningQR, LoadingSession, WaitingStudent,
        Connecting, Ready, InProgress, Completed, Error
    }

    public class AirstarkSessionManager : MonoBehaviour
    {
        public static AirstarkSessionManager Instance { get; private set; }

        [Header("Config")]
        [SerializeField] private AirstarkConfig config;

        [Header("Red (auto)")]
        [SerializeField] private AirstarkApiClient api;

        public SessionState State { get; private set; } = SessionState.Idle;
        public string SessionId { get; private set; }
        public SessionData Session { get; private set; }
        public string StudentId { get; private set; }
        public string DeviceId { get; private set; }
        public int CurrentQuestionIndex { get; private set; }
        public string LastError { get; private set; }
        public string LastErrorCode { get; private set; }

        // studentToken SOLO en memoria (§23/§60). Nunca PlayerPrefs, nunca logs.
        private string studentToken;

        public event Action<SessionState> OnStateChanged;

        private void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            if (api == null) api = gameObject.AddComponent<AirstarkApiClient>();
            api.Configure(config);
            DeviceId = DeviceIdProvider.GetOrCreate();
        }

        private void SetState(SessionState s) { State = s; Log($"STATE → {s}"); OnStateChanged?.Invoke(s); }
        private void Fail(string code, string message) { LastErrorCode = code; LastError = message; Log($"FAIL [{code}] {message}"); SetState(SessionState.Error); }

        private void Log(string msg)
        {
            if (config != null && config.verboseLogging) UnityEngine.Debug.Log("[AIRSTARK] " + msg);
        }

        // ── QR → sessionId (§3/§19: el QR trae SOLO el UUID, sin JSON ni URL) ──
        public void OnQrScanned(string raw)
        {
            var value = (raw ?? "").Trim();
            Log($"QR leído (crudo): '{value}'");
            if (!Guid.TryParse(value, out _)) { Fail("VALIDATION_ERROR", "Código QR no válido para AIRSTARK."); return; }
            SessionId = value;
            Log($"sessionId válido: {SessionId}");
            LoadSession();
        }

        public void LoadSession()
        {
            SetState(SessionState.LoadingSession);
            StartCoroutine(api.GetSession(SessionId, env =>
            {
                if (!env.ok) { Fail(env.error, AirstarkApiClient.UserMessage(env.error)); return; }
                Session = env.data;
                Log($"Sesión cargada: '{Session.name}' | estado={Session.status} | preguntas={TotalQuestions} | canStart={Session.canStart}");
                if (!Session.canStart) { Fail("SESSION_NOT_STARTED", AirstarkApiClient.UserMessage("SESSION_NOT_STARTED")); return; }
                CurrentQuestionIndex = 0;
                SetState(SessionState.WaitingStudent);
            }));
        }

        // ── Join (§22-§23: solo studentName; el backend genera studentId) ──
        public void ConnectStudent(string studentName)
        {
            if (string.IsNullOrWhiteSpace(studentName)) { Fail("VALIDATION_ERROR", "Escribe tu nombre para ingresar."); return; }
            SetState(SessionState.Connecting);
            StartCoroutine(api.Connect(SessionId, studentName.Trim(), DeviceId, env =>
            {
                if (!env.ok) { Fail(env.error, AirstarkApiClient.UserMessage(env.error)); return; }
                StudentId = env.data.studentId;
                studentToken = env.data.studentToken;
                Log($"Conectado: studentId={StudentId} (token recibido en memoria, no se muestra)");
                SetState(SessionState.Ready);
            }));
        }

        // ── Evaluación (§24: sin isCorrect, sin score parcial) ──
        public PublicQuestion CurrentQuestion =>
            (Session?.evaluation?.questions != null && CurrentQuestionIndex < Session.evaluation.questions.Length)
                ? Session.evaluation.questions[CurrentQuestionIndex] : null;

        public int TotalQuestions => Session?.evaluation?.questions?.Length ?? 0;

        public void BeginEvaluation()
        {
            CurrentQuestionIndex = 0;
            SetState(SessionState.InProgress);
        }

        public void SubmitCurrentAnswer(string optionId, Action<AnswerData> done)
        {
            var q = CurrentQuestion;
            if (q == null || string.IsNullOrEmpty(studentToken)) return;
            StartCoroutine(api.SubmitAnswer(studentToken, SessionId, q.id, optionId, env =>
            {
                if (!env.ok) { Fail(env.error, AirstarkApiClient.UserMessage(env.error)); return; }
                var r = env.data;
                Log($"Respuesta registrada: {r.answered}/{r.totalQuestions} completed={r.completed}" +
                    (r.completed ? $" score={r.score}" : ""));
                if (r.completed) SetState(SessionState.Completed);
                else { CurrentQuestionIndex = Math.Min(CurrentQuestionIndex + 1, Math.Max(0, TotalQuestions - 1)); if (State != SessionState.InProgress) SetState(SessionState.InProgress); }
                done?.Invoke(r);
            }));
        }

        public void BackToScan()
        {
            SessionId = null; Session = null; StudentId = null; studentToken = null;
            CurrentQuestionIndex = 0; LastError = null; LastErrorCode = null;
            SetState(SessionState.ScanningQR);
        }

        /// <summary>
        /// Desconexión explícita: revoca el token en servidor y vuelve a la
        /// pantalla de ingreso (el estudiante puede reconectar → rotación).
        /// </summary>
        public void Disconnect()
        {
            var token = studentToken;
            studentToken = null;
            StudentId = null;
            if (string.IsNullOrEmpty(token)) { SetState(SessionState.WaitingStudent); return; }
            StartCoroutine(api.Disconnect(token, env =>
            {
                if (!env.ok) { Fail(env.error, AirstarkApiClient.UserMessage(env.error)); return; }
                SetState(SessionState.WaitingStudent);
            }));
        }
    }
}
