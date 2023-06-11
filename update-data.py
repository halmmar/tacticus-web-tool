#!/usr/bin/env python3

import numpy as np
import pandas as pd
import xlsxwriter
import subprocess
import openpyxl
import json
import copy
from collections import OrderedDict
from io import StringIO

file = 'EN Labs T.A.C.T.I.C.U.S - Beta 0.3.9.xlsx'

def data_frame_from_xlsx(xlsx_file, range_name, headerColumn=None):
    """ Get a single rectangular region from the specified file.
    range_name can be a standard Excel reference ('Sheet1!A2:B7') or
    refer to a named region ('my_cells')."""
    wb = openpyxl.load_workbook(xlsx_file, data_only=True, read_only=True)
    columns = None
    if '!' in range_name:
        # passed a worksheet!cell reference
        ws_name, reg = range_name.split('!')
        if ws_name.startswith("'") and ws_name.endswith("'"):
            # optionally strip single quotes around sheet name
            ws_name = ws_name[1:-1]
        ws = wb[ws_name]
    else:
        # passed a named range; find the cells in the workbook
        full_range = wb.defined_names[range_name]
        if full_range is None:
            raise ValueError(
                'Range "{}" not found in workbook "{}".'.format(range_name, xlsx_file)
            )
        print(full_range.value)
        print(type(full_range))
        # convert to list (openpyxl 2.3 returns a list but 2.4+ returns a generator)
        destinations = list(full_range.destinations)
        print(destinations)
        if len(destinations) > 1:
            raise ValueError(
                'Range "{}" in workbook "{}" contains more than one region.'
                .format(range_name, xlsx_file)
            )
        ws, reg = destinations[0]
        # convert to worksheet object (openpyxl 2.3 returns a worksheet object 
        # but 2.4+ returns the name of a worksheet)
        if isinstance(ws, str):
            ws = wb[ws]
    region = ws[reg]
    if headerColumn is None:
        pass
    else:
        heads = reg.split("$")
        if type(headerColumn) is int:
            headRow = headerColumn
        elif type(headerColumn) is bool:
            headRow = int(heads[2][:-1])-1
        else:
            raise Exception("...")
        headRange = "$%s$%d:$%s$%d" % (heads[1],headRow,heads[3],headRow)
        headRegion = ws[headRange]
        columns = [(cell.value.strip() if isinstance(cell.value,str) else cell.value) for cell in headRegion[0]]
    # an anonymous user suggested this to catch a single-cell range (untested):
    # if not isinstance(region, 'tuple'): df = pd.DataFrame(region.value)
    df = pd.DataFrame(([cell.value for cell in row] for row in region), columns=columns)
    return df

tb_Characters = data_frame_from_xlsx(file, 'tb_Characters', 1)
tb_Pierce = data_frame_from_xlsx(file, 'UL_Tables!$W$3:$X$22', True)
tb_Gear = data_frame_from_xlsx(file, 'UL_Tables!$I$4:$M$21', True)

# Updated for new factions; also update the faction map below
tb_Equipment = data_frame_from_xlsx(file, 'Equipment!$B$3:$AT$124', 2)
# Updated for new characters
tb_CharacterAbilities = data_frame_from_xlsx(file, 'wb_abilities!$A$4:$U$77', True) # Passives

tb_Abilities = data_frame_from_xlsx(file, 'wb_abilities!$AB$3:$AJ$52', True) # Not updated for new characters
tb_Abilities_1_50 = [level for (level,growth,factor,_,_,_,_,_,_) in tb_Abilities.itertuples(index=False)]
tb_SummonsList = data_frame_from_xlsx(file, 'SummonsData!$B$2:$B$30', True)

for i in range(1,51):
    if tb_Abilities_1_50[i-1] != i:
        raise Exception("Did not find the correct table. i=%d, tb_Abilities=%d" % ( i, tb_Abilities_1_50[i-1]))
tb_Abilities_factor = [factor for (level,growth,factor,_,_,_,_,_,_) in tb_Abilities.itertuples(index=False)]
tb_Abilities_factor_archimatos = [factor for (level,growth,_,_,_,_,_,factor,_) in tb_Abilities.itertuples(index=False)]
summonsNames = set()
for index, row in tb_SummonsList.iterrows():
    if row["Name"]:
        summonsNames.add(row["Name"])
