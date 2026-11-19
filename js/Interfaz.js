// Estado visual de la portada, catálogo de habitaciones y control del modal

const Estadoaplicacion = {
  fechallegada: '',
  fechasalida: '',
  cantidadhuespedes: 2,
  habitacionseleccionada: 0,
  nombreviajero: '',
  cedulaviajero: '',
  celularviajero: '',
  horallegada: '',
  correoviajero: '',
  claveviajero: '',
  usuariologueado: '',
  creandocuenta: false,
  pasomodal: 'choose',
  codigoreserva: '',
  mapaocupacion: {}
};

function Crearelemento(Etiqueta, Clase, Texto) {
  const Elemento = document.createElement(Etiqueta);
  if (Clase) Elemento.className = Clase;
  if (Texto !== undefined && Texto !== null) Elemento.textContent = String(Texto);
  return Elemento;
}

function Renderizarcatalogohabitaciones() {
  const Contenedorhabitaciones = document.getElementById('roomList');
  const Contenedorfotos = document.getElementById('roomGallery');
  if (!Contenedorhabitaciones || !Contenedorfotos) return;

  Contenedorhabitaciones.textContent = '';
  Contenedorfotos.textContent = '';

  Habitacioneshotel.forEach(function(Hab, Indice) {
    const Esactiva = Indice === 0;
    const Cajahab = Crearelemento('div', 'room' + (Esactiva ? ' is-active' : ''));
    Cajahab.dataset.room = String(Indice);

    const Botonacordeon = Crearelemento('button', 'room__btn');
    Botonacordeon.dataset.cursor = 'Ver';
    Botonacordeon.type = 'button';
    Botonacordeon.appendChild(Crearelemento('span', 'room__n', Hab.numero));
    Botonacordeon.appendChild(Crearelemento('span', 'room__name', Hab.tipo));
    Botonacordeon.appendChild(Crearelemento('span', 'room__cap', Hab.capacidad));

    const Cuerpohab = Crearelemento('div', 'room__body');
    const Interiorhab = Crearelemento('div', 'room__inner');

    if (Hab.mantenimiento) {
      Interiorhab.appendChild(Crearelemento('p', '', 'No disponible temporalmente, te invitamos a ver las demás habitaciones.'));
    } else {
      Interiorhab.appendChild(Crearelemento('p', '', Hab.descripcion));

      const Cajaetiquetas = Crearelemento('div', 'tags');
      Hab.detalles.forEach(function(Detalle) {
        Cajaetiquetas.appendChild(Crearelemento('span', '', Detalle));
      });
      Interiorhab.appendChild(Cajaetiquetas);

      const Filaacciones = Crearelemento('div', 'row');
      const Botonreservar = Crearelemento('button', 'btn btn--cream btn--sm', `Reservar la ${Hab.numero} →`);
      Botonreservar.type = 'button';
      Botonreservar.dataset.book = String(Indice);

      const Mensajeconsulta = `Hola Hospedaje Nissi, quiero información de la habitación ${Hab.numero} (${Hab.tipo}).`;
      const Enlacewhatsapp = Crearelemento('a', 'btn btn--ghost btn--sm', 'Preguntar por WhatsApp');
      Enlacewhatsapp.href = Construirenlacewhatsapp(Mensajeconsulta);
      Enlacewhatsapp.target = '_blank';
      Enlacewhatsapp.rel = 'noopener';
      Enlacewhatsapp.dataset.wa = Mensajeconsulta;

      Filaacciones.appendChild(Botonreservar);
      Filaacciones.appendChild(Enlacewhatsapp);
      Interiorhab.appendChild(Filaacciones);
    }

    Cuerpohab.appendChild(Interiorhab);
    Cajahab.appendChild(Botonacordeon);
    Cajahab.appendChild(Cuerpohab);
    Contenedorhabitaciones.appendChild(Cajahab);

    const Cajafoto = Crearelemento('div', 'rphoto__img' + (Esactiva ? ' is-active' : ''));
    Cajafoto.dataset.photo = String(Indice);
    const Imagen = Crearelemento('img');
    if (typeof Esurlsegura !== 'function' || Esurlsegura(Hab.foto)) Imagen.src = Hab.foto;
    Imagen.alt = `Habitación ${Hab.numero} ${Hab.tipo}`;
    Imagen.width = 800;
    Imagen.height = 1000;
    Imagen.loading = 'lazy';
    Cajafoto.appendChild(Imagen);
    Contenedorfotos.appendChild(Cajafoto);
  });

  const Indicadornumero = Crearelemento('div', 'rphoto__num', '01');
  Indicadornumero.id = 'roomNum';
  Contenedorfotos.appendChild(Indicadornumero);
}

