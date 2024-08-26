import {Component, OnDestroy, OnInit} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatDialog} from "@angular/material/dialog";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatSlideToggleChange, MatSlideToggleModule} from "@angular/material/slide-toggle";
import {reservedDimNames} from "@app/cad/utils";
import {
  CadData,
  CadDimension,
  CadDimensionLinear,
  CadDimensionType,
  CadEntity,
  CadEventCallBack,
  CadLine,
  CadLineLike,
  Defaults
} from "@lucilor/cad-viewer";
import {Subscribed} from "@mixins/subscribed.mixin";
import {MessageService} from "@modules/message/services/message.service";
import {AppConfig, AppConfigService} from "@services/app-config.service";
import {AppStatusService} from "@services/app-status.service";
import {CadStatusEditDimension, CadStatusNormal} from "@services/cad-status";
import {debounce} from "lodash";
import {openCadDimensionFormDialog} from "../../dialogs/cad-dimension-form/cad-dimension-form.component";

@Component({
  selector: "app-cad-dimension",
  templateUrl: "./cad-dimension.component.html",
  styleUrls: ["./cad-dimension.component.scss"],
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatSlideToggleModule]
})
export class CadDimensionComponent extends Subscribed() implements OnInit, OnDestroy {
  dimNameFocus = -1;
  dimLineSelecting = -1;
  dimensions: CadDimension[] = [];

  constructor(
    private status: AppStatusService,
    private dialog: MatDialog,
    private config: AppConfigService,
    private message: MessageService
  ) {
    super();
  }

  ngOnInit() {
    let prevConfig: Partial<AppConfig> = {};
    let prevSelectedComponents: CadData[] | null = null;
    let prevComponentsSelectable: boolean | null = null;
    this.subscribe(this.status.cadStatusEnter$, (cadStatus) => {
      if (cadStatus instanceof CadStatusEditDimension) {
        const index = cadStatus.index;
        const dimension = this.dimensions[index];
        this.dimLineSelecting = index;
        prevConfig = this.config.setConfig({hideLineLength: true, lineGongshi: 0, selectMode: "single"}, {sync: false});
        prevSelectedComponents = this.status.components.selected$.value;
        this.status.components.selected$.next([]);
        prevComponentsSelectable = this.status.components.selectable$.value;
        this.status.components.selectable$.next(false);
        this.focus(dimension);
      }
    });
    this.subscribe(this.status.cadStatusExit$, (cadStatus) => {
      if (cadStatus instanceof CadStatusEditDimension) {
        this.dimLineSelecting = -1;
        this.config.setConfig(prevConfig, {sync: false});
        if (prevSelectedComponents !== null) {
          this.status.components.selected$.next(prevSelectedComponents);
          prevSelectedComponents = null;
        }
        if (prevComponentsSelectable !== null) {
          this.status.components.selectable$.next(prevComponentsSelectable);
          prevComponentsSelectable = null;
        }
        this.blur();
      }
    });

    this._updateDimensions();
    const cad = this.status.cad;
    cad.on("entitiesselect", this._onEntitiesSelect);
    cad.on("entitiesadd", this._updateDimensions);
    cad.on("entitiesremove", this._updateDimensions);
    cad.on("render", this._updateDimensions);
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    const cad = this.status.cad;
    cad.off("entitiesselect", this._onEntitiesSelect);
    cad.off("entitiesadd", this._updateDimensions);
    cad.off("entitiesremove", this._updateDimensions);
    cad.off("render", this._updateDimensions);
  }

  private _updateDimensions = () => {
    this.dimensions = this.status.cad.data.getAllEntities().dimension;
  };

