#!/usr/bin/env python3
"""Emits js/content/upgrades.js — Update 2 content.

Flavor text is hand-written below; this script only handles the repetitive
formatting of tiered upgrades so the numbers stay consistent.
"""
import json, os

OUT = "/home/claude/durian-clicker/js/content/upgrades.js"
os.makedirs(os.path.dirname(OUT), exist_ok=True)

up = []          # list of dicts
def add(**kw): up.append(kw)

import re as _re
from flavor_pool import FLAVOR_POOL

# The generated families reused one line across all fourteen crew, so the same
# sentence turned up as many as 24 times. Every slot now draws its own line.
_flavor_i = [0]
def next_flavor():
    line = FLAVOR_POOL[_flavor_i[0] % len(FLAVOR_POOL)]
    _flavor_i[0] += 1
    return line

def esc(s): return s.replace("'", "\\'")

def pct(v):
    """Percentage text, rounded exactly as js/upgrades.js describeEffects() does.
    int() truncation here is what made Yoshi Ranch claim +2% while the UI
    correctly reported +2.5%."""
    # Python rounds halves to even (2.5 -> 2) while JavaScript's Math.round
    # goes half-up (2.5 -> 3), so 0.00025 printed as 0.02% while the UI showed
    # 0.03%. Match the JS behaviour.
    import math as _math
    scaled = v * 10000
    return ('%g' % (_math.floor(scaled + 0.5) / 100.0))

# ---------------------------------------------------------------- existing --
# Unchanged ids from v1. Kept here so all upgrade content lives in one file.
LEGACY = [
  dict(id='gloves', name='Better Durian Gloves', description='+1 Durian per click.',
       cost=100, icon='upgrade', effects=[dict(type='clickAdd', value=1)],
       unlock=dict(type='clicks', count=15)),
  dict(id='gloves2', name='Reinforced Gloves', description='+5 Durians per click. The spikes stop being a problem.',
       cost=1500, icon='upgrade', effects=[dict(type='clickAdd', value=5)],
       unlock=dict(type='upgrade', id='gloves')),
  dict(id='fludd_squirt', name='FLUDD Squirt Nozzle', description='Blast durians off the branch. Doubles Durians per click.',
       cost=6000, icon='upgrade', effects=[dict(type='clickMult', value=2)],
       unlock=dict(type='clicks', count=150)),
  dict(id='fludd_hover', name='Hover Nozzle', description='Each click also earns 0.33% of your Durians per second.',
       cost=60000, icon='upgrade', effects=[dict(type='clickFromDps', value=0.0033)],
       unlock=dict(type='upgrade', id='fludd_squirt')),
  dict(id='fludd_turbo', name='Turbo Nozzle', description='Each click earns a further 0.33% of your Durians per second.',
       cost=2000000, icon='upgrade', effects=[dict(type='clickFromDps', value=0.0033)],
       unlock=dict(type='upgrade', id='fludd_hover')),
  dict(id='pianta_training', name='Pianta Training', description='Piantas produce 2x as many Durians.',
       cost=500, icon='pianta', effects=[dict(type='workerMult', target='pianta', value=2)],
       unlock=dict(type='workerCount', id='pianta', count=5)),
  dict(id='pianta_festival', name='Festival Overtime', description='Piantas produce 2x as many Durians.',
       cost=9000, icon='pianta', effects=[dict(type='workerMult', target='pianta', value=2)],
       unlock=dict(type='workerCount', id='pianta', count=25)),
  dict(id='noki_logistics', name='Noki Logistics', description='Nokis produce 2x as many Durians.',
       cost=2500, icon='noki', effects=[dict(type='workerMult', target='noki', value=2)],
       unlock=dict(type='workerCount', id='noki', count=5)),
  dict(id='noki_shells', name='Bigger Shells', description='Nokis produce 2x as many Durians.',
       cost=40000, icon='noki', effects=[dict(type='workerMult', target='noki', value=2)],
       unlock=dict(type='workerCount', id='noki', count=25)),
  dict(id='yoshi_juice', name='Endless Juice', description='Yoshis produce 2x as many Durians.',
       cost=25000, icon='yoshi', effects=[dict(type='workerMult', target='yoshi', value=2)],
       unlock=dict(type='workerCount', id='yoshi', count=5)),
  dict(id='toad_brigade', name='Toad Brigade', description='Toads produce 2x as many Durians.',
       cost=300000, icon='toad', effects=[dict(type='workerMult', target='toad', value=2)],
       unlock=dict(type='workerCount', id='toad', count=5)),
  dict(id='piantissimo_shoes', name='Suspicious Running Shoes', description='Il Piantissimo produces 2x as many Durians.',
       cost=3000000, icon='piantissimo', effects=[dict(type='workerMult', target='piantissimo', value=2)],
       unlock=dict(type='workerCount', id='piantissimo', count=5)),
  dict(id='shadow_brush', name='Magic Paintbrush', description='Shadow Marios produce 2x as many Durians.',
       cost=30000000, icon='shadowmario', effects=[dict(type='workerMult', target='shadowmario', value=2)],
       unlock=dict(type='workerCount', id='shadowmario', count=5)),
  dict(id='farming', name='Durian Farming Techniques', description='All workers produce +10% Durians.',
       cost=10000, icon='shine', effects=[dict(type='globalMult', value=1.10)],
       unlock=dict(type='totalWorkers', count=20)),
  dict(id='irrigation', name='Delfino Irrigation', description='All workers produce +15% Durians.',
       cost=400000, icon='shine', effects=[dict(type='globalMult', value=1.15)],
       unlock=dict(type='totalWorkers', count=75)),
  dict(id='shine_blessing', name='Blessing of the Shine Sprites', description='All workers produce +25% Durians.',
       cost=12000000, icon='shine', effects=[dict(type='globalMult', value=1.25)],
       unlock=dict(type='totalWorkers', count=150)),
]
up.extend(LEGACY)

# ------------------------------------------------------- tiered doublers --
# (name, flavor) pairs, in ascending order of ridiculousness.
TIERS = {
 'pianta': [
  ("Sunscreen Rations", "Fewer breaks in the shade. Marginally fewer."),
  ("Bigger Baskets", "Structural engineering, applied to fruit."),
  ("Coconut Wagons", "The wheel arrives on Isle Delfino. Late, but it arrives."),
  ("Union Negotiations", "Everyone got a raise. Output went up anyway."),
  ("Leaf-Blower Harvesters", "Point it at the tree. Stand well back."),
  ("Pianta Public Radio", "Nine hours a day of durian-related programming."),
  ("Ancestral Durian Lore", "Passed down through generations. Mostly about smell."),
  ("The Chief's Personal Interest", "He has opinions now. Everyone is working harder."),
  ("Pianta Standard Time", "The island's clocks now measure output, not hours."),
  ("Manifest Durian", "It is simply understood that the fruit belongs to the Piantas."),
 ],
 'noki': [
  ("Tide Charts", "Working with the water instead of against it."),
  ("Polished Shells", "Drag coefficient down. Morale up."),
  ("Reef Highways", "Two lanes each way, coral median."),
  ("Bottled Currents", "They caught a current in a jar. Nobody questions it."),
  ("Shell Aerodynamics", "Wind tunnel tested, somehow, underwater."),
  ("Deep Trench Routes", "Shorter, darker, considerably more efficient."),
  ("Noki Elders' Wisdom", "Four hours of advice. Twelve seconds of it useful."),
  ("The Great Shell Migration", "The whole colony moves at once. So does the fruit."),
  ("Pressure-Proof Lungs", "Depth is no longer a variable."),
  ("Abyssal Logistics", "Freight routes that have never seen sunlight."),
 ],
 'yoshi': [
  ("Fruit Preference Survey", "Results inconclusive. They eat everything."),
  ("Tongue Extension Program", "Reach improved by an alarming margin."),
  ("Egg Delivery Service", "The eggs contain more durians. Do not ask."),
  ("Dismount Insurance", "Covers the Yoshi, not you."),
  ("Water-Resistant Coating", "A long-standing problem, finally addressed."),
  ("Yoshi Stampede", "Beautiful from a distance. Only from a distance."),
  ("Selective Breeding", "Bred for appetite. It worked too well."),
  ("The Yoshi Council", "They convene. Fruit appears. No minutes are kept."),
  ("Infinite Appetite", "The stomach is now a supply line."),
  ("Yoshi Singularity", "Fruit in, more fruit out. Physicists are upset."),
 ],
 'toad': [
  ("Hotel Overtime", "Their vacation ended some time ago."),
  ("Cap Storage Compartments", "Turns out there was room in there."),
  ("Chain of Command", "Someone finally put a Toad in charge of the Toads."),
  ("Mushroom Rations", "Morale-neutral. Output-positive."),
  ("Emergency Toad Reserves", "Kept in a cupboard. Deployed on request."),
  ("Toad Union Charter", "Collective bargaining, collective harvesting."),
  ("Spore Propagation", "More Toads appear. Nobody hired them."),
  ("The Toad Directorate", "It has a logo now. And a five-year plan."),
  ("Fungal Network", "They stopped talking out loud years ago."),
  ("Toad Hivemind", "One mind, ten thousand hats, all the durians."),
 ],
 'piantissimo': [
  ("Aerodynamic Mask", "The mask was always aerodynamic. Now it is officially so."),
  ("Pre-Race Stretching", "Twenty minutes. Every time. Without exception."),
  ("Head Start Policy", "He wrote the policy. He also enforces it."),
  ("Definitely Legal Supplements", "The label says so, in very small print."),
  ("Photo Finish Appeals", "He has never lost an appeal. Or filed one he lost."),
  ("Rival Intimidation", "The other racers have taken up gardening instead."),
  ("Sponsorship Deal", "His shirt is now covered in durian advertising."),
  ("The Piantissimo Invitational", "He invites himself. He wins."),
  ("Nobody Asks Questions", "About the mask. Or the voice. Or any of it."),
  ("Undefeated Champion", "The record book has one name in it, repeated."),
 ],
 'fruitlady': [
  ("Ripeness Instinct", "She can tell by the smell alone. Everyone can, but she is right."),
  ("Prime Stall Position", "Right by the fountain. Worth fighting for."),
  ("Loyal Regulars", "They queue before she opens."),
  ("Bulk Discount", "Buy nine durians, carry nine durians home, regret nothing."),
  ("The Family Recipe", "It is just a durian. She insists there is a recipe."),
  ("Market Monopoly", "Every stall in the Plaza is hers now. They were always hers."),
  ("Import Licences", "Fruit arriving from islands nobody can point to."),
  ("The Fruit Guild", "Membership is hereditary and the dues are enormous."),
  ("Wholesale Empire", "She sets the price of durians. All of them."),
  ("Matriarch of the Market", "The Plaza economy runs on her approval."),
 ],
 'mushroompianta': [
  ("Better Signage", "Hand-painted. Aggressively cheerful."),
  ("Repeat Customers", "They keep coming back. Everyone finds that normal."),
  ("Bulk Sourcing", "The mushrooms come from somewhere. He is vague about it."),
  ("Preferred Rates", "Durians only. Cash is refused without explanation."),
  ("A Second Stall", "Same Pianta. Different beach. Identical patter."),
  ("Regional Distribution", "The stalls have a supply chain now."),
  ("Vertical Integration", "He grows them, sells them and buys them back."),
  ("The Mushroom Cartel", "Prices are agreed at a meeting nobody admits attending."),
  ("Nobody Audits Him", "The paperwork is immaculate and entirely fictional."),
  ("Fungal Fortune", "He is the richest Pianta on the island. He still runs the stall."),
 ],
 'tanooki': [
  ("Convincing Bark", "You would walk past it. People do."),
  ("Deeper Roots", "It stands there for days. It is being paid by the day."),
  ("Statue Mode", "A different disguise entirely. Somehow also fruit-bearing."),
  ("Seasonal Foliage", "It changes colour on schedule. Nobody asked it to."),
  ("Orchard Camouflage", "An entire grove, and not one of them is a tree."),
  ("Leaf Multiplication", "More leaves, more fruit, same amount of Tanooki."),
  ("Transformation Mastery", "It can be two trees now. Do not think about it."),
  ("The Forest That Moves", "Counted yesterday. Counted today. Different numbers."),
  ("Botanically Impossible", "Three separate surveys have given up."),
  ("Nobody Questions the Trees", "It is simply accepted. The harvest is excellent."),
 ],
 'chuckster': [
  ("Better Footing", "The throw is only as good as the stance."),
  ("Follow Through", "Distance improved by roughly a beach."),
  ("Spotter Training", "Someone shouts where it lands. Usually in time."),
  ("Reinforced Crates", "The fruit now survives the landing. Mostly."),
  ("Long-Range Chucking", "Bay to bay, in one motion."),
  ("Chuckster Academy", "Enrolment is not voluntary and nobody leaves."),
  ("Ballistic Calculations", "They worked out the maths. It made them worse for a week."),
  ("Chain Chucking", "Chuckster to Chuckster to Chuckster to the warehouse."),
  ("Orbital Throw", "It comes down eventually. Somewhere."),
  ("CHUCKSTER", "There is nothing more to add. That is the whole thing."),
 ],
 'riccoconverter': [
  ("Calibrated Intake", "Feed it anything. It prefers not to be told what."),
  ("Wider Hopper", "Whole crates now. Crates included."),
  ("Pineapple Conversion", "The first successful trial. Nobody mentions trial one."),
  ("Coconut Throughput", "Harder shell, same result, louder noise."),
  ("Continuous Feed", "It stopped needing an operator some time ago."),
  ("Lossless Conversion", "Nothing goes in that does not come out as durian."),
  ("Overclocked Rollers", "The harbour can hear it from the far dock."),
  ("Conversion Cascade", "The output goes back in. It works. It should not."),
  ("Perfect Yield", "Every single time. Every single fruit."),
  ("It Converts Anything Now", "Please keep your hands clear of the intake."),
 ],
 'giantpiantatree': [
  ("Spring Bloom", "The whole canopy turns at once, and the village stops to watch."),
  ("Roots Into Bedrock", "It has found water nobody knew was there."),
  ("Canopy Walkways", "Harvesting from above, finally."),
  ("Village Irrigation", "Every household gives it a share of their water."),
  ("Sacred Grove Status", "Officially protected. Unofficially, heavily farmed."),
  ("Endless Spring", "The season stopped ending. Nobody has complained."),
  ("Heartwood Bounty", "The fruit grows inside the trunk now."),
  ("The Tree Remembers", "It fruits harder for villages that treat it well."),
  ("Skyward Growth", "It is above the cloud layer. It is still growing."),
  ("The World Tree", "Isle Delfino is, arguably, a thing that grows on it."),
 ],
 'coronamountain': [
  ("Widened Vent", "More room for it to come out of."),
  ("Lava Channels", "Directed downhill, into crates."),
  ("Sulphur Filtering", "The fruit tastes better. Marginally."),
  ("Pressure Tapping", "They put a valve on a volcano."),
  ("Crater Terracing", "Farmed right up to the rim."),
  ("Magma Circulation", "It never cools now. It never stops."),
  ("The Eruption Schedule", "Hourly, on the hour, entirely reliable."),
  ("Deep Chamber Access", "Down where the mountain keeps the good ones."),
  ("Continuous Vent", "It has stopped being an event and become a process."),
  ("The Mountain Obliges", "It seems, on balance, willing."),
 ],
 'piantajudge': [
  ("Preliminary Hearings", "Cleared the backlog in an afternoon."),
  ("Expedited Rulings", "He has stopped reading the submissions."),
  ("Standing Injunctions", "Permanent, island-wide, unappealable."),
  ("The Fruit Levy", "A modest percentage. Of everything."),
  ("Contempt Proceedings", "Nobody argues twice."),
  ("Summary Judgement", "The verdict arrives before the case."),
  ("The Higher Bench", "There is no higher bench. He checked."),
  ("Constitutional Amendment", "Article One is now about durians."),
  ("Judicial Supremacy", "The other branches send fruit and say nothing."),
  ("The Law Is Fruit", "It was always going to end up here."),
 ],
 'shadowmario': [
  ("Thicker Paint", "Two coats. The durians last longer."),
  ("Graffiti Tutorials", "He is teaching now. That seems bad."),
  ("Vanishing Act", "Gone before the cleanup crew arrives."),
  ("Doppelgänger Shifts", "There are several of him. There were always several."),
  ("Paint Chemistry", "The formula improved. The smell did not."),
  ("Forgery Ring", "Indistinguishable from real durians. Legally, a grey area."),
  ("The Brush Awakens", "It has started painting on its own."),
  ("Impersonation Mastery", "Someone is running the harvest. Probably not who you think."),
  ("Reality Vandalism", "The fruit was not there a moment ago."),
  ("Paint Over Everything", "The island is a canvas. The canvas is durians."),
 ],
}

