// El runner comparte un único entorno (jsdom) entre archivos de prueba: localStorage es global y el idioma
// elegido en una prueba se filtraba a las demás (por eso una prueba en español fallaba según el orden).
// Limpiar antes de cada test garantiza que cada una parte del idioma por defecto.
beforeEach(() => {
  localStorage.clear();
});
