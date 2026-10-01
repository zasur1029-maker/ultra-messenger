self.onmessage = async (e) => {
  const { blob, maxSize = 1920 } = e.data;
  try {
    const bitmap = await createImageBitmap(blob);
    let { width, height } = bitmap;
    if (width > maxSize || height > maxSize) {
      const r = maxSize / Math.max(width, height);
      width = Math.round(width * r);
      height = Math.round(height * r);
    }
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    const compressed = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    self.postMessage({ success: true, blob: compressed, width, height });
  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};
