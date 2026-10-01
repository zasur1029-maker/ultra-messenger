/**
 * VoiceRecorder v2 — переписан с нуля.
 * Гарантированная запись + отправка.
 */
export class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.stream = null;
    this.startTime = null;
    this.onComplete = null;
    this.onCancel = null;
  }

  /**
   * Начать запись.
   * @returns {Promise<boolean>}
   */
  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Микрофон недоступен');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.startTime = Date.now();

    // Выбираем поддерживаемый MIME-тип
    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported) {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }
    }

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.addEventListener('dataavailable', (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    });

    this.mediaRecorder.addEventListener('error', (e) => {
      console.error('[Voice] Ошибка recorder:', e);
    });

    this.mediaRecorder.start();
    console.log('[Voice] Запись началась, mime:', mimeType);
    return true;
  }

  /**
   * Остановить и вернуть результат.
   * @returns {Promise<{blob: Blob, url: string, duration: number}>}
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Запись не была начата'));
        return;
      }

      if (this.mediaRecorder.state === 'inactive') {
        // Уже остановлен — вернём что есть
        this._finish(resolve);
        return;
      }

      this.mediaRecorder.addEventListener('stop', () => {
        this._finish(resolve);
      }, { once: true });

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Завершить и вернуть blob */
  _finish(resolve) {
    const duration = (Date.now() - this.startTime) / 1000;
    const mime = this.mediaRecorder?.mimeType || 'audio/webm';
    const blob = new Blob(this.chunks, { type: mime });

    // Освобождаем микрофон
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;

    console.log('[Voice] Запись остановлена. Размер:', blob.size, 'байт, длина:', duration.toFixed(1), 'сек');

    if (blob.size < 100) {
      // Слишком короткая — не отправляем
      resolve(null);
      return;
    }

    const url = URL.createObjectURL(blob);
    resolve({ blob, url, duration, mime });
  }

  /** Отменить запись */
  cancel() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch {}
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
    console.log('[Voice] Запись отменена');
  }

  /** Активна ли запись */
  get isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state === 'recording';
  }
}

export default VoiceRecorder;
