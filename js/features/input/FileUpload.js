/**
 * FileUpload — утилиты файлов.
 */
import { formatBytes } from '../../core/Utils.js';

export function describeFile(file) {
  return {
    name: file.name,
    size: file.size,
    sizeFormatted: formatBytes(file.size),
    mime: file.type,
    isImage: file.type.startsWith('image/')
  };
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default { describeFile, fileToDataUrl };
