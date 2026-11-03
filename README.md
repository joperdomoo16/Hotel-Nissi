# Hotel Nissi · Mingueo, Dibulla, La Guajira

Sitio web oficial y cotizador de estadías para el Hotel Nissi, situado a orillas de la Troncal del Caribe en el corregimiento de Mingueo, municipio de Dibulla (La Guajira), a mitad de camino entre Santa Marta y Riohacha, muy cerca de Palomino.

## Propósito del Proyecto

El sitio permite a los viajeros conocer las habitaciones del hotel, verificar las comodidades para descansar durante su ruta por La Guajira, calcular las noches de estadía y solicitar su reserva directamente por WhatsApp con atención continua.

## Estructura Modular del Código

- `index.html`: Estructura semántica principal, metadatos para buscadores y marcado en formato JSON-LD.
- `Administracion.html`: Panel de recepción y control de habitaciones para atención de huéspedes presenciales.
- `robots.txt`: Directivas de rastreo e indexación para motores de búsqueda.
- `sitemap.xml`: Mapa del sitio con las rutas del dominio.
- `css/style.css`: Estilos globales, variables de color, tipografía base, botones y utilidades compartidas.
- `css/Animaciones.css`: Keyframes, cortina de bienvenida, cursor fluido y transiciones.
- `css/Portada.css`: Barra de navegación, portada, cotizador rápido y marquesina de distancias.
- `css/Ubicacion.css`: Sección de ubicación, botones de Google Maps y Waze, y la ruta por carretera.
- `css/Habitaciones.css`: Catálogo de habitaciones con visor de fotos y la sección de descanso.
- `css/Contacto.css`: Atención por WhatsApp, pie de página y botón flotante.
- `css/Reservas.css`: Ventana modal de reserva, pasos del formulario y resumen de costos.
- `css/Administracion.css`: Estilos del teclado numérico de seguridad, tarjetas del rack de habitaciones y ventana de ingreso presencial.
- `js/Datosinicial.js`: Catálogo de habitaciones, precios y configuración inicial del establecimiento.
- `js/Almacenamiento.js`: Guardado de la sesión, borradores locales y sincronización con Google Sheets.
- `js/Validaciones.js`: Funciones de comprobación para números de celular, fechas de estadía y correos.
- `js/Autenticacion.js`: Conexión con Firebase Authentication para registro, inicio de sesión y persistencia de cuentas.
- `js/Modalreservas.js`: Construcción y ensamblaje modular de los cinco pasos de la ventana modal de reservas y registro.
- `js/Interfaz.js`: Control visual de la ventana modal, actualización de textos y renderizado dinámico del catálogo de habitaciones.
- `js/Animaciones.js`: Módulo de microinteracciones visuales, parallax, cursor dinámico y efectos al hacer scroll.
- `js/script.js`: Controlador principal que coordina los eventos de reservas y el ciclo de vida de la página.
- `js/Administracion.js`: Lógica de validación del PIN de seguridad, sincronización en vivo del estado de habitaciones y registro de check-in directo en Google Sheets.
- `js/Servidorreservas.js`: Servidor para Google Apps Script que conecta Google Sheets con Gemini, WhatsApp y alertas por correo.
- `firebase.json`: Configuración de despliegue para Firebase Hosting con reglas de almacenamiento en caché.
- `.firebaserc`: Asociación del proyecto con el identificador en la consola de Firebase.

## Integración con Firebase (Hosting y Registro de Huéspedes)

El proyecto cuenta con integración nativa para **Firebase Authentication** y **Firebase Hosting**:

