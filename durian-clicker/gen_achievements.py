#!/usr/bin/env python3
"""Emits js/content/achievements.js — 14 legacy + 50 new."""
import os
OUT = "/home/claude/durian-clicker/js/content/achievements.js"
os.makedirs(os.path.dirname(OUT), exist_ok=True)

ach = []
def add(i, n, d, c, g='Milestones'): ach.append((i, n, d, c, g))
def esc(s): return s.replace("'", "\\'")

# ------------------------------------------------------------- legacy (14) --
LEGACY = [
 ('first_durian','First Durian','Click the Durian for the first time.',"{ type: 'clicks', count: 1 }",'Clicking'),
 ('blistered','Blistered','Click the Durian 100 times.',"{ type: 'clicks', count: 100 }",'Clicking'),
 ('enthusiast','Durian Enthusiast','Collect 1,000 Durians.',"{ type: 'totalEarned', amount: 1000 }",'Durians earned'),
 ('hoarder','Durian Hoarder','Collect 1,000,000 Durians.',"{ type: 'totalEarned', amount: 1e6 }",'Durians earned'),
 ('a_lot_of_fruit',"That's a Lot of Fruit",'Collect 1 billion Durians.',"{ type: 'totalEarned', amount: 1e9 }",'Durians earned'),
 ('smells_like_home','Smells Like Home','Collect 1 trillion Durians.',"{ type: 'totalEarned', amount: 1e12 }",'Durians earned'),
 ('pianta_workforce','Pianta Workforce','Hire 10 Piantas.',"{ type: 'workerCount', id: 'pianta', count: 10 }",'Crew'),
 ('pianta_union','Pianta Union','Hire 50 Piantas.',"{ type: 'workerCount', id: 'pianta', count: 50 }",'Crew'),
 ('noki_workforce','Noki Workforce','Hire 10 Nokis.',"{ type: 'workerCount', id: 'noki', count: 10 }",'Crew'),
 ('yoshi_workforce','Yoshi Ranch','Hire 10 Yoshis.',"{ type: 'workerCount', id: 'yoshi', count: 10 }",'Crew'),
 ('staffed_up','Fully Staffed','Hire 100 workers in total.',"{ type: 'totalWorkers', count: 100 }",'Crew size'),
 ('plaza_economy','Plaza Economy','Reach 1,000 Durians per second.',"{ type: 'dps', amount: 1000 }",'Production rate'),
 ('shine_get','Shine Get!','Buy 10 upgrades.',"{ type: 'upgradesBought', count: 10 }",'Upgrades'),
 ('manual_labor','Manual Labor','Earn 100,000 Durians by clicking alone.',"{ type: 'clickEarned', amount: 1e5 }",'Clicking'),
]
ach.extend(LEGACY)

# ------------------------------------------------------- totals (10 new) --
TOTALS = [
 ('quadrillion','Quadrillion Club','Collect 1 quadrillion Durians.',1e15),
 ('quintillion','Structurally Unsound','Collect 1 quintillion Durians. The warehouse is a rumour now.',1e18),
 ('sextillion','Notably Pungent','Collect 1 sextillion Durians.',1e21),
 ('septillion','Detectable From Orbit','Collect 1 septillion Durians.',1e24),
 ('octillion','Delfino Reeks','Collect 1 octillion Durians.',1e27),
 ('nonillion','A Fruit-Based Economy','Collect 1 nonillion Durians.',1e30),
 ('decillion','The Durian Age','Collect 1 decillion Durians.',1e33),
 ('undecillion','Post-Fruit Society','Collect 1 undecillion Durians.',1e36),
 ('duodecillion','Beyond Counting','Collect 10 duodecillion Durians.',1e40),
 ('absurd','This Is Absurd','Collect 100 quindecillion Durians. Genuinely, well done.',1e50),
]
for i, n, d, amt in TOTALS:
    add(i, n, d, "{ type: 'totalEarned', amount: %g }" % amt, 'Durians earned')

