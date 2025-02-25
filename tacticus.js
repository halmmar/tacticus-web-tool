var getJSON = function(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'json';
  xhr.onload = function() {
  var status = xhr.status;
  if (status === 200) {
    callback(null, xhr.response);
  } else {
    callback(status, xhr.response);
  }
  };
  xhr.send();
};

obsoleteEvents = []; // ["MAUGAN RA"];
tb_chars = {};
tb_bosses = {};
tb_summons = {};
tb_chars_and_summons = {};
tb_gear = [];
tb_abilities_factor = [];
tb_archimatos_ability_factor = [];
tb_equipment = {};
tb_legendary_events = {};
intToRarity = ["common", "uncommon", "rare", "epic", "legendary"]
gearLevelToText = ["Stone 1","Stone 2","Stone 3","Iron 1","Iron 2","Iron 3","Bronze 1","Bronze 2","Bronze 3","Silver 1","Silver 2","Silver 3","Gold 1","Gold 2","Gold 3","Diamond 1","Diamond 2","Diamond 3"]
opponentRevoltingResilience = 0;
opponentAblativePlating = false;
legendaryEventMaxCharacterPenalty = 25; // After this, we no longer penalize more characters added to the pool
legendaryEventCharacterPenaltyFactor = 5; // 5 characters in a team
legendaryEventFactors = {};

ahrimanPercent = 1.0;
ahrimanMax = 0;


var calculateLegendaryEventWeight = function(numberOfUnits, weight) {
  var res = Math.pow(1.0 / (Math.min(legendaryEventMaxCharacterPenalty, numberOfUnits)/legendaryEventCharacterPenaltyFactor), weight);
  return res;
};

getJSON('tacticus.json',
function(err, data) {
  if (err !== null) {
    console.log('Something went wrong: ' + err);
  } else {
    tb_chars = data.characters;
    tb_summons = data.summons;
    tb_gear = data.gear;
    tb_bosses = data.bosses;
    tb_abilities_factor = data.abilities_factor;
    tb_archimatos_ability_factor = data.archimatos_ability_factor;
    tb_equipment = data.equipment;
    tb_legendary_events = data["legendary-events"];
    latest_legendary_event = data["latest-legendary-event"];
    tb_chars_and_summons = Object.assign(tb_chars,tb_summons);
    Object.keys(tb_legendary_events).forEach(function (event) {
      var pointsAndOccurances = Object.values(tb_legendary_events[event]).map(Object.values).flat(1);
      var points = pointsAndOccurances.map(po => po[0]);
      var occurrances = pointsAndOccurances.map(po => po[1]);
      var sumPoints = points.reduce((partialSum, a) => partialSum + a, 0);
      legendaryEventFactors[event] = [sumPoints,0,0];
      [1,2].forEach(function (weight) {
        legendaryEventFactors[event][weight] = sumPoints / pointsAndOccurances.map(po => po[0]*calculateLegendaryEventWeight(po[1],weight)).reduce((partialSum, a) => partialSum + a, 0);
      });
      console.log(pointsAndOccurances);
      console.log(sumPoints);
      
      // legendaryEventFactors
    });
    // updateGear(); // Hard-coded into the HTML
    document.getElementById("tacticus-version").innerHTML=data.version;
    ["eldryon-buff", "thaddeus-buff", "shadowsun-buff", "calgar-buff", "abaddon-buff", "aethana-buff", "aunshi-buff", "darkstrider-buff", "helbrecht-buff", "ragnar-buff", "equipment"].forEach(function (key) {
      document.getElementById(key + "-rarity").innerHTML=document.getElementById("rarity-level").innerHTML;
    });
    addLegendaryEvents(latest_legendary_event);
    addTable();
    updateEldryon(1);
    updateAhriman(1);
    updateAbaddon(1);
    updateThaddeus(1);
    updateShadowsun(1);
    updateCalgar(1);
    updateAethana(1);
    updateAunShi(1);
    updateDarkstrider(1);
    updateHelbrecht(1);
    updateOpponentPreset(1);
    updateRagnar(1);
    updateTable();
  }
});

var addLegendaryEvents = function(latest_legendary_event) {
  legendaryEventsHtml = "";
  Object.keys(tb_legendary_events).forEach(function (name) {
    legendaryEventsHtml += '<option value="'+name+'"'+(name == latest_legendary_event ? " selected": "")+'>'+name+'</option>';
  });
  document.getElementById("legendary-event-select").innerHTML = legendaryEventsHtml;
  updateLegendaryEvent(1);
};

var updateLegendaryEvent = function(skipUpdate) {
  eventName = document.getElementById("legendary-event-select").value;
  eventData = tb_legendary_events[eventName];
  Object.keys(eventData).forEach(function(track) {
    res = "";
    Object.keys(eventData[track]).forEach(function(mission) {
      if (mission.includes("!")) return;
      res += '<input class="legendary-event-select-checkbox" onChange="updateFilter()" type="checkbox" id="legendary-event-filter-'+track+'-'+characterTableEntryId(mission)+'"></input> '+mission+'<br>'
    });
    document.getElementById("legendary-event-select-"+track).innerHTML = res;
  });
  if (1 != skipUpdate) {
    updateFilter();
    updateTable();
  }
};

var updateFilter = function() {
  var displayCharacters = document.getElementById("filter-characters").checked;
  var displaySummons = document.getElementById("filter-summons").checked;
  Object.keys(tb_chars_and_summons).forEach(function callback(key) {
    var id = characterTableEntryId(key);
    switch (document.getElementById("mode-select").value) {
    case 'damage':
    case 'survival':
      var style = document.getElementById(id).style;
      if (tb_chars_and_summons[key].traits.includes("summon") ? displaySummons : displayCharacters) {
        style.display = "";
      } else {
        style.display = "none";
      }
      return;
    case 'legendary':
      if (tb_chars_and_summons[key].traits.includes("summon")) return;
      var style = document.getElementById("legendary-"+id).style;
      if (!tb_chars_and_summons[key]["legendary-event"]) {
        style.display = "none";
        return;
      }
      var curEvent = document.getElementById("legendary-event-select").value;
      var charLegData = tb_chars_and_summons[key]["legendary-event"][curEvent];
      var globalLegData = tb_legendary_events[curEvent];
      if (!charLegData) {
        style.display = "none";
        return;
      }
      var filteredOut = false;
      Object.keys(globalLegData).forEach(function(track) {
        if (filteredOut) return;
        var foundEvents = true;
        Object.keys(globalLegData[track]).forEach(function(mission) {
          if (filteredOut) return;
          var idToLookFor = 'legendary-event-filter-'+track+'-'+characterTableEntryId(mission);
          if (document.getElementById(idToLookFor).checked && !charLegData[track].includes(mission)) {
            filteredOut = true;
            return;
          }
        });
      });
      style.display = filteredOut ? "none" : "";
      break;
    }
  });
}

var setAllFilters=function(className,checked) {
  var elements = document.getElementsByClassName(className);
  for (let i = 0; i < elements.length; i++) {
    elements[i].checked=checked;
  }
  updateFilter();
};

var levelToRarityInt = function(level) {
  return Math.min(Math.floor(level / 9), 4);
}

var passiveFactorActiveCharacterWithTable = function(tb_factor, level, rarity) {
  return tb_factor[level-1] * (1 + rarity*0.2);
}

var passiveFactorCharacter = function(name, level, rarity) {
  tb = name in ['Bloodletter','Archimatos'] ? tb_archimatos_ability_factor : tb_abilities_factor;
  factor = passiveFactorActiveCharacterWithTable(tb_abilities_factor, level, rarity);
  // console.log(name,level,rarity,factor);
  return factor;
}

