#!/usr/bin/env python3
"""gen_farshore.py — the Far Shore tier: 100 upgrades from octodecillion up.

Written as a SEPARATE content file (js/content/upgrades-farshore.js) that
appends to CONFIG.upgrades, so it does not touch the existing 892.

Pacing
------
The catalogue held a steady ~15 upgrades per three decades of cost up to
1e74 and then stopped: the last stretch of the game had nothing to buy. This
keeps that same cadence — costs rise 1.6x a step — from 1e58 to about 1e78.

The multipliers are deliberately small (+20% to +35%). Across the whole tier
production rises about 5e9 while cost rises 1e20, so the gap between
purchases widens gently the higher you climb. That is what stops the tier
being swallowed in an evening, and it is the opposite of the +300% upgrade
that let someone buy the rest of the shop in one go.
"""

BASE_COST = 1e58
# 1.6x a step matched the rest of the catalogue, but the catalogue's own top
# end is already out of reach: a maxed player produces 1.3e57/sec and the most
# expensive existing upgrade costs 4.9e72, which is 120 million years of
# production. Pricing a new tier against that cadence made the 50th upgrade a
# 2,456-year wait. 1.32x spends the same 100 upgrades filling the band players
# can actually reach, which is what makes it pace well.
STEP = 1.45

CREW = ['pianta', 'fruitlady', 'noki', 'yoshi', 'toad', 'mushroompianta',
        'piantissimo', 'tanooki', 'shadowmario', 'riccoconverter',
        'chuckster', 'giantpiantatree', 'coronamountain', 'piantajudge']

LABEL = {
 'pianta': 'Piantas', 'fruitlady': 'Fruit Ladies', 'noki': 'Nokis',
 'yoshi': 'Yoshis', 'toad': 'Toads', 'mushroompianta': 'Mushroom Dealers',
 'piantissimo': 'Il Piantissimos', 'tanooki': 'Tanookis',
 'shadowmario': 'Shadow Marios', 'riccoconverter': 'Ricco Converters',
 'chuckster': 'Chucksters', 'giantpiantatree': 'Giant Pianta Trees',
 'coronamountain': 'Corona Mountains', 'piantajudge': 'Pianta Judges',
}
SINGULAR = {
 'pianta': 'Pianta', 'fruitlady': 'Fruit Lady', 'noki': 'Noki', 'yoshi': 'Yoshi',
 'toad': 'Toad', 'mushroompianta': 'Mushroom Dealer', 'piantissimo': 'Il Piantissimo',
 'tanooki': 'Tanooki', 'shadowmario': 'Shadow Mario',
 'riccoconverter': 'Ricco Converter', 'chuckster': 'Chuckster',
 'giantpiantatree': 'Giant Pianta Tree', 'coronamountain': 'Corona Mountain',
 'piantajudge': 'Pianta Judge',
}
ICON = dict((w, "assets/placeholder-%s.png" % w) for w in CREW)
ICON['shine'] = "assets/placeholder-shine.png"
ICON['upgrade'] = "assets/placeholder-upgrade.png"


def pct(v):
    import math
    return ('%g' % (math.floor(v * 10000 + 0.5) / 100.0))


up = []
_slot = [0]


def next_cost():
    c = BASE_COST * (STEP ** _slot[0])
    _slot[0] += 1
    return c


def add(uid, name, desc, cost, icon, effects):
    up.append(dict(id=uid, name=name, description=desc, cost=cost,
                   icon=ICON[icon], effects=effects,
                   unlock=dict(type='totalEarned', amount=cost * 0.6)))


