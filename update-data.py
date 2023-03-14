#!/usr/bin/env python3

import numpy as np
import pandas as pd
import xlsxwriter
import subprocess
import openpyxl
import json

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
        region = wb[ws_name][reg]
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
            columns = [cell.value.strip() for cell in headRegion[0]]
        region = ws[reg]
    # an anonymous user suggested this to catch a single-cell range (untested):
    # if not isinstance(region, 'tuple'): df = pd.DataFrame(region.value)
    df = pd.DataFrame(([cell.value for cell in row] for row in region), columns=columns)
    return df

file = 'EN Labs T.A.C.T.I.C.U.S - Beta 0.0.3.3.xlsx'
tb_Characters = data_frame_from_xlsx(file, 'tb_Characters', 1)
tb_Pierce = data_frame_from_xlsx(file, 'UL_Tables!$W$3:$X$21', True)
tb_Gear = data_frame_from_xlsx(file, 'UL_Tables!$I$4:$M$21', True)
tb_Abilities = data_frame_from_xlsx(file, 'wb_abilities!$AB$3:$AD$52', True)

tb_Abilities = data_frame_from_xlsx(file, 'wb_abilities!$AB$3:$AD$52', True)
tb_Abilities_1_50 = [level for (level,growth,factor) in tb_Abilities.itertuples(index=False)]
for i in range(1,51):
    if tb_Abilities_1_50[i-1] != i:
        raise Exception("Did not find the correct table. i=%d, tb_Abilities=%d" % ( i, tb_Abilities_1_50[i-1]))
tb_Abilities_factor = [factor for (level,growth,factor) in tb_Abilities.itertuples(index=False)]

tb_CharacterAbilities = data_frame_from_xlsx(file, 'wb_abilities!$A$4:$U$51', True)
characterAbilities = dict([(tpl[0],tpl[1:]) for tpl in tb_CharacterAbilities.itertuples(index=False)])

pierce = dict([(k.lower(),v) for (k,v) in tb_Pierce.itertuples(index=False)])
gear = [(rank,int(gearLevel)) for (rarity,rank,rankMetal,rankLevel,gearLevel) in tb_Gear.itertuples(index=False)]

def toJSON(rows):
    characters = {}
    bosses = {}
    summons = {}
    for index, row in rows.iterrows():
        if row.Name is None or np.isnan(row["Melee Hits"]) or np.isnan(row.Health) or row["Melee Damage"]==0:
            continue
        data = {"faction": row.Faction, "alliance": row.Alliance, "health": row.Health, "damage": row.Damage, "armour": row.Armour, "melee": {"pierce": pierce[row["Melee Damage"].lower()], "hits": int(row["Melee Hits"])}}
        if row["Ranged Hits"] > 0:
            data["ranged"] = {"pierce": pierce[row["Ranged Damage"].lower()], "hits": int(row["Ranged Hits"])}
        if row["Initial rarity"] in ["Common", "Uncommon", "Rare", "Epic", "Legendary"]:
            data["passive"] = [x for x in characterAbilities[row.Name][17:20] if not np.isnan(x)]
            characters[row.Name] = data
        elif row.Name[0:2] in ["L1", "L2", "L3", "L4"]:
            bosses[row.Name] = data
        elif row["Trait 5"] == "Summon":
            summons[row.Name] = data
        else:
            continue
    return {"characters": characters, "bosses": bosses, "summons": summons, "gear": gear, "abilities_factor": tb_Abilities_factor, "version": file.split("-")[1].strip().replace(".xlsx", "")}
with open("tacticus.json", "w") as fout:
    fout.write(json.dumps(toJSON(tb_Characters), sort_keys=True, indent=2))