import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatButtonModule} from "@angular/material/button";
import {MatMenuModule} from "@angular/material/menu";
import {getTestData, importZixuanpeijian} from "@components/dialogs/zixuanpeijian/zixuanpeijian.utils";
import {HttpModule} from "@modules/http/http.module";
import {MessageModule} from "@modules/message/message.module";
import {PjmkComponent} from "./pjmk.component";

describe("PjmkComponent", () => {
  let component: PjmkComponent;
  let fixture: ComponentFixture<PjmkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpModule, MatButtonModule, MatMenuModule, MessageModule, PjmkComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PjmkComponent);
    component = fixture.componentInstance;
    component.data = importZixuanpeijian(getTestData().data);
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