# Legendary Events
tb_LegendaryEvent = data_frame_from_xlsx(file, 'YourUnits!$A$1:$CX$99')
# 76=Excel column BY, which conflicts with the query language used by Towen. The column is empty and skipped...
tb_LegendaryEvent.drop(columns=[76], axis=1, inplace=True)
tb_LegendaryEvent.to_excel("tmp.xlsx", header=False, index=False)
tb_LegendaryEvent = pd.read_excel("tmp.xlsx", header=None)

lastIndexCharacter = 5
while isinstance(tb_LegendaryEvent[0][lastIndexCharacter], str):
    lastIndexCharacter += 1
# Passives
characterAbilities = dict([(tpl[0],tpl[1:]) for tpl in tb_CharacterAbilities.itertuples(index=False)])

indexLegendaryEvent=17
legendaryEvents = {}
legendaryEventCharacters = {}
latestLegendaryEvent = None
while indexLegendaryEvent in tb_LegendaryEvent and tb_LegendaryEvent[indexLegendaryEvent][0]:
    legendaryEventName = tb_LegendaryEvent[indexLegendaryEvent][0].split("-")[1].strip()
    latestLegendaryEvent = legendaryEventName
    items = tb_LegendaryEvent.iloc[3:5,indexLegendaryEvent:indexLegendaryEvent+18]
    points = list(tb_LegendaryEvent.iloc[2,indexLegendaryEvent:indexLegendaryEvent+18])
    items.replace("No", "No ",inplace=True)
    items.replace("Eligiable", "Eligible",inplace=True)
    items.replace("Eligible", "!", inplace=True)
    items.fillna("",inplace=True)
    itemsList = list(items.sum())
    alphaNames = itemsList[0:6]
    betaNames = itemsList[6:12]
    gammaNames = itemsList[12:18]
    pointsList = list(points)
    
    alpha = dict(zip(alphaNames,[[p,0] for p in pointsList[0:6]]))
    beta = dict(zip(betaNames,[[p,0] for p in pointsList[6:12]]))
    gamma = dict(zip(gammaNames,[[p,0] for p in pointsList[12:18]]))
    for index, row in tb_LegendaryEvent.iterrows():
        if index < 5:
            continue
        if not row[0]:
            continue
        if not isinstance(row[0],str):
            continue
        if row[0] not in legendaryEventCharacters:
            legendaryEventCharacters[row[0]] = {}
        characterAlpha = []
        characterBeta = []
        characterGamma = []
        for i in range(0,6):
            if row[indexLegendaryEvent+i]:
                characterAlpha += [alphaNames[i]]
            if row[indexLegendaryEvent+6+i]:
                characterBeta += [betaNames[i]]
            if row[indexLegendaryEvent+12+i]:
                characterGamma += [gammaNames[i]]
        for (missionList,missionPoints) in [(characterAlpha,alpha),(characterBeta,beta),(characterGamma,gamma)]:
            if "!" not in missionList:
                missionList.clear()
            for mission in missionList:
                missionPoints[mission][1] += 1
        if legendaryEventName in legendaryEventCharacters[row[0]]:
            raise Exception(row[0], "appears twice in the legendary events (YourUnits)")
        legendaryEventCharacters[row[0]][legendaryEventName] = {"alpha": characterAlpha, "beta": characterBeta, "gamma": characterGamma}
                
    legendaryEvents[legendaryEventName] = {"alpha": alpha, "beta": beta, "gamma": gamma}
    indexLegendaryEvent += 19

