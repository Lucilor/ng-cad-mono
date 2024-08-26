import {Component, OnDestroy, OnInit} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MatDialog} from "@angular/material/dialog";
import {setGlobal} from "@app/app.common";
import {CadPoints} from "@app/services/app-status.types";
import {CadConnection, CadData, CadEntity, CadEventCallBack, CadImage, CadLine, generatePointsMap, PointsMap} from "@lucilor/cad-viewer";
import {Subscribed} from "@mixins/subscribed.mixin";
import {MessageService} from "@modules/message/services/message.service";
import {AppConfig, AppConfigService} from "@services/app-config.service";
import {AppStatusService} from "@services/app-status.service";
import {CadStatus, CadStatusAssemble} from "@services/cad-status";
import {debounce, difference, differenceBy} from "lodash";
import {NgScrollbar} from "ngx-scrollbar";
import {openCadAssembleFormDialog} from "../../dialogs/cad-assemble-form/cad-assemble-form.component";

@Component({
  selector: "app-cad-assemble",
  templateUrl: "./cad-assemble.component.html",
  styleUrls: ["./cad-assemble.component.scss"],
  standalone: true,
  imports: [MatButtonModule, NgScrollbar]
})
export class CadAssembleComponent extends Subscribed() implements OnInit, OnDestroy {
  options = {space: "0", position: "absolute"};
  ids: string[] = [];
  names: string[] = [];
  lines: string[] = [];
  get data() {
    return this.status.cad.data;
  }
  get connections() {
    return this.data.components.connections;
  }
  get selectedComponents() {
    return this.status.components.selected$.value;
  }
  get unselectedComponents() {
    return differenceBy(this.data.components.data, this.selectedComponents, (data) => data.id);
  }
  showPointsAssemble = false;
  pointsAssembling = 0;

  private _prevConfig: Partial<AppConfig> = {};
  private _prevSelectedComponents: CadData[] | null = null;
  private _prevComponentsSelectable: boolean | null = null;

  constructor(
    private config: AppConfigService,
    private status: AppStatusService,
    private message: MessageService,
    private dialog: MatDialog
  ) {
    super();
  }

  ngOnInit() {
    setGlobal("assemble", this);
    this.subscribe(this.status.cadStatusEnter$, this._onCadStatusEnter);
    this.subscribe(this.status.cadStatusExit$, this._onCadStatusExit);
    this.subscribe(this.status.components.selected$, this._onComponentSelected);
    this.subscribe(this.status.cadPoints$, this._onCadPointsChange);
    this.subscribe(this.status.collection$, (collection) => {
      this.showPointsAssemble = collection === "luomatoucad";
    });

    {
      const cad = this.status.cad;
      cad.on("entitiesselect", this._onEntitiesSelect);
      cad.on("entitiesunselect", this._onEntitiesUnselect);
      cad.on("moveentities", this._onMoveEntities);
      cad.on("zoom", this._onZoom);
    }
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    const cad = this.status.cad;
    cad.off("entitiesselect", this._onEntitiesSelect);
    cad.off("entitiesunselect", this._onEntitiesUnselect);
  }

  private _onEntitiesSelect: CadEventCallBack<"entitiesselect"> = (entities, multi) => {
    const cadStatus = this.status.cadStatus;
    if (!(cadStatus instanceof CadStatusAssemble)) {
      return;
    }
    const cad = this.status.cad;
    const data = this.data;
    const selected = cad.selected().toArray();
    const ids = selected.map((e) => e.id);
    if (multi || (selected.length === 1 && selected[0] instanceof CadImage)) {
      data.components.data.forEach((v) => {
        if (ids.some((id) => v.findEntity(id))) {
          const selectedComponents = this.status.components.selected$.value;
          if (selectedComponents.some((vv) => vv.id === v.id)) {
            this.status.components.selected$.next(selectedComponents.filter((vv) => vv.id !== v.id));
          } else {
            this.status.components.selected$.next([...selectedComponents, v]);
          }
        }
      });
    } else {
      this._selectEntity(entities.toArray()[0]);
    }
  };

  private _onEntitiesUnselect: CadEventCallBack<"entitiesunselect"> = (entities) => {
    const ids = entities.toArray().map((v) => v.id);
    this.lines = difference(this.lines, ids);
  };

