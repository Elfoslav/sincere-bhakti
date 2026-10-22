/**
 * Whether the viewer may manage the album (edit/delete): the channel owner,
 * or any identity that manages the album's channel.
 */
export function isAlbumManager(
  album: { channel: { id: string; ownerId: string } },
  currentUserId?: string,
  manageableChannelIds?: string[],
): boolean {
  return Boolean(currentUserId === album.channel.ownerId || manageableChannelIds?.includes(album.channel.id));
}
