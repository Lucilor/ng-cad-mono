import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  HostBinding,
  inject,
  OnDestroy,
  OnInit,
  signal
} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatOptionModule, ThemePalette} from "@angular/material/core";
import {MatDialog} from "@angular/material/dialog";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatSelectModule} from "@angular/material/select";
import {exportCadDataRemoveLengthTextCount, 激光开料标记线类型} from "@app/cad/utils";
import {editCadZhankai} from "@components/dialogs/cad-zhankai/cad-zhankai.component";
import {
  CadBaseLine,
  CadData,
  CadEntities,
  CadEntity,
  CadEventCallBack,
  CadJointPoint,
  CadLine,
  IntersectionKey,
  intersectionKeys,
  intersectionKeysTranslate,
  sortLines
} from "@lucilor/cad-viewer";
import {Subscribed} from "@mixins/subscribed.mixin";
import {Utils} from "@mixins/utils.mixin";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {AppStatusService} from "@services/app-status.service";
import {CadPoints} from "@services/app-status.types";
import {CadStatusIntersection, CadStatusSelectBaseline, CadStatusSelectJointpoint} from "@services/cad-status";
import {debounce, isEqual} from "lodash";
import {InputComponent} from "../../../../input/components/input.component";
import {getCadInfoInputs} from "./cad-info.utils";

