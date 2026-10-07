export const CAL_START = 2026;
export const CAL_END = 2027;
export const MONTHS = ["Јануари", "Февруари", "Март", "Април", "Мај", "Јуни", "Јули", "Август", "Септември", "Октомври", "Ноември", "Декември"];

const firstDay = new Date(CAL_START, 0, 1);
const lastDay = new Date(CAL_END, 11, 31);

export function calendarToday() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today < firstDay || today > lastDay) return new Date(firstDay);
  return today;
}

export function clampCalendar(date) {
  if (date < firstDay) return new Date(firstDay);
  if (date > lastDay) return new Date(lastDay);
  return date;
}

export function monthGrid(year, month) {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let index = 0; index < lead; index += 1) {
    const date = new Date(year, month, index - lead + 1);
    cells.push({ day: date.getDate(), inMonth: false });
  }
  for (let day = 1; day <= days; day += 1) cells.push({ day, inMonth: true });
  const tail = (7 - (cells.length % 7)) % 7;
  for (let index = 1; index <= tail; index += 1) {
    cells.push({ day: index, inMonth: false });
  }
  return cells;
}

export function weekOf(date) {
  const start = new Date(date);
  start.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function entryOn(item, date) {
  return Number(item.year) === date.getFullYear() && Number(item.month) === date.getMonth() + 1 && Number(item.day) === date.getDate();
}

export function entryStamp(item) {
  return Number(item.year) * 10000 + Number(item.month) * 100 + Number(item.day);
}
