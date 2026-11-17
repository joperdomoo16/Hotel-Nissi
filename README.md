# Hospedaje Nissi

Plataforma web de reservas, panel de recepción y gestión de disponibilidad para Hospedaje Nissi (Mingueo, Dibulla, La Guajira).

## Enlaces

- Producción: https://hospedaje-nissi-mingueo.web.app
- Consola Firebase: https://console.firebase.google.com/project/hotel-nissi-mingueo/overview

## Estructura del proyecto

- `index.html`: Página principal y cotizador de estadías.
- `Administracion.html`: Panel interno de recepción (rack de habitaciones y métricas).
- `Recuperarclave.html`: Vista de restablecimiento de contraseña.
- `Compilador.js`: Script de empaquetado hacia `dist/` previo al despliegue.
- `css/`: Hojas de estilo por componente (`style.css`, `Navegacion.css`, `Portada.css`, `Ubicacion.css`, `Habitaciones.css`, `Contacto.css`, `Reservas.css`, `Administracion.css`, `Rack.css`, `Dashboard.css`, `Recuperarclave.css`).
- `js/`: Módulos de cliente (`Datosinicial.js`, `Almacenamiento.js`, `Validaciones.js`, `Autenticacion.js`, `Interfaz.js`, `Modalreservas.js`, `Piedepagina.js`, `Animaciones.js`, `script.js`, `Administracion.js`, `Rack.js`, `Dashboard.js`, `Recuperarclave.js`) y scripts de Google Apps Script (`Servidorreservas.js`, `Servidorasistente.js`, `Servidorcanal.js`, `Servidorpagos.js`, `Servidorcorreos.js`).
- `correos/`: Plantillas HTML para notificaciones por correo (`Correobienvenida.html`, `Informediario.html`, `Correorecuperacion.html`).

## Configuración de Google Apps Script

Archivos en el proyecto de Apps Script vinculado a la hoja `Hospedaje Nissi Reservas`:

- `Servidorreservas.gs`
- `Servidorasistente.gs`
- `Servidorcanal.gs`
- `Servidorpagos.gs`
- `Servidorcorreos.gs`
- `Correobienvenida.html`
- `Informediario.html`
- `Correorecuperacion.html`

Variables en `Propiedades de la secuencia de comandos`:

- `CLAVEGEMINI`
- `TOKENWHATSAPP`
- `IDTELEFONOWHATSAPP`
- `TOKENVERIFICACION`
- `CELULARADMIN`
- `CORREOADMIN`

Para crear las pestañas y los activadores de tiempo por primera vez, ejecutar la función `Inicializarhojas` desde el editor de Apps Script.

## Despliegue

```bash
firebase deploy --only hosting
```
