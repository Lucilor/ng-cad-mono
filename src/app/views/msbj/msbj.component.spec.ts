import {DragDropModule} from "@angular/cdk/drag-drop";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatButtonModule} from "@angular/material/button";
import {MatIconModule} from "@angular/material/icon";
import {MatSliderModule} from "@angular/material/slider";
import {MsbjRectsComponent} from "@components/msbj-rects/msbj-rects.component";
import {HttpModule} from "@modules/http/http.module";
import {MessageModule} from "@modules/message/message.module";
import {SpinnerModule} from "@modules/spinner/spinner.module";
import {NgScrollbarModule} from "ngx-scrollbar";
import {MsbjComponent} from "./msbj.component";

describe("MsbjComponent", () => {
  let component: MsbjComponent;
  let fixture: ComponentFixture<MsbjComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DragDropModule,
        HttpModule,
        MatButtonModule,
        MatIconModule,
        MatSliderModule,
        MessageModule,
        NgScrollbarModule,
        SpinnerModule,
        MsbjComponent,
        MsbjRectsComponent
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MsbjComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
