import type { MediaRef } from '../../../shared/types';
import { mediaUrl } from '../api';

interface Props {
  gameId: string;
  media: MediaRef;
  className?: string;
}

export default function MediaView({ gameId, media, className = '' }: Props) {
  const src = mediaUrl(gameId, media);
  switch (media.kind) {
    case 'image':
      return <img className={`media media-image ${className}`} src={src} alt="" />;
    case 'audio':
      return <audio className={`media media-audio ${className}`} src={src} controls preload="auto" />;
    case 'video':
      return <video className={`media media-video ${className}`} src={src} controls preload="auto" playsInline />;
  }
}

export const mediaIcon = (media?: MediaRef) =>
  media ? { image: '🖼', audio: '🔊', video: '🎬' }[media.kind] : '';
