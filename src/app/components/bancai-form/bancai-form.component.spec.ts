import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MrbcjfzXinghaoInfo} from "@app/views/mrbcjfz/mrbcjfz.utils";
import {BancaiFormComponent} from "./bancai-form.component";

describe("BancaiFormComponent", () => {
  let component: BancaiFormComponent;
  let fixture: ComponentFixture<BancaiFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BancaiFormComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(BancaiFormComponent);
    component = fixture.componentInstance;
    const ref = fixture.componentRef;
    ref.setInput("xinghao", new MrbcjfzXinghaoInfo("test", {vid: 1, mingzi: "1"}));
    ref.setInput("key", "a");
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
