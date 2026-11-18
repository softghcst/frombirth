// Master schemas for Pathways. Types only; this module exports nothing at runtime.

/**
 * @typedef {{mood:number, health:number, intellect:number, charm:number}} CoreStats  0–100
 * @typedef {{karma:number, discipline:number, willpower:number, fertility:number,
 *            fame:number, crazy:number}} HiddenStats  0–100
 * @typedef {{music:number, sports:number, acting:number, crime:number, singing:number, dance:number}} Talents  0–100
 *
 * @typedef {Object} Character
 * @property {string} id
 * @property {string} firstName
 * @property {string} lastName
 * @property {'male'|'female'|'nonbinary'} gender
 * @property {number} age
 * @property {number} birthYear
 * @property {string} countryId
 * @property {string} city
 * @property {string} birthCountryId
 * @property {CoreStats} stats
 * @property {HiddenStats} hidden
 * @property {Talents} talents
 * @property {string[]} traits  heritable trait ids
 * @property {Object<string,'mother'|'father'|'self'>} traitSources
 * @property {string[]} birth  birth condition ids
 * @property {HealthCondition[]} conditions
 * @property {Appearance} appearance  see js/avatar/catalog.js: { v:2, inherited:{...}, style:{...} }
 * @property {Education} education
 * @property {CareerState} career
 * @property {Finance} finance
 * @property {Asset[]} assets
 * @property {?string} homeId  the property the player lives in, if they own it
 * @property {InventoryItem[]} inventory
 * @property {string[]} npcIds
 * @property {LegalState} legal
 * @property {SocialMedia} social
 * @property {Object<string, boolean|number|string>} flags
 * @property {Milestone[]} milestones
 * @property {LifeCounters} counters
 * @property {boolean} alive
 * @property {number} generation
 *
 * @typedef {{id:string, name:string, severity:number, chronic:boolean, sinceAge:number, treated:boolean}} HealthCondition
 * @typedef {{id:string, name:string, kind:string, value:number}} InventoryItem
 * @typedef {{age:number, text:string, kind:string}} Milestone
 * @typedef {{crimes:number, kills:number, donated:number, gambled:number, yearsJailed:number,
 *            escapes:number, livesSaved:number, spouses:number, jobsHeld:number,
 *            countriesLived:number}} LifeCounters
 *
 * @typedef {Object} NPC
 * @property {string} id
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} gender
 * @property {number} age
 * @property {boolean} alive
 * @property {'parent'|'grandparent'|'grandchild'|'greatgrandchild'|'niece'|'relative'|'inlaw'|'mentor'|'sibling'|'classmate'|'coworker'|'friend'|'enemy'|'partner'|'spouse'
 *            |'ex'|'child'|'pet'|'boss'|'cellmate'} role
 * @property {{relationship:number, money:number, crazy:number, intellect:number,
 *             charm:number, health:number, generosity:number}} meters
 * @property {Appearance} [appearance]
 * @property {string[]} [traits]
 * @property {number} [strictness]
 * @property {number} [income]  parents: yearly, local currency
 * @property {number} [savings]  parents: local currency
 * @property {string} [occupation]
 * @property {number} [wealth]
 * @property {string} [species]
 * @property {number} [lifespan]
 * @property {boolean} [prenup]
 * @property {number} [marriedAtAge]
 * @property {string[]} [parentIds]
 * @property {boolean} [adopted]
 * @property {CoreStats} [stats]
 * @property {Talents} [talents]
 * @property {{key:string, text:string, age:number}[]} [memories]  what they remember about the player
 * @property {NpcLife} [life]  their own schooling, work, money, family and ambition (engine/npcLives.js)
 * @property {number} lastInteractionAge
 * @property {Object<string, any>} flags
 *
 * @typedef {Object} NpcLife
 * @property {{stage:string, gpa:number, majorId:?string, trade:?string, degrees:string[], yearsLeft:number}} edu
 * @property {?{careerId:string, level:number, title:string, salary:number, years:number}} job
 * @property {number} savings  local currency; can go negative
 * @property {number} [pension]
 * @property {?{id:string, text:string, progress:number, achieved:boolean, boost?:number}} aspiration
 * @property {?string} partnerId  the 'inlaw' NPC they are with
 * @property {number} together  years with that partner
 * @property {boolean} married
 * @property {number} kids
 * @property {?string} [hobby]
 * @property {{age:number, year:number, text:string}[]} history  their timeline
 *
 * @typedef {Object} Asset
 * @property {string} id
 * @property {'property'|'vehicle'|'security'|'item'} kind
 * @property {string} catalogId
 * @property {string} name
 * @property {number} purchasePrice
 * @property {number} value
 * @property {number} boughtAtAge
 * @property {number} [condition]
 * @property {{principal:number, rate:number, yearsLeft:number, payment:number}} [mortgage]
 * @property {{rent:number, quality:number, sinceAge:number}} [tenant]
 * @property {number} [upkeep]
 * @property {number} [units]
 * @property {number} [costBasis]
 * @property {'car'|'bike'|'boat'|'plane'} [vehicleClass]
 * @property {number} [age]  vehicles: years old
 * @property {number} [quality]  property: how it compares with others of its type
 *
 * @typedef {Object} Finance
 * @property {number} cash
 * @property {Loan[]} loans
 * @property {number} pension
 * @property {number} lifetimeEarned
 * @property {number} lifetimeTaxPaid
 * @property {Object<string, number>} [accounts]  money held in other currencies, whole units by currency code (engine/currency.js)
 * @property {SavingsGoal[]} [goals]  engine/banking.js
 * @property {{limits:Object<string, number>}} [budget]  the most the player means to spend a year, by category
 * @property {{marks:{year:number, age:number, kind:string}[], onTime:number, since:?number}} [credit]  what lenders remember (engine/credit.js)
 * @property {object[]} [cards]  credit cards (engine/cards.js)
 * @property {object[]} [policies]  insurance policies, and [losses] that can be claimed for (engine/insurance.js)
 * @property {{accountId:string, rate:number}} [plan]  the pension plan (engine/retirement.js)
 * @property {object[]} [lent]  money lent to people the player knows (engine/family.js)
 * @typedef {{id:string, kind:string, name:string, target:number, cur:string, accountId:string, deadlineAge:?number,
 *            status:'active'|'paused'|'completed'|'abandoned', createdYear:number, createdAge:number, doneYear?:number, doneAge?:number}} SavingsGoal  target is in minor units
 *
 * The ledger (state.ledger, engine/ledger.js). Amounts are whole numbers of the currency's smallest unit.
 * @typedef {{v:number, seq:number, home:string, accounts:Object<string, LedgerAccount>, tx:LedgerTx[], keys:Object<string, number>,
 *            years:Object<number, Object<string, Object<string, [number, number]>>>, closedThrough:?number}} Ledger
 * @typedef {{id:string, kind:'wallet'|'bank'|'debt'|'nominal'|'clearing', cur:string, bal:number, name?:string, cat?:string,
 *            bankId?:string, product?:string, rateBp?:number, owners?:{id:string, role:'owner'|'custodian'}[], opened?:number, closed?:number, matures?:number}} LedgerAccount
 * @typedef {{id:string, year:number, age:number, cat:string, desc:string, src:string, status:'posted', key?:string, entries:[string, number][]}} LedgerTx
 * @typedef {{id:string, kind:'student'|'bank'|'personal', principal:number, rate:number, yearsLeft:number}} Loan
 *
 * @typedef {Object} Career  catalog entry (data/careers.js, Phase 4)
 * @property {string} id
 * @property {string} title
 * @property {string} field
 * @property {'fulltime'|'parttime'|'freelance'|'military'} type
 * @property {CareerLevel[]} ladder
 * @property {Requirement[]} requirements
 * @property {string} [fameTrack]
 * @property {number} stress
 * @property {number} [retireAge]
 * @typedef {{title:string, salary:[number,number], yearsToPromote:number, minPerformance:number}} CareerLevel
 *
 * @typedef {Object} CareerState
 * @property {?string} careerId
 * @property {?string} title
 * @property {number} level
 * @property {number} salary
 * @property {number} performance
 * @property {number} [totalYears]  years worked across all jobs, for the pension
 * @property {?string} [lastField]
 * @property {number} yearsInRole
 * @property {number} yearsInField
 * @property {string[]} coworkerIds
 * @property {?string} bossId
 * @property {?{jobId:string, title:string, salary:number, since:number}} partTime
 * @property {{careerId:string, title:string, from:number, to:number, exit:string}[]} history
 * @property {boolean} retired
 * @property {number} pensionPerYear
 * @property {?{rank:number, branch:string, deployments:number}} military
 *
 * @typedef {Object} Education
 * @property {'none'|'elementary'|'middle'|'high'|'university'|'graduate'|'medical'|'law'|'cosmetology'|'community'|'apprenticeship'} stage
 * @property {boolean} enrolled
 * @property {number} yearInStage
 * @property {number} gpa
 * @property {number} effort
 * @property {number} absences
 * @property {?string} clique
 * @property {string[]} clubs
 * @property {?string} majorId
 * @property {'scholarship'|'parents'|'loan'|'self'|'public'|null} funding
 * @property {{type:string, majorId?:string, gpa:number, age:number}[]} degrees
 * @property {'home'|'dorm'|'apartment'} housing  while in higher education
 * @property {?string} [priority]  what a school student puts first this year
 * @property {?string} [schoolId]  kind of university attended
 * @property {?string} [schoolName]
 * @property {number} [tuitionMult]
 * @property {?string} [roommateId]
 * @property {boolean} [housingAid]  scholarship covers the dorm
 * @property {boolean} expelled
 * @property {boolean} droppedOut
 *
 * @typedef {Object} LegalState
 * @property {{caseId:string, crimeId:string, offense?:string, age:number, year?:number, convicted:boolean, outcome:string, sentenceYears:number,
 *             sentenceType?:string, juvenile:boolean, sealed?:boolean, exonerated?:boolean, pardoned?:boolean, legacy?:boolean}[]} record
 *           one entry per case: its outcome. The case itself is in state.justice (engine/cases.js)
 * @property {{year:number, age:number, kind:string, text:string, caseId:?string}[]} [history]  every legal event, in order
 * @property {string[]} [counselIds]  lawyers who have acted for the player
 * @property {?{kind:string, sentenceId:string, caseId:string, from:number, until:number, conditions:string[]}} [supervision]  probation, parole and the like
 * @property {{id:string, facilityId:string, from:number, to:number, served:number, how:string}[]} [custodyHistory]
 * @property {?{facility:'juvenile'|'prison', security:'min'|'med'|'max', yearsLeft:number,
 *              respect:number, gangId:?string, escapeAttempts:number}} incarceration
 * @property {number} heat
 * @property {{crimeId:string, age:number, victim?:string}[]} [unsolved]  older saves only: becomes investigations on load
 * @property {?{caseId:string}} [pending]  the open criminal case (older saves held {crimeId, evidence, lawyer} until upgraded)
 *
 * @typedef {{handle:?string, followers:number, posts:number, viral:number, boughtFollowers:number}} SocialMedia
 *
 * @typedef {Object} GameEvent
 * @property {string} id
 * @property {string} category
 * @property {string} text  supports {tokens}: {name} {city} {$50} and cast keys
 * @property {[number,number]} ageRange
 * @property {number} [weight]
 * @property {Object<string,string>} [cast]  token key -> role spec; event needs each to exist
 * @property {Requirement[]} [requires]
 * @property {Requirement[]} [castRequires]  conditions on the people cast, e.g. cast.kid.age >= 14
 * @property {boolean} [priority]  story beat: always fires when first eligible
 * @property {string} [exclusive]  only one event per group fires in a year
 * @property {boolean} [prison]  fires only while the player is locked up
 * @property {boolean} [queuedOnly]  reached only through a `queue` effect
 * @property {boolean} [once]
 * @property {number} [cooldown]  years before it can repeat (default 10)
 * @property {EventChoice[]} choices
 * @typedef {{label:string, requires?:Requirement[], check?:SkillCheck, outcomes:Outcome[]}} EventChoice
 * @typedef {{base:number, factors:Object<string,number>}} SkillCheck  path -> weight
 * @typedef {{on:'success'|'fail'|'always', weight?:number, text:string, effects:Effect[], requires?:Requirement[]}} Outcome
 * @typedef {{path:string, op:'>='|'<='|'=='|'!='|'in'|'has'|'lacks', value:any}} Requirement
 * @typedef {{type:'stat'|'hidden'|'talent'|'cash'|'relationship'|'flag'|'addNpc'|'removeNpc'
 *            |'condition'|'cure'|'gpa'|'legal'|'death'|'milestone'|'counter'|'followers'|'memory'|'queue'|'partTimeScale'|'tag'|'feud'|'perf'|'pay'|'fired'|'promoted'|'npcSet'|'moveCity'|'property'|'vehicle'|'sellInvestments'|'prison'|'giveVehicle'|'npcTransition'|'animalHealth'|'animal'|'animalLife'|'animalArc'|'sportArc'|'disaster',
 *            target?:string, value?:any, delta?:number}} Effect
 *
 * @typedef {Object} GraveyardEntry
 * @property {string} id
 * @property {string} fullName
 * @property {string} gender
 * @property {number} ageAtDeath
 * @property {number} birthYear
 * @property {number} deathYear
 * @property {string} causeOfDeath
 * @property {number} netWorth
 * @property {string} countryId
 * @property {string} city
 * @property {string} lastOccupation
 * @property {string[]} epitaphIds  every epitaph earned, the defining one first
 * @property {{gross:number, tax:number, net:number, charity:number, toState:number, shares:{npcId:string,name:string,role:string,amount:number}[]}} [estate]
 * @property {?string} [continuedAs]  name of the child the player carried on as
 * @property {number} childrenCount
 * @property {Milestone[]} milestones
 * @property {LifeCounters} counters
 * @property {number} generation
 *
 * @typedef {Object} GameState
 * @property {number} schemaVersion
 * @property {string} slotId
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {number} year
 * @property {Character} player
 * @property {Object<string, NPC>} npcs
 * @property {JournalEntry[]} journal
 * @property {{prices:Object<string,number>, history:Object<string,number[]>, housing:number, listings?:object}} market  prices in base units
 * @property {{id:string, lastAge:number}[]} eventHistory
 * @property {{id:string, cast:Object<string,string>}[]} pendingEvents  modal queue; survives reload
 * @property {object} [animals]  the family's animals, their keepers and their moments, kept across generations (engine/animals.js)
 * @property {number} rngSeed
 * @property {{theme:'auto'|'light'|'dark'}} settings
 * @typedef {{age:number, text:string, kind:'event'|'choice'|'outcome'|'system', tone:'good'|'bad'|'neutral', animal?:{id:string, ev:string}}} JournalEntry  `animal` marks a line that tells a moment in an animal's life
 *
 * @typedef {{slotId:string, name:string, age:number, gender:string, countryId:string,
 *            netWorth:number, updatedAt:number}} SaveSlotMeta
 */
export {};
