import { useState, type DragEvent } from 'react';
import { Icon } from './Icon';

interface DropzoneProps {
  file: File | null;
  disabled: boolean;
  maxSizeMb: number;
  onFile: (file: File | null) => void;
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** File picker that also accepts drag & drop. The input stays real and labelled for accessibility. */
export function Dropzone({ file, disabled, maxSizeMb, onFile }: DropzoneProps) {
  const [dragging, setDragging] = useState(false);

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) onFile(event.dataTransfer.files[0] ?? null);
  }

  return (
    <label
      className={`dropzone${dragging ? ' dropzone--active' : ''}${file ? ' dropzone--filled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input
        className="visually-hidden"
        type="file"
        name="file"
        accept="application/pdf,.pdf"
        aria-label="Seleccionar CV en PDF"
        disabled={disabled}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <span className="dropzone__icon">
        <Icon name={file ? 'file' : 'upload'} size={28} />
      </span>
      {file ? (
        <>
          <span className="dropzone__title">{file.name}</span>
          <span className="dropzone__hint">{formatSize(file.size)} · Hacé clic para cambiarlo</span>
        </>
      ) : (
        <>
          <span className="dropzone__title">Arrastrá tu CV acá o hacé clic para elegirlo</span>
          <span className="dropzone__hint">Solo PDF, hasta {maxSizeMb} MB</span>
        </>
      )}
    </label>
  );
}
