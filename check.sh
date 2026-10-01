#!/usr/bin/env bash
# ============================================================
# Ultra Messenger — инспектор проекта
# Показывает размеры, находит пустые файлы, формирует отчёт
# ============================================================

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m'

# Проверка что мы в корне проекта
if [ ! -f "index.html" ]; then
  echo -e "${RED}❌ Запусти скрипт из корня проекта (там где index.html)${NC}"
  exit 1
fi

PROJECT_NAME=$(basename "$(pwd)")
DATE=$(date '+%Y-%m-%d %H:%M:%S')
REPORT_FILE="report.txt"

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  📊  ULTRA MESSENGER — ИНСПЕКЦИЯ ПРОЕКТА               ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e "${GRAY}Проект: $PROJECT_NAME${NC}"
echo -e "${GRAY}Дата:   $DATE${NC}"
echo ""

# ============================================================
# 1. ДЕРЕВО ФАЙЛОВ С РАЗМЕРАМИ
# ============================================================
echo -e "${BOLD}${BLUE}▸ 1. ДЕРЕВО ФАЙЛОВ С РАЗМЕРАМИ${NC}"
echo ""

# Собираем статистику
TOTAL_FILES=0
TOTAL_SIZE=0
EMPTY_FILES=()
SMALL_FILES=()   # < 100 байт
CODE_FILES=()    # >= 100 байт

