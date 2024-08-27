import {Component, effect, HostBinding, inject, input, OnInit, output} from "@angular/core";
import {imgCadEmpty} from "@app/app.common";
import {CadPreviewParams, getCadPreview} from "@app/cad/cad-preview";
import {CadCollection} from "@app/cad/collections";
import {generateLineTexts2} from "@app/cad/utils";
import {Subscribed} from "@app/mixins/subscribed.mixin";
import {CadData} from "@lucilor/cad-viewer";
import {ObjectOf, timeout} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {ImageComponent} from "@modules/image/components/image/image.component";
import {AppStatusService} from "@services/app-status.service";
import {Property} from "csstype";
import {filter, lastValueFrom, take} from "rxjs";
import {DataInfoChnageEvent} from "./cad-image.types";

@Component({
  selector: "app-cad-image",
  standalone: true,
  imports: [ImageComponent],
  templateUrl: "./cad-image.component.html",
  styleUrl: "./cad-image.component.scss"
})
export class CadImageComponent extends Subscribed() implements OnInit {
  private http = inject(CadDataService);
  private status = inject(AppStatusService);

  @HostBinding("style.--cad-image-width") cadImageWidth = "";
  @HostBinding("style.--cad-image-height") cadImageHeight = "";
  @HostBinding("style.--cad-image-background-color") cadImageBackgroundColor: Property.Background = "";

  id = input.required<string>();
  data = input<CadData>();
  collection = input<CadCollection>("cad");
  width = input<number>(300);
  height = input<number>(150);
  isImgId = input<boolean>();
  backgroundColor = input<Property.BackgroundColor>("black");
  paramsGetter = input<() => CadPreviewParams>();
  dataInfoChange = output<DataInfoChnageEvent>();

  url = "";
  imgCadEmpty = imgCadEmpty;

  constructor() {
    super();
    effect(() => {
      const width = this.width();
      this.cadImageWidth = width ? `${width}px` : "";
    });
    effect(() => {
      const height = this.height();
      this.cadImageHeight = height ? `${height}px` : "";
    });
    effect(() => {
      this.cadImageBackgroundColor = this.backgroundColor();
    });
    effect(() => {
      this.updateUrl();
    });
  }

  ngOnInit(): void {
    this.status.cadImgToUpdate$.subscribe((obj) => {
      let id = this.id();
      const data = this.data();
      if (data?.info.imgId) {
        id = data.info.imgId;
      }
      if (obj[id]) {
        this.updateUrl();
      }
    });
  }

  getImgUrl(id: string, force: boolean | number) {
    const params: ObjectOf<any> = {id};
    if (typeof force === "number") {
      params.t = force;
    }
    force = true;
    if (force) {
      params.t = Date.now();
    }
    return this.http.getUrl("ngcad/cadImg", params);
  }

  async getPreview(data: CadData) {
    const collection = this.collection();
    const params = this.paramsGetter()?.() || {};
    if (!params.config) {
      params.config = {};
    }
    if (params.config.width === undefined) {
      params.config.width = this.width();
    }
    if (params.config.height === undefined) {
      params.config.height = this.height();
    }
    if (params.config.backgroundColor === undefined) {
      params.config.backgroundColor = this.backgroundColor().toString();
    }
    return await getCadPreview(collection, data, params);
  }

  async updateUrl() {
    const id = this.id();
    const data = this.data();
    const isImgId = this.isImgId();
    let url = "";
    let force: boolean | number = this.status.forceUpdateCadImg;
    const force2 = this.status.forceUpdateCadImg2;
    const toUpdate = this.status.isCadImgToUpdate(id);
    if (toUpdate) {
      force = toUpdate.t;
    }
    const hasImgId = !!data?.info.imgId;
    if (id && !hasImgId) {
      if (force2 && !isImgId) {
        await this.refreshCadPreview();
        return;
      } else {
        url = this.getImgUrl(id, force);
      }
    } else if (data) {
      const {imgId, imgUpdate} = data.info;
      if (imgId) {
        if (imgUpdate || force || force2) {
          delete data.info.imgUpdate;
          url = await this.getPreview(data);
          await this.http.setCadImg(imgId, url, {spinner: false});
          url = this.getImgUrl(imgId, true);
          this.dataInfoChange.emit({info: data.info});
        } else {
          url = this.getImgUrl(imgId, false);
        }
      } else {
        url = await this.getPreview(data);
        data.info.imgId = await this.http.getMongoId({spinner: false});
        await this.http.setCadImg(data.info.imgId, url, {spinner: false});
        url = this.getImgUrl(data.info.imgId, true);
        this.dataInfoChange.emit({info: data.info});
      }
    }
    if (!url) {
      url = imgCadEmpty;
    }
    this.url = url;
  }

  async refreshCadPreview() {
    let data = this.data();
    if (data?.info.isLocal) {
      return;
    }
    const lockNum = this.status.updateCadImglLock$.value + 1;
    this.status.updateCadImglLock$.next(lockNum);
    if (lockNum > 1) {
      await lastValueFrom(
        this.status.updateCadImglLock$.pipe(
          filter((v) => v < lockNum),
          take(1)
        )
      );
      await timeout(0);
    }
    try {
      const collection = this.collection();
      const id = this.id();
      if (!data || data.info.incomplete) {
        const cadsResult = await this.http.getCad({collection, id}, {silent: true});
        if (cadsResult.cads[0]) {
          data = cadsResult.cads[0];
        }
      }
      if (data) {
        generateLineTexts2(data);
        const url = await this.getPreview(data);
        const id2 = data.info.imgId || id;
        await this.http.setCadImg(id2, url, {silent: true});
        this.url = this.getImgUrl(id2, true);
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.status.updateCadImglLock$.next(this.status.updateCadImglLock$.value - 1);
    }
  }

  onImgLoad() {
    this.status.removeCadImgToUpdate(this.id());
  }

  async onImgError() {
    await this.refreshCadPreview();
  }
}