# Must match CONFIG.workers baseCost — tier prices are derived from it.
WORKER_BASE = dict(pianta=20, fruitlady=60, noki=150, yoshi=1650, toad=18000,
                   mushroompianta=68000, piantissimo=195000, tanooki=720000,
                   shadowmario=2100000, riccoconverter=7000000, chuckster=24000000,
                   giantpiantatree=320000000, coronamountain=4500000000,
                   piantajudge=65000000000)
def singular(wid):
    """Display name for one of them. rstrip('s') produced 'Fruit Ladie'."""
    return WORKER_SINGULAR.get(wid, WORKER_LABEL[wid][:-1])

WORKER_SINGULAR = dict(pianta='Pianta', fruitlady='Fruit Lady', noki='Noki',
                       yoshi='Yoshi', toad='Toad', mushroompianta='Mushroom Dealer',
                       piantissimo='Il Piantissimo', tanooki='Tanooki',
                       shadowmario='Shadow Mario', riccoconverter='Ricco Converter',
                       chuckster='Chuckster', giantpiantatree='Giant Pianta Tree',
                       coronamountain='Corona Mountain', piantajudge='Pianta Judge')

WORKER_LABEL = dict(pianta='Piantas', fruitlady='Fruit Ladies', noki='Nokis',
                    yoshi='Yoshis', toad='Toads', mushroompianta='Mushroom Dealers',
                    piantissimo='Il Piantissimo', tanooki='Tanookis',
                    shadowmario='Shadow Marios', riccoconverter='Ricco Converters',
                    chuckster='Chucksters', giantpiantatree='Giant Pianta Trees',
                    coronamountain='Corona Mountains', piantajudge='Pianta Judges')
# pianta/noki already have two doublers; the others have one.
OLD_GATES = [50,100,150,200,250,300,350,400,450,500]
NEW_GATES = [25,75,125,175,225,275,325,375,425,475]
START_COUNTS = dict(pianta=OLD_GATES, noki=OLD_GATES, yoshi=OLD_GATES,
                    toad=OLD_GATES, piantissimo=OLD_GATES, shadowmario=OLD_GATES,
                    fruitlady=NEW_GATES, mushroompianta=NEW_GATES,
                    tanooki=NEW_GATES, chuckster=NEW_GATES,
                    riccoconverter=NEW_GATES, giantpiantatree=NEW_GATES,
                    coronamountain=NEW_GATES, piantajudge=NEW_GATES)
COST_MULT = [1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13]

NEW_CREW = {'fruitlady', 'mushroompianta', 'tanooki', 'chuckster',
            'riccoconverter', 'giantpiantatree', 'coronamountain', 'piantajudge'}
for wid, tiers in TIERS.items():
    for i, (nm, flavor) in enumerate(tiers):
        cost_mult = COST_MULT[i] / (300 if wid in NEW_CREW else 1)
        add(id='%s_t%d' % (wid, i + 3),
            name=nm,
            description='%s produce twice as many Durians. %s' % (WORKER_LABEL[wid], flavor),
            cost=WORKER_BASE[wid] * cost_mult,
            icon=wid,
            effects=[dict(type='workerMult', target=wid, value=2)],
            unlock=dict(type='workerCount', id=wid, count=START_COUNTS[wid][i]))

# ------------------------------------------------- self-scaling (villages) --
SCALING = [
 ('pianta_village', 'Pianta Village', 'pianta', 25, 0.01, 2.5e8,
  'A whole village collecting, and every new arrival makes the rest quicker.', 60),
 ('pianta_metropolis', 'Pianta Metropolis', 'pianta', 10, 0.01, 4e12,
  'The village grew. It has districts now, and a durian exchange.', 200),
 ('noki_colony', 'Noki Colony', 'noki', 25, 0.01, 6e8,
  'Shells stacked into towers, each one full of fruit.', 60),
 ('noki_abyss_city', 'Abyssal Reef City', 'noki', 10, 0.01, 9e12,
  'Lit by something down there that nobody has named yet.', 200),
 ('yoshi_ranch', 'Yoshi Ranch', 'yoshi', 10, 0.025, 4e9,
  'Fenced, mostly. The fence is decorative.', 60),
 ('toad_township', 'Toad Township', 'toad', 10, 0.01, 3e10,
  'Incorporated last Tuesday. Population: too many.', 60),
 ('piantissimo_league', 'The Piantissimo League', 'piantissimo', 10, 0.015, 2e11,
  'Every member wears the mask. Every member insists it is not a costume.', 60),
 ('shadow_gallery', 'The Shadow Gallery', 'shadowmario', 10, 0.02, 4e12,
  'Wing after wing of painted fruit, and none of it should exist.', 60),
 ('fruitlady_market', 'The Whole Market', 'fruitlady', 10, 0.07, 1.2e8,
  'Stall after stall, all the way round the fountain.', 60),
 ('fruitlady_dynasty', 'Fruit Dynasty', 'fruitlady', 10, 0.11, 2e12,
  'Daughters, nieces, cousins. All of them know which durians are ready.', 200),
 ('mushroom_network', 'The Dealer Network', 'mushroompianta', 10, 0.08, 8e10,
  'Every beach has one now. They wave at each other.', 60),
 ('tanooki_grove', 'The False Grove', 'tanooki', 10, 0.02, 6e11,
  'It photographs as woodland. It is entirely Tanooki.', 60),
 ('chuckster_yard', 'The Chucking Yard', 'chuckster', 10, 0.025, 9e13,
  'A cleared field, a horizon, and a great deal of shouting.', 60),
 ('ricco_refinery', 'The Harbour Refinery', 'riccoconverter', 10, 0.03, 4e13,
  'A whole dock given over to it. The smell carries for miles.', 60),
 ('tree_orchard', 'The Village Orchard', 'giantpiantatree', 10, 0.03, 2e15,
  'Saplings from the great tree, and every one of them enormous.', 60),
]
for uid, nm, target, per, val, cost, flavor, need in SCALING:
    add(id=uid, name=nm,
        description='%s gain +%s%% output for every %d you own. %s'
                    % (WORKER_LABEL[target], pct(val), per, flavor),
        cost=cost, icon=target,
        effects=[dict(type='workerScaling', target=target, per=per, value=val)],
        unlock=dict(type='workerCount', id=target, count=need))

# ------------------------------------------------------------- synergies --
SYNERGY = [
 ('syn_noki_teach', 'Neighbourly Advice', 'pianta', 'noki', 0.002, 1.5e9,
  'The Nokis explain tides. The Piantas nod and work faster.'),
 ('syn_pianta_muscle', 'Borrowed Muscle', 'noki', 'pianta', 0.002, 1.8e9,
  'Heavy lifting outsourced to the neighbours.'),
 ('syn_yoshi_ride', 'Ride Sharing', 'pianta', 'yoshi', 0.002, 8e9,
  'Every Pianta with a Yoshi covers four times the ground.'),
 ('syn_pianta_feed', 'Feeding Rotation', 'yoshi', 'all', 0.004, 9e9,
  'Someone has to keep them fed. It may as well be everyone.'),
 ('syn_noki_freight', 'Harbour Contracts', 'toad', 'noki', 0.01, 6e10,
  'The Toads book the freight. The Nokis do the swimming.'),
 ('syn_toad_pace', 'Pace Setters', 'piantissimo', 'all', 0.003, 5e11,
  'He needs someone to beat. The Toads volunteer, unwisely.'),
 ('syn_all_shadow', 'Painted Over', 'shadowmario', 'all', 0.003, 8e12,
  'The more of the island there is, the more of it he can copy.'),
 ('syn_shadow_pianta', 'Forged Work Orders', 'pianta', 'shadowmario', 0.005, 1e13,
  'The orders are fake. The overtime is real.'),
 ('syn_piantissimo_noki', 'Record Pace', 'noki', 'piantissimo', 0.005, 1.2e13,
  'Nobody wants to be the slow one in the water.'),
 ('syn_toad_yoshi', 'Saddle Supply', 'yoshi', 'all', 0.003, 4e11,
  'Toads make the saddles. Yoshis pretend to like them.'),
 ('syn_yoshi_toad', 'Fruit Tithe', 'toad', 'all', 0.003, 3e11,
  'A cut of every mouthful goes to the Toads. Somehow.'),
 ('syn_fruitlady_pianta', 'Stall Supply Run', 'fruitlady', 'pianta', 0.02, 2e9,
  'The Piantas bring it in, she sells it on. An old arrangement.'),
 ('syn_pianta_fruitlady', 'Family Discount', 'pianta', 'fruitlady', 0.006, 3e9,
  'Everyone in the Plaza is related to her somehow.'),
 ('syn_mushroom_toad', 'Awkward Overlap', 'mushroompianta', 'toad', 0.02, 9e10,
  'The Toads have opinions about the mushroom trade. He ignores them.'),
 ('syn_tanooki_yoshi', 'Mistaken Identity', 'tanooki', 'yoshi', 0.008, 7e11,
  'The Yoshis keep trying to eat the trees. Some of the trees complain.'),
 ('syn_chuckster_all', 'Everything Gets Thrown', 'chuckster', 'all', 0.003, 5e13,
  'If it can be lifted, it will be thrown. Nothing on the island is safe.'),
 ('syn_all_chuckster', 'Air Freight', 'all', 'chuckster', 0.002, 8e13,
  'Nobody carries anything by hand any more.'),
 ('syn_ricco_all', 'Everything Is Fruit', 'riccoconverter', 'all', 0.002, 6e13,
  'If it grows on the island, it ends up in the hopper.'),
 ('syn_tree_pianta', 'Village Devotion', 'giantpiantatree', 'pianta', 0.004, 4e15,
  'Every Pianta in the village tends it. The tree notices.'),
 ('syn_census', 'Island Census', 'all', 'all', 0.0002, 2e13,
  'Everyone counted, everyone accounted for, everyone working.'),
]
for uid, nm, target, source, val, cost, flavor in SYNERGY:
    tlabel = 'All workers' if target == 'all' else WORKER_LABEL[target]
    slabel = 'worker' if source == 'all' else singular(source)
    add(id=uid, name=nm,
        description='%s gain +%s%% output for each %s you own. %s'
                    % (tlabel, pct(val), slabel, flavor),
        cost=cost, icon=('shine' if target == 'all' else target),
        effects=[dict(type='workerSynergy', target=target, source=source, value=val)],
        unlock=dict(type='totalWorkers', count=120))