1. **Crear el proyecto en la consola:**
   - Ingresa a [console.firebase.google.com](https://console.firebase.google.com/) y crea un nuevo proyecto llamado `hotel-nissi`.
   - En el menú lateral ve a **Compilación → Authentication**, da clic en **Comenzar** y habilita el proveedor **Correo electrónico/Contraseña**.
   - En la configuración del proyecto (ícono de engranaje) agrega una aplicación web (`</>`) y copia los valores del objeto `firebaseConfig`.
2. **Configurar las credenciales:**
   - Abre el archivo `js/Autenticacion.js` y pega tus valores en la constante `Configuracionfirebase`.
3. **Publicar el sitio web en Firebase Hosting:**
   - Si no tienes la herramienta de Firebase instalada, instálala en tu computador ejecutando en la terminal:
     ```bash
     npm install -g firebase-tools
     ```
   - Inicia sesión con tu cuenta de Google:
     ```bash
     firebase login
     ```
   - Publica los archivos del hotel:
     ```bash
     firebase deploy --only hosting
     ```
   - Al terminar, Firebase te entregará un enlace público rápido y seguro con HTTPS (ejemplo: `https://hotel-nissi.web.app`).

## Panel de Recepción y Control Presencial

Para registrar huéspedes que llegan directamente al hotel en Mingueo sin reserva previa en la web:

1. Abre el archivo `Administracion.html` en el navegador del computador o celular de recepción (también accesible desde el enlace discreto del pie de página en `index.html`).
2. Ingresa el PIN de seguridad de turno (por defecto: `1234`).
3. Visualiza en tiempo real el rack con las habitaciones disponibles y ocupadas sincronizadas con Google Sheets.
4. Al dar clic en **Check-in presencial** sobre una habitación libre, diligencia el nombre, celular, fecha de salida y el medio de pago recibido (efectivo, Nequi, Daviplata o transferencia Bancolombia).
5. Al confirmar el ingreso, la habitación queda bloqueada de inmediato como ocupada en Google Sheets (evitando reservas duplicadas desde la web o WhatsApp) y se genera la opción de enviar el recibo de bienvenida con la clave del Wi-Fi al WhatsApp del huésped.

## Integración con Google Sheets, Gemini y WhatsApp

El archivo `js/Servidorreservas.js` contiene el código listo para implementarse en **Google Apps Script**:

1. **Crear la hoja de cálculo:**
   - Abre Google Sheets y crea una hoja nueva llamada `Hotel Nissi Reservas`.
   - Dirígete al menú superior **Extensiones → Apps Script**.
   - Borra cualquier código de ejemplo y pega todo el contenido de `js/Servidorreservas.js`.
2. **Configurar credenciales seguras:**
   - En Apps Script ve a **Configuración del proyecto (ícono de engranaje) → Propiedades de la secuencia de comandos**.
   - Agrega las siguientes variables:
     - `CLAVEGEMINI`: Tu clave de API obtenida en Google AI Studio.
     - `TOKENWHATSAPP`: Token de acceso permanente de WhatsApp Cloud API en Meta for Developers.
     - `IDTELEFONOWHATSAPP`: Identificador del número de teléfono en Meta.
     - `TOKENVERIFICACION`: Palabra secreta para validar el webhook en Meta (ej. `nissiverificacion`).
     - `CELULARADMIN`: Número de celular del administrador con indicativo (ej. `573001234567`).
     - `CORREOADMIN`: Correo electrónico del administrador que recibirá el informe diario.
3. **Inicializar pestañas y relojes automáticos:**
   - En el editor de Apps Script selecciona la función `Inicializarhojas` en el selector superior y da clic en **Ejecutar**.
   - Esto creará automáticamente las pestañas `Habitaciones` y `Reservas` con las 6 habitaciones del hotel, y dejará programados los dos relojes automáticos:
     - Reloj de cada hora: revisa salidas y cambia habitaciones vencidas a `Disponible`.
     - Reloj diario: envía el informe por correo con llegadas, habitaciones y pagos validados.
4. **Implementar como aplicación web:**
   - Da clic en **Implementar → Nueva implementación**.
   - Tipo: **Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier persona**.
   - Copia la URL generada (`https://script.google.com/macros/s/.../exec`) y pégala en la propiedad `urlservidor` dentro de `js/Datosinicial.js`.
   - Esa misma URL la pegas en Meta for Developers como Webhook de WhatsApp con el token de verificación configurado.

## Cómo Ejecutar el Proyecto

Basta con abrir el archivo `index.html` en cualquier navegador web moderno en tu computador o celular.