# ---------------------------------------------------------- rates (7 new) --
RATES = [
 ('rate_10k','Cottage Industry','Reach 10,000 Durians per second.',1e4),
 ('rate_100k','Regional Supplier','Reach 100,000 Durians per second.',1e5),
 ('rate_1m','Industrial Harvest','Reach 1 million Durians per second.',1e6),
 ('rate_100m','Continental Output','Reach 100 million Durians per second.',1e8),
 ('rate_10b','The Firehose','Reach 10 billion Durians per second.',1e10),
 ('rate_1t','Faster Than Thought','Reach 1 trillion Durians per second.',1e12),
 ('rate_1qa','Per-Second Quadrillionaire','Reach 1 quadrillion Durians per second.',1e15),
]
for i, n, d, amt in RATES:
    add(i, n, d, "{ type: 'dps', amount: %g }" % amt, 'Production rate')

# --------------------------------------------------------- clicks (4 new) --
CLICKS = [
 ('clicks_1k','Repetitive Strain','Click the Durian 1,000 times.',1000),
 ('clicks_5k','Dedicated','Click the Durian 5,000 times.',5000),
 ('clicks_25k','Concerning Commitment','Click the Durian 25,000 times.',25000),
 ('clicks_100k','See a Doctor','Click the Durian 100,000 times.',100000),
]
for i, n, d, c in CLICKS:
    add(i, n, d, "{ type: 'clicks', count: %d }" % c, 'Clicking')

# ---------------------------------------------------- worker counts (14) --
CREW = [
 ('pianta_100','Pianta Town','Hire 100 Piantas.','pianta',100),
 ('pianta_250','Pianta City','Hire 250 Piantas.','pianta',250),
 ('pianta_500','Pianta Nation','Hire 500 Piantas. They were here first and they will be here last.','pianta',500),
 ('noki_100','Noki Colony','Hire 100 Nokis.','noki',100),
 ('noki_250','Noki Metropolis','Hire 250 Nokis.','noki',250),
 ('noki_500','The Whole Bay','Hire 500 Nokis.','noki',500),
 ('yoshi_50','Stampede','Hire 50 Yoshis.','yoshi',50),
 ('yoshi_150','Do Not Let Them Near Water','Hire 150 Yoshis.','yoshi',150),
 ('toad_50','Brigade Strength','Hire 50 Toads.','toad',50),
 ('toad_150','The Directorate','Hire 150 Toads.','toad',150),
 ('piantissimo_50','A Suspicious Number of Them','Hire 50 Il Piantissimos.','piantissimo',50),
 ('piantissimo_150','All Definitely Piantas','Hire 150 Il Piantissimos.','piantissimo',150),
 ('shadow_50','Seeing Double','Hire 50 Shadow Marios.','shadowmario',50),
 ('shadow_150','Which One Is Real','Hire 150 Shadow Marios.','shadowmario',150),
 ('fruitlady_10','Market Day','Hire 10 Fruit Ladies.','fruitlady',10),
 ('fruitlady_100','The Whole Fountain','Hire 100 Fruit Ladies.','fruitlady',100),
 ('mushroom_10','Business Is Business','Hire 10 Mushroom Dealer Piantas.','mushroompianta',10),
 ('mushroom_100','Ask No Questions','Hire 100 Mushroom Dealer Piantas.','mushroompianta',100),
 ('tanooki_10','That Tree Moved','Hire 10 Tanookis.','tanooki',10),
 ('tanooki_100','Definitely a Forest','Hire 100 Tanookis.','tanooki',100),
 ('chuckster_10','CHUCKSTER','Hire 10 Chucksters.','chuckster',10),
 ('chuckster_100','Nothing Is Carried Any More','Hire 100 Chucksters.','chuckster',100),
 ('corona_1','It Erupted On Cue','Claim your first Corona Mountain.','coronamountain',1),
 ('corona_25','A Range Of Them','Hire 25 Corona Mountains.','coronamountain',25),
 ('corona_100','Geologically Unreasonable','Hire 100 Corona Mountains.','coronamountain',100),
 ('judge_1','Order In The Grove','Appoint your first Pianta Judge.','piantajudge',1),
 ('judge_25','The Full Bench','Hire 25 Pianta Judges.','piantajudge',25),
 ('judge_100','Nearly Unlimited','Hire 100 Pianta Judges. The locals have noticed.','piantajudge',100),
 ('ricco_10','Perfect RNG','Hire 10 Ricco Fruit Converters.','riccoconverter',10),
 ('ricco_100','Everything Into Durians','Hire 100 Ricco Fruit Converters.','riccoconverter',100),
 ('tree_1','It Is Bursting With Fruit','Plant your first Giant Pianta Tree.','giantpiantatree',1),
 ('tree_25','A Grove of Giants','Hire 25 Giant Pianta Trees.','giantpiantatree',25),
]
for i, n, d, w, c in CREW:
    add(i, n, d, "{ type: 'workerCount', id: '%s', count: %d }" % (w, c), 'Crew')

