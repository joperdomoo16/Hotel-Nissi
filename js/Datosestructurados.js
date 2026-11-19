// Datos estructurados Schema.org para buscadores
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
        "@type": "LodgingBusiness",
        "@id": "https://hospedaje-nissi-mingueo.web.app/#hospedaje",
        "name": "Hospedaje Nissi",
        "description": "Hospedaje de paso sobre la Troncal del Caribe en Mingueo, municipio de Dibulla, La Guajira, con habitaciones confortables para descansar entre Santa Marta y Riohacha.",
        "url": "https://hospedaje-nissi-mingueo.web.app/",
        "image": "https://hospedaje-nissi-mingueo.web.app/assets/logo-nissi.png",
        "telephone": "+573123757015",
        "email": "hospedajenissiguajira@gmail.com",
        "priceRange": "$ (COP 55.000 - 110.000)",
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
        "@id": "https://hospedaje-nissi-mingueo.web.app/#organizacion",
        "name": "Hospedaje Nissi",
        "url": "https://hospedaje-nissi-mingueo.web.app/",
        "logo": "https://hospedaje-nissi-mingueo.web.app/assets/logo-nissi.png",
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+573123757015",
          "email": "hospedajenissiguajira@gmail.com",
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