# ------------------------------------------------------- click upgrades --
CLICKS = [
 ('gloves3', 'Spike-Proof Gauntlets', [dict(type='clickAdd', value=50)], 5e5,
  '+50 Durians per click. The gloves have gloves.'),
 ('gloves4', 'Harvest Claws', [dict(type='clickAdd', value=500)], 2e7,
  '+500 Durians per click. Legally not a weapon.'),
 ('gloves5', 'Hydraulic Grip', [dict(type='clickAdd', value=5000)], 8e8,
  '+5,000 Durians per click. Rated for structural demolition.'),
 ('gloves6', 'The Grasping Hand', [dict(type='clickAdd', value=100000)], 1e10 / 1.5,   # lands on exactly 10B
  '+100,000 Durians per click. It closes on its own sometimes.'),
 ('fludd_rocket', 'Rocket Nozzle', [dict(type='clickMult', value=1.5)], 5e8,
  'Durians per click ×1.5. Straight up into the canopy.'),
 ('fludd_yoshi', 'Yoshi-Assisted Clicking', [dict(type='clickMult', value=1.5)], 6e10,
  'Durians per click ×1.5. He does the reaching.'),
 ('fludd_overclock', 'Overclocked FLUDD', [dict(type='clickMult', value=1.5)], 9e12,
  'Durians per click ×1.5. The warranty is extremely void.'),
 ('click_dps3', 'Pressure Washer', [dict(type='clickFromDps', value=0.0033)], 2e9,
  'Each click earns a further 0.33% of your Durians per second.'),
 ('click_dps4', 'Industrial Manifold', [dict(type='clickFromDps', value=0.0033)], 5e11,
  'Each click earns a further 0.33% of your Durians per second.'),
 ('click_dps5', 'The Whole Island At Once', [dict(type='clickFromDps', value=0.0033)], 8e14,
  'Each click earns a further 0.33% of your Durians per second.'),
 ('click_crew1', 'Supervised Clicking', [dict(type='clickFromWorkers', value=10)], 1e9,
  '+10 Durians per click for every worker you employ.'),
 ('click_crew2', 'Everybody Helps', [dict(type='clickFromWorkers', value=250)], 3e11,
  '+250 Durians per click for every worker you employ.'),
 ('click_crew3', 'The Island Clicks With You', [dict(type='clickFromWorkers', value=10000)], 6e14,
  '+10,000 Durians per click for every worker you employ.'),
 ('click_callus', 'Legendary Calluses', [dict(type='clickMult', value=1.5)], 2e14,
  'Durians per click ×1.5. Your hands are a geological feature.'),
 ('click_myth', 'The Shine Touch', [dict(type='clickMult', value=2)], 8e15,
  'Doubles Durians per click. Everything you touch ripens.'),
]
for i, (uid, nm, fx, cost, desc) in enumerate(CLICKS):
    add(id=uid, name=nm, description=desc, cost=cost, icon='upgrade',
        effects=fx, unlock=dict(type='clicks', count=300 + i * 200))

# --------------------------------------------------- world-themed globals --
WORLDS = [
 ('world_plaza', 'Delfino Plaza Cleanup', 1.15, 6e7, 'shine',
  'Scrub the goop off the fountain and the whole island works better.'),
 ('world_bianco', 'Bianco Hills Windmill', 1.15, 3e8, 'shine',
  'It grinds durians now. It was never supposed to grind durians.'),
 ('world_ricco', 'Ricco Harbour Cranes', 1.20, 1.5e9, 'shine',
  'Industrial fruit handling, finally.'),
 ('world_gelato', 'Le Sandbird is Born', 1.20, 8e9, 'shine',
  'It woke up. It seems fine with the arrangement.'),
 ('world_pinna', 'Pinna Park Rides', 1.25, 4e10, 'shine',
  'The rollercoaster doubles as a conveyor belt.'),
 ('world_sirena', 'Sirena Beach Renovation', 1.25, 2e11, 'shine',
  'The hotel reopens. The staffing situation remains unclear.'),
 ('world_noki_bay', 'Noki Bay Purification', 1.30, 1e12, 'shine',
  'Clean water at last. The fruit tastes worse and sells better.'),
 ('world_pianta_village', 'Pianta Village Canopy', 1.30, 5e12, 'shine',
  'Above the clouds, where the biggest durians grow.'),
 ('world_corona', 'Corona Mountain', 2.00, 3e13, 'shine',
  'The volcano is just spewing durians now. Nobody can explain it. Nobody is complaining.'),
 ('world_airstrip', 'Delfino Airstrip Exports', 1.35, 2e14, 'shine',
  'Wheels up, hold full, smell detectable at altitude.'),
 ('world_plaza2', 'Plaza Grand Festival', 1.20, 8e14, 'shine',
  'Annual. Mandatory. Extremely productive.'),
 ('world_bianco2', 'Bianco Terraces', 1.25, 3e15, 'shine',
  'Every hillside, every slope, every square inch under fruit.'),
 ('world_ricco2', 'Harbour Superport', 1.25, 1e16, 'shine',
  'Ships arrive empty and leave sitting worryingly low.'),
 ('world_gelato2', 'Gelato Reef Farms', 1.30, 5e16, 'shine',
  'Underwater orchards. The coral has opinions.'),
 ('world_pinna2', 'Pinna Park Expansion', 1.30, 2e17, 'shine',
  'A second park, built entirely to process the first park.'),
 ('world_sirena2', 'Sirena Grand Resort', 1.35, 9e17, 'shine',
  'Five stars. The reviews mention the smell. The reviews are positive.'),
 ('world_noki2', 'Noki Deep Cultivation', 1.35, 4e18, 'shine',
  'Trenches planted to a depth nobody has surveyed.'),
 ('world_village2', 'The Great Canopy', 1.40, 2e19, 'shine',
  'The treetops have merged into one continuous orchard.'),
 ('world_corona2', 'Corona Eruption', 2.50, 4e18, 'shine',
  'It erupted. It rained durians for nine days. The island got richer.'),
 ('world_delfino', 'All of Isle Delfino', 1.50, 1e19, 'shine',
  'Every district, every beach, every last inhabitant. Working.'),
]
for uid, nm, mult, cost, icon, flavor in WORLDS:
    add(id=uid, name=nm,
        description='All workers produce +%s%% Durians. %s' % (pct(mult - 1), flavor),
        cost=cost, icon=icon,
        effects=[dict(type='globalMult', value=mult)],
        unlock=dict(type='totalEarned', amount=cost * 0.6))

# ------------------------------------------------- achievement synergies --
# Halved in Update 13. These stacked to +384% per achievement, which at 158
# achievements was a x608 global multiplier that kept growing every time you
# earned a Shine — the single biggest driver of the production runaway.
ACH_SYN = [
 ('shine_hoard1', 'Shine Sprite Hoard', 0.005, 5e9, 'you have earned'),
 ('shine_hoard2', 'Shine Gallery', 0.01, 8e11, 'earned'),
 ('shine_hoard3', 'Shine Vault', 0.015, 5e13, 'earned'),
 ('shine_hoard4', 'Shine Constellation', 0.025, 4e15, 'earned'),
 ('shine_hoard5', 'The Shine Throne', 0.04, 2e17, 'earned'),
 ('shine_hoard6', 'Sunlight Itself', 0.06, 2e18, 'earned'),
]
for i, (uid, nm, val, cost, phrase) in enumerate(ACH_SYN):
    desc = ('Each Shine %s adds %s+%s%% to all production.'
            % (phrase, '' if i == 0 else 'a further ', pct(val)))
    add(id=uid, name=nm, description=desc, cost=cost, icon='shine',
        effects=[dict(type='achievementBonus', value=val)],
        unlock=dict(type='achievementCount', count=18 + i * 6))

# --------------------------------------------------------- event upgrades --
EVENTS_UP = [
 ('luck_charm', 'Rusty Lucky Charm', [dict(type='eventChance', value=1.25)], 2e9,
  'Island events happen 25% more often.'),
 ('luck_charm2', 'Polished Lucky Charm', [dict(type='eventChance', value=1.25)], 4e11,
  'Island events happen a further 25% more often.'),
 ('luck_charm3', 'Blessed Lucky Charm', [dict(type='eventChance', value=1.5)], 6e13,
  'Island events happen 50% more often again.'),
 ('boo_bargain', "King Boo's Bargain", [dict(type='eventGain', value=2)], 1e10,
  'Good island events pay out twice as much.'),
 ('boo_bargain2', 'A Deal in Writing', [dict(type='eventGain', value=2)], 8e12,
  'Good island events pay out twice as much again.'),
 ('hotel_haggling', 'Hotel Haggling', [dict(type='eventLoss', value=0.5)], 5e9,
  'Bad island events cost you half as much, and bad buffs wear off twice as fast.'),
 ('hotel_lawyer', 'A Very Good Lawyer', [dict(type='eventLoss', value=0.4)], 2e12,
  'Bad island events cost 60% less and bad buffs fade faster. She is worth every Durian.'),
 ('hotel_insurance', 'Sirena Beach Insurance', [dict(type='eventLoss', value=0.3)], 9e14,
  'Bad island events cost 70% less and bad buffs barely last. The premiums are absurd.'),
 ('buff_bottle', 'Bottled Sunshine', [dict(type='buffDuration', value=1.5)], 3e10,
  'Good island buffs last 50% longer.'),
 ('buff_bottle2', 'Sunlight Preserve', [dict(type='buffDuration', value=2)], 5e13,
  'Good island buffs last twice as long again.'),
]
for i, (uid, nm, fx, cost, desc) in enumerate(EVENTS_UP):
    add(id=uid, name=nm, description=desc, cost=cost, icon='shine',
        effects=fx, unlock=dict(type='eventsSeen', count=3 + i * 4))

# -------------------------------------------------------- offline upgrades --
OFFLINE_UP = [
 ('offline1', 'Night Shift', 0.05, None, 4e8, 'Workers produce 5% more while you are away.'),
 ('offline2', 'Double Shift', 0.05, None, 6e10, 'A further 5% more while you are away.'),
 ('offline3', 'They Never Stop', 0.08, None, 2e13, 'A further 8% more while you are away.'),
 ('offline_time1', 'Longer Leave', None, 12, 3e9, 'Offline earnings now accumulate for up to 36 hours.'),
 ('offline_time2', 'Extended Leave', None, 36, 1e12, 'Offline earnings now accumulate for up to 72 hours.'),
 ('offline_time3', 'Indefinite Sabbatical', None, 96, 4e14, 'Offline earnings now accumulate for up to a week.'),
]
for i, (uid, nm, eff, hours, cost, desc) in enumerate(OFFLINE_UP):
    fx = ([dict(type='offlineEfficiency', value=eff)] if eff
          else [dict(type='offlineHours', value=hours)])
    add(id=uid, name=nm, description=desc, cost=cost, icon='upgrade',
        effects=fx, unlock=dict(type='totalEarned', amount=cost * 0.5))

# --------------------------------------------------------------- finishers --
FINISH = [
 ('grand1', 'Durian Standard', 1.5, 2e19, 'The island currency is now fruit. It was always going to be fruit.'),
 ('grand2', 'Continental Shipping', 1.5, 1.5e20, 'Other islands have heard. Other islands are afraid.'),
 ('grand3', 'The Smell Reaches Space', 1.75, 1e21, 'Satellites have reported it. Nobody is investigating.'),
 ('grand4', 'Orbital Orchard', 2.0, 8e21, 'Fruit in low Delfino orbit. It seemed like the next step.'),
 ('grand5', 'Durian Singularity', 2.5, 6e22, 'Production now exceeds the island\u2019s ability to describe it.'),
 ('grand6', 'The Fruit Age', 3.0, 5e23, 'Historians will call it that. Historians will also be harvesting.'),
]
for uid, nm, mult, cost, flavor in FINISH:
    add(id=uid, name=nm,
        description='All workers produce %sx as many Durians. %s' % (('%g' % mult), flavor),
        cost=cost, icon='shine',
        effects=[dict(type='globalMult', value=mult)],
        unlock=dict(type='totalEarned', amount=cost * 0.5))