# ------------------------------------------------------- total crew (4) --
for i, n, d, c in [
 ('crew_250','Small Town Employer','Hire 250 workers in total.',250),
 ('crew_500','Major Employer','Hire 500 workers in total.',500),
 ('crew_1000','The Island Works For You','Hire 1,000 workers in total.',1000),
 ('crew_2000','Nobody Is Off Duty','Hire 2,000 workers in total.',2000)]:
    add(i, n, d, "{ type: 'totalWorkers', count: %d }" % c, 'Crew size')

# --------------------------------------------------------- upgrades (4) --
for i, n, d, c in [
 ('up_25','Well Equipped','Buy 25 upgrades.',25),
 ('up_50','Fully Kitted','Buy 50 upgrades.',50),
 ('up_100','Completionist','Buy 100 upgrades.',100),
 ('up_150','Nothing Left On The Shelf','Buy 150 upgrades.',150)]:
    add(i, n, d, "{ type: 'upgradesBought', count: %d }" % c, 'Upgrades')

# ----------------------------------------------------------- events (5) --
add('event_first','Something Happened','Witness your first island event.',"{ type: 'eventsSeen', count: 1 }",'Island events')
add('event_10','Regular Occurrence','Witness 10 island events.',"{ type: 'eventsSeen', count: 10 }",'Island events')
add('event_50','Island Life','Witness 50 island events.',"{ type: 'eventsSeen', count: 50 }",'Island events')
add('boo_5',"Boo's Favourite","Meet King Boo 5 times. He remembers you. That is not reassuring.",
    "{ type: 'eventTypeSeen', id: 'king_boo', count: 5 }",'Island events')
add('sirena_5','Valued Guest','Receive 5 bills from the Sirena Beach Hotel.',
    "{ type: 'eventTypeSeen', id: 'sirena_bill', count: 5 }",'Island events')

# ---------------------------------------------------------- playtime (2) --
add('coin_first','Something Blue','Catch your first Blue Coin.',"{ type: 'coinsCollected', count: 1 }",'Blue Coins')
add('coin_10','Coin Collector','Catch 10 Blue Coins.',"{ type: 'coinsCollected', count: 10 }",'Blue Coins')
add('coin_50','Pocket Full of Blue','Catch 50 Blue Coins.',"{ type: 'coinsCollected', count: 50 }",'Blue Coins')
add('coin_hoard','Why Are You Saving These','Hold 25 Blue Coins at once.',"{ type: 'blueCoins', count: 25 }",'Blue Coins')
add('casino_first',"Beginner's Luck",'Spin the slots for the first time.',"{ type: 'casinoSpins', count: 1 }",'Casino')
add('casino_50','Regular','Spin the slots 50 times.',"{ type: 'casinoSpins', count: 50 }",'Casino')
add('casino_500','Problem','Spin the slots 500 times.',"{ type: 'casinoSpins', count: 500 }",'Casino')
add('casino_jackpot','Three Blue Coins','Hit the Blue Coin jackpot.',"{ type: 'casinoJackpots', count: 1 }",'Casino')
add('skins_3','Dressed Up','Own 3 Durian skins.',"{ type: 'skinsOwned', count: 3 }",'Wardrobe')
add('skins_10','Fashion Forward','Own 10 Durian skins.',"{ type: 'skinsOwned', count: 10 }",'Wardrobe')
add('skins_all','Complete Wardrobe','Own every Durian skin.',"{ type: 'skinsOwned', count: 19 }",'Wardrobe')
add('play_1h','Settling In','Play for one hour.',"{ type: 'playTime', seconds: 3600 }",'Dedication')
add('play_24h','Resident','Play for 24 hours in total.',"{ type: 'playTime', seconds: 86400 }",'Dedication')