  private _onMoveEntities: CadEventCallBack<"moveentities"> = debounce(() => {
    if (this.pointsAssembling > 0) {
      this._setCadPoints();
    }
  }, 500).bind(this);

  private _onZoom: CadEventCallBack<"zoom"> = debounce(() => {
    if (this.pointsAssembling > 0) {
      this._setCadPoints();
    }
  }, 500).bind(this);

  private _selectEntity = (entity: CadEntity) => {
    const cadStatus = this.status.cadStatus;
    if (!(cadStatus instanceof CadStatusAssemble) || !entity) {
      return;
    }
    const cad = this.status.cad;
    const data = this.data;
    const dumpComponent = new CadData({id: data.id, name: data.name});
    dumpComponent.entities = data.entities;
    for (const component of [...data.components.data, dumpComponent]) {
      const {ids, lines, names} = this;
      const found = component.findEntity(entity.id);
      if (found) {
        const prev = ids.findIndex((id) => id === component.id);
        const {space, position} = this.options;
        if (entity.selected) {
          if (position === "absolute") {
            if (prev > -1) {
              const found2 = cad.data.findEntity(lines[prev]);
              if (found2) {
                found2.selected = false;
              }
              lines[prev] = found.id;
            } else {
              ids.push(component.id);
              names.push(component.name);
              lines.push(found.id);
            }
          }
          if (position === "relative") {
            if (prev > -1) {
              if (prev === 0) {
                lines.push(found.id);
                if (lines.length > 2) {
                  lines.shift();
                }
              } else {
                lines[prev] = found.id;
              }
            } else {
              ids.push(component.id);
              names.push(component.name);
              lines.push(found.id);
            }
            lines.forEach((l) => {
              const e = data.findEntity(l);
              if (e) {
                e.selected = true;
              }
            });
          }
          if ((lines.length === 2 && position === "absolute") || (lines.length === 3 && position === "relative")) {
            try {
              data.assembleComponents(new CadConnection({ids, names, lines, space, position}));
              cad.render();
            } catch (error) {
              this.message.alert({content: error});
            } finally {
              ids.length = 0;
              names.length = 0;
              lines.length = 0;
              cad.unselectAll();
            }
          }
        } else if (prev > -1) {
          if (position === "relative") {
            if (prev === 0) {
              const idx = lines.findIndex((l) => l === found.id);
              lines.splice(idx, -1);
              if (lines.length < 1) {
                ids.splice(prev, 1);
              }
            } else {
              ids.splice(prev, 1);
              lines.splice(prev + 1, 1);
            }
          } else {
            ids.splice(prev, 1);
            lines.splice(prev, 1);
          }
        }
        break;
      }
    }
  };

  private _onCadStatusEnter = (cadStatus: CadStatus) => {
    if (cadStatus instanceof CadStatusAssemble) {
      const cad = this.status.cad;
      this._prevConfig = this.config.setConfig(
        {selectMode: "multiple", entityDraggable: [], hideLineLength: true, hideLineGongshi: true},
        {sync: false}
      );
      this._prevSelectedComponents = this.status.components.selected$.value;
      this.status.components.selected$.next([]);
      this._prevComponentsSelectable = this.status.components.selectable$.value;
      this.status.components.selectable$.next(true);
      this._leftTopArr = [];
      if (this.status.collection$.value === "CADmuban") {
        const data = cad.data;
        const {top, bottom, left, right} = data.entities.getBoundingRect();
        const y = top - (top - bottom) / 4;
        let hasTop = false;
        let hasBottom = false;
        let hasLeft = false;
        let hasRight = false;
        data.entities.forEach((e) => {
          if (!(e instanceof CadLine) || e.length < 1000) {
            if (e instanceof CadLine && e.minY <= y) {
              return;
            }
            const {top: top2, bottom: bottom2, left: left2, right: right2} = e.boundingRect;
            if (top2 >= top && !hasTop) {
              hasTop = true;
              return;
            }
            if (bottom2 <= bottom && !hasBottom) {
              hasBottom = true;
              return;
            }
            if (left2 <= left && !hasLeft) {
              hasLeft = true;
              return;
            }
            if (right2 >= right && !hasRight) {
              hasRight = true;
              return;
            }
            e.info.prevVisible = e.visible;
            e.visible = false;
            cad.render(e);
          }
        });
      }
    }
  };