function Construirenlacewhatsapp(Mensajetexto) {
  const Digitoslimpios = String(Configuracionhotel.celular || '').replace(/\D/g, '');
  return `https://wa.me/${Digitoslimpios}?text=${encodeURIComponent(Mensajetexto)}`;
}

function Actualizarmensajeswhatsapp() {
  const Nochesnumero = Calcularnochesestadia(Estadoaplicacion.fechallegada, Estadoaplicacion.fechasalida);
  const Habitacionactual = Habitacioneshotel[Estadoaplicacion.habitacionseleccionada];

  let Mensajegeneral = 'Hola Hospedaje Nissi, quiero reservar una habitación.';
  if (Estadoaplicacion.fechallegada) {
    const Llegadatexto = Formatearfechalegible(Estadoaplicacion.fechallegada);
    const Salidatexto = Formatearfechalegible(Estadoaplicacion.fechasalida) || '?';
    Mensajegeneral = `Hola Hospedaje Nissi, quiero reservar del ${Llegadatexto} al ${Salidatexto} para ${Estadoaplicacion.cantidadhuespedes} persona(s).`;
  }

  document.querySelectorAll('.js-wa').forEach(function(Botonenlace) {
    Botonenlace.href = Construirenlacewhatsapp(Mensajegeneral);
  });
  document.querySelectorAll('[data-wa]').forEach(function(Enlaceespecifico) {
    Enlaceespecifico.href = Construirenlacewhatsapp(Enlaceespecifico.dataset.wa);
  });
  document.querySelectorAll('.js-wa-num').forEach(function(Enlacenumero) {
    Enlacenumero.textContent = `+${String(Configuracionhotel.celular || '').replace(/\D/g, '')}`;
  });
  if (typeof Esurlsegura !== 'function' || Esurlsegura(Configuracionhotel.mapas)) {
    document.querySelectorAll('.js-maps').forEach(function(Enlacemapa) { Enlacemapa.href = Configuracionhotel.mapas; });
  }
  if (typeof Esurlsegura !== 'function' || Esurlsegura(Configuracionhotel.waze)) {
    document.querySelectorAll('.js-waze').forEach(function(Enlacewaze) { Enlacewaze.href = Configuracionhotel.waze; });
  }

  const Confirmacionenlace = document.getElementById('waConfirm');
  if (Confirmacionenlace) {
    const Textorango = (Estadoaplicacion.fechallegada && Estadoaplicacion.fechasalida && Nochesnumero > 0)
      ? `${Formatearfechalegible(Estadoaplicacion.fechallegada)} → ${Formatearfechalegible(Estadoaplicacion.fechasalida)}`
      : 'Fechas por definir';
    const Cedulatexto = Estadoaplicacion.cedulaviajero ? ` (C.C. ${Estadoaplicacion.cedulaviajero})` : '';
    const Textoconfirmacion = `Hola Hospedaje Nissi, confirmo mi solicitud ${Estadoaplicacion.codigoreserva}: habitación ${Habitacionactual.numero} (${Habitacionactual.tipo}), ${Textorango}, ${Estadoaplicacion.cantidadhuespedes} huésped(es). A nombre de ${Estadoaplicacion.nombreviajero}${Cedulatexto}${Estadoaplicacion.horallegada ? ', llegada ' + Estadoaplicacion.horallegada : ''}.`;
    Confirmacionenlace.href = Construirenlacewhatsapp(Textoconfirmacion);
  }
}