# ==========================================================================
# UPDATE 6 - 100 more. Roughly a third are deliberately long-haul: the kind of
# thing a dedicated player is still chasing weeks in.
# ==========================================================================
ALL_CREW6 = ['pianta','fruitlady','noki','yoshi','toad','mushroompianta',
             'piantissimo','tanooki','shadowmario','riccoconverter',
             'chuckster','giantpiantatree','coronamountain','piantajudge']
CREW_LABEL6 = {'pianta':'Piantas','fruitlady':'Fruit Ladies','noki':'Nokis',
               'yoshi':'Yoshis','toad':'Toads','mushroompianta':'Mushroom Dealers',
               'piantissimo':'Il Piantissimos','tanooki':'Tanookis',
               'shadowmario':'Shadow Marios','riccoconverter':'Ricco Converters',
               'chuckster':'Chucksters','giantpiantatree':'Giant Pianta Trees',
               'coronamountain':'Corona Mountains','piantajudge':'Pianta Judges'}

# --- 24: mid-range crew milestones, two per worker
for wid in ALL_CREW6:
    add('%s_200' % wid, 'A Proper %s Crew' % CREW_LABEL6[wid].rstrip('s'),
        'Hire 200 %s.' % CREW_LABEL6[wid],
        "{ type: 'workerCount', id: '%s', count: 200 }" % wid, 'Crew')
    add('%s_350' % wid, '%s Everywhere' % CREW_LABEL6[wid],
        'Hire 350 %s.' % CREW_LABEL6[wid],
        "{ type: 'workerCount', id: '%s', count: 350 }" % wid, 'Crew')

# --- 24 LONG HAUL: 500 and 700 of every worker
for wid in ALL_CREW6:
    add('%s_h600' % wid, 'Six Hundred %s' % CREW_LABEL6[wid],
        'Hire 600 %s. This takes a while.' % CREW_LABEL6[wid],
        "{ type: 'workerCount', id: '%s', count: 600 }" % wid, 'Crew')
    add('%s_700' % wid, 'Seven Hundred %s' % CREW_LABEL6[wid],
        'Hire 700 %s. This takes considerably longer.' % CREW_LABEL6[wid],
        "{ type: 'workerCount', id: '%s', count: 700 }" % wid, 'Crew')

# --- 16: total earned, deep into the tail
TOTALS6 = [
 ('t_1e55','Numbers Stop Meaning Things','Collect 10 septendecillion Durians.',1e55),
 ('t_1e60','Vigintillionaire','Collect 1 vigintillion Durians.',1e63),
 ('t_1e66','Past The Suffixes','Collect 1 unvigintillion Durians.',1e66),
 ('t_1e72','Still Going','Collect 1 trevigintillion Durians.',1e72),
 ('t_1e80','More Durians Than Atoms Nearby','Collect 10^80 Durians.',1e80),
 ('t_1e90','Ninety Zeroes','Collect 1 novemvigintillion Durians.',1e90),
 ('t_1e100','The Googol Harvest','Collect one googol Durians.',1e100),
 ('t_1e120','Why Are You Like This','Collect 10^120 Durians.',1e120),
 ('t_1e150','Genuinely Concerning','Collect 10^150 Durians.',1e150),
 ('t_1e200','Beyond The Suffix Table','Collect 10^200 Durians.',1e200),
 ('t_1e250','Scientific Notation Only','Collect 10^250 Durians.',1e250),
 ('t_1e300','The Far Shore','Collect 10^300 Durians. There is not much past here.',1e300),
 ('t_1e42','Deep Field','Collect 1 tredecillion Durians.',1e42),
 ('t_1e45','Quattuordecillion Club','Collect 1 quattuordecillion Durians.',1e45),
 ('t_1e48','Fifteen Groups Of Three','Collect 1 quindecillion Durians.',1e48),
 ('t_1e51','Sexdecillion','Collect 1 sexdecillion Durians.',1e51),
]
for i, n, d, amt in TOTALS6:
    add(i, n, d, "{ type: 'totalEarned', amount: %g }" % amt, 'Durians earned')

