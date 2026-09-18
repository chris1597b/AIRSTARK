using System;

namespace Airstark.Networking
{
    // DTOs con las formas EXACTAS del contrato (§7, §23, §26).
    // JsonUtility requiere campos públicos (no properties).

    [Serializable] public class PublicOption { public string id; public string text; }
    [Serializable] public class PublicQuestion { public string id; public string text; public PublicOption[] options; }
    [Serializable] public class PublicEvaluation { public string id; public string name; public PublicQuestion[] questions; }
    [Serializable] public class PublicModel3D { public string id; public string name; public string assetUrl; }

    [Serializable]
    public class SessionData
    {
        public string sessionId;
        public string name;
        public string description;
        public string activationDate;
        public int durationMinutes;
        public string expiresAt;
        public string status;
        public bool canStart;
        public PublicModel3D model3D;
        public PublicEvaluation evaluation;
    }

    [Serializable]
    public class ConnectData
    {
        public string studentId;
        public string studentToken; // Opaco, NO JWT. Solo memoria, nunca logs (§23/§60).
        public string sessionId;
        public string status;
        public string joinedAt;
    }

    [Serializable]
    public class AnswerData
    {
        public bool accepted;
        public int answered;
        public int totalQuestions;
        public bool completed;
        public int score; // Significativo SOLO si completed (§29).
        public string status;
    }

    // Sobres RPC/Edge: { ok, data } | { ok:false, error, message, statusCode }.
    [Serializable] public class SessionEnvelope { public bool ok; public SessionData data; public string error; public string message; public int statusCode; }
    [Serializable] public class ConnectEnvelope { public bool ok; public ConnectData data; public string error; public string message; public int statusCode; }
    [Serializable] public class AnswerEnvelope { public bool ok; public AnswerData data; public string error; public string message; public int statusCode; }
    [Serializable] public class DisconnectData { public bool disconnected; public string status; }
    [Serializable] public class DisconnectEnvelope { public bool ok; public DisconnectData data; public string error; public string message; public int statusCode; }
}
