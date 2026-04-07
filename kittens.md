# Kittens Game — Design Reference Document

> "You are a kitten in a catnip forest."
> That single sentence starts one of the most complex incremental games ever made.

Kittens Game (kittensgame.com / bloodrizer.ru/games/kittens) is a browser-based text incremental game created by **bloodrizer** (nuclear-unicorn). It is self-described as "the Dark Souls of incremental gaming." The game is in continuous development with regular updates; this document reflects the mechanics as of approximately version 1.4.x.

---

## 1. Core Loop

### Moment-to-moment

The game runs on a **tick system**: 5 ticks per second (one tick = 200 ms). All production, consumption, and events are resolved per tick. The player sees resource counters updating in real time.

**Phase 1 — Manual clicking (first few minutes)**
The game opens with a single button: "Gather catnip." Each click adds 1 catnip. When you accumulate 10 catnip, the "Catnip Field" button becomes visible. Building the first field shifts the game from pure clicking to idle production. This transition — from pulling a lever to building a machine — is the game's first design hook.

**Phase 2 — Early automation (first hour)**
A library unlocks the Science tab. A hut brings the first kitten. Kittens must be manually assigned to jobs (farmer, woodcutter, scholar, etc.). The player's job becomes deciding _who_ does _what_, rather than clicking for resources.

**Phase 3 — Active management (hours 1–5)**
Resource caps become the binding constraint. Building barns increases wood cap; warehouses increase mineral cap. The player juggles which buildings to buy, which techs to research, and which job assignments maximize throughput. Winter is the first true crisis — catnip fields produce 75% less, kittens starve if the player isn't prepared.

**Phase 4 — Systems multiplication (days 1–7)**
New tabs unlock: Workshop (crafting), Science (tech tree), Trade (other races), Religion (faith/worship/unicorns), Space (late game). Each tab adds a parallel economy. The player must optimize across all of them simultaneously.

**Phase 5 — Prestige loop**
After the first run of roughly two weeks, the player resets. They receive Karma and Paragon based on kitten population. Paragon is spent in Metaphysics for permanent upgrades. Each subsequent run is faster.

### Minute-to-minute decision cadence

The game incentivizes approximately one meaningful click per minute in the early game, scaling down as automation takes over. Key decision points:

- Which job assignment for the current bottleneck resource?
- Which building to save toward?
- Should I send hunters now (for furs/ivory/catpower) or keep everyone farming through winter?
- Which tech to research next (each unlocks new building categories)?
- When is the right moment to praise the sun (convert faith to worship)?

---

## 2. Resource System

Resources are divided into four tiers by complexity.

### Tier 1 — Basic (worker-produced or field-produced)

| Resource | Primary Source | Notes |
|---|---|---|
| **Catnip** | Catnip Fields, Farmers | Food; consumed 4.25/s per kitten (0.85/tick); seasonal |
| **Wood** | Woodcutters | 0.09/s per woodcutter base |
| **Minerals** | Miners | 0.25/s per miner base |
| **Catpower** | Hunters | Used for hunting; accumulates toward a send-hunt button |
| **Science** | Scholars | Used to purchase technologies |
| **Faith** | Priests, Chapels, Temples | Religious resource; converted to worship |
| **Gold** | Geologists (with Geodesy upgrade) | Luxury; contributes to happiness |
| **Coal** | Geologists | Required for steel production |

### Tier 2 — Crafted (Workshop)

These are made from raw resources in the Workshop tab. Each craft is a manual action (or automated via engineers).

| Crafted Resource | Recipe | Notes |
|---|---|---|
| **Beam** | 175 wood | Construction material |
| **Slab** | 250 minerals | Construction material |
| **Plate** | 125 iron | Metal plate |
| **Steel** | 100 iron + 100 coal | Critical mid-game material |
| **Concrete** | 25 steel | Late-game construction |
| **Gear** | 15 steel | Engineering component |
| **Alloy** | 75 steel + 10 titanium | Advanced metal |
| **Scaffold** | 50 beams | Space construction |
| **Ship** | 100 scaffolds + 150 plates + 25 starcharts | Trade ship |
| **Tanker** | 200 ships | Oil transport |
| **Kerosene** | Made from oil | Rocket fuel |
| **Parchment** | 175 furs | Knowledge chain start |
| **Manuscript** | 25 parchment + 400 culture | Knowledge chain |
| **Compendium** | 50 manuscripts | Knowledge chain |
| **Blueprint** | 25 compendiums | Required for late techs |
| **Eludium** | 2500 alloy + 1000 unobtainium | End-game material |
| **Megalith** | Advanced materials | End-game construction |
| **Thorium** | Nuclear processing | Late resource |

