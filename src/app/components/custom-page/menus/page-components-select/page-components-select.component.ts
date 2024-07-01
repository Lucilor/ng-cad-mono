import {ChangeDetectionStrategy, Component, inject} from "@angular/core";
import {MatTooltipModule} from "@angular/material/tooltip";
import {getInsertName} from "@app/app.common";
import {ImageComponent} from "@app/modules/image/components/image/image.component";
import {keysOf} from "@lucilor/utils";
import {PageComponentInfos, pageComponentInfos, PageComponentType} from "../../models/page-component-infos";
import {getPageComponentNames} from "../../models/page-component-utils";
import {PageComponentForm} from "../../models/page-components/page-component-form";
import {PageComponentText} from "../../models/page-components/page-component-text";
import {PageStatusService} from "../../services/page-status.service";

@Component({
  selector: "app-page-components-select",
  standalone: true,
  imports: [ImageComponent, MatTooltipModule],
  templateUrl: "./page-components-select.component.html",
  styleUrl: "./page-components-select.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageComponentsSeletComponent {
  private pageStatus = inject(PageStatusService);

  get components() {
    return this.pageStatus.components;
  }

  infos: {key: PageComponentType; value: PageComponentInfos[PageComponentType]}[];

  constructor() {
    this.infos = [];
    for (const key of keysOf(pageComponentInfos)) {
      if (key === "group") {
        continue;
      }
      this.infos.push({key, value: pageComponentInfos[key]});
    }
  }

  async addComponent(type: PageComponentType) {
    const info = pageComponentInfos[type];
    const components = this.components();
    const names = getPageComponentNames(components);
    const component = new info.class(getInsertName(names, info.name + "组件"));
    component.background = "rgba(255,255,255,0)";
    component.size.set(100, 100);
    if (component instanceof PageComponentText) {
      component.text = "双击编辑文本";
    } else if (component instanceof PageComponentForm) {
      component.rows = 1;
      component.cols = 1;
      component.rowHeight = 22;
      component.labelWidth = 50;
      component.valueWidth = 100;
      component.labelPadding = [5, 5, 5, 5];
      component.valuePadding = [5, 5, 5, 5];
      component.borderColor = "black";
      component.borderWidth = 1;
      component.borderStyle = "solid";
    }
    this.components.set([...components, component]);
  }
}
