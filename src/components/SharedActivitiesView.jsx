import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  db,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  arrayUnion,
} from '../firebase/config';
import { CalendarDays, Check, ChevronRight, LoaderCircle, MapPin, Pencil, Plus, Trash2, UsersRound, X } from 'lucide-react';
import './SharedActivitiesView.css';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'projeto não identificado';

const getFirestoreErrorMessage = (error, action) => {
  const code = error?.code || 'erro-desconhecido';
  console.error(`${action}:`, code, error?.message || error);
  if (code.includes('permission-denied')) {
    return `O Firebase (${firebaseProjectId}) recusou o acesso. Confirme se as regras atualizadas foram publicadas neste projeto. (permission-denied)`;
  }
  if (code.includes('unauthenticated')) {
    return 'Sua sessão expirou. Entre novamente na sua conta. (unauthenticated)';
  }
  if (code.includes('unavailable')) {
    return 'O Firebase está indisponível no momento. Verifique a conexão e tente novamente. (unavailable)';
  }
  if (code.includes('failed-precondition')) {
    return 'O Firebase recusou a consulta por uma configuração pendente. Confira o índice indicado no console. (failed-precondition)';
  }
  return `Não foi possível ${action.toLowerCase()}. Tente novamente. (${code})`;
};

const formatDate = (value) => {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(new Date(year, month - 1, day));
};

