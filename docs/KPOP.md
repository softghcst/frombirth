# K-pop Idol Life

From an audition anywhere in the world to a debut, a group's whole career, and the family record after.
Engine: `js/engine/kpop.js`. Data: `js/data/kpop.js`. Screen: `js/ui/kpop.js` (**My Idol Life**, from the Work tab's
*K-pop Idol* button, or My Fame → Music → *Idol opportunities*). Tests: `node tests/kpop.mjs`.

Everything named in the game is fictional: agencies, labels, shows, programs, groups, songs and fandoms. The structure
follows the real industry in broad outline only (agencies with trainee programs; online and in-person auditions; years
of training with no promise of debut; survival programs; weekly music shows that each score releases their own way;
exclusive contracts). No term in the game is a statement about any real company. References used for the outline:
Korea.net's K-InfoHub on the trainee system, JYP's and HYBE × Geffen's public audition pages, HYBE's business page on its
multi-label structure, Netflix's *Pop Star Academy* coverage, and the Library of Congress K-pop timeline.

## How a career goes

1. **Auditions** (`auditions`, `apply`, `attendCallback`). Each agency puts out its own call every year: online, in person
   or a global casting, with its own ages, line-up (girl, boy or any), places (worldwide or in its own country),
   categories, a few places and what it needs. Stages: application → callback → live assessment → the company's decision
   (rejected, kept on file, or offered a place). Passing is never automatic: in the tests, strong applicants are offered a
   place about two times in three. Three applications a year; one per audition. A file kept "on hold" sometimes leads to
   an offer the next year.
2. **The trainee agreement** (`acceptOffer`). Its own kind of contract: a review after one to three years, training costs
   covered by the company (no debt), an allowance at some agencies, a dorm or home, rules, and leaving by notice with
   nothing charged back. Under-18s need their family's agreement (`askGuardian`). Training abroad comes with a
   sponsored trainee visa, refused with a criminal record. The trainee lives in the agency's city; their legal country of
   residence is unchanged.
3. **Training** (`setFocus`, `trainAction`). A yearly focus (vocals, dance, rap, stage and camera, Korean, media training,
   or a bit of everything) builds the game's own skills: singing and dance talents, the rapping, public speaking and
   Korean skills (Pursuits). Stage presence and camera are trained here. Extra sessions, a word with the coach, time
   with fellow trainees, who are real, persistent people with their own skills and ranks.
4. **Evaluations**. One consolidated report a year: scores, a rank among the agency's trainees, two lines of feedback,
   named evaluators, and an outcome (from *considered for debut* to *at risk*). Two difficult evaluations in a row before
   a review, and the agreement is not renewed; never at random.
5. **Debut projects**. Every few years an agency picks a line-up from its actual trainees (the best voice, the best
   dancer, then readiness). If the player is in it, they choose (`acceptDebut`/`declineDebut`); an unanswered place
   lapses after a year. Plenty of trainees never debut.
6. **Survival programs** (optional; from 2009). Fictional formats (*Project Stardust: Global Debut Academy*, *Rising
   Nine*, *Blueprint: The Final Cut*), each with its rules fixed before the first episode: contestant count, debut
   places, judges' weight against fans'. Five missions (dance, vocal, group, concept, final), the player choosing an
   approach for each; cuts after set missions; the final line-up debuts. Results are stored, never rerolled; the
   eliminated stay in the world.
7. **The group**. Made of the actual chosen trainees, with an exclusive artist agreement for each (the agency's term,
   share and solo rule). Positions, concept, fandom, releases, stages, wins, tours, awards, history.
8. **Debut and comebacks** (`debut`, `comeback`). Releases with songs and line distribution; reception from fans,
   quality and the agency's promotion. Not every release is a hit.
9. **Music shows**. Four fictional weekly shows, each weighing digital sales, album sales, broadcast, social and votes
   differently. A win is earned against the actual competing releases of that week; a first win usually takes years.
10. **Ending fairies**. At each stage a member gets the last close-up, from the camera director's rotation: never
    automatically the center or the main vocalist. When it is the player, they choose a style (cute, confident,
    elegant, funny, natural); the result depends on camera presence, stage, the style's fit with the concept,
    experience and chance. A good one is a fan moment: a little individual recognition, nothing more. All archived.
11. **Fandom and public life**. Size, core, engagement, regions, a name (chosen if the agency lets the members
    choose); the player's own following. Interviews, variety, radio, fan meetings, fansigns, fan calls (from 2020),
    livestreams (from 2015): media training matters, and the leader is a natural spokesperson but not the only one.
12. **Welfare and hiatus**. Agencies differ in how hard they push (`welfare`). Asking for rest is never held against
    anyone; a hiatus (rest, health, personal) keeps the member in the group, with the reason given only broadly. Korean
    men serve in the military in their late twenties: a two-year hiatus, not an ending.
13. **Money**. Each year a group's revenue is settled against its costs; costs not yet recouped carry over; the
    members' share is split between them. The player's share and any trainee allowance are payroll lines, paid once.
14. **Solo work, renewal, disbandment, reunion**. Solo releases if the contract allows and there is demand: the member
    stays in the group. At the end of the contract, each member decides; the group goes on with whoever stays, or
    disbands, and is kept whole on the record. Years later, a reunion with whoever is willing.
15. **Generations**. The industry carries into the heir's life; the ancestor stays in the line-ups, credits and
    archives; the family record lists their groups.

## Positions

`assignPositions` gives each member **one primary position and at most one secondary**, never contradictory
(`validLabels`): one rank per specialty (no Main + Lead Vocalist), Visual and Center not together, two labels at most.
The **maknae** is derived from birth dates (the youngest current member; ties broken consistently) and counts toward
the limit; it is worked out again when the line-up changes. The **leader** is chosen on media training, the members'
trust and reliability, not age, and counts toward the limit; some groups have none. Main vocalists, dancers and rappers
need the skill; two mains are allowed when the line-up really has two. **All-Rounder** needs strong vocals *and* dance
*and* rap or stage presence. Some groups have no official positions at all. Skills are never changed to fit a title,
and every change of positions is kept in the group's position history.

## Eras

The modern idol system from 1996; online auditions from 2005; global casting from 2010; survival programs from 2009;
global groups from joint labels from 2020; fan platforms from 2015; fan calls from 2020. Agencies open in their own
founding years.

## Not built

- Subunits; Japanese releases; idol acting and hosting as their own routes (the acting and press systems still apply).
- Dating rules in contracts and dating rumors specific to idols.
- Merchandise, lightsticks and fan clubs as products.
- A separate story-arc engine: the arcs happen through the systems above, the career history and life milestones.
- Health records for idol hiatuses (health and mood improve; no medical condition is recorded).
- Moving the player's legal residence to Korea: trainees live in the agency's city on a sponsored visa recorded in the
  idol record.