# ------------------------------- early-worker late-game rescue (7 more) --
# Piantas and Nokis fall off hard once the big earners arrive. These scale off
# the LATE workers, so your starting crew stays relevant to the very end.
RESCUE = [
 ('rescue_pianta1', 'Pianta Pride', 'pianta', 'shadowmario', 0.01, 5e13,
  'They refuse to be outdone by a fake.'),
 ('rescue_pianta2', 'The First Harvesters', 'pianta', 'all', 0.002, 2e15,
  'They were here first and everyone knows it.'),
 ('rescue_noki1', 'Noki Deep Contracts', 'noki', 'piantissimo', 0.01, 8e13,
  'Somebody has to fish him out.'),
 ('rescue_noki2', 'The Old Currents', 'noki', 'all', 0.002, 3e15,
  'Every route on Delfino was theirs first.'),
 ('rescue_starters', 'Founding Crew', 'pianta', 'noki', 0.005, 4e16,
  'The original two, still carrying the island.'),
 ('rescue_starters2', 'Founding Crew II', 'noki', 'pianta', 0.005, 4e16,
  'The arrangement is mutual and slightly competitive.'),
 ('rescue_legacy', 'Nobody Forgets', 'all', 'pianta', 0.001, 6e16,
  'The island runs on their example.'),
]
for uid, nm, target, source, val, cost, flavor in RESCUE:
    tlabel = 'All workers' if target == 'all' else WORKER_LABEL[target]
    slabel = 'worker' if source == 'all' else singular(source)
    desc = '%s gain +%s%% output for each %s you own. %s' % (tlabel, pct(val), slabel, flavor)
    add(id=uid, name=nm, description=desc, cost=cost,
        icon=('shine' if target == 'all' else target),
        effects=[dict(type='workerSynergy', target=target, source=source, value=val)],
        unlock=dict(type='totalEarned', amount=cost * 0.5))

# ==========================================================================
# UPDATE 6 — 200 more upgrades.
# Deliberately weighted toward small, frequent gains rather than more doublers:
# a wall of x2s inflates the curve, while +3% and +8% steps give you something
# to buy every few minutes without breaking anything.
# ==========================================================================

ALL_CREW = ['pianta','fruitlady','noki','yoshi','toad','mushroompianta',
            'piantissimo','tanooki','shadowmario','riccoconverter',
            'chuckster','giantpiantatree','coronamountain','piantajudge']

# -- 48: four more doubling tiers each, gated on counts you can actually reach
LATE_TIER_NAMES = ['Second Wind', 'Deep Bench', 'Generational Knowledge', 'Peak Practice']
LATE_TIER_FLAVOR = [
  'They found another gear nobody knew about.',
  'There is always someone else ready to step in.',
  'Nobody remembers being taught. Everybody knows.',
  'This is as good as it gets, and it keeps getting better.',
]
LATE_GATES = [550, 600, 650, 700]
# These sit between the t3-t12 ladder (base x 1e13 at the top) and the deep
# tier. The old values were divided by 1e13, which made 48 upgrades gated at
# 550-700 crew cost a few hundred thousand Durians — effectively free.
LATE_COSTS = [1e14, 3e15, 1e17, 3e18]
for wid in ALL_CREW:
    for i in range(4):
        add(id='%s_late%d' % (wid, i + 1),
            name='%s: %s' % (singular(wid), LATE_TIER_NAMES[i]),
            description='%s produce twice as many Durians. %s'
                        % (WORKER_LABEL[wid], next_flavor()),
            cost=WORKER_BASE[wid] * LATE_COSTS[i],
            icon=wid,
            effects=[dict(type='workerMult', target=wid, value=2)],
            unlock=dict(type='workerCount', id=wid, count=LATE_GATES[i]))

# -- 48: small per-worker bumps. Cheap, frequent, satisfying.
SMALL_NAMES = ['Sharper Tools', 'Shift Handover', 'Better Boots', 'Morning Briefing']
SMALL_FLAVOR = [
  'A small edge, applied constantly.',
  'Ten minutes of overlap, and nothing gets dropped.',
  'Grip matters more than anyone expected.',
  'Five minutes, every day, and it adds up.',
]
SMALL_VALUES = [1.15, 1.15, 1.2, 1.2]
SMALL_GATES = [15, 60, 120, 300]
SMALL_COSTS = [200, 1e4, 1e7, 1e11]
for wid in ALL_CREW:
    for i in range(4):
        add(id='%s_small%d' % (wid, i + 1),
            name='%s: %s' % (singular(wid), SMALL_NAMES[i]),
            description='%s produce +%d%% Durians. %s'
                        % (WORKER_LABEL[wid], round((SMALL_VALUES[i] - 1) * 100), next_flavor()),
            cost=WORKER_BASE[wid] * SMALL_COSTS[i],
            icon=wid,
            effects=[dict(type='workerMult', target=wid, value=SMALL_VALUES[i])],
            unlock=dict(type='workerCount', id=wid, count=SMALL_GATES[i]))

# -- 30: small island-wide bumps spread right across the price range
ISLAND_SMALL = [
 ('Tidy Verges', 1.02, 'Somebody trimmed the paths. Everything moves quicker.'),
 ('Shared Wheelbarrows', 1.02, 'One pool, properly maintained.'),
 ('Morning Ferry', 1.03, 'Everyone arrives at once instead of trickling in.'),
 ('Signposted Groves', 1.03, 'Fewer wrong turns, more fruit.'),
 ('Water Stations', 1.03, 'Nobody walks back to the plaza for a drink now.'),
 ('Shade Canopies', 1.04, 'The afternoon stopped being a write-off.'),
 ('Rope Bridges', 1.04, 'The gorge is no longer an argument.'),
 ('Numbered Crates', 1.04, 'Inventory took one afternoon and saved a month.'),
 ('Weather Bulletins', 1.05, 'Painted on a board by the fountain, updated hourly.'),
 ('Shift Rotations', 1.05, 'Nobody is doing the bad job forever.'),
 ('Sharpening Rota', 1.05, 'Dull tools, it turns out, were most of the problem.'),
 ('Harbour Timetable', 1.06, 'The boats and the pickers finally agree on a clock.'),
 ('Apprentice Scheme', 1.06, 'The new arrivals stop being useless within a week.'),
 ('Standard Baskets', 1.06, 'One size. One stack. One less argument.'),
 ('Night Lanterns', 1.07, 'The grove works after dark now, cheerfully.'),
 ('Cart Suspension', 1.07, 'Less fruit arrives as paste.'),
 ('Fruit Grading', 1.07, 'The good ones go out, the rest go to the Yoshis.'),
 ('Plaza Notice Board', 1.08, 'Coordination, achieved with a plank and some chalk.'),
 ('Regional Depots', 1.08, 'Nobody hauls anything across the whole island any more.'),
 ('Preservation Sheds', 1.08, 'The harvest stops being a race against rot.'),
 ('Cable Lifts', 1.09, 'Straight up the cliff, full crates, no complaints.'),
 ('Delfino Postal Route', 1.09, 'Orders arrive before the fruit spoils.'),
 ('Standardised Contracts', 1.10, 'Everyone is paid the same and works accordingly.'),
 ('Island Almanac', 1.10, 'Three centuries of harvest data, finally written down.'),
 ('Deepwater Moorings', 1.11, 'The big ships come to the island now.'),
 ('Automated Sorting', 1.11, 'It hums. Nobody has opened it.'),
 ('Weather Control (Informal)', 1.04, 'A Pianta claims credit. Nobody can disprove it.'),
 ('Continental Logistics', 1.04, 'Other islands run on the Delfino timetable now.'),
 ('The Grand Harvest Accord', 1.045, 'Every settlement, one signature, one enormous harvest.'),
 ('Isle Delfino, Incorporated', 1.055, 'It is a fruit company that happens to have beaches.'),
]
BASE_ISLAND_COST = 4e6
for i, (nm, mult, flavor) in enumerate(ISLAND_SMALL):
    cost = BASE_ISLAND_COST * (7.0 ** i)
    add(id='island_%02d' % (i + 1), name=nm,
        description='All workers produce +%s%% Durians. %s' % (pct(mult - 1), flavor),
        cost=cost, icon='shine',
        effects=[dict(type='globalMult', value=mult)],
        unlock=dict(type='totalEarned', amount=cost * 0.5))

# -- 24: more cross-crew synergies, small per-unit but they compound
SYN2 = [
 ('fruitlady','noki',0.002,'Stallside Deliveries','Straight from the water to the counter.'),
 ('noki','fruitlady',0.002,'Guaranteed Buyer','No haggling at the dock any more.'),
 ('yoshi','fruitlady',0.003,'Free Samples','She feeds them. They stay.'),
 ('toad','pianta',0.002,'Local Hires','The Toads stopped importing everything.'),
 ('mushroompianta','pianta',0.002,'The Cousins Rate','Everyone is a cousin somehow.'),
 ('piantissimo','yoshi',0.004,'Pace Rival','He refuses to be outrun by a dinosaur.'),
 ('tanooki','toad',0.004,'Mistaken for Furniture','The Toads keep leaning on them.'),
 ('shadowmario','tanooki',0.005,'Two Kinds of Fake','They compare notes. It is unsettling.'),
 ('riccoconverter','noki',0.004,'Harbour Feedstock','The Nokis keep the hopper full.'),
 ('riccoconverter','yoshi',0.006,'Pre-Chewed Input','Do not think about this one.'),
 ('chuckster','tanooki',0.006,'Throwing Practice','The trees do not consent, exactly.'),
 ('chuckster','piantissimo',0.008,'Distance Rivalry','Two records, one very long beach.'),
 ('giantpiantatree','fruitlady',0.006,'Market Roots','Her stall sits in its shade.'),
 ('giantpiantatree','mushroompianta',0.008,'Canopy Mycology','Something is growing up there.'),
 ('pianta','giantpiantatree',0.01,'Village Heart','The tree is why the village exists.'),
 ('noki','riccoconverter',0.008,'Refinery Shares','Every Noki owns a piece of it.'),
 ('yoshi','giantpiantatree',0.012,'The Best Fruit','They will not eat anything else now.'),
 ('toad','chuckster',0.006,'Air Mail','Nothing is delivered on foot.'),
 ('mushroompianta','riccoconverter',0.006,'Convenient Arrangement','Neither will explain it.'),
 ('piantissimo','chuckster',0.008,'Launched Start','Technically still a race.'),
 ('tanooki','giantpiantatree',0.015,'Learning From the Best','They study its bark for hours.'),
 ('shadowmario','riccoconverter',0.006,'Counterfeit Feedstock','The machine cannot tell. Nobody can.'),
 ('all','giantpiantatree',0.004,'In Its Shade','The whole island works better beneath it.'),
 ('all','riccoconverter',0.003,'Everything Converts','If it is fruit, it becomes durian.'),
]
for i, (target, source, val, nm, flavor) in enumerate(SYN2):
    tlabel = 'All workers' if target == 'all' else WORKER_LABEL[target]
    slabel = 'worker' if source == 'all' else singular(source)
    add(id='syn2_%02d' % (i + 1), name=nm,
        description='%s gain +%s%% output for each %s you own. %s'
                    % (tlabel, pct(val), slabel, flavor),
        cost=2e10 * (5.0 ** (i / 2.0)),
        icon=('shine' if target == 'all' else target),
        effects=[dict(type='workerSynergy', target=target, source=source, value=val)],
        unlock=dict(type='totalWorkers', count=200 + i * 25))

# -- 20 click upgrades, mostly modest
CLICK2 = [
 ('Callus Cream', dict(type='clickAdd', value=2e4), 'Counterintuitive, but it works.'),
 ('Two-Handed Technique', dict(type='clickMult', value=1.1), 'Twice the hands, slightly more than twice the fruit.'),
 ('Wrist Braces', dict(type='clickAdd', value=2e5), 'Medically advisable at this point.'),
 ('Percussive Harvesting', dict(type='clickMult', value=1.1), 'You hit it. Fruit comes off. Science.'),
 ('Reinforced Knuckles', dict(type='clickAdd', value=2e6), 'The spikes gave up first.'),
 ('Follow-Through Training', dict(type='clickMult', value=1.1), 'It is all in the hips, apparently.'),
 ('Grip Chalk', dict(type='clickAdd', value=2e7), 'Borrowed from the Chucksters.'),
 ('Ambidextrous Drills', dict(type='clickMult', value=1.1), 'Both hands, equally destructive.'),
 ('Shockwave Gloves', dict(type='clickAdd', value=2e8), 'The tree feels it three groves over.'),
 ('Kinetic Recovery', dict(type='clickFromDps', value=0.0015), 'Each click also earns 0.15% of your Durians per second.'),
 ('Harvest Rhythm', dict(type='clickFromDps', value=0.0015), 'Each click earns a further 0.15% of your Durians per second.'),
 ('Crowd Assist', dict(type='clickFromWorkers', value=5e4), '+50,000 Durians per click for every worker you employ.'),
 ('Everyone Swings', dict(type='clickFromWorkers', value=1e6), '+1,000,000 Durians per click for every worker you employ.'),
 ('Titanium Palms', dict(type='clickAdd', value=2e10), 'You have stopped noticing the spikes entirely.'),
 ('Perfect Form', dict(type='clickMult', value=1.15), 'A Noki elder watched once and simply nodded.'),
 ('Seismic Tap', dict(type='clickAdd', value=2e12), 'Registered on instruments in Ricco Harbour.'),
 ('Muscle Memory', dict(type='clickMult', value=1.15), 'Your hands do it while you think about lunch.'),
 ('The Long Reach', dict(type='clickFromWorkers', value=5e7), '+50,000,000 Durians per click for every worker you employ.'),
 ('Harvest Trance', dict(type='clickFromDps', value=0.002), 'Each click earns a further 0.2% of your Durians per second.'),
 ('One With The Fruit', dict(type='clickMult', value=1.2), 'You and the durian have reached an understanding.'),
]
for i, (nm, fx, desc) in enumerate(CLICK2):
    if fx['type'] == 'clickAdd':
        desc_full = '+%s Durians per click. %s' % ('{:,}'.format(int(fx['value'])), desc)
    elif fx['type'] == 'clickMult':
        desc_full = 'Durians per click x%s. %s' % (('%g' % fx['value']), desc)
    else:
        desc_full = desc
    add(id='click2_%02d' % (i + 1), name=nm, description=desc_full,
        cost=5e8 * (6.0 ** (i / 1.6)), icon='upgrade',
        effects=[fx], unlock=dict(type='clicks', count=800 + i * 400))