  private _onEntitiesSelect: CadEventCallBack<"entitiesselect"> = (entities) => {
    const cad = this.status.cad;
    const data = cad.data;
    const cadStatus = this.status.cadStatus;
    const dimensions = this.dimensions;
    const entity = entities.line[0];
    if (cadStatus instanceof CadStatusEditDimension && entity) {
      const dimension = dimensions[cadStatus.index];
      if (cadStatus.type === "linear") {
        let dimensionLinear: CadDimensionLinear | undefined;
        if (dimension instanceof CadDimensionLinear) {
          dimensionLinear = dimension;
        } else {
          dimensionLinear = new CadDimensionLinear();
          dimensionLinear.setStyle({text: {size: Defaults.FONT_SIZE}});
          dimensionLinear.setColor(0x00ff00);
          let newIndex = 0;
          newIndex += data.entities.dimension.length;
          data.entities.add(dimensionLinear);
          this.status.setCadStatus(new CadStatusEditDimension("linear", newIndex));
        }
        if (!dimensionLinear.entity1.id) {
          dimensionLinear.entity1 = {id: entity.id, location: "start"};
          dimensionLinear.cad1 = data.name;
        } else if (!dimensionLinear.entity2.id) {
          dimensionLinear.entity2 = {id: entity.id, location: "end"};
          dimensionLinear.cad2 = data.name;
        } else {
          dimensionLinear.entity1 = dimensionLinear.entity2;
          dimensionLinear.entity2 = {id: entity.id, location: "end"};
          dimensionLinear.cad2 = data.name;
        }
        const e1 = cad.data.findEntity(dimensionLinear.entity1.id);
        const e2 = cad.data.findEntity(dimensionLinear.entity2.id);
        if (e1 instanceof CadLineLike && e2 instanceof CadLineLike) {
          const points = cad.data.getDimensionPoints(dimension);
          if (points.length === 4) {
            if (points[0].equals(points[1])) {
              dimensionLinear.axis = dimensionLinear.axis === "x" ? "y" : "x";
            }
          }
        }
      }
      if (dimension) {
        this.focus(dimension);
        cad.render(dimension);
      }
    }
  };

  async editDimension(i: number) {
    const dimensions = this.dimensions;
    const dimension = dimensions[i];
    if (dimension instanceof CadDimensionLinear) {
      const dimension2 = await openCadDimensionFormDialog(this.dialog, {data: {data: dimension}, disableClose: true});
      if (dimension2) {
        await this.status.cad.render(dimension2);
      }
    }
  }

  getDimensionName(dimension: CadDimension, index: number) {
    if (this.dimNameFocus === index) {
      return dimension.mingzi || "";
    } else {
      return `${dimension.mingzi || ""} ${dimension.qujian || ""}`;
    }
  }

  setDimensionName = debounce((event: Event, dimension: CadDimension) => {
    const str = (event.target as HTMLInputElement).value;
    if (reservedDimNames.includes(str)) {
      this.message.alert(`标注名字不能是: ${str}`);
      return;
    }
    dimension.mingzi = str;
    this.status.cad.render(dimension);
  }, 500);

  isSelectingDimLine(i: number) {
    const cadStatus = this.status.cadStatus;
    return cadStatus instanceof CadStatusEditDimension && cadStatus.index === i;
  }

  async selectDimLine(i: number, type?: CadDimensionType) {
    const cadStatus = this.status.cadStatus;
    if (cadStatus instanceof CadStatusEditDimension && cadStatus.index === i) {
      this.status.setCadStatus(new CadStatusNormal());
    } else {
      this.status.setCadStatus(new CadStatusEditDimension(type || "linear", i));
    }
  }

  addDimensionLinear() {
    this.selectDimLine(-1, "linear");
  }

  removeDimension(index: number) {
    this.status.cad.remove(this.dimensions[index]);
  }

  focus(dimension?: CadDimension) {
    if (!dimension || !(dimension instanceof CadDimensionLinear)) {
      return;
    }
    const toFocus: CadEntity[] = [];
    const toBlur: CadEntity[] = [];
    const {entity1, entity2} = dimension;
    const ids = [entity1?.id, entity2?.id];
    this.status.cad.data.getAllEntities().forEach((e) => {
      if (e instanceof CadLine || e.id === dimension.id) {
        toFocus.push(e);
      } else {
        toBlur.push(e);
      }
    });
    this.status.focus(toFocus, {
      selected: (e) => {
        if (e instanceof CadLine) {
          return ids.includes(e.id);
        }
        return null;
      }
    });
    this.status.blur(toBlur);
  }

  blur() {
    this.status.focus();
  }

  getHideDimLines(i: number) {
    return this.dimensions[i].hideDimLines;
  }

  setHideDimLines(event: MatSlideToggleChange, i: number) {
    this.dimensions[i].hideDimLines = event.checked;
    this.status.cad.render(this.dimensions[i]);
  }
}