### Tier 3 — Special / Luxury

| Resource | Source | Effect |
|---|---|---|
| **Furs** | Hunting | Trade good; also crafted into parchment; +10% happiness while held |
| **Ivory** | Hunting | Trade good; religious buildings; +10% happiness while held |
| **Unicorns** | Hunting, Unicorn Pastures | Sacrificed for tears; generate via religious buildings |
| **Tears** | Sacrificing unicorns (Ziggurats) | Build religious structures |
| **Alicorns** | Higher religion tiers | Sacrificed for time crystals |
| **Spice** | Trading | Luxury; +10% happiness while held |
| **Starcharts** | Scholars (with Astrophysicists upgrade) | Required for space buildings |
| **Titanium** | Smelters (small), trading Zebras | Critical bottleneck mid-game |
| **Uranium** | Trading Dragons, Lunar Outposts | Nuclear / space fuel |
| **Unobtainium** | Lunar Outposts (after Moon Mission) | Required for Eludium and Chronosphere |
| **Antimatter** | Sunlifters (Helios) | End-game |
| **Void** | Temporal Paradox events (Chronosphere) | Time tab mechanics |

### Tier 4 — Meta / Prestige

| Resource | Source | Effect |
|---|---|---|
| **Paragon** | Reset with >70 kittens; 1/1000 in-game years | Spent in Metaphysics for permanent upgrades |
| **Karma** | Reset with >35 kittens | Permanent +1% happiness per point + flat +10% bonus |
| **Epiphany** | Converting worship via Apocrypha | Transcendence tiers; cross-reset bonus |
| **Time Crystal** | Sacrificing Alicorns | Chronoforge; time skip |
| **Relic** | Refining Time Crystals | Metaphysics upgrades; Cryptotheology |

### Storage and caps

Raw materials have storage caps. Manufactured goods have no cap. This creates a core tension: without barn/warehouse upgrades, wood and minerals cap out and production halts. The player must balance storage expansion against production investment.

Storage examples:
- Barn: +75 wood, +200 catnip, +150 minerals (base)
- Warehouse: +50 minerals (base; upgraded with Reinforced Warehouses)
- Harbour: +50 wood, +200 catnip, +50 iron, +50 catpower, +10 blueprints

---

## 3. Production Chains

Production chains are the backbone of late-game pacing. Each tier requires the previous tier to function.

### Catnip Chain
```
Catnip fields (passive) + Farmers (active)
  → Catnip (food supply)
    → Feeds kittens (population)
      → More workers for all other chains
```

### Wood / Mineral Chain
```
Woodcutters → Wood
  → Beam (175 wood each)
    → Observatory, Space buildings

Miners → Minerals
  → Slab (250 minerals each)
    → Observatory, Space buildings
```

### Iron / Steel Chain
```
Smelters → Iron (from minerals + coal)
  → Plate (125 iron each)
  → Steel (100 iron + 100 coal per craft)
    → Concrete (25 steel)
    → Gear (15 steel)
    → Alloy (75 steel + 10 titanium)
```
The Smelter is the game's first major production multiplier. Early smelters run on coal from Geologists. The number of smelters you can sustain is limited by coal supply.

### Knowledge Chain (Furs → Blueprint)
```
Hunting → Furs (175 furs)
  → Parchment (25 parchment + 400 culture)
    → Manuscript (50 manuscripts)
      → Compendium (25 compendiums)
        → Blueprint
```
This 4-stage chain has a staggering raw input cost: **2,187,500 furs per blueprint** before workshop multipliers. Workshop upgrades apply a crafting bonus at each stage (+6% per workshop, additive). With 25 workshops providing a 2.5x multiplier at each of the 4 stages, the total multiplier is approximately 39x, reducing the effective fur cost to around 56,000 per blueprint.

### Titanium Chain
```
Zebra trading (mid-game primary source)
  + Smelters (small production, requires Metallurgy upgrade)
  + Calciners (advanced; requires oil)
    → Titanium
      → Alloy (75 steel + 10 titanium per craft)
        → Eludium (2500 alloy + 1000 unobtainium)
```
Late-game example: 87 smelters + 19 calciners (with upgrades) can reach approximately 78 titanium/s — roughly 1,640x baseline production.

A Calciner's base profile: consumes 1.5 minerals/tick + 0.024 oil/tick + 1 watt of power; produces 0.15 iron/tick + 0.0005 titanium/tick.

### Unobtainium Chain
```
Moon Mission (Rocketry tech required)
  → Lunar Outpost (each costs ~2,500 titanium to build)
    → 0.035 unobtainium/s each
    → costs 1.75 uranium/s each to operate
      → Unobtainium
        → Eludium (with Alloy)
          → Chronosphere, other endgame buildings
```

