import { load, type CheerioAPI } from 'cheerio';
import type { Daily, Participant, Roster, RosterGroup, Standing } from '../shared/types';

export const STANDING_URL = 'https://www.marqueur.com/hockey/mbr/tools/pool/standing_03.php?nyx=219062';
export const DAILY_URL = 'https://www.marqueur.com/hockey/mbr/tools/pool/standing_01.php?nyx=219062&c=0';
const names = ['Sir Jorah', 'Podrick Payne', 'Sandor Cleagan', 'Lord Baelish', 'Ned Stark', 'Greyworm', 'Bronn'];
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
export function number(text: string): number {
  const value = clean(text).replace(/\s/g, '').replace(',', '.');
  if (value === '-' || value === '—') return 0;
  if (!/^[+-]?\d+(\.\d+)?$/.test(value)) throw new Error(`Valeur numérique invalide : « ${text.slice(0, 50)} ».`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('Valeur numérique non finie.');
  return n;
}
export function safeSource(raw: string, base = STANDING_URL, page = 'stats_03.php') {
  const url = new URL(raw, base);
  if (url.origin !== 'https://www.marqueur.com' || url.pathname !== `/hockey/mbr/tools/pool/${page}` || url.searchParams.get('nyx') !== '219062' || !/^\d+\|\d+$/.test(url.searchParams.get('no') ?? '')) {
    throw new Error('Lien de formation inattendu.');
  }
  return url.href;
}
function heading($: CheerioAPI, element: Parameters<CheerioAPI>[0]) {
  const copy = $(element).find('.ee').first().clone();
  copy.children().remove();
  return clean(copy.text());
}
function tableFor($: CheerioAPI, title: string) {
  const container = $('.div_table').filter((_, el) => heading($, el) === title);
  if (container.length !== 1) throw new Error(`Tableau ${title} absent ou ambigu. Format Marqueur non reconnu.`);
  return container;
}
function readParticipants($: CheerioAPI, title: string, page: string): Participant[] {
  const table = tableFor($, title).find('table').first();
  const headers = table.find('tr').first().children('td,th').map((_, c) => clean($(c).text())).get();
  const required = ['POOLERS', 'PJ', 'TOT', 'JOU', 'GAR', 'ÉQU', 'MOY', 'DIF'];
  if (JSON.stringify(headers) !== JSON.stringify(required)) throw new Error('Colonnes du classement modifiées.');
  const participants = table.find('tr.tr').map((_, row) => {
    const cells = $(row).children('td');
    if (cells.length !== 8) throw new Error('Ligne du classement incomplète.');
    const a = cells.eq(0).find('a');
    const name = clean(a.attr('title')?.split(' (')[0] ?? a.text());
    if (!names.some(n => n.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error(`Participant inconnu : ${name}.`);
    const sourceUrl = safeSource(a.attr('href') ?? '', STANDING_URL, page);
    const rank = Number(clean(cells.eq(0).text()).match(/^(\d+)-/)?.[1]);
    const points = number(cells.eq(2).text());
    const players = number(cells.eq(3).text()), goalies = number(cells.eq(4).text()), teams = number(cells.eq(5).text());
    if (!Number.isInteger(rank) || points !== players + goalies + teams) throw new Error('Total du classement incohérent.');
    return { id: new URL(sourceUrl).searchParams.get('no')!.split('|')[0], name, rank, points, gap: number(cells.eq(7).text()), games: number(cells.eq(1).text()), players, goalies, teams, average: number(cells.eq(6).text()), sourceUrl };
  }).get();
  if (participants.length !== 7 || new Set(participants.map(p => p.id)).size !== 7 || new Set(participants.map(p => p.name.toLowerCase())).size !== 7) throw new Error('Les sept participants ne sont pas tous présents.');
  participants.forEach((p, i) => {
    if (p.rank !== i + 1 || (i && p.points > participants[i - 1].points) || p.gap !== participants[0].points - p.points) throw new Error('Ordre ou écart du classement incohérent.');
  });
  return participants;
}
export function parseStanding(html: string): Standing {
  const $ = load(html);
  const season = clean(tableFor($, 'CUMULATIF').find('.ee2').text());
  if (!/^\d{4}-\d{4}$/.test(season)) throw new Error('Saison du classement introuvable.');
  return { season, participants: readParticipants($, 'CUMULATIF', 'stats_03.php'), sourceUrl: STANDING_URL };
}
export function parseRoster(html: string, participant: Participant, season: string): Roster {
  const $ = load(html);
  const summary = tableFor($, 'SOMMAIRE');
  if (!clean(summary.find('.ee2').text()).includes(participant.name.toUpperCase()) || !summary.find('.ee2').text().includes(season)) throw new Error('La formation reçue ne correspond pas au participant ou à la saison.');
  const groups: RosterGroup[] = [];
  $('.div_table').each((_, container) => {
    const name = heading($, container);
    if (!['JOUEURS', 'ATTAQUANTS', 'DÉFENSEURS', 'GARDIENS', 'ÉQUIPES'].includes(name)) return;
    const table = $(container).find('table').first();
    const headers: { label: string; description: string }[] = [];
    table.find('tr').first().children('td,th').each((_, cell) => {
      const label = clean($(cell).text());
      const span = Number($(cell).attr('colspan') ?? 1);
      for (let i = 0; i < span; i++) headers.push({ label, description: $(cell).attr('data-tip') ?? label });
    });
    const totalIndex = headers.findIndex(h => h.label === 'TOT');
    const pjIndex = headers.findIndex(h => h.label === 'PJ');
    if (totalIndex < 0 || pjIndex < 0) throw new Error(`Statistiques de ${name} non reconnues.`);
    const columns = headers.slice(pjIndex).map((h, i) => ({ key: String(pjIndex + i), ...h }));
    const entries = table.find('tr.tr').map((_, row) => {
      const cells = $(row).children('td');
      if (cells.length !== headers.length) throw new Error(`Ligne de ${name} incomplète.`);
      const link = cells.eq(1).find('a').first();
      const entryName = clean(link.text());
      if (!entryName) throw new Error('Choix sans nom.');
      const stats = Object.fromEntries(columns.map(c => [c.key, number(cells.eq(Number(c.key)).text())]));
      const tip = load(link.attr('data-tip') ?? '').text();
      const status = clean(tip.match(/(Actif depuis[^]*|Réserviste[^]*|Inactif[^]*)/i)?.[0] ?? 'Statut non précisé');
      return { name: entryName, team: clean(cells.eq(0).text()), round: clean(cells.eq(1).text()).match(/\((\d+)\)\s*$/)?.[1] ?? '', status, stats, points: stats[String(totalIndex)] };
    }).get();
    const totals: string[] = [];
    table.find('tr.tr_tot').children('td').each((_, cell) => {
      const span = Number($(cell).attr('colspan') ?? 1);
      for (let i = 0; i < span; i++) totals.push(clean($(cell).text()));
    });
    if (!entries.length || totals.length !== headers.length) throw new Error(`Formation ${name} vide ou sans total.`);
    const total = number(totals[totalIndex]);
    // Totaux de Marqueur conservés tels quels. Vérification sans recalcul des règles du pool.
    groups.push({ name, columns, entries, total });
  });
  const groupNames = groups.map(g => g.name);
  if (!groupNames.includes('GARDIENS') || !groupNames.includes('ÉQUIPES') || !(groupNames.includes('JOUEURS') || (groupNames.includes('ATTAQUANTS') && groupNames.includes('DÉFENSEURS'))) || new Set(groupNames).size !== groups.length || (groupNames.includes('JOUEURS') && (groupNames.includes('ATTAQUANTS') || groupNames.includes('DÉFENSEURS')))) throw new Error('Catégories de formation incomplètes ou ambiguës.');
  const summaryTable = summary.find('table').first();
  const summaryHeaders = summaryTable.find('tr').first().children('td').map((_, c) => clean($(c).text())).get();
  const summaryTotalIndex = summaryHeaders.indexOf('TOT');
  if (summaryTotalIndex < 0) throw new Error('Sommaire non reconnu.');
  const total = number(summaryTable.find('tr.tr_tot').children('td').eq(summaryTotalIndex).text());
  if (total !== groups.reduce((n, g) => n + g.total, 0) || total !== participant.points) throw new Error(`Le total de ${participant.name} diffère du classement. Récupération à reprendre.`);
  if (groups.filter(g => ['JOUEURS', 'ATTAQUANTS', 'DÉFENSEURS'].includes(g.name)).reduce((n, g) => n + g.total, 0) !== participant.players || groups.find(g => g.name === 'GARDIENS')!.total !== participant.goalies || groups.find(g => g.name === 'ÉQUIPES')!.total !== participant.teams) throw new Error(`Les totaux par catégorie de ${participant.name} diffèrent du classement.`);
  return { participantId: participant.id, name: participant.name, season, groups, total, sourceUrl: participant.sourceUrl };
}
export function parseDaily(html: string, now = new Date()): Daily {
  const $ = load(html);
  const date = clean(tableFor($, 'QUOTIDIEN').find('.ee2').text());
  // La page courante renvoie « TOTAL » : impossible d'affirmer quelle journée elle représente.
  if (!/^\d{1,2} [A-ZÀ-Ü]+ \d{4}$/.test(date)) throw new Error('Marqueur ne précise pas la date du tableau quotidien (libellé « TOTAL »). Résultats du jour non validés.');
  const [day, month, year] = date.split(' ');
  const months = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
  const index = months.indexOf(month);
  const parsed = new Date(Date.UTC(Number(year), index, Number(day)));
  if (index < 0 || parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== index || parsed.getUTCDate() !== Number(day)) throw new Error('Date quotidienne invalide.');
  const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (parsed.toISOString().slice(0, 10) !== today) throw new Error('Le tableau quotidien ne concerne pas la journée actuelle à Montréal.');
  return { date, participants: readParticipants($, 'QUOTIDIEN', 'stats_01.php'), sourceUrl: DAILY_URL };
}