# Boss stats
bossStats = {
  # Stats are an array [0]=L1, etc. The first element is the stat and the second, the season which the data was collected from
  "ghazghkull": {
      "armour": [[151/0.5,15],None,[330/0.5,16],[504/0.5,18]],
      "damage": [None,None,[778/0.5,15],[1189/0.5,18]],
      "melee": {"hits": 4, "pierce": 0.4},
      "ranged": {"hits": 6, "pierce": 0.15},
      "checkbox": {
          "armour": 0.5,
          "damage": 0.5 # ??? Confirm this
      }
  },
  "mortarion": {
      "armour": [None,None,None,[6701,"beta"]],
      "damage": [None,None,None,[2234,"beta"]],
      "melee": {"hits": 7, "pierce": 0.15},
      "ranged": {"hits": 3, "pierce": 1.00},
      "checkbox": {
          "armour": 0.1,
          "damage": 0.75
      }
  },
  "gibbascrapz": {
      "armour": [None, None, [2297,16], [3510,18]],
      "damage": [None, None, [1874,16], [2864,18]],
      "melee": {"hits": 4, "pierce": 0.01},
      "checkbox": {}
  },
  "tervigon gorgon": {
      "armour": [None, None, None, None],
      "damage": [None, None, None, None],
      "checkbox": {
          "armour": 0.4
      }
  },
  "tervigon leviathan": {
      "armour": [None, None, None, [403/0.4,16]],
      "damage": [None, None, None, [2379,16]],
      "melee": {"hits": 3, "pierce": 0.3},
      "ranged": {"hits": 2, "pierce": 1.0 },
      "checkbox": {
          "armour": 0.4
      }
  },
  "tervigon kronos": {
      "armour": [None, None, None, None],
      "damage": [None, None, None, None],
      "checkbox": {
          "armour": 0.4
      }
  },
  "hive tyrant gorgon": {
      "armour": [None, None, None, None],
      "damage": [None, None, None, None],
      "checkbox": {
          "armour": 0.4
      }
  },
  "hive tyrant leviathan": {
      "armour": [None, None, None, None],
      "damage": [None, None, None, None],
      "checkbox": {
          "armour": 0.4
      }
  },
  "hive tyrant kronos": {
      "armour": [None, None, None, None],
      "damage": [None, None, None, None],
      "checkbox": {
          "armour": 0.4
      }
  },
  "szarekh": {
      "armour": [[110/0.4,16], None, None, [368/0.4,15]],
      "damage": [[110/0.4,16], None, None, [368/0.4,15]],
      "checkbox": {
          "armour": 0.4,
          "damage": 0.4, # ???
      }
  },
  "stormboy": {
      "armour": [None, None, [502,15], [797,18]],
      "damage": [None, None, [1003,16], [1595,18]],
      "melee": {"hits": 2, "pierce": 0.01},
      "checkbox": {
          "hits": 1
      }
    },
  "triarchal menhir": {
      "armour": [[573,17], None, None, [1910,15]],
      "damage": [[859,17], None, None, [2864,15]],
      "melee": {"hits": 1, "pierce": 0.8},
      "ranged": {"hits": 1, "pierce": 0.8},
      "checkbox": {}
  },
  "tyranid prime": {
      "armour": [None, None, None, [488,16]],
      "damage": [None, None, None, [2882,16]],
      "melee": {"hits": 3, "pierce": 0.01},
      "ranged": {"hits": 3, "pierce": 0.3},
      "checkbox": {}
  }
}

pierce = dict([(k.lower(),v) for (k,v) in tb_Pierce.itertuples(index=False)])
gear = [(rank,int(gearLevel)) for (rarity,rank,rankMetal,rankLevel,gearLevel) in tb_Gear.itertuples(index=False)]

factionMap = {
    "ULTRAMARINES": "Ultramarines",
    "ADEPTA SOROITAS": "ADEPTA SOROITAS",
    "ASTRA MILITARUM": "Astra militarum",
    "BLACK LEGION": "Black Legion",
    "BLACK TEMPLARS": "Black templars",
    "DEATH GUARD": "Death guard",
    "ORKS": "Orks",
    "NECRONS": "Necrons",
    "AELDARI": "Aeldari",
    "T'AU": "T'au Empire",
    "Space Wolves": "Space Wolves",
    "DARK ANGELS": "Dark Angels",
    "THOUSAND SONS": "Thousand Sons"
}

