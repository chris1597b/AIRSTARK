using UnityEngine;
using UnityEngine.UI;
using Airstark.Core;
using Airstark.Networking;

namespace Airstark.Flow
{
    /// <summary>Resumen de sesión tras el scan (§20) + estados de error (§21).</summary>
    public class SessionSummaryController : MonoBehaviour
    {
        [SerializeField] private Text titleText, descText, metaText, modelText, errorText;
        [SerializeField] private GameObject continueButton;

        private void OnEnable()
        {
            var m = AirstarkSessionManager.Instance;
            if (m.State == SessionState.Error) { ShowError(m.LastError); return; }
            var s = m.Session;
            if (s == null) { ShowError("No se pudo cargar la sesión."); return; }
            titleText.text = s.name;
            descText.text = s.description ?? "";
            metaText.text = $"Duración: {s.durationMinutes} min   Estado: {s.status}";
            modelText.text = $"Modelo: {s.model3D?.name ?? "—"}";
            errorText.gameObject.SetActive(false);
            continueButton.SetActive(true);
        }

        private void ShowError(string msg)
        {
            errorText.text = msg;
            errorText.gameObject.SetActive(true);
            continueButton.SetActive(false);
        }
    }

    /// <summary>Pantalla de ingreso (§22): solo nombre. Sin email/password/ids.</summary>
    public class StudentJoinController : MonoBehaviour
    {
        [SerializeField] private InputField nameInput;
        [SerializeField] private Text errorText;
        [SerializeField] private Button joinButton;

        private void OnEnable()
        {
            errorText.gameObject.SetActive(false);
            joinButton.onClick.AddListener(OnJoin);
            AirstarkSessionManager.Instance.OnStateChanged += OnState;
        }

        private void OnDisable()
        {
            joinButton.onClick.RemoveListener(OnJoin);
            if (AirstarkSessionManager.Instance != null)
                AirstarkSessionManager.Instance.OnStateChanged -= OnState;
        }

        private void OnJoin()
        {
            errorText.gameObject.SetActive(false);
            AirstarkSessionManager.Instance.ConnectStudent(nameInput.text);
        }

        private void OnState(SessionState s)
        {
            if (s == SessionState.Error)
                ShowError(AirstarkSessionManager.Instance.LastError);
            // Ready → el router avanza a Evaluación.
        }

        private void ShowError(string msg) { errorText.text = msg; errorText.gameObject.SetActive(true); }
    }

    /// <summary>Evaluación (§24): pregunta X/N + opciones + siguiente. Sin
    /// isCorrect, sin score parcial, sin respuesta correcta visible.</summary>
    public class EvaluationController : MonoBehaviour
    {
        [SerializeField] private Text counterText, questionText, errorText;
        [SerializeField] private Transform optionsRoot;
        [SerializeField] private Button optionButtonPrefab;
        [SerializeField] private GameObject nextButton;

        private void OnEnable()
        {
            errorText.gameObject.SetActive(false);
            AirstarkSessionManager.Instance.BeginEvaluation();
            Render();
        }

        private void Render()
        {
            foreach (Transform c in optionsRoot) Destroy(c.gameObject);
            var m = AirstarkSessionManager.Instance;
            var q = m.CurrentQuestion;
            if (q == null) return;
            counterText.text = $"Pregunta {m.CurrentQuestionIndex + 1} de {m.TotalQuestions}";
            questionText.text = q.text;
            foreach (var opt in q.options)
            {
                var b = Instantiate(optionButtonPrefab, optionsRoot);
                b.GetComponentInChildren<Text>().text = opt.text;
                var id = opt.id;
                b.onClick.AddListener(() => OnPick(id, b));
            }
        }

        private void OnPick(string optionId, Button picked)
        {
            picked.interactable = false;
            errorText.gameObject.SetActive(false);
            AirstarkSessionManager.Instance.SubmitCurrentAnswer(optionId, result =>
            {
                if (result.completed) return; // Router → pantalla de resultado.
                Render();
            });
            // Errores (409/410/401…) llegan como estado Error del manager;
            // el router los muestra sin romper la evaluación (§27).
        }
    }

    /// <summary>Finalización (§55): "Evaluación completada" + puntaje final.
    /// El score SOLO se conoce aquí, venido del servidor.</summary>
    public class ResultsController : MonoBehaviour
    {
        [SerializeField] private Text titleText, scoreText;

        private void OnEnable()
        {
            // El último AnswerData con completed=true trae el score.
            // El router lo inyecta vía SetFinalScore antes de mostrar.
            titleText.text = "Evaluación completada";
        }

        public void SetFinalScore(int score, int total)
        {
            scoreText.text = $"Puntaje: {score}/{total}";
        }
    }
}