### Religion Chain
```
Hunting/Pastures → Unicorns
  → Ziggurats → Sacrifice unicorns → Tears
    → Build Order of the Sun buildings (Unicorn Utopia tier)
      → Ivory Tower → more Unicorns + Alicorns
        → Sacrifice Alicorns → Time Crystals
          → Chronoforge → time manipulation
```

### Knowledge for Tech
```
Scholars → Science
  + Manuscripts (mid-game tech prereq)
  + Compendiums (mid-game tech prereq)
  + Blueprints (late-game tech prereq)
    → Research technologies in Science tab
```

---

## 4. Buildings

Buildings are categorized by the tab that contains them. All buildings use **exponential price scaling**: each successive copy costs `base_cost × price_ratio^n` where n = number already built. Most buildings have a price ratio of 1.15; a few use 1.10 or 1.12.

### Bonfire Tab (core buildings)

**Food Production**

| Building | Base Cost | Price Ratio | Effect |
|---|---|---|---|
| Catnip Field | 10 catnip | 1.12 | +0.125 catnip/tick base |
| Pasture | 100 catnip, 10 wood | 1.15 | Reduces catnip consumption per kitten by 0.5% |
| Aqueduct | Requires Engineering tech | 1.15 | +3% catnip from fields and farmers per aqueduct |
| Solar Farm | Late game; requires Electricity | 1.15 | +2 energy; catnip bonus in summer |
| Hydro Plant | End game | 1.15 | Significant energy + catnip boost |

**Population**

| Building | Base Cost | Price Ratio | Population |
|---|---|---|---|
| Hut | 5 wood | 2.5 | +2 kittens max |
| Log House | 200 wood, 250 minerals | 1.15 | +1 kitten max (but high cap benefit) |
| Mansion | 185 slab, 75 steel, 25 titanium | 1.15 | +1 kitten max (high pop efficiency) |

Note: Huts use price ratio 2.5 — they get extremely expensive very quickly. Log Houses are the main population scaling path.

**Science**

| Building | Base Cost | Price Ratio | Effect |
|---|---|---|---|
| Library | 25 wood | 1.15 | +250 science cap; unlocks Science tab |
| Academy | 50 wood, 70 minerals, 100 science | 1.15 | +500 science cap; +5% scholar output |
| Observatory | 50 scaffold, 35 slab, 750 iron, 1000 science | 1.10 | +25% stargazing; +5 starcharts/yr |
| Bio Lab | Very late game | 1.15 | Science + biology resources |
| Data Center | Late game | 1.15 | Massive science storage |

**Storage**

| Building | Base Cost | Effect |
|---|---|---|
| Barn | 50 wood | +75 wood cap; +200 catnip cap; +150 minerals cap |
| Warehouse | 1.5 slab | +50 minerals cap (upgraded further with Reinforced Warehouses tech) |
| Harbour | Complex cost | Increases caps for multiple resources including blueprints |

**Resources / Industry**

| Building | Base Cost | Effect |
|---|---|---|
| Mine | 100 wood | +5% minerals from miners per mine |
| Lumber Mill | 100 wood, 50 iron, 250 minerals | +10% wood from woodcutters per mill |
| Smelter | 200 minerals | Converts minerals + coal to iron; base iron production |
| Calciner | Advanced (requires Metallurgy) | Converts minerals + oil → iron + tiny titanium |
| Steamworks | 65 steel, 20 gear, 1 blueprint | Boosts smelter and production; enables coal auto-burning |
| Magneto | Late game | Boosts production globally |
| Factory | 2000 titanium, 2500 plate, 15 concrete | Massively boosts workshop craft quantities |
| Reactor | Advanced nuclear | Power generation; uses uranium |
| Oil Well | Mid-game | Produces oil passively; oil drives Calciners |
| Accelerator | Advanced | Converts titanium; boosts space construction |

**Culture**

| Building | Base Cost | Effect |
|---|---|---|
| Amphitheatre | 200 wood, 1200 minerals, 3 parchment | +25 culture cap; reduces unhappiness by 4.8% per building |
| Broadcast Tower | 1 titanium, 5 plate | Replaces ~6 amphitheatres for culture cap; ~200x for culture production |
| Chapel | 2 minerals, 1 wood, 1 parchment | +400 culture cap; generates faith |
| Temple | Complex (requires Theology) | +2% culture; faith generation; happiness |

**Mega Structures**

| Building | Base Cost | Effect |
|---|---|---|
| Ziggurat | Blueprints, tears, ivory | Required for religion (unicorn sacrifice) |
| Chronosphere | Very late game (unobtainium, alloy, etc.) | Carries resources between resets; triggers Temporal Paradox |
| AI Core | Very late game | End-game objective; boosts production |

