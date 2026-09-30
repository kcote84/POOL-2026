import { useState } from 'react';
import { Clock3, ExternalLink, Shield } from 'lucide-react';
import type { Roster, Standing, StandingHistory } from '../shared/types';
import { profiles } from './participants';
import { pageHref } from './platform';
import { useApi } from './useApi';
const format = new Intl.NumberFormat('fr-CA', {maximumFractionDigits:2});
const dateLabel = (date: string) => new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const dateTime = (stamp: string) => new Intl.DateTimeFormat('fr-CA', {dateStyle:'medium',timeStyle:'short',timeZone:'America/Toronto'}).format(new Date(stamp));
function HistoryCard() {
  const api = useApi<StandingHistory>('/api/history');
  const history = api.response?.data;
  const records = history?.records ?? [];
  const [selectedDate, setSelectedDate] = useState('');
  const record = records.find(r => r.date === selectedDate) ?? records.at(-1);
  const index = record ? records.indexOf(record) : -1;
  const previous = index > 0 ? records[index - 1] : null;
  return <details className="history-card"><summary><Clock3 size={17}/>Historique du classement</summary><div className="history-content">
    <p>Le dernier relevé validé de chaque journée est conservé, à l’heure de Montréal. Les journées antérieures au début du suivi ne sont pas reconstituées.</p>
    {record ? <><div className="history-toolbar"><label>Journée du relevé<select value={record.date} onChange={e => setSelectedDate(e.target.value)}>{[...records].reverse().map(r => <option key={r.date} value={r.date}>{dateLabel(r.date)}</option>)}</select></label><span>{records.length} journée{records.length > 1 ? 's' : ''} suivie{records.length > 1 ? 's' : ''} · saison {history!.season}</span></div>
      <div className="history-scroll" tabIndex={0} aria-label="Historique, défilement horizontal"><table className="history-table"><caption>Relevé du {dateLabel(record.date)} · {dateTime(record.observedAt)}, heure de Montréal</caption><thead><tr><th scope="col">Rang</th><th scope="col">Prétendant</th><th scope="col">Points</th><th scope="col">Variation</th></tr></thead><tbody>{record.participants.map(p => { const prior = previous?.participants.find(q => q.id === p.id); const change = prior ? p.points - prior.points : null; return <tr key={p.id}><td>{p.rank}</td><th scope="row"><a href={pageHref(`/formation/${p.id}`)}>{p.name}</a><small>{profiles[p.name]?.realName}</small></th><td>{format.format(p.points)}</td><td className={change !== null && change < 0 ? 'history-correction' : ''}>{change === null ? '—' : `${change > 0 ? '+' : ''}${format.format(change)}`}</td></tr>; })}</tbody></table></div>
      <p className="history-note">{previous ? `Variation par rapport au relevé du ${dateLabel(previous.date)}. Elle inclut les corrections de points publiées par Marqueur.` : 'Premier relevé du suivi. Les prochaines journées apparaîtront automatiquement.'}</p>
      {api.networkError && <p className="warning-text">Dernier historique consulté conservé. {api.networkError}</p>}
    </> : <p role="status">{api.loading ? 'Chargement de l’historique…' : api.networkError ? 'L’historique est temporairement indisponible.' : 'Le suivi commencera à la prochaine récupération validée.'}</p>}
  </div></details>;
}
function ScoringGuide({ standing }: { standing: Standing }) {
  const teamParticipant = standing.participants.find(p => p.name === 'Sir Jorah') ?? standing.participants[0];
  const goalieParticipant = standing.participants.find(p => p.name === 'Greyworm') ?? standing.participants[0];
  const teamApi = useApi<Roster>(`/api/rosters/${teamParticipant.id}`);
  const goalieApi = useApi<Roster>(`/api/rosters/${goalieParticipant.id}`);
  const examples = [{roster:teamApi.response?.data,category:'JOUEURS'}, {roster:goalieApi.response?.data,category:'GARDIENS'}, {roster:teamApi.response?.data,category:'ÉQUIPES'}];
  return <details className="pool-rules"><summary><Shield size={17}/>Comprendre les points et le barème</summary><div className="rules-content">
    <p>Le classement utilise les points de notre pool, attribués par Marqueur selon ses paramètres. Les statistiques sportives et les bonus sont déjà compris dans le total de chaque sélection.</p>
    <dl className="rules-definitions"><div><dt>PTS POOL / TOT</dt><dd>Points attribués à la sélection. Les totaux des joueurs, gardiens et équipes forment le score de la maison.</dd></div><div><dt>PJ</dt><dd>Parties jouées par les sélections. Plusieurs joueurs d’une maison peuvent jouer dans le même match : chaque participation compte.</dd></div><div><dt>MOY / MATCH</dt><dd>Points du pool par partie jouée, avec l’arrondi fourni par Marqueur. Les sélections sans match ont une moyenne nulle dans la source.</dd></div><div><dt>V · VP · VF</dt><dd>Victoire en temps régulier, en prolongation ou en fusillade. Une seule de ces trois colonnes compte une victoire donnée.</dd></div><div><dt>BL · B3</dt><dd>Blanchissages et tours du chapeau. Ces événements peuvent accompagner une victoire ou des buts; leurs bonus sont inclus dans PTS POOL.</dd></div><div><dt>Réservistes et inactifs</dt><dd>Leur présence dans une formation ne signifie pas qu’ils accumulent des points. Les statuts et totaux applicables restent ceux de Marqueur.</dd></div></dl>
    <h3>Exemples vérifiés dans nos formations</h3><p>Ces exemples montrent les statistiques et points réellement attribués. Ils ne remplacent pas les paramètres officiels du pool.</p><div className="scoring-examples">{examples.map(({ roster, category }) => {
      const group = roster?.groups.find(g => g.name === category);
      const entry = category === 'ÉQUIPES' ? group?.entries.find(e => e.name === 'Florida Panthers') ?? group?.entries.find(e => e.points > 0) ?? group?.entries[0] : group?.entries.find(e => e.points > 0) ?? group?.entries[0];
      if (!group || !entry || !roster) return null;
      return <article key={category}><span>{category.toLocaleLowerCase('fr')}</span><h4>{entry.name}</h4><dl>{group.columns.filter(c => !['TOT','MOY'].includes(c.label) && (c.label === 'PJ' || entry.stats[c.key] !== 0)).map(c => <div key={c.key}><dt><abbr title={c.description}>{c.label}</abbr></dt><dd>{format.format(entry.stats[c.key])}</dd></div>)}</dl><strong>{format.format(entry.points)} points du pool</strong><a href={roster.sourceUrl} target="_blank" rel="noreferrer">Vérifier sur Marqueur <ExternalLink size={12}/></a></article>;
    })}</div><a href={standing.sourceUrl} className="text-link" target="_blank" rel="noreferrer">Notre classement de référence sur Marqueur <ExternalLink size={13}/></a>
  </div></details>;
}
export function PoolInformation({ standing }: {standing:Standing}) {
  return <div className="pool-information"><HistoryCard/><ScoringGuide standing={standing}/></div>;
}