# -- 12 casino and Blue Coin upgrades
CASINO2 = [
 ('Loaded Dice (Allegedly)', dict(type='eventGain', value=1.5), 'Good island events pay 50% more.'),
 ('Comped Drinks', dict(type='eventLoss', value=0.8), 'Bad island events cost 20% less.'),
 ('Coin Magnet', dict(type='eventChance', value=1.2), 'Island events happen 20% more often.'),
 ('Polished Lenses', dict(type='eventChance', value=1.2), 'Island events happen a further 20% more often.'),
 ('House Membership', dict(type='eventGain', value=1.5), 'Good island events pay a further 50% more.'),
 ('Frequent Flyer', dict(type='eventChance', value=1.25), 'Island events happen 25% more often again.'),
 ('Complimentary Suite', dict(type='eventLoss', value=0.8), 'Bad island events cost a further 20% less.'),
 ('Lucky Streak', dict(type='eventGain', value=1.5), 'Good island events pay 50% more again.'),
 ('Longer Sunshine', dict(type='buffDuration', value=1.3), 'Good island buffs last 30% longer.'),
 ('Bottled Daylight', dict(type='buffDuration', value=1.3), 'Good island buffs last a further 30% longer.'),
 ('Whale Treatment', dict(type='eventGain', value=2), 'Good island events pay twice as much.'),
 ('The Managers Know You', dict(type='eventLoss', value=0.7), 'Bad island events cost 30% less again.'),
]
for i, (nm, fx, desc) in enumerate(CASINO2):
    add(id='casino2_%02d' % (i + 1), name=nm, description=desc,
        cost=3e11 * (4.0 ** (i / 1.5)), icon='shine',
        effects=[fx], unlock=dict(type='eventsSeen', count=40 + i * 15))

# -- 8 offline
OFFLINE2 = [
 ('Overnight Rota', 0.06, None, 'Workers produce 6% more while you are away.'),
 ('Dawn Patrol', 0.07, None, 'A further 7% more while you are away.'),
 ('The Island Never Sleeps', 0.09, None, 'A further 9% more while you are away.'),
 ('Perpetual Harvest', 0.10, None, 'A further 10% more while you are away.'),
 ('Long Weekend', None, 168, 'Offline earnings now accumulate for up to 14 days.'),
 ('Extended Sabbatical', None, 168, 'Offline earnings now accumulate for up to 21 days.'),
 ('Gone Fishing', None, 168, 'Offline earnings now accumulate for up to 28 days.'),
 ('Absentee Landlord', None, 504, 'Offline earnings now accumulate for up to 49 days.'),
]
for i, (nm, eff, hours, desc) in enumerate(OFFLINE2):
    fx = (dict(type='offlineEfficiency', value=eff) if eff
          else dict(type='offlineHours', value=hours))
    cost = 8e11 * (9.0 ** i)
    add(id='offline2_%d' % (i + 1), name=nm, description=desc,
        cost=cost, icon='upgrade', effects=[fx],
        unlock=dict(type='totalEarned', amount=cost * 0.5))

# -- 6 achievement scaling
for i, (nm, val, flavor) in enumerate([
 ('Shine Reliquary', 0.02, 'A room built specifically to hold them.'),
 ('Shine Observatory', 0.03, 'They are catalogued now, and studied.'),
 ('Shine Cartography', 0.04, 'Somebody mapped where each one was found.'),
 ('Shine Doctrine', 0.05, 'There are rules about them. Written ones.'),
 ('Shine Ascendancy', 0.07, 'The island orients itself around the collection.'),
 ('All The Light There Is', 0.10, 'You have quite a lot of them now.'),
]):
    cost = 2e14 * (12.0 ** i)
    add(id='shine_late%d' % (i + 1), name=nm,
        description='Each Shine earned adds a further +%s%% to all production. %s' % (pct(val), flavor),
        cost=cost, icon='shine',
        effects=[dict(type='achievementBonus', value=val)],
        unlock=dict(type='achievementCount', count=60 + i * 12))

# -- 4 finales
for i, (nm, mult, flavor) in enumerate([
 ('The Delfino Standard', 2.0, 'Other islands index their currency against fruit now.'),
 ('Archipelago Holdings', 2.5, 'You own several islands. They all grow durians.'),
 ('The Long Harvest', 3.0, 'It has been going for generations. It will not stop.'),
 ('Everything Is Durians', 4.0, 'Look around. Really look.'),
]):
    cost = 5e24 * (60.0 ** i)
    add(id='finale%d' % (i + 1), name=nm,
        description='All workers produce %sx as many Durians. %s' % (('%g' % mult), flavor),
        cost=cost, icon='shine',
        effects=[dict(type='globalMult', value=mult)],
        unlock=dict(type='totalEarned', amount=cost * 0.5))

# ==========================================================================
# UPDATE 12 — 100 late-game upgrades.
# Everything here sits above the previous ceiling (about 2e31) and behind
# worker counts past 700, so it only opens up once the earlier content is
# genuinely exhausted.
# ==========================================================================

DEEP_BASE = 4e28          # first new upgrade sits just above the old top

# -- 36: three more doubling tiers per worker, gated at 750 / 875 / 1000
DEEP_TIER_NAMES = ['Institutional Memory', 'The Standing Order', 'Written Into The Rock']
DEEP_TIER_FLAVOR = [
  'Nobody alive remembers starting. The work simply continues.',
  'It does not need approving any more. It just happens.',
  'Carved above the plaza arch. Nobody dares revise it.',
]
DEEP_GATES = [560, 625, 690]
for wid in ALL_CREW:
    for i in range(3):
        add(id='%s_deep%d' % (wid, i + 1),
            name='%s: %s' % (singular(wid), DEEP_TIER_NAMES[i]),
            description='%s produce twice as many Durians. %s'
                        % (WORKER_LABEL[wid], next_flavor()),
            cost=DEEP_BASE * (10 ** i) * (1 + ALL_CREW.index(wid) * 0.35),
            icon=wid,
            effects=[dict(type='workerMult', target=wid, value=2)],
            unlock=dict(type='workerCount', id=wid, count=DEEP_GATES[i]))

# -- 12: one heavy self-scaling upgrade per worker, for very large crews
DEEP_SCALE_NAMES = {
 'pianta': ('Pianta Continuum', 'Every one of them makes the next one quicker.'),
 'fruitlady': ('The Market Itself', 'She is not a person any more. She is the economy.'),
 'noki': ('Abyssal Consensus', 'One decision, ten thousand shells.'),
 'yoshi': ('Herd Intelligence', 'They coordinate. Nobody taught them.'),
 'toad': ('Total Mycelium', 'The Toads have stopped being individuals about it.'),
 'mushroompianta': ('The Whole Supply', 'Every stall on every beach reports to one ledger.'),
 'piantissimo': ('Field Of Masks', 'They arrive in formation. It is unsettling.'),
 'tanooki': ('Indistinguishable Forest', 'Surveyors have stopped filing reports.'),
 'shadowmario': ('Paint Over Reality', 'The copies are producing copies now.'),
 'riccoconverter': ('The Great Hopper', 'It has an appetite and a schedule.'),
 'chuckster': ('Ballistic Doctrine', 'Everything on this island is in flight.'),
 'giantpiantatree': ('Roots Under Everything', 'The whole island is one organism now.'),
 'coronamountain': ('The Mountain Itself', 'Every eruption makes the next one bigger.'),
 'piantajudge': ('Precedent', 'Each ruling makes the next one easier to hand down.'),
}
for i, wid in enumerate(ALL_CREW):
    nm, flavor = DEEP_SCALE_NAMES[wid]
    add(id='%s_deepscale' % wid, name=nm,
        description='%s gain +%s%% output for every %d you own. %s'
                    % (WORKER_LABEL[wid], pct(0.05), 10, flavor),
        cost=DEEP_BASE * 25 * (1 + i * 0.5), icon=wid,
        effects=[dict(type='workerScaling', target=wid, per=10, value=0.05)],
        unlock=dict(type='workerCount', id=wid, count=590))

# -- 20: escalating island-wide multipliers, the real late-game spine
DEEP_GLOBAL = [
 ('Delfino Reforestation', 1.5, 'Every cleared hillside planted back, twice as dense.'),
 ('The Second Harvest', 1.6, 'A whole extra season that nobody can account for.'),
 ('Tidal Irrigation', 1.7, 'The sea does the watering now, on schedule.'),
 ('Volcanic Fertiliser', 1.8, 'Corona gives back what it takes, in ash.'),
 ('Perpetual Spring', 2.0, 'The island stopped having other seasons.'),
 ('Deep Root Networks', 2.2, 'Every tree on Delfino is talking to every other tree.'),
 ('Sunlight Concentration', 2.4, 'Somebody aimed it. Nobody will say who.'),
 ('The Fruiting Bloom', 2.6, 'It happened once. It has not stopped happening.'),
 ('Orbital Mirrors', 3.0, 'Daylight is a scheduling decision now.'),
 ('Atmospheric Cultivation', 3.2, 'The clouds are part of the orchard.'),
 ('Gravitic Harvesting', 3.5, 'The fruit comes to you. Downhill, in every direction.'),
 ('Seabed Groves', 3.8, 'Miles of them, lit by something nobody has named.'),
 ('The Endless Terrace', 4.0, 'It goes round the island and meets itself.'),
 ('Continental Grafting', 4.5, 'Other landmasses have been made compatible.'),
 ('Stellar Ripening', 5.0, 'Timed to a star. A specific one.'),
 ('The Durian Latitude', 5.5, 'A band around the world where only this grows.'),
 ('Planetary Orchard', 6.0, 'Every suitable surface. All of them.'),
 ('The Fruiting Age', 7.0, 'Historians will need a new epoch for this.'),
 ('Beyond Agriculture', 8.0, 'It has stopped resembling farming in any respect.'),
 ('The Final Harvest', 10.0, 'There is nothing left to plant. It grows anyway.'),
]
for i, (nm, mult, flavor) in enumerate(DEEP_GLOBAL):
    cost = DEEP_BASE * 3 * (4.2 ** i)
    add(id='deep_global%02d' % (i + 1), name=nm,
        description='All workers produce %sx as many Durians. %s' % (('%g' % mult), flavor),
        cost=cost, icon='shine',
        effects=[dict(type='globalMult', value=mult)],
        unlock=dict(type='totalEarned', amount=cost * 0.6))

# -- 12: deep synergies, larger per-unit than anything earlier
DEEP_SYN = [
 ('all','giantpiantatree',0.01,'Everything Grows From It','The tree is the reason for all of it.'),
 ('all','chuckster',0.008,'Nothing Walks','Every item on Delfino arrives by air.'),
 ('all','riccoconverter',0.008,'Total Conversion','If it is organic, it is already durian.'),
 ('giantpiantatree','all',0.004,'Fed By The Island','Every worker tends it, knowingly or not.'),
 ('pianta','giantpiantatree',0.02,'The Old Covenant','Piantas and that tree, since before records.'),
 ('noki','giantpiantatree',0.02,'Roots To The Water','It drinks from the bay. The Nokis approve.'),
 ('chuckster','giantpiantatree',0.025,'Something To Throw','Its fruit is the perfect weight, apparently.'),
 ('riccoconverter','giantpiantatree',0.025,'Premium Feedstock','The machine has developed preferences.'),
 ('shadowmario','giantpiantatree',0.02,'Worth Copying','He has been painting it for weeks.'),
 ('tanooki','giantpiantatree',0.03,'Aspirational','They are all trying to become it.'),
 ('fruitlady','chuckster',0.015,'Airborne Delivery','Her stock arrives at terminal velocity.'),
 ('all','all',0.0008,'One Island, One Harvest','Everyone counted, everyone compounding.'),
]
for i, (target, source, val, nm, flavor) in enumerate(DEEP_SYN):
    tlabel = 'All workers' if target == 'all' else WORKER_LABEL[target]
    slabel = 'worker' if source == 'all' else singular(source)
    add(id='deepsyn%02d' % (i + 1), name=nm,
        description='%s gain +%s%% output for each %s you own. %s'
                    % (tlabel, pct(val), slabel, flavor),
        cost=DEEP_BASE * 8 * (3.6 ** i),
        icon=('shine' if target == 'all' else target),
        effects=[dict(type='workerSynergy', target=target, source=source, value=val)],
        unlock=dict(type='totalWorkers', count=900 + i * 120))