### Space Tab (Unlocked by Rocketry)

The Space tab has a series of missions to different locations, each unlocking new buildings.

| Location | Key Building | Effect |
|---|---|---|
| Moon | Lunar Outpost | +0.035 unobtainium/s (costs 1.75 uranium/s) |
| Moon | Moon Base | +150 storage cap |
| Dune | Planet Cracker | Produces large amounts of uranium |
| Piscine | Research Vessel | More starcharts |
| Helios | Sunlifter | Produces antimatter |
| T-Minus | Cryostation | Storage for unobtainium and rare resources |

---

## 5. Technology / Upgrades

### Research System

Science is generated by Scholar-assigned kittens (base rate) and multiplied by Academies (+5% per building). Technologies are purchased in the **Science tab** using science points, plus secondary costs in manuscripts, compendiums, or blueprints for mid-to-late techs.

The technology tree spans roughly 70+ technologies organized from primitive to interstellar civilization.

### Early-Game Technologies (science only)

| Technology | Key Unlock |
|---|---|
| Calendar | Reveals seasons; unlocks Pasture |
| Agriculture | Farmers produce more catnip |
| Archery | Hunter profession; hunting for furs/ivory/catpower |
| Animal Husbandry | Pastures produce more; Mint unlocks |
| Mining | Mine building; minerals production boost |
| Metal Working | Smelter; iron production begins |
| Mathematics | Workshop unlocked; crafting begins |
| Construction | Aqueduct; Lumber Mill |
| Civil Service | Geologist profession; Coal production |
| Engineering | Accelerated building costs |
| Currency | Trade tab and Trade Posts |
| Writing | Library capacity boost; opens knowledge chain |
| Philosophy | Amphitheatre; culture system |

### Mid-Game Technologies (require manuscripts / compendiums)

| Technology | Key Unlock |
|---|---|
| Steel | Steel crafting; major production leap |
| Machinery | Steamworks; automated smelting |
| Theology | Temple; faith generation; religion tab |
| Astronomy | Observatory; starcharts begin |
| Navigation | Trade Ships; maritime trade routes |
| Architecture | Advanced housing |
| Physics | Blueprint crafting from compendiums |
| Metaphysics | Metaphysics tab (requires unobtainium later) |
| Chemistry | Advanced refinement |
| Geology | Improved coal/mineral production |
| Drama and Poetry | Culture cap increases |
| Electricity | Power system begins; Solar Farms |
| Biology | Bio Lab |
| Genetics | Advanced biology |
| Industrialization | Factory unlocked |
| Combustion | Oil processing; internal combustion |
| Metallurgy | Titanium from smelters; Calciner |

### Late-Game Technologies (require blueprints)

| Technology | Key Unlock |
|---|---|
| Ecology | Ecological bonuses; |
| Electronics | Advanced manufacturing |
| Robotics | Factory automation; Engineers |
| Artificial Intelligence | AI Core prerequisite |
| Nuclear Fission | Reactors; uranium usage |
| Rocketry | Space tab opens |
| Oil Processing | Kerosene crafting; advanced fuel |
| Satellites | Starchart bonuses |
| Orbital Engineering | Space construction improvements |
| Thorium | Thorium fuel cycle |
| Exogeology | Unobtainium on other planets |
| Nanotechnology | Advanced manufacturing |
| Superconductors | Energy efficiency |
| Antimatter | Antimatter processing |
| Terraformation | Planet modification |
| Chronophysics | Chronosphere; time manipulation |
| Cryptotheology | Advanced religion tiers |
| Paradox Theory | End-game |

### Workshop Upgrades

The Workshop tab contains upgrades (not the same as technologies) purchased with crafted materials. These permanently boost crafting ratios, job production, and unlock new mechanics.

Key workshop upgrades include:
- **Steel Axe / Steel Saw**: Woodcutter production bonuses
- **Reinforced Warehouses**: Mineral storage multiplier
- **Titanium Barns / Warehouses**: Massive storage increases
- **Mining Drill**: Miner output boost
- **Oxidation**: Smelter efficiency
- **Geodesy**: Geologists also produce gold
- **Astrophysicists**: Scholars also produce starcharts
- **CAD System**: +0.01 blueprint per scientific building when crafting blueprints
- **Coal Furnace**: Enables Steamworks to auto-convert minerals to coal

Workshop upgrades apply a **+6% crafting bonus per upgrade tier** (additive), which stacks multiplicatively across multi-stage chains.

---

## 6. Population and Workforce

### Kitten Population

