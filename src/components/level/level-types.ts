/**
 * Level document shapes.
 *
 * These match `@zylem/bridge`'s protocol. The editor keeps its own copy so it
 * can compile against the published bridge package, which does not list the
 * level messages yet. Field names are the wire format.
 */

import type { BridgePose, BridgeVec3 } from '@zylem/bridge';
import type { BrushPlane } from './brush';

export type LevelLayerId = 'solid' | 'doodad' | 'entity';

export interface BrushSolid {
	id: string;
	planes: BrushPlane[];
}

export interface DoodadPlacement {
	id: string;
	typeId: string;
	pose: BridgePose;
	props: Record<string, unknown>;
}

export interface EntityPlacement {
	id: string;
	typeId: string;
	name: string;
	pose: BridgePose;
	props: Record<string, unknown>;
}

export interface LevelDocument {
	version: 2;
	solids: BrushSolid[];
	doodads: DoodadPlacement[];
	entities: EntityPlacement[];
}

export type LevelPlacementArm =
	| { kind: 'doodad'; typeId: string; props?: Record<string, unknown> }
	| { kind: 'spawn' }
	| { kind: 'trigger'; size: BridgeVec3 };

export interface LevelSyncPayload {
	document: LevelDocument;
	hiddenLayers: LevelLayerId[];
	selectedIds: string[];
	activeLayer: LevelLayerId;
	placement: LevelPlacementArm | null;
}

export type LevelGesture =
	| { kind: 'brush'; min: BridgeVec3; max: BridgeVec3 }
	| { kind: 'clip'; brushId: string; plane: BrushPlane }
	| { kind: 'vertex'; brushId: string; vertexIndex: number; position: BridgeVec3 }
	| { kind: 'translate'; id: string; layer: LevelLayerId; delta: BridgeVec3 }
	| { kind: 'doodad'; typeId: string; pose: BridgePose; props?: Record<string, unknown> }
	| { kind: 'spawn'; pose: BridgePose }
	| { kind: 'trigger'; pose: BridgePose; size: BridgeVec3 }
	| { kind: 'delete'; id: string };

export type SpawnKind = 'player' | 'enemy' | 'item';
