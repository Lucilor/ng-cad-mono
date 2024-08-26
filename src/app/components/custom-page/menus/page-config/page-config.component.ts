import {ChangeDetectionStrategy, Component, computed, inject} from "@angular/core";
import {InputComponent} from "@app/modules/input/components/input.component";
import {InputInfo, InputInfoColor, InputInfoNumber, InputInfoSelect} from "@app/modules/input/components/input.types";
import {cloneDeep} from "lodash";
import {NgScrollbarModule} from "ngx-scrollbar";
import {getGroupStyle, getInputStyle, getNumberUnitInput, getUnifiedInputs} from "../../models/input-info-utils";
import {PageConfig} from "../../models/page";
import {PageOrientation, PageSizeNameCustom, pageSizeNamesCustom} from "../../models/page-size";
import {trblItems} from "../../models/page.utils";
import {PageStatusService} from "../../services/page-status.service";

@Component({
  selector: "app-page-config",
  standalone: true,
  imports: [InputComponent, NgScrollbarModule],
  templateUrl: "./page-config.component.html",
  styleUrl: "./page-config.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageConfigComponent {
  private pageStatus = inject(PageStatusService);

  get config() {
    return this.pageStatus.pageConfig;
  }

  inputInfos = computed(() => {
    const config = this.config();
    const onChange = () => this.config.set(cloneDeep(config));
    const sizeNameInput: InputInfoSelect<PageConfig, PageSizeNameCustom> = {
      type: "select",
      label: "页面大小",
      options: pageSizeNamesCustom,
      style: getInputStyle(true),
      model: {data: config, key: "sizeName"},
      onChange
    };
    const orientationInput: InputInfoSelect<PageConfig, PageOrientation> = {
      type: "select",
      label: "页面方向",
      options: [
        {label: "纵向", value: "portrait"},
        {label: "横向", value: "landscape"}
      ],
      style: getInputStyle(true),
      model: {data: config, key: "orientation"},
      onChange
    };
    const isCustomSize = config.sizeName === "自定义";
    const widthInput: InputInfoNumber<PageConfig> = {
      ...getNumberUnitInput(true, "页宽", "mm"),
      readonly: !isCustomSize,
      model: {data: config, key: "width"},
      onChange
    };
    const heightInput: InputInfoNumber<PageConfig> = {
      ...getNumberUnitInput(true, "页高", "mm"),
      readonly: !isCustomSize,
      model: {data: config, key: "height"},
      onChange
    };
    const backgroundInnerInput: InputInfoColor<PageConfig> = {
      type: "color",
      label: "页面背景（内）",
      style: getInputStyle(true),
      model: {data: config, key: "backgroundInnerColor"},
      onChange
    };
    const backgroundOuterInput: InputInfoColor<PageConfig> = {
      type: "color",
      label: "页面背景（外）",
      style: getInputStyle(true),
      model: {data: config, key: "backgroundOuterColor"},
      onChange
    };
    const workSpaceBackgroundInput: InputInfoColor<PageConfig> = {
      type: "color",
      label: "工作区背景",
      style: getInputStyle(true),
      model: {data: config, key: "workSpaceBgColor"},
      onChange
    };
    const paddingInputs: InputInfoNumber<PageConfig["padding"]>[] = trblItems.map(({name, index}) => {
      return getNumberUnitInput(true, name, "mm", {flex: "0 0 50%"}, {model: {data: config.padding, key: index}});
    });
    const inputInfos: InputInfo[] = [
      {type: "group", label: "", infos: [sizeNameInput, orientationInput], groupStyle: getGroupStyle()},
      {type: "group", label: "", infos: [widthInput, heightInput], groupStyle: getGroupStyle()},
      {type: "group", label: "", infos: [workSpaceBackgroundInput], groupStyle: getGroupStyle()},
      {type: "group", label: "", infos: [backgroundInnerInput, backgroundOuterInput], groupStyle: getGroupStyle()},
      {
        type: "group",
        label: "页边距",
        infos: getUnifiedInputs("页边距", paddingInputs, config.padding, onChange),
        groupStyle: getGroupStyle()
      }
    ];
    return inputInfos;
  });
}