var updateEldryon = function(skipUpdate) {
  if (!document.getElementById("eldryon-buff-enabled").checked) {
    document.getElementById("eldryon-buff-all").innerHTML = 0;
    document.getElementById("eldryon-buff-aeldari").innerHTML = 0;
    if (1 != skipUpdate) updateTable();
    return;
  }
  var level = document.getElementById("eldryon-buff-level").value;
  var factor = tb_abilities_factor[level-1] * (1 + document.getElementById("eldryon-buff-rarity").value*0.2);
  document.getElementById("eldryon-buff-all").innerHTML = Math.round(tb_chars["Eldryon"].passive[0]*factor);
  document.getElementById("eldryon-buff-aeldari").innerHTML = Math.round(tb_chars["Eldryon"].passive[1]*factor);
  if (1 != skipUpdate) updateTable();
};

var updateAhriman = function(skipUpdate) {
  if (!document.getElementById("ahriman-buff-enabled").checked) {
    if (1 != skipUpdate) updateTable();
    return;
  }
  if (1 != skipUpdate) updateTable();
};

var updateAbaddon = function(skipUpdate) {
  if (!document.getElementById("abaddon-buff-enabled").checked) {
    document.getElementById("abaddon-buff-dmg").innerHTML = 0;
    if (1 != skipUpdate) updateTable();
    return;
  }
  var level = document.getElementById("abaddon-buff-level").value;
  var factor = tb_abilities_factor[level-1] * (1 + document.getElementById("abaddon-buff-rarity").value*0.2);
  document.getElementById("abaddon-buff-dmg").innerHTML = Math.round(tb_chars["Abaddon"].passive[0]*factor);
  if (1 != skipUpdate) updateTable();
};
var updateThaddeus = function(skipUpdate) {
  if (!document.getElementById("thaddeus-buff-enabled").checked) {
    document.getElementById("thaddeus-buff-dmg").innerHTML = 0;
    if (1 != skipUpdate) updateTable();
    return;
  }
  var level = document.getElementById("thaddeus-buff-level").value;
  var factor = tb_abilities_factor[level-1] * (1 + document.getElementById("thaddeus-buff-rarity").value*0.2);
  document.getElementById("thaddeus-buff-dmg").innerHTML = Math.round(tb_chars["Thaddeus noble"].passive[0]*factor);
  if (1 != skipUpdate) updateTable();
}
var updateShadowsun = function(skipUpdate) {
  if (!document.getElementById("shadowsun-buff-enabled").checked) {
    document.getElementById("shadowsun-buff-dmg").innerHTML = 0;
    if (1 != skipUpdate) updateTable();
    return;
  }
  var level = document.getElementById("shadowsun-buff-level").value;
  var factor = tb_abilities_factor[level-1] * (1 + document.getElementById("shadowsun-buff-rarity").value*0.2);
  document.getElementById("shadowsun-buff-dmg").innerHTML = Math.round(tb_chars["Shadowsun"].passive[0]*factor);
  if (1 != skipUpdate) updateTable();
}
var updateRagnar = function(skipUpdate) {
  // ragnar-buff-crit-chance"></span>% crit chance +<span id="ragnar-buff-damage-percent"></span>% damage (max <span id="ragnar-buff-damage-cap
  if (!document.getElementById("ragnar-buff-enabled").checked) {
    document.getElementById("ragnar-buff-crit-chance").innerHTML = 0;
    document.getElementById("ragnar-buff-damage-percent").innerHTML = 0;
    document.getElementById("ragnar-buff-damage-cap").innerHTML = 0;
    if (1 != skipUpdate) updateTable();
    return;
  }
  var level = document.getElementById("ragnar-buff-level").value;
  var factor = tb_abilities_factor[level-1] * (1 + document.getElementById("ragnar-buff-rarity").value*0.2);
  console.log(tb_chars["Ragnar"]);
  document.getElementById("ragnar-buff-crit-chance").innerHTML = tb_chars["Ragnar"].active[0] + levelToRarityInt(level)*5 - (level < 50);
  document.getElementById("ragnar-buff-damage-percent").innerHTML = tb_chars["Ragnar"].active[1] + levelToRarityInt(level)*2 - 1;
  document.getElementById("ragnar-buff-damage-cap").innerHTML = Math.round(tb_chars["Ragnar"].active[2]*factor);
  if (1 != skipUpdate) updateTable();
}
var updateCalgar = function(skipUpdate) {
  if (!document.getElementById("calgar-buff-enabled").checked) {
    document.getElementById("calgar-buff-all").innerHTML = 0;
    document.getElementById("calgar-buff-imperial").innerHTML = 0;
    if (1 != skipUpdate) updateTable();
    return;
  }
  var level = document.getElementById("calgar-buff-level").value;
  var factor = tb_abilities_factor[level-1] * (1 + document.getElementById("calgar-buff-rarity").value*0.2);
  document.getElementById("calgar-buff-all").innerHTML = Math.round(tb_chars["Calgar"].passive[0]*factor);
  document.getElementById("calgar-buff-imperial").innerHTML = Math.round(tb_chars["Calgar"].passive[1]*factor);
  if (1 != skipUpdate) updateTable();
}
var updateAethana = function(skipUpdate) {
  if (!document.getElementById("aethana-buff-enabled").checked) {
    document.getElementById("aethana-buff-all").innerHTML = 0;
    document.getElementById("aethana-buff-aeldari").innerHTML = 0;
    document.getElementById("aethana-buff-crit").innerHTML = 0;
    if (1 != skipUpdate) updateTable();
    return;
  }
  var level = document.getElementById("aethana-buff-level").value;
  var factor = tb_abilities_factor[level-1] * (1 + document.getElementById("aethana-buff-rarity").value*0.2);
  document.getElementById("aethana-buff-all").innerHTML = Math.round(tb_chars["Aethana"].passive[0]*factor);
  document.getElementById("aethana-buff-aeldari").innerHTML = Math.round(tb_chars["Aethana"].passive[1]*factor);
  document.getElementById("aethana-buff-crit").innerHTML = Math.round(tb_chars["Aethana"].passive[2]+levelToRarityInt(level));
  if (1 != skipUpdate) updateTable();
}
var updateAunShi = function(skipUpdate) {
  if (!document.getElementById("aunshi-buff-enabled").checked) {
    document.getElementById("aunshi-buff-dmg").innerHTML = 0;
    if (1 != skipUpdate) updateTable();
    return;
  }
  var level = document.getElementById("aunshi-buff-level").value;
  var factor = tb_abilities_factor[level-1] * (1 + document.getElementById("aunshi-buff-rarity").value*0.2);
  document.getElementById("aunshi-buff-dmg").innerHTML = Math.round(tb_chars["Aun'Shi"].passive[1]*factor);
  if (1 != skipUpdate) updateTable();
}
var updateDarkstrider = function(skipUpdate) {
  if (!document.getElementById("darkstrider-buff-enabled").checked) {
    document.getElementById("darkstrider-buff-dmg").innerHTML = 0;
    if (1 != skipUpdate) updateTable();
    return;
  }
  var level = document.getElementById("darkstrider-buff-level").value;
  var factor = tb_abilities_factor[level-1] * (1 + document.getElementById("darkstrider-buff-rarity").value*0.2);
  document.getElementById("darkstrider-buff-dmg").innerHTML = Math.round(tb_chars["Darkstrider"].passive[0]*factor);
  if (1 != skipUpdate) updateTable();
}
var updateHelbrecht = function(skipUpdate) {
  if (!document.getElementById("helbrecht-buff-enabled").checked) {
    document.getElementById("helbrecht-buff-dmg").innerHTML = 0;
    if (1 != skipUpdate) updateTable();
    return;
  }
  var level = document.getElementById("helbrecht-buff-level").value;
  var factor = tb_abilities_factor[level-1] * (1 + document.getElementById("helbrecht-buff-rarity").value*0.2);
  document.getElementById("helbrecht-buff-dmg").innerHTML = Math.round(tb_chars["Helbrecht"].passive[0]*factor);
  if (1 != skipUpdate) updateTable();
}