@Component({
  selector: "app-cad-info",
  templateUrl: "./cad-info.component.html",
  styleUrls: ["./cad-info.component.scss"],
  imports: [
    FormsModule,
    forwardRef(() => InputComponent),
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CadInfoComponent extends Subscribed(Utils()) implements OnInit, OnDestroy {
  private dialog = inject(MatDialog);
  private message = inject(MessageService);
  private status = inject(AppStatusService);

  @HostBinding("class") class = "ng-page";

  private _cadPointsLock = false;
  cadStatusIntersectionInfo: string | null = null;
  bjxTypes = 激光开料标记线类型;
  bjxIntersectionKey = "激光开料标记线";
  emptyBjxItem: NonNullable<CadData["info"]["激光开料标记线"]>[0] = {type: "短直线", ids: []};

  ngOnInit() {
    this.subscribe(this.status.cadStatusEnter$, (cadStatus) => {
      if (cadStatus instanceof CadStatusSelectJointpoint) {
        this._updateCadPoints();
      } else if (cadStatus instanceof CadStatusIntersection) {
        if (intersectionKeys.includes(cadStatus.info as any) || cadStatus.info === this.bjxIntersectionKey) {
          this.cadStatusIntersectionInfo = cadStatus.info;
          this._updateCadPoints();
        }
      }
    });
    this.subscribe(this.status.cadStatusExit$, (cadStatus) => {
      if (cadStatus instanceof CadStatusSelectJointpoint) {
        this._cadPointsLock = true;
        this.status.setCadPoints();
      } else if (cadStatus instanceof CadStatusIntersection) {
        this._cadPointsLock = true;
        this.status.setCadPoints();
        this.cadStatusIntersectionInfo = null;
      }
    });
    this.subscribe(this.status.cadPoints$, (points) => {
      const activePoints = points.filter((p) => p.active);
      const cadStatus = this.status.cadStatus;
      if (this._cadPointsLock) {
        this._cadPointsLock = false;
        return;
      }
      const data = this.data();
      if (cadStatus instanceof CadStatusSelectJointpoint) {
        const jointPoint = data.jointPoints[cadStatus.index];
        if (activePoints.length < 1) {
          jointPoint.valueX = NaN;
          jointPoint.valueY = NaN;
        } else {
          const {valueX: x, valueY: y} = jointPoint;
          for (const p of activePoints) {
            const p2 = this._setActiveCadPoint({x, y}, points);
            if (!p2 || !isEqual([p.x, p.y], [p2.x, p2.y])) {
              jointPoint.valueX = p.x;
              jointPoint.valueY = p.y;
              this._updateCadPoints();
              break;
            }
          }
        }
        this.updateJointPointInfos();
      } else if (cadStatus instanceof CadStatusIntersection && cadStatus.info === this.cadStatusIntersectionInfo) {
        const key = this.cadStatusIntersectionInfo;
        const index = cadStatus.index;
        if (intersectionKeys.includes(key as IntersectionKey)) {
          const key2 = key as IntersectionKey;
          const lines = data[key2][index];
          if (activePoints.length < 1) {
            data[key2][index] = [];
          } else {
            for (const p of activePoints) {
              const p2 = this._setActiveCadPoint({lines}, points);
              if (!p2 || !isEqual(p.lines, p2.lines)) {
                data[key2][index] = p.lines.slice();
                this._updateCadPoints();
                break;
              }
            }
          }
          this.updateIntersectionInputs();
        } else if (key === this.bjxIntersectionKey) {
          if (!data.info.激光开料标记线) {
            data.info.激光开料标记线 = [];
          }
          const item = data.info.激光开料标记线[index];
          if (activePoints.length < 1) {
            item.ids = [];
          } else {
            for (const p of activePoints) {
              const p2 = this._setActiveCadPoint({lines: item.ids}, points);
              if (!p2 || !isEqual(p.lines, p2.lines)) {
                item.ids = p.lines.slice();
                this._updateCadPoints();
                break;
              }
            }
          }
        }
      }
    });
    this.subscribe(this.status.openCad$, () => {
      this.updateIntersectionInputs();
    });
    const cad = this.status.cad;
    cad.on("entityclick", this._onEntityClick);
    cad.on("moveentities", this._onEntityMove);
    cad.on("zoom", this._updateCadPoints);
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    const cad = this.status.cad;
    cad.off("entityclick", this._onEntityClick);
    cad.off("moveentities", this._onEntityMove);
    cad.off("zoom", this._updateCadPoints);
  }

  data = signal<CadData>(this.status.cad.data);
  dataEff = effect(() => {
    const setData = () => {
      const components = this.status.components.selected$.value;
      if (components.length === 1) {
        this.data.set(components[0]);
      } else {
        this.data.set(this.status.cad.data);
      }
    };
    this.subscribe(this.status.openCad$, () => {
      setData();
    });
    this.subscribe(this.status.components.selected$, () => {
      setData();
    });
  });

  parseOptionString = computed(() => false);
  infoGroup1 = computed(() => {
    const infos = getCadInfoInputs(
      ["id", "名字", "唯一码", "显示名字", "开孔对应名字", "切内空对应名字", "分类", "分类2", "选项", "条件"],
      this.data(),
      this.dialog,
      this.status,
      this.parseOptionString()
    );
    const 名字 = infos.find((v) => v.label === "名字");
    if (名字?.type === "string") {
      名字.onChange = this.setCadName.bind(this);
    }
    return infos;
  });
  infoGroup2 = computed(() => {
    const infos = getCadInfoInputs(
      [
        "开料时刨坑",
        "变形方式",
        "板材纹理方向",
        "激光开料是否翻转",
        "激光开料打标",
        "开料排版方式",
        "默认开料板材",
        "默认开料材料",
        "默认开料板材厚度",
        "固定开料板材",
        "算料处理",
        "显示宽度标注",
        "板材厚度方向",
        "自定义属性",
        "型号花件",
        "必须绑定花件",
        "可独立板材",
        "必须选择板材",
        "双向折弯",
        "自动生成双折宽双折高公式",
        "算料单显示"
      ],
      this.data(),
      this.dialog,
      this.status,
      this.parseOptionString()
    );
    const 板材厚度方向 = infos.find((v) => v.label === "板材厚度方向");
    if (板材厚度方向?.type === "select") {
      板材厚度方向.onChange = this.offset.bind(this);
    }
    return infos;
  });
  infoGroup3 = computed(() => {
    const infos = getCadInfoInputs(
      [
        "算料单显示放大倍数",
        "企料前后宽同时改变",
        "主CAD",
        "算料单展开显示位置",
        "属于门框门扇",
        "内开做分体",
        "板材绑定选项",
        "算料单线长显示的最小长度",
        "检查企料厚度",
        "对应门扇厚度",
        "显示厚度",
        "跟随CAD开料板材",
        "算料特殊要求",
        "正面宽差值",
        "墙厚差值",
        "企料翻转",
        "企料门框配合位增加值",
        "企料包边类型",
        "指定封口厚度",
        "拼接料拼接时垂直翻转",
        "正面线到见光线展开模板",
        "指定板材分组",
        "指定下单板材",
        "指定下单材料",
        "指定下单厚度",
        "拉码碰撞判断",
        "装配示意图自动拼接锁边铰边",
        "开料孔位配置",
        "算料单翻转",
        "激光开料排版后只保留孔",
        "激光开料折弯标记长直线",
        "激光开料折弯标记短直线"
      ],
      this.data(),
      this.dialog,
      this.status,
      this.parseOptionString()
    );
    return infos;
  });

  private _onEntityClick: CadEventCallBack<"entityclick"> = (_, entity) => {
    const cadStatus = this.status.cadStatus;
    const data = this.data();
    if (cadStatus instanceof CadStatusSelectBaseline) {
      if (entity instanceof CadLine) {
        const baseLine = data.baseLines[cadStatus.index];
        if (entity.isHorizontal()) {
          baseLine.idY = entity.selected ? entity.id : "";
        }
        if (entity.isVertical()) {
          baseLine.idX = entity.selected ? entity.id : "";
        }
        data.updateBaseLines();
        this.updateBaseLineInfos();
        data.getAllEntities().forEach((e) => {
          e.selected = [baseLine.idX, baseLine.idY].includes(e.id);
        });
        this.status.cad.render();
      }
    }
  };
  private _checkMtext = debounce((entities: CadEntities) => {
    const cad = this.status.cad;
    const count = exportCadDataRemoveLengthTextCount;
    if (cad.data.entities.length > count && entities.mtext.some((e) => e.info.isLengthText)) {
      this.message.snack(`CAD实体数量大于${count}，线长位置不会保存`);
    }
  }, 500).bind(this);
  private _onEntityMove: CadEventCallBack<"moveentities"> = (entities) => {
    this._checkMtext(entities);
    this._updateCadPoints();
  };
  private _updateCadPoints = () => {
    const cadStatus = this.status.cadStatus;
    const data = this.data();
    const key = this.cadStatusIntersectionInfo;
    if (cadStatus instanceof CadStatusSelectJointpoint) {
      const points = this.status.getCadPoints(data.getAllEntities());
      const {valueX, valueY} = data.jointPoints[cadStatus.index];
      this._setActiveCadPoint({x: valueX, y: valueY}, points);
      this._cadPointsLock = true;
      this.status.cadPoints$.next(points);
    } else if (cadStatus instanceof CadStatusIntersection && cadStatus.info === key) {
      const points = this.status.getCadPoints(data.getAllEntities());
      if (intersectionKeys.includes(key as IntersectionKey)) {
        this._setActiveCadPoint({lines: data[key as IntersectionKey][cadStatus.index]}, points);
      } else if (key === this.bjxIntersectionKey) {
        this._setActiveCadPoint({lines: data.info.激光开料标记线?.[cadStatus.index].ids}, points);
      }
      this._cadPointsLock = true;
      this.status.cadPoints$.next(points);
    }
  };
  private _setActiveCadPoint(point: Partial<CadPoints[0]>, points: CadPoints) {
    points.forEach((p) => (p.active = false));
    for (const p of points) {
      if (isEqual(p.lines, point.lines) || isEqual([p.x, p.y], [point.x, point.y])) {
        p.active = true;
        return p;
      }
    }
    return null;
  }

  baseLineInfos = signal<{data: CadBaseLine; color: ThemePalette}[]>([]);
  updateBaseLineInfos() {
    const cadStatus = this.status.cadStatus;
    this.baseLineInfos.set(
      this.data().baseLines.map((baseLine, i) => {
        let color: ThemePalette = "primary";
        if (cadStatus instanceof CadStatusSelectBaseline && i === cadStatus.index) {
          color = "accent";
        }
        return {data: baseLine, color};
      })
    );
  }
  baseLinesEff = effect(() => {
    this.updateBaseLineInfos();
  });
  baseLinesEff2 = effect(() =>
    this.subscribe(this.status.cadStatusEnter$, () => {
      this.updateBaseLineInfos();
    })
  );
  addBaseLine(index: number) {
    const arr = this.data().baseLines;
    arr.splice(index + 1, 0, new CadBaseLine());
    this.updateBaseLineInfos();
  }
  async removeBaseLine(index: number) {
    if (await this.message.confirm("是否确定删除？")) {
      const arr = this.data().baseLines;
      if (arr.length === 1) {
        arr[0] = new CadBaseLine();
      } else {
        arr.splice(index, 1);
      }
      this.updateBaseLineInfos();
    }
  }
  selectBaseLine(i: number) {
    this.status.toggleCadStatus(new CadStatusSelectBaseline(i));
  }

  jointPointInfos = signal<{data: CadJointPoint; color: ThemePalette}[]>([]);
  updateJointPointInfos() {
    const cadStatus = this.status.cadStatus;
    this.jointPointInfos.set(
      this.data().jointPoints.map((jointPoint, i) => {
        let color: ThemePalette = "primary";
        if (cadStatus instanceof CadStatusSelectJointpoint && i === cadStatus.index) {
          color = "accent";
        }
        return {data: jointPoint, color};
      })
    );
  }
  jointPointsEff = effect(() => {
    this.updateJointPointInfos();
  });
  jointPointsEff2 = effect(() =>
    this.subscribe(this.status.cadStatusEnter$, () => {
      this.updateJointPointInfos();
    })
  );
  addJointPoint(index: number) {
    const arr = this.data().jointPoints;
    arr.splice(index + 1, 0, new CadJointPoint());
    this.updateJointPointInfos();
  }
  async removeJointPoint(index: number) {
    if (await this.message.confirm("是否确定删除？")) {
      const arr = this.data().jointPoints;
      if (arr.length === 1) {
        arr[0] = new CadJointPoint();
      } else {
        arr.splice(index, 1);
      }
      this.updateJointPointInfos();
    }
  }
  selectJointPoint(i: number) {
    this.status.toggleCadStatus(new CadStatusSelectJointpoint(i));
  }

  intersectionKeys = intersectionKeys;
  intersectionKeysTranslate = intersectionKeysTranslate;
  intersectionInputs = signal<Partial<Record<IntersectionKey, InputInfo[][]>>>({});
  updateIntersectionInputs() {
    const inputs: ReturnType<typeof this.intersectionInputs> = {};
    const data = this.data();
    for (const key of intersectionKeys) {
      const arr = data[key];
      inputs[key] = [];
      for (const [i, v] of arr.entries()) {
        const arr2: InputInfo[] = [
          {
            type: "string",
            label: "",
            value: v.length ? "已指定" : "未指定",
            selectOnly: true,
            suffixIcons: [
              {
                name: "linear_scale",
                isDefault: true,
                color: this.getPointColor(i, key),
                onClick: () => {
                  this.selectPoint(i, key);
                }
              },
              {
                name: "add_circle",
                color: "primary",
                onClick: () => {
                  this.addIntersectionValue(key, i + 1);
                }
              },
              {
                name: "remove_circle",
                color: "primary",
                onClick: () => {
                  this.removeIntersectionValue(key, i);
                }
              }
            ],
            style: {flex: "2 2 0", width: 0}
          }
        ];
        if (key === "zhidingweizhipaokeng") {
          if (!Array.isArray(data.info.刨坑深度)) {
            data.info.刨坑深度 = [];
          }
          if (typeof data.info.刨坑深度[i] !== "string") {
            data.info.刨坑深度[i] = "";
          }
          arr2.push({
            type: "string",
            label: "刨坑深度",
            model: {data: data.info.刨坑深度, key: i},
            options: ["默认"],
            suffixTexts: [{name: "mm"}],
            validators: () => {
              const val = data.info.刨坑深度[i];
              if (val === "默认") {
                return null;
              }
              const num = Number(val);
              if (isNaN(num) || num < 0) {
                return {请输入不小于0的数字: true};
              }
              return null;
            },
            style: {flex: "1 1 0", width: 0}
          });
        }
        inputs[key].push(arr2);
      }
    }
    this.intersectionInputs.set(inputs);
  }

  offset(value: string) {
    const data = this.data();
    const cad = this.status.cad;
    data.bancaihoudufangxiang = value;
    let direction = 0;
    if (value === "gt0") {
      direction = 1;
    } else if (value === "lt0") {
      direction = -1;
    } else {
      return;
    }
    const distance = 2;
    const lines = sortLines(data);
    lines.forEach((v) => (v[0].mingzi = "起始线"));
    const entities = data.getAllEntities().clone(true);
    entities.offset(direction, distance);
    cad.add(entities);

    const blinkInterval = 500;
    const blinkCount = 3;
    const blink = (el: CadEntity["el"]) => {
      if (el) {
        el.css("opacity", "1");
        setTimeout(() => el.css("opacity", "0"), blinkInterval);
      }
    };
    entities.forEach((e) => {
      const el = e.el;
      if (el) {
        el.css("transition", blinkInterval + "ms");
        blink(el);
      }
    });
    let count = 1;
    const id = setInterval(() => {
      entities.forEach((e) => {
        blink(e.el);
      });
      if (++count > blinkCount) {
        clearInterval(id);
        cad.remove(entities);
      }
    }, blinkInterval * 2);
  }

  async editZhankai(data: CadData) {
    await editCadZhankai(this.dialog, data);
  }

  setCadName(value: string) {
    this.status.updateTitle();
    const zhankai = this.data().zhankai[0];
    if (zhankai) {
      zhankai.name = value;
    }
  }

  selectPoint(i: number, key: IntersectionKey) {
    this.cadStatusIntersectionInfo = key;
    this.status.toggleCadStatus(new CadStatusIntersection(key, i));
    this.updateIntersectionInputs();
  }

  selectBjxPoint(i: number) {
    this.status.toggleCadStatus(new CadStatusIntersection(this.bjxIntersectionKey, i));
  }

  getPointColor(i: number, key: IntersectionKey) {
    const cadStatus = this.status.cadStatus;
    if (cadStatus instanceof CadStatusIntersection && cadStatus.info === key && i === cadStatus.index) {
      return "accent";
    }
    return "primary";
  }

  getBjxPointColor(i: number) {
    const cadStatus = this.status.cadStatus;
    if (cadStatus instanceof CadStatusIntersection && cadStatus.info === this.bjxIntersectionKey && i === cadStatus.index) {
      return "accent";
    }
    return "primary";
  }

  copyCadId(cad: CadData) {
    this.message.copyText(cad.id, {successText: "id已复制"});
  }

  addIntersectionValue(key: IntersectionKey, i?: number) {
    const data = this.data();
    this.arrayAdd(data[key], [], i);
    if (key === "zhidingweizhipaokeng") {
      if (!Array.isArray(data.info.刨坑深度)) {
        data.info.刨坑深度 = [];
      }
      this.arrayAdd(data.info.刨坑深度, "", i);
    }
    this.updateIntersectionInputs();
  }
  removeIntersectionValue(key: IntersectionKey, i: number) {
    const data = this.data();
    this.arrayRemove(data[key], i);
    if (key === "zhidingweizhipaokeng") {
      this.arrayRemove(data.info.刨坑深度, i);
    }
    this.updateIntersectionInputs();
  }
}
