// Coordinador general de la aplicacion, eventos de reservas y conexion de modulos

document.addEventListener('DOMContentLoaded', function() {
  // Construccion modular de componentes de interfaz
  if (typeof Construirmodalreservas === 'function') {
    Construirmodalreservas();
  }
  if (typeof Renderizarcatalogohabitaciones === 'function') {
    Renderizarcatalogohabitaciones();
  }
  if (typeof Renderizardescanso === 'function') {
    Renderizardescanso();
  }
  if (typeof Renderizarpiedepagina === 'function') {
    Renderizarpiedepagina();
  }

  // Carga de sesion previa si existe en almacenamiento local
  const Sesionguardada = Obtenerdatossesion();
  if (Sesionguardada) {
    Estadoaplicacion.usuariologueado = Sesionguardada;
    Estadoaplicacion.nombreviajero = Sesionguardada;
  }

  // Observador del estado de autenticacion de Firebase
  if (typeof Observadorestadoautenticacion === 'function') {
    Observadorestadoautenticacion(function(Usuario) {
      if (Usuario) {
        const Nombreidentificado = Usuario.displayName || (Usuario.email ? Usuario.email.split('@')[0] : 'viajero');
        Estadoaplicacion.usuariologueado = Nombreidentificado;
        if (!Estadoaplicacion.nombreviajero) {
          Estadoaplicacion.nombreviajero = Usuario.displayName || Nombreidentificado;
        }
        if (Usuario.email) {
          Estadoaplicacion.correoviajero = Usuario.email;
        }
        Guardardatossesion(Nombreidentificado);
      } else {
        Estadoaplicacion.usuariologueado = '';
        Estadoaplicacion.nombreviajero = '';
        Estadoaplicacion.correoviajero = '';
        if (typeof Limpiardatossesion === 'function') {
          Limpiardatossesion();
        }
      }
      Refrescarpantalla();
    });
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

  // Manejo de eventos de entrada y vinculacion segura de campos permitidos
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
    const Dropdownusuario = document.getElementById('navUserDropdown');
    const Botonmenuusuario = document.getElementById('btnNavUser');
    if (Eventoteclado.key === 'Escape' && Dropdownusuario && !Dropdownusuario.hidden) {
      Dropdownusuario.hidden = true;
      if (Botonmenuusuario) Botonmenuusuario.setAttribute('aria-expanded', 'false');
    }
  });

  // Control de apertura y cierre del menu desplegable de usuario
  const Botonmenuusuario = document.getElementById('btnNavUser');
  const Dropdownusuario = document.getElementById('navUserDropdown');
  if (Botonmenuusuario && Dropdownusuario) {
    Botonmenuusuario.addEventListener('click', function(Evento) {
      Evento.stopPropagation();
      const Estaoculto = Dropdownusuario.hidden;
      Dropdownusuario.hidden = !Estaoculto;
      Botonmenuusuario.setAttribute('aria-expanded', Estaoculto ? 'true' : 'false');
    });

    document.addEventListener('click', function(Evento) {
      if (!Evento.target.closest('#navUserMenu')) {
        Dropdownusuario.hidden = true;
        Botonmenuusuario.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Cierre de sesion en todos los componentes (.js-logout)
  document.addEventListener('click', function(Evento) {
    const Botoncerrarsesion = Evento.target.closest('.js-logout');
    if (!Botoncerrarsesion) {
      return;
    }
    Evento.preventDefault();
    if (Dropdownusuario) {
      Dropdownusuario.hidden = true;
      if (Botonmenuusuario) Botonmenuusuario.setAttribute('aria-expanded', 'false');
    }
    const Accioncierre = typeof Cerrarsesionusuario === 'function'
      ? Cerrarsesionusuario()
      : Promise.resolve();

    Accioncierre
      .then(function() {
        Estadoaplicacion.usuariologueado = '';
        Estadoaplicacion.nombreviajero = '';
        Estadoaplicacion.correoviajero = '';
        Estadoaplicacion.claveviajero = '';
        if (typeof Limpiardatossesion === 'function') {
          Limpiardatossesion();
        }
        Refrescarpantalla();
        if (Estadoaplicacion.pasomodal === 'login') {
          Cambiarpasomodal('choose');
        }
      })
      .catch(function() {
        Estadoaplicacion.usuariologueado = '';
        Estadoaplicacion.nombreviajero = '';
        Estadoaplicacion.correoviajero = '';
        if (typeof Limpiardatossesion === 'function') {
          Limpiardatossesion();
        }
        Refrescarpantalla();
      });
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
      const Correolimpio = (Estadoaplicacion.correoviajero || '').trim();
      const Clavelimpia = Estadoaplicacion.claveviajero || '';

      if (Estadoaplicacion.creandocuenta && !(Estadoaplicacion.nombreviajero || '').trim()) {
        return Mostrarmensajeerror('Escribe tu nombre completo.');
      }
      if (!Validarcorreoelectronico(Correolimpio)) {
        return Mostrarmensajeerror('Revisa tu correo.');
      }
      if (Clavelimpia.length < 6) {
        return Mostrarmensajeerror('La contraseña debe tener al menos 6 caracteres.');
      }

      const Botonenvio = Formulariologin.querySelector('button[type="submit"]');
      const Textobotonoriginal = Botonenvio ? Botonenvio.innerHTML : '';
      if (Botonenvio) {
        Botonenvio.disabled = true;
        Botonenvio.textContent = 'Verificando...';
      }

      const Promesaautenticacion = Estadoaplicacion.creandocuenta
        ? Registrarnuevousuario(Estadoaplicacion.nombreviajero.trim(), Correolimpio, Clavelimpia)
        : Iniciarsesionusuario(Correolimpio, Clavelimpia);

      Promesaautenticacion
        .then(function(Respuesta) {
          const Usuariodatos = Respuesta.user || Respuesta;
          const Nombreasignado = Usuariodatos.displayName || Usuariodatos.email.split('@')[0];
          Estadoaplicacion.usuariologueado = Nombreasignado;
          Estadoaplicacion.nombreviajero = Nombreasignado;
          Estadoaplicacion.correoviajero = Usuariodatos.email;
          Guardardatossesion(Nombreasignado);
          Mostrarmensajeerror('');
          Cambiarpasomodal('dates');
        })
        .catch(function(Errorautenticacion) {
          const Codigoerror = Errorautenticacion.code || '';
          Mostrarmensajeerror(Traducirerrorfirebase(Codigoerror));
        })
        .finally(function() {
          if (Botonenvio) {
            Botonenvio.disabled = false;
            Botonenvio.innerHTML = Textobotonoriginal;
          }
        });
    });
  }

  // Autenticacion y registro con cuenta de Google
  const Botongoogle = document.getElementById('btnGoogleAuth');
  if (Botongoogle) {
    Botongoogle.addEventListener('click', function() {
      Mostrarmensajeerror('');
      const Contenidobotonoriginal = Botongoogle.innerHTML;
      Botongoogle.disabled = true;
      Botongoogle.textContent = 'Conectando con Google...';

      Autenticarcongoogle()
        .then(function(Respuesta) {
          const Usuariodatos = Respuesta.user || Respuesta;
          const Nombreasignado = Usuariodatos.displayName || (Usuariodatos.email ? Usuariodatos.email.split('@')[0] : 'viajero');
          Estadoaplicacion.usuariologueado = Nombreasignado;
          Estadoaplicacion.nombreviajero = Nombreasignado;
          if (Usuariodatos.email) {
            Estadoaplicacion.correoviajero = Usuariodatos.email;
          }
          Guardardatossesion(Nombreasignado);
          Mostrarmensajeerror('');
          Cambiarpasomodal('dates');
        })
        .catch(function(Errorautenticacion) {
          const Codigoerror = Errorautenticacion.code || '';
          Mostrarmensajeerror(Traducirerrorfirebase(Codigoerror));
        })
        .finally(function() {
          Botongoogle.disabled = false;
          Botongoogle.innerHTML = Contenidobotonoriginal;
        });
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
      const Nombrelimpio = Sanitizartexto(Estadoaplicacion.nombreviajero, 80);
      const Cedulalimpia = Sanitizartexto(Estadoaplicacion.cedulaviajero, 20);
      const Celularlimpio = Sanitizartexto(Estadoaplicacion.celularviajero, 20);
      const Horalimpia = Sanitizartexto(Estadoaplicacion.horallegada, 40);

      if (!Nombrelimpio) {
        return Mostrarmensajeerror('Escribe tu nombre.');
      }
      if (!Validarcedulacolombiana(Cedulalimpia)) {
        return Mostrarmensajeerror('Ingresa una cédula colombiana válida (6 a 10 dígitos).');
      }
      if (!Validarnumerocelular(Celularlimpio)) {
        return Mostrarmensajeerror('Escribe un celular válido.');
      }
      Estadoaplicacion.nombreviajero = Nombrelimpio;
      Estadoaplicacion.cedulaviajero = Cedulalimpia.replace(/\D/g, '');
      Estadoaplicacion.celularviajero = Celularlimpio;
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