# -- 8: late click work
DEEP_CLICK = [
 ('Tectonic Knuckles', dict(type='clickMult', value=2), 'The island moves slightly when you connect.'),
 ('Harvest Instinct', dict(type='clickMult', value=1.25), 'You stopped aiming some time ago.'),
 ('Every Hand On Delfino', dict(type='clickFromWorkers', value=2e9), '+2,000,000,000 Durians per click for every worker you employ.'),
 ('The Practised Strike', dict(type='clickMult', value=1.25), 'One motion. Decades of it.'),
 ('Resonant Impact', dict(type='clickFromDps', value=0.002), 'Each click earns a further 0.2% of your Durians per second.'),
 ('Palms Of The Island', dict(type='clickMult', value=2), 'Geologists have asked you to stop.'),
 ('Perfect Contact', dict(type='clickMult', value=1.3), 'The fruit was going to fall anyway. You just agreed on when.'),
 ('The Last Word In Clicking', dict(type='clickFromWorkers', value=5e11), '+500,000,000,000 Durians per click for every worker you employ.'),
]
for i, (nm, fx, desc) in enumerate(DEEP_CLICK):
    if fx['type'] == 'clickAdd':
        full = '+%s Durians per click. %s' % ('{:,}'.format(int(fx['value'])), desc)
    elif fx['type'] == 'clickMult':
        full = 'Durians per click x%s. %s' % (('%g' % fx['value']), desc)
    else:
        full = desc
    add(id='deepclick%d' % (i + 1), name=nm, description=full,
        cost=DEEP_BASE * 5 * (5.5 ** i), icon='upgrade',
        effects=[fx], unlock=dict(type='clicks', count=20000 + i * 15000))

# -- 6: deep achievement scaling
for i, (nm, val, flavor) in enumerate([
 ('Shine Custodianship', 0.10, 'You are responsible for them now. Formally.'),
 ('The Shine Index', 0.12, 'Production is quoted against your collection.'),
 ('Shine Sovereignty', 0.15, 'They answer to you. That is not a metaphor.'),
 ('The Radiant Ledger', 0.18, 'Every one accounted for, every one working.'),
 ('Light Itself Is Yours', 0.22, 'The island is bright because you collected it.'),
 ('The Whole Constellation', 0.28, 'There is nothing left in the sky you do not own.'),
]):
    cost = DEEP_BASE * 20 * (7.0 ** i)
    add(id='shine_deep%d' % (i + 1), name=nm,
        description='Each Shine earned adds a further +%s%% to all production. %s' % (pct(val), flavor),
        cost=cost, icon='shine',
        effects=[dict(type='achievementBonus', value=val)],
        unlock=dict(type='achievementCount', count=130 + i * 12))

# -- 6: late offline and island-event work
DEEP_MISC = [
 ('The Island Runs Itself', dict(type='offlineEfficiency', value=0.14),
  'Workers produce 14% more while you are away.'),
 ('Nobody Needs Watching', dict(type='offlineEfficiency', value=0.16),
  'A further 16% more while you are away.'),
 ('Generational Absence', dict(type='offlineHours', value=1176),
  'Offline earnings now accumulate for up to 98 days.'),
 ('Fortune Favours You', dict(type='eventGain', value=2.5),
  'Good island events pay 2.5x as much.'),
 ('Nothing Bad Happens Here', dict(type='eventLoss', value=0.5),
  'Bad island events cost half as much again.'),
 ('Permanent Sunshine', dict(type='buffDuration', value=2),
  'Good island buffs last twice as long again.'),
]
for i, (nm, fx, desc) in enumerate(DEEP_MISC):
    cost = DEEP_BASE * 12 * (6.0 ** i)
    add(id='deepmisc%d' % (i + 1), name=nm, description=desc,
        cost=cost, icon='upgrade', effects=[fx],
        unlock=dict(type='totalEarned', amount=cost * 0.5))

# -------------------------------------------------- Fruit Lady catch-up --
# She sat on 27 support upgrades where Piantas and Nokis had 35 and 34, and
# each missing doubler is a halving — which is why she was contributing
# essentially nothing at scale. These close the gap rather than papering over
# it with a base-production bump.
FRUITLADY_FIX = [
 ('fl_extra1', 'Dawn Selection', 700, 2, None,
  'She is at the grove before the pickers are.'),
]
for uid, nm, cost, mult, _x, flavor in FRUITLADY_FIX:
    add(id=uid, name=nm,
        description='Fruit Ladies produce twice as many Durians. %s' % flavor,
        cost=cost, icon='fruitlady',
        effects=[dict(type='workerMult', target='fruitlady', value=mult)],
        unlock=dict(type='workerCount', id='fruitlady', count=20))

FRUITLADY_SYN = [
 ('fl_syn1', 'Known To Everyone', 'fruitlady', 'all', 0.0025, 8e11,
  'She has sold fruit to every single one of them.'),
 ('fl_syn2', 'The Fountain Concession', 'fruitlady', 'giantpiantatree', 0.02, 6e15,
  'Her pitch sits in the tree\'s shade, by ancient arrangement.'),
]
for uid, nm, target, source, val, cost, flavor in FRUITLADY_SYN:
    slabel = 'worker' if source == 'all' else singular(source)
    add(id=uid, name=nm,
        description='Fruit Ladies gain +%s%% output for each %s you own. %s'
                    % (pct(val), slabel, flavor),
        cost=cost, icon='fruitlady',
        effects=[dict(type='workerSynergy', target=target, source=source, value=val)],
        unlock=dict(type='workerCount', id='fruitlady', count=60))


# ------------------------------------------------- weak-crew catch-up --
# Toads, Mushroom Dealers and Tanookis were sitting at 1.1%, 0.4% and 1.0% of
# output — six to sixteen times worse value per Durian than a Pianta. These
# close the gap; the rest of the roster needs no help.
CATCHUP_CREW = {
 'toad': [('Brigade Doctrine', 'Somebody finally wrote down what they do all day.'),
          ('The Toad Standard', 'Every cap, every crate, identical and interchangeable.')],
 'tanooki': [('Perfected Bark', 'Indistinguishable, even up close, even to a Yoshi.'),
             ('The Long Stillness', 'They have stopped needing to move at all.'),
             ('Rooted In Law', 'Legally trees. The paperwork went through unopposed.')],
 'piantissimo': [('Sanctioned Advantage', 'The rules were reviewed. They now favour him.'),
                 ('Whole League Of Him', 'Every mask, every time, first across every line.')],
 'mushroompianta': [('Wholesale Reform', 'The stalls merged. The prices did not.'),
                    ('Regulatory Capture', 'He wrote the rules. They favour him.'),
                    ('The Spore Exchange', 'Traded in volumes nobody will disclose.'),
                    ('Nobody Asks Twice', 'The stall has outlasted three separate inquiries.')],
}
CATCHUP_COSTS = [4e9, 2e14, 9e19, 5e24]
for wid, entries in CATCHUP_CREW.items():
    for i, (nm, flavor) in enumerate(entries):
        add(id='%s_catch%d' % (wid, i + 1),
            name='%s: %s' % (singular(wid), nm),
            description='%s produce twice as many Durians. %s' % (WORKER_LABEL[wid], flavor),
            cost=WORKER_BASE[wid] * CATCHUP_COSTS[i] / 1e4,
            icon=wid,
            effects=[dict(type='workerMult', target=wid, value=2)],
            unlock=dict(type='workerCount', id=wid, count=40 + i * 90))


# ==========================================================================
# UPDATE 13 - the Beyond tier, 140 upgrades.
#
# The catalogue topped out at 1.3e41 while a real player had earned 1.5e49:
# the most expensive upgrade in the game cost them ten MICROSECONDS of
# production. Everything here is priced from 1e47 upward.
#
# The shape matters more than the ceiling. Costs rise 1.6x per step while the
# multipliers granted are small (x1.25 to x1.5), so across the tier production
# grows about 1e15 while cost grows 1e28. The gap widens as you go, which is
# what stops it being swallowed in an afternoon.
# ==========================================================================

BEYOND_BASE = 1e47
BEYOND_STEP = 1.6
_beyond_slot = [0]

def next_slot():
    c = BEYOND_BASE * (BEYOND_STEP ** _beyond_slot[0])
    _beyond_slot[0] += 1
    return c