var updateModeVisible = function(elements, display) {
  for (let i = 0; i < elements.length; i++) {
    elements[i].style.display=display;
  }
};

var updateMode = function(skipUpdateTable) {
  var mode = document.getElementById("mode-select").value;
  dmgOnly = document.getElementsByClassName("damage-mode-only");
  survivalOnly = document.getElementsByClassName("survival-mode-only");
  legendaryOnly = document.getElementsByClassName("legendary-mode-only");
  legendaryOverviewOnly = document.getElementsByClassName("legendary-overview-mode-only");
  dropratesOnly = document.getElementsByClassName("droprates-mode-only");
  apiOnly = document.getElementsByClassName("api-mode-only");
  switch (mode) {
    case "damage":
      updateModeVisible(survivalOnly, "none");
      updateModeVisible(legendaryOnly, "none");
      updateModeVisible(legendaryOverviewOnly, "none");
      updateModeVisible(dropratesOnly, "none");
      updateModeVisible(dmgOnly,"");
      updateModeVisible(apiOnly,"none");
    break;
  case "survival":
      updateModeVisible(dmgOnly,"none");
      updateModeVisible(legendaryOnly, "none");
      updateModeVisible(legendaryOverviewOnly, "none");
      updateModeVisible(dropratesOnly, "none");
      updateModeVisible(survivalOnly, "");
      updateModeVisible(apiOnly,"none");
    break;
  case "legendary":
      updateModeVisible(dmgOnly,"none");
      updateModeVisible(survivalOnly, "none");
      updateModeVisible(legendaryOverviewOnly, "none");
      updateModeVisible(dropratesOnly, "none");
      updateModeVisible(legendaryOnly, "");
      updateModeVisible(apiOnly,"none");
    break;
  case "legendary-overview":
      updateModeVisible(dmgOnly,"none");
      updateModeVisible(survivalOnly, "none");
      updateModeVisible(legendaryOnly, "none");
      updateModeVisible(dropratesOnly, "none");
      updateModeVisible(legendaryOverviewOnly, "");
      updateModeVisible(apiOnly,"none");
    break;
  case "droprates":
      updateModeVisible(dmgOnly,"none");
      updateModeVisible(survivalOnly, "none");
      updateModeVisible(legendaryOnly, "none");
      updateModeVisible(legendaryOverviewOnly, "none");
      updateModeVisible(dropratesOnly, "");
      updateModeVisible(apiOnly,"none");
    break;
  case "api":
      updateModeVisible(dmgOnly,"none");
      updateModeVisible(survivalOnly, "none");
      updateModeVisible(legendaryOnly, "none");
      updateModeVisible(legendaryOverviewOnly, "none");
      updateModeVisible(dropratesOnly, "none");
      updateModeVisible(apiOnly,"");
    break;
  default:
    console.log("Unknown mode to select:",mode)
  }
  if (!skipUpdateTable) {
    updateTable();
    updateFilter();
  }
}

var updateOpponentPreset = function(skipUpdateTable) {
  var ablativePlating = false;
  var mech = false;
  var psyker = false;
  var markerlight = false;
  var bigtarget = false;
  var revoltingresilience = false;
  var melee = false;
  var ltgb = true;
  var preset = document.getElementById("opponent-preset").value;
  var level = +document.getElementById("opponent-preset-level").value;
  var checkbox = document.getElementById("opponent-checkbox").checked;
  switch (preset.split(" ")[0]) {
    case 'rogal-dorn':
      ablativePlating = true;
    case "szarekh":
    case "ghazghkull":
      mech = true;
      bigtarget = true;
      break;
    case "mortarion":
      // demon = true;
      revoltingresilience = true;
      melee = true;
      ltgb = false;
    case "hive":
    case "tervigon":
      psyker = true;
      bigtarget = true;
      break;
    case 'screamer-killer':
    case 'tyranid':
    case 'triarchal menhir':
      bigtarget = true;
      break;
  }
  var updateOpponentPresetStat = function(stat) {
    if (!(preset in tb_bosses)) {
      console.log("Couldn't find boss " + preset);
    }
    var tb = tb_bosses[preset][stat];
    var statLevel = tb[level-1];
    var statMax = tb.filter(x => x != null).slice(-1)[0];
    if (statLevel || statMax) {
      var statUsed = statLevel || statMax;
      var statScale = tb_bosses[preset]["checkbox"][stat];
      var scale = 1.0;
      if (checkbox && statScale) {
        scale *= statScale
      }
      document.getElementById("opponent-" + stat).value = Math.round(statUsed[0]*scale);
      var season = '<abbr title="Guild raid season the data comes from">S' + statUsed[1] + '</abbr>';
      if (!statLevel) {
        document.getElementById("opponent-preset-comment").innerHTML = "Not found; using L" + (tb.findIndex(statLevel => statLevel == statMax) + 1) + " (" + season + ")";
      } else {
        document.getElementById("opponent-preset-comment").innerHTML = season;
      }
    } else {
      document.getElementById("opponent-preset-comment").innerHTML = stat + " unknown.";
    }
  }
  updateOpponentPresetStat("armour");
  updateOpponentPresetStat("damage");

  ["melee","ranged"].forEach(function x(it) {
    if (tb_bosses[preset][it]) {
      var extraHits = +(checkbox ? tb_bosses[preset]["checkbox"]["hits"] || 0 : 0);
      document.getElementById("opponent-"+it+"-hits").innerHTML = tb_bosses[preset][it]["hits"] + extraHits;
      document.getElementById("opponent-"+it+"-damage").innerHTML = document.getElementById("opponent-damage").value;
      document.getElementById("opponent-"+it+"-damage").value = document.getElementById("opponent-damage").value;
      document.getElementById("opponent-"+it+"-pierce").innerHTML = tb_bosses[preset][it]["pierce"];
    } else {
      document.getElementById("opponent-"+it+"-hits").innerHTML = 0;
      document.getElementById("opponent-"+it+"-damage").innerHTML = 0;
      document.getElementById("opponent-"+it+"-pierce").innerHTML = 0;
    }
  });

  console.log(preset.split(" ")[0],revoltingresilience,melee);
  document.getElementById("opponent-is-mech").checked = mech;
  document.getElementById("opponent-is-psyker").checked = psyker;
  document.getElementById("opponent-has-markerlight").checked = markerlight;
  document.getElementById("opponent-beast-snagga").checked = bigtarget;
  document.getElementById("opponent-revolting-resilience").checked = revoltingresilience;
  document.getElementById("opponent-punishes-melee").checked = melee;
  document.getElementById("opponent-punishes-ranged").checked = false;
  document.getElementById("opponent-ablative-plating").checked = ablativePlating;
  document.getElementById("ltgb-enabled").checked = ltgb;
  if (!skipUpdateTable) updateTable();
}

