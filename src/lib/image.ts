/**
 * Achica una imagen en el navegador antes de subirla (contact sheet, 18/10):
 * lado mayor hasta `maxSide` px, JPEG. Una captura de Copérnico de varios MB
 * queda en unos cientos de KB, de sobra para verla en pantalla e imprimirla en A4.
 * Las transparencias se pintan sobre blanco (JPEG no tiene alfa).
 */
export async function shrinkImage(file: Blob, maxSide = 2400, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen.'))), 'image/jpeg', quality);
  });
}
