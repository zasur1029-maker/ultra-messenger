#!/usr/bin/env bash
# Ultra Messenger — чистый запуск на 8080

PORT=8080
URL="http://localhost:$PORT"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🚀 ULTRA MESSENGER                                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# 1. Убиваем старые серверы
echo "🧹 Убираю старые серверы…"
fuser -k "$PORT/tcp" 2>/dev/null
pkill -f "http.server $PORT" 2>/dev/null
sleep 1

# 2. Проверяем порт
if ss -tln 2>/dev/null | grep -q ":$PORT "; then
  echo "⚠️  Порт $PORT всё ещё занят, пробую другой…"
  PORT=8081
  URL="http://localhost:$PORT"
  fuser -k "$PORT/tcp" 2>/dev/null
  sleep 1
fi

echo "✅ Порт $PORT свободен"
echo ""
echo "🌐 Открой в браузере: $URL"
echo "⛔ Остановка: Ctrl+C"
echo ""

# 3. Открываем браузер
if command -v xdg-open &>/dev/null; then
  (sleep 1 && xdg-open "$URL" &>/dev/null) &
fi

# 4. Запускаем сервер
exec python3 -m http.server "$PORT"
