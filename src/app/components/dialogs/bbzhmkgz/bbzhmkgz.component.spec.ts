import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {HttpModule} from "@modules/http/http.module";
import {MessageModule} from "@modules/message/message.module";
import {NgScrollbarModule} from "ngx-scrollbar";
import {BbzhmkgzComponent, BbzhmkgzComponentData} from "./bbzhmkgz.component";

const data: BbzhmkgzComponentData = {value: "test", vars: {a: "1", b: "2"}};
describe("BbzhmkgzComponent", () => {
  let component: BbzhmkgzComponent;
  let fixture: ComponentFixture<BbzhmkgzComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrowserAnimationsModule, HttpModule, MessageModule, NgScrollbarModule, BbzhmkgzComponent],
      providers: [
        {provide: MatDialogRef, useValue: {}},
        {provide: MAT_DIALOG_DATA, useValue: data}
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BbzhmkgzComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