eqDict = {}
for index, eq in tb_Equipment.iterrows():
    if eq["Item Type"] is None:
        continue
    itemTypeStr = eq["Item Type"].lower().replace(" ","_")
    if itemTypeStr not in eqDict:
        eqDict[itemTypeStr] = {}
    itemType = eqDict[itemTypeStr]
    factions = []
    for faction in factionMap.keys():
        if eq[faction]:
            factions += [factionMap[faction]]
    itemInternalType = eq[0:1][0] # Gun, Knife, Both
    chance = eq["Chance"]
    if np.isnan(chance):
        chance = int("Both"==itemInternalType)
    else:
        chance = int(chance)
    if "booster" in itemTypeStr:
        chance = 1
    if chance in itemType:
        itemType[chance]["factions"] = list(OrderedDict.fromkeys(itemType[chance]["factions"]+factions))
    else:
        itemType[chance] = {
            "factions": factions
        }
    itemChance = itemType[chance]
    rarityStr = eq["Rarity"].lower()
    if rarityStr not in itemChance:
        stat1 = [int(x) for x in eq[22:33] if not np.isnan(x)]
        stat2 = [int(x) for x in eq[34:45] if not np.isnan(x)]
        if itemTypeStr=="defense":
            itemChance[rarityStr] = {
                "health": stat1,
                "armour": stat2
            }
        else:
            itemChance[rarityStr] = {
                {
                    "crit": "crit-dmg",
                    "crit_booster": "crit-dmg",
                    "block": "block",
                    "block_booster": "block"
                }[itemTypeStr]: stat1
            }

def toJSON(rows):
    characters = {}
    bosses = {}
    summons = {}
    for index, row in rows.iterrows():
        if row.Name is None or np.isnan(row["Melee Hits"]) or np.isnan(row.Health) or row["Melee Damage"]==0:
            continue
        eqCount = {"crit": 0, "defense": 0, "crit_booster": 0, "block": 0, "block_booster": 0}
        for eqNum in ["Equipement slot 1", "Equipement slot 2", "Equipemnt slot 3"]:
            if row[eqNum] is None or type(row[eqNum]) is not str:
                continue
            eq = row[eqNum].lower().replace(" ", "_")
            if eq in eqCount:
                eqCount[eq] += 1
        traits = []
        for trait in ["Trait %d" % n for n in range(1,6)]:
            if row[trait] is None or type(row[trait]) is not str:
                continue
            traitStripped = row[trait].lower().strip().replace("living metsl", "living metal")
            if traitStripped in traits:
                continue
            traits += [traitStripped]
        if row.Name == "Shield Drone" and "summon" not in traits:
            traits += ["summon"]
        toDelete = []
        for key in eqCount.keys():
            if not eqCount[key]:
                toDelete += [key]
        for key in toDelete:
            del eqCount[key]
        passiveData = []
        if row.Name in characterAbilities:
            passiveData = [x for x in characterAbilities[row.Name][17:20] if not (x is None or np.isnan(x))]
        data = {"faction": row.Faction, "alliance": row.Alliance or "", "health": row.Health, "damage": row.Damage, "traits": traits, "armour": row.Armour, "melee": {"pierce": pierce[row["Melee Damage"].lower()], "hits": int(row["Melee Hits"])}}
        if row["Ranged Hits"] > 0:
            data["ranged"] = {"pierce": pierce[row["Ranged Damage"].lower()], "hits": int(row["Ranged Hits"])}
        if row["Initial rarity"] in ["Common", "Uncommon", "Rare", "Epic", "Legendary"]:
            data["passive"] = passiveData
            data["equipment"] = eqCount
            data["legendary-event"] = legendaryEventCharacters[row.Name]
            characters[row.Name] = data
        elif row.Name[0:2] in ["L1", "L2", "L3", "L4"]:
            bosses[row.Name] = data
        elif "summon" in traits:
            if row.Name not in characterAbilities:
                raise Exception(row.Name + " " + str(characterAbilities.keys()))
            data["health"] = passiveData[0]
            data["damage"] = passiveData[1]
            data["armour"] = passiveData[2] if len(passiveData)==3 else 0
            summons[row.Name] = data
        else:
            continue
    for name in summonsNames:
        if name not in summons:
            raise Exception("%s is not in the list of summons" % name)
    return {"characters": characters, "bosses": bossStats, "summons": summons, "gear": gear, "abilities_factor": tb_Abilities_factor, "archimatos_ability_factor": tb_Abilities_factor_archimatos, "equipment": eqDict, "legendary-events": legendaryEvents, "latest-legendary-event": latestLegendaryEvent, "version": file.split("-")[1].strip().replace(".xlsx", "")}
with open("tacticus.json", "w") as fout:
    fout.write(json.dumps(toJSON(tb_Characters), sort_keys=True, indent=2))
