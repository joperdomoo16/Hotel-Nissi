// Actualizacion visual del contenido en pantalla y control de la ventana modal
const Estadoaplicacion = {
  fechallegada: '',
  fechasalida: '',
  cantidadhuespedes: 2,
  habitacionseleccionada: 0,
  nombreviajero: '',
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

function Construirenlasewhatsapp(Mensajetexto) {
  const Digitoslimpios = Configuracionhotel.celular.replace(/\D/g, '');
  return `https://wa.me/${Digitoslimpios}?text=${encodeURIComponent(Mensajetexto)}`;
}

function Actualizarmensajeswhatsapp() {
  const Nochesnumero = Calcularnochesestadia(Estadoaplicacion.fechallegada, Estadoaplicacion.fechasalida);
  const Habitacionactual = Habitacioneshotel[Estadoaplicacion.habitacionseleccionada];
  
  let Mensajegeneral = 'Hola Hotel Nissi, quiero reservar una habitación.';
  if (Estadoaplicacion.fechallegada) {
    const Llegadatexto = Formatearfechalegible(Estadoaplicacion.fechallegada);
    const Salidatexto = Formatearfechalegible(Estadoaplicacion.fechasalida) || '?';
    Mensajegeneral = `Hola Hotel Nissi, quiero reservar del ${Llegadatexto} al ${Salidatexto} para ${Estadoaplicacion.cantidadhuespedes} persona(s).`;
  }
  
  document.querySelectorAll('.js-wa').forEach(function(Botonenlace) {
    Botonenlace.href = Construirenlasewhatsapp(Mensajegeneral);
  });

  document.querySelectorAll('[data-wa]').forEach(function(Enlaceespecifico) {
    Enlaceespecifico.href = Construirenlasewhatsapp(Enlaceespecifico.dataset.wa);
  });

  document.querySelectorAll('.js-wa-num').forEach(function(Enlacenumero) {
    Enlacenumero.textContent = `+${Configuracionhotel.celular.replace(/\D/g, '')}`;
  });

  document.querySelectorAll('.js-maps').forEach(function(Enlacemapa) {
    Enlacemapa.href = Configuracionhotel.mapas;
  });

  document.querySelectorAll('.js-waze').forEach(function(Enlacewaze) {
    Enlacewaze.href = Configuracionhotel.waze;
  });
  
  const Confirmacionenlace = document.getElementById('waConfirm');
  if (Confirmacionenlace) {
    const Textorango = (Estadoaplicacion.fechallegada && Estadoaplicacion.fechasalida && Nochesnumero > 0)
      ? `${Formatearfechalegible(Estadoaplicacion.fechallegada)} → ${Formatearfechalegible(Estadoaplicacion.fechasalida)}`
      : 'Fechas por definir';
    const Textoconfirmacion = `Hola Hotel Nissi, confirmo mi solicitud ${Estadoaplicacion.codigoreserva}: habitación ${Habitacionactual.numero} (${Habitacionactual.tipo}), ${Textorango}, ${Estadoaplicacion.cantidadhuespedes} huésped(es). A nombre de ${Estadoaplicacion.nombreviajero}${Estadoaplicacion.horallegada ? ', llegada ' + Estadoaplicacion.horallegada : ''}.`;
    Confirmacionenlace.href = Construirenlasewhatsapp(Textoconfirmacion);
  }
}

function Refrescarpantalla() {
  const Nochesnumero = Calcularnochesestadia(Estadoaplicacion.fechallegada, Estadoaplicacion.fechasalida);
  const Habitacionactual = Habitacioneshotel[Estadoaplicacion.habitacionseleccionada];
  
  const Textorango = (Estadoaplicacion.fechallegada && Estadoaplicacion.fechasalida && Nochesnumero > 0)
    ? `${Formatearfechalegible(Estadoaplicacion.fechallegada)} → ${Formatearfechalegible(Estadoaplicacion.fechasalida)}`
    : 'Fechas por definir';
    
  const Primeronombre = (Estadoaplicacion.nombreviajero || '').trim().split(' ')[0] || 'viajero';

  const Textossalida = {
    guests: Estadoaplicacion.cantidadhuespedes,
    nights: Nochesnumero > 0 ? `${Nochesnumero} noche${Nochesnumero > 1 ? 's' : ''}` : 'Elige tus fechas',
    range: Textorango,
    roomLabel: `Habitación ${Habitacionactual.numero} · ${Habitacionactual.tipo}`,
    roomN: Habitacionactual.numero,
    code: Estadoaplicacion.codigoreserva,
    firstName: Primeronombre
  };

  document.querySelectorAll('[data-out]').forEach(function(Elementosalida) {
    const Clavedato = Elementosalida.dataset.out;
    if (Textossalida[Clavedato] !== undefined) {
      Elementosalida.textContent = Textossalida[Clavedato];
    }
  });

  document.querySelectorAll('[data-bind]').forEach(function(Campoformulario) {
    const Clavecampo = Campoformulario.dataset.bind;
    if (document.activeElement !== Campoformulario && Estadoaplicacion[Clavecampo] !== undefined) {
      Campoformulario.value = Estadoaplicacion[Clavecampo];
    }
  });

  document.querySelectorAll('.pick').forEach(function(Botonhabitacion, Indicehabitacion) {
    const Habitacionitem = Habitacioneshotel[Indicehabitacion];
    const Estaocupada = Estadoaplicacion.mapaocupacion[Habitacionitem.numero] === false;
    Botonhabitacion.classList.toggle('is-on', Indicehabitacion === Estadoaplicacion.habitacionseleccionada);
    Botonhabitacion.classList.toggle('is-disabled', Estaocupada);
    const Pequenotexto = Botonhabitacion.querySelector('small');
    if (Pequenotexto) {
      Pequenotexto.textContent = Estaocupada ? 'Ocupada' : Habitacionitem.capacidad;
    }
  });

  document.querySelectorAll('.js-login').forEach(function(Botonusuario) {
    Botonusuario.textContent = Estadoaplicacion.usuariologueado
      ? `Hola, ${Estadoaplicacion.usuariologueado.split(' ')[0]}`
      : 'Ingresar';
  });

  Actualizarmensajeswhatsapp();

  // Control de pasos en la ventana modal
  document.querySelectorAll('.step').forEach(function(Pasocontenedor) {
    Pasocontenedor.hidden = Pasocontenedor.dataset.step !== Estadoaplicacion.pasomodal;
  });

  const Indicemodales = { dates: 1, details: 2, done: 3 }[Estadoaplicacion.pasomodal] || 0;
  const Barramodal = document.getElementById('mprog');
  const Lineaprogreso = document.getElementById('progBar');
  const Etiquetapaso = document.getElementById('stepLabel');
  const Etiquetausuario = document.getElementById('userTag');

  if (Barramodal) {
    Barramodal.hidden = Indicemodales === 0;
  }
  if (Lineaprogreso) {
    Lineaprogreso.style.width = `${(Indicemodales / 3) * 100}%`;
  }
  if (Etiquetapaso) {
    const Textospasos = ['', '1 / 3 · Fechas', '2 / 3 · Datos', '3 / 3 · Listo'];
    Etiquetapaso.textContent = Textospasos[Indicemodales] || '';
  }
  if (Etiquetausuario) {
    Etiquetausuario.textContent = Estadoaplicacion.usuariologueado
      ? `Sesión: ${Estadoaplicacion.usuariologueado}`
      : 'Invitado';
  }

  const Camporegistronombre = document.getElementById('regName');
  const Titulouno = document.getElementById('loginT1');
  const Titulodos = document.getElementById('loginT2');
  const Botonaccioncuenta = document.getElementById('loginCta');
  const Botonconmutarregistro = document.getElementById('toggleReg');

  if (Camporegistronombre) {
    Camporegistronombre.hidden = !Estadoaplicacion.creandocuenta;
    Camporegistronombre.classList.toggle('is-hidden', !Estadoaplicacion.creandocuenta);
  }
  if (Titulouno) {
    Titulouno.textContent = Estadoaplicacion.creandocuenta ? 'Crea tu' : 'Iniciar';
  }
  if (Titulodos) {
    Titulodos.textContent = Estadoaplicacion.creandocuenta ? 'cuenta.' : 'sesión.';
  }
  if (Botonaccioncuenta) {
    Botonaccioncuenta.textContent = Estadoaplicacion.creandocuenta ? 'Crear cuenta' : 'Ingresar';
  }
  if (Botonconmutarregistro) {
    Botonconmutarregistro.textContent = Estadoaplicacion.creandocuenta ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Créala aquí';
  }
}

function Mostrarmensajeerror(Mensajeerror) {
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
  if (!Modaldom) {
    return;
  }
  const Posicionx = Eventoclic && Eventoclic.clientX != null ? Eventoclic.clientX : window.innerWidth / 2;
  const Posiciony = Eventoclic && Eventoclic.clientY != null ? Eventoclic.clientY : window.innerHeight / 2;
  
  Modaldom.style.setProperty('--ox', `${Posicionx}px`);
  Modaldom.style.setProperty('--oy', `${Posiciony}px`);
  
  if (Indicehabitacion !== undefined && Indicehabitacion !== null) {
    Estadoaplicacion.habitacionseleccionada = Indicehabitacion;
  }
  
  Estadoaplicacion.pasomodal = Pasodeseado === 'login'
    ? 'login'
    : (Estadoaplicacion.usuariologueado ? 'dates' : 'choose');
    
  Mostrarmensajeerror('');
  Refrescarpantalla();
  
  Modaldom.classList.add('is-anim');
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      Modaldom.classList.add('is-open');
    });
  });
  document.body.style.overflow = 'hidden';
}

function Cerrarventanamodal() {
  const Modaldom = document.getElementById('modal');
  if (!Modaldom) {
    return;
  }
  Modaldom.classList.remove('is-open');
  document.body.style.overflow = '';
  setTimeout(function() {
    Modaldom.classList.remove('is-anim');
  }, 900);
}
