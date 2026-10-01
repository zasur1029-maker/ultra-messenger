/**
 * Начальные данные: 10 чатов и ~300 сообщений.
 * Персоны бота определены здесь же.
 */
import { createChat, createMessage } from './Models.js';
import { uid, pick, rand } from '../core/Utils.js';

const GRADIENTS = [
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #30cfd0, #330867)',
  'linear-gradient(135deg, #a8edea, #fed6e3)',
  'linear-gradient(135deg, #ff9a9e, #fecfef)',
  'linear-gradient(135deg, #ffecd2, #fcb69f)',
  'linear-gradient(135deg, #ff6e7f, #bfe9ff)'
];

const PERSONAS = {
  friend: {
    id: 'bot_friend',
    name: 'Макс (друг)',
    gradient: GRADIENTS[0],
    personality: 'friend',
    status: 'online'
  },
  colleague: {
    id: 'bot_colleague',
    name: 'Ирина (коллега)',
    gradient: GRADIENTS[3],
    personality: 'colleague',
    status: 'online'
  },
  mom: {
    id: 'bot_mom',
    name: 'Мама',
    gradient: GRADIENTS[7],
    personality: 'mom',
    status: 'recently'
  },
  helper: {
    id: 'bot_helper',
    name: 'UltraBot',
    gradient: 'linear-gradient(135deg, #2aabee, #229ed9)',
    personality: 'helper',
    status: 'online',
    isBot: true
  },
  gf: {
    id: 'bot_gf',
    name: 'Аня',
    gradient: GRADIENTS[1],
    personality: 'gf',
    status: 'online'
  },
  english: {
    id: 'bot_english',
    name: 'John (English)',
    gradient: GRADIENTS[2],
    personality: 'english',
    status: 'recently'
  },
  university: {
    id: 'chat_university',
    name: 'Универ группа',
    gradient: GRADIENTS[4],
    personality: 'group',
    status: 'group'
  },
  news: {
    id: 'chat_news',
    name: 'Tech News',
    gradient: GRADIENTS[5],
    personality: 'channel',
    status: 'channel'
  },
  saved: {
    id: 'chat_saved',
    name: 'Избранное',
    gradient: 'linear-gradient(135deg, #2aabee, #1c8fcc)',
    personality: 'saved',
    status: 'saved'
  },
  work: {
    id: 'chat_work',
    name: 'Рабочий чат',
    gradient: GRADIENTS[8],
    personality: 'work',
    status: 'group'
  }
};

const FRIEND_MESSAGES = [
  'Привет! Как дела?',
  'Слушай, а ты видел новый фильм?',
  'Го в выходные куда-нибудь?',
  'Хаха, ну ты даёшь 😂',
  'Я вчера такое видел!',
  'Кстати, помнишь ту историю?',
  'Ну что, как продвигается проект?',
  'Может кофе?',
  'У меня для тебя новость есть',
  'Дай подумать…',
  'Да ладно! Серьёзно?',
  'Ну ты и придумал, конечно',
  'Согласен на все 100',
  'Не уверен, но давай попробуем',
  'Вот это поворот!',
  'Пойду спать, устал сегодня',
  'Доброе утро! ☀️',
  'Спокойной ночи 🌙'
];

const COLLEAGUE_MESSAGES = [
  'Добрый день! Отправил файлы на почту',
  'Сможем обсудить встречу в 15:00?',
  'Отчёт готов, проверьте, пожалуйста',
  'Клиент просит доработку',
  'Спасибо за оперативность!',
  'Планёрка в понедельник в 10:00',
  'Обновил документацию',
  'Есть 5 минут?',
  'Согласовал с руководством',
  'Дедлайн — пятница, не забудьте',
  'Коллеги, все в силе?',
  'Прикрепил таблицу с расчётами'
];

const MOM_MESSAGES = [
  'Сынок, ты покушал?',
  'Позвони, как сможешь',
  'Как дела на работе?',
  'Не забудь шапку, холодно',
  'Мы с папой тебя любим ❤️',
  'Приезжай в выходные',
  'Я пирог испекла',
  'Как здоровье?',
  'Купи витамины',
  'Хорошего дня, солнышко!'
];

const HELPER_MESSAGES = [
  'Чем могу помочь?',
  'Вот что я нашёл по вашему запросу:',
  'Готово! Что-нибудь ещё?',
  'Уточните, пожалуйста, детали',
  'Я сохранил это в Избранное',
  'Напоминание создано',
  'Погода на сегодня: солнечно, +22°C',
  'Курс валют обновлён',
  'Вот краткая сводка:',
  'Понял вас, приступаю'
];

const GF_MESSAGES = [
  'Любимый, ты где?',
  'Скучаю 🥺',
  'Как прошёл день?',
  'Я приготовила ужин',
  'Доброе утро, милый ☀️',
  'Позвони, когда сможешь',
  'Ты мой самый лучший ❤️',
  'Давай в кино сходим?',
  'Обнимаю тебя 💕',
  'Спокойной ночи!'
];

