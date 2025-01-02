import {KeyValue, NgTemplateOutlet} from "@angular/common";
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostBinding,
  inject,
  input,
  model,
  output,
  signal
} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatDialog} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatTooltipModule} from "@angular/material/tooltip";
import {Formulas} from "@app/utils/calc";
import {getCopyName, getValue, getValueString, Value} from "@app/utils/get-value";
import {CustomValidators} from "@app/utils/input-validators";
import {getSortedItems} from "@app/utils/sort-items";
import {openEditFormulasDialog} from "@components/dialogs/edit-formulas-dialog/edit-formulas-dialog.component";
import {FormulasEditorComponent} from "@components/formulas-editor/formulas-editor.component";
import {FormulasCompactConfig} from "@components/formulas-editor/formulas-editor.types";
import {ShuruTableDataSorted} from "@components/lurushuju/lrsj-pieces/lrsj-zuofa/lrsj-zuofa.types";
import {TextInfoComponent} from "@components/text-info/text-info.component";
import {TextInfo} from "@components/text-info/text-info.types";
import {isTypeOf} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {TableComponent} from "@modules/table/components/table/table.component";
import {RowButtonEvent, TableRenderInfo, ToolbarButtonEvent} from "@modules/table/components/table/table.types";
import {cloneDeep} from "lodash";
import {DateTime} from "luxon";
import {NgScrollbarModule} from "ngx-scrollbar";
import {v4} from "uuid";
import {算料公式, 输入} from "../../../../components/lurushuju/xinghao-data";
import {openSuanliaogongshiDialog} from "../dialogs/suanliaogongshi-dialog/suanliaogongshi-dialog.component";
import {SuanliaogongshiCloseEvent, SuanliaogongshiInfo} from "./suanliaogongshi.types";

