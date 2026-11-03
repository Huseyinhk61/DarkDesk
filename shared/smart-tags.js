const seeds = {
  internet: 'browser web internet communication chat email meeting',
  internetbrowsers: 'browser chrome edge firefox web surfing',
  internetchat: 'chat communication message email discord telegram whatsapp',
  internetmeetings: 'meeting conference call zoom teams webinar',
  learning: 'education learning reading lesson study knowledge',
  learningcourses: 'lesson course lecture education learning flashcards mathematics',
  learningreading: 'book ebook reference research bibliography reading library',
  finance: 'finance budget invoice accounting expense income money',
  financeaccounting: 'accounting budget bookkeeping invoice expense income finance',

  software: 'code development programming source javascript python compiler coding',
  design: 'design creative drawing illustration photo texture typography visual render',
  games: 'gaming game play steam multiplayer',
  office: 'document report invoice budget contract spreadsheet presentation',
  system: 'utility tool system configuration backup security',
  media: 'audio music podcast recording sound mixing video cinema',
  softwareide: 'editor ide coding programming workspace',
  softwaredatabase: 'database sql data query migration cluster schema tables',
  softwaredevops: 'docker devops container kubernetes deploy pipeline infrastructure',
  softwareterminal: 'terminal shell console ssh command',
  systemdrivers: 'driver hardware device gpu printer',
  systemnetwork: 'network security firewall vpn connection router internet',
  systemcompression: 'archive compress zip rar unpack extract',
  systeminstallers: 'setup installer install update package download',
  archive: 'old unused historical archived',
};
export function tokens(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (t) =>
        t.length > 2 &&
        ![
          'exe',
          'lnk',
          'url',
          'desktop',
          'users',
          'program',
          'files',
          'windows',
          'app',
          'bin',
        ].includes(t),
    );
}
export function suggestTags(item, settings) {
  if (settings.smartTagging === false) return null;
  const query = new Set(tokens(item.name));
  if (!query.size) return null;
  const documents = settings.categories.map((c) => ({
    id: c.id,
    terms: new Set(tokens((seeds[c.id] || '') + ' ' + c.name)),
  }));
  const scores = documents
    .map((doc) => {
      let score = 0,
        hits = [];
      for (const term of query) {
        if (doc.terms.has(term)) {
          const frequency = documents.filter((d) => d.terms.has(term)).length;
          score += Math.log(1 + documents.length / frequency);
          hits.push(term);
        }
      }
      return { ...doc, score: score / Math.sqrt(Math.max(1, doc.terms.size) * query.size), hits };
    })
    .sort((a, b) => b.score - a.score);
  const best = scores[0];
  if (!best?.score || best.score < 0.08) return null;
  const margin = best.score - (scores[1]?.score || 0);
  return {
    categoryId: best.id,
    score: Math.min(1, best.score),
    confidence: best.hits.length >= 2 && margin > 0.12 ? 'high' : margin > 0.06 ? 'medium' : 'low',
    tags: best.hits.slice(0, 4),
    method: 'local-keyword-vector',
  };
}