Kittens arrive when you have population capacity (from huts/log houses) and enough catnip production surplus. Each kitten consumes **0.85 catnip per tick (4.25/s)** at base happiness. If catnip goes negative and runs dry, kittens die immediately — starting with the one with the least experience.

Kittens gain experience slowly over time in their assigned jobs. Experience affects production efficiency. When you reset, kittens with the most experience are preserved in cryochambers (one per Cryochamber built).

### Jobs

| Job | Resource Produced | Notes |
|---|---|---|
| Farmer | Catnip | 5 catnip/s base (scales with pastures, aqueducts) |
| Woodcutter | Wood | 0.09 wood/s base (scales with lumber mills) |
| Miner | Minerals | 0.25 minerals/s base (scales with mines) |
| Scholar | Science | Science generation (scales with academies); also starcharts with Astrophysicists |
| Hunter | Catpower | Builds toward sending a hunting party; yields furs, ivory, catpower, sometimes unicorns |
| Priest | Faith | Faith generation (Theology required) |
| Geologist | Coal | Also gold with Geodesy upgrade |
| Scientist | Science (advanced) | Enhanced output vs scholar |
| Engineer | Auto-crafting | Crafts items automatically; must match resource level for full speed |

**Job assignment is fully manual** — the player drags kittens between jobs or uses the +/- buttons. This is the primary active decision point throughout the game.

### Happiness and Satisfaction

Happiness is the game's global production multiplier. Base happiness = 100%.

**Happiness above 100% → +1% production per point above 100, but also +1% catnip consumption per point above 100.**

**Happiness below 100% → -1% production per point below 100.**

Sources of happiness:
- **Karma** (from resets): +10% flat bonus + 1% per karma point
- **Luxury goods held**: Furs, ivory, spice, gold, unicorns each provide ~10% happiness
- **Amphitheatres**: Each reduces unhappiness by 4.8% of current unhappiness (diminishing)
- **Temples**: Additional happiness from culture
- **Solar Revolution bonus**: Global production multiplier that also affects effective output

The tradeoff: maximizing happiness requires holding luxury goods (furs, ivory, spice) which are also needed for crafting/trading. This creates genuine tension between happiness investment and progression.

### Population Caps and Bottlenecks

Hut price ratio of 2.5 means the 10th hut costs approximately 5 wood × 2.5^9 ≈ 3,814 wood. This makes huts a hard early wall. Log Houses (price ratio 1.15) become the preferred expansion path after initial housing.

The key decision for most of the game: how many kittens to allocate to farming vs. all other production. Too few farmers → winter starvation. Too many farmers → slow progress on everything else.

---

## 7. Seasons

The game year consists of 4 seasons of 100 days each (400 days total). At 5 ticks/second, one day = 40 ticks = 8 seconds. One season = 800 seconds ≈ 13 minutes. One year ≈ 53 minutes.

### Seasonal Catnip Modifiers (Fields only; Farmers unaffected)

| Season | Modifier | Effective Field Output |
|---|---|---|
| Spring | +0.5 (50% bonus) | 1.5× base |
| Summer | 0 (baseline) | 1.0× base |
| Autumn | 0 (baseline) | 1.0× base |
| Winter | −0.75 (75% penalty) | 0.25× base |

Winter is the defining constraint of the early game. A player with 10 catnip fields producing 0.125/tick each in summer (1.25 catnip/tick total) will produce only 0.3125 catnip/tick in winter — while still consuming 0.85 catnip/tick per kitten. Winter with 2 kittens consumes 1.7/tick; fields only provide 0.3125. Farmers must make up the rest.

### Weather Variation (Year 4+)

Starting at Year 4, there is a **35% chance any given season is abnormal**:
- 17.5% chance: warm (additional catnip bonus)
- 17.5% chance: cold (additional catnip penalty)
- 65% chance: normal

Cold winters compound the already severe -75% penalty and can catch unprepared players off guard.

### Seasonal Trade Rates

Different races trade best in different seasons — an additional planning layer for experienced players.

### Aqueducts and Pastures — Mitigating Winter

- Each **Aqueduct** provides +3% catnip from fields AND farmers (additive)
- Each **Pasture** reduces per-kitten catnip consumption by 0.5% (multiplicative)

With enough aqueducts and pastures, the winter crisis becomes manageable: fields produce more, kittens eat less.

### Calendar Technology

Researching **Calendar** reveals the current season in the UI and unlocks the Pasture building. Before Calendar, players cannot see what season it is — a clever information-gating mechanic.

---

## 8. Prestige System

### Reset Mechanics

The reset button is in the **Time tab** (unlocked by the Chronosphere eventually, but also accessible via the main menu before then). Resetting destroys almost everything, but grants permanent resources that persist.

