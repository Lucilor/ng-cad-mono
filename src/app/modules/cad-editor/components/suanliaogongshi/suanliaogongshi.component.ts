import {KeyValue, KeyValuePipe, NgTemplateOutlet} from "@angular/common";
import {Component, EventEmitter, HostBinding, Input, OnChanges, Output, QueryList, SimpleChanges, ViewChildren} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatDialog} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatTooltipModule} from "@angular/material/tooltip";
import {getCopyName} from "@app/app.common";
import {ShuruTableData} from "@app/components/lurushuju/lrsj-pieces/lrsj-zuofa/lrsj-zuofa.types";
import {Formulas} from "@app/utils/calc";
import {openEditFormulasDialog} from "@components/dialogs/edit-formulas-dialog/edit-formulas-dialog.component";
import {FormulasEditorComponent} from "@components/formulas-editor/formulas-editor.component";
import {downloadByString, isTypeOf, selectFiles} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {TableComponent} from "@modules/table/components/table/table.component";
import {RowButtonEvent, TableRenderInfo, ToolbarButtonEvent} from "@modules/table/components/table/table.types";
import {cloneDeep} from "lodash";
import {NgScrollbarModule} from "ngx-scrollbar";
import {v4} from "uuid";
import {getSortedItems, 算料公式, 输入} from "../../../../components/lurushuju/xinghao-data";
import {openSuanliaogongshiDialog} from "../dialogs/suanliaogongshi-dialog/suanliaogongshi-dialog.component";
import {SuanliaogongshiInfo} from "./suanliaogongshi.types";

@Component({
  selector: "app-suanliaogongshi",
  standalone: true,
  imports: [
    FormulasEditorComponent,
    KeyValuePipe,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatTooltipModule,
    NgScrollbarModule,
    TableComponent,
    NgTemplateOutlet
  ],
  templateUrl: "./suanliaogongshi.component.html",
  styleUrl: "./suanliaogongshi.component.scss"
})
export class SuanliaogongshiComponent implements OnChanges {
  @HostBinding("class") class = "ng-page";

  @Input({required: true}) info: SuanliaogongshiInfo = {data: {}};
  @Input() noScroll = false;
  @Output() slgsChange = new EventEmitter<void>();

  gongshiInfo: {formulas?: Formulas}[] = [];
  shuruTable: TableRenderInfo<ShuruTableData>;
  @ViewChildren("gongshiEditor") gongshiEditors?: QueryList<FormulasEditorComponent>;