  private _onCadStatusExit = (cadStatus: CadStatus) => {
    if (cadStatus instanceof CadStatusAssemble) {
      const cad = this.status.cad;
      this.config.setConfig(this._prevConfig, {sync: false});
      if (this._prevSelectedComponents !== null) {
        this.status.components.selected$.next(this._prevSelectedComponents);
        this._prevSelectedComponents = null;
      }
      if (this._prevComponentsSelectable !== null) {
        this.status.components.selectable$.next(this._prevComponentsSelectable);
        this._prevComponentsSelectable = null;
      }
      cad.data.entities.forEach((e) => {
        if (!(e instanceof CadLine) || e.length < 1000) {
          e.visible = e.info.prevVisible ?? true;
          delete e.info.prevVisible;
          cad.render(e);
        }
      });
    }
  };

  private _onComponentSelected = () => {
    if (this.pointsAssembling > 0) {
      this._setCadPoints();
    }
  };

  private async _setCadPoints(include?: CadPoints) {
    let cads: CadData[];
    if (this.pointsAssembling === 1) {
      cads = this.selectedComponents;
    } else if (this.pointsAssembling === 2) {
      cads = this.unselectedComponents;
    } else {
      return;
    }
    const pointsMap: PointsMap = [];
    for (const cad of cads) {
      pointsMap.push(...generatePointsMap(cad.entities));
    }
    this.status.setCadPoints(pointsMap, {include});
  }

  private _onCadPointsChange = async (points: CadPoints) => {
    const active = points.filter((p) => p.active);
    if (active.length === 0) {
      if (this.pointsAssembling === 2) {
        this.pointsAssembling = 1;
        this._setCadPoints();
      }
    } else if (active.length === 1) {
      if (this.pointsAssembling === 1) {
        this.pointsAssembling = 2;
        this._setCadPoints(active);
      }
    } else if (active.length > 1) {
      const [active1, active2] = active;
      let cad1: CadData | undefined;
      let cad2: CadData | undefined;
      const p1 = this.status.cad.getWorldPoint(active1.x, active1.y);
      const p2 = this.status.cad.getWorldPoint(active2.x, active2.y);
      for (const cad of this.data.components.data) {
        for (const e of cad.entities.toArray()) {
          if (active1.lines.includes(e.id)) {
            cad1 = cad;
          }
          if (active2.lines.includes(e.id)) {
            cad2 = cad;
          }
        }
        if (cad1 && cad2) {
          break;
        }
      }
      if (!cad1 || !cad2) {
        this.message.error("选择错误");
        return;
      }
      const result = await openCadAssembleFormDialog(this.dialog);
      if (result) {
        const rect1 = cad1.getBoundingRect();
        const rect2 = cad2.getBoundingRect();
        const tx = p1.x - p2.x;
        const ty = p1.y - p2.y;
        rect2.transform({translate: [tx, ty]});

        const ids = [cad1.id, cad2.id];
        const names = [cad1.name, cad2.name];
        const position = "absolute";
        const connX = new CadConnection({ids, names, position});
        connX.value = rect1.left - rect2.left - result.x;
        connX.axis = "x";
        this.data.assembleComponents(connX);
        const connY = new CadConnection({ids, names, position});
        connY.value = rect1.top - rect2.top - result.y;
        connY.axis = "y";
        this.data.assembleComponents(connY);
        this.status.cad.render();
      }

      this.pointsAssembling = 0;
      this.status.setCadPoints();
    }
  };

  clearConnections() {
    this.connections.length = 0;
  }

  removeConnection(index: number) {
    this.connections.splice(index, 1);
  }

  directAssemble() {
    const data = this.data;
    data.components.data.forEach((v) => {
      try {
        data.directAssemble(v);
      } catch (error) {
        this.message.alert({content: error});
      }
    });
    this.status.cad.render();
  }

  pointsAssemble() {
    this.pointsAssembling = this.pointsAssembling > 1 ? 0 : this.pointsAssembling + 1;
    if (this.pointsAssembling) {
      this._setCadPoints();
    } else {
      this.status.setCadPoints();
    }
  }
}
