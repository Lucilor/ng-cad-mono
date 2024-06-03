import {Component, HostBinding, OnInit} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {setGlobal} from "@app/app.common";
import {CadDataService} from "@app/modules/http/services/cad-data.service";
import {InputComponent} from "@app/modules/input/components/input.component";
import {InputInfo} from "@app/modules/input/components/input.types";
import {convertOptions} from "@app/modules/input/components/input.utils";
import {MessageService} from "@app/modules/message/services/message.service";
import {AppStatusService} from "@app/services/app-status.service";
import {environment} from "@env";
import {downloadByString, selectFiles} from "@lucilor/utils";
import {cloneDeep} from "lodash";
import {NgScrollbarModule} from "ngx-scrollbar";
import {DefaultWorkDataFormInfo, DefaultWorkDataListItem, WorkSpaceData} from "./work-space.types";
import {WorkSpaceManager} from "./work-space.utils";

@Component({
  selector: "app-work-space",
  standalone: true,
  imports: [InputComponent, MatButtonModule, NgScrollbarModule],
  templateUrl: "./work-space.component.html",
  styleUrl: "./work-space.component.scss"
})
export class WorkSpaceComponent implements OnInit {
  @HostBinding("class") class = "ng-page";

  manager = new WorkSpaceManager();
  defaultWorkDataFormInfo: DefaultWorkDataFormInfo | null = null;
  defaultWorkDataList: DefaultWorkDataListItem[] | null = null;

  project = this.status.project;
  isAdmin$ = this.status.isAdmin$;
  showMoreButtons = !environment.production;
  production = environment.production;
  showDefaultWorkDataList = false;
  editXiaodaohangsDocs = false;

  constructor(
    private http: CadDataService,
    private message: MessageService,
    private status: AppStatusService
  ) {
    setGlobal("workSpace", this);
  }

  ngOnInit() {
    this.refresh();
  }

  async refresh() {
    const data = await this.http.getData<WorkSpaceData>("jichu/work/getWorkData");
    this.manager.import(data);
    this.defaultWorkDataFormInfo = await this.http.getData<DefaultWorkDataFormInfo | null>("jichu/work/getDefaultWorkDataFormInfo");
    this.editXiaodaohangsDocs = !!this.defaultWorkDataFormInfo?.xiaodaohangsDocs;
  }

  async editType(i: number) {
    const typePrev = this.manager.types[i];
    const type = cloneDeep(typePrev);
    const form: InputInfo<typeof type>[] = [
      {type: "string", label: "名字", model: {data: type, key: "name"}},
      {type: "number", label: "排序", model: {data: type, key: "order"}}
    ];
    const result = await this.message.form(form);
    if (result) {
      const typeExisted = this.manager.types.find((v, j) => v.name === type.name && i !== j);
      if (typeExisted) {
        if (!(await this.message.confirm("该分类已存在，是否合并？"))) {
          return;
        }
        if (typeof typeExisted.order !== "number") {
          typeExisted.order = type.order;
        }
        for (const item of this.manager.favorites) {
          if (item.type === type.name) {
            item.type = typeExisted.name;
          }
        }
        this.manager.types.splice(i, 1);
      } else {
        this.manager.types[i] = type;
      }
      if (typePrev.name !== type.name) {
        for (const item of this.manager.favorites) {
          if (item.type === typePrev.name) {
            item.type = type.name;
          }
        }
      }
      if (typePrev.order !== type.order) {
        if (typeof type.order !== "number") {
          delete type.order;
        }
        this.manager.sortTypes();
      }
      await this.submit();
    }
  }

  async editFavorite(i: number) {
    const favoritePrev = this.manager.favorites[i];
    const favorite = cloneDeep(favoritePrev);
    const typeNames = this.manager.types.map((v) => v.name);
    const form: InputInfo<typeof favorite>[] = [
      {type: "string", label: "分类", options: typeNames, fixedOptions: typeNames, model: {data: favorite, key: "type"}},
      {type: "number", label: "排序", model: {data: favorite, key: "order"}, autoFocus: true}
    ];
    const result = await this.message.form(form);
    if (result) {
      this.manager.favorites[i] = favorite;
      if (favoritePrev.type !== favorite.type) {
        this.manager.update();
      } else if (favoritePrev.order !== favorite.order) {
        this.manager.sortFavorites();
      }
      await this.submit();
    }
  }

