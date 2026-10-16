export interface HindiAnnouncementItem {
  itemName?: string;
  name?: string;
  quantity?: number;
  qty?: number;
}

export declare const HINDI_NUMBERS: Record<number, string>;

export declare function numberToHindiWords(n: number | string): string;

export declare function formatHindiOrderItems(
  items?: Array<HindiAnnouncementItem | string> | null,
  maxToSpeak?: number
): string;

export declare function getBaseTableAnnouncement(tableLabel?: string | number | null): string;

export declare function getHindiTableAnnouncement(
  tableLabelOrOrder?: string | number | null | { tableLabel?: string | number | null; items?: Array<HindiAnnouncementItem | string> },
  itemsList?: Array<HindiAnnouncementItem | string> | null
): string;

export declare const getHindiOrderAnnouncement: typeof getHindiTableAnnouncement;

