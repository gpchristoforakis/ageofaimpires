# Task framework decisions and implementation

Updated: 9 October 2026. Source chat: `01a11209-7190-76a3-9b33-1a58dc66d012`.

## Approved structure

- One permanent task reference in Frameworks, with contextual snippets and links
  reused where relevant. Keep the reference practical, not encyclopaedic.
- Task families: Understand, Find, Transform, Create, Evaluate and Plan, Act.
  Families are kinds of work, not a hierarchy of intelligence. A larger job can
  contain several families.
- Conditions: information source/access, completion test, complexity and
  consequences. Record language/domain when relevant.
- Performance: capability, quality, reliability, active human effort,
  elapsed speed and scope discipline. Define a usable result before testing.
- The recurring scenario is a fictional meeting converted into three assigned
  actions: Mary / revised budget / Thursday; Tom / supplier availability /
  Friday; Gloria / launch checklist / Monday. The FAQ suggestion is unassigned
  and excluded. The same source and expected table appear in the reference and
  comparison guide; the calculator uses the same scenario for its explanations.
- One scenario teaches the framework. Several representative examples and
  fresh attempts test an assistant. Never turn one success into a reliability
  claim or an overall best-assistant score.
- Reader journey: understand the job, define usable, compare performance,
  measure effort, decide whether the assistant suits that job.

## Calculator history and rules

- The original was recovered from the other checkout:
  `C:\Users\plasm\projects\ageofaimpires\reference\openai-sites-export\index.html`.
- The recovered standalone article remains at
  `C:\Users\plasm\.codex\visualizations\2026\10\06\01a11209-7190-76a3-9b33-1a58dc66d012\effective-task-cost-calculator-original.html`.
  It was recalibrated on 6 October; the historical filename is not a claim
  that it still has the original four-input behavior.
- Three inputs: “Hourly Time Value”, “How Long To Reach A Usable
  Result?”, “Time Spent Going Further”. Four outputs: cost of a
  usable result, cost of going further, total time, total value of time.
- Defaults: €75/hour, 20 minutes and 35 minutes; outputs €25.00, €43.75,
  55 minutes and €68.75. Each cost is minutes × hourly rate ÷ 60.
- Preserve the note above results: “Costs are based on the value of time.
  AI usage fees are not included.” Keep the subscription tip too.
- Count active human effort; distinguish elapsed waiting. Exploration is part
  of completion when exploration was the requested job. Failures consume time
  but must be recorded as failed attempts, not cheap completed jobs.
- The calculator is the time-cost component. Quality, reliability, useful
  discoveries, software charges and total task value are separate judgements.

## Implemented locally

- `framework-ai-tasks.html`: the main reference, six families, conditions,
  finish line, matched meeting example, measures and three expandable checks.
- `compare-assistants-on-one-task.html`: a How-To guide with a copyable prompt,
  expected table, comparison record and reliability check. It uses the existing
  How-To progress key with `guide-16` and respects manual read/unread choices.
- `time-cost-calculator.html`: the integrated calculator with the shared theme,
  navigation, social icons and explanatory links.
- Contextual additions in Entries 01–03 and the Effective Task Cost Framework;
  index links in Frameworks and How-To; all three routes in the sitemap.
- Existing copy, routes, inline styles/scripts, hosting files and shared theme
  assets are preserved. No homepage change or renumbering of old frameworks.

## Verification and release state

- Required `node scripts/check-site-chrome.cjs`: passes on 21 pages.
- `node scripts/check-task-framework.cjs`: checks nine connected pages, local
  assets/links/anchors, metadata, sitemap, scenario fidelity and calculator
  edge cases. Live checks cover updates, fractions, invalid input, copying,
  guide progress, manual unread protection, quick checks and mobile menus.
- Browser checks cover the nine changed pages at 390px and 1440px in both
  themes: no horizontal overflow, sticky headers, visible theme controls and
  all three social icons. The previous lack of browser QA for the archived
  file is resolved for the new integrated site pages, not retroactively for
  the archived artifact.
- Verified 329 original paragraphs/headings and original inline styles/scripts
  remain intact across the six edited existing pages.
- Implementation was authorised on 9 October. Commit, push and publication
  remain pending separate user authorisation; production was not checked or
  changed in this work.
- Future articles can reuse the recurring scenario and contextual snippets.
  Additional benchmarks, live assistant rankings, automatic timers and a
  combined scoring system are not part of the approved implementation.

## Editorial revision — 9 October 2026

- Use neutral editorial language in the task framework, comparison guide,
  calculator and related new snippets: no first- or second-person pronouns.
- Headings, metadata, calculator labels, explanations, calls to action and
  fictional meeting notes follow the same rule. Imperative instructions remain
  where they make the guide practical.
- Revised labels and clarification wording supersede the earlier direct
  address; time-only scope, fee exclusion and calculations are unchanged.

## Names in fictional examples

- Canonical editorial guide updated in place: [00_Editorial_Voice_and_Style_Guide](https://docs.google.com/document/d/1yUtjWNWmGyB_dRfiFGmSkYz6NbOLlxH0LyfZ7tPqrHM/edit),
  section 5, "Names in examples". Connector readback verified the rule and
  preservation of the existing text and tab.
- Use widely recognised names with a clear conventional male or female
  association, such as Mary, Tom, Peter and Gloria. Avoid unisex or
  gender-ambiguous names such as Taylor.
- Use each name consistently across source material, prompts, expected outputs
  and tests. This is a rule for fictional examples, not a claim about real people.

## Callout typography and opening copy

- The global callout rule is also in the Google editorial guide, section 12,
  "Notes, warnings and editorial callouts". Connector readback confirmed the
  insertion and preserved all existing guide text and its tab.
- Editorial notes, warnings and callouts use the existing ink colour and
  semibold Arial/Helvetica type. The border alone is not the distinguishing
  treatment. Existing formulas, emphasis, spacing and palette are preserved.
- Shared styles cover editorial note/callout variants across the site; Notebook
  entries retain their long-form typography. Shared CSS versions are refreshed
  in every consuming page.
- The opening compares suggesting a caption with compiling an annual report.
  The repetitive paragraph before the three comparison questions is removed.

## Scenario explanation and title capitalisation

- Replace the compact classification paragraph with two explanatory blocks:
  "Task Family: Transform" and "Working Conditions". Only "Task Family:"
  is bold; "Transform" uses normal weight. The finish line remains below.
- Public titles and headings capitalise every word, including articles and
  prepositions. Card titles, table captions and table headings follow the same
  rule. Body copy and complete quiz questions retain sentence case.
- Site-wide heading capitalisation is normalised without rewriting the copy.
## Integration note — 27 October 2026

Recovered historical implementation brought onto the latest site branch; public navigation uses the later `Guides` label. The comparison guide retains `guide-16` and the existing localStorage progress key. Publication is deliberately deferred until review.
