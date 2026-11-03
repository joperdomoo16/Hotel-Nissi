// Modulo para construccion y ensamblaje de la ventana modal de reservas

function Construirmodalreservas() {
  const Contenedormodal = document.getElementById('modal');
  if (!Contenedormodal) {
    return;
  }

  const Botoneshabitacion = Habitacioneshotel.map(function(Hab, Indice) {
    return `
      <button type="button" class="pick ${Indice === 0 ? 'is-on' : ''}" data-pick="${Indice}">
        <i>${Hab.numero}</i>
        <span><b>${Hab.tipo}</b><small>${Hab.capacidad}</small></span>
      </button>
    `;
  }).join('');

  Contenedormodal.innerHTML = `
    <div class="modal__wrap">
      <div class="modal__top">
        <div class="modal__brand" id="modalTitulo">
          <img src="assets/nissi-mark-dark.png" alt="" width="40" height="40">Reserva
        </div>
        <button class="modal__close js-close" type="button" aria-label="Cerrar">×</button>
      </div>

      <div class="mprog" id="mprog" hidden>
        <div class="mprog__labels">
          <span id="stepLabel"></span>
          <span id="userTag">Invitado</span>
        </div>
        <div class="mprog__bar"><div id="progBar"></div></div>
      </div>

      <!-- Paso 1: Eleccion de tipo de reserva -->
      <div class="step" data-step="choose">
        <h3 class="display mh">¿Cómo quieres<br><em>reservar?</em></h3>
        <div class="choices">
          <button class="choice choice--dark" type="button" data-go="dates">
            <small>Sin registro</small>
            <span><b>Como invitado</b>Solo tus datos básicos. Listo en un minuto.</span>
          </button>
          <button class="choice choice--line" type="button" data-go="login">
            <small>Usuario registrado</small>
            <span><b>Iniciar sesión</b>Tus datos guardados y el historial de tus estadías.</span>
          </button>
          <a class="choice choice--olive js-wa" href="https://wa.me/573001234567?text=Hola%20Hotel%20Nissi%2C%20quiero%20reservar%20una%20habitaci%C3%B3n." target="_blank" rel="noopener">
            <small><span class="dot dot--pulse dot--sm"></span>Más rápido</small>
            <span><b>Por WhatsApp ↗</b>El asistente te atiende al instante.</span>
          </a>
        </div>
      </div>

      <!-- Paso 2: Inicio de sesion o registro -->
      <div class="step two" data-step="login" hidden>
        <h3 class="display mh"><span id="loginT1">Iniciar</span><br><em id="loginT2">sesión.</em></h3>
        <form class="form" id="loginForm" novalidate>
          <label class="field is-hidden" id="regName" hidden>
            <span>Nombre completo</span>
            <input data-bind="nombreviajero" autocomplete="name" placeholder="Tu nombre y apellido">
          </label>
          <label class="field">
            <span>Correo</span>
            <input type="email" data-bind="correoviajero" placeholder="tu@correo.com" autocomplete="email">
          </label>
          <label class="field">
            <span>Contraseña</span>
            <input type="password" data-bind="claveviajero" autocomplete="current-password">
          </label>
          <span class="err" data-err></span>
          <div class="row row--amplia">
            <button class="btn btn--dark" type="submit"><span id="loginCta">Ingresar</span> →</button>
            <button class="link-btn link-btn--subrayado" type="button" id="toggleReg">¿No tienes cuenta? Créala aquí</button>
          </div>
          <button class="link-btn link-btn--tenue" type="button" data-go="dates">o continuar como invitado</button>
        </form>
      </div>

      <!-- Paso 3: Seleccion de fechas y habitacion -->
      <div class="step" data-step="dates" hidden>
        <h3 class="display mh">Fechas y <em>habitación.</em></h3>
        <div class="fields3">
          <label class="field">
            <span>Llegada</span>
            <input type="date" data-bind="fechallegada" aria-label="Fecha de llegada en modal">
          </label>
          <label class="field">
            <span>Salida</span>
            <input type="date" data-bind="fechasalida" aria-label="Fecha de salida en modal">
          </label>
          <div class="field">
            <span>Huéspedes</span>
            <div class="stepper">
              <button type="button" data-guests="-1" aria-label="Menos huéspedes">−</button>
              <span data-out="guests">2</span>
              <button type="button" data-guests="1" aria-label="Más huéspedes">+</button>
            </div>
          </div>
        </div>
        <div class="picks" id="modalPicks">
          ${Botoneshabitacion}
        </div>
        <div class="mfoot">
          <span data-out="nights">Elige tus fechas</span>
          <div class="row row--amplia">
            <span class="err" data-err></span>
            <button class="btn btn--dark" type="button" id="toDetails">Continuar →</button>
          </div>
        </div>
      </div>

      <!-- Paso 4: Datos personales de contacto -->
      <div class="step two" data-step="details" hidden>
        <div>
          <h3 class="display mh">Tus <em>datos.</em></h3>
          <div class="summary">
            <b data-out="roomLabel">Habitación 01 · Sencilla</b>
            <span data-out="range">Fechas por definir</span>
            <span><span data-out="guests">2</span> huésped(es) · <span data-out="nights"></span></span>
          </div>
        </div>
        <form class="form" id="detailsForm" novalidate>
          <label class="field">
            <span>Nombre completo</span>
            <input data-bind="nombreviajero" autocomplete="name">
          </label>
          <label class="field">
            <span>Celular (WhatsApp)</span>
            <input type="tel" data-bind="celularviajero" placeholder="+57" autocomplete="tel">
          </label>
          <label class="field">
            <span>Hora estimada de llegada</span>
            <input type="time" data-bind="horallegada" aria-label="Hora estimada de llegada">
          </label>
          <span class="err" data-err></span>
          <div class="row row--amplia">
            <button class="btn btn--rust" type="submit">Confirmar reserva</button>
            <button class="link-btn" type="button" data-go="dates">← Volver</button>
          </div>
        </form>
      </div>

      <!-- Paso 5: Confirmacion de solicitud lista -->
      <div class="step done" data-step="done" hidden>
        <div class="done__check" aria-hidden="true">✓</div>
        <h3 class="display mh">Te esperamos,<br><em data-out="firstName">viajero</em>.</h3>
        <p>Solicitud <strong data-out="code"></strong> recibida para la habitación <span data-out="roomN"></span>, <span data-out="range"></span>. Envíala por WhatsApp para recibir la confirmación y la tarifa final.</p>
        <div class="row">
          <a class="btn btn--dark" id="waConfirm" href="https://wa.me/573001234567" target="_blank" rel="noopener">
            <span class="dot"></span>Confirmar por WhatsApp ↗
          </a>
          <button class="btn btn--outline-dark js-close" type="button">Volver al inicio</button>
        </div>
      </div>
    </div>
  `;
}