var updateGear = function() {
    res = "";
    tb_gear.forEach(function callback(v) {
        res += '<option value="'+v[1]+'"'+(v[1]==12 ? ' selected="selected"' : "")+'>'+v[0]+'</option>';
    });
    document.getElementById("gearlevel").innerHTML=res;
}

var characterTableEntryId = function(str) {
    return str.toLowerCase().replace(" ","");
}

var addTable = function() {
  var resDmg = "";
  var resSurvival = "";
  var resLeg = "";
  var resLegOverview = '<tr><th onClick="sortTable()">Name</th>';
  var resLegOverviewRow2 = '';
  var i = 1;
  Object.keys(tb_legendary_events).forEach(function(event) {
    if (event in obsoleteEvents) {
      return;
    }
    resLegOverview += '<th onClick="sortTable('+(i)+')">'+event+'</th>';
    resLegOverview += '<th onClick="sortTable('+(i+1)+')">Points</th>';
    i+=2;
  });
  resLegOverview += '<th onClick="sortTable('+(i)+')">Total</th>\n';
  resLegOverview += '<th onClick="sortTable('+(i+1)+')">Points</th>';
  resLegOverview += '</tr>\n';
  Object.keys(tb_chars).forEach(function callback(key) {
    var id = characterTableEntryId(key);
    resDmg += '<tr id="'+id+'"><td id="'+id+'-name">'+key+'</td><td class="statCell" id="'+id+'-dmg"></td><td class="statCell" id="'+id+'-crit-chance"></td><td class="statCell" id="'+id+'-crit-dmg"></td><td class="statCell" id="'+id+'-dmg-dealt"></td><td id="'+id+'-comment"></td></tr>';
    resSurvival += '<tr id="survival-'+id+'"><td>'+key+'</td><td class="statCell" id="'+id+'-health"></td><td class="statCell" id="'+id+'-armour"></td><td class="statCell" id="'+id+'-block-chance"></td><td class="statCell" id="'+id+'-block"></td><td class="statCell" id="'+id+'-worst-case-percentage"></td><td class="statCell" id="'+id+'-worst-case-attacks"></td><td id="'+id+'-comment-survival"></td></tr>';
    if (!tb_chars[key].traits.includes("summon")) {
      resLeg += '<tr id="legendary-'+id+'"><td>'+key+'</td><td id="'+id+'-leg-alpha" /><td id="'+id+'-leg-alpha-1" /><td id="'+id+'-leg-alpha-2" /><td id="'+id+'-leg-alpha-3" /><td id="'+id+'-leg-alpha-4" /><td id="'+id+'-leg-alpha-5" /><td id="'+id+'-leg-beta" /><td id="'+id+'-leg-beta-1" /><td id="'+id+'-leg-beta-2" /><td id="'+id+'-leg-beta-3" /><td id="'+id+'-leg-beta-4" /><td id="'+id+'-leg-beta-5" /><td id="'+id+'-leg-gamma" /><td id="'+id+'-leg-gamma-1" /><td id="'+id+'-leg-gamma-2" /><td id="'+id+'-leg-gamma-3" /><td id="'+id+'-leg-gamma-4" /><td id="'+id+'-leg-gamma-5" /><td id="'+id+'-leg-total" /></tr>';
      resLegOverview += '<tr id="legendary-overview-'+id+'"><td>'+key+'</td>';
      Object.keys(tb_legendary_events).forEach(function(event) {
        if (event in obsoleteEvents) {
          return;
        }
        var eventID = characterTableEntryId(event);
        var charID = id + "-leg-ov-" + eventID;
        resLegOverview += '<td id="'+charID+'-num" class="statCell">x</td><td id="'+charID+'-points" class="statCell">1</td>';
      });
      resLegOverview += '<td id="'+id+'-leg-ov-total-num" class="statCell">x</td><td id="'+id+'-leg-ov-total-points" class="statCell">1</td></tr>\n';
    }
  });
  document.getElementById("damage-table").innerHTML += resDmg;
  document.getElementById("survival-table").innerHTML += resSurvival;
  document.getElementById("legendary-table").innerHTML += resLeg;
  document.getElementById("legendary-overview-table").innerHTML += resLegOverview;
  updateMode(1);
  updateTable();
}
var round2 = function(num) {
  return Math.round( num * 100 + Number.EPSILON ) / 100;
}
var damageArmourOrPierce = function(dmg, armour, pierce, type, numArmourReduction) {
  var dmgAfterArmour = dmg;
  for (let i=0; i<numArmourReduction; i++) {
    dmgAfterArmour = Math.max(dmgAfterArmour-armour, dmgAfterArmour*pierce);
  }
  if (typeof type == 'undefined') {
    throw new Error('Did not get damage type');
  }
  if (type=="psychic" || type=="flame") {
    dmgAfterArmour = Math.min(dmgAfterArmour * ahrimanPercent, dmgAfterArmour + ahrimanMax);
  }
  return Math.max(1, dmgAfterArmour);
};

var ragnarBonusCritChance = 0;
var ragnarBonusDmgPercent = 0;
var ragnarBonusDmgCap = 0;

var calcDmgLowHigh = function(low, high, dmgFactor, aunshiBonusDmg, hits, armour, pierce, critChance, crit, type) {
  critChance = Math.min(critChance,1);
  numRounds = (aunshiBonusDmg > 0 ? 3 : 1) * (ragnarBonusCritChance > 0 ? 5 : 1);
  var total = 0;
  var opponentRevoltingResilienceScaling = 1.0;
  for (i=0; i<numRounds; i++) {
    var dmgLow = low+(i % 3 ? 0 : aunshiBonusDmg);
    var dmgHigh = high+(i % 3 ? 0 : aunshiBonusDmg);
    if (i % 5 == 0) {
      dmgLow = Math.min(dmgLow + ragnarBonusDmgCap, dmgLow * (1.0+ragnarBonusDmgPercent/100.0));
      dmgHigh = Math.min(dmgHigh + ragnarBonusDmgCap, dmgHigh * (1.0+ragnarBonusDmgPercent/100.0));
    };
    var numArmourReductionNonCrit = opponentAblativePlating && pierce < 0.6 ? 3 : 1;
    var perNonCrit = (damageArmourOrPierce(dmgLow, armour, pierce, type, numArmourReductionNonCrit) + damageArmourOrPierce(dmgHigh, armour, pierce, type, numArmourReductionNonCrit))*0.5;
    var perCrit =  (damageArmourOrPierce(dmgLow+crit, armour, pierce, type, 1) + damageArmourOrPierce(dmgHigh+crit, armour, pierce, type, 1))*0.5;
    var numRevoltingResilience = opponentRevoltingResilience;
    var critChanceThisRound = Math.min(1.0, critChance + ragnarBonusCritChance/100.0);
    for (n=1; n<=hits; n++) {
      var critCurHit = Math.pow(critChanceThisRound, n);
      total += perCrit * critCurHit + perNonCrit * (1-critCurHit) * opponentRevoltingResilienceScaling;
      if (opponentRevoltingResilience && (numRevoltingResilience-- <= 0)) {
        opponentRevoltingResilienceScaling *= 0.5;
      }
    };
  }
  return Math.round(dmgFactor*total) / numRounds;
};

var calcDmg = function(dmg, dmgFactor, aunshiBonusDmg, hits, armour, pierce, critChance, crit, type) {
  return calcDmgLowHigh(dmg*0.8, dmg*1.2, dmgFactor, aunshiBonusDmg, hits, armour, pierce, critChance, crit, type);
}
var insertIcon = function(name) {
  return '<img class="damage-icon" src="images/'+name+'.png" />'
}

