import type { CHANNEL_DIRECTORY_SORTS } from "@/lib/channel-directory";
import type { ChannelInfo } from "@/types/user";

export type ChannelDirectorySort = (typeof CHANNEL_DIRECTORY_SORTS)[number];
export interface ChannelDirectoryItem extends ChannelInfo {
  languages: string[];
  latestPostPreview: string | null;
  latestPostAt: string | null;
}