  async removeFavorite(i: number) {
    const favorite = this.manager.favorites[i];
    if (!(await this.message.confirm(`确定删除【${favorite.xiao}】？`))) {
      return;
    }
    this.manager.favorites.splice(i, 1);
    this.manager.update();
    await this.submit();
  }

  async openFavorite(i: number) {
    const favorite = this.manager.favorites[i];
    const parent = window.parent as any;
    if (parent.app) {
      await parent.app.openTab(favorite.id, 1);
    } else {
      const url = await this.http.getShortUrl(favorite.xiao);
      if (url) {
        window.open(url);
      }
    }
  }

  async submit() {
    const data = this.manager.export();
    await this.http.getData("jichu/work/setWorkData", {data});
  }

  async clear() {
    if (!(await this.message.confirm("是否清空当前数据？"))) {
      return;
    }
    this.manager.clear();
    await this.submit();
  }

  async import() {
    const file = (await selectFiles({accept: ".json"}))?.[0];
    if (!file) {
      return;
    }
    let data: WorkSpaceData | null = null;
    try {
      data = JSON.parse(await file.text());
    } catch (e) {
      console.error(e);
    }
    if (!data) {
      return;
    }
    data.user = this.manager.user;
    this.manager.import(data);
    await this.submit();
  }

  export() {
    const data = this.manager.export();
    delete data.user;
    downloadByString(JSON.stringify(data), {filename: "工作台.json"});
  }

  async loadDefaultWorkData(data: WorkSpaceData) {
    this.manager.import(data);
    await this.submit();
  }

  async removeDefaultWorkData(key: string, juese: string | null = null, confirm = false) {
    if (confirm && !(await this.message.confirm("是否确定删除？"))) {
      return;
    }
    const arr = key.split(".");
    if (arr.length === 2) {
      key = arr[0];
      juese = arr[1];
    }
    await this.http.getData("jichu/work/unsetDefaultWorkData", {key, juese});
    await this.getDefaultWorkDataList();
  }

  getDefaultWorkDataForm(type: "set" | "unset") {
    const values = {key: "", juese: ""};
    const form: InputInfo<typeof values>[] = [];
    const {defaultWorkDataPathKeys, jueses} = this.defaultWorkDataFormInfo || {};
    const labelKey = type === "set" ? "labelSet" : "labelUnset";
    if (defaultWorkDataPathKeys) {
      form.push({
        type: "select",
        label: defaultWorkDataPathKeys[labelKey],
        options: convertOptions(defaultWorkDataPathKeys.options),
        model: {data: values, key: "key"},
        validators: Validators.required,
        onChange: (val: string) => {
          const hasJuese = val === "角色";
          form[1].hidden = !hasJuese;
          form[1].validators = hasJuese ? Validators.required : undefined;
        }
      });
    }
    if (jueses) {
      form.push({
        type: "string",
        label: jueses[labelKey],
        options: convertOptions(jueses.options),
        optionRequired: true,
        model: {data: values, key: "juese"},
        hidden: true
      });
    }
    return {form, values};
  }

  async setDefaultWorkData() {
    const {form, values} = this.getDefaultWorkDataForm("set");
    const result = await this.message.form(form);
    if (result) {
      const data = this.manager.export();
      await this.http.getData("jichu/work/setDefaultWorkData", {...values, data});
      await this.getDefaultWorkDataList();
    }
  }

  async unsetDefaultWorkData() {
    const {form, values} = this.getDefaultWorkDataForm("unset");
    const result = await this.message.form(form);
    if (result) {
      await this.removeDefaultWorkData(values.key, values.juese);
    }
  }

  async importDefaultWorkData() {
    if (!(await this.message.confirm("加载默认配置会覆盖当前配置，是否继续？"))) {
      return;
    }
    const data = await this.http.getData<WorkSpaceData>("jichu/work/getDefaultWorkData");
    if (data) {
      await this.loadDefaultWorkData(data);
    }
  }

  async getDefaultWorkDataList(force = false) {
    if (!force && !this.defaultWorkDataList) {
      return;
    }
    this.defaultWorkDataList = await this.http.getData<DefaultWorkDataListItem[]>("jichu/work/getDefaultWorkDataList");
  }

  async toggleDefaultWorkDataList() {
    this.showDefaultWorkDataList = !this.showDefaultWorkDataList;
    if (this.showDefaultWorkDataList && !this.defaultWorkDataList) {
      await this.getDefaultWorkDataList(true);
    }
  }
}
