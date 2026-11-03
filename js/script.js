// Coordinador general de la aplicacion, eventos de reservas y conexion de modulos

document.addEventListener('DOMContentLoaded', function() {
  // Carga de sesion previa si existe en almacenamiento local
  const Sesionguardada = Obtenerdatossesion();
  if (Sesionguardada) {
    Estadoaplicacion.usuariologueado = Sesionguardada;
    Estadoaplicacion.nombreviajero = Sesionguardada;
  }

  // Establecer fecha minima de llegada para el dia de hoy
  const Hoyfecha = new Date();
  const Anoformato = Hoyfecha.getFullYear();
  const Mesformato = String(Hoyfecha.getMonth() + 1).padStart(2, '0');
  const Diaformato = String(Hoyfecha.getDate()).padStart(2, '0');
  const Cadenahoy = `${Anoformato}-${Mesformato}-${Diaformato}`;

  document.querySelectorAll('input[type="date"]').forEach(function(Campofecha) {
    Campofecha.min = Cadenahoy;
  });

  // Consulta de disponibilidad en tiempo real con Google Sheets
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

  // Manejo de eventos de entrada y vinculacion de campos
  document.addEventListener('input', function(Eventoentrada) {
    const Campovinculado = Eventoentrada.target.dataset && Eventoentrada.target.dataset.bind;
    if (!Campovinculado) {
      return;
    }
    Estadoaplicacion[Campovinculado] = Eventoentrada.target.value;
    Mostrarmensajeerror('');
    Refrescarpantalla();

    if (Campovinculado === 'fechallegada' || Campovinculado === 'fechasalida') {
      Sincronizardisponibilidadfechas();
    }
  });

  // Delegacion de clics para controles de huespedes, seleccion de habitacion y pasos
  document.addEventListener('click', function(Eventoclic) {
    const Botonhuespedes = Eventoclic.target.closest('[data-guests]');
    if (Botonhuespedes) {
      const Ajustecantidad = parseInt(Botonhuespedes.dataset.guests, 10);
      Estadoaplicacion.cantidadhuespedes = Math.max(1, Math.min(4, Estadoaplicacion.cantidadhuespedes + Ajustecantidad));
      Refrescarpantalla();
      Sincronizardisponibilidadfechas();
    }

    const Botonseleccionhabitacion = Eventoclic.target.closest('[data-pick]');
    if (Botonseleccionhabitacion) {
      const Indiceelegido = parseInt(Botonseleccionhabitacion.dataset.pick, 10);
      const Habitacionelegida = Habitacioneshotel[Indiceelegido];
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

  // Apertura y cierre de ventana modal de reservas
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
  });

  // Conmutador y envio de formulario de inicio de sesion o registro
  const Botonconmutar = document.getElementById('toggleReg');
  if (Botonconmutar) {
    Botonconmutar.addEventListener('click', function() {
      Estadoaplicacion.creandocuenta = !Estadoaplicacion.creandocuenta;
      Mostrarmensajeerror('');
      Refrescarpantalla();
    });
  }

  const Formulariologin = document.getElementById('loginForm');
  if (Formulariologin) {
    Formulariologin.addEventListener('submit', function(Eventologin) {
      Eventologin.preventDefault();
      if (Estadoaplicacion.creandocuenta && !(Estadoaplicacion.nombreviajero || '').trim()) {
        return Mostrarmensajeerror('Escribe tu nombre completo.');
      }
      if (!Validarcorreoelectronico(Estadoaplicacion.correoviajero || '')) {
        return Mostrarmensajeerror('Revisa tu correo.');
      }
      if ((Estadoaplicacion.claveviajero || '').length < 4) {
        return Mostrarmensajeerror('La contraseña es muy corta.');
      }
      const Nombreasignado = Estadoaplicacion.creandocuenta && Estadoaplicacion.nombreviajero
        ? Estadoaplicacion.nombreviajero
        : (Estadoaplicacion.correoviajero || '').split('@')[0];
      Estadoaplicacion.usuariologueado = Nombreasignado;
      if (!Estadoaplicacion.nombreviajero) {
        Estadoaplicacion.nombreviajero = Nombreasignado;
      }
      Guardardatossesion(Nombreasignado);
      Cambiarpasomodal('dates');
    });
  }

  // Validacion de fechas antes de pasar al formulario de datos personales
  const Botoniradetalles = document.getElementById('toDetails');
  if (Botoniradetalles) {
    Botoniradetalles.addEventListener('click', function() {
      const Nochesestadia = Calcularnochesestadia(Estadoaplicacion.fechallegada, Estadoaplicacion.fechasalida);
      if (Nochesestadia <= 0) {
        return Mostrarmensajeerror('Elige llegada y salida.');
      }
      const Habitacionactual = Habitacioneshotel[Estadoaplicacion.habitacionseleccionada];
      if (Estadoaplicacion.mapaocupacion[Habitacionactual.numero] === false) {
        return Mostrarmensajeerror(`La habitación ${Habitacionactual.numero} no está disponible.`);
      }
      Cambiarpasomodal('details');
    });
  }

  // Envio de la solicitud final de reserva y sincronizacion con el servidor
  const Formulariodetalles = document.getElementById('detailsForm');
  if (Formulariodetalles) {
    Formulariodetalles.addEventListener('submit', function(Eventodetalles) {
      Eventodetalles.preventDefault();
      if (!(Estadoaplicacion.nombreviajero || '').trim()) {
        return Mostrarmensajeerror('Escribe tu nombre.');
      }
      if (!Validarnumerocelular(Estadoaplicacion.celularviajero || '')) {
        return Mostrarmensajeerror('Escribe un celular válido.');
      }
      Estadoaplicacion.codigoreserva = Generarcodigoreserva();
      const Solicitudreserva = {
        codigo: Estadoaplicacion.codigoreserva,
        nombre: Estadoaplicacion.nombreviajero,
        celular: Estadoaplicacion.celularviajero,
        llegada: Estadoaplicacion.fechallegada,
        salida: Estadoaplicacion.fechasalida,
        huespedes: Estadoaplicacion.cantidadhuespedes,
        habitacion: Habitacioneshotel[Estadoaplicacion.habitacionseleccionada].numero,
        horallegada: Estadoaplicacion.horallegada
      };

      Guardarborradorreserva(Solicitudreserva);
      Enviarsolicitudservidor(Solicitudreserva);
      Cambiarpasomodal('done');
    });
  }

  // Acordeon y transicion de imagenes del catalogo de habitaciones
  const Elementoshabitacion = document.querySelectorAll('.room');
  const Elementosfoto = document.querySelectorAll('[data-photo]');
  const Numeroindicador = document.getElementById('roomNum');

  Elementoshabitacion.forEach(function(Cajahabitacion, Indice) {
    const Botonacordeon = Cajahabitacion.querySelector('.room__btn');
    if (Botonacordeon) {
      Botonacordeon.addEventListener('click', function() {
        Elementoshabitacion.forEach(function(Habitacionitem, Jndice) {
          Habitacionitem.classList.toggle('is-active', Indice === Jndice);
        });
        Elementosfoto.forEach(function(Fotoitem, Jndice) {
          Fotoitem.classList.toggle('is-active', Indice === Jndice);
          Fotoitem.classList.toggle('is-before', Jndice < Indice);
        });
        if (Numeroindicador) {
          Numeroindicador.textContent = Habitacioneshotel[Indice].numero;
        }
      });
    }
  });

  // Inicializar modulo de efectos visuales y microinteracciones
  Inicializaranimaciones();

  // Primer pintado y refresco de interfaz
  Refrescarpantalla();
});
