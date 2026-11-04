// Modulo de gestion y renderizado del bloque de descanso y comodidades

const Tarjetasdescanso = [
  {
    numero: 'i.',
    titulo: 'Silencio',
    descripcion: 'Solo seis habitaciones. Sin fiestas, sin ruido de ciudad.'
  },
  {
    numero: 'ii.',
    titulo: 'Aire frío',
    descripcion: 'Aire acondicionado para dormir bien en el calor guajiro.'
  },
  {
    numero: 'iii.',
    titulo: 'Llega tarde',
    descripcion: 'Avísanos tu hora y te esperamos, aunque sea de madrugada.'
  },
  {
    numero: 'iv.',
    titulo: 'Parqueadero',
    descripcion: 'Espacio para tu carro o moto mientras descansas.'
  }
];

function Renderizardescanso() {
  const Contenedordescanso = document.getElementById('cardsDescanso') || document.querySelector('#descanso .cards');
  if (!Contenedordescanso) {
    return;
  }
  if (!Contenedordescanso.id) {
    Contenedordescanso.id = 'cardsDescanso';
  }

  let Htmltarjetas = '';
  Tarjetasdescanso.forEach(function(Tarjeta) {
    Htmltarjetas += `
      <div class="card" data-reveal data-tilt>
        <span class="card__n">${Tarjeta.numero}</span>
        <div>
          <span class="card__t">${Tarjeta.titulo}</span>
          <span class="card__d">${Tarjeta.descripcion}</span>
        </div>
      </div>
    `;
  });

  Contenedordescanso.innerHTML = Htmltarjetas;
}

