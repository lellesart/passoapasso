export const ORGANIZER_BACKUP_FORMAT = 'passo-a-passo-organizer';
export const ORGANIZER_BACKUP_VERSION = 1;

const BACKUP_STORAGE_PREFIX = 'passo-a-passo:backup';
const ARRAY_FIELDS = ['tasks', 'habits', 'notes', 'events', 'aiActionAudit'];

const assertObject = (value, message) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
};

const cloneSerializableData = (data) => JSON.parse(JSON.stringify(data));

export const getOrganizerBackupStorageKey = (uid, slot = 'current') => {
  if (!uid) throw new Error('O backup exige um uid válido.');
  if (!['current', 'previous'].includes(slot)) throw new Error('Slot de backup inválido.');
  return `${BACKUP_STORAGE_PREFIX}:${uid}:${slot}`;
};

export const createOrganizerBackupPayload = ({ user, data, reason = 'manual', now = new Date() }) => {
  if (!user?.uid) throw new Error('Não há uma conta autenticada para gerar o backup.');
  assertObject(data, 'Os dados do organizador são inválidos.');

  return {
    format: ORGANIZER_BACKUP_FORMAT,
    backupVersion: ORGANIZER_BACKUP_VERSION,
    createdAt: now.toISOString(),
    reason,
    owner: {
      uid: user.uid,
      email: user.email || null,
    },
    data: cloneSerializableData(data),
  };
};

export const validateOrganizerBackupPayload = (payload) => {
  assertObject(payload, 'O arquivo não contém um backup válido.');

  if (payload.format !== ORGANIZER_BACKUP_FORMAT) {
    throw new Error('O arquivo não pertence ao formato de backup do Passo a Passo.');
  }

  if (payload.backupVersion !== ORGANIZER_BACKUP_VERSION) {
    throw new Error(`Versão de backup incompatível: ${payload.backupVersion ?? 'não informada'}.`);
  }

  assertObject(payload.owner, 'O backup não informa a conta de origem.');
  if (!payload.owner.uid || typeof payload.owner.uid !== 'string') {
    throw new Error('O backup não possui um uid de origem válido.');
  }

  assertObject(payload.data, 'O backup não contém dados do organizador.');
  for (const field of ARRAY_FIELDS) {
    if (!Array.isArray(payload.data[field])) {
      throw new Error(`O campo ${field} está ausente ou inválido no backup.`);
    }
  }

  assertObject(payload.data.dailyHabitsState, 'O estado diário dos hábitos está ausente ou inválido.');
  assertObject(payload.data.dailyHabitsState.completed, 'As marcações diárias dos hábitos estão inválidas.');

  return payload;
};

export const parseOrganizerBackupText = (text) => {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('O arquivo selecionado não contém um JSON válido.');
  }
  return validateOrganizerBackupPayload(payload);
};

export const saveCurrentOrganizerBackup = ({ storage, user, data, reason = 'snapshot' }) => {
  const payload = createOrganizerBackupPayload({ user, data, reason });
  storage.setItem(getOrganizerBackupStorageKey(user.uid, 'current'), JSON.stringify(payload));
  return payload;
};

export const saveOrganizerBackupPair = ({ storage, user, previousData, currentData, reason }) => {
  const previousPayload = createOrganizerBackupPayload({
    user,
    data: previousData,
    reason: `${reason}:before`,
  });
  const currentPayload = createOrganizerBackupPayload({
    user,
    data: currentData,
    reason: `${reason}:after`,
  });

  storage.setItem(getOrganizerBackupStorageKey(user.uid, 'previous'), JSON.stringify(previousPayload));
  storage.setItem(getOrganizerBackupStorageKey(user.uid, 'current'), JSON.stringify(currentPayload));
  return currentPayload;
};

export const createOrganizerBackupFilename = (user, now = new Date()) => {
  const accountLabel = (user?.email || user?.uid || 'conta')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `passo-a-passo-backup-${accountLabel}-${now.toISOString().slice(0, 10)}.json`;
};
