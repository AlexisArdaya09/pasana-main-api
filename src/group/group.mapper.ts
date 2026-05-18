import { formatDateOnly } from '../common/date/format-date-only';
import { group } from '../database/schema';

type GroupRow = typeof group.$inferSelect;

export function mapGroupForResponse<T extends GroupRow>(g: T) {
  return {
    ...g,
    startDate: formatDateOnly(g.startDate),
    endDate: formatDateOnly(g.endDate),
  };
}
