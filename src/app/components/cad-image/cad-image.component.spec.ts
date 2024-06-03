import {ComponentFixture, TestBed} from "@angular/core/testing";
import {provideRouter} from "@angular/router";
import {CadImageComponent} from "./cad-image.component";

describe("CadImageComponent", () => {
  let component: CadImageComponent;
  let fixture: ComponentFixture<CadImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CadImageComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(CadImageComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("id", "test");
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