# --- 8: production rate
for i, n, d, amt in [
 ('r_1e18','Quintillion A Second','Reach 1 quintillion Durians per second.',1e18),
 ('r_1e21','Sextillion A Second','Reach 1 sextillion Durians per second.',1e21),
 ('r_1e25','Faster Than Bookkeeping','Reach 10 septillion Durians per second.',1e25),
 ('r_1e30','Nonillion A Second','Reach 1 nonillion Durians per second.',1e30),
 ('r_1e40','The Firehose Widens','Reach 10^40 Durians per second.',1e40),
 ('r_1e50','Rate Of Absurdity','Reach 10^50 Durians per second.',1e50),
 ('r_1e70','Per-Second Ridiculous','Reach 10^70 Durians per second.',1e70),
 ('r_1e100','A Googol A Second','Reach 10^100 Durians per second.',1e100),
]:
    add(i, n, d, "{ type: 'dps', amount: %g }" % amt, 'Production rate')

# --- 6: clicking
for i, n, d, c in [
 ('c_250k','Quarter Million Taps','Click the Durian 250,000 times.',250000),
 ('c_500k','Half A Million','Click the Durian 500,000 times.',500000),
 ('c_1m','One Million Clicks','Click the Durian a million times.',1000000),
 ('c_2m','Two Million Clicks','Click the Durian two million times. Please rest.',2000000),
 ('c_5m','Five Million Clicks','Click the Durian five million times.',5000000),
 ('c_10m','Ten Million Clicks','Click the Durian ten million times.',10000000),
]:
    add(i, n, d, "{ type: 'clicks', count: %d }" % c, 'Clicking')

# --- extra totals: octodecillion and the gaps around it
for i, n, d, amt in [
 ('t_1e57','Octodecillion','Collect 1 octodecillion Durians.',1e57),
 ('t_1e54','Septendecillion','Collect 1 septendecillion Durians.',1e54),
 ('t_1e69','Duovigintillion','Collect 1 duovigintillion Durians.',1e69),
 ('t_1e75','Quattuorvigintillion','Collect 1 quattuorvigintillion Durians.',1e75),
]:
    add(i, n, d, "{ type: 'totalEarned', amount: %g }" % amt, 'Durians earned')

# --- crew totals, all the way to a hundred thousand workers
for i, n, d, c in [
 ('cs_20000','Twenty Thousand Strong','Hire 20,000 workers in total.',20000),
 ('cs_30000','A Standing Army','Hire 30,000 workers in total.',30000),
 ('cs_50000','Fifty Thousand','Hire 50,000 workers in total.',50000),
 ('cs_75000','The Island Is Full','Hire 75,000 workers in total.',75000),
 ('cs_100000','One Hundred Thousand','Hire 100,000 workers in total. There is nowhere left to stand.',100000),
]:
    add(i, n, d, "{ type: 'totalWorkers', count: %d }" % c, 'Crew size')

# --- upgrades, now that there are nearly nine hundred of them
for i, n, d, c in [
 ('u_450','Four Hundred And Fifty','Buy 450 upgrades.',450),
 ('u_500','Five Hundred Upgrades','Buy 500 upgrades.',500),
 ('u_550','Still Shopping','Buy 550 upgrades.',550),
 ('u_600','Six Hundred Upgrades','Buy 600 upgrades.',600),
 ('u_650','The Long List','Buy 650 upgrades.',650),
 ('u_700','Seven Hundred Upgrades','Buy 700 upgrades.',700),
 ('u_750','Diminishing Shelf Space','Buy 750 upgrades.',750),
 ('u_800','Eight Hundred Upgrades','Buy 800 upgrades.',800),
 ('u_850','Nearly Everything, Again','Buy 850 upgrades.',850),
]:
    add(i, n, d, "{ type: 'upgradesBought', count: %d }" % c, 'Upgrades')

# --- 5: crew totals
for i, n, d, c in [
 ('cs_3000','Three Thousand Strong','Hire 3,000 workers in total.',3000),
 ('cs_5000','A Small Nation','Hire 5,000 workers in total.',5000),
 ('cs_7500','Overemployed','Hire 7,500 workers in total.',7500),
 ('cs_10000','Ten Thousand','Hire 10,000 workers in total.',10000),
 ('cs_15000','Everyone On Delfino','Hire 15,000 workers in total.',15000),
]:
    add(i, n, d, "{ type: 'totalWorkers', count: %d }" % c, 'Crew size')

