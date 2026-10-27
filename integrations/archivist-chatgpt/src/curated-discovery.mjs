const normalize = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

const assistantComparisonPath = {
  id: 'compare-ai-assistants-for-practical-work',
  minimumVerifiedSources: 2,
  sources: [
    {
      id: 'framework-effective-task-cost',
      rationale: 'Start here to define a usable finish line and compare the full effort of producing a client-ready proposal, including correction time.',
      requiredHeadings: ['When Is It Actually Done?', 'What To Measure Instead'],
      requiredTerms: ['finished, usable result', 'human correction cost'],
    },
    {
      id: 'age-of-aimpires-entry-01',
      rationale: 'Read next for the practical explanation of how retries, repair work and human involvement can make a fast or cheap answer expensive.',
      requiredHeadings: ['When Cheap Creates More Repair Work', 'The Completion Boundary', 'What To Measure Instead'],
      requiredTerms: ['retries and corrections', 'human involvement'],
    },
    {
      id: 'framework-effective-task-cost-operators-deep-dive',
      rationale: 'Use the deep dive to turn the comparison into operational measures such as first-time success, human involvement and cost per completed job.',
      requiredHeadings: ['02. The Completion Boundary', '05. The Operational Metrics to Track', 'First-Time Success', 'Human Involvement', 'Cost Per Completed Job'],
      requiredTerms: ['first-time success', 'cost per completed job'],
    },
  ],
};

const beginnerAssistantChoicePath = {
  id: 'choose-a-first-ai-assistant',
  minimumVerifiedSources: 1,
  answerLead: 'To choose an assistant—not configure one—start here:',
  sources: [
    {
      id: 'framework-effective-task-cost',
      rationale: 'Use one real everyday task, decide what a useful finished result looks like, and compare how much checking and correction each assistant needs. This is a method for your own choice, not an independent ranking of commercial assistants.',
      requiredHeadings: ['Start With The Job, Not The Rate Card', 'When Is It Actually Done?', 'What To Measure Instead', 'Practical Checklist'],
      requiredTerms: ['before comparing two AI tools', 'human correction cost'],
    },
  ],
};

export const CURATED_PATHS = Object.freeze([assistantComparisonPath, beginnerAssistantChoicePath]);

function matchesAssistantComparison(question) {
  const readingIntent = /\bwhat\s+should\s+i\s+read(?:\s+first)?\b/i.test(question) ||
    /\bread(?:ing)?\s+recommendations?\b/i.test(question) ||
    /\brecommend(?:\s+up\s+to\s+(?:\w+|\d+))?(?:\s+\w+){0,4}\s+(?:published\s+)?(?:readings?|articles?|entries|frameworks?|guides?|sources?|material)\b/i.test(question) ||
    /\bwhere\s+should\s+i\s+start(?:\s+reading)?\b/i.test(question) ||
    /\bpublished\s+readings?\b/i.test(question);
  const comparisonIntent = /\b(?:compar(?:e|ing|ison)|evaluat(?:e|ing|ion)|test(?:ing)?|better|best|choose|choosing|select|decide|decision)\b/i.test(question);
  const assistants = /\b(?:AI\s+(?:assistants?|tools?|models?)|assistants?|ChatGPT|Gemini|Claude)\b/i.test(question);
  const practicalTask = /\b(?:client|proposal|writing|work|workflow|job|task|deliverable|project)\b/i.test(question);
  const criteria = [
    /\b(?:quality|final|finished|usable|accurate|accuracy|reliable|reliability)\b/i,
    /\b(?:correct(?:ing|ion|ions)?|fix(?:ing|es)?|edit(?:ing|s)?|revis(?:e|ing|ion|ions)|retr(?:y|ies)|repair(?:ing|s)?)\b/i,
    /\b(?:time|effort|human\s+involvement|back-and-forth)\b/i,
    /\bsav(?:e|es|ing)\s+(?:me\s+|us\s+|you\s+)?(?:time|work|effort)\b/i,
  ].filter(pattern => pattern.test(question)).length;
  return readingIntent && comparisonIntent && assistants && practicalTask && criteria >= 2;
}

