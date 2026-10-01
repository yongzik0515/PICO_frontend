export function isImageFile(mimeType?: string, name = '') {
  return mimeType ? mimeType.toLowerCase().startsWith('image/') : /\.(?:jpe?g|png|gif|webp|avif|bmp|svg|heic|heif)$/i.test(name);
}