# --- 6: upgrades
for i, n, d, c in [
 ('u_200','Two Hundred Upgrades','Buy 200 upgrades.',200),
 ('u_250','Well Provisioned','Buy 250 upgrades.',250),
 ('u_300','Three Hundred Upgrades','Buy 300 upgrades.',300),
 ('u_350','Nearly Everything','Buy 350 upgrades.',350),
 ('u_400','Four Hundred Upgrades','Buy 400 upgrades.',400),
 ('u_all','Bought The Shop','Buy every upgrade in the game.',892),
]:
    add(i, n, d, "{ type: 'upgradesBought', count: %d }" % c, 'Upgrades')

# --- 7: island events
for i, n, d, c in [
 ('e_100','Hundred Happenings','Witness 100 island events.',100),
 ('e_250','Local Fixture','Witness 250 island events.',250),
 ('e_500','Nothing Surprises You','Witness 500 island events.',500),
 ('e_1000','A Thousand Interruptions','Witness 1,000 island events.',1000),
 ('e_2500','Island Historian','Witness 2,500 island events.',2500),
]:
    add(i, n, d, "{ type: 'eventsSeen', count: %d }" % c, 'Island events')
add('e_boo25','On First Name Terms','Meet King Boo 25 times.',
    "{ type: 'eventTypeSeen', id: 'king_boo', count: 25 }", 'Island events')
add('e_sirena25','Platinum Guest','Receive 25 bills from the Sirena Beach Hotel.',
    "{ type: 'eventTypeSeen', id: 'sirena_bill', count: 25 }", 'Island events')

# --- 4: blue coins
for i, n, d, c in [
 ('bc_100','Century Of Coins','Collect 100 Blue Coins.',100),
 ('bc_250','Coin Baron','Collect 250 Blue Coins.',250),
 ('bc_500','Five Hundred Blue Coins','Collect 500 Blue Coins.',500),
 ('bc_1000','A Thousand Blue Coins','Collect 1,000 Blue Coins.',1000),
]:
    add(i, n, d, "{ type: 'coinsCollected', count: %d }" % c, 'Blue Coins')

# --- 5: casino
for i, n, d, cond, grp in [
 ('cas_1000','High Roller','Spin the slots 1,000 times.',"{ type: 'casinoSpins', count: 1000 }",'Casino'),
 ('cas_5000','The House Knows You','Spin the slots 5,000 times.',"{ type: 'casinoSpins', count: 5000 }",'Casino'),
 ('cas_j5','Five Jackpots','Hit the Blue Coin jackpot 5 times.',"{ type: 'casinoJackpots', count: 5 }",'Casino'),
 ('cas_j15','Fifteen Jackpots','Hit the Blue Coin jackpot 15 times.',"{ type: 'casinoJackpots', count: 15 }",'Casino'),
 ('cas_j40','Statistically Suspicious','Hit the Blue Coin jackpot 40 times.',"{ type: 'casinoJackpots', count: 40 }",'Casino'),
]:
    add(i, n, d, cond, grp)

# --- 4: Golden Shines
for i, n, d, c in [
 ('gs_1','First Golden Shine','Claim your first Golden Shine.',1),
 ('gs_3','Halfway To The Sun','Collect 3 Golden Shines.',3),
 ('gs_5','Five Points Of Light','Collect 5 Golden Shines.',5),
 ('gs_6','Golden Shines Complete','Collect all 6 Golden Shines.',6),
]:
    add(i, n, d, "{ type: 'goldenShines', count: %d }" % c, 'Golden Shines')

# --- 5: dedication (long-haul by definition)
for i, n, d, secs in [
 ('p_3d','Three Days In','Play for 3 days in total.',3*86400),
 ('p_7d','A Full Week','Play for 7 days in total.',7*86400),
 ('p_14d','Fortnight','Play for 14 days in total.',14*86400),
 ('p_30d','A Month On Delfino','Play for 30 days in total.',30*86400),
 ('p_100d','Resident Of Isle Delfino','Play for 100 days in total.',100*86400),
 ('p_365d','A Year On Isle Delfino','Play for 365 days in total. Somebody famous turns up.',365*86400),
]:
    add(i, n, d, "{ type: 'playTime', seconds: %d }" % secs, 'Dedication')

