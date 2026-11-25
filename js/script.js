// Coordinación general de la portada, disponibilidad en vivo y flujo de reserva

document.addEventListener('DOMContentLoaded', function() {
  const Abririniciosesion = new URLSearchParams(window.location.search).get('ingresar') === '1';
  if (Abririniciosesion) {
    Configuracionhotel.mostrarcortina = false;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
  }

  if (typeof Construirmodalreservas === 'function') Construirmodalreservas();
  if (typeof Renderizarcatalogohabitaciones === 'function') Renderizarcatalogohabitaciones();
  if (typeof Renderizardescanso === 'function') Renderizardescanso();
  if (typeof Renderizarpiedepagina === 'function') Renderizarpiedepagina();
  if (typeof Inicializarsesionusuario === 'function') Inicializarsesionusuario();

  const Cadenahoy = Formatearfechalocal(new Date());
  document.querySelectorAll('input[type="date"]').forEach(function(Campofecha) {
    Campofecha.min = Cadenahoy;
  });

  function Sincronizardisponibilidadfechas() {
    if (!Estadoaplicacion.fechallegada || !Estadoaplicacion.fechasalida) {
      return;
    }
    Consultardisponibilidadservidor(
      Estadoaplicacion.fechallegada,
      Estadoaplicacion.fechasalida,
      Estadoaplicacion.cantidadhuespedes
    ).then(function(Respuesta) {
      if (!Respuesta || !Array.isArray(Respuesta.todas)) {
        return;
      }
      const Mapa = {};
      Respuesta.todas.forEach(function(Hab) {
        Mapa[Hab.numero] = Hab.disponible;
      });
      Estadoaplicacion.mapaocupacion = Mapa;
      Refrescarpantalla();
    });
  }

  const Campospermitidos = ['fechallegada', 'fechasalida', 'nombreviajero', 'cedulaviajero', 'celularviajero', 'horallegada', 'correoviajero', 'claveviajero'];
  document.addEventListener('input', function(Eventoentrada) {
    const Campovinculado = Eventoentrada.target.dataset && Eventoentrada.target.dataset.bind;
    if (!Campovinculado || Campospermitidos.indexOf(Campovinculado) === -1) {
      return;
    }
    const Valorlimpio = Campovinculado === 'claveviajero'
      ? String(Eventoentrada.target.value || '').slice(0, 128)
      : String(Eventoentrada.target.value || '').replace(/[<>]/g, '').slice(0, 120);
    Estadoaplicacion[Campovinculado] = Valorlimpio;
    Mostrarmensajeerror('');
    Refrescarpantalla();

    if (Campovinculado === 'fechallegada' || Campovinculado === 'fechasalida') {
      Sincronizardisponibilidadfechas();
    }
  });

  document.addEventListener('click', function(Eventoclic) {
    const Botonhuespedes = Eventoclic.target.closest('[data-guests]');
    if (Botonhuespedes) {
      const Ajustecantidad = parseInt(Botonhuespedes.dataset.guests, 10);
      Estadoaplicacion.cantidadhuespedes = Math.max(1, Math.min(3, Estadoaplicacion.cantidadhuespedes + Ajustecantidad));
      Refrescarpantalla();
      Sincronizardisponibilidadfechas();
    }

    const Botonseleccionhabitacion = Eventoclic.target.closest('[data-pick]');
    if (Botonseleccionhabitacion) {
      const Indiceelegido = parseInt(Botonseleccionhabitacion.dataset.pick, 10);
      const Habitacionelegida = Habitacioneshotel[Indiceelegido];
      if (Habitacionelegida.mantenimiento) {
        return Mostrarmensajeerror('No disponible temporalmente, te invitamos a ver las demás habitaciones.');
      }
      if (Estadoaplicacion.mapaocupacion[Habitacionelegida.numero] === false) {
        return Mostrarmensajeerror(`La habitación ${Habitacionelegida.numero} ya está ocupada en esas fechas.`);
      }
      Estadoaplicacion.habitacionseleccionada = Indiceelegido;
      Mostrarmensajeerror('');
      Refrescarpantalla();
    }

    const Botonavanzar = Eventoclic.target.closest('[data-go]');
    if (Botonavanzar) {
      Cambiarpasomodal(Botonavanzar.dataset.go);
    }
  });

  document.querySelectorAll('.js-book').forEach(function(Botonreservar) {
    Botonreservar.addEventListener('click', function(Evento) {
      Abrirventanamodal(Evento);
      Sincronizardisponibilidadfechas();
    });
  });

  document.querySelectorAll('.js-login').forEach(function(Botonlogin) {
    Botonlogin.addEventListener('click', function(Evento) {
      Abrirventanamodal(Evento, Estadoaplicacion.usuariologueado ? null : 'login');
    });
  });

  document.querySelectorAll('[data-book]').forEach(function(Botonreservaespecifica) {
    Botonreservaespecifica.addEventListener('click', function(Evento) {
      const Indicehabitacion = parseInt(Botonreservaespecifica.dataset.book, 10);
      Abrirventanamodal(Evento, null, Indicehabitacion);
      Sincronizardisponibilidadfechas();
    });
  });

  document.querySelectorAll('.js-close').forEach(function(Botoncerrar) {
    Botoncerrar.addEventListener('click', Cerrarventanamodal);
  });

  document.addEventListener('keydown', function(Eventoteclado) {
    const Modaldom = document.getElementById('modal');
    if (Eventoteclado.key === 'Escape' && Modaldom && Modaldom.classList.contains('is-open')) {
      Cerrarventanamodal();
    }
    const Dropdownusuario = document.getElementById('navUserDropdown');
    const Botonmenuusuario = document.getElementById('btnNavUser');
    if (Eventoteclado.key === 'Escape' && Dropdownusuario && !Dropdownusuario.hidden) {
      Dropdownusuario.hidden = true;
      if (Botonmenuusuario) Botonmenuusuario.setAttribute('aria-expanded', 'false');
    }
  });

  const Botoniradetalles = document.getElementById('toDetails');
  if (Botoniradetalles) {
    Botoniradetalles.addEventListener('click', function() {
      const Nochesestadia = Calcularnochesestadia(Estadoaplicacion.fechallegada, Estadoaplicacion.fechasalida);
      if (Nochesestadia <= 0) {
        return Mostrarmensajeerror('Elige llegada y salida.');
      }
      const Habitacionactual = Habitacioneshotel[Estadoaplicacion.habitacionseleccionada];
      if (Habitacionactual.mantenimiento || Estadoaplicacion.mapaocupacion[Habitacionactual.numero] === false) {
        return Mostrarmensajeerror(`La habitación ${Habitacionactual.numero} no está disponible.`);
      }
      Cambiarpasomodal('details');
    });
  }

  let Enviandoreserva = false;
  const Formulariodetalles = document.getElementById('detailsForm');
  if (Formulariodetalles) {
    Formulariodetalles.addEventListener('submit', function(Eventodetalles) {
      Eventodetalles.preventDefault();
      if (Enviandoreserva) {
        return;
      }

      const Nombrelimpio = Sanitizartexto(Estadoaplicacion.nombreviajero, 80);
      const Cedulalimpia = Sanitizartexto(Estadoaplicacion.cedulaviajero, 20);
      const Celularlimpio = Sanitizartexto(Estadoaplicacion.celularviajero, 20);
      const Horalimpia = Sanitizartexto(Estadoaplicacion.horallegada, 40);

      if (!Nombrelimpio) {
        return Mostrarmensajeerror('Escribe tu nombre.');
      }
      if (!Validarcedulacolombiana(Cedulalimpia)) {
        return Mostrarmensajeerror('Ingresa una cédula colombiana válida (6 a 8 dígitos, o 10 dígitos iniciando en 1).');
      }
      if (!Validarnumerocelular(Celularlimpio)) {
        return Mostrarmensajeerror('Ingresa un celular colombiano válido de 10 dígitos (ej. 3001234567).');
      }

      Estadoaplicacion.nombreviajero = Nombrelimpio;
      Estadoaplicacion.cedulaviajero = Cedulalimpia.replace(/\D/g, '');
      Estadoaplicacion.celularviajero = Normalizarcelularcolombianocliente(Celularlimpio) || Celularlimpio;
      Estadoaplicacion.horallegada = Horalimpia;
      Estadoaplicacion.codigoreserva = Generarcodigoreserva();

      const Solicitudreserva = {
        codigo: Estadoaplicacion.codigoreserva,
        nombre: Nombrelimpio,
        cedula: Estadoaplicacion.cedulaviajero,
        celular: Celularlimpio,
        llegada: Estadoaplicacion.fechallegada,
        salida: Estadoaplicacion.fechasalida,
        huespedes: Estadoaplicacion.cantidadhuespedes,
        habitacion: Habitacioneshotel[Estadoaplicacion.habitacionseleccionada].numero,
        horallegada: Horalimpia
      };

      const Botonconfirmar = document.getElementById('btnConfirmarReserva');
      Enviandoreserva = true;
      if (Botonconfirmar) {
        Botonconfirmar.disabled = true;
        Botonconfirmar.textContent = 'Registrando...';
      }

      Enviarsolicitudservidor(Solicitudreserva)
        .then(function(Respuesta) {
          if (Respuesta && Respuesta.exito === false && Respuesta.mensaje) {
            Mostrarmensajeerror(Respuesta.mensaje);
            return;
          }
          if (Respuesta && Respuesta.codigo) {
            Estadoaplicacion.codigoreserva = Respuesta.codigo;
          }
          Cambiarpasomodal('done');
        })
        .catch(function() {
          Cambiarpasomodal('done');
        })
        .finally(function() {
          Enviandoreserva = false;
          if (Botonconfirmar) {
            Botonconfirmar.disabled = false;
            Botonconfirmar.textContent = 'Confirmar reserva';
          }
        });
    });
  }

  const Elementoshabitacion = document.querySelectorAll('.room');
  const Elementosfoto = document.querySelectorAll('[data-photo]');
  const Numeroindicador = document.getElementById('roomNum');

  Elementoshabitacion.forEach(function(Cajahabitacion, Indice) {
    const Botonacordeon = Cajahabitacion.querySelector('.room__btn');
    if (Botonacordeon) {
      Botonacordeon.addEventListener('click', function() {
        Elementoshabitacion.forEach(function(Habitacionitem, Indiceitem) {
          Habitacionitem.classList.toggle('is-active', Indice === Indiceitem);
        });
        Elementosfoto.forEach(function(Fotoitem, Indiceitem) {
          Fotoitem.classList.toggle('is-active', Indice === Indiceitem);
          Fotoitem.classList.toggle('is-before', Indiceitem < Indice);
        });
        if (Numeroindicador) {
          Numeroindicador.textContent = Habitacioneshotel[Indice].numero;
        }
      });
    }
  });

  Inicializaranimaciones();
  Refrescarpantalla();

  if (Abririniciosesion) {
    Estadoaplicacion.creandocuenta = false;
    Abrirventanamodal(null, 'login');
  }
});
