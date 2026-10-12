import { useState } from 'react';
import { ApiError, api } from '../api/client';
import { Icon } from './Icon';

/** "Reenviar email de verificación", with the result inline. */
export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function resend() {
    setState('sending');
    try {
      await api.resendVerification(email);
      setState('sent');
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'No pudimos reenviar el email.');
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <p className="field__hint" role="status">
        <Icon name="check" size={16} />
        Te mandamos un nuevo email. El link anterior ya no sirve.
      </p>
    );
  }
  return (
    <>
      <button
        type="button"
        className="button button--outlined button--block"
        disabled={state === 'sending'}
        onClick={() => void resend()}
      >
        {state === 'sending' ? 'Reenviando…' : 'Reenviar email de verificación'}
      </button>
      {state === 'error' && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={18} />
          {message}
        </p>
      )}
    </>
  );
}
