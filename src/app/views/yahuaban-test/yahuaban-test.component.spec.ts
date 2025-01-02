import {ComponentFixture, TestBed} from "@angular/core/testing";
import {YahuabanTestComponent} from "./yahuaban-test.component";

describe("YahuabanTestComponent", () => {
  let component: YahuabanTestComponent;
  let fixture: ComponentFixture<YahuabanTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YahuabanTestComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(YahuabanTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
