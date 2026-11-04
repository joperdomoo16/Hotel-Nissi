// Inyeccion de datos estructurados Schema.org en formato JSON-LD
document.documentElement.classList.add('js');

function Inyectardatosestructurados() {
  const Existente = document.getElementById('datosEstructurados');
  if (Existente) {
    return;
  }

  const Esquema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Hotel",
        "@id": "https://hotel-nissi-mingueo.web.app/#hotel",
        "name": "Hotel Nissi",
        "description": "Hotel de paso sobre la Troncal del Caribe en Mingueo, municipio de Dibulla, La Guajira, con habitaciones confortables para descansar entre Santa Marta y Riohacha.",
        "url": "https://hotel-nissi-mingueo.web.app/",
        "image": "https://hotel-nissi-mingueo.web.app/assets/logo-nissi.png",
        "telephone": "+573001234567",
        "priceRange": "$$ (COP 90.000 - 180.000)",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Troncal del Caribe, Mingueo",
          "addressLocality": "Mingueo, Dibulla",
          "addressRegion": "La Guajira",
          "addressCountry": "CO"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 11.216310,
          "longitude": -73.392264
        },
        "amenityFeature": [
          { "@type": "LocationFeatureSpecification", "name": "Aire acondicionado", "value": true },
          { "@type": "LocationFeatureSpecification", "name": "Wi-Fi", "value": true },
          { "@type": "LocationFeatureSpecification", "name": "Baño privado", "value": true },
          { "@type": "LocationFeatureSpecification", "name": "Parqueadero", "value": true }
        ]
      },
      {
        "@type": "Organization",
        "@id": "https://hotel-nissi-mingueo.web.app/#organizacion",
        "name": "Hotel Nissi",
        "url": "https://hotel-nissi-mingueo.web.app/",
        "logo": "https://hotel-nissi-mingueo.web.app/assets/logo-nissi.png",
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+573001234567",
          "contactType": "customer service",
          "availableLanguage": ["es"]
        }
      }
    ]
  };

  const Scriptschema = document.createElement('script');
  Scriptschema.id = 'datosEstructurados';
  Scriptschema.type = 'application/ld+json';
  Scriptschema.textContent = JSON.stringify(Esquema);
  document.head.appendChild(Scriptschema);
}

Inyectardatosestructurados();

