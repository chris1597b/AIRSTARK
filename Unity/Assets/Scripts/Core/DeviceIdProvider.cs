using System;
using UnityEngine;

namespace Airstark.Core
{
    /// <summary>
    /// deviceId MVP (§12): UUID de instalación persistido localmente.
    /// NO es autenticación ni identidad humana; solo detecta reconexiones
    /// (UNIQUE session+device en servidor). No es secreto; no se muestra.
    /// </summary>
    public static class DeviceIdProvider
    {
        private const string Key = "airstark_device_id";

        public static string GetOrCreate()
        {
            if (PlayerPrefs.HasKey(Key))
            {
                var existing = PlayerPrefs.GetString(Key);
                if (!string.IsNullOrEmpty(existing)) return existing;
            }
            var id = Guid.NewGuid().ToString();
            PlayerPrefs.SetString(Key, id);
            PlayerPrefs.Save();
            return id;
        }
    }
}
