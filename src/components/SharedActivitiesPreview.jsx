import { useEffect, useState } from 'react';
import { ChevronRight, LoaderCircle, MapPin, UsersRound } from 'lucide-react';
import { collection, db, onSnapshot, query, where } from '../firebase/config';
import './SharedActivitiesPreview.css';

const countParticipants = (emails = []) => new Set(
  emails.map((email) => String(email || '').trim().toLowerCase()).filter(Boolean)
).size;

export function SharedActivitiesPreview({ currentUser, onOpen }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(Boolean(currentUser?.uid));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser?.uid) {
      setActivities([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const ownedActivitiesQuery = query(
      collection(db, 'sharedActivities'),
      where('ownerUid', '==', currentUser.uid),
    );
    return onSnapshot(ownedActivitiesQuery, (snapshot) => {
      const nextActivities = snapshot.docs
        .map((activityDoc) => ({ id: activityDoc.id, ...activityDoc.data() }))
        .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setActivities(nextActivities);
      setLoading(false);
      setError('');
    }, (snapshotError) => {
      console.error('Carregar prévia dos roteiros:', snapshotError?.code || snapshotError);
      setLoading(false);
      setError('Não foi possível carregar os roteiros agora.');
    });
  }, [currentUser?.uid]);

  return (
    <section className="shared-preview-panel" aria-labelledby="shared-preview-title">
      <header className="shared-preview-heading">
        <div>
          <span className="shared-preview-kicker">Planejamento em grupo</span>
          <h2 id="shared-preview-title">Roteiros compartilhados · 04</h2>
        </div>
        <span className="shared-preview-total">
          {activities.length} {activities.length === 1 ? 'roteiro' : 'roteiros'}
        </span>
      </header>

      {loading ? (
        <div className="shared-preview-state"><LoaderCircle className="shared-preview-spin" size={16} />Carregando roteiros...</div>
      ) : error ? (
        <p className="shared-preview-state is-error" role="status">{error}</p>
      ) : activities.length === 0 ? (
        <div className="shared-preview-empty">
          <p>Seus planos de viagem em grupo vão aparecer aqui.</p>
          <button type="button" className="shared-preview-link" onClick={onOpen}>Criar primeiro roteiro<ChevronRight size={15} /></button>
        </div>
      ) : (
        <>
          <ul className="shared-preview-list">
            {activities.slice(0, 3).map((activity) => (
              <li key={activity.id}>
                <span className="shared-preview-pin"><MapPin size={16} /></span>
                <span className="shared-preview-copy">
                  <strong>{activity.title}</strong>
                  <small>{activity.destination || 'Destino a definir'}</small>
                </span>
                <span className="shared-preview-members" aria-label={`${countParticipants(activity.memberEmails)} participantes`}>
                  <UsersRound size={14} />{countParticipants(activity.memberEmails)}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="shared-preview-link" onClick={onOpen}>Ver todos os roteiros<ChevronRight size={15} /></button>
        </>
      )}
    </section>
  );
}
