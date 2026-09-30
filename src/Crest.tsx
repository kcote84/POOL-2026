export const houses: Record<string, { color: string; motto: string; symbol: number }> = {
  'Sir Jorah': { color: '#bba16c', motto: 'L’honneur pour étendard', symbol: 0 },
  'Podrick Payne': { color: '#a7bbc5', motto: 'La loyauté pour armure', symbol: 1 },
  'Sandor Cleagan': { color: '#bda382', motto: 'La force sans détour', symbol: 2 },
  'Lord Baelish': { color: '#8eada0', motto: 'Chaque point, une manœuvre', symbol: 3 },
  'Ned Stark': { color: '#a8b7c4', motto: 'Le Nord se souvient', symbol: 4 },
  'Greyworm': { color: '#c18575', motto: 'Unis, jamais brisés', symbol: 5 },
  'Bronn': { color: '#b7ad7c', motto: 'L’acier paie toujours', symbol: 6 },
};
const symbols = [
  <g key="0"><path d="m29 37 5-12 5 8 5-15 5 15 5-8 5 12-8 6v11H37V43Z"/><path d="M32 61h24M36 67h16"/></g>,
  <g key="1"><path d="M32 58V30h7v6h10v-6h7v28ZM38 58V46q6-9 12 0v12M28 63h32M31 69h26"/></g>,
  <g key="2"><path d="m28 37 8-11 8 7 8-7 8 11-4 21-12 10-12-10ZM36 44l4 3m12-3-4 3m-9 8 5 5 5-5M44 60v6"/></g>,
  <g key="3"><path d="M27 51q6-17 18-14l8-11 6 5-4 6 10 5-14 2q-3 14-20 19l5-12ZM33 46l12 4m1 9 3 8m-9-6 2 6"/><circle cx="54" cy="32" r="1"/></g>,
  <g key="4"><path d="m44 22 5 17 17 5-17 5-5 19-5-19-17-5 17-5Z"/><path d="m44 33 3 11-3 12-3-12ZM27 27l5 5m24 24 5 5m0-34-5 5M32 56l-5 5"/></g>,
  <g key="5"><path d="M44 69V29m0-8-7 13 7-4 7 4ZM31 60V38m0-9-6 13 6-4 6 4Zm26 0-6 13 6-4 6 4v18M29 64h30"/></g>,
  <g key="6"><path d="m27 27 30 30m-2-29L30 58m-3-34 6 3-3 6-6-6ZM51 24l7 3 3 7-7-4ZM24 55l9 9m-9-1 7-7m21-1 11 10m-3-2-4-7"/></g>,
];
export function Crest({ name, large = false }: { name: string; large?: boolean }) {
  const house = houses[name] ?? houses.Bronn;
  return <svg className={`crest ${large ? 'crest-large' : ''}`} viewBox="0 0 88 104" aria-hidden="true" style={{ color: house.color }}>
    <path d="M10 9 44 3l34 6v48c0 21-17 33-34 43C27 90 10 78 10 57Z" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeOpacity=".7" />
    <path d="M15 14 44 9l29 5v42c0 17-13 29-29 38-16-9-29-21-29-38Z" fill="none" stroke="currentColor" strokeOpacity=".22"/>
    <path d="M44 10v83M16 20l56 61M72 20 16 81" stroke="currentColor" strokeOpacity=".055"/>
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{symbols[house.symbol]}</g>
    <path d="m40 78 4-4 4 4-4 4Z" fill="currentColor" fillOpacity=".5"/>
  </svg>;
}
