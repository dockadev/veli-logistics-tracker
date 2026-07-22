import { ITEM_CODENAMES } from './itemCodenames';

export interface ParsedStockpile {
  location: string; // e.g. "Ash Fields - Seaport - VELI-ASH-C"
  region: string; // e.g. "Ash Fields"
  townName: string | null;
  timestamp: string; // ISO string
  items: Record<string, number>; // itemName -> quantity
}

class BinaryReader {
  private buffer: Uint8Array;
  public offset: number = 0;
  private view: DataView;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  readInt32(): number {
    if (this.offset + 4 > this.buffer.length) return 0;
    const val = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readInt64(): number {
    // Read low 32-bit (sizes and ticks fit in low 32-bit for our purposes)
    const low = this.readInt32();
    // skip high 32-bit
    this.readInt32();
    return low;
  }

  readInt16(): number {
    if (this.offset + 2 > this.buffer.length) return 0;
    const val = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return val;
  }

  readFloat(): number {
    if (this.offset + 4 > this.buffer.length) return 0;
    const val = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readByte(): number {
    if (this.offset + 1 > this.buffer.length) return 0;
    const val = this.buffer[this.offset];
    this.offset += 1;
    return val;
  }

  readString(): string {
    if (this.offset + 4 > this.buffer.length) return "";
    const len = this.readInt32();
    if (len === 0) return "";
    if (len < 0) {
      // UTF-16
      const u16Len = -len;
      if (this.offset + u16Len * 2 > this.buffer.length) return "";
      const strBytes = this.buffer.slice(this.offset, this.offset + (u16Len - 1) * 2);
      this.offset += u16Len * 2;
      return new TextDecoder("utf-16le").decode(strBytes);
    }
    if (this.offset + len > this.buffer.length) return "";
    const strBytes = this.buffer.slice(this.offset, this.offset + len - 1);
    this.offset += len;
    return new TextDecoder("utf-8").decode(strBytes);
  }
}

// Maps Unreal Hex Names to standard English region names in the app
const MAP_HEX_TO_REGION: Record<string, string> = {
  "AcrithiaHex": "Acrithia",
  "AllodsBightHex": "Allod's Bight",
  "AshFieldsHex": "Ash Fields",
  "BasinSionnachHex": "Basin Sionnach",
  "BastardTongueHex": "Bastard's Tongue",
  "BroadPatchesHex": "Broad Patches",
  "CallahansPassageHex": "Callahan's Passage",
  "CallumsCapeHex": "Callum's Cape",
  "ClansheadValleyHex": "Clanshead Valley",
  "ColonialHomeRegionHex": "Colonial Home Region",
  "DeadlandsHex": "Deadlands",
  "DrownedValeHex": "The Drowned Vale",
  "EndlessShoreHex": "Endless Shore",
  "FarranacCoastHex": "Farranac Coast",
  "FishermansRowHex": "Fisherman's Row",
  "GodcroftsHex": "Godcrofts",
  "GreatMarchHex": "Great March",
  "HeartlandsHex": "The Heartlands",
  "HowlCountyHex": "Howl County",
  "KalokaiHex": "Kalokai",
  "KingsCageHex": "King's Cage",
  "KuuraStrandHex": "Kuura Strand",
  "LinnOfMercyHex": "The Linn of Mercy",
  "LochMorHex": "Loch Mór",
  "LykosIsleHex": "Lykos Isle",
  "MarbanHollowHex": "Marban Hollow",
  "MorgensCrossingHex": "Morgen's Crossing",
  "NevishLineHex": "Nevish Line",
  "OathsHex": "The Oaths",
  "OlavisWakeHex": "Olavi's Wake",
  "OnyxHex": "Ónyx",
  "OriginHex": "Origin",
  "PalantineBermHex": "Palantine Berm",
  "PariPeakHex": "Pari Peak",
  "PipersEnclaveHex": "Piper's Enclave",
  "ReachingTrailHex": "Reaching Trail",
  "ReaversPassHex": "Reaver's Pass",
  "RedRiverHex": "Red River",
  "SableportHex": "Sableport",
  "ShackledChasmHex": "Shackled Chasm",
  "SpeakingWoodsHex": "Speaking Woods",
  "StemaLandingHex": "Stema Landing",
  "SteneumHex": "Steneum",
  "StlicanShelfHex": "Stlican Shelf",
  "StonecradleHex": "Stonecradle",
  "StygianSwampHex": "Stygian Swamp",
  "TempesthavenHex": "Tempest Island",
  "TerminusHex": "Terminus",
  "TheClahstraHex": "The Clahstra",
  "TheDrownedValeHex": "The Drowned Vale",
  "TheFingersHex": "The Fingers",
  "TheGutterHex": "The Gutter",
  "TheHeartlandsHex": "The Heartlands",
  "TheLinnOfMercyHex": "The Linn of Mercy",
  "TheMoorsHex": "The Moors",
  "TheOarbreakerIslesHex": "The Oarbreaker Isles",
  "TyrantFoothillsHex": "Tyrant Foothills",
  "UmbralWildwoodHex": "Umbral Wildwood",
  "ViperPitHex": "Viper Pit",
  "WardenHomeRegionHex": "Warden Home Region",
  "WeatheredExpanseHex": "Weathered Expanse",
  "WestgateHex": "Westgate",
  "WrestaHex": "Wresta"
};

function cleanHexMapName(hexName: string): string {
  // EWorldConquestMapId::AshFieldsHex -> AshFieldsHex
  const parts = hexName.split('::');
  const base = parts[parts.length - 1];
  if (MAP_HEX_TO_REGION[base]) return MAP_HEX_TO_REGION[base];
  const cleaned = base.replace(/Hex$/, '').replace(/([A-Z])/g, ' $1').trim();
  return cleaned;
}

function parseStructProperties(r: BinaryReader): Record<string, any> {
  const props: Record<string, any> = {};
  while (true) {
    const name = r.readString();
    if (name === "None" || name === "") {
      break;
    }
    const type = r.readString();
    const size = r.readInt32();
    r.readInt32(); // index

    let value: any = null;

    if (type === "StructProperty") {
      const structType = r.readString();
      r.offset += 16; // Skip GUID
      r.readByte(); // Skip terminator byte

      if (structType === "Vector2D") {
        const x = r.readFloat();
        const y = r.readFloat();
        value = { x, y };
      } else if (structType === "DateTime") {
        value = r.readInt64();
      } else {
        value = parseStructProperties(r);
        value._structType = structType;
      }
    } else if (type === "EnumProperty") {
      r.readString(); // enumType
      r.readByte(); // terminator
      value = r.readString();
    } else if (type === "StrProperty" || type === "NameProperty") {
      r.readByte(); // terminator
      value = r.readString();
    } else if (type === "Int16Property") {
      r.readByte();
      value = r.readInt16();
    } else if (type === "IntProperty") {
      r.readByte();
      value = r.readInt32();
    } else if (type === "ArrayProperty") {
      const itemInnerType = r.readString();
      r.readByte();
      const count = r.readInt32();
      const arr: any[] = [];

      if (itemInnerType === "StructProperty") {
        r.readString(); // arrayPropName
        r.readString(); // arrayPropType
        r.readInt64(); // arrayPropSize
        r.readString(); // arrayStructType
        r.offset += 16; // arrayGuid
        r.readByte(); // arrayTerm
        
        for (let i = 0; i < count; i++) {
          arr.push(parseStructProperties(r));
        }
      } else {
        r.offset += size - 4;
      }
      value = arr;
    } else {
      r.readByte(); // terminator
      r.offset += size;
    }

    props[name] = value;
  }
  return props;
}

export function parseSavFile(fileBuffer: Uint8Array): ParsedStockpile[] {
  const reader = new BinaryReader(fileBuffer);
  
  // Verify GVAS magic bytes
  const magic = new TextDecoder().decode(fileBuffer.slice(0, 4));
  if (magic !== "GVAS") {
    throw new Error("Invalid save file format (not a GVAS file)");
  }

  // Find PinnedMapToolTipsC offset
  const pinProperty = "PinnedMapToolTipsC";
  
  // Search for the property name bytes in the Uint8Array
  let pinIdx = -1;
  const targetBytes = new TextEncoder().encode(pinProperty);
  for (let i = 4; i < fileBuffer.length - targetBytes.length; i++) {
    let match = true;
    for (let j = 0; j < targetBytes.length; j++) {
      if (fileBuffer[i + j] !== targetBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      pinIdx = i;
      break;
    }
  }

  if (pinIdx === -1) {
    return []; // No pinned map tooltips found
  }

  reader.offset = pinIdx - 4;

  // Read ArrayProperty details
  reader.readString(); // PinnedMapToolTipsC
  const propType = reader.readString(); // ArrayProperty
  if (propType !== "ArrayProperty") {
    throw new Error(`Unexpected property type: ${propType}`);
  }
  reader.readInt32(); // size
  reader.readInt32(); // index
  const innerType = reader.readString(); // StructProperty
  reader.readByte(); // terminator

  if (innerType !== "StructProperty") {
    return [];
  }

  const elementCount = reader.readInt32();

  // Read inner struct header
  reader.readString(); // PinnedMapToolTipsC
  reader.readString(); // StructProperty
  reader.readInt32(); // size
  reader.readInt32(); // index
  reader.readString(); // PinnedMapToolTipSaveData
  reader.offset += 16; // GUID
  reader.readByte(); // terminator

  const result: ParsedStockpile[] = [];
  const timestamp = new Date().toISOString();

  for (let i = 0; i < elementCount; i++) {
    const tooltip = parseStructProperties(reader);
    const mapId = tooltip.MapId ? cleanHexMapName(tooltip.MapId) : "Unknown Region";
    
    // Determine Structure Type (Seaport, Storage Depot, Aircraft Depot)
    let structureType = "Storage Depot";
    const initialDetails = tooltip.InitalMapItemDetails;
    if (initialDetails && initialDetails.StockpileInfo) {
      const info = initialDetails.StockpileInfo;
      const hasSeaport = info.Structures?.some((s: any) => s.CodeName === "Seaport");
      const hasAircraftDepot = info.Structures?.some((s: any) => s.CodeName === "AircraftDepot");
      if (hasSeaport) {
        structureType = "Seaport";
      } else if (hasAircraftDepot) {
        structureType = "Aircraft Depot";
      }
    }

    // Parse Private/Reserve Stockpiles ONLY from all details sources (InitalMapItemDetails & RecentMapItemDetails)
    const detailSources = [tooltip.InitalMapItemDetails, tooltip.RecentMapItemDetails, tooltip].filter(Boolean);
    
    detailSources.forEach((source: any) => {
      if (source.ReserveStockpileInfoList && Array.isArray(source.ReserveStockpileInfoList)) {
        source.ReserveStockpileInfoList.forEach((stockpile: any) => {
          const tag = stockpile.StockpileName || "Unknown Tag";
          const info = stockpile.StockpileInfo;
          if (!info) return;

          const items: Record<string, number> = {};
          
          const processEntry = (entry: any, isCrate: boolean) => {
            if (!entry || !entry.CodeName) return;
            let stdName = ITEM_CODENAMES[entry.CodeName] || entry.CodeName;
            if (stdName === 'Supplies' || stdName === 'Garrison Supplies') {
              stdName = 'Maintenance Supplies';
            }
            if (stdName) {
              const finalName = isCrate ? `${stdName} (Crate)` : stdName;
              items[finalName] = (items[finalName] || 0) + (entry.Quantity || 0);
            }
          };

          info.Items?.forEach((e: any) => processEntry(e, false));
          info.ItemCrates?.forEach((e: any) => processEntry(e, true));
          info.Vehicles?.forEach((e: any) => processEntry(e, false));
          info.VehicleCrates?.forEach((e: any) => processEntry(e, true));
          info.Structures?.forEach((e: any) => processEntry(e, false));
          info.StructureCrates?.forEach((e: any) => processEntry(e, true));

          if (Object.keys(items).length > 0) {
            const locationKey = `${mapId} - ${structureType} - ${tag}`;
            // Avoid adding duplicates from multiple detail sources if location already present
            const existingIdx = result.findIndex(r => r.location === locationKey);
            if (existingIdx !== -1) {
              result[existingIdx] = {
                location: locationKey,
                region: mapId,
                townName: null,
                timestamp,
                items
              };
            } else {
              result.push({
                location: locationKey,
                region: mapId,
                townName: null,
                timestamp,
                items
              });
            }
          }
        });
      }
    });
  }

  return result;
}
