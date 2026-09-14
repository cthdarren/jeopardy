import type { ReactNode } from 'react';
import type { MediaRef } from '../../../shared/types';
import MediaView from './MediaView';

interface Props {
  gameId: string;
  heading: ReactNode;
  text: string;
  media?: MediaRef;
  answer: string;
  revealed: boolean;
  textShown: boolean;
  mediaShown: boolean;
  controls: ReactNode;
}

const textSize = (text: string) => (text.length < 60 ? 'xl' : text.length < 140 ? 'lg' : text.length < 260 ? 'md' : 'sm');

const mediaLabel = { image: '🖼 Picture', audio: '🔊 Audio', video: '🎬 Video' };

export default function ClueView({ gameId, heading, text, media, answer, revealed, textShown, mediaShown, controls }: Props) {
  return (
    <div className="clue-view">
      <div className="clue-heading">{heading}</div>
      <div className="clue-content">
        {text &&
          (textShown ? (
            <div className={`clue-text size-${media ? 'sm' : textSize(text)}`}>{text}</div>
          ) : (
            <div className="media-placeholder">Question</div>
          ))}
        {media &&
          (mediaShown ? (
            <MediaView key={media.file} gameId={gameId} media={media} className="clue-media" />
          ) : (
            <div className="media-placeholder">{mediaLabel[media.kind]}</div>
          ))}
        {revealed && <div className="clue-answer">{answer || <em>(no answer set)</em>}</div>}
      </div>
      <div className="host-controls">{controls}</div>
    </div>
  );
}

/** True when the host is typing into a field, so shortcuts should be ignored. */
export function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** Space belongs to a focused media player (play/pause); otherwise it's the reveal shortcut. */
export function isMediaTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && ['VIDEO', 'AUDIO'].includes(target.tagName);
}

interface ToggleProps {
  visible: boolean;
  onToggle: () => void;
}

/** Show/hide button for the clue text; renders nothing when there is no text. */
export function TextToggle({ text, visible, onToggle }: ToggleProps & { text: string }) {
  if (!text) return null;
  return (
    <button className="btn btn-primary" onClick={onToggle}>
      {visible ? 'Hide question' : 'Show question'} <kbd>Q</kbd>
    </button>
  );
}

/** Show/hide button for a clue's media; renders nothing when the clue has no media. */
export function MediaToggle({ media, visible, onToggle }: ToggleProps & { media?: MediaRef }) {
  if (!media) return null;
  return (
    <button className="btn btn-primary" onClick={onToggle}>
      {visible ? 'Hide media' : 'Show media'} <kbd>M</kbd>
    </button>
  );
}
