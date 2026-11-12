import {
	type BridgeMessages,
	createLevelNavigation,
	type LevelNavigation,
	type NavigationEdit,
	type NavigationSettings,
	type NavigationStatus,
	type NavigationTool,
	navigationSourceHash,
	validateNavigationSettings,
} from '@zylem/bridge';
import { proxy } from 'valtio/vanilla';
import { channel } from '../../bridge/channel';
import { sendTool } from '../../bridge/commands';
import { mirrorProxy } from '../common/proxy-mirror';
import { debugStore, setOpenSections } from '../editor-store';
import { setDebugTool } from '../entities/entities-state';
import {
	levelState,
	setLevelEditorActive,
	setLevelNavigation,
	syncLevelDocument,
} from '../level/level-state';
import { stageState } from '../stages/stage-state';

export const navigationState = proxy({
	state: 'empty' as NavigationStatus['state'],
	message: '',
	sourceHash: '',
	stageId: '',
	requestId: '',
	visible: false,
	tool: 'none' as NavigationTool,
	obstacleHeight: 2,
	bidirectional: true,
	pathStatus: '',
	pathPoints: 0,
});
export const navigationStore = mirrorProxy(navigationState);
let sequence = 0;
export function currentNavigation(): LevelNavigation {
	return JSON.parse(JSON.stringify(levelState.document.navigation ?? createLevelNavigation()));
}
export function openNavigation(): void {
	setLevelEditorActive(true);
	setOpenSections([...new Set([...debugStore.openSections, 'navigation'])]);
}
export function bakeNavigation(): void {
	openNavigation();
	syncLevelDocument();
	const requestId = `nav-${Date.now()}-${++sequence}`;
	navigationState.requestId = requestId;
	navigationState.state = 'building';
	navigationState.message = '';
	navigationState.visible = true;
	channel.send('navigation:bake', { requestId });
}
export function setNavigationVisible(visible: boolean): void {
	navigationState.visible = visible;
	channel.send('navigation:preview', { visible });
}
export function armNavigationTool(tool: NavigationTool): void {
	openNavigation();
	const next = navigationState.tool === tool ? 'none' : tool;
	setDebugTool('none');
	sendTool('none');
	navigationState.tool = next;
	if (next !== 'none') setNavigationVisible(true);
	updateNavigationToolOptions();
}
export function updateNavigationToolOptions(): void {
	channel.send('navigation:tool', {
		tool: navigationState.tool,
		obstacleHeight: navigationState.obstacleHeight,
		bidirectional: navigationState.bidirectional,
	});
}
export function resetNavigationTool(): void {
	navigationState.tool = 'none';
	channel.send('navigation:tool', { tool: 'none' });
}
export function setNavigationSetting(key: keyof NavigationSettings, value: number): void {
	const nav = currentNavigation();
	nav.settings[key] = value;
	try {
		validateNavigationSettings(nav.settings);
	} catch (error) {
		navigationState.message = error instanceof Error ? error.message : String(error);
		return;
	}
	navigationState.message = '';
	setLevelNavigation(nav, 'Navigation settings');
}
export function excludeSelectedSolids(excluded: boolean): void {
	const nav = currentNavigation();
	const ids = new Set<string>(nav.excludedSolidIds);
	const solids = new Set(levelState.document.solids.map((s) => s.id));
	for (const id of levelState.selectedIds)
		if (solids.has(id)) {
			if (excluded) ids.add(id);
			else ids.delete(id);
		}
	nav.excludedSolidIds = [...ids];
	setLevelNavigation(nav, excluded ? 'Exclude navigation geometry' : 'Include navigation geometry');
}
export function removeNavigationItem(kind: 'obstacles' | 'links', id: string): void {
	const nav = currentNavigation();
	if (kind === 'obstacles') nav.obstacles = nav.obstacles.filter((item) => item.id !== id);
	else nav.links = nav.links.filter((item) => item.id !== id);
	setLevelNavigation(nav, 'Remove navigation annotation');
}
function acceptsStage(stageId: string): boolean {
	// Navigation uses the runtime stage uuid, also published in the stage snapshot.
	return !stageState.config?.id || stageState.config.id === stageId;
}
export function applyNavigationStatus(status: NavigationStatus): void {
	if (status.stageId && !acceptsStage(status.stageId)) return;
	if (
		status.requestId &&
		navigationState.requestId &&
		status.requestId !== navigationState.requestId
	)
		return;
	navigationState.state = status.state;
	navigationState.stageId = status.stageId;
	navigationState.sourceHash = status.sourceHash;
	navigationState.message = status.message ?? '';
	if (status.state !== 'building' && status.state !== 'ready') navigationState.pathStatus = '';
}
export function applyNavigationBake(payload: BridgeMessages['navigation:baked']): void {
	if (
		!acceptsStage(payload.stageId) ||
		payload.requestId !== navigationState.requestId ||
		payload.asset.sourceHash !== navigationSourceHash(levelState.document)
	)
		return;
	const nav = currentNavigation();
	nav.baked = payload.asset;
	setLevelNavigation(nav, 'Bake navigation');
	navigationState.requestId = '';
}
export function applyNavigationEdit(payload: BridgeMessages['navigation:edit']): void {
	if (!levelState.active || !acceptsStage(payload.stageId)) return;
	const nav = currentNavigation();
	const edit: NavigationEdit = payload.edit;
	if (edit.kind === 'obstacle') nav.obstacles.push(edit.obstacle);
	else nav.links.push(edit.link);
	setLevelNavigation(
		nav,
		edit.kind === 'obstacle' ? 'Add navigation obstacle' : 'Add navigation link'
	);
}
export function applyNavigationPath(payload: BridgeMessages['navigation:path']): void {
	if (!acceptsStage(payload.stageId)) return;
	navigationState.pathStatus = payload.result.status;
	navigationState.pathPoints = payload.result.points.length;
}
export function resetNavigationState(): void {
	navigationState.state = 'empty';
	navigationState.message = '';
	navigationState.sourceHash = '';
	navigationState.requestId = '';
	navigationState.stageId = '';
	navigationState.tool = 'none';
	navigationState.visible = false;
	navigationState.pathStatus = '';
	navigationState.pathPoints = 0;
}