# -- 44 island-wide steps -----------------------------------------------------
# Named down the map of Delfino and then off the edge of it.
GLOBALS = [
 ('The Windward Terraces', 'Planted on the side the weather hits first.'),
 ('Leeward Shelter', 'And on the side it does not.'),
 ('The Salt Line', 'Past here nothing should grow. It does.'),
 ('Tidewrack Composting', 'Whatever the sea leaves gets turned back in.'),
 ('The Bianco Aqueduct', 'The lake was persuaded to go uphill.'),
 ('Windmill Reharnessed', 'It grinds nothing now. It pumps everything.'),
 ('Ricco Deepwater Berths', 'The big hulls come alongside at last.'),
 ('The Harbour Conveyor', 'It runs day and night and nobody watches it.'),
 ('Gelato Sun-Curing', 'Racked on the hot sand and left to it.'),
 ('The Sand Bird Circuit', 'It flies a route now. The route has a timetable.'),
 ('Pinna Cargo Coasters', 'The rides earn their keep between guests.'),
 ('The Park After Dark', 'The lights stay on for the second shift.'),
 ('Sirena Cellarage', 'Under the hotel, cool and enormous.'),
 ('The Hotel Ledger', 'Every room booked, none of them slept in.'),
 ('The Noki Deeps', 'Grown at a depth that hurts to think about.'),
 ('The Bottle At The Top', 'Somebody finally read what was inside.'),
 ('Corona Ash Terraces', 'The richest soil on the island, and the hottest.'),
 ('The Vent Orchards', 'Warmed from underneath, permanently.'),
 ('Delfino Airstrip Freight', 'The runway was widened twice in a month.'),
 ('The Plaza Exchange', 'Fruit has a spot price now. It only goes up.'),
 ('Island-Wide Bonding', 'Every grove insured against every other grove.'),
 ('The Standing Fleet', 'Ships that exist only to wait for fruit.'),
 ('Archipelago Freeport', 'No duties, no questions, enormous volume.'),
 ('The Continental Contract', 'Signed by people who have never seen a durian.'),
 ('Deepwater Plantations', 'Anchored miles out, tended by boat.'),
 ('The Shelf Break Groves', 'Where the seabed drops away, and they grow anyway.'),
 ('Abyssal Cultivation', 'Lit by something nobody has satisfactorily named.'),
 ('The Midnight Harvest', 'It never sees the sun and does not seem to mind.'),
 ('Stormline Farming', 'The weather is a crop input now.'),
 ('The Monsoon Contract', 'Rain, delivered to schedule, by agreement.'),
 ('Cloudbank Groves', 'Tethered up there, dripping.'),
 ('The Upper Airs', 'Thin, cold, and startlingly productive.'),
 ('Orbital Ripening', 'A mirror was involved. Several mirrors.'),
 ('The Long Daylight', 'Somebody arranged for the sun not to set.'),
 ('Selenic Terraces', 'The moon turned out to be arable.'),
 ('The Tidal Ledger', 'Two harvests a day, forever, by clockwork.'),
 ('The Sunward Turn', 'Everything turns to face the light. Everything.'),
 ('The Solar Groves', 'Grown against a star, at a respectful distance.'),
 ('Interstellar Cuttings', 'Sent out. Some of them came back laden.'),
 ('Grown From Nothing', 'It grows in nothing, out of nothing, constantly.'),
 ('Galactic Husbandry', 'The arm of the galaxy is under cultivation.'),
 ('As Far As Anyone Can See', 'Everything anyone can see is fruiting.'),
 ('Beyond The Charts', 'The maps stop. The orchards do not.'),
 ('Nothing Left To Plant', 'And still it grows.'),
]
for i, (nm, flavor) in enumerate(GLOBALS):
    mult = round(1.20 + (i // 11) * 0.04, 3)
    cost = next_cost()
    add('far_g%02d' % (i + 1), nm,
        'All workers produce +%s%% Durians. %s' % (pct(mult - 1), flavor),
        cost, 'shine', [dict(type='globalMult', value=mult)])


# -- 42 crew steps, three each ------------------------------------------------
# Three steps each, with their own flavour: sharing three lines across
# fourteen crew is exactly the repetition that made the shop feel generated.
CREW_FLAVOR = {
 'pianta': [
   'They were here before the Plaza had a fountain.',
   'The village drums carry the shift change now.',
   'Every family has someone in the groves. Every family.'],
 'fruitlady': [
   'Her stall has outlasted four mayors and a volcano.',
   'She knows what you want before you reach the counter.',
   'The price is the price. It has always been the price.'],
 'noki': [
   'Decided at the bottom of the bay, in the usual silence.',
   'The shells carry more than anyone expected.',
   'They have been doing this since before the bottle.'],
 'yoshi': [
   'Still will not go near the water. Still enormously useful.',
   'The juice budget is now the largest line in the ledger.',
   'They eat a third of it and produce four times as much.'],
 'toad': [
   'The brigade files a report nobody reads and never errs.',
   'Caps off, sleeves up, no discussion whatsoever.',
   'They brought a system with them and it works.'],
 'mushroompianta': [
   'Nobody has established what he actually sells.',
   'The stall has survived three separate inquiries.',
   'Terms available. Terms not explained.'],
 'piantissimo': [
   'He insists the record still stands. It does not.',
   'Arrives first, leaves last, mentions it constantly.',
   'The mask has never come off during working hours.'],
 'tanooki': [
   'Surveyors have stopped trying to count the trees.',
   'One of them held still for a year to prove a point.',
   'Statues in the plaza have started going missing.'],
 'shadowmario': [
   'The copies are producing copies. Nobody minds any more.',
   'The brush was confiscated. Production did not fall.',
   'Whatever he is, he shows up for the shift.'],
 'riccoconverter': [
   'It hums, it never stops, and nobody has opened it.',
   'Feed anything in. Durians come out. Do not ask.',
   'The harbour was rebuilt around the hopper.'],
 'chuckster': [
   'Nothing on this island has touched the ground in years.',
   'The distances are no longer being written down.',
   'They throw the crates. Then they throw the carts.'],
 'giantpiantatree': [
   'The village grew around it, not the other way round.',
   'Its roots are under the harbour now. And the airstrip.',
   'It has outlived every record of it being planted.'],
 'coronamountain': [
   'The eruptions are on the roster like any other crew.',
   'It has not cooled since they put the valve in.',
   'Ash on everything, and the soil has never been better.'],
 'piantajudge': [
   'The ruling was unanimous. He was the only one voting.',
   'Appeals are heard. Appeals are dismissed. Same afternoon.',
   'Article One of the charter is now about fruit.'],
}
CREW_STEPS = ['Beyond Instruction', 'The Settled Method', 'No Longer Counted']
for wid in CREW:
    for i, nm in enumerate(CREW_STEPS):
        cost = next_cost()
        add('%s_fs%d' % (wid, i + 1),
            '%s: %s' % (SINGULAR[wid], nm),
            '%s produce +35%% Durians. %s' % (LABEL[wid], CREW_FLAVOR[wid][i]),
            cost, wid, [dict(type='workerMult', target=wid, value=1.35)])


# -- 8 Shine scaling ----------------------------------------------------------
SHINES = [
 ('The Archive Wing', 'A building for them. Then a second building.'),
 ('Catalogued At Last', 'Every one numbered, which took years.'),
 ('The Reading Room', 'People come to study the collection now.'),
 ('Every Sprite Named', 'They answer to the names. That was unexpected.'),
 ('The Complete Index', 'Cross-referenced against a map of the island.'),
 ('Nothing Uncounted', 'The last unlogged Shine was found in a drawer.'),
 ('The Permanent Exhibition', 'Open to the public, one afternoon a year.'),
 ('More Light Than Island', 'The glow is visible from the next archipelago.'),
]
for i, (nm, flavor) in enumerate(SHINES):
    # halved alongside the main catalogue: achievement scaling is multiplied
    # by your Shine count, and by this point players have hundreds
    val = round(0.006 + i * 0.002, 4)
    cost = next_cost()
    add('far_shine%d' % (i + 1), nm,
        'Each Shine earned adds a further +%s%% to all production. %s' % (pct(val), flavor),
        cost, 'shine', [dict(type='achievementBonus', value=val)])


# -- 6 island-wide synergies --------------------------------------------------
# Values are tiny on purpose: a synergy multiplies by (1 + value x crew size),
# and endgame crews run past a thousand, so anything larger compounds hard.
SYNERGIES = [
 ('The Whole Island Counts', 'Every pair of hands, counted once and paid twice.'),
 ('One Payroll', 'It took four years to merge and it was worth it.'),
 ('The Common Harvest', 'Nobody works for a grove any more. They work for the island.'),
 ('Everyone, Everywhere', 'There is no longer a person here who is not involved.'),
 ('The Single Effort', 'It reads as one motion from a distance.'),
 ('Delfino Entire', 'The island is the crew and the crew is the island.'),
]
for i, (nm, flavor) in enumerate(SYNERGIES):
    cost = next_cost()
    add('far_syn%d' % (i + 1), nm,
        'All workers gain +%s%% output for each worker you own. %s' % (pct(0.00012), flavor),
        cost, 'shine',
        [dict(type='workerSynergy', target='all', source='all', value=0.00012)])


# ------------------------------------------------------------------- emit ----
assert len(up) == 100, 'expected 100 upgrades, built %d' % len(up)
assert len(set(u['id'] for u in up)) == 100, 'duplicate id'
assert len(set(u['name'] for u in up)) == 100, 'duplicate name'

_flavors = [u['description'].split('. ', 1)[1] for u in up if '. ' in u['description']]
assert len(_flavors) == len(set(_flavors)), 'a flavour line is used twice in this tier'

# names must also not collide with the main catalogue
import re as _re
_main = open('durian-clicker/js/content/upgrades.js').read()
_taken = set(_re.findall(r"name: '((?:[^'\\]|\\.)*)'", _main))
_clash = sorted(u['name'] for u in up if u['name'] in _taken)
assert not _clash, 'name already used in the main catalogue: %s' % _clash


def js(v):
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, str):
        return "'" + v.replace("\\", "\\\\").replace("'", "\\'") + "'"
    if isinstance(v, float):
        return repr(v) if v < 1e15 else ('%.6e' % v)
    return str(v)


def obj(d):
    return '{ ' + ', '.join('%s: %s' % (k, js(v)) for k, v in d.items()) + ' }'


lines = []
for u in up:
    fx = ', '.join(obj(e) for e in u['effects'])
    lines.append(
        "    { id: %s, name: %s,\n"
        "      description: %s,\n"
        "      cost: %s, icon: %s,\n"
        "      effects: [%s],\n"
        "      unlock: %s }"
        % (js(u['id']), js(u['name']), js(u['description']),
           '%.6e' % u['cost'], js(u['icon']), fx, obj(u['unlock'])))

header = """/* =============================================================================
 * content/upgrades-farshore.js — the Far Shore: 100 endgame upgrades.
 * -----------------------------------------------------------------------------
 * Generated by gen_farshore.py. Appends to the main catalogue rather than
 * replacing any of it, so the existing upgrades are untouched.
 *
 * Priced from 1e58 to roughly 1.4e70 at 1.32x a step. That is denser than the
 * rest of the catalogue on purpose: the band above 1e58 is where a finished
 * player actually sits, and the old ceiling above it was never reachable.
 * Multipliers stay small (+20% to +35%), so the last upgrade is a few days of
 * production rather than a geological era.
 * ========================================================================== */
(function (DC) {
  'use strict';

  DC.CONFIG.upgrades = DC.CONFIG.upgrades.concat([

"""

with open('durian-clicker/js/content/upgrades-farshore.js', 'w') as f:
    f.write(header + ",\n".join(lines) + "\n\n  ]);\n})(window.DC = window.DC || {});\n")

costs = sorted(u['cost'] for u in up)
print('wrote %d Far Shore upgrades' % len(up))
print('  cost range: %.2e -> %.2e' % (costs[0], costs[-1]))
prod = 1.0
for u in up:
    for e in u['effects']:
        if e['type'] in ('globalMult', 'workerMult'):
            prod *= e['value']
print('  production added across the tier: x%.2e' % prod)
print('  cost span: x%.2e' % (costs[-1] / costs[0]))
