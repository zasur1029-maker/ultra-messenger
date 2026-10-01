#!/usr/bin/env bash
# Полный сброс: убивает серверы, чистит бэкапы, перезапускает

cd "$(dirname "$0")"

echo "🔥 ПОЛНЫЙ СБРОС"
echo ""

# 1. Убиваем серверы
echo "1️⃣  Убиваю серверы…"
for port in 8080 8081 8082 8083 8084 3000 3001; do
  fuser -k "$port/tcp" 2>/dev/null
done
pkill -f "http.server" 2>/dev/null
sleep 1
echo "   ✅"

# 2. Удаляем бэкапы
echo "2️⃣  Удаляю старые бэкапы…"
rm -f js/app.js.* 2>/dev/null
rm -f js/**/*.backup* 2>/dev/null
find . -name "*.broken*" -delete 2>/dev/null
find . -name "*.backup*" -delete 2>/dev/null
find . -name "*.old-*" -delete 2>/dev/null
find . -name "*.SLOMAN*" -delete 2>/dev/null
echo "   ✅"

# 3. Проверяем синтаксис
echo "3️⃣  Проверяю синтаксис…"
errors=0
for f in $(find js -name "*.js" -type f); do
  if ! node --check "$f" 2>/dev/null; then
    echo "   ❌ $f"
    errors=$((errors + 1))
  fi
done
if [ $errors -eq 0 ]; then
  echo "   ✅ Все файлы чистые"
else
  echo "   ⚠️  $errors файлов с ошибками"
fi

echo ""
echo "4️⃣  Запускаю сервер…"
./start.sh
