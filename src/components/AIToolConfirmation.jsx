import React from 'react';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';

export function AIToolConfirmation({
  proposal,
  status = 'pending',
  error = '',
  onConfirm,
  onCancel,
}) {
  const canAct = status === 'pending' || status === 'error';
  const isConfirming = status === 'confirming';
  const isDestructive = proposal.confirmationLevel === 'destructive';

  return (
    <article className={`ai-action-card is-${status} ${isDestructive ? 'is-destructive' : ''}`} aria-label="Confirmação de ação do Ajudante do Dia">
      <header className="ai-action-card-header">
        <span className="ai-action-kicker">
          {status === 'confirmed'
            ? 'Ação confirmada'
            : status === 'cancelled'
              ? 'Ação cancelada'
              : isDestructive ? 'Ação destrutiva · confirmação reforçada' : 'Ação proposta · confirmação'}
        </span>
        <h4>{proposal.title}</h4>
        <p>{proposal.description}</p>
      </header>

      <dl className="ai-action-fields">
        {proposal.displayFields.map((field, index) => (
          <div key={`${field.label}-${index}`}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>

      {error && (
        <p className="ai-action-error" role="alert">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}

      {(canAct || isConfirming) && (
        <footer className="ai-action-card-actions">
          <button type="button" onClick={onConfirm} disabled={isConfirming} className="ai-action-confirm">
            {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isConfirming ? 'Aplicando' : status === 'error' ? 'Tentar novamente' : proposal.confirmLabel || 'Confirmar'}
          </button>
          <button type="button" onClick={onCancel} disabled={isConfirming} className="ai-action-cancel">
            <X className="w-4 h-4" />
            Cancelar
          </button>
        </footer>
      )}
    </article>
  );
}