### What You Gain on Reset

**Paragon**: 1 point for each kitten above 70 at the time of reset. Also earned at 1 per 1,000 in-game years during a run. Paragon persists across all resets permanently.

**Karma**: Earned when resetting with more than 35 kittens. Provides +10% flat happiness + 1% per karma point. Karma also persists permanently.

**Preserved kittens**: You keep as many kittens as you have Cryochambers, starting with the highest-experience kittens. These kittens return immediately at the start of the new run.

**Crafted resources (diminishing returns)**: With Chronospheres and the Flux Condensator upgrade, a percentage of crafted resources carries over. The formula is approximately `1.5% × 100 × sqrt(Chronospheres)` per resource, with diminishing returns. Applicable resources: bloodstone, beam, slab, plate, steel, concrete, gear, alloy, eludium, scaffold, ship, tanker, kerosene, parchment, manuscript, compendium, blueprint, thorium, megalith.

**Metaphysics upgrades**: Any upgrade bought in the Metaphysics tab carries over permanently.

**Epiphany (via Apocrypha)**: Transcendence bonuses from the Adore/Transcend mechanic carry over between resets.

### What You Lose

Everything else: all buildings, all technologies, all non-prestige resources, all kittens not in cryochambers.

### Metaphysics — Permanent Upgrades

Metaphysics is unlocked by researching it in the Science tab (requires Unobtainium). Upgrades are bought with Paragon and persist across all runs.

**Priority upgrade sequence (community consensus):**

1. **Diplomacy** (cost: ~5 paragon): Trade races appear in Year 1 instead of later. Also reduces the number of Trade Posts needed to pacify Griffins and Zebras.
2. **Enlightenment** (~10 paragon): Reduces building price ratio.
3. **Golden Ratio** (~15 paragon): Further reduces price ratio (uses mathematical golden ratio ≈ 1.618).
4. **Divine Proportion** (~20 paragon): Continued price ratio reduction.
5. **Vitruvian Feline** (~25 paragon): Another price ratio tier.
6. **Renaissance** (~30 paragon): Final standard price ratio reduction.

Combined, these five reduce the standard 1.15 price ratio down to approximately **1.0643**, which has enormous compounding effects on how many buildings you can afford.

Other notable Metaphysics upgrades:
- **Engineer**: Enables auto-crafting via the Engineer job
- **Numerology / Numeromancy**: Additional paragon generation per year
- **Black Codex**: Boosts blueprint production
- Various space and religion efficiency upgrades

### Paragon Economy

Paragon also provides direct production bonuses:
- Provides a production multiplier (capped at 200% / 2x without further upgrades; can be raised with Metaphysics)
- Provides unlimited storage scaling (small amount per paragon point)

Paragon can also be permanently destroyed ("burned") to unlock special Achievement variants.

### First Reset — Optimal Timing

Community consensus: **first reset at 130+ kittens**. This yields 60+ paragon (130 − 70 = 60), which is enough to purchase Diplomacy + Enlightenment + Golden Ratio. First run typically takes about **2 weeks** of casual play.

Suggested buy order with 60 paragon: Diplomacy first (huge quality-of-life), then Enlightenment, then save Golden Ratio for when you have ~155–160 kittens to enjoy it longer before next reset.

### Challenges

Challenges are optional modified runs with rewards that further enhance subsequent runs.

| Challenge | Restriction | Reward |
|---|---|---|
| **Anarchy** | Only half kittens can be assigned jobs; no leaders; kittens eat extra catnip | Kittens count double toward Karma |
| **Atheism** | No Order of the Sun; no religious bonuses | Completing with cryochamber increases Solar Revolution per Transcendence tier |
| **Winter Has Come** | Perpetual winter (no other seasons) | Cold winters never occur; each run adds 5% Spring/Summer bonus (capped 200%) |
| **Iron Will** | Play without kittens (only buildings) | +1 Zebra trade cap per completion (max +100); additional per 10k science spent |
| **1000 Years** | Must survive 1000 in-game years before resetting | Extended survival bonuses |
| **Black Sky** | Zebra trading unavailable early (titanium locked) | Difficult run; bonus rewards |

---

## 9. Progression Pacing

### Early Game (Run 1, Hours 1–5)

**Primary walls:**

1. **The first winter wall**: Players who built too many huts (too many kittens) without enough catnip fields hit a starvation cascade. The solution is building at least 30–40 catnip fields and having multiple farmers before expanding population past 3–4 kittens.

2. **The library/science wall**: Getting a library (25 wood) requires saving wood while huts are also demanding wood. The tension between housing and science is the first real strategic decision.