BEYOND_GLOBAL = [
 ('Horizon Cultivation', 'The line where the sea meets the trees, planted.'),
 ('The Salt Terraces', 'Salt-tolerant, finally.'),
 ('Cloudroot Grafting', 'Grafted onto the weather itself.'),
 ('Tidewalker Groves', 'They follow the tide out and come back laden.'),
 ('The Sunken Orchard', 'It was a bay. It is now an orchard.'),
 ('Stormfed Irrigation', 'The storms are on the roster.'),
 ('The Basalt Nurseries', 'Volcanic rock, it turns out, grows excellent fruit.'),
 ('Deepvent Blooms', 'Nothing down there should bloom. It blooms.'),
 ('The Coral Canopy', 'The reef agreed to the arrangement.'),
 ('Monsoon Scheduling', 'Rain arrives when the ledger says so.'),
 ('The Glass Greenhouses', 'Acres under glass, and none of it necessary.'),
 ('Aurora Ripening', 'Ripened by light nobody can account for.'),
 ('The Trench Plantations', 'Pressure-grown, at depth, in the dark.'),
 ('Continental Drift Farming', 'The plates move. The orchard moves with them.'),
 ('The Mantle Orchard', 'Roots into rock that is still molten.'),
 ('Geothermal Bloom', 'Heat from below, fruit from above.'),
 ('The Long Meridian', 'A line of orchard right round the world.'),
 ('Equatorial Saturation', 'The whole belt, under fruit.'),
 ('The Thousand Isles', 'Every island. Every single one.'),
 ('Oceanic Husbandry', 'The sea is livestock now.'),
 ('The Drowned Groves', 'Beautiful, from a boat, at the right angle.'),
 ('Skyfarm Anchorage', 'Tethered, and productive.'),
 ('The Stratosphere Yield', 'Thin air. Thick harvest.'),
 ('Exospheric Cultivars', 'Bred for vacuum. Successfully.'),
 ('The Lagrange Orchard', 'Parked where the gravity cancels out.'),
 ('Selenic Grafting', 'The moon took to it immediately.'),
 ('The Tidal Lock Harvest', 'One face always ripening.'),
 ('Heliotropic Doctrine', 'Everything turns to face the light. Everything.'),
 ('The Solar Terraces', 'Terraced, on the star.'),
 ('Coronal Cultivation', 'It should not work. It does.'),
 ('The Photosphere Yield', 'Harvested off the surface of a sun.'),
 ('Stellar Husbandry', 'Stars, farmed.'),
 ('The Nebula Nurseries', 'Grown where stars are made.'),
 ('Interstellar Grafting', 'Cuttings, sent very far indeed.'),
 ('The Void Orchard', 'It grows in nothing. Out of nothing.'),
 ('Galactic Saturation', 'The arm of the galaxy, under cultivation.'),
 ('The Local Group Harvest', 'The neighbours have been annexed, agriculturally.'),
 ('Cosmological Cultivation', 'The largest structure is now an orchard.'),
 ('The Observable Yield', 'Everything we can see is fruiting.'),
 ('Everything, Fruiting', 'Look up. Look anywhere.'),
]
for i, (nm, flavor) in enumerate(BEYOND_GLOBAL):
    mult = round(1.25 + (i // 10) * 0.05, 3)
    cost = next_slot()
    add(id='beyond_g%02d' % (i + 1), name=nm,
        description='All workers produce +%s%% Durians. %s' % (pct(mult - 1), flavor),
        cost=cost, icon='shine',
        effects=[dict(type='globalMult', value=mult)],
        unlock=dict(type='totalEarned', amount=cost * 0.6))

BEYOND_CREW = [
 ('Beyond Counting', 'There is no ledger large enough any more.'),
 ('Past All Reckoning', 'They stopped filing returns some centuries ago.'),
 ('The Unbroken Shift', 'It has not paused. It will not pause.'),
 ('No Longer Measured', 'The output is simply assumed.'),
]
for wid in ALL_CREW:
    for i, (nm, flavor) in enumerate(BEYOND_CREW):
        cost = next_slot()
        add(id='%s_beyond%d' % (wid, i + 1),
            name='%s: %s' % (singular(wid), nm),
            description='%s produce +50%% Durians. %s' % (WORKER_LABEL[wid], next_flavor()),
            cost=cost, icon=wid,
            effects=[dict(type='workerMult', target=wid, value=1.5)],
            unlock=dict(type='totalEarned', amount=cost * 0.6))

BEYOND_SYN = [
 ('all','giantpiantatree',0.002,'Everything In Its Shade'),
 ('all','chuckster',0.002,'Nothing Touches The Ground'),
 ('all','riccoconverter',0.002,'All Is Feedstock'),
 ('all','pianta',0.0015,'The First Crew, Still'),
 ('all','noki',0.0015,'The Old Routes, Still'),
 ('all','fruitlady',0.0015,'The Market, Still'),
 ('giantpiantatree','all',0.001,'Fed By Everything'),
 ('chuckster','all',0.001,'Everything Gets Thrown Eventually'),
 ('riccoconverter','all',0.001,'The Hopper Never Closes'),
 ('pianta','all',0.001,'They Were Always Here'),
 ('noki','all',0.001,'They Knew The Way'),
 ('fruitlady','all',0.001,'She Knew The Price'),
 ('yoshi','all',0.001,'Still Hungry'),
 ('toad','all',0.001,'Still On Shift'),
 ('tanooki','all',0.001,'Still Pretending'),
 ('shadowmario','all',0.001,'Still Copying'),
]
for i, (target, source, val, nm) in enumerate(BEYOND_SYN):
    cost = next_slot()
    tlabel = 'All workers' if target == 'all' else WORKER_LABEL[target]
    slabel = 'worker' if source == 'all' else singular(source)
    add(id='beyond_syn%02d' % (i + 1), name=nm,
        description='%s gain +%s%% output for each %s you own. '
                    '%s'
                    % (tlabel, pct(val), slabel, next_flavor()),
        cost=cost, icon=('shine' if target == 'all' else target),
        effects=[dict(type='workerSynergy', target=target, source=source, value=val)],
        unlock=dict(type='totalEarned', amount=cost * 0.6))

for i, (nm, val) in enumerate([
 ('The Quiet Collection', 0.02), ('The Deep Archive', 0.02), ('The Long Catalogue', 0.03),
 ('Every Shine Accounted For', 0.03), ('The Complete Record', 0.04),
 ('Nothing Left To Find', 0.04), ('The Last Shine', 0.05), ('And Still More Light', 0.05),
]):
    cost = next_slot()
    add(id='beyond_shine%d' % (i + 1), name=nm,
        description='Each Shine earned adds a further +%s%% to all production. '
                    'The collection has outgrown the island.' % pct(val),
        cost=cost, icon='shine',
        effects=[dict(type='achievementBonus', value=val)],
        unlock=dict(type='achievementCount', count=150 + i * 6))

for i, (nm, flavor) in enumerate([
 ('Hands Beyond Counting', 'You stopped noticing the motion a long time ago.'),
 ('The Reflexive Harvest', 'It happens whether you decide to or not.'),
 ('Contact Without Effort', 'The fruit meets you halfway.'),
 ('The Habitual Strike', 'A century of practice, give or take.'),
 ('Nothing But Follow-Through', 'The swing began some time ago and has not ended.'),
 ('The Final Gesture', 'One motion. Everything falls.'),
]):
    cost = next_slot()
    add(id='beyond_click%d' % (i + 1), name=nm,
        description='Durians per click x1.5. %s' % flavor,
        cost=cost, icon='upgrade',
        effects=[dict(type='clickMult', value=1.5)],
        unlock=dict(type='totalEarned', amount=cost * 0.6))


# ==========================================================================
# UPDATE 14 — Corona Mountain and the Pianta Judge.
# Each gets 50 dedicated upgrades on top of the 26 they pick up from the
# shared families, for 76 apiece. Weighted small on purpose: 8 doublers, and
# the rest percentage bumps, scaling and synergies, so two new crew do not
# blow up a curve that took five rounds to settle.
# ==========================================================================

ENDGAME_CREW = {
 'coronamountain': {
   'small': [
     ('Ash Mulching', 1.04, 'The soil around it is absurdly good.'),
     ('Vent Insulation', 1.04, 'Less heat wasted, more fruit out.'),
     ('Crater Netting', 1.045, 'Catches what would otherwise land in the sea.'),
     ('Thermal Ducting', 1.045, 'Warmth piped to the lower groves.'),
     ('Obsidian Chutes', 1.05, 'Frictionless. Slightly terrifying.'),
     ('Seismic Timing', 1.05, 'They know when to hold out the baskets.'),
     ('Basalt Scaffolds', 1.055, 'Built on the slope, out of the slope.'),
     ('Gas Scrubbers', 1.055, 'The crews can breathe up there now.'),
     ('Caldera Terraces', 1.06, 'Farmed inside the crater, which seems unwise.'),
     ('Pressure Regulation', 1.06, 'It erupts to a schedule and a quota.'),
     ('Magma Grafting', 1.065, 'Something is growing in the melt.'),
     ('The Warm Season', 1.065, 'It is always the warm season now.'),
   ],
   'scale': [
     ('Chain Eruption', 20, 0.008, 'Each mountain sets off the next.'),
     ('Volcanic Chorus', 20, 0.008, 'They have started erupting in time with each other.'),
     ('The Ring Of Fruit', 15, 0.01, 'A circle of them around the island.'),
   ],
   'syn': [
     ('giantpiantatree', 0.002, 'Ash And Roots', 'The tree drinks what the mountain spits.'),
     ('riccoconverter', 0.0016, 'Molten Feedstock', 'It arrives pre-heated.'),
     ('chuckster', 0.0016, 'Ballistic Assistance', 'The mountain does the throwing.'),
     ('all', 0.00025, 'Everything Runs Warm', 'The whole island is a degree warmer and busier.'),
     ('pianta', 0.0012, 'Old Neighbours', 'They have lived beside it for generations.'),
     ('tanooki', 0.0012, 'Heat-Shaped Bark', 'They have adapted. Alarmingly well.'),
   ],
   'big': [
     ('Constant Eruption', 'It does not stop. It is not going to stop.'),
     ('The Second Crater', 'It opened overnight. Production doubled.'),
     ('Mantle Tap', 'Straight down, as far as anyone dares.'),
     ('The Mountain Is Awake', 'Everyone agrees it is watching.'),
   ],
 },
 'piantajudge': {
   'small': [
     ('Docket Reform', 1.04, 'Cases now take minutes.'),
     ('Sworn Assessors', 1.04, 'They agree with him, under oath.'),
     ('Fruit Bonds', 1.045, 'Bail, posted in durians.'),
     ('Statutory Tariffs', 1.045, 'Written down, so nobody can argue.'),
     ('The Public Register', 1.05, 'Everyone owes something. It is all listed.'),
     ('Compulsory Arbitration', 1.05, 'You may attend. It will not help.'),
     ('Circuit Sittings', 1.055, 'He travels. The levy travels with him.'),
     ('Retroactive Rulings', 1.055, 'You owed it last year too, it turns out.'),
     ('The Permanent Order', 1.06, 'Nobody remembers it being made.'),
     ('Sealed Proceedings', 1.06, 'The reasoning is not published.'),
     ('Emergency Powers', 1.065, 'The emergency is ongoing and undefined.'),
     ('The Final Appeal', 1.065, 'Heard by him. Dismissed by him.'),
   ],
   'scale': [
     ('Full Bench', 25, 0.004, 'More judges, more rulings, more fruit.'),
     ('The Supreme Panel', 25, 0.004, 'They rule as one, which is convenient.'),
     ('Judicial Dynasty', 20, 0.005, 'The robes are hereditary now.'),
   ],
   'syn': [
     ('all', 0.00025, 'Everyone Pays', 'A levy on every worker on the island.'),
     ('pianta', 0.0014, 'The Local Levy', 'Taxed hardest, complaining least.'),
     ('fruitlady', 0.0014, 'Market Duties', 'A cut of every sale at the fountain.'),
     ('mushroompianta', 0.0018, 'Licensing Fees', 'Suddenly the stall needs a permit.'),
     ('coronamountain', 0.0028, 'Mineral Rights', 'He has ruled that the mountain is his.'),
     ('giantpiantatree', 0.002, 'Protected Status', 'Protected, and taxed, and protected.'),
   ],
   'big': [
     ('The Fruit Court', 'A whole building, one subject.'),
     ('Universal Jurisdiction', 'Other islands have received summonses.'),
     ('The Judge Rules Everything', 'Weather included. It complied.'),
     ('Nearly Unlimited', 'The word "nearly" is doing a lot of work.'),
   ],
 },
}

ENDGAME_SMALL_COSTS = [3e10, 2e12, 9e13, 4e15, 2e17, 8e18, 3e20, 1e22,
                       6e23, 2e25, 9e26, 4e28]
ENDGAME_SCALE_COSTS = [8e14, 5e19, 3e26]
ENDGAME_SYN_COSTS = [2e16, 1e18, 7e19, 4e21, 2e24, 1e27]
ENDGAME_BIG_COSTS = [5e21, 3e25, 2e29, 1e33]
ENDGAME_GATES = [12, 30, 60, 100, 150, 200, 260, 320, 380, 440, 500, 560]

for wid, data in ENDGAME_CREW.items():
    scale = WORKER_BASE[wid] / 4.5e9          # Judge costs ~14x the Mountain

    for i, (nm, mult, flavor) in enumerate(data['small']):
        add(id='%s_e%02d' % (wid, i + 1),
            name='%s: %s' % (singular(wid), nm),
            description='%s produce +%s%% Durians. %s'
                        % (WORKER_LABEL[wid], pct(mult - 1), flavor),
            cost=ENDGAME_SMALL_COSTS[i] * scale, icon=wid,
            effects=[dict(type='workerMult', target=wid, value=mult)],
            unlock=dict(type='workerCount', id=wid, count=ENDGAME_GATES[i]))

    for i, (nm, per, val, flavor) in enumerate(data['scale']):
        add(id='%s_escale%d' % (wid, i + 1), name=nm,
            description='%s gain +%s%% output for every %d you own. %s'
                        % (WORKER_LABEL[wid], pct(val), per, flavor),
            cost=ENDGAME_SCALE_COSTS[i] * scale, icon=wid,
            effects=[dict(type='workerScaling', target=wid, per=per, value=val)],
            unlock=dict(type='workerCount', id=wid, count=40 + i * 80))

    for i, (source, val, nm, flavor) in enumerate(data['syn']):
        slabel = 'worker' if source == 'all' else singular(source)
        add(id='%s_esyn%d' % (wid, i + 1), name=nm,
            description='%s gain +%s%% output for each %s you own. %s'
                        % (WORKER_LABEL[wid], pct(val), slabel, flavor),
            cost=ENDGAME_SYN_COSTS[i] * scale, icon=wid,
            effects=[dict(type='workerSynergy', target=wid, source=source, value=val)],
            unlock=dict(type='workerCount', id=wid, count=25 + i * 55))

    for i, (nm, flavor) in enumerate(data['big']):
        # NOT doublers: four x2s here put these two crew 16x ahead of the
        # entire rest of the roster. Sizeable percentage steps instead.
        big_mult = [1.30, 1.35, 1.40, 1.45][i]
        add(id='%s_ebig%d' % (wid, i + 1),
            name='%s: %s' % (singular(wid), nm),
            description='%s produce +%s%% Durians. %s'
                        % (WORKER_LABEL[wid], pct(big_mult - 1), flavor),
            cost=ENDGAME_BIG_COSTS[i] * scale, icon=wid,
            effects=[dict(type='workerMult', target=wid, value=big_mult)],
            unlock=dict(type='workerCount', id=wid, count=80 + i * 130))

    # a handful of island-wide steps themed to each, so they are not purely
    # self-serving purchases
    for i in range(24):
        mult = 1.015 + (i // 8) * 0.01
        cost = (6e13 * (5.5 ** i)) * scale
        theme = ('Eruption Dividend', 'Ashfall Fertility', 'Thermal Economy') if wid == 'coronamountain' \
                else ('Judicial Dividend', 'The Fruit Statute', 'Levy Economy')
        add(id='%s_eglobal%02d' % (wid, i + 1),
            name='%s %d' % (theme[i % 3], (i // 3) + 1),
            description='All workers produce +%s%% Durians. %s'
                        % (pct(mult - 1), next_flavor()),
            cost=cost, icon=wid,
            effects=[dict(type='globalMult', value=round(mult, 3))],
            unlock=dict(type='workerCount', id=wid, count=15 + i * 28))






# --------------------------------------------- achievement scaling nerf --
# Halved (again). These are multiplied by your achievement count, and by the
# nonillion band a player has enough Shines that the term dominates everything
# else. Descriptions are rebuilt from the value so the text follows.
for _u in up:
    for _e in _u['effects']:
        if _e['type'] != 'achievementBonus':
            continue
        _old = _e['value']
        _e['value'] = round(_old * 0.5, 5)
        _u['description'] = _u['description'].replace(
            '+' + pct(_old) + '%', '+' + pct(_e['value']) + '%')

# --------------------------------------------- split the huge multipliers --
# A single upgrade granting +300% to every worker quadrupled production in one
# purchase. Anything above +75% is broken into a sequence with the same total
# power, spread across rising costs.
MAX_SINGLE_GLOBAL = 1.75
ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII']

_split_extra = []
for _u in up:
    for _e in _u['effects']:
        if _e['type'] != 'globalMult' or _e['value'] <= MAX_SINGLE_GLOBAL:
            continue
        total = _e['value']
        k = 1
        while total ** (1.0 / k) > MAX_SINGLE_GLOBAL and k < 8:
            k += 1
        part = total ** (1.0 / k)
        _e['value'] = round(part, 4)
        _u['description'] = _re.sub(r'produce \+[\d.]+% Durians',
                                    'produce +%s%% Durians' % pct(part - 1),
                                    _u['description'])
        _u['description'] = _re.sub(r'produce [\d.]+x as many Durians',
                                    'produce +%s%% Durians' % pct(part - 1),
                                    _u['description'])
        for i in range(1, k):
            _split_extra.append(dict(
                id='%s_p%d' % (_u['id'], i + 1),
                name=_u['name'] + ROMAN[i],
                description=_u['description'],
                cost=_u['cost'] * (2.4 ** i),
                icon=_u['icon'],
                effects=[dict(type='globalMult', value=round(part, 4))],
                unlock=(dict(type='totalEarned',
                             amount=_u['unlock'].get('amount', _u['cost'] * 0.5) * (2.4 ** i))
                        if _u['unlock'].get('type') == 'totalEarned'
                        else dict(_u['unlock']))))
up.extend(_split_extra)


# ------------------------------------------------- synergy parity pass --
# Each synergy multiplies a worker by (1 + value x source count), and endgame
# crews run past a thousand, so a worker with ten synergies ends up thousands
# of times ahead of one with three. Top every crew up to the same number.
SYNERGY_TARGET = 7

_syn_count = {}
for _u in up:
    for _e in _u['effects']:
        if _e['type'] == 'workerSynergy' and _e['target'] in WORKER_BASE:
            _syn_count[_e['target']] = _syn_count.get(_e['target'], 0) + 1

PARITY_NAMES = [
 ('Shared Rosters', 'Nobody works a shift alone any more.'),
 ('Common Storehouse', 'One roof, everyone\'s crates.'),
 ('The Island Rota', 'Pinned by the fountain, followed religiously.'),
 ('Borrowed Hands', 'Whoever is free, wherever they are needed.'),
 ('Standard Practice', 'Everyone does it the same way now.'),
 ('The Long Handover', 'Knowledge passed on without anyone noticing.'),
 ('Mutual Aid', 'They cover for each other, and it shows.'),
 ('One Harvest', 'It stopped being separate operations some time ago.'),
]
PARITY_COSTS = [4e12, 9e15, 2e19, 5e22, 1e26, 3e29, 8e32, 2e36]

for _wid in ALL_CREW:
    need = max(0, SYNERGY_TARGET - _syn_count.get(_wid, 0))
    for i in range(need):
        nm = PARITY_NAMES[i % len(PARITY_NAMES)][0]
        add(id='%s_par%d' % (_wid, i + 1),
            name='%s: %s' % (singular(_wid), nm),
            description='%s gain +%s%% output for each worker you own. %s'
                        % (WORKER_LABEL[_wid], pct(0.00018), next_flavor()),
            cost=PARITY_COSTS[i % len(PARITY_COSTS)] * (WORKER_BASE[_wid] / 20.0) ** 0.35,
            icon=_wid,
            effects=[dict(type='workerSynergy', target=_wid, source='all', value=0.00018)],
            unlock=dict(type='totalWorkers', count=150 + i * 90))


# ------------------------------------------------- click share balancing --
# Click power is gear PLUS a share of production, and the ratio a full build
# reaches IS the clickFromDps sum. Spread the target across every share
# upgrade, weighted so later ones feel bigger, and rewrite the wording from the
# stored value so text and effect cannot drift.
TARGET_CLICK_SHARE = 1.0 / 3.0

# These six multiply the flat gear part only, so they say "gear bonus" rather
# than claiming to multiply the whole click.
KEEP_AS_MULT = {'fludd_squirt', 'fludd_rocket', 'fludd_yoshi', 'click_callus',
                'click_myth', 'deepclick2'}

# They scale the flat gear part of a click, not the production share, so
# "Doubles Durians per click" stopped being true once production took over.
GEAR_WORDING = [
 ('Doubles Durians per click.', 'Doubles your per-click gear bonus.'),
 ('Durians per click \u00d71.5.', 'Per-click gear bonus \u00d71.5.'),
 ('Durians per click x1.25.', 'Per-click gear bonus x1.25.'),
]
for _u in up:
    if _u['id'] not in KEEP_AS_MULT:
        continue
    for _a, _b in GEAR_WORDING:
        _u['description'] = _u['description'].replace(_a, _b)
for _u in up:
    for _e in _u['effects']:
        if _e['type'] == 'clickMult' and _u['id'] not in KEEP_AS_MULT:
            _e['type'] = 'clickFromDps'
            _e['value'] = 0.01                      # rebalanced just below
            _u['description'] = _re.sub(
                r'(Durians per click [x\u00d7][\d.]+|Doubles Durians per click|'
                r'Triples Durians per click)\.?',
                'Each click earns 0% of your Durians per second.',
                _u['description'])

_share_ups = [u for u in up if any(e['type'] == 'clickFromDps' for e in u['effects'])]
_share_ups.sort(key=lambda u: u['cost'])
if _share_ups:
    _n = len(_share_ups)
    _weights = [0.6 + 0.9 * (i / max(1, _n - 1)) for i in range(_n)]
    _total_w = sum(_weights)
    for _u, _wgt in zip(_share_ups, _weights):
        share = TARGET_CLICK_SHARE * _wgt / _total_w
        stored = round(round(share * 10000) / 10000.0, 5)
        for _e in _u['effects']:
            if _e['type'] == 'clickFromDps':
                _e['value'] = stored
        _u['description'] = _re.sub(r'[\d.]+% of your Durians per second',
                                    pct(stored) + '% of your Durians per second',
                                    _u['description'])
    _got = sum(e['value'] for u in _share_ups for e in u['effects']
               if e['type'] == 'clickFromDps')
    print('click share: %.3f of DPS across %d upgrades' % (_got, _n))


# ------------------------------------------------------------------ emit --
ICON_MAP = {
  'upgrade': "assets/placeholder-upgrade.png",
  'shine': "assets/placeholder-shine.png",
  'pianta': "assets/placeholder-pianta.png",
  'noki': "assets/placeholder-noki.png",
  'yoshi': "assets/placeholder-yoshi.png",
  'toad': "assets/placeholder-toad.png",
  'piantissimo': "assets/placeholder-piantissimo.png",
  'shadowmario': "assets/placeholder-shadowmario.png",
  'fruitlady': "assets/placeholder-fruitlady.png",
  'mushroompianta': "assets/placeholder-mushroompianta.png",
  'tanooki': "assets/placeholder-tanooki.png",
  'chuckster': "assets/placeholder-chuckster.png",
  'riccoconverter': "assets/placeholder-riccoconverter.png",
  'giantpiantatree': "assets/placeholder-giantpiantatree.png",
  'coronamountain': "assets/placeholder-coronamountain.png",
  'piantajudge': "assets/placeholder-piantajudge.png",
}

UPGRADE_COST_SCALE = 1.5      # Update 3: slight across-the-board nerf

for _u in up:
    if _u['id'] not in ('gloves', 'gloves2', 'fludd_squirt'):   # leave the opening beats alone
        _u['cost'] = _u['cost'] * UPGRADE_COST_SCALE
        if _u['unlock'].get('type') == 'totalEarned':
            _u['unlock'] = dict(_u['unlock'], amount=_u['unlock']['amount'] * UPGRADE_COST_SCALE)

def num(v):
    if isinstance(v, float) and v == int(v) and abs(v) < 1e15:
        return str(int(v))
    return repr(v)

# =============================================================================
# LATE-GAME BRAKE
# -----------------------------------------------------------------------------
# Everything up to about a nonillion (1e30) paces well. Past that the game ran
# away: 1e30 arrived at 4.4 days and 1e50 only five days later, because the
# upgrades above that line stack a combined x1e55 on production and each one
# pays for the next almost immediately.
#
# This pass scales back the effects of upgrades priced at or above the brake
# point, ramping harder the further past it they sit, so the curve keeps
# climbing without folding in on itself. Descriptions are rewritten from the
# adjusted numbers further down, so they stay honest.
#
# Tune with BRAKE_* below and re-run; `node balance.js 90` reports the pacing.
BRAKE_FROM = 1e30            # where the brake starts to bite
BRAKE_GLOBAL = 0.36          # kept share of a global multiplier's bonus
BRAKE_WORKER = 0.52          # kept share of a single worker's multiplier
BRAKE_ACH = 0.36             # kept share of achievement-scaling bonuses
BRAKE_SYN = 0.52             # kept share of synergy and self-scaling values
BRAKE_DECADE = 0.905          # extra squeeze per order of magnitude past the point

def _brake_factor(cost, keep):
    """Keep-share for one upgrade, tightening the further past the brake it is."""
    import math
    decades = max(0.0, math.log10(max(cost, 1.0)) - math.log10(BRAKE_FROM))
    return keep * (BRAKE_DECADE ** decades)

for _u in up:
    _cost = _u.get('cost') or 0
    if _cost < BRAKE_FROM:
        continue
    for _e in _u.get('effects', []):
        _t = _e.get('type')
        if _t == 'globalMult':
            _e['value'] = round(1 + (_e['value'] - 1) * _brake_factor(_cost, BRAKE_GLOBAL), 6)
        elif _t == 'workerMult':
            _e['value'] = round(1 + (_e['value'] - 1) * _brake_factor(_cost, BRAKE_WORKER), 6)
        elif _t == 'achievementBonus':
            _e['value'] = round(_e['value'] * _brake_factor(_cost, BRAKE_ACH), 8)
        elif _t in ('workerSynergy', 'workerScaling'):
            _e['value'] = round(_e['value'] * _brake_factor(_cost, BRAKE_SYN), 8)

# -----------------------------------------------------------------------------
# The brake changed the numbers, so the sentences describing them have to be
# rewritten or every nerfed upgrade advertises its old strength. Only the
# leading claim is replaced; the flavour after it is kept.
def _restate(u):
    fx = u.get('effects') or []
    if len(fx) != 1:
        return
    e = fx[0]
    t, v = e.get('type'), e.get('value')
    desc = u.get('description', '')
    # split the mechanical first sentence from the flavour that follows
    parts = desc.split('. ', 1)
    tail = (' ' + parts[1]) if len(parts) > 1 else ''
    if t == 'globalMult':
        u['description'] = 'All workers produce +%s%% Durians.%s' % (pct(v - 1), tail)
    elif t == 'workerMult':
        u['description'] = '%s produce +%s%% Durians.%s' % (
            WORKER_LABEL.get(e.get('target'), 'These workers'), pct(v - 1), tail)
    elif t == 'achievementBonus':
        u['description'] = 'Each Shine earned adds +%s%% production.%s' % (pct(v), tail)
    elif t == 'workerScaling':
        u['description'] = '%s gain +%s%% output for every %d you own.%s' % (
            WORKER_LABEL.get(e.get('target'), 'These workers'), pct(v), e.get('per', 10), tail)
    elif t == 'workerSynergy':
        src = e.get('source')
        u['description'] = '%s gain +%s%% output for each %s you own.%s' % (
            WORKER_LABEL.get(e.get('target'), 'These workers'), pct(v),
            WORKER_LABEL.get(src, src), tail)

for _u in up:
    if (_u.get('cost') or 0) >= BRAKE_FROM:
        _restate(_u)

# -----------------------------------------------------------------------------
# LATE-GAME SPACING
#
# The brake above fixes how strong the late upgrades are; this fixes WHEN they
# arrive, which was the other half of the runaway. The cost ladder had 92
# upgrades packed into 1e29-1e31 and then nothing at all between 1e43 and 1e46:
# a player bought ninety upgrades in an afternoon, rocketed, and then hit a
# wall with nothing left to buy.
#
# This lays every upgrade at or above SPREAD_FROM onto an even geometric ladder
# up to SPREAD_TO, keeping their existing order, so they arrive at a steady few
# per order of magnitude with no cluster and no gap.
SPREAD_FROM = 1e29
SPREAD_TO = 1e46

_late = sorted([u for u in up if (u.get('cost') or 0) >= SPREAD_FROM],
               key=lambda u: u['cost'])
if len(_late) > 1:
    import math
    _lo, _hi = math.log10(SPREAD_FROM), math.log10(SPREAD_TO)
    _step = (_hi - _lo) / (len(_late) - 1)
    for _i, _u in enumerate(_late):
        _new = 10 ** (_lo + _step * _i)
        # keep the unlock tied to the price, as it was when generated
        _unl = _u.get('unlock')
        if isinstance(_unl, dict) and _unl.get('type') == 'totalEarned':
            _unl['amount'] = _new * 0.6
        _u['cost'] = _new

lines = []
for u in up:
    key = u.get('icon', 'upgrade')
    if key not in ICON_MAP:
        raise SystemExit("No icon mapped for '%s' (upgrade %s). Add it to ICON_MAP."
                         % (key, u['id']))
    icon = ICON_MAP[key]
    fx = ', '.join(
        '{ ' + ', '.join(
            ("%s: %s" % (k, num(v) if isinstance(v, (int, float)) else "'" + esc(str(v)) + "'"))
            for k, v in e.items()) + ' }'
        for e in u['effects'])
    unl = '{ ' + ', '.join(
        ("%s: %s" % (k, num(v) if isinstance(v, (int, float)) else "'" + esc(str(v)) + "'"))
        for k, v in u['unlock'].items()) + ' }'
    lines.append(
        "  { id: '%s', name: '%s',\n"
        "    description: '%s',\n"
        "    cost: %s, icon: '%s',\n"
        "    effects: [%s],\n"
        "    unlock: %s }" % (u['id'], esc(u['name']), esc(u['description']),
                              num(u['cost']), icon, fx, unl))

header = """/* =============================================================================
 * content/upgrades.js — every upgrade in the game.
 * -----------------------------------------------------------------------------
 * Split out of config.js in Update 2, because there are rather a lot of them
 * now. Adding one is still a single entry; see README.md for the effect types.
 *
 * IDS ARE SAVE KEYS. Never rename or reuse one after release.
 * ========================================================================== */
(function (DC) {
  'use strict';
  var CONFIG = DC.CONFIG;

  CONFIG.upgrades = CONFIG.upgrades.concat([
"""
footer = """
  ]);
})(window.DC = window.DC || {});
"""

with open(OUT, 'w') as f:
    f.write(header + ',\n'.join(lines) + footer)

print('wrote %d upgrades (%d legacy + %d new)' % (len(up), len(LEGACY), len(up) - len(LEGACY)))
