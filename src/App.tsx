import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, Crown, ExternalLink, Flag, LoaderCircle, RefreshCw, Shield, Swords, Trophy, WifiOff } from 'lucide-react';
import type { ApiResponse, Daily, Participant, Roster, Standing, SyncMeta } from '../shared/types';
import { houses } from './Crest';
import { Portrait } from './Portrait';
import { profiles } from './participants';
import { apiHref, baseUrl, currentMeta, currentPath, pageHref, staticPages } from './platform';

const format = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 });
const dateTime = (s: string) => new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' }).format(new Date(s));
function Link({ to, children, className, ...props }: { to: string; children: ReactNode; className?: string; 'aria-label'?: string }) {
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); window.history.pushState({}, '', pageHref(to)); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo({ top: 0, behavior: 'instant' });
  };
  return <a href={pageHref(to)} onClick={click} className={className} {...props}>{children}</a>;
}
function useApi<T>(endpoint: string) {
  const [response, setResponse] = useState<ApiResponse<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => { setResponse(null); setLoading(true); setNetworkError(null); }, [endpoint]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function get() {
      try {
        const res = await fetch(apiHref(endpoint), { cache: 'no-cache', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        if (!res.ok) throw new Error(res.status === 404 ? 'Cette formation est introuvable.' : 'Le serveur du royaume est indisponible.');
        const json = await res.json() as ApiResponse<T>;
        if (!json.meta) throw new Error('Réponse du serveur non reconnue.');
        json.meta = currentMeta(json.meta);
        if (!stopped) { setResponse(json); setNetworkError(null); }
        if (!stopped) timer = setTimeout(get, json.meta.refreshing ? 2000 : 60_000);
      } catch (error) {
        if (!stopped) { setNetworkError(error instanceof Error ? error.message : 'Connexion impossible.'); timer = setTimeout(get, 30_000); }
      } finally { if (!stopped) setLoading(false); }
    }
    void get();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [endpoint, reload]);
  return { response, loading, networkError, retry: () => setReload(v => v + 1) };
}
function Status({ meta, networkError }: { meta: SyncMeta; networkError?: string | null }) {
  const warning = meta.stale || meta.error || networkError;
  return <div className={`sync-status ${warning ? 'warning' : ''}`} role="status">
    {warning ? <WifiOff size={14}/> : <span className="status-dot"/>}
    <span>{meta.fetchedAt ? `Récupéré le ${dateTime(meta.fetchedAt)}` : 'Première récupération en cours'}{meta.fetchedAt && ' · heure de Montréal'}</span>
    {meta.stale && meta.fetchedAt && <strong>Données anciennes</strong>}
    {!meta.stale && warning && <strong>Synchronisation interrompue</strong>}
    {meta.refreshing && <LoaderCircle size={14} className="spin"/>}
  </div>;
}
function Empty({ loading, error, retry }: { loading?: boolean; error?: string | null; retry: () => void }) {
  return <div className="empty-state" role="status">{loading ? <LoaderCircle className="spin" size={32}/> : <Shield size={32}/>}
    <h2>{loading ? 'Les corbeaux rassemblent les nouvelles…' : 'Les nouvelles du royaume sont indisponibles'}</h2>
    <p>{loading ? 'Le classement et les sept formations sont vérifiés avant d’être affichés.' : error ?? 'Aucun résultat valide n’a encore été récupéré.'}</p>
    {!loading && <button className="button" onClick={retry}><RefreshCw size={15}/> Réessayer</button>}
  </div>;
}
function Header({ path, season }: { path: string; season?: string }) {
  return <header className="site-header"><div className="header-inner">
    <Link to="/" className="brand"><span className="brand-mark"><Crown size={25}/></span><span className="brand-text">LE CONSEIL DES SEPT<small>POOL DE HOCKEY · KEVEN2026</small></span></Link>
    <nav aria-label="Navigation principale">
      <Link to="/" className={path === '/' ? 'active' : ''}><Trophy size={15}/>Classement</Link>
      <Link to="/formations" className={path.startsWith('/formation') ? 'active' : ''}><Shield size={15}/>Formations</Link>
      <Link to="/batailles" className={path === '/batailles' ? 'active' : ''}><Swords size={16}/>Batailles du jour</Link>
    </nav>
    <span className="season"><span className="status-dot"/>SAISON {season ?? 'EN COURS'}</span>
  </div></header>;
}
function Hero({ season }: { season: string }) {
  return <section className="hero">
    <div className="hero-art" aria-hidden="true" style={{ backgroundImage: `url('${baseUrl}fortress.svg')` }}/>
    <div className="hero-content"><div className="eyebrow"><span/>SEPT PRÉTENDANTS. UN SEUL TRÔNE.</div>
      <h1>La course au<br/><em>Trône de fer</em></h1>
      <p>Les alliances s’effacent. Les points restent.<br/>Suivez la conquête de notre royaume de hockey.</p>
      <div className="hero-details"><span><Flag size={14}/>Keven2026</span><i/><span>Saison {season}</span></div>
    </div><div className="hero-art-label"><span>VII</span><small>QUE LE MEILLEUR RÈGNE</small></div>
  </section>;
}
function SectionTitle({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle?: string; children?: ReactNode }) {
  return <div className="section-heading"><div className="section-heading-main"><span className="heading-icon">{icon}</span><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{children}</div>;
}
function Leader({ participants }: { participants: Participant[] }) {
  const leader = participants[0];
  const tied = participants.filter(p => p.points === leader.points);
  return <section className="leader-card">
    <div className="leader-top"><Crown size={17}/><span>{tied.length > 1 ? 'AU SOMMET, À ÉGALITÉ' : 'SUR LE TRÔNE'}</span><span className="tiny-ornament">✧</span></div>
    <div className="leader-identity"><div className="leader-crest"><Portrait name={leader.name} large/></div><div><span className="label">MENEUR DU ROYAUME</span><h2>{leader.name}</h2><p className="real-name">{profiles[leader.name]?.realName}</p><p className="participant-motto">{houses[leader.name]?.motto}</p></div></div>
    {tied.length > 1 && <p className="tie-note">À égalité avec {tied.slice(1).map(p => p.name).join(', ')}</p>}
    <div className="leader-numbers"><div><strong>{format.format(leader.points)}</strong><span>POINTS DU POOL</span></div><i/><div><strong>{format.format(leader.points - participants[1].points)}<small> pts</small></strong><span>D’AVANCE SUR LE 2ᵉ</span></div></div>
    <Link to={`/formation/${leader.id}`} className="leader-link">Explorer sa formation <ArrowRight size={16}/></Link>
  </section>;
}
function Rankings({ standing }: { standing: Standing }) {
  return <section className="rankings"><SectionTitle icon={<Trophy size={20}/>} title="Les prétendants au trône" subtitle="Le classement cumulatif des sept maisons"><span className="chip">7 MAISONS</span></SectionTitle>
    <div className="ranking-table" role="table" aria-label="Classement cumulatif">
      <div className="ranking-head ranking-grid" role="row"><span role="columnheader">RANG</span><span role="columnheader">PRÉTENDANT</span><span role="columnheader">POINTS</span><span role="columnheader">ÉCART</span><span className="formation-head" role="columnheader">FORMATION</span></div>
      {standing.participants.map(p => <div className={`ranking-row ranking-grid ${p.rank === 1 ? 'first' : ''}`} key={p.id} role="row">
        <span className={`rank rank-${p.rank}`} role="cell">{String(p.rank).padStart(2, '0')}{p.rank === 1 && <Crown size={12}/>}</span>
        <span className="rank-identity" role="cell"><Portrait name={p.name}/><span><Link to={`/formation/${p.id}`} className="participant-name">{p.name}</Link><small className="real-name">{profiles[p.name]?.realName}</small></span></span>
        <strong className="points" role="cell">{format.format(p.points)}<small>pts</small></strong>
        <span className={`gap ${p.gap === 0 ? 'zero' : ''}`} role="cell">{p.gap === 0 ? '—' : <><ArrowDown size={11}/>{format.format(p.gap)}</>}</span>
        <span role="cell"><Link to={`/formation/${p.id}`} className="formation-link" aria-label={`Voir la formation de ${p.name}`}><span>Voir</span><ChevronRight size={17}/></Link></span>
      </div>)}
    </div><div className="table-note"><Shield size={13}/><span>Points et ordre du classement fournis par Marqueur.com.</span></div>
  </section>;
}
function DailyCard({ full = false }: { full?: boolean }) {
  const api = useApi<Daily>('/api/daily');
  const daily = api.response?.data;
  return <section className={`daily-card ${full ? 'daily-full' : ''}`}><div className="daily-heading"><Swords size={21}/><h2>Les batailles du jour</h2></div>
    {daily ? <><p className="daily-date">{daily.date}</p><div className="daily-results">{daily.participants.map(p => <div key={p.id}><Link to={`/formation/${p.id}`} className="daily-participant"><Portrait name={p.name}/><span>{p.name}<small className="real-name">{profiles[p.name]?.realName}</small></span></Link><strong>{format.format(p.points)} <small>pts</small></strong></div>)}</div>{api.response && <Status meta={api.response.meta}/>}</> : <><div className="daily-symbol"><Swords size={34}/><span>✦</span></div><span className="label">EN ATTENTE DE NOUVELLES FIABLES</span><p>Le tableau quotidien de Marqueur ne précise pas la journée concernée.</p><p className="muted">Les résultats s’afficheront ici lorsque leur date pourra être confirmée.</p>{api.networkError && <p className="warning-text">{api.networkError}</p>}</>}
    <a className="text-link" href="https://www.marqueur.com/hockey/mbr/tools/pool/standing_01.php?nyx=219062&c=0" target="_blank" rel="noreferrer">Consulter Marqueur <ExternalLink size={13}/></a>
  </section>;
}
function Home({ standing }: { standing: Standing }) {
  return <><Hero season={standing.season}/><div className="dashboard"><Rankings standing={standing}/><aside><Leader participants={standing.participants}/><DailyCard/><div className="quote"><span>“</span><p>Une couronne se gagne<br/>un point à la fois.</p><small>LA DEVISE DU CONSEIL</small></div></aside></div></>;
}
function Formations({ standing }: { standing: Standing }) {
  return <><div className="page-intro"><div className="eyebrow">LES SEPT MAISONS</div><h1>Les armées du royaume</h1><p>Chaque sélection compte. Explorez les joueurs, les gardiens et les équipes de chaque prétendant.</p></div><div className="houses-grid">{standing.participants.map(p => <Link to={`/formation/${p.id}`} key={p.id} className="house-card"><span className="house-rank">RANG {String(p.rank).padStart(2, '0')}</span><Portrait name={p.name} large/><h2>{p.name}</h2><p className="real-name">{profiles[p.name]?.realName}</p><p className="participant-motto">{houses[p.name]?.motto}</p><div><strong>{format.format(p.points)} <small>pts</small></strong><span>Voir la formation <ArrowRight size={15}/></span></div></Link>)}</div></>;
}
function Formation({ id, standing }: { id: string; standing: Standing }) {
  const api = useApi<Roster>(`/api/rosters/${encodeURIComponent(id)}`);
  const [activeGroup, setActiveGroup] = useState(0);
  const [sort, setSort] = useState<'source' | 'points'>('source');
  const roster = api.response?.data;
  const participant = standing.participants.find(p => p.id === id);
  useEffect(() => { setActiveGroup(0); setSort('source'); }, [id]);
  if (!participant) return <><Link to="/" className="back-link"><ArrowLeft size={15}/>Retour au classement</Link><Empty error="Ce prétendant ne figure pas dans notre pool." retry={api.retry}/></>;
  if (!roster) return <><Link to="/" className="back-link"><ArrowLeft size={15}/>Retour au classement</Link><Empty loading={api.loading || api.response?.meta.refreshing} error={api.networkError ?? api.response?.meta.error} retry={api.retry}/></>;
  const group = roster.groups[activeGroup] ?? roster.groups[0];
  const shownColumns = [...group.columns.filter(c => c.label === 'TOT'), ...group.columns.filter(c => c.label !== 'TOT')];
  const entries = sort === 'points' ? [...group.entries].sort((a, b) => b.points - a.points) : group.entries;
  return <><Link to="/" className="back-link"><ArrowLeft size={15}/>Retour au classement</Link>
    <section className="roster-hero"><Portrait name={roster.name} large/><div><div className="eyebrow">LA FORMATION · RANG {participant.rank}</div><h1>{roster.name}</h1><p className="real-name">{profiles[roster.name]?.realName}</p><p className="participant-motto">{houses[roster.name]?.motto}</p></div><div className="roster-total"><strong>{format.format(roster.total)}</strong><span>POINTS DU POOL</span></div></section>
    {api.response && <Status meta={api.response.meta} networkError={api.networkError}/>}
    <div className="roster-toolbar"><div className="tabs" role="tablist" aria-label="Catégories de la formation">{roster.groups.map((g, i) => <button key={g.name} id={`tab-${i}`} role="tab" aria-selected={activeGroup === i} aria-controls="roster-panel" tabIndex={activeGroup === i ? 0 : -1} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? roster.groups.length - 1 : (activeGroup + (e.key === 'ArrowRight' ? 1 : -1) + roster.groups.length) % roster.groups.length; setActiveGroup(next); document.getElementById(`tab-${next}`)?.focus(); } }} onClick={() => setActiveGroup(i)}>{g.name.toLocaleLowerCase('fr')}<span>{g.entries.length}</span></button>)}</div>
      <label className="sort-label">Trier par <select value={sort} onChange={e => setSort(e.target.value as 'source' | 'points')}><option value="source">Ordre de Marqueur</option><option value="points">Points du pool</option></select></label></div>
    <section id="roster-panel" role="tabpanel" aria-labelledby={`tab-${activeGroup}`} tabIndex={0} className="roster-panel">
      <div className="roster-panel-heading"><div><h2>{group.name === 'JOUEURS' ? 'Les joueurs de la maison' : group.name === 'GARDIENS' ? 'Les gardiens de la maison' : 'Les équipes de la maison'}</h2><p>{group.entries.length} sélections · statistiques cumulatives</p></div><span className="chip">{format.format(group.total)} PTS DU POOL</span></div>
      <div className="roster-scroll" tabIndex={0} aria-label="Statistiques de la formation, défilement horizontal"><table className="roster-table" style={{ minWidth: 190 + shownColumns.length * 80 }}><colgroup><col style={{ width: 190 }}/>{shownColumns.map(c => <col key={c.key} style={{ width: 80 }}/>)}</colgroup><caption className="sr-only">{group.name} de {roster.name}. TOT correspond aux points attribués par le pool.</caption><thead><tr><th scope="col">SÉLECTION</th>{shownColumns.map(c => <th scope="col" key={c.key} className={c.label === 'TOT' ? 'pool-total' : ''}><abbr title={c.description}>{c.label === 'TOT' ? 'PTS POOL' : c.label}</abbr></th>)}</tr></thead><tbody>{entries.map((e, i) => <tr key={`${e.name}-${i}`}><th scope="row"><div className="selection-name"><span className="team-code">{e.team}</span><div>{e.name}<small>{e.round && `Choix ${e.round} · `}{e.status}</small></div></div></th>{shownColumns.map(c => <td key={c.key} className={c.label === 'TOT' ? 'pool-total' : ''}>{format.format(e.stats[c.key])}</td>)}</tr>)}</tbody><tfoot><tr><th scope="row">TOTAL MARQUEUR</th>{shownColumns.map(c => <td key={c.key} className={c.label === 'TOT' ? 'pool-total' : ''}>{c.label === 'TOT' ? format.format(group.total) : '—'}</td>)}</tr></tfoot></table></div>
    </section><div className="roster-bottom"><p><Shield size={15}/>Les points et totaux sont calculés par Marqueur selon les règles de notre pool.</p><a href={roster.sourceUrl} target="_blank" rel="noreferrer" className="text-link">Formation sur Marqueur <ExternalLink size={13}/></a></div>
    <details className="legend"><summary>Comprendre les statistiques</summary><div>{group.columns.map(c => <p key={c.key}><strong>{c.label === 'TOT' ? 'PTS POOL' : c.label}</strong> {c.description}</p>)}</div></details>
    <nav className="other-houses" aria-label="Autres formations">{standing.participants.map(p => <Link to={`/formation/${p.id}`} key={p.id} className={p.id === id ? 'selected' : ''}>{p.name}</Link>)}</nav>
  </>;
}
export function App() {
  const [path, setPath] = useState(currentPath());
  const previousPath = useRef(path);
  const api = useApi<Standing>('/api/standing');
  const [checked, setChecked] = useState(false);
  useEffect(() => { const handler = () => setPath(currentPath()); window.addEventListener('popstate', handler); window.addEventListener('hashchange', handler); return () => { window.removeEventListener('popstate', handler); window.removeEventListener('hashchange', handler); }; }, []);
  useEffect(() => { const title = path.startsWith('/formation/') ? api.response?.data?.participants.find(p => path.endsWith(`/${p.id}`))?.name : path === '/formations' ? 'Les formations' : path === '/batailles' ? 'Les batailles du jour' : 'La course au Trône de fer'; document.title = `${title ?? 'La formation'} · Keven2026`; if (previousPath.current !== path) document.getElementById('main-content')?.focus({ preventScroll: true }); previousPath.current = path; }, [path, api.response?.data?.season]);
  const standing = api.response?.data;
  const rosterMatch = path.match(/^\/formation\/(\d+)\/?$/);
  return <><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); const main = document.getElementById('main-content'); main?.focus(); main?.scrollIntoView({ block: 'start' }); }}>Aller au contenu</a><Header path={path} season={standing?.season}/><main id="main-content" tabIndex={-1}>
    {standing && path === '/' && <div className="overview-bar"><span>LE CHRONIQUEUR DU ROYAUME</span><span><Clock3 size={13}/>{staticPages ? 'Récupération prévue' : 'Actualisation'} {staticPages ? '~' : 'toutes les '}{api.response!.meta.intervalMinutes} min</span></div>}
    {!standing ? <Empty loading={api.loading || api.response?.meta.refreshing} error={api.networkError ?? api.response?.meta.error} retry={api.retry}/> : <>
      {path === '/' ? <Home standing={standing}/> : path === '/formations' ? <Formations standing={standing}/> : rosterMatch ? <Formation key={rosterMatch[1]} id={rosterMatch[1]} standing={standing}/> : path === '/batailles' ? <><div className="page-intro"><div className="eyebrow">LES CHRONIQUES DU ROYAUME</div><h1>Les batailles du jour</h1><p>Les points quotidiens de nos sept prétendants, lorsque la source confirme leur date.</p></div><DailyCard full/></> : <><div className="empty-state"><h1>Cette route quitte le royaume.</h1><Link to="/" className="button">Revenir au classement <ArrowRight size={16}/></Link></div></>}
      <div className="source-bar"><Status meta={api.response!.meta} networkError={api.networkError}/><button className="refresh-button" onClick={() => { api.retry(); setChecked(true); setTimeout(() => setChecked(false), 5000); }}><RefreshCw size={13}/>{checked ? 'Cache vérifié' : 'Vérifier les nouvelles'}</button></div>
      {(api.response?.meta.error || api.networkError) && <div className="error-banner" role="alert"><WifiOff size={17}/><p><strong>Dernier résultat valide conservé.</strong> {api.networkError ?? api.response?.meta.error}</p></div>}
      {checked && <p className="check-note" role="status"><Check size={13}/>{staticPages ? 'Dernier résultat publié consulté. Les nouvelles sont récupérées périodiquement.' : `Le cache est partagé. La prochaine récupération respecte l’intervalle de ${api.response!.meta.intervalMinutes} minutes.`}</p>}
    </>}
  </main><footer><div><Crown size={17}/><span>LE CONSEIL DES SEPT</span><small>Sept amis. Une saison. Une couronne.</small></div><a href="https://www.marqueur.com/hockey/mbr/tools/pool/index.php?nyx=219062" target="_blank" rel="noreferrer">Notre pool sur Marqueur <ExternalLink size={12}/></a><p>Résultats récupérés périodiquement · Aucune donnée présentée en direct</p></footer></>;
}