3. **The steel wall**: Iron requires a smelter (200 minerals) running on coal (requires Geologists, which require Civil Service research). This unlocks when the player has enough scholars to research Mining → Metal Working → Civil Service. The sequence from catnip farming to first steel typically takes 2–4 hours.

**Recommended early priority**: 
- Get to 30% of the cost of any building to reveal it
- Prioritize: Catnip Fields → Huts (carefully) → Library → Barn → Mines → Workshops → Lumber Mills → Academy

### Mid Game (Run 1, Hours 5–40)

**Primary walls:**

1. **The titanium wall**: Titanium from smelters is microscopic. The primary path is trading with Zebras (iron → titanium). But Zebras have a 30% hate chance. Solving this requires 85+ Trade Posts (or 56 with Diplomacy metaphysics). Building 56–85 trade posts while also building everything else is the central mid-game grind.

2. **The blueprint wall**: Unlocking late-game techs requires blueprints. Each blueprint requires 25 compendiums → 50 manuscripts each → 25 parchment each → 175 furs each = 2.187 million furs per blueprint before multipliers. Without Workshop upgrades and enough hunters, this is the slowest phase of the game.

3. **The energy wall**: The Factory requires power. Reactors and Solar Farms generate power. Balancing energy supply vs. demand is the mid-game equivalent of the early catnip balance.

4. **The culture wall**: Manuscripts require 400 culture each. Culture is capped by Amphitheatres/Broadcast Towers. Players often don't invest in culture buildings early enough and hit this wall when trying to scale knowledge.

### Late Game (Run 1+, Hours 40–200+)

**Primary walls:**

1. **The space wall**: Getting to the Moon requires Rocketry + building Rockets. Rockets are expensive in oil/titanium/uranium.

2. **The unobtainium wall**: Lunar Outposts produce 0.035 unobtainium/s but cost 1.75 uranium/s. Each outpost runs at a loss unless you have significant uranium production. First few outposts are affordable; scaling up requires Dragon trading infrastructure.

3. **The Chronosphere wall**: The ultimate build. Requires unobtainium + alloy + other advanced materials. Building even one Chronosphere takes significant time investment.

**The pacing insight**: Each major bottleneck is solved by investing in an entirely different resource chain. The game is not linear — it branches constantly. The player must recognize which chain is currently the binding constraint and focus there.

### Subsequent Runs

Runs accelerate dramatically:
- **Run 2**: ~3–5 days to reach Run 1 equivalent point (diplomacy removes trade friction; price ratio reductions let you build more)
- **Run 3+**: Further acceleration; the game becomes about optimizing the religion system and getting to the Chronosphere faster

---

## 10. Game Design Lessons

### Lesson 1: Discovery-first progression

Almost nothing in the game is explained. Resources appear when you first have a meaningful quantity. Buildings become visible only when you have 30% of the required resources. Technologies unlock based on buildings you've constructed. This information gating is a deliberate design choice: the game reveals its complexity gradually, letting players feel smart for figuring things out rather than overwhelmed by reading a manual.

Bloodrizer's stated design principle: players should discover mechanics, not be taught them.

### Lesson 2: The automation gradient

The game has a continuous spectrum from manual to automated:
- **Fully manual**: clicking "Gather catnip", sending hunting parties, praising the sun
- **Passive automation**: catnip fields, buildings with passive output
- **Semi-automation**: job assignments (set it and forget it for hours)
- **Full automation**: Steamworks (auto-burns minerals to coal), Engineers (auto-craft)

Each step up the automation ladder is a milestone that changes the player's relationship with the game. The player never fully stops playing — there's always something to decide — but the cadence shifts from "click every 5 seconds" to "check in once an hour."

### Lesson 3: Multiple binding constraints

At any given moment, there are typically 3–5 resources that could plausibly be the most important to invest in. The game never has an obvious single "correct" move. This is a deliberate design: the player must understand the full production network to identify the true bottleneck. This complexity is what gives the game its "Dark Souls" reputation — it rewards players who read the system, not just players who click faster.

### Lesson 4: Every solution creates a new problem

More kittens → more food needed → more farmers → less production of everything else. More production → more storage needed → storage buildings compete with production buildings. More happiness → more catnip consumption. More chronospheres → more temporal paradoxes. The game's economy has built-in negative feedback loops that prevent runaway scaling and keep the player engaged indefinitely.

### Lesson 5: The reset as replayability engine

Most idle games grow stale because there's no replayability — once maximized, there's nothing left to do. Kittens Game's prestige system solves this with genuine economic structure: Paragon gives meaningful permanent upgrades that change how you play, Karma changes the happiness baseline (affecting catnip balance), Cryochambers carry forward kitten experience, and Challenges add mechanical twists that require different strategies.