function matchesBeginnerAssistantChoice(question) {
  const assistants = /\b(?:AI\s+assistants?|assistants?|ChatGPT|Gemini|Claude)\b/i.test(question);
  const noviceIntent = /\b(?:never|haven['’]?t|have\s+not)\s+(?:really\s+)?(?:used|tried)\s+(?:one|an?\s+(?:AI\s+)?assistant|ChatGPT|Gemini|Claude)\b/i.test(question) ||
    /\b(?:completely\s+new|new|a\s+beginner|complete\s+beginner|first[- ]time)\s+(?:to\s+|with\s+)?(?:using\s+)?AI\s+assistants?\b/i.test(question) ||
    /\b(?:never|haven['’]?t|have\s+not)\s+(?:really\s+)?(?:used|tried)\s+(?:generative\s+)?AI(?:\s+before)?\b/i.test(question) ||
    /\b(?:completely\s+new|new|unfamiliar)\s+(?:to|with)\s+(?:using\s+)?(?:generative\s+)?AI\b/i.test(question) ||
    /\b(?:my\s+)?first\s+AI\s+assistant\b/i.test(question) ||
    /\bfirst[- ]time\s+(?:AI\s+)?assistant\s+user\b/i.test(question) ||
    /\bAI\s+assistants?\s+(?:are|is)\s+new\s+to\s+me\b/i.test(question) ||
    /\b(?:just\s+)?getting\s+started\s+with\s+(?:using\s+)?AI\s+assistants?\b/i.test(question);
  const selectionIntent = /\bwhich\s+(?:AI\s+)?assistant\s+(?:is|would\s+be|might\s+be)\s+(?:right|best|suitable)\s+for\s+me\b/i.test(question) ||
    /\b(?:choose|choosing|pick|picking|select|selecting)\s+(?:an?\s+|which\s+|between\s+|among\s+)?(?:AI\s+)?assistants?\b/i.test(question) ||
    /\b(?:decide|deciding)(?:\s+on|\s+between)?\s+(?:an?\s+|which\s+)?(?:AI\s+)?assistants?\b/i.test(question) ||
    /\bfigure\s+out\s+which\s+(?:AI\s+)?assistant\b/i.test(question) ||
    /\b(?:AI\s+)?assistants?\b.{0,60}\b(?:which\s+one|right\s+for\s+me|(?:choose|choosing|pick|picking|select|selecting)\s+(?:one|between\s+them|among\s+them))\b/i.test(question) ||
    /\bwhich\s+(?:AI\s+)?assistant\s+should\s+i\s+(?:choose|try|use|start\s+with)\b/i.test(question) ||
    /\bwhich\s+one\s+(?:should\s+i|to)\s+(?:choose|try|use|start\s+with)\b/i.test(question) ||
    /\bhow\s+should\s+i\s+decide\s+what\s+to\s+try\b/i.test(question);
  return assistants && noviceIntent && selectionIntent;
}

export function findCuratedPath(question) {
  if (matchesAssistantComparison(question)) return assistantComparisonPath;
  if (matchesBeginnerAssistantChoice(question)) return beginnerAssistantChoicePath;
  return null;
}

function verifiedSource(item, result) {
  if (result?.status !== 'ok' || result.content_origin !== 'live_site' || result.source?.id !== item.id) return false;
  const headings = new Set((result.sections ?? []).map(section => normalize(section.heading)));
  if (!item.requiredHeadings.every(value => headings.has(normalize(value)))) return false;
  const text = normalize(result.text);
  return item.requiredTerms.every(value => text.includes(normalize(value)));
}

export async function discoverCuratedReading(question, fetchById, limitation) {
  const path = findCuratedPath(question);
  if (!path) return null;
  const attempts = await Promise.allSettled(path.sources.map(item => fetchById(item.id)));
  const verified = [];
  attempts.forEach((attempt, index) => {
    const item = path.sources[index];
    if (attempt.status === 'fulfilled' && verifiedSource(item, attempt.value)) {
      verified.push({ source: attempt.value.source, rationale: item.rationale });
    }
  });
  if (verified.length < path.minimumVerifiedSources) {
    return { status: 'no_supported_sources', content_origin: 'live_site', selection_origin: 'curated', answer: limitation, sources: [] };
  }
  const answer = (path.answerLead ?? 'Read these first:') + '\n' + verified.map(({ source, rationale }, index) =>
    `${index + 1}. ${source.title} — ${rationale}`).join('\n');
  return {
    status: 'grounded', content_origin: 'live_site', selection_origin: 'curated', answer,
    sources: verified.map(item => item.source),
  };
}
