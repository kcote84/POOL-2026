import { useEffect, useState } from 'react';
import { Crest, houses } from './Crest';
import { profiles } from './participants';
import { baseUrl } from './platform';

export function Portrait({ name, large = false }: { name: string; large?: boolean }) {
  const profile = profiles[name];
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [name]);
  if (!profile || failed) return <Crest name={name} large={large}/>;
  return <span className={`portrait ${large ? 'portrait-large' : ''}`} style={{ borderColor: houses[name]?.color }}>
    <img src={`${baseUrl}avatars/${profile.avatar}`} alt={`Portrait de ${profile.avatarCharacter}`} width="96" height="96" loading={large ? 'eager' : 'lazy'} decoding="async" style={{ objectPosition: profile.position ?? 'center' }} onError={() => setFailed(true)}/>
    <span className="portrait-sigil" aria-hidden="true"><Crest name={name}/></span>
  </span>;
}