var updateTable = function() {
    var isAPI = document.getElementById("gearlevel").value == "api";
    updateModeVisible(document.getElementsByClassName("non-api-only"), isAPI ? "none" : "");
    var opponentarmor = +document.getElementById("opponent-armour").value;
    var opponentMeleeDamage = +document.getElementById("opponent-melee-damage").innerHTML;
    var opponentMeleeHits = +document.getElementById("opponent-melee-hits").innerHTML;
    var opponentMeleePierce = +document.getElementById("opponent-melee-pierce").innerHTML;
    var opponentRangedDamage = +document.getElementById("opponent-ranged-damage").innerHTML;
    var opponentRangedHits = +document.getElementById("opponent-ranged-hits").innerHTML;
    var opponentRangedPierce = +document.getElementById("opponent-ranged-pierce").innerHTML;
    var preferEqCritDmg = +document.getElementById("prefer-eq-crit-dmg").value;
    // Tyrant max debuff is 60%
    var eldryondamage = +document.getElementById("eldryon-buff-all").innerHTML;
    var eldryondamageAeldari = +document.getElementById("eldryon-buff-aeldari").innerHTML;
    var equipmentEnabled = document.getElementById("equipment-enabled").checked;
    var equipmentRarityInt = +(document.getElementById("equipment-rarity").value);
    var equipmentRarity = intToRarity[equipmentRarityInt];
    var equipmentLevel = Math.min(equipmentRarityInt*2+3, document.getElementById("equipment-level").value) - 1;
    var heavyWeaponEnabled = document.getElementById("heavy-weapon-enabled").checked;
    var charRarity = +document.getElementById("rarity-level").value;
    var passiveLevel = +document.getElementById("skill-level").value;
    var passiveLevelAsRarityInt = levelToRarityInt(passiveLevel)
    var madeContact = document.getElementById("made-contact").checked;
    var opponentIsMech = document.getElementById("opponent-is-mech").checked;
    var opponentIsPsyker = document.getElementById("opponent-is-psyker").checked;
    var opponentHasMarkerlight = document.getElementById("opponent-has-markerlight").checked;
    var opponentBeastSnagga = document.getElementById("opponent-beast-snagga").checked;
    var opponentGetStuckIn = document.getElementById("opponent-get-stuck-in").checked;
    var weakerRearEnabled = document.getElementById("weaker-rear-enabled").checked;
    opponentAblativePlating = document.getElementById("opponent-ablative-plating").checked;
    opponentRevoltingResilience = document.getElementById("opponent-revolting-resilience").checked ? (document.getElementById("opponent-checkbox") ? 3 : 1) : 0;
    var abaddonPassive = document.getElementById("abaddon-buff-enabled").checked;
    var abaddonBonusDmg = +document.getElementById("abaddon-buff-dmg").innerHTML;
    var thaddeusPassive = document.getElementById("thaddeus-buff-enabled").checked;
    var thaddeusBonusDmg = +document.getElementById("thaddeus-buff-dmg").innerHTML;
    var shadowsunPassive = document.getElementById("shadowsun-buff-enabled").checked;
    var shadowsunBonusDmgRaw = +document.getElementById("shadowsun-buff-dmg").innerHTML;
    var calgarBonusDmg = +document.getElementById("calgar-buff-all").innerHTML;
    var calgarBonusDmgImperial = +document.getElementById("calgar-buff-imperial").innerHTML;
    var aethanaBonusDmg = +document.getElementById("aethana-buff-all").innerHTML;
    var aethanaBonusDmgAeldar = +document.getElementById("aethana-buff-aeldari").innerHTML;
    var aethanaBonusCritChance = +document.getElementById("aethana-buff-crit").innerHTML;
    var aunshiBonusDmgRawData = +document.getElementById("aunshi-buff-dmg").innerHTML;
    var darkstriderBonusDmgRawData = +document.getElementById("darkstrider-buff-dmg").innerHTML;
    var helbrechtBonusDmgRawData = opponentIsPsyker ? +document.getElementById("helbrecht-buff-dmg").innerHTML : 0;
    var ltgbEnabled = document.getElementById("ltgb-enabled").checked;
    var curEvent = document.getElementById("legendary-event-select").value;
    var legendaryPointsWeight = +document.getElementById("legendary-points-weight").value;
    var opponentPunishesMelee = document.getElementById("opponent-punishes-melee").checked;
    var opponentPunishesRanged = document.getElementById("opponent-punishes-ranged").checked;
    ahrimanEnabled = document.getElementById("ahriman-buff-enabled").checked;
    ahrimanPercent = 1+(ahrimanEnabled ? (document.getElementById("ahriman-buff-percent").innerHTML / 100) : 0);
    ahrimanMax = ahrimanEnabled ? (+document.getElementById("ahriman-buff-max").innerHTML) : 0;
    
    Object.keys(tb_chars_and_summons).forEach(function callback(key) {
        var comment = "";
        var starlevel = 0;
        var gearlevel = 0;
        var rarity = 0;
        var passiveSkillLevel = 0;

        if (isAPI && key in playerUnits) {
          var progression = playerUnits[key].progressionIndex;
          rarity = apiProgressionIndexToRarity[progression];
          starlevel = progression - rarity;
          gearlevel = playerUnits[key].rank;
          passiveSkillLevel = playerUnits[key].abilities[1].level;
        } else if (!isAPI) {
          rarity = +document.getElementById("rarity-level").value;
          starlevel = +document.getElementById("starlevel").value;
          gearlevel = +document.getElementById("gearlevel").value;
          passiveSkillLevel = +document.getElementById("skill-level").value;
        } else if (key in playerUnitShards) {
          comment += "Not unlocked";
        } else {
          comment += "API name mismatch in DB and API";
        }
        
        var levelStatFactor = Math.pow(1.25205, gearlevel)*(1+0.1*starlevel);

        entryId = characterTableEntryId(key);
        var char = tb_chars[key];
        var passiveFactor = passiveFactorCharacter(key, passiveSkillLevel, rarity);
        var levelStatFactorCurUnit = char.traits.includes("summon") ? passiveFactor : levelStatFactor;
        var health = char.health*levelStatFactorCurUnit;
        var armour = char.armour*levelStatFactorCurUnit;
        var dmg = char.damage*levelStatFactorCurUnit;
        var meleeHits = char.melee.hits;
        var critChance = 0;
        var critDamage = 0;
        var critChanceRanged = 0;
        var critDamageRanged = 0;
        var blockChance = 0;
        var block = 0;
        var buffDmg = 0;
        var dmgFactor = 1.0;
        var dmgFactorMelee = 1.0;
        var dmgFactorRanged = 1.0;
        var dmgFactorMeleeTaken = 1.0;
        var abaddonBonusDmgModifiedByFaction = (char.alliance == "Chaos" ? abaddonBonusDmg : 0)
        var eldryondamageModifiedByFaction = eldryondamage + (char.faction == "Aeldari" ? eldryondamageAeldari : 0.0);
        var calgardamageModifiedByFaction = (char.alliance == "Imperial" ? calgarBonusDmgImperial : calgarBonusDmg)
        var aethanadamageModifiedByFaction = aethanaBonusDmg + (char.faction == "Aeldari" ? aethanaBonusDmgAeldar : 0.0);
        var shadowsunBonusDmg = key.includes("ShadowSun") ? 0 : shadowsunBonusDmgRaw;
        var ltgbHits = (abaddonPassive || key=="Abaddon") ? 2 : 1;
        var aunshiBonusDmg = key.includes("Aun'Shi")  ? 0 : aunshiBonusDmgRawData;
        var darkstriderBonusDmg = (key.includes("Darkstrider") || !opponentHasMarkerlight) ? 0 : darkstriderBonusDmgRawData;
        var helbrechtBonusDmg = key.includes("Helbrecht") ? 0 : helbrechtBonusDmgRawData;
        var buffDmgRanged = 0;
        var buffDmgMelee = 0;
        var commentRanged = "";
        var commentMelee = "";
        var commentSurvival = "";
        var charLegData = char["legendary-event"] ? char["legendary-event"] : null;
        var numArmourReduction = 1;
        var aunshiBonusDmg = key.includes("Aun'shi") ? passiveFactor*char.passive[1] : aunshiBonusDmgRawData;
        var getStuckInChance = char.traits.includes("get stuck in") ? (opponentGetStuckIn ? 1.0 : 0.3) : 0.0;
        if (char.ranged) {
          ragnarBonusCritChance = 0;
          ragnarBonusDmgPercent = 0;
          ragnarBonusDmgCap = 0;
        } else {
          ragnarBonusCritChance = +document.getElementById("ragnar-buff-crit-chance").innerHTML;
          ragnarBonusDmgPercent = +document.getElementById("ragnar-buff-damage-percent").innerHTML;
          ragnarBonusDmgCap = +document.getElementById("ragnar-buff-damage-cap").innerHTML;
        }
        if (weakerRearEnabled) {
          critChance += 0.5;
        }


        if (key != "Aethana") {
          critChance += aethanaBonusCritChance*0.01;
        }

        if (opponentHasMarkerlight && char.faction == "T'au Empire") {
          dmgFactorRanged *= 1.15;
        }
        
        char.traits.forEach(function (trait) {
          switch (trait) {
            case "beast slayer":
            case "beast snagga":
              if (opponentBeastSnagga) {
                dmgFactorMelee *= 1.20;
              }
              break;
            case "close combat weakness":
              dmgFactorMelee *= 0.50;
              break;
            case "heavy weapon":
              if (thaddeusPassive) {
                buffDmg += thaddeusBonusDmg;
              }
              if (heavyWeaponEnabled) {
                dmgFactorRanged *= 1.25;
                commentRanged += "heavy";
                if (key=="Maugan Ra") {
                  var mauganCritChance = (char.passive[1] + passiveLevelAsRarityInt - (passiveLevelAsRarityInt==0 ? 1 : 0)) / 100;
                  var mauganCritDamage = char.passive[0] * passiveFactor;
                  critChanceRanged += mauganCritChance;
                  critDamageRanged += mauganCritDamage;
                }
              }
              break;
            case "crushing strike":
              if (heavyWeaponEnabled) {
                dmgFactorMelee *= 1.5;
                commentMelee += "crushing";
              }
              break;
            case "terrifying":
              dmgFactorMeleeTaken *= 0.7;
              commentSurvival = "terrifying";
              break;
            case "mk x gravis":
              numArmourReduction += 1;
              commentSurvival = "gravis";
              break;
            case "get stuck in":
              break;
            case "ambush":
            case "battle fatigue":
            case "blessings of khorne":
            case "diminutive":
            case "let the galaxy burn":
            case "terminator armour":
            case "resilient":
            case "flying":
            case "deep strike":
            case "living metal":
            case "mechanic":
            case "final vengeance":
            case "act of faith":
            case "big target":
            case "infiltrate":
            case "healer":
            case "suppressive fire":
            case "indirect fire":
            case "networked targeting":
            case "psyker":
            case "psychic": // Typo in speadsheet?
            case "daemon":
            case "explodes":
            case "overwatch":
            case "contagions of nurgle":
            case "mechanical":
            case "mounted":
            case "vehicle":
            case "parry":
            case "summon":
            case "swarm":
            case "unstoppable":
            case "camouflage":
            case "putrid explosion":
            case "synapse":
            case "shadow in the warp":
            case "weaver of fates": // Does impact damage, but only with multiple psykers...
              break;
            default:
              console.log("Unknown trait:", trait);
          }
        });

        switch (key) {
        case "Bloodletter":
          if (opponentIsPsyker) {
            meleeHits += 1;
          }
          break;
        case 'Incisus':
          var incisusFactor = 1+Math.min(0.05*gearlevel,0.3);
          health *= incisusFactor;
          armour *= incisusFactor;
          dmg *= incisusFactor;
          break;
        case 'Helbrecht':
          if (opponentIsPsyker && !opponentPunishesMelee) {
            helbrechtBonusDmg += passiveFactor*char.passive[0];
            comment += "psyker +" + Math.round(helbrechtBonusDmg);
          }
          break;
        case 'Tjark':
        case 'Roswitha':
          if (opponentIsPsyker) {
            buffDmg += passiveFactor*char.passive[0];
            comment += "psyker +" + Math.round(buffDmg);
          }
          break;
        case 'Kut':
        case 'Angrax':
          if (madeContact) {
            var passiveDmg = char.passive[key=="Kut" ? 0 : 2] * passiveFactor;
            buffDmg += passiveDmg;
            comment += "contact (+" + Math.round(passiveDmg) + ")";
          }
          break;
        case 'Godswyl':
          var passiveDmg = char.passive[0] * passiveFactor;
          critDamage += passiveDmg;
          break;
        case 'Abaddon':
          abaddonBonusDmgModifiedByFaction = 0;
          break;
        case 'Calgar':
          calgardamageModifiedByFaction = 0;
          break;
        case 'Aethana':
          aethanadamageModifiedByFaction = 0;
          break;
        case 'Bloodletter':
        case 'Bloodletter (v1.6)':
          if (madeContact) {
            meleeHits += 1;
          }
          break;
        case 'Tanksmasha':
          buffDmgMelee += passiveFactor*char.passive[0];
          break;
        case 'Abraxas':
        case 'Aleph-Null':
        case 'Thoread':
        case 'Anuphet':
        case 'Archimatos':
        case 'Arjac':
        case "Aun'Shi":
        case "Azrael":
        case 'Bellator':
        case 'Blue Horror':
        case 'Gulgortz':
        case 'Jaeger':
        case 'Cadian Guardsman':
        case 'Command-Link Drone':
        case 'Colour Sergeant Kell':
        case 'Calandis':
        case 'Creed':
        case 'Celestine':
        case 'Certus':
        case 'Yarrick':
        case 'Corrodius':
        case 'Darkstrider':
        case 'Geminae Superia':
        case 'Gibbascrapz':
        case 'Grot':
        case 'Grot Tank':
        case 'Haarken':
        case 'Imospekh':
        case 'Inceptor':
        case 'Isabella':
        case 'Jain Zar':
        case 'Makhotep':
        case 'Maladus':
        case 'Maugan Ra':
        case 'Morvenn Vahl':
        case 'MV71 Sniper Drone':
        case 'Necron warrior':  
        case 'Rotbone':
        case 'Pink Horror':
        case 'Pox Walkers':
        case "Re'vas":
        case "Sarquael":
        case "Scarab Swarm":
        case "Screamer of Tzeentch":
        case "Shadowsun":
        case "Shield Drone":
        case "Sho'syl":
        case 'Sibyll':
        case 'Thaumachus':
        case 'Thaddeus':
        case 'Thutmose':
        case 'Toth':
        case 'Typhus':
        case 'Ulf':
        case 'Tigurius':
        case 'Vindicta':
        case 'Volk':
        case 'Winged Prime':
        case 'Yazaghor':
          break;
        case 'Eldryon':
          eldryondamageModifiedByFaction = 0;
          break;
        case 'Pestillian':
          break;
        default:
          comment += "TODO: Add passive";
        }
        
        if (equipmentEnabled && char.equipment) {
          Object.keys(char.equipment).forEach(function equip(eqKey) {
            var eqCount = char.equipment[eqKey];
            var curEq = tb_equipment[eqKey];
            var curChance = Object.keys(curEq).filter(function (chance) { return curEq[chance]["factions"].includes(char.faction) && curEq[chance][equipmentRarity]; });

            if (curChance.length == 0) {
              comment += "Faction does not have " + eqKey + " equipment?";
              return;
            }

            if (preferEqCritDmg && eqKey=="crit") {
              selectedChance = Math.min(...curChance);
            } else {
              selectedChance = Math.max(...curChance);
            }
            eqStats = curEq[selectedChance][equipmentRarity];
            if (eqKey=="crit") {
              critChance += 1.0 - Math.pow((100-selectedChance)/100, eqCount);
            }
            if (eqKey=="crit_booster") {
              critChance += (equipmentRarityInt+1)/100;
            }
            if (eqKey=="block") {
              blockChance += 1.0 - Math.pow((100-selectedChance)/100, eqCount);
            }
            if (eqKey=="block_booster") {
              blockChance += (equipmentRarityInt+1)/100;
            }
            Object.keys(eqStats).forEach(function (stat) {
              switch (stat) {
              case "health":
                health += eqCount*eqStats[stat][equipmentLevel];
                break;
              case "armour":
                armour += eqCount*eqStats[stat][equipmentLevel];
                break;
              case "block":
                block += eqCount*eqStats[stat][equipmentLevel];
                break;
              case "crit-dmg":
                critDamage += eqCount*eqStats[stat][equipmentLevel];
                break;
              default:
                console.log("Unknown stat in equipment:", stat);
              }
            });
          });
        }

        buffDmg += eldryondamageModifiedByFaction + calgardamageModifiedByFaction + abaddonBonusDmgModifiedByFaction + aethanadamageModifiedByFaction;
        buffDmgMelee += helbrechtBonusDmg;
        buffDmgRanged += darkstriderBonusDmg + shadowsunBonusDmg;
       
        // Melee damage
        var totalDmg = 0;
        if (!opponentPunishesMelee) {
          totalDmg = calcDmg(dmg+buffDmg+buffDmgMelee, dmgFactor*dmgFactorMelee, aunshiBonusDmg, meleeHits + (meleeHits / 2 | 0) * getStuckInChance, opponentarmor, char.melee.pierce, critChance, critDamage, char.melee.type);
          switch (key) {
            case 'Gulgortz':
              totalDmg += calcDmgLowHigh(passiveFactor*char.passive[0], passiveFactor*char.passive[1], dmgFactor, 0, 3 + getStuckInChance, opponentarmor, char.ranged.pierce, critChance, critDamage, char.ranged.type);
              break;
          }
          if (ltgbEnabled && char.traits.includes("let the galaxy burn")) {
            var galaxyDmg = calcDmg(dmg+buffDmg+buffDmgMelee, dmgFactor*dmgFactorMelee, 0, ltgbHits, opponentarmor, char.melee.pierce, critChance, critDamage, char.melee.type);
            totalDmg += galaxyDmg * 0.5;
            // comment += "LtGB assumes hits on target"
          }
        }
        if (char.hasOwnProperty("ranged") && !opponentPunishesRanged) {
          // Ranged damage
          var rangedDmg = calcDmg(dmg+buffDmg+buffDmgRanged, dmgFactor*dmgFactorRanged, aunshiBonusDmg, char.ranged.hits + (char.ranged.hits / 2 | 0) * getStuckInChance, opponentarmor, char.ranged.pierce, critChance + critChanceRanged, critDamage + critDamageRanged, char.ranged.type);
          if (shadowsunPassive && char.faction.includes("T'au") && key != "ShadowSun") {
            rangedDmg = [0.2,0.3,0.4,0.5,0.6].map(function(round) {
              var rangedDmgTauProc = calcDmg(dmg+buffDmg+buffDmgRanged, dmgFactor*dmgFactorRanged, aunshiBonusDmg, char.ranged.hits + 1, opponentarmor, char.ranged.pierce, critChance + critChanceRanged, critDamage + critDamageRanged, char.ranged.type);
              return (1-round) * rangedDmg + round * rangedDmgTauProc;
            }).reduce((a,b) => a+b) / 5;
            comment += "Shadowsun+T'au";
          }
          switch (key) {
            case 'Gulgortz':
              totalDmg += calcDmgLowHigh(passiveFactor*char.passive[0], passiveFactor*char.passive[1], dmgFactor, 0, 3 + getStuckInChance, opponentarmor, char.ranged.pierce, critChance, critDamage, char.ranged.type);
              break;
          case 'Volk':
            var volkDamageBuff = passiveFactor*char.passive[0];
            var volkDamage = calcDmg(dmg+buffDmg+volkDamageBuff, dmgFactor*dmgFactorRanged, 0, char.ranged.hits, opponentarmor, char.ranged.pierce + 0.2, critChance + critChanceRanged, critDamage + critDamageRanged, char.ranged.type);
            comment += "passive (+"+Math.round(volkDamageBuff)+")";
            rangedDmg = rangedDmg*0.7 + volkDamage*0.3;
            break;
          case "Re'Vas":
            var revasPassiveDmgLow = passiveFactor*char.passive[0];
            var revasPassiveDmgHigh = passiveFactor*char.passive[1];
            var revasPassiveOverload = (opponentHasMarkerlight || opponentIsMech) ? passiveFactor*char.passive[2] : 0;
            var revasPassiveDmg = calcDmgLowHigh(revasPassiveDmgLow+revasPassiveOverload, revasPassiveDmgHigh+revasPassiveOverload, dmgFactor*dmgFactorRanged, 0, 3, opponentarmor, 0.35, critChance + critChanceRanged, critDamage + critDamageRanged, "Particle");
            rangedDmg += revasPassiveDmg;
            totalDmg += revasPassiveDmg*dmgFactorMelee;
            comment += "3x "+Math.round(revasPassiveDmgLow)+"-"+Math.round(revasPassiveDmgHigh)+" +" +Math.round(revasPassiveOverload);
            break;
          }
          if (ltgbEnabled && char.traits.includes("let the galaxy burn")) {
            var galaxyDmg = calcDmg(dmg+buffDmg, dmgFactor*dmgFactorRanged, aunshiBonusDmg, ltgbHits, opponentarmor, char.ranged.pierce, critChance + critChanceRanged, critDamage + critDamageRanged, char.ranged.type);
            rangedDmg += galaxyDmg * 0.5;
          }
          if (rangedDmg > totalDmg) {
            totalDmg = rangedDmg;
            comment = insertIcon("boltgun") + commentRanged + comment;
          } else {
            comment = "⚔" + commentMelee + comment;
          }
        } else {
          comment = "⚔" + commentMelee + comment;
        }

        var calcOpponentDamageWorstCase = function(dmg,hits,pierce) {
          var res = dmg;
          res = damageArmourOrPierce(res,armour,pierce,"Boss",numArmourReduction);
          return res*hits;
        };
        opponentDmgPerAttack = Math.max(
          dmgFactorMeleeTaken*calcOpponentDamageWorstCase(opponentMeleeDamage, opponentMeleeHits, opponentMeleePierce),
          calcOpponentDamageWorstCase(opponentRangedDamage, opponentRangedHits, opponentRangedPierce));
        
        if (charLegData) {
          var allEventsEligible = 0;
          var allEventsPoints = 0;
          Object.keys(tb_legendary_events).forEach(function(event) {
            var globalLegData = tb_legendary_events[event];
            var totalSum = 0;
            var sumEligible=0;
            Object.keys(globalLegData).forEach(function(track) {
              var trackData = globalLegData[track];
              var i=5;
              var sum=0;
              var eligible = charLegData[event][track].includes("!");
              Object.keys(trackData).reverse().forEach(function(mission) {
                var idMission = entryId+"-leg-"+track+(i ? ("-"+i) : "");
                if (eligible && charLegData[event][track].includes(mission)) {
                  var points = trackData[mission][0];
                  var weight = 1;
                  if (legendaryPointsWeight) {
                    weight = legendaryEventFactors[event][legendaryPointsWeight] * calculateLegendaryEventWeight(trackData[mission][1], legendaryPointsWeight);
                  }
                  points *= weight;
                  sum += points;
                  if (mission != "!") {
                    sumEligible += weight;
                  }
                  if (curEvent==event) {
                    document.getElementById(idMission).innerHTML = i==0 ? Math.round(sum) : Math.round(points);
                  }
                } else {
                  if (curEvent==event) {
                    document.getElementById(idMission).innerHTML = "";
                  }
                }
                i--;
              });
              totalSum += sum;
            });
            if (curEvent==event) {
              document.getElementById(entryId+"-leg-total").innerHTML = Math.round(totalSum);
            }
            if (event in obsoleteEvents) {
            } else {
              document.getElementById(entryId+"-leg-ov-"+characterTableEntryId(event)+"-points").innerHTML = Math.round(totalSum);
            document.getElementById(entryId+"-leg-ov-"+characterTableEntryId(event)+"-num").innerHTML = round2(sumEligible);
              allEventsEligible += sumEligible;
              allEventsPoints += totalSum;
            }
          });
          document.getElementById(entryId+"-leg-ov-total-points").innerHTML = Math.round(allEventsPoints);
          document.getElementById(entryId+"-leg-ov-total-num").innerHTML = round2(allEventsEligible);
        }
          

        document.getElementById(entryId+"-name").innerHTML='<abbr title="'+key+': '+intToRarity[rarity]+', '+gearLevelToText[gearlevel]+', P'+passiveSkillLevel+'">'+key+"</abbr>";
        document.getElementById(entryId+"-health").innerHTML=Math.round(health);
        document.getElementById(entryId+"-armour").innerHTML=Math.round(armour);
        document.getElementById(entryId+"-dmg").innerHTML=Math.round(dmg);
        document.getElementById(entryId+"-dmg-dealt").innerHTML=Math.round(totalDmg);
        document.getElementById(entryId+"-crit-chance").innerHTML=round2(critChance);
        document.getElementById(entryId+"-crit-dmg").innerHTML=Math.round(critDamage);
        document.getElementById(entryId+"-block-chance").innerHTML=round2(blockChance);
        document.getElementById(entryId+"-block").innerHTML=block;
        document.getElementById(entryId+"-comment").innerHTML=comment;
        document.getElementById(entryId+"-comment-survival").innerHTML=commentSurvival;
        document.getElementById(entryId+"-worst-case-percentage").innerHTML=Math.round(100 * opponentDmgPerAttack / health);
        document.getElementById(entryId+"-worst-case-attacks").innerHTML=Math.floor(health / opponentDmgPerAttack);
    });
}

