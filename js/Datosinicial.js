// Catalogo de habitaciones, tarifas en pesos colombianos y datos iniciales del hotel
const Configuracionhotel = {
  celular: '573001234567',
  urlservidor: 'https://script.google.com/macros/s/AKfycbyEAwa8yflxqsW7UwagAJ4AvCYHfSSvZ7djEKnNLS1gprzAjWKqG5zjDGBZ5a4cMyAJew/exec',
  mostrarcortina: true,
  cursorpersonalizado: true,
  nombre: 'Hotel Nissi',
  corregimiento: 'Mingueo',
  municipio: 'Dibulla',
  departamento: 'La Guajira',
  direccion: 'Troncal del Caribe, Mingueo, Dibulla, La Guajira',
  mapas: 'https://maps.app.goo.gl/TudMNAdQRpVyzHZGA',
  waze: 'https://waze.com/ul?ll=11.216310,-73.392264&navigate=yes'
};

const Habitacioneshotel = [
  {
    numero: '01',
    tipo: 'Sencilla',
    capacidad: '1 a 2 personas',
    huespedesmaximos: 2,
    descripcion: 'Cama doble, cortinas oscuras y aire acondicionado. Para llegar, dormir y seguir.',
    detalles: ['Cama doble', 'Aire acondicionado', 'Baño privado', 'Wi-Fi'],
    precio: 90000,
    foto: 'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg?auto=compress&cs=tinysrgb&w=1600'
  },
  {
    numero: '02',
    tipo: 'Sencilla',
    capacidad: '1 a 2 personas',
    huespedesmaximos: 2,
    descripcion: 'La misma calma de la 01, pensada para el trabajador que repite ruta cada semana.',
    detalles: ['Cama doble', 'Aire acondicionado', 'Baño privado', 'Wi-Fi'],
    precio: 90000,
    foto: 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=1600'
  },
  {
    numero: '03',
    tipo: 'Doble',
    capacidad: '2 personas',
    huespedesmaximos: 2,
    descripcion: 'Dos camas para compañeros de viaje o de trabajo. Cada uno descansa a su manera.',
    detalles: ['2 camas', 'Aire acondicionado', 'Baño privado', 'Wi-Fi'],
    precio: 120000,
    foto: 'https://images.pexels.com/photos/279746/pexels-photo-279746.jpeg?auto=compress&cs=tinysrgb&w=1600'
  },
  {
    numero: '04',
    tipo: 'Doble',
    capacidad: '2 personas',
    huespedesmaximos: 2,
    descripcion: 'Dos camas y espacio para el equipaje de una jornada larga.',
    detalles: ['2 camas', 'Aire acondicionado', 'Baño privado', 'Wi-Fi'],
    precio: 120000,
    foto: 'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg?auto=compress&cs=tinysrgb&w=1600'
  },
  {
    numero: '05',
    tipo: 'Triple',
    capacidad: '3 personas',
    huespedesmaximos: 3,
    descripcion: 'Para cuadrillas pequeñas o amigos camino a Palomino.',
    detalles: ['3 camas', 'Aire acondicionado', 'Baño privado', 'Wi-Fi'],
    precio: 150000,
    foto: 'https://images.pexels.com/photos/237371/pexels-photo-237371.jpeg?auto=compress&cs=tinysrgb&w=1600'
  },
  {
    numero: '06',
    tipo: 'Familiar',
    capacidad: '4 personas',
    huespedesmaximos: 4,
    descripcion: 'La más amplia. Para familias que cruzan La Guajira y necesitan una noche tranquila.',
    detalles: ['Cama doble + 2 sencillas', 'Aire acondicionado', 'Baño privado', 'Wi-Fi'],
    precio: 180000,
    foto: 'https://images.pexels.com/photos/6585757/pexels-photo-6585757.jpeg?auto=compress&cs=tinysrgb&w=1600'
  }
];

const Mensajeschat = [
  { mio: true, texto: 'Hola, ¿tienen habitación para esta noche? Somos 2.' },
  { mio: false, texto: 'Hola, soy el asistente de Hotel Nissi. Hoy tenemos disponible la 03 (doble). ¿A qué hora llegan?' },
  { mio: true, texto: 'Como a las 10 pm, venimos de Santa Marta.' },
  { mio: false, texto: 'Perfecto. Te envío el resumen y la tarifa para confirmar. La recepción queda avisada.' }
];

const Mesesano = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