# --- 2: offline
add('off_big','Away But Working','Collect 1 quintillion Durians from offline production.',
    "{ type: 'offlineEarned', amount: 1e18 }", 'Dedication')
add('off_huge','Absentee Tycoon','Collect 1 nonillion Durians from offline production.',
    "{ type: 'offlineEarned', amount: 1e30 }", 'Dedication')

# --- 3: wardrobe
add('sk_5','Options','Own 5 Durian skins.',"{ type: 'skinsOwned', count: 5 }", 'Wardrobe')
add('sk_15','Extensive Wardrobe','Own 15 Durian skins.',"{ type: 'skinsOwned', count: 15 }", 'Wardrobe')
add('sk_rich','Dressed For The Occasion','Own every skin and hold 100 Blue Coins.',
    "{ type: 'blueCoins', count: 100 }", 'Wardrobe')

# --------------------------------------------------------------- emit --
GROUP_ORDER = ['Durians earned', 'Production rate', 'Clicking', 'Crew',
               'Crew size', 'Upgrades', 'Island events', 'Blue Coins', 'Casino',
               'Wardrobe', 'Dedication', 'Milestones']

# Crew achievements must run in roster order, so every Pianta entry sits with
# the other Pianta entries rather than being split by whichever ones happened
# to ship first.
WORKER_ORDER = ['pianta', 'fruitlady', 'noki', 'yoshi', 'toad', 'mushroompianta',
                'piantissimo', 'tanooki', 'shadowmario', 'riccoconverter',
                'chuckster', 'giantpiantatree', 'coronamountain', 'piantajudge']
# Within a group, keep same-condition-type entries together and ascending.
TYPE_ORDER = ['clicks', 'clickEarned', 'totalEarned', 'dps', 'workerCount',
              'totalWorkers', 'upgradesBought', 'eventsSeen', 'eventTypeSeen',
              'coinsCollected', 'blueCoins', 'casinoSpins', 'casinoJackpots',
              'skinsOwned', 'playTime']

import re as _re
def sort_key(entry):
    cond = entry[3]
    ctype = _re.search(r"type: '(\w+)'", cond).group(1)
    wid = _re.search(r"id: '(\w+)'", cond)
    num = _re.search(r"(?:amount|count|seconds): ([\d.e+]+)", cond)
    value = float(num.group(1)) if num else 0.0
    if ctype == 'workerCount':
        widx = WORKER_ORDER.index(wid.group(1)) if wid.group(1) in WORKER_ORDER else 99
        return (TYPE_ORDER.index(ctype), widx, value)
    tidx = TYPE_ORDER.index(ctype) if ctype in TYPE_ORDER else 99
    return (tidx, 0, value)

ach.sort(key=lambda a: (GROUP_ORDER.index(a[4]) if a[4] in GROUP_ORDER else 99,
                        sort_key(a)))

lines = ["  { id: '%s', name: '%s', description: '%s',\n    group: '%s',\n    condition: %s }"
         % (i, esc(n), esc(d), g, c) for i, n, d, c, g in ach]

header = """/* =============================================================================
 * content/achievements.js — every achievement in the game.
 * -----------------------------------------------------------------------------
 * Each one earned also grants a permanent production bonus
 * (CONFIG.achievementBonusPer, plus anything from achievementBonus upgrades).
 *
 * IDS ARE SAVE KEYS. Never rename or reuse one after release.
 * ========================================================================== */
(function (DC) {
  'use strict';
  var CONFIG = DC.CONFIG;

  CONFIG.achievements = CONFIG.achievements.concat([
"""
with open(OUT, 'w') as f:
    f.write(header + ',\n'.join(lines) + "\n  ]);\n})(window.DC = window.DC || {});\n")

ids = [a[0] for a in ach]
assert len(ids) == len(set(ids)), 'duplicate achievement id'
print('wrote %d achievements (%d legacy + %d new)' % (len(ach), len(LEGACY), len(ach) - len(LEGACY)))
