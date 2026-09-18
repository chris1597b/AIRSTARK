# AIRSTARK Unity App — Fase 2 (MVP)

App móvil del estudiante: escanea el QR (solo `sessionId`), obtiene la sesión,
conecta al estudiante, corre la evaluación y envía respuestas. El score se
calcula **exclusivamente en el servidor**.

## Requisitos

- Unity 2022.3 LTS o superior (URP o Built-in, ambas sirven).
- Paquete QR: **ZXing.Net** vía Package Manager → *Add package from git URL*:
  `https://github.com/micjahn/ZXing.Net.git?path=/Source/lib/unity` (o el
  fork Unity que uses en tu versión; ver `QrScanController`).
- Permisos Android (`Player Settings → Other Settings → Configuration` y el
  `AndroidManifest` generado): `CAMERA`, `INTERNET`, `ACCESS_NETWORK_STATE`.
  El permiso de cámara se pide en runtime desde `QrScanController`.
- iOS: `NSCameraUsageDescription` en `Info.plist`.

## Configuración (sin hardcodear nada)

1. En Unity crea un asset **AirstarkConfig** (*Create → Airstark → Config*).
2. Rellena según ambiente (§58):
   - Development: `Api Base Url = https://<tu-ref>.supabase.co`, `Anon Key = <anon key>`, `Use Edge Functions = false` (PostgREST RPC directo).
   - Production (con Edge desplegadas): `Api Base Url = https://<tu-ref>.supabase.co/functions/v1`, `Use Edge Functions = true`.
3. **NUNCA** pongas la `service_role` key aquí, ni en el repo, ni en el APK (§35). La anon key es pública por diseño; las RPCs son la única vía y no exponen tablas.
4. Asigna el config + prefabs de pantallas al `AirstarkSessionManager` (DontDestroyOnLoad, una sola instancia, §38).

## Escenas sugeridas

`0_Boot` (manager) → `1_Scan` (QrScanController) → `2_SessionSummary`
→ `3_Join` (nombre) → `4_Evaluation` (EvaluationController + modelo 3D)
→ `5_Result` (ResultsController). El estado vive en el manager (§37), no en
las escenas.

## Modelo 3D (§25)

El `assetUrl` llega en `model3D` del GET session. Carga por `assetKey` local
(Resources/Addressables/AssetBundles según tu pipeline) usando
`model3D.name` como llave, **nunca** hardcodees `"Heart.glb"` en lógica:
`ModelLibrary.cs` mapea nombre → prefab/descarga. GLB en runtime requiere un
importer (p. ej. glTFast vía UPM) — instálalo cuando actives modelos remotos.

## Compilación

Esta entrega es **código fuente + contrato**; el build (Android, §63) se hace
en una máquina con Unity Editor. Sin warnings críticos conocidos en estos
scripts (solo APIs de runtime `UnityEngine`, nada de `UnityEditor`).
