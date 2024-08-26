import {CustomStorage} from "@lucilor/utils";
import {Page} from "./page";

export class PageSnapshotManager {
  snapshots: PageSnapshot[] = [];
  snapshotIndex = -1;
  savedSnapshotIndex = -1;

  constructor(
    public storage: CustomStorage,
    public maxLength: number,
    public id: string
  ) {}

  getSnapshots() {
    return this.snapshots;
  }
  setSnapshots(snapshots: PageSnapshot[]) {
    this.snapshots = snapshots;
  }

  getSnapshotIndex() {
    return this.snapshotIndex;
  }
  setSnapshotIndex(index: number) {
    this.snapshotIndex = index;
  }

  getSavedSnapshotIndex() {
    return this.savedSnapshotIndex;
  }
  setSavedSnapshotIndex(index: number) {
    this.savedSnapshotIndex = index;
  }

  saveSnapshot(snapshot: PageSnapshot) {
    const snapshots = this.getSnapshots();
    const index = this.getSnapshotIndex() + 1;
    if (index < snapshots.length) {
      snapshots.splice(index, Infinity);
    }
    if (snapshots.length >= this.maxLength) {
      snapshots.shift();
    }
    snapshots.push(snapshot);
    this.setSnapshots(snapshots);
    this.setSnapshotIndex(snapshots.length - 1);
    const canUndo = snapshots.length > 1;
    const canRedo = false;
    return {canUndo, canRedo, index};
  }
  loadSnapshot() {
    const snapshots = this.getSnapshots();
    const index = this.getSnapshotIndex();
    const snapshot = snapshots[index] as PageSnapshot | undefined;
    const canUndo = index > 0;
    const canRedo = index < snapshots.length - 1;
    return {snapshot, canUndo, canRedo, index};
  }
  undo() {
    const snapshots = this.getSnapshots();
    const index = this.getSnapshotIndex() - 1;
    const snapshot = snapshots[index] as PageSnapshot | undefined;
    const canUndo = index > 0;
    if (snapshot && canUndo) {
      this.setSnapshotIndex(index);
    }
    return {snapshot, canUndo, index};
  }
  redo() {
    const snapshots = this.getSnapshots();
    const index = this.getSnapshotIndex() + 1;
    const snapshot = snapshots[index] as PageSnapshot | undefined;
    const canRedo = index < snapshots.length - 1;
    if (snapshot && canRedo) {
      this.setSnapshotIndex(index);
    }
    return {snapshot, canRedo, index};
  }
  reset() {
    this.setSnapshots([]);
    this.setSnapshotIndex(-1);
  }
}

export type PageSnapshot = ReturnType<Page["export"]>;
