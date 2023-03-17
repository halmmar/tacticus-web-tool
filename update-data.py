#!/usr/bin/env python3

import numpy as np
import pandas as pd
import xlsxwriter
import subprocess
import openpyxl
import json
import copy
from collections import OrderedDict 

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

file = 'EN Labs T.A.C.T.I.C.U.S - Beta 0.0.3.3.xlsx'
tb_Characters = data_frame_from_xlsx(file, 'tb_Characters', 1)
tb_Pierce = data_frame_from_xlsx(file, 'UL_Tables!$W$3:$X$21', True)
tb_Gear = data_frame_from_xlsx(file, 'UL_Tables!$I$4:$M$21', True)
tb_Equipment = data_frame_from_xlsx(file, 'Equipment!$B$3:$AP$124', 2)
tb_Abilities = data_frame_from_xlsx(file, 'wb_abilities!$AB$3:$AJ$52', True)
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

# Passives
tb_CharacterAbilities = data_frame_from_xlsx(file, 'wb_abilities!$A$4:$U$65', True)
characterAbilities = dict([(tpl[0],tpl[1:]) for tpl in tb_CharacterAbilities.itertuples(index=False)])

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
    "T'AU": "T'au Empire"
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
        stat1 = [int(x) for x in eq[18:29] if not np.isnan(x)]
        stat2 = [int(x) for x in eq[30:41] if not np.isnan(x)]
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
        toDelete = []
        for key in eqCount.keys():
            if not eqCount[key]:
                toDelete += [key]
        for key in toDelete:
            del eqCount[key]
        passiveData = []
        if row.Name in characterAbilities:
            passiveData = [x for x in characterAbilities[row.Name][17:20] if not (x is None or np.isnan(x))]
        data = {"faction": row.Faction, "alliance": row.Alliance, "health": row.Health, "damage": row.Damage, "traits": traits, "armour": row.Armour, "melee": {"pierce": pierce[row["Melee Damage"].lower()], "hits": int(row["Melee Hits"])}}
        if row["Ranged Hits"] > 0:
            data["ranged"] = {"pierce": pierce[row["Ranged Damage"].lower()], "hits": int(row["Ranged Hits"])}
        if row["Initial rarity"] in ["Common", "Uncommon", "Rare", "Epic", "Legendary"]:
            data["passive"] = passiveData
            data["equipment"] = eqCount
            characters[row.Name] = data
        elif row.Name[0:2] in ["L1", "L2", "L3", "L4"]:
            bosses[row.Name] = data
        elif "summon" in traits:
            data["health"] = passiveData[0]
            data["damage"] = passiveData[1]
            data["armour"] = passiveData[2] if len(passiveData)==3 else 0
            summons[row.Name] = data
            if row.Name == "Bloodletter":
                data = copy.deepcopy(data)
                data["damage"] *= 0.71
                data["traits"] += ["bloodletter_1.6_extra_hit"]
                summons[row.Name + " (v1.6)"] = data
            elif row.Name == "Scarab Swarm":
                data = copy.deepcopy(data)
                data["melee"]["pierce"] = 0.3
                data["traits"] += ["flying"]
                summons[row.Name + " (v1.6)"] = data
        else:
            continue
    for name in summonsNames:
        if name not in summons:
            raise Exception("%s is not in the list of summons" % name)
    return {"characters": characters, "bosses": bosses, "summons": summons, "gear": gear, "abilities_factor": tb_Abilities_factor, "archimatos_ability_factor": tb_Abilities_factor_archimatos, "equipment": eqDict, "version": file.split("-")[1].strip().replace(".xlsx", "")}
with open("tacticus.json", "w") as fout:
    fout.write(json.dumps(toJSON(tb_Characters), sort_keys=True, indent=2))
