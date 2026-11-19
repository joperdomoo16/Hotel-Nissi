// Pie de página general con navegación secundaria y datos de contacto

function Renderizarpiedepagina() {
  const Contenedorpie = document.getElementById('piePagina') || document.querySelector('footer.footer');
  if (!Contenedorpie) {
    return;
  }
  if (!Contenedorpie.id) {
    Contenedorpie.id = 'piePagina';
  }

  Contenedorpie.innerHTML = `
    <div class="footer__top">
      <div class="footer__cta" data-reveal>
        <span class="eyebrow">Tu próxima parada</span>
        <p class="display footer__h">Duerme bien. <em>Sigue tu ruta mañana.</em></p>
        <div class="row">
          <a class="btn btn--cream js-wa" href="https://wa.me/573123757015?text=Hola%20Hospedaje%20Nissi%2C%20quiero%20reservar%20una%20habitaci%C3%B3n." target="_blank" rel="noopener" data-magnetic data-cursor="Chat">
            <span class="dot dot--wa"></span>Escribir por WhatsApp
          </a>
          <button class="btn btn--ghost js-book" type="button" data-cursor="Reservar">Reservar en la web</button>
        </div>
      </div>
      <div class="footer__cols" data-reveal>
        <nav class="fcol" aria-label="Explorar secciones">
          <span class="eyebrow">Explorar</span>
          <ul class="fcol__list">
            <li><a href="#ubicacion">Ubicación</a></li>
            <li><a href="#habitaciones">Habitaciones</a></li>
            <li><a href="#descanso">Descanso</a></li>
            <li id="footerLoginItem"><button class="link-btn js-login" type="button">Ingresar</button></li>
            <li id="footerLogoutItem" hidden><button class="link-btn js-logout" type="button" style="color:var(--rust);">Cerrar sesión</button></li>
          </ul>
        </nav>
        <nav class="fcol" aria-label="Información de contacto">
          <span class="eyebrow">Visítanos</span>
          <ul class="fcol__list">
            <li><a class="js-maps" href="https://maps.app.goo.gl/TudMNAdQRpVyzHZGA" target="_blank" rel="noopener">Mingueo (Dibulla)<br>La Guajira, Colombia</a></li>
            <li class="fcol__apps">
              <a class="apppill js-maps" href="https://maps.app.goo.gl/TudMNAdQRpVyzHZGA" target="_blank" rel="noopener" aria-label="Abrir en Google Maps">
                <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#iconMaps"></use></svg>
                Maps
              </a>
              <a class="apppill js-waze" href="https://waze.com/ul?ll=11.216310,-73.392264&navigate=yes" target="_blank" rel="noopener" aria-label="Abrir en Waze">
                <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#iconWaze"></use></svg>
                Waze
              </a>
            </li>
            <li><a class="js-wa js-wa-num" href="https://wa.me/573123757015" target="_blank" rel="noopener">+57 312 375 7015</a></li>
            <li><a href="mailto:hospedajenissiguajira@gmail.com">hospedajenissiguajira@gmail.com</a></li>
            <li><small><a href="Administracion.html" class="link-discreto-admin">Recepción</a> 24 horas</small></li>
          </ul>
        </nav>
      </div>
    </div>
    <div class="footer__mark">
      <div class="footer__line" data-reveal="line"></div>
      <div class="footer__word">
        <div>N<em>issi</em></div>
        <a href="#inicio" class="footer__seal" data-magnetic data-cursor="Inicio" aria-label="Volver al inicio de Hospedaje Nissi">
          <svg class="ring" viewBox="0 0 200 200" aria-hidden="true">
            <text textLength="510" lengthAdjust="spacing">
              <textPath href="#ringPath">Hospedaje Nissi · Mingueo · La Guajira · </textPath>
            </text>
          </svg>
          <img src="assets/nissi-mark.png" alt="Emblema Hospedaje Nissi" width="120" height="120">
        </a>
      </div>
    </div>
    <div class="footer__bar">
      <span>© 2026 Hospedaje Nissi</span>
      <nav class="footer__legal" aria-label="Información legal">
        <a href="Privacidad.html">Política de privacidad</a>
        <a href="Privacidad.html#condiciones">Condiciones del servicio</a>
      </nav>
      <span>Santa Marta · Palomino · Riohacha</span>
      <a href="#inicio">Volver arriba <span>↑</span></a>
    </div>
  `;
}

