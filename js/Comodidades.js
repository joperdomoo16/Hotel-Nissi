// Tarjetas de comodidades y descanso en la portada

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
    descripcion: 'Espacio amplio para motos, carros y vehículos grandes mientras descansas.'
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

  Contenedordescanso.textContent = '';
  Tarjetasdescanso.forEach(function(Tarjeta) {
    const Caja = document.createElement('div');
    Caja.className = 'card';
    Caja.setAttribute('data-reveal', '');
    Caja.setAttribute('data-tilt', '');

    const Numero = document.createElement('span');
    Numero.className = 'card__n';
    Numero.textContent = Tarjeta.numero;

    const Texto = document.createElement('div');
    const Titulo = document.createElement('span');
    Titulo.className = 'card__t';
    Titulo.textContent = Tarjeta.titulo;
    const Descripcion = document.createElement('span');
    Descripcion.className = 'card__d';
    Descripcion.textContent = Tarjeta.descripcion;

    Texto.appendChild(Titulo);
    Texto.appendChild(Descripcion);
    Caja.appendChild(Numero);
    Caja.appendChild(Texto);
    Contenedordescanso.appendChild(Caja);
  });
}