  constructor(
    private message: MessageService,
    private dialog: MatDialog,
    private http: CadDataService
  ) {
    this.shuruTable = {
      title: "输入数据",
      subTitle: "注意：有输入时，相同名字的公式无效",
      subTitleStyle: {color: "red"},
      noCheckBox: true,
      columns: [
        {type: "string", field: "名字"},
        {type: "string", field: "默认值"},
        {type: "string", field: "取值范围"},
        {type: "boolean", field: "可以修改"},
        {type: "number", field: "排序"},
        {
          type: "button",
          field: "操作",
          buttons: [
            {event: "编辑", color: "primary"},
            {event: "删除", color: "primary"}
          ]
        }
      ],
      data: [],
      toolbarButtons: {
        extra: [
          {event: "添加", color: "primary"},
          {event: "全部", color: "primary"}
        ],
        inlineTitle: true
      }
    };
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.info) {
      this.gongshiInfo = [];
      if (this.info.data.算料公式) {
        this.gongshiInfo = this.info.data.算料公式.map(() => ({}));
      }
      if (this.info.data.输入数据) {
        this.shuruTable.data = getSortedItems(this.info.data.输入数据);
        const colPaixu = this.shuruTable.columns.find((v) => v.field === "排序");
        if (colPaixu) {
          colPaixu.hidden = !this.info.isFromSelf;
        }
        const toolbarBtnQuanbu = this.shuruTable.toolbarButtons?.extra?.find((v) => v.event === "全部");
        if (toolbarBtnQuanbu) {
          toolbarBtnQuanbu.hidden = this.info.isFromSelf;
        }
      }
    }
  }

  returnZero() {
    return 0;
  }

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
        varNames: this.info.varNames,
        extraInputInfos: [
          {type: "string", label: "名字", model: {data, key: "名字"}, validators: Validators.required},
          {type: "object", label: "选项", model: {data, key: "选项"}, optionsDialog: {}, optionMultiple: true},
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
    if (item.选项) {
      const removeKeys = ["产品分类", "包边方向", "开启"];
      for (const key of removeKeys) {
        delete item.选项[key];
      }
    }
  }

  async addGongshi() {
    const data = this.info.data;
    if (!data.算料公式) {
      return;
    }
    const item = await this.getGongshiItem();
    if (item) {
      data.算料公式.push(item);
      this.gongshiInfo.push({});
      this.slgsChange.emit();
    }
  }

  async editGongshi(index: number) {
    const data = this.info.data;
    if (!data.算料公式) {
      return;
    }
    const item = await this.getGongshiItem(data.算料公式[index]);
    if (item) {
      this.justifyGongshi(item);
      data.算料公式[index] = item;
      this.slgsChange.emit();
    }
  }

  async copyGongshi(index: number) {
    const data = this.info.data;
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
    this.gongshiInfo.push({});
    this.slgsChange.emit();
  }

  async removeGongshi(index: number) {
    const data = this.info.data;
    if (!data.算料公式) {
      return;
    }
    if (!(await this.message.confirm(`确定删除【${data.算料公式[index].名字}】吗？`))) {
      return;
    }
    data.算料公式.splice(index, 1);
    this.gongshiInfo.splice(index, 1);
    this.slgsChange.emit();
  }

  editGongshiStart(index: number) {
    const info = this.gongshiInfo[index];
    info.formulas = cloneDeep(this.info.data.算料公式?.[index].公式);
  }

  editGongshiEnd(index: number, formulas: Formulas | null, close = false) {
    const info = this.gongshiInfo[index];
    if (formulas && this.info.data.算料公式) {
      this.info.data.算料公式[index].公式 = formulas;
      this.slgsChange.emit();
    }
    if (close) {
      delete info.formulas;
    }
  }

  async viewAllGonshis() {
    const useData = this.info.data.算料公式 || [];
    const url = await this.http.getShortUrl("算料公式", {useData, noToolbar: true});
    if (url) {
      window.open(url);
    }
  }

  async importGonshis() {
    const data = this.info.data;
    if (!(await this.message.confirm("确定导入吗？"))) {
      return;
    }
    const files = await selectFiles({accept: ".json"});
    const file = files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      let data2: any;
      try {
        data2 = JSON.parse(reader.result as string);
      } catch {}
      if (Array.isArray(data2)) {
        if (!Array.isArray(data.算料公式)) {
          data.算料公式 = [];
        }
        for (const item of data2) {
          this.justifyGongshi(item);
          data.算料公式.push(item);
        }
        this.slgsChange.emit();
      } else {
        this.message.error("算料公式数据有误");
      }
    });
    reader.readAsText(file);
  }

  exportGongshis() {
    const data = this.info.data;
    downloadByString(JSON.stringify(data.算料公式), {filename: "算料公式.json"});
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
            if ((!data0 || data0.名字 !== value) && this.info.data.输入数据?.some((v) => v.名字 === value)) {
              return {名字已存在: true};
            }
            return null;
          }
        ]
      },
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
        validators: [
          Validators.required,
          (control) => {
            const value = control.value;
            if (!/^\d+(.\d+)?-\d+(.\d+)?$/.test(value)) {
              return {取值范围不符合格式: true};
            }
            return null;
          }
        ]
      },
      {type: "boolean", label: "可以修改", model: {data, key: "可以修改"}},
      {type: "number", label: "排序", model: {data, key: "排序"}}
    ];
    return await this.message.form<typeof data, typeof data>(form);
  }

  async onShuruToolbar(event: ToolbarButtonEvent) {
    const data = this.info.data;
    if (!data.输入数据) {
      return;
    }
    switch (event.button.event) {
      case "添加":
        {
          const item = await this.getShuruItem();
          if (item) {
            data.输入数据.push(item);
            this.shuruTable.data = getSortedItems(data.输入数据);
          }
        }
        break;
      case "全部":
        {
          await openSuanliaogongshiDialog(this.dialog, {
            data: {info: {...this.info, data: {输入数据: data.输入数据}, isFromSelf: true}}
          });
          this.shuruTable.data = getSortedItems(data.输入数据);
        }
        break;
    }
  }

  async onShuruRow(event: RowButtonEvent<ShuruTableData>) {
    const data = this.info.data;
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
            this.shuruTable.data = getSortedItems(data.输入数据);
          }
        }
        break;
      case "删除":
        if (await this.message.confirm(`确定删除【${item.名字}】吗？`)) {
          data.输入数据.splice(item.originalIndex, 1);
          this.shuruTable.data = getSortedItems(data.输入数据);
        }
        break;
    }
  }
}