@Component({
  selector: "app-suanliaogongshi",
  imports: [
    FormulasEditorComponent,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatTooltipModule,
    NgScrollbarModule,
    NgTemplateOutlet,
    TableComponent,
    TextInfoComponent
  ],
  templateUrl: "./suanliaogongshi.component.html",
  styleUrl: "./suanliaogongshi.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuanliaogongshiComponent {
  private dialog = inject(MatDialog);
  private http = inject(CadDataService);
  private message = inject(MessageService);

  @HostBinding("class") class = "ng-page";

  info = model.required<SuanliaogongshiInfo>();
  noScroll = input(false, {transform: booleanAttribute});
  exportFilename = input<Value<string>>();
  closable = input(false, {transform: booleanAttribute});
  closeOut = output<SuanliaogongshiCloseEvent>({alias: "close"});
  slgsChange = output();

  gongshiInfo = signal<{formulas: Formulas; compact: FormulasCompactConfig}[]>([]);
  gongshiInfoEff = effect(() => {
    const info = this.info();
    this.gongshiInfo.set((info.data.算料公式 || []).map((v) => ({formulas: v.公式, compact: {minRows: 5, editOn: true, noToolbar: true}})));
  });

  title = computed(() => this.info().slgs?.title || "算料公式");

  shuruTable = computed(() => {
    const info = this.info();
    const tableInfo: TableRenderInfo<ShuruTableDataSorted> = {
      title: "输入显示",
      subTitle: "注意：有输入时，相同名字的公式无效",
      subTitleStyle: {color: "red"},
      inlineTitle: true,
      columns: [
        {type: "string", field: "名字"},
        {type: "string", field: "可以修改", name: "下单要求", getString: (value) => `${value.可以修改 ? "可改" : "不可改"}`},
        {type: "string", field: "默认值"},
        {type: "string", field: "取值范围"},
        {type: "string", field: "生效条件"},
        {type: "number", field: "排序", hidden: !info.isFromSelf},
        {
          type: "button",
          field: "操作",
          buttons: [
            {event: "编辑", color: "primary"},
            {event: "删除", color: "primary"}
          ]
        }
      ],
      data: getSortedItems(info.data.输入数据 || [], (v) => v.排序 ?? 0),
      toolbarButtons: {
        extra: [
          {event: "添加", color: "primary"},
          {event: "全部", color: "primary", hidden: info.isFromSelf}
        ]
      }
    };
    return tableInfo;
  });

  returnZero() {
    return 0;
  }

  gongshiTitle = computed(() => this.info().slgs?.title || "算料公式");
  async getGongshiItem(data0?: 算料公式) {
    let data: 算料公式;
    if (data0) {
      data = cloneDeep(data0);
    } else {
      data = {_id: v4(), 名字: "", 条件: [], 选项: {}, 公式: {}};
    }
    if (!isTypeOf(data.选项, "object")) {
      data.选项 = {};
    }
    const result = await openEditFormulasDialog(this.dialog, {
      data: {
        formulas: data.公式,
        varNameItem: this.info().varNameItem,
        extraInputInfos: [
          {type: "string", label: "名字", model: {data, key: "名字"}, validators: Validators.required},
          {
            type: "object",
            label: "选项",
            model: {data, key: "选项"},
            optionsDialog: {},
            optionMultiple: true
          },
          {type: "array", label: "条件", model: {data, key: "条件"}}
        ]
      }
    });
    if (result) {
      data.公式 = result;
      return data;
    }
    return null;
  }
  justifyGongshi(item: 算料公式) {
    this.info().justifyGongshi?.(item);
  }
  async addGongshi() {
    const info = this.info();
    const data = info.data;
    if (!data.算料公式) {
      return;
    }
    const item = await this.getGongshiItem();
    if (item) {
      const length = data.算料公式.push(item);
      setTimeout(() => {
        this.editGongshiStart(length - 1);
      }, 0);
      this.info.set({...info});
      this.slgsChange.emit();
    }
  }
  async editGongshi(index: number) {
    const info = this.info();
    const data = info.data;
    if (!data.算料公式) {
      return;
    }
    const item = await this.getGongshiItem(data.算料公式[index]);
    if (item) {
      this.justifyGongshi(item);
      data.算料公式[index] = item;
      this.info.set({...info});
      this.slgsChange.emit();
    }
  }
  async copyGongshi(index: number) {
    const info = this.info();
    const data = info.data;
    if (!data.算料公式) {
      return;
    }
    if (!(await this.message.confirm(`确定复制【${data.算料公式[index].名字}】吗？`))) {
      return;
    }
    const item = cloneDeep(data.算料公式[index]);
    item._id = v4();
    const names = data.算料公式.map((v) => v.名字);
    item.名字 = getCopyName(names, item.名字);
    data.算料公式.push(item);
    this.info.set({...info});
    this.slgsChange.emit();
  }
  async removeGongshi(index: number) {
    const info = this.info();
    const data = info.data;
    if (!data.算料公式) {
      return;
    }
    if (!(await this.message.confirm(`确定删除【${data.算料公式[index].名字}】吗？`))) {
      return;
    }
    data.算料公式.splice(index, 1);
    this.info.set({...info});
    this.slgsChange.emit();
  }
  editGongshiStart(index: number) {
    const gongshiInfo = this.gongshiInfo()[index];
    if (gongshiInfo) {
      gongshiInfo.compact = {...gongshiInfo.compact, editOn: true};
      this.gongshiInfo.update((v) => [...v]);
    }
  }
  editGongshiEnd(index: number, formulas: Formulas | null | undefined, close = false) {
    const info = this.info();
    if (formulas && info.data.算料公式) {
      info.data.算料公式[index].公式 = formulas;
      this.slgsChange.emit();
    }
    if (close) {
      const gongshiInfo = this.gongshiInfo()[index];
      if (gongshiInfo) {
        gongshiInfo.compact = {...gongshiInfo.compact, editOn: false};
        this.gongshiInfo.update((v) => [...v]);
      }
    }
  }
  onFormulaCompactChange(index: number, compact: FormulasCompactConfig | undefined) {
    const gongshiInfo = this.gongshiInfo()[index];
    if (gongshiInfo && compact) {
      gongshiInfo.compact = compact;
      this.gongshiInfo.update((v) => [...v]);
    }
  }
  async viewAllGonshis() {
    const useData = this.info().data.算料公式 || [];
    const url = await this.http.getShortUrl("算料公式", {useData, noToolbar: true});
    if (url) {
      window.open(url);
    }
  }
  async importGonshis() {
    const data = this.info().data;
    this.message.importData<算料公式[]>(null, async (gongshisAll) => {
      const data2 = await this.message.getImportFrom(gongshisAll, (v) => v.名字, "公式");
      if (!data2) {
        return false;
      }
      for (const item of data2.from) {
        this.justifyGongshi(item);
      }
      if (data2.mode === "replace" || !data.算料公式) {
        data.算料公式 = data2.from;
      } else {
        data.算料公式.push(...data2.from);
      }
      this.info.update((v) => ({...v}));
      this.slgsChange.emit();
      return true;
    });
  }
  async exportGongshis() {
    const gongshisAll = this.info().data.算料公式 || [];
    if (gongshisAll.length < 1) {
      return;
    }
    const data = await this.message.getExportFrom(gongshisAll, (v) => v.名字, "公式");
    if (!data) {
      return;
    }
    const gongshi = data.from;
    const names = [this.title(), DateTime.now().toFormat("yyyyMMdd")];
    const name0 = getValue(this.exportFilename(), this.message);
    if (name0) {
      names.unshift(name0);
    }
    this.message.exportData(gongshi, names.join("_"));
  }
  async clearGongshis() {
    if (!(await this.message.confirm(`确定清空全部【${this.gongshiTitle()}】吗？`))) {
      return;
    }
    const data = this.info().data;
    data.算料公式 = [];
    this.info.update((v) => ({...v}));
  }

  getGongshiStr(item: KeyValue<string, string | number>) {
    return `${item.key} = ${item.value}`;
  }

  async getShuruItem(data0?: 输入) {
    const data: 输入 = {名字: "", 默认值: "", 取值范围: "", 可以修改: true, ...data0};
    const form: InputInfo<typeof data>[] = [
      {
        type: "string",
        label: "名字",
        model: {data, key: "名字"},
        validators: [
          Validators.required,
          (control) => {
            const value = control.value;
            if ((!data0 || data0.名字 !== value) && this.info().data.输入数据?.some((v) => v.名字 === value)) {
              return {名字已存在: true};
            }
            return null;
          }
        ]
      },
      {type: "boolean", label: "可以修改", model: {data, key: "可以修改"}},
      {
        type: "string",
        label: "默认值",
        model: {data, key: "默认值"},
        validators: Validators.required
      },
      {
        type: "string",
        label: "取值范围",
        model: {data, key: "取值范围"},
        validators: [Validators.required, CustomValidators.numberRangeStr]
      },
      {type: "string", label: "生效条件", model: {data, key: "生效条件"}},
      {type: "number", label: "排序", model: {data, key: "排序"}}
    ];
    return await this.message.form<typeof data, typeof data>(form);
  }

  async onShuruToolbar(event: ToolbarButtonEvent) {
    const data = this.info().data;
    if (!data.输入数据) {
      return;
    }
    switch (event.button.event) {
      case "添加":
        {
          const item = await this.getShuruItem();
          if (item) {
            data.输入数据.push(item);
            this.info.update((v) => ({...v}));
          }
        }
        break;
      case "全部":
        {
          await openSuanliaogongshiDialog(this.dialog, {
            data: {info: {...this.info, data: {输入数据: data.输入数据}, isFromSelf: true}}
          });
          this.info.update((v) => ({...v}));
        }
        break;
    }
  }

  async onShuruRow(event: RowButtonEvent<ShuruTableDataSorted>) {
    const data = this.info().data;
    if (!data.输入数据) {
      return;
    }
    const {button, item} = event;
    switch (button.event) {
      case "编辑":
        {
          const item2 = data.输入数据[item.originalIndex];
          const item3 = await this.getShuruItem(item2);
          if (item3) {
            data.输入数据[item.originalIndex] = item3;
            this.info.update((v) => ({...v}));
          }
        }
        break;
      case "删除":
        if (await this.message.confirm(`确定删除【${item.名字}】吗？`)) {
          data.输入数据.splice(item.originalIndex, 1);
          this.info.update((v) => ({...v}));
        }
        break;
    }
  }

  slgsInfos = computed(() => {
    const infos: {textInfos: TextInfo[]}[] = [];
    const keys: (keyof 算料公式)[] = ["选项", "条件"];
    for (const slgs of this.info().data["算料公式"] || []) {
      infos.push({textInfos: keys.map((v) => ({name: v, text: getValueString(slgs[v], {separator: "\n", separatorKv: ": "})}))});
    }
    return infos;
  });

  close(submit = false) {
    this.closeOut.emit({submit});
  }
}