function Actualizarbloqueautenticado(Eslogueado, Nombrecorto, Nombrecompleto, Correousuario) {
  document.querySelectorAll('.js-login').forEach(function(Botonusuario) {
    Botonusuario.textContent = Botonusuario.id !== 'btnNavLogin' && Eslogueado ? `Hola, ${Nombrecorto}` : 'Ingresar';
  });

  const Botonnavlogin = document.getElementById('btnNavLogin');
  const Cajausuarionav = document.getElementById('navUserAuth');
  const Textonombreusuario = document.getElementById('navUserName');
  const Textodropnombre = document.getElementById('userDropName');
  const Textodropcorreo = document.getElementById('userDropEmail');

  if (Botonnavlogin) { Botonnavlogin.hidden = Eslogueado; Botonnavlogin.style.display = Eslogueado ? 'none' : ''; }
  if (Cajausuarionav) { Cajausuarionav.hidden = !Eslogueado; Cajausuarionav.style.display = Eslogueado ? 'inline-flex' : 'none'; }
  if (Textonombreusuario) Textonombreusuario.textContent = `Hola, ${Nombrecorto}`;
  if (Textodropnombre) Textodropnombre.textContent = Nombrecompleto;
  if (Textodropcorreo) Textodropcorreo.textContent = Correousuario;

  const Footerlogin = document.getElementById('footerLoginItem');
  const Footerlogout = document.getElementById('footerLogoutItem');
  if (Footerlogin && Footerlogin.querySelector('button')) {
    Footerlogin.querySelector('button').textContent = Eslogueado ? `Hola, ${Nombrecorto}` : 'Ingresar';
  }
  if (Footerlogout) Footerlogout.hidden = !Eslogueado;

  const Textologineleccion = document.getElementById('choiceLoginText');
  const Etiquetaeleccion = document.getElementById('choiceLoginTag');
  if (Textologineleccion) {
    Textologineleccion.textContent = '';
    Textologineleccion.appendChild(Crearelemento('b', '', Eslogueado ? 'Sesión activa' : 'Iniciar sesión'));
    Textologineleccion.appendChild(document.createTextNode(
      Eslogueado
        ? `Conectado como ${Nombrecorto}. Continúa o administra tu cuenta.`
        : 'Tus datos guardados y el historial de tus estadías.'
    ));
  }
  if (Etiquetaeleccion) Etiquetaeleccion.textContent = Eslogueado ? 'Sesión iniciada' : 'Usuario registrado';

  const Tarjetausuarioactivo = document.getElementById('userActiveCard');
  const Formularioingreso = document.getElementById('loginForm');
  const Textonombreactivo = document.getElementById('userActiveName');
  const Textocorreoactivo = document.getElementById('userActiveEmail');

  if (Tarjetausuarioactivo) Tarjetausuarioactivo.hidden = !Eslogueado;
  if (Formularioingreso) Formularioingreso.hidden = Eslogueado;
  if (Textonombreactivo) Textonombreactivo.textContent = Nombrecompleto;
  if (Textocorreoactivo) Textocorreoactivo.textContent = Correousuario;
}

