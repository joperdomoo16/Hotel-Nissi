// Gestión del menú de cuenta, inicio de sesión, registro y recuperación de clave

function Inicializarsesionusuario() {
  const Sesionguardada = Obtenerdatossesion();
  if (Sesionguardada) {
    Estadoaplicacion.usuariologueado = Sesionguardada;
    Estadoaplicacion.nombreviajero = Sesionguardada;
  }

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
    if (typeof Verificarresultadoredireccion === 'function') {
      Verificarresultadoredireccion(Mostrarmensajeerror);
    }
  }

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

    const Limpiarlocales = function() {
      Estadoaplicacion.usuariologueado = '';
      Estadoaplicacion.nombreviajero = '';
      Estadoaplicacion.correoviajero = '';
      Estadoaplicacion.claveviajero = '';
      if (typeof Limpiardatossesion === 'function') {
        Limpiardatossesion();
      }
      Refrescarpantalla();
    };

    const Accioncierre = typeof Cerrarsesionusuario === 'function'
      ? Cerrarsesionusuario()
      : Promise.resolve();

    Accioncierre
      .then(function() {
        Limpiarlocales();
        if (Estadoaplicacion.pasomodal === 'login') {
          Cambiarpasomodal('choose');
        }
      })
      .catch(Limpiarlocales);
  });

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
      const Etiquetaenvio = document.getElementById('loginCta');
      if (Botonenvio) Botonenvio.disabled = true;
      if (Etiquetaenvio) Etiquetaenvio.textContent = 'Verificando...';

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
          Estadoaplicacion.claveviajero = '';
          Guardardatossesion(Nombreasignado);
          Mostrarmensajeerror('');
          Cambiarpasomodal('dates');
        })
        .catch(function(Errorautenticacion) {
          const Codigoerror = (Errorautenticacion && Errorautenticacion.code) || '';
          Mostrarmensajeerror(Traducirerrorfirebase(Codigoerror));
        })
        .finally(function() {
          if (Botonenvio) Botonenvio.disabled = false;
          if (Etiquetaenvio) {
            Etiquetaenvio.textContent = Estadoaplicacion.creandocuenta ? 'Crear cuenta' : 'Ingresar';
          }
        });
    });
  }

  const Botonolvideclave = document.getElementById('forgotPass');
  if (Botonolvideclave) {
    Botonolvideclave.addEventListener('click', function() {
      const Correolimpio = (Estadoaplicacion.correoviajero || '').trim();
      if (!Validarcorreoelectronico(Correolimpio)) {
        return Mostrarmensajeerror('Escribe tu correo arriba y vuelve a dar clic en «¿Olvidaste tu contraseña?».');
      }

      const Textooriginal = Botonolvideclave.textContent;
      Botonolvideclave.disabled = true;
      Botonolvideclave.textContent = 'Enviando enlace...';

      Solicitarrecuperacionclave(Correolimpio)
        .then(function() {
          Mostrarmensajeerror('');
          Mostrarmensajeexito(`Si ${Correolimpio} tiene una cuenta, te llegará un enlace para crear una nueva contraseña. Revisa también la carpeta de spam.`);
        })
        .catch(function(Errorrecuperacion) {
          Mostrarmensajeerror(Traducirerrorfirebase((Errorrecuperacion && Errorrecuperacion.code) || ''));
        })
        .finally(function() {
          Botonolvideclave.disabled = false;
          Botonolvideclave.textContent = Textooriginal;
        });
    });
  }

  const Botongoogle = document.getElementById('btnGoogleAuth');
  if (Botongoogle) {
    Botongoogle.addEventListener('click', function() {
      Mostrarmensajeerror('');
      const Etiquetagoogle = document.getElementById('googleCta');
      Botongoogle.disabled = true;
      if (Etiquetagoogle) Etiquetagoogle.textContent = 'Conectando con Google...';

      Autenticarcongoogle()
        .then(function(Respuesta) {
          if (!Respuesta) { return; }
          const Usuariodatos = Respuesta.user || Respuesta;
          if (!Usuariodatos || (!Usuariodatos.displayName && !Usuariodatos.email)) { return; }
          const Nombreasignado = Usuariodatos.displayName || Usuariodatos.email.split('@')[0];
          Estadoaplicacion.usuariologueado = Nombreasignado;
          Estadoaplicacion.nombreviajero = Nombreasignado;
          if (Usuariodatos.email) { Estadoaplicacion.correoviajero = Usuariodatos.email; }
          Guardardatossesion(Nombreasignado);
          Mostrarmensajeerror('');
          Cambiarpasomodal('dates');
        })
        .catch(function(Errorautenticacion) {
          Mostrarmensajeerror(Traducirerrorfirebase((Errorautenticacion && Errorautenticacion.code) || ''));
        })
        .finally(function() {
          Botongoogle.disabled = false;
          if (Etiquetagoogle) {
            Etiquetagoogle.textContent = Estadoaplicacion.creandocuenta ? 'Registrarse con Google' : 'Continuar con Google';
          }
        });
    });
  }
}
