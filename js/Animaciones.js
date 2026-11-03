// Modulo de animaciones, microinteracciones y efectos visuales de desplazamiento

function Inicializaranimaciones() {
  const Esmousefino = window.matchMedia('(pointer:fine)').matches;

  // Cortina de bienvenida inicial
  const Cortinaintro = document.getElementById('intro');
  function Marcarlisto() {
    document.body.classList.add('is-ready');
  }

  if (Configuracionhotel.mostrarcortina && Cortinaintro) {
    setTimeout(function() {
      Cortinaintro.classList.add('is-up');
      Marcarlisto();
    }, 1700);
    setTimeout(function() {
      Cortinaintro.remove();
    }, 2800);
  } else {
    if (Cortinaintro) {
      Cortinaintro.remove();
    }
    Marcarlisto();
  }

  // Barra de progreso, parallax, marquesina e isotipo de fondo en scroll
  const Barranavegacion = document.getElementById('nav');
  const Barralectura = document.getElementById('progress');
  const Mediaprincipal = document.getElementById('heroMedia');
  const Contenidoprincipal = document.getElementById('heroContent');
  const Marquesinatexto = document.getElementById('marquee');
  const Fondomarca = document.getElementById('water');
  let Posicionprevia = 0;
  let Temporizadormarquesina;

  function Manejardesplazamiento() {
    const Posicionvertical = window.scrollY;
    const Alturaventana = window.innerHeight;

    if (Barranavegacion) {
      Barranavegacion.classList.toggle('is-scrolled', Posicionvertical > 40);
    }
    if (Barralectura) {
      const Alturatotal = Math.max(1, document.documentElement.scrollHeight - Alturaventana);
      Barralectura.style.transform = `scaleX(${Posicionvertical / Alturatotal})`;
    }
    if (Mediaprincipal && Contenidoprincipal && Posicionvertical < Alturaventana * 1.2) {
      Mediaprincipal.style.transform = `translateY(${Posicionvertical * 0.4}px) scale(${1 + (Posicionvertical / Alturaventana) * 0.12})`;
      Contenidoprincipal.style.transform = `translateY(${Posicionvertical * -0.15}px)`;
      Contenidoprincipal.style.opacity = Math.max(0, 1 - Posicionvertical / (Alturaventana * 0.75));
    }
    if (Marquesinatexto) {
      const Velocidadscroll = Posicionvertical - Posicionprevia;
      Posicionprevia = Posicionvertical;
      Marquesinatexto.style.transform = `skewY(${Math.max(-3, Math.min(3, Velocidadscroll * 0.12))}deg)`;
      clearTimeout(Temporizadormarquesina);
      Temporizadormarquesina = setTimeout(function() {
        Marquesinatexto.style.transform = 'none';
      }, 120);
    }
    if (Fondomarca && Fondomarca.parentElement) {
      const Rectangulomarcapadre = Fondomarca.parentElement.getBoundingClientRect();
      const Progresorectangulo = (Alturaventana - Rectangulomarcapadre.top) / (Alturaventana + Rectangulomarcapadre.height);
      Fondomarca.style.transform = `translateY(${(Progresorectangulo - 0.5) * 160}px) rotate(${(Progresorectangulo - 0.5) * 24}deg)`;
    }
  }

  window.addEventListener('scroll', Manejardesplazamiento, { passive: true });
  Manejardesplazamiento();

  // Aparicion escalonada de elementos con IntersectionObserver
  const Elementosrevelar = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const Observadoraparicion = new IntersectionObserver(function(Entradas, Observador) {
      Entradas.forEach(function(Entrada) {
        if (!Entrada.isIntersecting) {
          return;
        }
        const Elementodestino = Entrada.target;
        Observador.unobserve(Elementodestino);
        const Hermanosrevelar = Array.from(Elementodestino.parentElement.children).filter(function(Hijo) {
          return Hijo.hasAttribute('data-reveal');
        });
        const Indicehermano = Hermanosrevelar.indexOf(Elementodestino);
        Elementodestino.style.transitionDelay = `${Math.max(0, Indicehermano) * 0.09}s`;
        Elementodestino.classList.remove('pre');
        Elementodestino.addEventListener('transitionend', function() {
          Elementodestino.style.transitionDelay = '0s';
        }, { once: true });
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });

    Elementosrevelar.forEach(function(Elementorevelar) {
      if (Elementorevelar.getBoundingClientRect().top > window.innerHeight * 0.85) {
        Elementorevelar.classList.add('pre');
        Observadoraparicion.observe(Elementorevelar);
      }
    });
  }

  // Chat simulado de atencion por WhatsApp
  const Contenedorchat = document.getElementById('chat');
  if (Contenedorchat && 'IntersectionObserver' in window) {
    new IntersectionObserver(function(Entradaschat, Observadorchat) {
      if (!Entradaschat[0].isIntersecting) {
        return;
      }
      Observadorchat.disconnect();
      let Indicemensaje = 0;

      function Agregarburbuja(Mensajedato) {
        const Cajaxat = document.createElement('div');
        Cajaxat.className = `bubble ${Mensajedato.mio ? 'bubble--me' : 'bubble--bot'}`;
        Cajaxat.textContent = Mensajedato.texto;
        Contenedorchat.appendChild(Cajaxat);
      }

      function Siguientemensaje() {
        if (Indicemensaje >= Mensajeschat.length) {
          return;
        }
        const Mensajeturno = Mensajeschat[Indicemensaje++];
        if (Mensajeturno.mio) {
          Agregarburbuja(Mensajeturno);
          setTimeout(Siguientemensaje, 700);
        } else {
          const Escribiendodom = document.createElement('div');
          Escribiendodom.className = 'typing';
          Escribiendodom.innerHTML = '<span></span><span></span><span></span>';
          Contenedorchat.appendChild(Escribiendodom);
          setTimeout(function() {
            Escribiendodom.remove();
            Agregarburbuja(Mensajeturno);
            setTimeout(Siguientemensaje, 900);
          }, 1300);
        }
      }
      setTimeout(Siguientemensaje, 300);
    }, { threshold: 0.4 }).observe(Contenedorchat);
  }

  // Microinteracciones de puntero: botones magneticos e inclinacion tridimensional
  if (Esmousefino) {
    document.querySelectorAll('[data-magnetic]').forEach(function(Elementomagnetico) {
      Elementomagnetico.addEventListener('pointermove', function(Evento) {
        const Rectangulo = Elementomagnetico.getBoundingClientRect();
        const Desplazamientox = (Evento.clientX - Rectangulo.left - Rectangulo.width / 2) * 0.3;
        const Desplazamientoy = (Evento.clientY - Rectangulo.top - Rectangulo.height / 2) * 0.35;
        Elementomagnetico.style.translate = `${Desplazamientox}px ${Desplazamientoy}px`;
      });
      Elementomagnetico.addEventListener('pointerleave', function() {
        Elementomagnetico.style.transition = (getComputedStyle(Elementomagnetico).transition || '') + ', translate .6s cubic-bezier(.16,1,.3,1)';
        Elementomagnetico.style.translate = '0 0';
      });
    });

    document.querySelectorAll('[data-tilt]').forEach(function(Tarjetainclinada) {
      Tarjetainclinada.addEventListener('pointermove', function(Evento) {
        const Rectangulo = Tarjetainclinada.getBoundingClientRect();
        const Porcentajex = (Evento.clientX - Rectangulo.left) / Rectangulo.width - 0.5;
        const Porcentajey = (Evento.clientY - Rectangulo.top) / Rectangulo.height - 0.5;
        Tarjetainclinada.style.transform = `perspective(700px) rotateX(${-Porcentajey * 10}deg) rotateY(${Porcentajex * 12}deg) translateZ(10px)`;
      });
      Tarjetainclinada.addEventListener('pointerleave', function() {
        Tarjetainclinada.style.transform = '';
      });
    });
  }

  // Transicion fluida de barrido entre secciones del sitio
  document.addEventListener('click', function(Eventoclic) {
    const Enlaceancla = Eventoclic.target.closest('a[href^="#"]');
    if (!Enlaceancla || Enlaceancla.classList.contains('skip-link')) {
      return;
    }
    const Identificadorancla = Enlaceancla.getAttribute('href');
    const Elementodestino = Identificadorancla && Identificadorancla.length > 1 && document.querySelector(Identificadorancla);
    if (!Elementodestino) {
      return;
    }
    Eventoclic.preventDefault();
    const Capabarrido = document.createElement('div');
    Capabarrido.className = 'sweep';
    Capabarrido.innerHTML = '<img src="assets/nissi-mark.png" alt="">';
    document.body.appendChild(Capabarrido);
    const Curvasuave = 'cubic-bezier(.77,0,.18,1)';
    Capabarrido.animate(
      [{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
      { duration: 620, easing: Curvasuave, fill: 'forwards' }
    ).onfinish = function() {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, Elementodestino.getBoundingClientRect().top + window.scrollY - (Identificadorancla === '#inicio' ? 0 : 60));
      document.documentElement.style.scrollBehavior = '';
      Manejardesplazamiento();
      Capabarrido.firstChild.animate(
        [{ opacity: 0, transform: 'translateY(30px) scale(.8)' }, { opacity: 1, transform: 'none' }],
        { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' }
      );
      setTimeout(function() {
        Capabarrido.animate(
          [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }],
          { duration: 720, easing: Curvasuave, fill: 'forwards' }
        ).onfinish = function() {
          Capabarrido.remove();
        };
      }, 420);
    };
  });

  // Cursor personalizado fluido y onda al dar clic
  if (Configuracionhotel.cursorpersonalizado && Esmousefino) {
    const Cursorflotante = document.createElement('div');
    Cursorflotante.className = 'cursor';
    Cursorflotante.innerHTML = '<span></span>';
    document.body.appendChild(Cursorflotante);
    const Etiquetacursor = Cursorflotante.firstChild;
    let Cursorx = 0;
    let Cursory = 0;
    let Destinox = 0;
    let Destinoy = 0;

    window.addEventListener('pointermove', function(Eventopuntero) {
      Destinox = Eventopuntero.clientX;
      Destinoy = Eventopuntero.clientY;
      Cursorflotante.style.opacity = 1;
      const Elementoetiqueta = Eventopuntero.target.closest('[data-cursor]');
      const Elementoactivo = Eventopuntero.target.closest('a,button,input,label');
      Cursorflotante.classList.toggle('is-label', Boolean(Elementoetiqueta));
      Cursorflotante.classList.toggle('is-hot', !Elementoetiqueta && Boolean(Elementoactivo));
      if (Elementoetiqueta) {
        Etiquetacursor.textContent = Elementoetiqueta.dataset.cursor;
      }
    });

    function Animarcursor() {
      Cursorx += (Destinox - Cursorx) * 0.2;
      Cursory += (Destinoy - Cursory) * 0.2;
      Cursorflotante.style.transform = `translate(${Cursorx}px,${Cursory}px) translate(-50%,-50%)`;
      requestAnimationFrame(Animarcursor);
    }
    Animarcursor();
  }

  window.addEventListener('pointerdown', function(Eventopulsacion) {
    const Ondaclic = document.createElement('span');
    Ondaclic.className = 'ripple';
    Ondaclic.style.left = `${Eventopulsacion.clientX}px`;
    Ondaclic.style.top = `${Eventopulsacion.clientY}px`;
    document.body.appendChild(Ondaclic);
    Ondaclic.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
        { transform: 'translate(-50%,-50%) scale(7)', opacity: 0 }
      ],
      { duration: 750, easing: 'cubic-bezier(.2,.8,.2,1)' }
    ).onfinish = function() {
      Ondaclic.remove();
    };
  });
}