The player isn't just "starting over" — they're playing a noticeably different economic game each run, with new tools from the previous one.

### Lesson 6: Idle games are about planning, not clicking

Academic research on Kittens Game (Monash University, 2018) identified a core poetic: "incentivizing players to play less and plan more." The game's meaningful actions are almost never time-pressured. What matters is deciding what to build next, not how fast you can click. This inverts the typical game design pressure. Players who think carefully outperform players who are simply attentive.

Bloodrizer's design notes: "every problem should be addressable in multiple ways, and every solution should create a new problem. Active gameplay should be encouraged but never required."

### Lesson 7: Numbers that feel earned

The game deliberately uses human-scale numbers in early game (hundreds of catnip, dozens of wood) transitioning to astronomical numbers only in the late game. This gives the player a sense of genuine progress — each order-of-magnitude increase feels like a real advancement, not an artificial inflation. The workshop upgrade system (compounding 6% bonuses per upgrade) means the player can trace exactly why their production increased by 39x — it's the math, and they chose to pursue it.

### Lesson 8: The fur→blueprint chain as exemplary design

The knowledge chain (furs → parchment → manuscript → compendium → blueprint) is a masterclass in long-horizon resource planning. The raw input cost (2.187M furs per blueprint before multipliers) is so high that naive calculation makes it seem impossible. But workshop upgrades compound exponentially, making the chain eventually trivial. This teaches the player that _upgrading the chain_ (buying workshops, upgrading the Hunter profession) is more valuable than grinding the chain directly. It's a lesson in investment vs. execution that mirrors real economics.

### Lesson 9: Deliberate friction in trade

The Zebra hate mechanic (30% base chance to refuse trade) is intentionally frustrating and deliberately solvable only with significant investment (85 Trade Posts). This friction serves as a gate that says: "you're not ready for titanium yet." The game uses hostile NPC behavior as an economic gatekeeper rather than an explicit locked door. It feels emergent and diegetic rather than artificial.

### Lesson 10: Temporal anchoring through seasons

The 13-minute season cycle anchors the player's sense of time. Winter is predictable and threatening. Spring is reliably rewarding. This creates a planning rhythm that most idle games lack: you can set a goal ("I want to have X catnip fields before winter") and race toward it. The season cycle gives idle play structure that pure timer-based games don't have.

---

## Quick Reference: Key Numbers

| Mechanic | Value |
|---|---|
| Ticks per second | 5 (1 tick = 200ms) |
| Season length | 100 days |
| Days per second | ~0.625 (1 day = 1.6s) |
| Season duration (real time) | ~160 seconds (2m 40s) |
| Year duration (real time) | ~640 seconds (10m 40s) |
| Catnip per kitten per tick | 0.85 (= 4.25/s) |
| Spring field modifier | +50% |
| Summer/Autumn field modifier | 0% |
| Winter field modifier | −75% |
| Catnip Field base output | 0.125/tick (0.625/s) |
| Catnip Field first cost | 10 catnip |
| Catnip Field price ratio | 1.12 |
| Hut first cost | 5 wood |
| Hut price ratio | 2.5 |
| Hut capacity | +2 kittens |
| Log House first cost | 200 wood + 250 minerals |
| Log House price ratio | 1.15 |
| Library first cost | 25 wood |
| Smelter first cost | 200 minerals |
| Steel recipe | 100 iron + 100 coal |
| Alloy recipe | 75 steel + 10 titanium |
| Blueprint chain raw cost | ~2,187,500 furs |
| Workshop crafting bonus | +6% per upgrade (additive) |
| Paragon threshold | 1 point per kitten over 70 |
| Karma threshold | Resets with >35 kittens |
| Karma happiness effect | +10% flat + 1% per point |
| Standard price ratio | 1.15 |
| Price ratio with all Metaphysics reductions | ~1.0643 |
| Optimal first reset target | 130+ kittens (60+ paragon) |
| First run typical duration | ~2 weeks |
| Zebra hate chance (base) | 30% |
| Trade Posts to pacify Zebras | 85 (or 56 with Diplomacy) |
| Lunar Outpost unobtainium | 0.035/s per outpost |
| Lunar Outpost uranium cost | 1.75/s per outpost |
| Chronosphere paradox trigger | rolls 100-sided die vs. # Chronospheres each season |

---

*Sources: wiki.kittensgame.com, github.com/nuclear-unicorn/kittensgame, github.com/meriton42/kitten-accountant, embeddedrelated.com (Jason Sachs analysis), malvasiabianca.org, freethoughtblogs.com, research.monash.edu (academic paper: "The Pleasure of Playing Less"), forum.kittensgame.com, reddit.com/r/kittensgame*
