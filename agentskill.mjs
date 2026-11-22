// Lädt die Arbeitsmethode für den Coding-Agenten (Skill „implementation“) und gibt sie an den Planer weiter.
// Nur für Node: skills.mjs liest Dateien. planner.mjs selbst bleibt frei davon, weil es auch im Browser läuft.
import { skillsFor } from './skills.mjs';
import { setAgentSkill } from './planner.mjs';

export const agentSkill = skillsFor('implement').map(({ name, content }) => '### Skill: ' + name + '\n' + content).join('\n\n');
setAgentSkill(agentSkill);
