# Vocabulary topic drills: plan (bottom-up, schema to UI)

Status: plan only, nothing built. Written 2026-10-27. Tasks are on the board as stage V (V01 to V14).

## What was asked
Drills for the A1 topics in the owner's checklist (`checklist-A1-version-2.0 (1).doc`, from OnlineItalianClub): **colours, relatives and family, professions, school and studying, classroom, searching for a job, nationalities** (the checklist also lists workplaces and hobbies next to these). The checklist is a third-party document: it stays out of the repository (git-ignored) and we write our own word lists. Its links to free OnlineItalianClub lessons can be added as optional "see also" resources once checked.

## Fit with the method
Vocabulary and phrases are "chunks", which is on target. Rules are not. So each word comes with a short example line, and the drills ask for meaning and use, not for conjugation. Missed words go back into the flashcards (V13), and the conversation log stays the main place where you learn from real use.

## Layer 1: the content model (schema)
Today a `vocab` part holds items `{id, it, en, example?}`. A topic needs more, but only where the topic needs it:

| New optional item field | Used by | Example |
|---|---|---|
| `art` (il, lo, la, l', i, gli, le) | nouns, to teach the article with the word | `art: lo`, `it: studente` |
| `forms` ({m, f, mp, fp}) | professions, nationalities, colours that agree | `{m: cameriere, f: cameriera}` |
| `swatch` (a colour, #rrggbb) | colours: show the colour, name it | `#c0392b` |
| `group` (a short label) | sub-lists inside a topic | `family: close / extended / in-laws` |
| `accept` (list of extra accepted answers) | words with real variants | `avvocata` and `avvocatessa` |

Module level: a new optional `drills:` list in `module.yaml` says which exercise types make sense for that topic (`pick`, `type`, `listen`, `swatch`, `gender`). The lint checks that a drill type has the fields it needs (for example `gender` needs `forms`, `swatch` needs `swatch`) and that every `forms` entry is complete. Ids stay permanent, as everywhere else. One module per topic: `vocab-colours`, `vocab-family`, `vocab-professions`, `vocab-school`, `vocab-classroom`, `vocab-nationalities`, `vocab-job-search`.

Nothing changes in the database. Drill results already go to `italiano_drill_stats` keyed by a text kind (up to 60 characters), so `vocab-colours` and the others fit as they are.

## Layer 2: content (one small task per topic, each with a ledger)
Each topic is 12 to 30 words, every word checked against two sources (a dictionary such as Treccani, WordReference or Collins, plus a lesson page), recorded in `content/ledger/`. Points that need care:
- **Professions:** feminine forms differ (cameriere/cameriera, insegnante is the same for both, avvocato/avvocata/avvocatessa, medico/medica or la dottoressa). Only established forms go in `forms`; real variants go in `accept`, with a note.
- **Colours:** which ones agree (rosso/rossa/rossi/rosse) and which do not (rosa, viola, blu, beige).
- **Nationalities:** lower case as adjectives (italiano), capital for countries (Italia); -ese words are the same for both genders.
- **Family:** zio/zia, nipote (grandchild or nephew/niece), suocero/suocera, cognato/cognata, and the possessive-without-article rule only as a pointer to the grammar row, not drilled.
- **Searching for a job:** mostly phrases (Cerco lavoro, Ho esperienza come..., Mandare il curriculum), written by us and checked, with a note for the P01 native-speaker read.

## Layer 3: build
The app data build already copies module parts through, so the new fields reach `content.json`. New modules appear automatically in the Library, in search (as "Basics") and as flashcard decks, one deck per topic that you can switch off in Review. Decide whether a PDF "Topic vocabulary" bundle is wanted (V09).

## Layer 4: the drill engine (`lib/vocabdrills.js`, pure and tested)
Question generators that read a topic's items:
1. **Pick the meaning** (tap one of four): Italian to English and English to Italian. Wrong choices come from the same topic, never equal to the answer.
2. **Type it**: English to Italian; the article is optional, accents and case are forgiven.
3. **Listen**: hear the word, pick or type it (needs an Italian voice).
4. **Colour swatch**: see the colour, name it.
5. **Masculine or feminine**: give the other form (il cuoco, la ...), accepting listed variants.
Each question has the same shape the existing drills use (`prompt, answers, show, speak, kind`, plus `choices` and `swatch`), so the screen code is shared. Tests: every item can produce a question, distractors are unique and different from the answer, answers check correctly, all drill types listed in a module's `drills` work.

## Layer 5: the screen (phone first)
- **Menu:** the Drills screen groups into "Numbers and time" (today's drills) and "Vocabulary topics" (a grid of topic cards, each with your best score and a mode choice: pick, type, listen, mixed). One mixed round across all topics.
- **Question screen:** big tap buttons for the pick mode (the Tu or Lei drill already has this), a text box at 16 px for typing, a colour block for swatches, a Listen button, the answer plus the example line after each question.
- **After a round:** the words you missed, and a button to make them due in your flashcards today (V13).
- Mobile audit stays at zero problems; check on a real phone.

## Build order
One vertical slice first, then content-only additions: V01 schema, then **colours end to end** (V03, V10 to V12), because it uses the widest set of features (swatch, agreement). Then family, professions, school, classroom, nationalities, job search as content tasks; engine and screen need no change for them.

## Decisions for the owner
1. Scope of the first release: the seven topics above, plus workplaces with professions and hobbies later?
2. New words also become flashcards in Review (one deck per topic, switch off per deck)?
3. The five drill types above: all, or fewer?
4. Link the free OnlineItalianClub lessons for each topic as optional "see also" resources (after checking they are free; the site also sells courses, which we would mark ignore)?
5. A printable PDF of the topic words as well?

### Answers (2026-10-27)
1. Workplaces and hobbies later (V15); the first release is the seven topics. 2. Yes, new words become flashcards, one deck per topic. 3. Yes, all five drill types. 4. Yes, link the free OnlineItalianClub lessons as optional resources (V02). 5. Yes, a printable PDF (V16). The owner also asked whether to break the 200-phrase PDF down further; see the recommendation in the chat: keep it whole, add one topic-words PDF, and offer "print this topic" from the app instead of dozens of small files.
