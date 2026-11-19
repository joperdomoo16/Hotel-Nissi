# Hospedaje Nissi

Plataforma web de reservas, panel de recepción y gestión de disponibilidad para Hospedaje Nissi (Mingueo, Dibulla, La Guajira).

## Enlaces

- Producción: https://hospedaje-nissi-mingueo.web.app
- Consola Firebase: https://console.firebase.google.com/project/hotel-nissi-mingueo/overview

## Estructura del proyecto

- `index.html`: Página principal y cotizador de estadías.
- `Administracion.html`: Panel interno de recepción (rack en tiempo real y métricas).
- `Recuperarclave.html`: Vista para crear una nueva contraseña desde el enlace enviado al correo.
- `Privacidad.html`: Política de privacidad y condiciones del servicio.
- `Compilador.js`: Empaqueta hacia `dist/` los archivos de cliente (excluyendo scripts de servidor y comentarios) antes de publicar en hosting.
- `css/`: Hojas de estilo por sección (`style.css`, `Animaciones.css`, `Navegacion.css`, `Portada.css`, `Ubicacion.css`, `Habitaciones.css`, `Contacto.css`, `Reservas.css`, `Formularios.css`, `Administracion.css`, `Rack.css`, `Dashboard.css`, `Recuperarclave.css`, `Privacidad.css`).
- `js/`: Módulos de cliente (`Datosinicial.js`, `Datosestructurados.js`, `Comodidades.js`, `Almacenamiento.js`, `Validaciones.js`, `Autenticacion.js`, `Interfaz.js`, `Modalreservas.js`, `Piedepagina.js`, `Animaciones.js`, `Sesion.js`, `script.js`, `Administracion.js`, `Rack.js`, `Dashboard.js`, `Recuperarclave.js`) y scripts de Google Apps Script (`Servidorseguridad.js`, `Servidorreservas.js`, `Servidortarifas.js`, `Servidorasistente.js`, `Servidorcanal.js`, `Servidorpagos.js`, `Servidorcorreos.js`, `Servidornotificaciones.js`, `Servidorhojas.js`).
- `correos/`: Plantillas HTML para correos transaccionales (`Correobienvenida.html`, `Correorecuperacion.html`, `Correoreservaconfirmada.html`, `Correocontactopendiente.html`, `Informediario.html`).

## Configuración de Google Apps Script

Archivos en el proyecto de Apps Script vinculado a la hoja `Hospedaje Nissi Reservas`:

- `Servidorseguridad.gs`
- `Servidorreservas.gs`
- `Servidortarifas.gs`
- `Servidorasistente.gs`
- `Servidorcanal.gs`
- `Servidorpagos.gs`
- `Servidorcorreos.gs`
- `Servidornotificaciones.gs`
- `Servidorhojas.gs`
- `Correobienvenida.html`
- `Correorecuperacion.html`
- `Correoreservaconfirmada.html`
- `Correocontactopendiente.html`
- `Informediario.html`

Variables en `Propiedades de la secuencia de comandos`:

- `CLAVEGEMINI`
- `TOKENWHATSAPP`
- `IDTELEFONOWHATSAPP`
- `TOKENVERIFICACION`
- `LLAVEWEBHOOK` (clave aleatoria incluida como `?llave=...` únicamente en la URL del webhook en Meta Developers)
- `CELULARADMIN`
- `CORREOADMIN`
- `CLAVEFIREBASE` (clave API web del proyecto Firebase para validar tokens de bienvenida)
- `PINADMIN` o `HASHPINADMIN` (opcional; permite cambiar el PIN del panel de recepción sin tocar el código)

Para crear o actualizar las pestañas, el diseño corporativo y los activadores de tiempo, ejecutar `Inicializarhojas` desde el editor de Apps Script. Para iniciar producción desde cero con datos limpios y estilo empresarial, ejecutar `Reiniciarydisenarhojas`.

## Despliegue

```bash
firebase deploy --only hosting
```
