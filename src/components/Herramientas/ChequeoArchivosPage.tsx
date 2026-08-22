// Herramienta de chequeo de archivos: es una pieza HTML/JS ya armada y probada por
// separado (public/herramientas/chequeo-archivos.html, usa pdf.js/pdf-lib). Se muestra
// acá adentro con un iframe en vez de reescribirla en React para no arriesgar romper
// una herramienta que ya funciona.
export function ChequeoArchivosPage() {
  return (
    <div className="h-full">
      <iframe
        src="/herramientas/chequeo-archivos.html"
        title="Chequeo de archivos"
        className="w-full h-full border-0"
      />
    </div>
  );
}