# Проходим по всем файлам (кроме служебных)
while IFS= read -r -d '' file; do
  # Пропускаем сам скрипт, отчёт, .git, node_modules
  case "$file" in
    ./check.sh|./report.txt|./.git/*|*/node_modules/*|./start.sh) continue ;;
  esac

  size=$(stat -c %s "$file" 2>/dev/null || echo 0)
  TOTAL_FILES=$((TOTAL_FILES + 1))
  TOTAL_SIZE=$((TOTAL_SIZE + size))

  # Красивый вывод в дереве
  depth=$(echo "$file" | tr -cd '/' | wc -c)
  indent=""
  for ((i=0; i<depth; i++)); do indent="$indent  "; done
  name=$(basename "$file")

  # Человекочитаемый размер
  if [ "$size" -lt 1024 ]; then
    human="${size} B"
  elif [ "$size" -lt 1048576 ]; then
    human="$(awk "BEGIN{printf \"%.1f\", $size/1024}") KB"
  else
    human="$(awk "BEGIN{printf \"%.1f\", $size/1048576}") MB"
  fi

  # Цвет и маркер
  if [ "$size" -eq 0 ]; then
    color="${RED}"
    marker="❌"
    EMPTY_FILES+=("$file")
  elif [ "$size" -lt 100 ]; then
    color="${YELLOW}"
    marker="⚠️ "
    SMALL_FILES+=("$file")
  else
    color="${GREEN}"
    marker="✅"
    CODE_FILES+=("$file")
  fi

  printf "${color}%s %8s  %s${NC}\n" "$marker" "$human" "$file"
done < <(find . -type f -not -path './.git/*' -not -path '*/node_modules/*' -print0 | sort -z)

echo ""

# ============================================================
# 2. ПУСТЫЕ ФАЙЛЫ
# ============================================================
echo -e "${BOLD}${BLUE}▸ 2. ПУСТЫЕ ФАЙЛЫ (0 байт)${NC}"
echo ""
if [ ${#EMPTY_FILES[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ Нет пустых файлов${NC}"
else
  echo -e "${RED}Найдено: ${#EMPTY_FILES[@]}${NC}"
  for f in "${EMPTY_FILES[@]}"; do
    echo -e "${RED}  ❌ $f${NC}"
  done
fi
echo ""

# ============================================================
# 3. МАЛЕНЬКИЕ ФАЙЛЫ (< 100 байт, скорее всего заглушки)
# ============================================================
echo -e "${BOLD}${BLUE}▸ 3. ЗАГЛУШКИ (< 100 байт)${NC}"
echo ""
if [ ${#SMALL_FILES[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ Нет заглушек${NC}"
else
  echo -e "${YELLOW}Найдено: ${#SMALL_FILES[@]}${NC}"
  for f in "${SMALL_FILES[@]}"; do
    size=$(stat -c %s "$f")
    echo -e "${YELLOW}  ⚠️  $f ($size B)${NC}"
  done
fi
echo ""

# ============================================================
# 4. ФАЙЛЫ С КОДОМ (>= 100 байт)
# ============================================================
echo -e "${BOLD}${BLUE}▸ 4. ФАЙЛЫ С КОДОМ${NC}"
echo ""
echo -e "${GREEN}Заполнено: ${#CODE_FILES[@]}${NC}"
echo ""

# ============================================================
# 5. СТАТИСТИКА ПО ТИПАМ
# ============================================================
echo -e "${BOLD}${BLUE}▸ 5. СТАТИСТИКА ПО ТИПАМ ФАЙЛОВ${NC}"
echo ""

printf "  %-15s %s\n" "HTML:"  "$(find . -name '*.html' -not -path './.git/*' | wc -l) файл(ов)"
printf "  %-15s %s\n" "CSS:"   "$(find . -name '*.css' -not -path './.git/*' | wc -l) файл(ов)"
printf "  %-15s %s\n" "JS:"    "$(find . -name '*.js' -not -path './.git/*' | wc -l) файл(ов)"
printf "  %-15s %s\n" "JSON:"  "$(find . -name '*.json' -not -path './.git/*' | wc -l) файл(ов)"
printf "  %-15s %s\n" "Markdown:" "$(find . -name '*.md' -not -path './.git/*' | wc -l) файл(ов)"
echo ""

# ============================================================
# 6. ОБЩАЯ СТАТИСТИКА
# ============================================================
echo -e "${BOLD}${BLUE}▸ 6. ОБЩАЯ СТАТИСТИКА${NC}"
echo ""

if [ "$TOTAL_SIZE" -lt 1048576 ]; then
  total_human="$(awk "BEGIN{printf \"%.1f KB\", $TOTAL_SIZE/1024}")"
else
  total_human="$(awk "BEGIN{printf \"%.2f MB\", $TOTAL_SIZE/1048576}")"
fi

TOTAL_DIRS=$(find . -type d -not -path './.git/*' -not -path '*/node_modules/*' | wc -l)

echo -e "  ${BOLD}Всего файлов:${NC}       $TOTAL_FILES"
echo -e "  ${BOLD}Всего папок:${NC}        $TOTAL_DIRS"
echo -e "  ${BOLD}Заполнено:${NC}          ${GREEN}${#CODE_FILES[@]}${NC}"
echo -e "  ${BOLD}Заглушек:${NC}           ${YELLOW}${#SMALL_FILES[@]}${NC}"
echo -e "  ${BOLD}Пустых:${NC}             ${RED}${#EMPTY_FILES[@]}${NC}"
echo -e "  ${BOLD}Общий размер:${NC}       $total_human"
echo ""

# ============================================================
# 7. ГОТОВЫЙ ОТЧЁТ ДЛЯ ОТПРАВКИ
# ============================================================
echo -e "${BOLD}${BLUE}▸ 7. ФОРМИРУЮ ОТЧЁТ...${NC}"
echo ""

{
  echo "════════════════════════════════════════════════════════════"
  echo "  ULTRA MESSENGER — ОТЧЁТ О СОСТОЯНИИ ПРОЕКТА"
  echo "  Проект: $PROJECT_NAME"
  echo "  Дата:   $DATE"
  echo "════════════════════════════════════════════════════════════"
  echo ""
  echo "--- СТАТИСТИКА ---"
  echo "Файлов:      $TOTAL_FILES"
  echo "Папок:       $TOTAL_DIRS"
  echo "Заполнено:   ${#CODE_FILES[@]}"
  echo "Заглушек:    ${#SMALL_FILES[@]}"
  echo "Пустых:      ${#EMPTY_FILES[@]}"
  echo "Размер:      $total_human"
  echo ""
  echo "--- ФАЙЛЫ (размер в байтах, отсортированы по пути) ---"
  find . -type f -not -path './.git/*' -not -path '*/node_modules/*' -not -name 'report.txt' -not -name 'check.sh' -printf '%s\t%p\n' | sort -k2
  echo ""
  echo "--- ПУСТЫЕ ФАЙЛЫ (0 байт) ---"
  if [ ${#EMPTY_FILES[@]} -eq 0 ]; then echo "(нет)"; else
    printf '%s\n' "${EMPTY_FILES[@]}"
  fi
  echo ""
  echo "--- ЗАГЛУШКИ (< 100 байт) ---"
  if [ ${#SMALL_FILES[@]} -eq 0 ]; then echo "(нет)"; else
    printf '%s\n' "${SMALL_FILES[@]}"
  fi
  echo ""
  echo "--- ДЕРЕВО ---"
  if command -v tree &>/dev/null; then
    tree -a --noreport -I '.git|node_modules|report.txt|check.sh'
  else
    find . -not -path './.git/*' -not -path '*/node_modules/*' | sort
  fi
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "  КОНЕЦ ОТЧЁТА"
  echo "════════════════════════════════════════════════════════════"
} > "$REPORT_FILE"

echo -e "${GREEN}✅ Отчёт сохранён: ${BOLD}$REPORT_FILE${NC}"
echo ""

# ============================================================
# 8. ЧТО ДЕЛАТЬ ДАЛЬШЕ
# ============================================================
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  📤  ЧТО ДЕЛАТЬ ДАЛЬШЕ                                  ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  1. Открой файл ${BOLD}$REPORT_FILE${NC}"
echo -e "  2. Скопируй его содержимое целиком"
echo -e "  3. Вставь мне в чат"
echo ""
echo -e "${GRAY}     Команда для копирования:${NC}"
echo -e "${BOLD}     cat $REPORT_FILE${NC}"
echo ""
echo -e "${GRAY}     Или скопировать в буфер (если есть xclip):${NC}"
echo -e "${BOLD}     cat $REPORT_FILE | xclip -selection clipboard${NC}"
echo ""

# Если есть возможность — сразу покажем отчёт
if command -v xclip &>/dev/null; then
  cat "$REPORT_FILE" | xclip -selection clipboard 2>/dev/null && \
    echo -e "${GREEN}✅ Отчёт скопирован в буфер обмена${NC}" || true
fi

echo ""
