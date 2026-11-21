import { readFile } from 'node:fs/promises';

export const skillStages = Object.freeze({
  questions: Object.freeze(['discovery', 'traceability']),
  decisions: Object.freeze(['discovery', 'traceability']),
  triage: Object.freeze(['discovery', 'traceability']),
  revise: Object.freeze(['specification', 'traceability']),
  final: Object.freeze(['specification', 'traceability']),
  adjust: Object.freeze(['specification', 'traceability']),
  scope: Object.freeze(['specification', 'traceability']),
  features: Object.freeze(['traceability']),
  plan: Object.freeze(['execution', 'traceability', 'reuse-discovery']),
  reuse: Object.freeze(['reuse-discovery', 'traceability']),
});

// Static allow-list: project input cannot select paths or inject additional skills.
const skillNames = [...new Set(Object.values(skillStages).flat())];
const skillFiles = new Map(await Promise.all(skillNames.map(async name => {
  const source = await readFile(new URL('./skills/' + name + '/SKILL.md', import.meta.url), 'utf8');
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/.exec(source);
  if (!match) throw Error('Ungültiges Skill-Frontmatter: ' + name);
  const declared = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  if (declared !== name || !match[2].trim()) throw Error('Ungültiger Skill: ' + name);
  return [name, match[2].trim()];
})));

export function skillsFor(mode) {
  if (!Object.hasOwn(skillStages, mode)) throw Error('Unbekannte Skill-Phase.');
  return skillStages[mode].map(name => ({ name, content: skillFiles.get(name) }));
}

export function withSkills(mode, instruction) {
  if (typeof instruction !== 'string' || !instruction.trim()) throw Error('Leere KI-Anweisung.');
  const selected = skillsFor(mode);
  return [
    instruction.trim(),
    '',
    'Verbindliche Skill-Richtlinien für diese Phase. Sie ergänzen das Ausgabeformat; bei Konflikten haben die JSON-Schemas und die expliziten Nutzerentscheidungen Vorrang.',
    ...selected.map(({name,content}) => '\n### Skill: ' + name + '\n' + content),
  ].join('\n');
}
