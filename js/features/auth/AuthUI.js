/**
 * AuthUI — экран входа через @username + список существующих аккаунтов.
 */
import { el, gradientFor, initials, sleep } from '../../core/Utils.js';
import { Auth, AVATAR_GRADIENTS, isValidUsername, normUsername } from './Auth.js';
import { store } from '../../core/Store.js';
import { toast } from '../../ui/Toast.js';
import { DB } from '../../data/DB.js';
import { avatar } from '../../ui/Avatar.js';

export const AuthUI = {
  selectedGradient: AVATAR_GRADIENTS[0],

  async run() {
    await this.splash();
    const { hasSession } = await Auth.init();
    if (hasSession) return;
    return this.showAuthScreen();
  },

  async splash() {
    const splash = document.getElementById('splash');
    const fill = document.getElementById('splashFill');
    let progress = 0;
    const interval = setInterval(() => {
      progress = Math.min(progress + Math.random() * 18 + 8, 100);
      fill.style.width = `${progress}%`;
      if (progress >= 100) clearInterval(interval);
    }, 120);
    await sleep(1200);
    fill.style.width = '100%';
    await sleep(250);
    splash.classList.add('is-hidden');
    await sleep(400);
    splash.hidden = true;
  },

  showAuthScreen() {
    return new Promise(async (resolve) => {
      const screen = document.getElementById('authScreen');
      screen.hidden = false;

      // === Существующие аккаунты ===
      const users = await DB.getAll('users');

      if (users.length > 0) {
        // Показываем список аккаунтов
        screen.replaceChildren();
        const card = document.createElement('div');
        card.className = 'auth__card';

        const title = document.createElement('h1');
        title.className = 'auth__title';
        title.textContent = 'Кто входит?';
        card.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.className = 'auth__subtitle';
        subtitle.textContent = 'Выберите аккаунт или создайте новый';
        card.appendChild(subtitle);

        // Список аккаунтов
        const list = document.createElement('div');
        list.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin: 16px 0;';

        users.forEach((u) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--color-bg-hover); border: 2px solid transparent; border-radius: 12px; cursor: pointer; text-align: left; font-family: inherit; transition: all 0.15s;';

          const av = avatar({ name: u.name, gradient: u.gradient, avatarUrl: u.avatar, size: 'md' });
          btn.appendChild(av);

          const info = document.createElement('div');
          info.style.cssText = 'flex: 1; min-width: 0;';

          const name = document.createElement('div');
          name.textContent = u.name;
          name.style.cssText = 'font-weight: 600; font-size: 15px; color: var(--color-text-primary);';
          info.appendChild(name);

          const uname = document.createElement('div');
          uname.textContent = '@' + u.username;
          uname.style.cssText = 'font-size: 13px; color: var(--color-accent);';
          info.appendChild(uname);

          btn.appendChild(info);

          btn.addEventListener('mouseenter', () => btn.style.borderColor = 'var(--color-accent)');
          btn.addEventListener('mouseleave', () => btn.style.borderColor = 'transparent');

          btn.addEventListener('click', async () => {
            try {
              await Auth.login(u.username);
              screen.hidden = true;
              resolve();
            } catch (err) {
              toast.error(err.message);
            }
          });

          // Кнопка удаления
          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.textContent = '×';
          delBtn.title = 'Удалить аккаунт';
          delBtn.style.cssText = 'width: 28px; height: 28px; border: none; background: transparent; color: var(--color-text-tertiary); font-size: 20px; cursor: pointer; border-radius: 50%;';
          delBtn.addEventListener('mouseenter', () => { delBtn.style.background = 'rgba(229,57,53,0.1)'; delBtn.style.color = 'var(--color-danger)'; });
          delBtn.addEventListener('mouseleave', () => { delBtn.style.background = 'transparent'; delBtn.style.color = 'var(--color-text-tertiary)'; });
          delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const { confirmDialog } = await import('../../ui/Modal.js');
            if (await confirmDialog({ title: 'Удалить аккаунт?', message: `@${u.username} и все его данные будут удалены.`, danger: true, confirmText: 'Удалить' })) {
              await DB.delete('users', u.id);
              const chats = await DB.getAll('chats');
              for (const c of chats) {
                if (c.ownerUsername === u.username) {
                  await DB.delete('chats', c.id);
                }
              }
              const msgs = await DB.getAll('messages');
              for (const m of msgs) {
                if (m.ownerUsername === u.username) {
                  await DB.delete('messages', m.id);
                }
              }
              toast.success('Аккаунт удалён');
              location.reload();
            }
          });

          btn.appendChild(delBtn);
          list.appendChild(btn);
        });

        card.appendChild(list);

        // Кнопка "Новый аккаунт"
        const newBtn = document.createElement('button');
        newBtn.className = 'btn btn--primary btn--block';
        newBtn.textContent = '+ Создать новый аккаунт';
        newBtn.style.cssText = 'padding: 12px; width: 100%; background: var(--color-accent); color: #fff; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit;';
        newBtn.addEventListener('click', () => {
          screen.replaceChildren();
          this._showCreateForm(screen, resolve);
        });
        card.appendChild(newBtn);

        screen.appendChild(card);
        return;
      }

      // === Первый запуск — обычная форма ===
      this._showCreateForm(screen, resolve);
    });
  },

  _showCreateForm(screen, resolve) {
    // Восстанавливаем форму (изначально есть в HTML, но могла быть перезаписана)
    screen.innerHTML = `
      <div class="auth__card">
        <h1 class="auth__title">Добро пожаловать</h1>
        <p class="auth__subtitle">Введите @username, чтобы войти</p>

        <label class="field">
          <span class="field__label">@username</span>
          <input id="authUsername" type="text" class="field__input" maxlength="32" autocomplete="username" placeholder="@Dimg7s">
          <span id="authUsernameErr" class="field__err" role="alert"></span>
        </label>

        <div id="authNameBlock" hidden>
          <label class="field">
            <span class="field__label">Ваше имя</span>
            <input id="authName" type="text" class="field__input" maxlength="32" placeholder="Например: Джасур">
            <span id="authNameErr" class="field__err" role="alert"></span>
          </label>

          <p class="auth__subtitle" style="margin-top: 16px;">Выберите аватар</p>
          <div class="auth__avatars" id="authAvatars" role="radiogroup"></div>
        </div>

        <button id="authSubmit" class="btn btn--primary btn--block" disabled>Продолжить</button>
        <div id="authExistingHint" hidden class="auth__subtitle" style="text-align: center; margin-top: 8px;"></div>
      </div>
    `;

    const usernameInput = document.getElementById('authUsername');
    const usernameErr = document.getElementById('authUsernameErr');
    const nameBlock = document.getElementById('authNameBlock');
    const nameInput = document.getElementById('authName');
    const nameErr = document.getElementById('authNameErr');
    const avatarsBox = document.getElementById('authAvatars');
    const submit = document.getElementById('authSubmit');
    const hint = document.getElementById('authExistingHint');

    let mode = 'check';

    avatarsBox.replaceChildren();
    AVATAR_GRADIENTS.forEach((g, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `avatar-pick ${i === 0 ? 'is-active' : ''}`;
      btn.style.background = g;
      btn.textContent = '★';
      btn.addEventListener('click', () => {
        avatarsBox.querySelectorAll('.avatar-pick').forEach((n) => n.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.selectedGradient = g;
      });
      avatarsBox.append(btn);
    });

    const validateUsername = () => {
      const v = normUsername(usernameInput.value);
      if (v.length < 3) { usernameErr.textContent = 'Минимум 3 символа'; return false; }
      if (!isValidUsername(v)) { usernameErr.textContent = 'Только буквы, цифры, _'; return false; }
      usernameErr.textContent = '';
      return true;
    };

    const validateName = () => {
      const v = nameInput.value.trim();
      if (v.length < 2) { nameErr.textContent = 'Минимум 2 символа'; return false; }
      nameErr.textContent = '';
      return true;
    };

    const refreshButton = () => {
      if (mode === 'create') submit.disabled = !(validateName() && validateUsername());
      else submit.disabled = !validateUsername();
    };

    usernameInput.addEventListener('input', () => {
      usernameInput.value = usernameInput.value.replace(/\s/g, '');
      if (mode !== 'create') { mode = 'check'; nameBlock.hidden = true; hint.hidden = true; }
      refreshButton();
    });

    nameInput.addEventListener('input', refreshButton);

    submit.addEventListener('click', async () => {
      if (!validateUsername()) return;
      const rawUsername = normUsername(usernameInput.value);

      if (mode === 'check') {
        submit.disabled = true;
        try {
          const exists = await Auth.usernameExists(rawUsername);
          if (exists) {
            await Auth.login(rawUsername);
            screen.hidden = true;
            resolve();
          } else {
            mode = 'create';
            nameBlock.hidden = false;
            hint.hidden = false;
            hint.textContent = `@${rawUsername} свободен — заполните имя`;
            submit.textContent = 'Создать аккаунт';
            refreshButton();
            setTimeout(() => nameInput.focus(), 100);
          }
        } catch (e) { toast.error(e.message); submit.disabled = false; }
        return;
      }

      if (!validateName()) return;
      submit.disabled = true;
      try {
        await Auth.createUser({ username: rawUsername, name: nameInput.value.trim(), avatarGradient: this.selectedGradient });
        screen.hidden = true;
        resolve();
      } catch (e) { toast.error('Ошибка: ' + e.message); submit.disabled = false; }
    });

    usernameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit.click(); } });
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit.click(); } });

    setTimeout(() => usernameInput.focus(), 100);
  }
};