function Refrescarpantalla() {
  const Nochesnumero = Calcularnochesestadia(Estadoaplicacion.fechallegada, Estadoaplicacion.fechasalida);
  const Habitacionactual = Habitacioneshotel[Estadoaplicacion.habitacionseleccionada];

  const Textorango = (Estadoaplicacion.fechallegada && Estadoaplicacion.fechasalida && Nochesnumero > 0)
    ? `${Formatearfechalegible(Estadoaplicacion.fechallegada)} → ${Formatearfechalegible(Estadoaplicacion.fechasalida)}`
    : 'Fechas por definir';
  const Primernombre = (Estadoaplicacion.nombreviajero || '').trim().split(' ')[0] || 'viajero';

  const Textossalida = {
    guests: Estadoaplicacion.cantidadhuespedes,
    nights: Nochesnumero > 0 ? `${Nochesnumero} noche${Nochesnumero > 1 ? 's' : ''}` : 'Elige tus fechas',
    range: Textorango,
    roomLabel: `Habitación ${Habitacionactual.numero} · ${Habitacionactual.tipo}`,
    roomN: Habitacionactual.numero,
    code: Estadoaplicacion.codigoreserva,
    firstName: Primernombre
  };

  document.querySelectorAll('[data-out]').forEach(function(Elementosalida) {
    const Clavedato = Elementosalida.dataset.out;
    if (Textossalida[Clavedato] !== undefined) Elementosalida.textContent = Textossalida[Clavedato];
  });

  document.querySelectorAll('[data-bind]').forEach(function(Campoformulario) {
    const Clavecampo = Campoformulario.dataset.bind;
    if (document.activeElement !== Campoformulario && Estadoaplicacion[Clavecampo] !== undefined) {
      Campoformulario.value = Estadoaplicacion[Clavecampo];
    }
  });

  document.querySelectorAll('.pick').forEach(function(Botonhabitacion, Indicehabitacion) {
    const Habitacionitem = Habitacioneshotel[Indicehabitacion];
    const Enmantenimiento = Boolean(Habitacionitem.mantenimiento);
    const Estaocupada = Enmantenimiento || Estadoaplicacion.mapaocupacion[Habitacionitem.numero] === false;
    Botonhabitacion.classList.toggle('is-on', !Enmantenimiento && Indicehabitacion === Estadoaplicacion.habitacionseleccionada);
    Botonhabitacion.classList.toggle('is-disabled', Estaocupada);
    const Pequenotexto = Botonhabitacion.querySelector('small');
    if (Pequenotexto) {
      Pequenotexto.textContent = Enmantenimiento ? 'No disponible' : (Estaocupada ? 'Ocupada' : Habitacionitem.capacidad);
    }
  });

  const Eslogueado = Boolean(Estadoaplicacion.usuariologueado);
  const Nombrecorto = Eslogueado ? Estadoaplicacion.usuariologueado.split(' ')[0] : '';
  const Nombrecompleto = Estadoaplicacion.nombreviajero || Estadoaplicacion.usuariologueado || 'Viajero';
  const Correousuario = Estadoaplicacion.correoviajero || '';

  Actualizarbloqueautenticado(Eslogueado, Nombrecorto, Nombrecompleto, Correousuario);
  Actualizarmensajeswhatsapp();

  document.querySelectorAll('.step').forEach(function(Pasocontenedor) {
    Pasocontenedor.hidden = Pasocontenedor.dataset.step !== Estadoaplicacion.pasomodal;
  });

  const Indicemodales = { dates: 1, details: 2, done: 3 }[Estadoaplicacion.pasomodal] || 0;
  const Barramodal = document.getElementById('mprog');
  const Lineaprogreso = document.getElementById('progBar');
  const Etiquetapaso = document.getElementById('stepLabel');
  const Etiquetausuario = document.getElementById('userTag');
  const Botonlogoutmodal = document.getElementById('modalLogoutBtn');

  if (Barramodal) Barramodal.hidden = Indicemodales === 0;
  if (Lineaprogreso) Lineaprogreso.style.width = `${(Indicemodales / 3) * 100}%`;
  if (Etiquetapaso) Etiquetapaso.textContent = ['', '1 / 3 · Fechas', '2 / 3 · Datos', '3 / 3 · Listo'][Indicemodales] || '';
  if (Etiquetausuario) Etiquetausuario.textContent = Eslogueado ? `Sesión: ${Nombrecorto}` : 'Invitado';
  if (Botonlogoutmodal) Botonlogoutmodal.hidden = !Eslogueado;

  const Camporegistronombre = document.getElementById('regName');
  const Titulouno = document.getElementById('loginT1');
  const Titulodos = document.getElementById('loginT2');
  const Botonaccioncuenta = document.getElementById('loginCta');
  const Botonconmutarregistro = document.getElementById('toggleReg');
  const Textoetiquetagoogle = document.getElementById('googleCta');
  const Bloquerecuperar = document.getElementById('loginAux');

  if (Camporegistronombre) {
    Camporegistronombre.hidden = !Estadoaplicacion.creandocuenta;
    Camporegistronombre.classList.toggle('is-hidden', !Estadoaplicacion.creandocuenta);
  }
  if (Titulouno) Titulouno.textContent = Eslogueado ? 'Tu' : (Estadoaplicacion.creandocuenta ? 'Crea tu' : 'Iniciar');
  if (Titulodos) Titulodos.textContent = Eslogueado ? 'cuenta.' : (Estadoaplicacion.creandocuenta ? 'cuenta.' : 'sesión.');
  if (Botonaccioncuenta) Botonaccioncuenta.textContent = Estadoaplicacion.creandocuenta ? 'Crear cuenta' : 'Ingresar';
  if (Botonconmutarregistro) {
    Botonconmutarregistro.textContent = Estadoaplicacion.creandocuenta ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Créala aquí';
  }
  if (Textoetiquetagoogle) Textoetiquetagoogle.textContent = Estadoaplicacion.creandocuenta ? 'Registrarse con Google' : 'Continuar con Google';
  if (Bloquerecuperar) Bloquerecuperar.hidden = Boolean(Estadoaplicacion.creandocuenta);
}

