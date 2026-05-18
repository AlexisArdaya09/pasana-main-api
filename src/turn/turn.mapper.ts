import { formatDateOnly } from '../common/date/format-date-only';
import { turn } from '../database/schema';

type TurnRow = typeof turn.$inferSelect;

export type TurnResponse = Omit<TurnRow, 'scheduledDate' | 'deliveryDate'> & {
  scheduledDate: string;
  deliveryDate: string;
};

export function mapTurnForResponse<T extends TurnRow>(t: T): T & { scheduledDate: string; deliveryDate: string } {
  return {
    ...t,
    scheduledDate: formatDateOnly(t.scheduledDate)!,
    deliveryDate: formatDateOnly(t.deliveryDate)!,
  };
}
