export type BlixxMessageType = "text" | "image" | "audio" | "document" | "video" | string;

export interface BlixxMessage {
  id: string;
  driver_id: string;
  type: BlixxMessageType;
  body: string | null;
  has_media: boolean;
  sent_at: string;
}

export interface BlixxDriver {
  id: string;
  name: string;
  phone: string;
  group_id: string | null;
  messages: BlixxMessage[];
}

export interface BlixxGroup {
  id: string;
  name: string;
  wa_chat_id: string;
  company_id?: number;
}
