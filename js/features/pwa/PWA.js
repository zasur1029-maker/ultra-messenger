/**
 * PWA install prompt.
 */
import { toast } from '../../ui/Toast.js';

export class PWA {
  constructor() {
    this.deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
    });
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      toast.success('Приложение установлено!');
    });
  }

  async promptInstall() {
    if (!this.deferredPrompt) {
      toast.info('Установка недоступна в этом браузере');
      return false;
    }
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    return outcome === 'accepted';
  }

  get isInstallable() { return !!this.deferredPrompt; }
}
