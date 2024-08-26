import {AfterViewInit, Component, forwardRef, HostBinding, Inject, ViewChild} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogRef} from "@angular/material/dialog";
import {MatIconModule} from "@angular/material/icon";
import {MatPaginator, MatPaginatorModule, PageEvent} from "@angular/material/paginator";
import {MatTooltipModule} from "@angular/material/tooltip";
import {filePathUrl} from "@app/app.common";
import {CadData} from "@lucilor/cad-viewer";
import {ObjectOf, queryString, timeout} from "@lucilor/utils";
import {ClickStopPropagationDirective} from "@modules/directives/click-stop-propagation.directive";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {GetOptionsParams, OptionsData, OptionsDataData, TableDataBase} from "@modules/http/services/cad-data.service.types";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {SpinnerService} from "@modules/spinner/services/spinner.service";
import {debounce} from "lodash";
import {NgScrollbar} from "ngx-scrollbar";
import {ImageComponent} from "../../../modules/image/components/image/image.component";
import {InputComponent} from "../../../modules/input/components/input.component";
import {SpinnerComponent} from "../../../modules/spinner/components/spinner/spinner.component";
import {getOpenDialogFunc} from "../dialog.common";

@Component({
  selector: "app-cad-options",
  templateUrl: "./cad-options.component.html",
  styleUrls: ["./cad-options.component.scss"],
  standalone: true,
  imports: [
    ClickStopPropagationDirective,
    forwardRef(() => InputComponent),
    ImageComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogActions,
    MatIconModule,
    MatPaginatorModule,
    MatTooltipModule,
    NgScrollbar,
    SpinnerComponent
  ]
})
export class CadOptionsComponent implements AfterViewInit {
  @HostBinding("class") class = ["ng-page"];
  pageData: (OptionsData["data"][number] & {checked: boolean})[] = [];
  length = 100;
  pageSizeOptions = [50, 100, 200, 500];
  pageSize = 50;
  checkedIdsCurr = new Set<number>();
  checkedIdsOthers = new Set<number>();
  loaderIds = {optionsLoader: "cadOptions", submitLoaderId: "cadOptionsSubmit"};
  searchValue = "";
  searchInputInfo: InputInfo<this> = {
    label: "搜索",
    type: "string",
    autoFocus: true,
    model: {data: this, key: "searchValue"},
    onInput: debounce(() => {
      if (!this.showPaginator) {
        this.search();
      }
    }, 500),
    onChange: () => {
      if (this.showPaginator) {
        this.search();
      }
    }
  };
  filePathUrl = filePathUrl;
  @ViewChild("paginator", {read: MatPaginator}) paginator?: MatPaginator;
  showPaginator = true;

  constructor(
    public dialogRef: MatDialogRef<CadOptionsComponent, CadOptionsOutput>,
    @Inject(MAT_DIALOG_DATA) public data: CadOptionsInput,
    private http: CadDataService,
    private spinner: SpinnerService,
    private message: MessageService
  ) {}

  async ngAfterViewInit() {
    await timeout(0);
    await this.getData(1);
  }

  async submit() {
    const result: CadOptionsOutput = {
      options: []
    };
    if (this.data.defaultValue) {
      const {value, required} = this.data.defaultValue;
      if (required && !value && this.checkedIdsCurr.size > 1) {
        this.message.error("请选择默认值");
        return;
      }
      result.defaultValue = value;
    }
    const data = await this.getOptions(
      {
        name: this.data.name,
        data: this.data.data,
        xinghao: this.data.xinghao,
        includeTingyong: true,
        values: Array.from(this.checkedIdsCurr).concat(Array.from(this.checkedIdsOthers)) as any,
        fields: ["vid"],
        nameField: this.data.nameField,
        info: this.data.info
      },
      [this.loaderIds.submitLoaderId],
      false
    );
    if (!data) {
      return;
    }
    result.options = data.data.map((v) => ({vid: v.vid, mingzi: v.name}));
    this.dialogRef.close(result);
  }

  close() {
    this.dialogRef.close();
  }

  searchKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      this.search();
    }
  }

  search(stayOnPage = false, refreshLocalOptions = false) {
    if (this.paginator) {
      if (!stayOnPage) {
        this.paginator.pageIndex = 0;
      }
      this.getData(this.paginator.pageIndex + 1, refreshLocalOptions);
    } else {
      this.getData(undefined, refreshLocalOptions);
    }
  }

  changePage(event: PageEvent) {
    this.getData(event.pageIndex + 1);
  }

  async getOptions(params: GetOptionsParams, loader: Parameters<typeof this.spinner.show>, refreshLocalOptions: boolean) {
    let data: OptionsData | null;
    const {options} = this.data;
    if (Array.isArray(options)) {
      if (refreshLocalOptions) {
        this.spinner.show(...loader);
        data = await this.http.getOptions({...params, page: 1, limit: Infinity});
        if (data) {
          options.length = 0;
          options.push(...data.data);
        }
        this.spinner.hide(loader[0]);
      }
      const field = (params.fields?.[0] || "name") as keyof OptionsDataData;
      const options2 = options.filter((v) => {
        if (params.values && !params.values.includes(v[field])) {
          return false;
        }
        return queryString(this.searchValue, v.name);
      });
      data = {data: options2, count: options2.length};
      this.showPaginator = false;
    } else {
      this.spinner.show(...loader);
      data = await this.http.getOptions(params);
      this.spinner.hide(loader[0]);
      this.showPaginator = true;
    }
    return data;
  }

  async getData(page?: number, refreshLocalOptions = false) {
    const {checkedIdsCurr, checkedIdsOthers, pageData} = this;
    checkedIdsCurr.clear();
    for (const {vid, checked} of pageData) {
      if (checked) {
        checkedIdsOthers.add(vid);
      }
    }
    const data = (await this.getOptions(
      {
        name: this.data.name,
        search: this.searchValue,
        page,
        limit: this.paginator?.pageSize,
        data: this.data.data,
        xinghao: this.data.xinghao,
        filter: this.data.filter,
        fields: this.data.fields,
        nameField: this.data.nameField,
        info: this.data.info
      },
      [this.loaderIds.optionsLoader, {text: "获取CAD数据"}],
      refreshLocalOptions
    )) || {data: [], count: 0};
    this.length = data.count;
    this.pageData = data.data.map((v) => {
      let checked = false;
      if (this.data.checkedItems?.includes(v.name)) {
        checked = true;
      } else if (this.data.checkedVids?.includes(v.vid)) {
        checked = true;
      }
      if (checked) {
        checkedIdsCurr.add(v.vid);
        checkedIdsOthers.delete(v.vid);
      }
      return {...v, checked};
    });
    return data;
  }

  onCheckboxChange(item: CadOptionsComponent["pageData"][number]) {
    const {multi} = this.data;
    if (!item.checked && !multi) {
      this.pageData.forEach((v) => (v.checked = false));
    }
    item.checked = !item.checked;
    const {checkedIdsCurr} = this;
    if (item.checked) {
      if (!multi) {
        checkedIdsCurr.clear();
      }
      checkedIdsCurr.add(item.vid);
    } else {
      checkedIdsCurr.delete(item.vid);
    }
  }

  selectAll() {
    for (const item of this.pageData) {
      if (!item.checked) {
        this.onCheckboxChange(item);
      }
    }
  }

  selectReverse() {
    for (const item of this.pageData) {
      this.onCheckboxChange(item);
    }
  }

  setDefaultValue(item: CadOptionsComponent["pageData"][number]) {
    if (!item.checked) {
      this.onCheckboxChange(item);
    }
    const {defaultValue} = this.data;
    if (!defaultValue) {
      return;
    }
    if (defaultValue.value === item.name) {
      defaultValue.value = "";
    } else {
      defaultValue.value = item.name;
    }
  }

  async editInNewTab() {
    const {openInNewTab, name} = this.data;
    if (!openInNewTab) {
      return;
    }
    const url = await this.http.getShortUrl(name);
    if (url) {
      window.open(url);
    }
    if (await this.message.newTabConfirm()) {
      this.search(true, true);
    }
  }
}

export const openCadOptionsDialog = getOpenDialogFunc<CadOptionsComponent, CadOptionsInput, CadOptionsOutput>(CadOptionsComponent, {
  width: "80vw",
  height: "80vh"
});

export interface CadOptionsInput {
  data?: CadData;
  name: string;
  checkedItems?: string[];
  checkedVids?: number[];
  multi?: boolean;
  xinghao?: string;
  filter?: ObjectOf<any>;
  fields?: string[];
  nameField?: string;
  options?: OptionsDataData[];
  defaultValue?: {value?: string; required?: boolean};
  noImage?: boolean;
  openInNewTab?: boolean;
  useLocalOptions?: boolean;
  info?: ObjectOf<any>;
}

export interface CadOptionsOutput {
  options: TableDataBase[];
  defaultValue?: string;
}