function sortTable(n) {
  var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
  table = document.getElementById(document.getElementById("mode-select").value+"-table");
  switching = true;
  // Set the sorting direction to ascending:
  dir = "asc";
  /* Make a loop that will continue until
  no switching has been done: */
  while (switching) {
    // Start by saying: no switching is done:
    switching = false;
    rows = table.rows;
    /* Loop through all table rows (except the
    first, which contains table headers): */
    for (i = 1; i < (rows.length - 1); i++) {
      // Start by saying there should be no switching:
      shouldSwitch = false;
      /* Get the two elements you want to compare,
      one from current row and one from the next: */
      x = rows[i].getElementsByTagName("TD")[n];
      y = rows[i + 1].getElementsByTagName("TD")[n];
      /* Check if the two rows should switch place,
      based on the direction, asc or desc: */
      if (dir == "asc") {
        if (1==x.innerHTML.localeCompare(y.innerHTML, undefined, {numeric: true, sensitivity: 'base'})) {
          // If so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      } else if (dir == "desc") {
        if (-1==x.innerHTML.localeCompare(y.innerHTML, undefined, {numeric: true, sensitivity: 'base'})) {
          // If so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      }
    }
    if (shouldSwitch) {
      /* If a switch has been marked, make the switch
      and mark that a switch has been done: */
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      // Each time a switch is done, increase this count by 1:
      switchcount ++;
    } else {
      /* If no switching has been done AND the direction is "asc",
      set the direction to "desc" and run the while loop again. */
      if (switchcount == 0 && dir == "asc") {
        dir = "desc";
        switching = true;
      }
    }
  }
}

playerDataAPI = null;
playerUnits = null;
playerUnitShards = null; // Used to figure out the names of characters in the API
apiProgressionIndexToRarity = [
  0, // 0=common
  0,
  0,
  1, // 3=uncommon
  1,
  1,
  2, // 6=rare
  2,
  2,
  3, // 9=epic
  3,
  3,
  4, // 12=legendary
  4,
  4,
  4
];

function loadCharacterAbilities(char, isPassive) {
  id = char.toLowerCase().replace("'","");
  document.getElementById(id+"-buff-rarity").value = apiProgressionIndexToRarity[playerUnits[char].progressionIndex];
  document.getElementById(id+"-buff-level").value = playerUnits[char].abilities[isPassive].level;
};

function loadPlayerDataAPI() {
  if (playerDataAPI == null) return;
  d = new Date(1000 * playerDataAPI.metaData.lastUpdatedOn);
  document.getElementById("player-data-last-updated").innerHTML = d;
  document.getElementById("gearlevel").value = "api";
  playerUnits = Object.fromEntries(playerDataAPI.player.units.map(obj => [obj.name.replace("Nauseous","Rotbone"), obj]));
  playerUnitShards = Object.fromEntries(playerDataAPI.player.inventory.shards.map(obj => [obj.name.replace(" Shards",""), obj]));
  console.log(playerUnits);
  ["Ragnar"].map(it => loadCharacterAbilities(it, isPassive=0));
  ["Abaddon","Aethana","Aun'Shi","Calgar","Darkstrider","Eldryon","Helbrecht","Shadowsun","Thaddeus"].map(it => loadCharacterAbilities(it, isPassive=1));
  updateTable();
};

function setAPICache(event) {
  event.preventDefault();

  const apiKey = document.getElementById("api-key").value;
  try {
    const origUrl = "https://api.tacticusgame.com/api/v1/player";
    const url = 'https://proxy.cors.sh/' + origUrl;
    fetch(url, {
      method: "GET",
      withCredentials: true,
      headers: {
        "accept": "application/json",
        "X-API-KEY": apiKey
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      };
      return response.json();
    }).then(json => {
      localStorage.setItem("api-key", apiKey);
      localStorage.setItem("playerData", JSON.stringify(json));
      playerDataAPI = json;
      loadPlayerDataAPI();
    });
  } catch (error) {
    alert(error.message);
  }
  return false;
};

function loadAPICache() {
  document.getElementById("api-key").value = localStorage.getItem("api-key");
  playerDataAPI = JSON.parse(localStorage.getItem("playerData"));
  loadPlayerDataAPI();
};