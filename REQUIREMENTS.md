# Documento de Requisitos del Sistema - AIRSTARK (MedHeart AI)

## 1. Introducción
Este documento describe los requisitos funcionales y no funcionales para "AIRSTARK", una aplicación educativa interactiva de anatomía cardíaca en 3D potenciada por Inteligencia Artificial.

## 2. Requisitos Funcionales (RF)

Son las funciones específicas que el sistema debe realizar.

### 2.1. Visualización y Control 3D
*   **RF-01 Visualización de Modelo**: El sistema debe cargar y renderizar un modelo 3D detallado del corazón humano (`.glb`).
*   **RF-02 Control de Cámara**: El usuario debe poder orbitar (rotar), hacer zoom y encuadrar el modelo 3D.
*   **RF-03 Selección de Partes**: El sistema debe permitir hacer clic en estructuras anatómicas específicas (ej. aorta, ventrículos) para seleccionarlas.
*   **RF-04 Etiquetas Flotantes**: En "Modo Explorar", el sistema debe mostrar etiquetas con el nombre de la estructura al pasar el mouse por encima o seleccionarla.
*   **RF-05 Transparencia**: En "Modo Navegación", el usuario debe poder alternar entre una vista sólida y una vista transparente/esquemática para ver estructuras internas.

### 2.2. Inteligencia Artificial y Educación
*   **RF-06 Generación de Contexto Médico**: Al seleccionar una estructura, el sistema debe consultar a una IA (Gemini) para obtener información detallada en tiempo real.
*   **RF-07 Estructura de Datos Médicos**: La información devuelta debe incluir obligatoriamente: Fisiología, Patología, Síntomas, Diagnóstico, Tratamiento y un "Dato Clave" (Pearl).
*   **RF-08 Modo Examen (Quiz)**:
    *   El sistema debe generar una "viñeta clínica" aleatoria usando IA, describiendo síntomas sin nombrar la estructura.
    *   El usuario debe seleccionar la estructura correcta en el modelo 3D.
    *   El sistema debe validar la respuesta y proporcionar retroalimentación visual (Correcto/Incorrecto).

### 2.3. Interacción Multimodal (NUI - Natural User Interface)
*   **RF-09 Control Gestual**: El sistema debe utilizar la webcam para detectar gestos de la mano mediante visión artificial (MediaPipe).
    *   *Mano Abierta*: Rotar el modelo.
    *   *Dedo Índice*: Acercar/Alejar (Zoom).
    *   *Puño Cerrado*: Pausar/Bloquear movimiento.
*   **RF-10 Feedback Visual de Gestos**: La interfaz debe mostrar el estado actual del gesto detectado y una vista previa de la cámara.
*   **RF-11 Control por Voz**: El sistema debe reconocer comandos de voz hablados en español para:
    *   Cambiar modos (ej. "Modo Examen", "Modo Explorar").
    *   Seleccionar estructuras (ej. "Ventrículo Derecho").
    *   Resetear vistas (ej. "Cerrar").

### 2.4. Grabación y Utilidades
*   **RF-12 Grabación de Pantalla**: El sistema debe permitir al usuario grabar su sesión de interacción y descargar el video resultante.

## 3. Requisitos No Funcionales (RNF)

Son atributos de calidad, rendimiento y restricciones del sistema.

### 3.1. Rendimiento y Eficiencia
*   **RNF-01 Latencia de Gestos**: El procesamiento de gestos debe ser en tiempo real, manteniendo una tasa de fotogramas fluida (>30 FPS) para evitar mareos o desconexión en la experiencia de usuario.
*   **RNF-02 Carga de Modelos**: Los modelos 3D deben estar optimizados (formato web-ready o comprimido) para cargar en menos de 5 segundos en conexiones de banda ancha estándar.

### 3.2. Seguridad (Arquitectura)
*   **RNF-03 Protección de API Key**: La clave de API de Google Gemini **nunca** debe estar expuesta en el código del cliente (browser). Debe ser gestionada exclusivamente por el servidor backend.
*   **RNF-04 Pasarela de Datos**: Todas las solicitudes a la IA deben pasar a través del backend propio del sistema (`/api/chat`) para ocultar la infraestructura de terceros.

### 3.3. Usabilidad y Diseño
*   **RNF-05 Interfaz Futurista**: El diseño debe seguir una estética moderna ("Sci-Fi" o médica avanzada), utilizando paletas oscuras, transparencias (glassmorphism) y efectos de neón para indicar interactividad.
*   **RNF-06 Diseño Responsivo**: La interfaz de usuario (UI) superpuesta al modelo 3D debe adaptarse a diferentes resoluciones de pantalla.

### 3.4. robustez y Disponibilidad
*   **RNF-07 Manejo de Errores de IA**: Si la API de Gemini falla o no responde, el sistema debe mostrar información estática de respaldo o un mensaje de error amigable, sin romper la aplicación.
*   **RNF-08 Fallback de Hardware**: Si el usuario no tiene webcam o micrófono, las funciones básicas (ratón/teclado) deben seguir siendo totalmente operativas.

### 3.5. Compatibilidad
*   **RNF-09 Navegadores Modernos**: El sistema debe ser compatible con las últimas versiones de Chrome, Edge y navegadores basados en Chromium que soporten WebGL y WebXR.