const ENGLISH_MESSAGES = [
  'Hey! How are you doing?',
  'Long time no see!',
  'Let me know when you are free',
  'Sounds great to me!',
  'I will check and get back to you',
  'Have a nice day!',
  'See you tomorrow',
  'That is interesting, tell me more'
];

const NEWS_MESSAGES = [
  '⚡️ OpenAI представила новую модель GPT-5',
  '🔥 Apple анонсировала iPhone 17 Pro',
  '📱 Telegram добавил поддержку нового формата',
  '💻 Google выпустила Chrome 140',
  '🚀 SpaceX успешно запустила ракету',
  '🎮 Вышла новая игра года',
  '🧠 Учёные создали первый квантовый процессор',
  '💡 GitHub Copilot стал полностью бесплатным'
];

const GROUP_MESSAGES = [
  'Кто сдал лабораторную?',
  'Ребята, во сколько завтра пара?',
  'Дедлайн по курсовой — 15-е',
  'Скиньте конспект, кто может 🙏',
  'Препод сказал, что будет тест',
  'Встречаемся в библиотеке в 14:00',
  'Кто идёт на конференцию?',
  'Нашёл хороший материал по теме',
  'Обсуждаем в общем чате',
  'Спасибо всем за помощь!'
];

const WORK_MESSAGES = [
  'Коллеги, в 15:00 дейли',
  'Обновил таск на Jira',
  'Кто может посмотреть PR?',
  'Релиз переносится на завтра',
  'Встреча с заказчиком прошла хорошо',
  'Нужна помощь с багом в проде',
  'Закончил фичу, прошу ревью',
  'Всем хороших выходных!'
];

const MESSAGES_BY_PERSONALITY = {
  friend: FRIEND_MESSAGES,
  colleague: COLLEAGUE_MESSAGES,
  mom: MOM_MESSAGES,
  helper: HELPER_MESSAGES,
  gf: GF_MESSAGES,
  english: ENGLISH_MESSAGES,
  group: GROUP_MESSAGES,
  channel: NEWS_MESSAGES,
  work: WORK_MESSAGES,
  saved: FRIEND_MESSAGES
};

/** Генерация стартового сообщения от бота */
function generateBotMessage(personality, index, ts) {
  const pool = MESSAGES_BY_PERSONALITY[personality] || FRIEND_MESSAGES;
  return pool[index % pool.length];
}

/** Создать все демо-чаты с историей */
export function createSeedData(currentUserId) {
  const now = Date.now();
  const chats = [];
  const messages = {};

  const chatConfigs = [
    { key: 'gf',         count: 20, spread: 1800_000 },
    { key: 'helper',     count: 10, spread: 2400_000 },
    { key: 'saved',      count: 5,  spread: 20000_000 }
  ];

  for (const cfg of chatConfigs) {
    const persona = PERSONAS[cfg.key];
    if (!persona) continue;

    const chatType = cfg.key === 'university' || cfg.key === 'work' ? 'group'
                   : cfg.key === 'news' ? 'channel'
                   : cfg.key === 'saved' ? 'saved'
                   : persona.isBot ? 'bot' : 'personal';

    const chat = createChat({
      id: persona.id,
      type: chatType,
      title: persona.name,
      gradient: persona.gradient,
      participants: chatType === 'group' || chatType === 'channel'
        ? [
            { id: currentUserId, name: 'Вы', role: 'member' },
            { id: 'bot_member_1', name: 'Алиса', gradient: GRADIENTS[2], role: 'member' },
            { id: 'bot_member_2', name: 'Пётр', gradient: GRADIENTS[4], role: 'member' },
            { id: 'bot_member_3', name: 'Kate', gradient: GRADIENTS[6], role: 'member' }
          ]
        : undefined,
      favorite: cfg.key === 'gf' || cfg.key === 'mom',
      pinned: cfg.key === 'helper',
      updatedAt: now - cfg.spread
    });
    chats.push(chat);

    const msgs = [];
    let ts = now - cfg.count * cfg.spread;
    for (let i = 0; i < cfg.count; i++) {
      const isOwn = Math.random() > 0.55;
      const authorId = isOwn ? currentUserId
                    : (chatType === 'group' || chatType === 'channel'
                        ? pick(chat.participants.filter((p) => p.id !== currentUserId)).id
                        : persona.id);

      const text = isOwn
        ? pick(['Ок', 'Понял', 'Хорошо', 'Договорились', 'Спасибо!', 'Интересно', 'Да, точно', 'Согласен', 'Скоро отвечу', 'Отлично 👍'])
        : generateBotMessage(persona.personality, i, ts);

      const status = isOwn
        ? (i < cfg.count - 3 ? 'read' : 'delivered')
        : 'sent';

      msgs.push(createMessage({
        chatId: chat.id,
        authorId,
        text,
        status,
        createdAt: ts + Math.random() * 60_000,
        reactions: i % 7 === 0 ? { '❤️': [currentUserId] } : (i % 11 === 0 ? { '👍': ['bot_member_1'] } : {})
      }));

      ts += cfg.spread;
    }
    messages[chat.id] = msgs;
  }

  return { chats, messages };
}

export { PERSONAS, GRADIENTS };