export function SharedActivitiesView({ currentUser }) {
  const userEmail = normalizeEmail(currentUser?.email);
  const [activities, setActivities] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activityTitle, setActivityTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemDate, setItemDate] = useState('');
  const [itemTime, setItemTime] = useState('');
  const [itemLocation, setItemLocation] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [editingItemId, setEditingItemId] = useState('');
  const [editValues, setEditValues] = useState(null);

  useEffect(() => {
    if (!userEmail) return undefined;
    const activitiesQuery = query(
      collection(db, 'sharedActivities'),
      where('memberEmails', 'array-contains', userEmail),
    );
    return onSnapshot(activitiesQuery, (snapshot) => {
      const nextActivities = snapshot.docs.map((activityDoc) => ({ id: activityDoc.id, ...activityDoc.data() }))
        .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setActivities(nextActivities);
      setSelectedId((currentId) => (
        nextActivities.some((activity) => activity.id === currentId) ? currentId : nextActivities[0]?.id || ''
      ));
      setLoading(false);
      setLoadError('');
    }, (error) => {
      setLoadError(getFirestoreErrorMessage(error, 'carregar os roteiros'));
      setLoading(false);
    });
  }, [userEmail]);

  useEffect(() => {
    if (!selectedId) {
      setItems([]);
      return undefined;
    }
    const itemsQuery = query(
      collection(db, 'sharedActivities', selectedId, 'items'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(itemsQuery, (snapshot) => {
      const nextItems = snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }));
      nextItems.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '').localeCompare(b.time || ''));
      setItems(nextItems);
    }, (error) => {
      setLoadError(getFirestoreErrorMessage(error, 'carregar os itens do roteiro'));
    });
  }, [selectedId]);

  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id === selectedId) || null,
    [activities, selectedId]
  );

  const createActivity = async (event) => {
    event.preventDefault();
    if (!activityTitle.trim() || !currentUser?.uid || !userEmail) return;
    setBusy(true);
    const activityRef = doc(collection(db, 'sharedActivities'));
    try {
      await setDoc(activityRef, {
        title: activityTitle.trim(),
        destination: destination.trim(),
        ownerUid: currentUser.uid,
        memberEmails: [userEmail],
        memberNames: { [userEmail]: currentUser.displayName || userEmail },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setActivityTitle('');
      setDestination('');
      setShowCreateForm(false);
      setSelectedId(activityRef.id);
    } catch (error) {
      setLoadError(getFirestoreErrorMessage(error, 'criar o roteiro'));
    } finally {
      setBusy(false);
    }
  };

  const inviteMember = async (event) => {
    event.preventDefault();
    const email = normalizeEmail(inviteEmail);
    if (!selectedActivity || !email || email === userEmail) return;
    if (selectedActivity.memberEmails?.includes(email)) {
      setLoadError('Essa pessoa já participa deste roteiro.');
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, 'sharedActivities', selectedActivity.id), {
        memberEmails: arrayUnion(email),
        updatedAt: serverTimestamp(),
      });
      setInviteEmail('');
    } catch (error) {
      setLoadError(getFirestoreErrorMessage(error, 'adicionar a pessoa'));
    } finally {
      setBusy(false);
    }
  };

  const saveItem = async (event) => {
    event.preventDefault();
    if (!selectedActivity || !itemTitle.trim()) return;
    setBusy(true);
    const itemId = newId();
    try {
      await setDoc(doc(db, 'sharedActivities', selectedActivity.id, 'items', itemId), {
        title: itemTitle.trim(),
        date: itemDate || '',
        time: itemTime || '',
        location: itemLocation.trim(),
        notes: itemNotes.trim(),
        createdBy: userEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'sharedActivities', selectedActivity.id), { updatedAt: serverTimestamp() });
      setItemTitle('');
      setItemDate('');
      setItemTime('');
      setItemLocation('');
      setItemNotes('');
    } catch (error) {
      setLoadError(getFirestoreErrorMessage(error, 'salvar o item do roteiro'));
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = (item) => {
    setEditingItemId(item.id);
    setEditValues({ title: item.title || '', date: item.date || '', time: item.time || '', location: item.location || '', notes: item.notes || '' });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!selectedActivity || !editingItemId || !editValues?.title.trim()) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'sharedActivities', selectedActivity.id, 'items', editingItemId), {
        ...editValues,
        title: editValues.title.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
      });
      await updateDoc(doc(db, 'sharedActivities', selectedActivity.id), { updatedAt: serverTimestamp() });
      setEditingItemId('');
      setEditValues(null);
    } catch (error) {
      setLoadError(getFirestoreErrorMessage(error, 'salvar a edição'));
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (itemId) => {
    if (!selectedActivity) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'sharedActivities', selectedActivity.id, 'items', itemId));
      await updateDoc(doc(db, 'sharedActivities', selectedActivity.id), { updatedAt: serverTimestamp() });
    } catch (error) {
      setLoadError(getFirestoreErrorMessage(error, 'remover o item'));
    } finally {
      setBusy(false);
    }
  };

  if (!userEmail) return <div className="shared-message">Entre em uma conta com e-mail para acessar os roteiros compartilhados.</div>;

  return (
    <div className="shared-activities-view">
      <header className="shared-page-heading">
        <div>
          <span className="calendar-kicker">Planejamento em grupo</span>
          <h1>Atividades compartilhadas</h1>
          <p>Organize roteiros junto com outras pessoas. As alterações aparecem para todos em tempo real.</p>
        </div>
        <button type="button" className="shared-primary-button" onClick={() => setShowCreateForm((value) => !value)}>
          {showCreateForm ? <X size={17} /> : <Plus size={17} />}
          {showCreateForm ? 'Fechar' : 'Novo roteiro'}
        </button>
      </header>

      {loadError && <div className="shared-error" role="status">{loadError}<button type="button" onClick={() => setLoadError('')} aria-label="Fechar aviso"><X size={15} /></button></div>}

      {showCreateForm && (
        <form className="shared-create-form" onSubmit={createActivity}>
          <label>Nome do roteiro<input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} placeholder="Ex.: Férias em Lisboa" required maxLength={100} /></label>
          <label>Destino<input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Cidade ou região" maxLength={100} /></label>
          <button className="shared-primary-button" type="submit" disabled={busy || !activityTitle.trim()}>{busy ? <LoaderCircle className="shared-spin" size={16} /> : <Plus size={16} />} Criar roteiro</button>
        </form>
      )}

      {loading ? (
        <div className="shared-loading"><LoaderCircle className="shared-spin" size={19} />Carregando seus roteiros...</div>
      ) : activities.length === 0 ? (
        <section className="shared-empty">
          <div className="shared-empty-icon"><UsersRound size={24} /></div>
          <h2>Planeje algo em conjunto</h2>
          <p>Crie um roteiro, convide pessoas pelo e-mail da conta delas e montem o plano no mesmo lugar.</p>
          {!showCreateForm && <button type="button" className="shared-primary-button" onClick={() => setShowCreateForm(true)}><Plus size={17} />Criar primeiro roteiro</button>}
        </section>
      ) : (
        <div className="shared-workspace">
          <aside className="shared-activity-list" aria-label="Seus roteiros compartilhados">
            <div className="shared-list-heading"><span>Seus roteiros</span><span>{activities.length}</span></div>
            {activities.map((activity) => (
              <button type="button" key={activity.id} className={`shared-activity-choice ${selectedId === activity.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(activity.id)}>
                <span className="shared-choice-icon"><MapPin size={16} /></span>
                <span className="shared-choice-copy"><strong>{activity.title}</strong><small>{activity.destination || 'Sem destino definido'}</small></span>
                <ChevronRight size={16} />
              </button>
            ))}
          </aside>

          {selectedActivity && (
            <section className="shared-itinerary" aria-labelledby="shared-activity-title">
              <header className="shared-itinerary-header">
                <div>
                  <span className="shared-live-label"><i /> Compartilhado</span>
                  <h2 id="shared-activity-title">{selectedActivity.title}</h2>
                  {selectedActivity.destination && <p><MapPin size={15} />{selectedActivity.destination}</p>}
                </div>
                <span className="shared-member-count"><UsersRound size={15} />{selectedActivity.memberEmails?.length || 1} participantes</span>
              </header>

              <section className="shared-members" aria-label="Participantes">
                <div className="shared-section-title"><h3>Participantes</h3><span>Convide quem vai planejar com você</span></div>
                <div className="shared-member-chips">
                  {(selectedActivity.memberEmails || []).map((email) => (
                    <span className="shared-member-chip" key={email}><i>{(selectedActivity.memberNames?.[email] || email).charAt(0).toUpperCase()}</i>{selectedActivity.memberNames?.[email] || email}{email === userEmail ? ' · você' : ''}</span>
                  ))}
                </div>
                <form className="shared-invite-form" onSubmit={inviteMember}>
                  <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="E-mail da conta para convidar" aria-label="E-mail de quem participará" required />
                  <button type="submit" disabled={busy || !inviteEmail.trim()}><Plus size={15} />Adicionar pessoa</button>
                </form>
                <p className="shared-invite-hint">A pessoa acessa o roteiro ao entrar com esse mesmo e-mail.</p>
              </section>

              <section className="shared-plan-section">
                <div className="shared-section-title"><div><h3>Roteiro</h3><span>Etapas, passeios e outros planos</span></div><span className="shared-live-sync"><i /> Atualiza ao vivo</span></div>
                {items.length === 0 ? <p className="shared-items-empty">Adicione a primeira parada ou atividade do roteiro.</p> : (
                  <ol className="shared-item-list">
                    {items.map((item, index) => (
                      <li className="shared-itinerary-item" key={item.id}>
                        <span className="shared-item-marker">{String(index + 1).padStart(2, '0')}</span>
                        {editingItemId === item.id && editValues ? (
                          <form className="shared-item-edit" onSubmit={saveEdit}>
                            <input value={editValues.title} onChange={(event) => setEditValues({ ...editValues, title: event.target.value })} aria-label="Nome da atividade" required />
                            <div className="shared-item-edit-grid"><input type="date" value={editValues.date} onChange={(event) => setEditValues({ ...editValues, date: event.target.value })} aria-label="Data" /><input type="time" value={editValues.time} onChange={(event) => setEditValues({ ...editValues, time: event.target.value })} aria-label="Horário" /><input value={editValues.location} onChange={(event) => setEditValues({ ...editValues, location: event.target.value })} placeholder="Local" aria-label="Local" /></div>
                            <textarea value={editValues.notes} onChange={(event) => setEditValues({ ...editValues, notes: event.target.value })} placeholder="Detalhes" aria-label="Detalhes" rows={2} />
                            <div className="shared-item-actions"><button className="shared-save-small" type="submit" disabled={busy}><Check size={15} />Salvar</button><button type="button" onClick={() => { setEditingItemId(''); setEditValues(null); }}>Cancelar</button></div>
                          </form>
                        ) : (
                          <div className="shared-item-content">
                            <div className="shared-item-title-row"><h4>{item.title}</h4><div className="shared-item-actions"><button type="button" onClick={() => beginEdit(item)} aria-label={`Editar ${item.title}`}><Pencil size={15} /></button><button type="button" onClick={() => deleteItem(item.id)} aria-label={`Excluir ${item.title}`}><Trash2 size={15} /></button></div></div>
                            <div className="shared-item-meta">{item.date && <span><CalendarDays size={14} />{formatDate(item.date)}{item.time ? ` · ${item.time}` : ''}</span>}{item.location && <span><MapPin size={14} />{item.location}</span>}</div>
                            {item.notes && <p>{item.notes}</p>}
                            <small>Adicionado por {item.createdBy || 'participante'}</small>
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <form className="shared-add-item" onSubmit={saveItem}>
                <div className="shared-section-title"><h3>Adicionar ao roteiro</h3></div>
                <input value={itemTitle} onChange={(event) => setItemTitle(event.target.value)} placeholder="O que vocês vão fazer?" aria-label="Nome da atividade" required maxLength={120} />
                <div className="shared-add-item-grid"><label>Data<input type="date" value={itemDate} onChange={(event) => setItemDate(event.target.value)} /></label><label>Horário<input type="time" value={itemTime} onChange={(event) => setItemTime(event.target.value)} /></label><input value={itemLocation} onChange={(event) => setItemLocation(event.target.value)} placeholder="Local ou endereço" aria-label="Local ou endereço" /></div>
                <textarea value={itemNotes} onChange={(event) => setItemNotes(event.target.value)} placeholder="Detalhes, links ou observações (opcional)" aria-label="Detalhes da atividade" rows={2} />
                <button className="shared-primary-button" type="submit" disabled={busy || !itemTitle.trim()}>{busy ? <LoaderCircle className="shared-spin" size={16} /> : <Plus size={16} />}Adicionar atividade</button>
              </form>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
