export interface ParticipantProfile {
  realName: string;
  avatar: string;
  avatarCharacter: string;
  position?: string;
}

// Présentation fournie par les participants ; noms et scores du pool restent ceux de Marqueur.
export const profiles: Record<string, ParticipantProfile> = {
  'Sir Jorah': { realName: 'Martin C.', avatar: 'jorah.webp', avatarCharacter: 'Jorah Mormont', position: '50% 10%' },
  'Podrick Payne': { realName: 'Martin L', avatar: 'podrick.webp', avatarCharacter: 'Podrick Payne', position: '50% 10%' },
  'Lord Baelish': { realName: 'Jean-Pascal', avatar: 'baelish.webp', avatarCharacter: 'Petyr Baelish', position: '50% 12%' },
  'Ned Stark': { realName: 'Steve', avatar: 'arya.jpg', avatarCharacter: 'Arya Stark' },
  'Sandor Cleagan': { realName: 'Alexandre', avatar: 'sandor.jpg', avatarCharacter: 'Sandor Clegane' },
  'Greyworm': { realName: 'Kev', avatar: 'greyworm.jpg', avatarCharacter: 'Grey Worm' },
  'Bronn': { realName: 'Gabriel', avatar: 'bronn.webp', avatarCharacter: 'Bronn', position: '50% 10%' },
};