function Mostrarmensajeexito(Mensajeexito) {
  document.querySelectorAll('[data-ok]').forEach(function(Contenedorexito) {
    Contenedorexito.textContent = Mensajeexito || '';
    Contenedorexito.hidden = !Mensajeexito;
  });
}

function Mostrarmensajeerror(Mensajeerror) {
  Mostrarmensajeexito('');
  document.querySelectorAll('[data-err]').forEach(function(Contenedorerror) {
    Contenedorerror.textContent = Mensajeerror || '';
  });
}

function Cambiarpasomodal(Nuevopaso) {
  Estadoaplicacion.pasomodal = Nuevopaso;
  Mostrarmensajeerror('');
  Refrescarpantalla();
}

function Abrirventanamodal(Eventoclic, Pasodeseado, Indicehabitacion) {
  const Modaldom = document.getElementById('modal');
  if (!Modaldom) return;

  const Posicionx = Eventoclic && Eventoclic.clientX != null ? Eventoclic.clientX : window.innerWidth / 2;
  const Posiciony = Eventoclic && Eventoclic.clientY != null ? Eventoclic.clientY : window.innerHeight / 2;
  Modaldom.style.setProperty('--ox', `${Posicionx}px`);
  Modaldom.style.setProperty('--oy', `${Posiciony}px`);

  if (Indicehabitacion !== undefined && Indicehabitacion !== null) {
    Estadoaplicacion.habitacionseleccionada = Indicehabitacion;
  }

  Estadoaplicacion.pasomodal = Pasodeseado === 'login' ? 'login' : (Estadoaplicacion.usuariologueado ? 'dates' : 'choose');
  Mostrarmensajeerror('');
  Refrescarpantalla();

  Modaldom.classList.add('is-anim');
  requestAnimationFrame(function() {
    requestAnimationFrame(function() { Modaldom.classList.add('is-open'); });
  });
  document.body.style.overflow = 'hidden';
}

function Cerrarventanamodal() {
  const Modaldom = document.getElementById('modal');
  if (!Modaldom) return;
  Modaldom.classList.remove('is-open');
  document.body.style.overflow = '';
  setTimeout(function() { Modaldom.classList.remove('is-anim'); }, 900);
}
