import { useRef, useState } from 'react';
import type { MediaRef, RevealOptions } from '../../../shared/types';
import { api } from '../api';
import MediaView from './MediaView';
import Modal from './Modal';

export interface ClueFieldsValue extends RevealOptions {
  text: string;
  media?: MediaRef;
  answer: string;
}

interface FieldsProps {
  gameId: string;
  value: ClueFieldsValue;
  onChange: (patch: Partial<ClueFieldsValue>) => void;
  autoFocus?: boolean;
}

export function ClueFields({ gameId, value, onChange, autoFocus }: FieldsProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    setError('');
    setProgress(0);
    try {
      const media = await api.uploadMedia(gameId, file, setProgress);
      onChange({ media });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="clue-fields">
      <label className="field">
        <span>Clue</span>
        <textarea
          rows={3}
          value={value.text}
          autoFocus={autoFocus}
          placeholder="e.g. This planet is known as the Red Planet"
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </label>

      <div className="field">
        <span>Media (optional)</span>
        {value.media && (
          <div className="media-preview">
            <MediaView gameId={gameId} media={value.media} />
          </div>
        )}
        <div className="row gap">
          <button className="btn" onClick={() => fileInput.current?.click()} disabled={progress !== null}>
            {progress !== null
              ? `Uploading… ${Math.round(progress * 100)}%`
              : value.media
                ? 'Replace media'
                : 'Add image / audio / video'}
          </button>
          {value.media && progress === null && (
            <button className="btn btn-danger" onClick={() => onChange({ media: undefined })}>
              Remove media
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,audio/*,video/*"
          hidden
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        {error && <div className="alert">{error}</div>}
      </div>

      <div className="field">
        <span>When the clue is opened</span>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={!value.hideText}
            onChange={(e) => onChange({ hideText: !e.target.checked || undefined })}
          />
          Show the question automatically
          <span className="muted small">{value.hideText ? '— hidden until you click “Show question”' : ''}</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={!!value.autoShowMedia}
            onChange={(e) => onChange({ autoShowMedia: e.target.checked || undefined })}
          />
          Show the media automatically
          <span className="muted small">{value.autoShowMedia ? '' : '— hidden until you click “Show media”'}</span>
        </label>
      </div>

      <label className="field">
        <span>Answer</span>
        <input
          value={value.answer}
          placeholder="e.g. What is Mars?"
          onChange={(e) => onChange({ answer: e.target.value })}
        />
      </label>
    </div>
  );
}

interface ModalProps extends FieldsProps {
  title: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export default function ClueEditor({ title, onClose, onPrev, onNext, ...fields }: ModalProps) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onPrev} disabled={!onPrev}>
            ← Previous
          </button>
          <button className="btn" onClick={onNext} disabled={!onNext}>
            Next →
          </button>
          <span className="spacer" />
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <ClueFields {...fields} />
    </Modal>
  );
}
