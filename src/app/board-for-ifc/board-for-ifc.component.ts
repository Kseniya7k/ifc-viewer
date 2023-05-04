import {AfterViewInit, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  MeshLambertMaterial, Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {IFCLoader} from 'web-ifc-three/IFCLoader';
import {
  IFCBUILDING,
  IFCBUILDINGELEMENTPROXY,
  IFCBUILDINGSTOREY,
  IFCELEMENTASSEMBLY,
  IFCOPENINGELEMENT,
  IFCSITE,
  IFCSPACE
} from "web-ifc";
import {acceleratedRaycast, computeBoundsTree, disposeBoundsTree} from 'three-mesh-bvh';
import {IFCModel} from 'web-ifc-three/IFC/components/IFCModel';
import {Subset} from "web-ifc-three/IFC/components/subsets/SubsetManager";
import {SubscribeService} from "../subscribe.service";
import {BehaviorSubject, filter, ReplaySubject, takeUntil} from "rxjs";
import {element} from "three/examples/jsm/nodes/shadernode/ShaderNodeBaseElements";
import {IfcAPI} from "web-ifc/web-ifc-api";
import { throttle } from "lodash";
export type Node = {
  expressID: string,
  type: string,
  children: Node[]
}

export const firstObj = {
  expressID: 23375,
  type: 1095909175,
  GlobalId: { value: "3Z_HAlHdH2PBUO1RMUa1mn", type: 1 },
  OwnerHistory: { value: 2, type: 5 },
  Name: { value: "51101531", type: 1 },
  Description: { value: "", type: 1 },
  ObjectType: { value: "", type: 1 },
  ObjectPlacement: { value: 23374, type: 5 },
  Representation: { value: 49793, type: 5 },
  Tag: null,
  CompositionType: { type: 3, value: "ELEMENT" }
}


@Component({
  selector: 'app-board-for-ifc',
  templateUrl: './board-for-ifc.component.html',
  styleUrls: ['./board-for-ifc.component.scss']
})
export class BoardForIfcComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('canvasIFC') canvasIFC: any;
  @ViewChild('openIfcFileInput') openIfcFileInput: any;

  scene: Scene = new Scene();

  size = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  aspect = this.size.width / this.size.height;

  camera = new PerspectiveCamera(45, this.aspect, 1, 1100);

  lightColor = 0xffffff;

  ambientLight = new AmbientLight(this.lightColor, 0.5);

  ifcLoader: IFCLoader = new IFCLoader();

  grid = new GridHelper();

  renderer: WebGLRenderer | undefined;

  controls: OrbitControls | undefined;

  ifcModels: Array<IFCModel> = [];

  id: null | number = null;

  prevID: number | undefined;

  preselectModel = {id: -1};

  preselectMat = new MeshLambertMaterial({
    transparent: true,
    opacity: 0.6,
    color: 0xff88ff,
    depthTest: false,
  });

  objectScane: any;

  tree: Node | null = null;

  categories: Record<string, number> = {
    IFCSITE,
    IFCBUILDING,
    IFCBUILDINGSTOREY,
    IFCBUILDINGELEMENTPROXY,
    IFCELEMENTASSEMBLY
  };

  subsets: Record<number, Subset> = {};

  private expressId: number;

  private currentHideElement: any;

  private currentRevertHideElement: any;

  public fileUrl = '';

  modelIDIfcFile: number;

  loadingProcess: number;
  destroy: ReplaySubject<any> = new ReplaySubject<any>(1);
  isShowLoading: boolean = false;
  ifcAPI = new IfcAPI();
  private ifcURL: string;

  constructor(private subscribeService: SubscribeService) {
  }

  ngOnInit() {
    this.loadingProcess = 0;
  }

  ngOnDestroy() {
    this.destroy.next(null);
    this.destroy.complete();
  }

  async ngAfterViewInit() {
    this.renderer = new WebGLRenderer({ antialias: true, canvas: this.canvasIFC.nativeElement });
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    await this.ifcLoader.ifcManager.setWasmPath("assets/");
    await this.ifcAPI.SetWasmPath("assets/");
    this.scene.background = new Color(this.lightColor);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const directionalLight1 = new DirectionalLight(this.lightColor, 0.8);
    directionalLight1.position.set(1, 1, 1);
    this.scene.add(directionalLight1);
    const directionalLight2 = new DirectionalLight(this.lightColor, 0.8);
    directionalLight2.position.set(-1, 0.5, -1);
    this.scene.add(directionalLight2);
    const ambientLight = new AmbientLight(this.lightColor, 0.25);
    this.scene.add(ambientLight);


    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer?.setSize(window.innerWidth, window.innerHeight);
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    // this.stats.end();
    requestAnimationFrame(this.setupAnimation);

    this.camera.position.set(10, 10, 10);
    this.controls.target.set(0, 0, 0);

    this.scene.add(this.grid);

    await this.ifcLoader.ifcManager.parser.setupOptionalCategories({
      [IFCSPACE]: false,
      [IFCOPENINGELEMENT]: false
    });

    this.ifcLoader.ifcManager.setupThreeMeshBVH(
      computeBoundsTree,
      disposeBoundsTree,
      acceleratedRaycast
    );

    const raycaster = new Raycaster();
    raycaster.firstHitOnly = true;

    this.subscribeService.hide$.pipe(takeUntil(this.destroy), filter((el) => el !== null)).subscribe((element) => {
      this.currentHideElement = element;

      this.hideElement();
    });

    this.subscribeService.removeHide$.pipe(takeUntil(this.destroy), filter((el) => el !== null)).subscribe((element) => {
      this.currentRevertHideElement = element;

      this.revertHideElement();
    });

    await this.ifcAPI.Init();
  }

   async addFile(event: Event) {
     // @ts-ignore
     let file = event.target.files[0];
     this.ifcURL = URL.createObjectURL(file);
   //   this.ifcLoader.load(ifcURL, (ifcModel: any) => {
   //     console.log(ifcModel);
   //     this.scene.add(ifcModel);
   //     console.log('end');
   // });
     await this.ifcLoader.ifcManager.applyWebIfcConfig({
       COORDINATE_TO_ORIGIN: true,
       USE_FAST_BOOLS: true
     });

     this.isShowLoading = true;
     await this.ifcLoader.load(this.ifcURL, (result) => {
       this.ifcModels.push(result);
       // this.scene.add(result);
       this.setupAllCategories();
     });
     const byteFile = await this.getAsByteArray(file);


     console.log(byteFile);
     this.modelIDIfcFile = this.ifcAPI.OpenModel(byteFile);
     let isModelOpened = this.ifcAPI.IsModelOpen(this.modelIDIfcFile);
     console.log({isModelOpened});
     console.log(this.modelIDIfcFile);
   }

  async getAsByteArray(file: any) {
    return new Uint8Array(await this.readFile(file));
  }

  readFile(file: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // Create file reader
      let reader = new FileReader()

      // Register event listeners
      reader.addEventListener("loadend", e => resolve(e.target?.result))
      reader.addEventListener("error", reject)

      // Read file
      reader.readAsArrayBuffer(file)
    })
  }

    setupAnimation = () => {
      // this.stats.begin();
      this.controls?.update();
      this.renderer?.render(this.scene, this.camera);
      // this.stats.end();
      requestAnimationFrame(this.setupAnimation);
    }

  cast(event: MouseEvent): any {
    const raycaster = new Raycaster();
    raycaster.firstHitOnly = true;
    const mouse = new Vector2();
    const bounds = this.canvasIFC.nativeElement.getBoundingClientRect();

    const x1 = event.clientX - bounds.left;
    const x2 = bounds.right - bounds.left;
    mouse.x = (x1 / x2) * 2 - 1;

    const y1 = event.clientY - bounds.top;
    const y2 = bounds.bottom - bounds.top;
    mouse.y = -(y1 / y2) * 2 + 1;

    // Places it on the camera pointing to the mouse
    raycaster.setFromCamera(mouse, this.camera);

    // Casts a ray
    return raycaster.intersectObjects(this.ifcModels);
  }

    showId(event: MouseEvent) {
      const found = this.cast(event)[0];

      if (found) {
        const index = found.faceIndex;
        const geometry = found.object.geometry;
        const ifc = this.ifcLoader.ifcManager;
        if (index !== null) {
          this.id = ifc.getExpressId(geometry, index);
        } else {
          this.id = null;
        }
      }
    }

  highlight(event: MouseEvent) {
    const ifc = this.ifcLoader.ifcManager;
    const found = this.cast(event)[0];

    if (found) {
      this.preselectModel.id = found.object.modelID;
      const index = found.faceIndex;
      const geometry = found.object.geometry;
      const id = ifc.getExpressId(geometry, index);

      this.ifcLoader.ifcManager.createSubset({
        modelID: this.preselectModel.id,
        ids: [id],
        material: this.preselectMat,
        scene: this.scene,
        removePrevious: true,
      });
    } else {
      ifc.removeSubset(this.preselectModel.id, this.preselectMat);
    }
  }

  async pick(event: MouseEvent) {
    const found = this.cast(event)[0];
    this.tree = await this.ifcLoader.ifcManager.getSpatialStructure(found?.object.modelID);
    console.log(this.tree);

    if (found) {
      const index = found.faceIndex;
      const geometry = found.object.geometry;
      const ifc = this.ifcLoader.ifcManager;
      this.expressId = ifc.getExpressId(geometry, index);
      const modelID = found.object.modelID;
      const props = await ifc.getItemProperties(modelID, this.expressId, true);
      this.objectScane = JSON.stringify(props, null, 4);
    }
  }

  getName(category: string): string | undefined {
    const names = Object.keys(this.categories);
    return names.find((name) => (this.categories as any)[name] === category);
  }

  getAll(category: any) {
    const manager = this.ifcLoader.ifcManager;
    return manager.getAllItemsOfType(0, category, false);
  }

  async newSubsetOfType(category: any) {
    const ids = await this.getAll(category);
    return this.ifcLoader.ifcManager.createSubset({
      modelID: 0,
      scene: this.scene,
      ids,
      removePrevious: true,
      customID: category.toString(),
    });
  }

  async setupAllCategories() {
    const allCategories = Object.values(this.categories);
    for (let i = 0; i < allCategories.length; i++) {
      const category = allCategories[i];
      await this.setupCategory(category);
    }
  }

  async setupCategory(category: number) {
    this.subsets[category] = await this.newSubsetOfType(category);
  }

  onChangeCheckbox(event: Event, type: string) {
    const category: number = this.categories[type];

    if (category) {
      const checked = (event.target as HTMLInputElement)?.checked;
      const subset = this.subsets[category];

      if (checked) {
        this.scene.add(subset);
      } else {
        subset.removeFromParent();
      }
    }
  }

  hideElement() {
    if (this.currentHideElement.children.length === 0) {
      this.ifcLoader.ifcManager.removeFromSubset(0, [this.currentHideElement.expressID], this.categories[this.currentHideElement.type].toString());
    } else {
      // const currentObj = this.searchTree(this.tree, this.currentHideElement.expressID);
      const ids: number[] = this.currentHideElement.children.map((item: any) => item.expressID);
      this.ifcLoader.ifcManager.removeFromSubset(0, ids, this.categories[this.currentHideElement.children[0].type].toString());
      this.ifcLoader.ifcManager.removeFromSubset(0, [this.currentHideElement.expressID], this.categories[this.currentHideElement.type].toString());
    }
  }

  revertHideElement() {
    if (this.currentRevertHideElement.children.length === 0) {
      this.ifcLoader.ifcManager.createSubset({
        scene: this.scene,
        modelID: 0,
        removePrevious: false,
        customID: this.categories[this.currentRevertHideElement.type].toString(),
        ids: [this.currentRevertHideElement.expressID],
      });
    } else {
      const ids: number[] = this.currentRevertHideElement.children.map((item: any) => item.expressID);

      this.ifcLoader.ifcManager.createSubset({
        scene: this.scene,
        modelID: 0,
        removePrevious: false,
        customID: this.categories[this.currentRevertHideElement.children[0].type].toString(),
        ids,
      });

      this.ifcLoader.ifcManager.createSubset({
        scene: this.scene,
        modelID: 0,
        removePrevious: false,
        customID: this.categories[this.currentRevertHideElement.type].toString(),
        ids: [this.currentRevertHideElement.expressID],
      });
    }
  }

  getFov = () => {
    return Math.floor(
      (2 *
        Math.atan((this.camera.getFilmHeight() / 2) / this.camera.getFocalLength()) * 180) / Math.PI
    );
  };

  getZoom(value: number, zoomType: string) {
      if (zoomType === "plus") {
        return value <= 4 ? 0 : value - 5;
      } else if (zoomType === "minus") {
        return value + 5;
      } else {
        return value;
      }
  }

  increaseZoom(typeZoom: string) {
    const fov = this.getFov();
    this.camera.fov = this.getZoom(fov, typeZoom);
    this.camera.updateProjectionMatrix();
  }

  searchTree(element: any, findElId: number) {
    let result = null;

    if (element.expressID === findElId) {
      result = element;
    } else if (element.children) {
      element.children.some((item: any) => {
        result = this.searchTree(item, findElId);
        return result;
      });
    }

    return result;
  }

  getIfcFile(url: any) {
    return new Promise((resolve, reject) => {
      const oReq = new XMLHttpRequest();
      oReq.responseType = "arraybuffer";
      oReq.addEventListener("load", () => {
        resolve(new Uint8Array(oReq.response));
      });
      oReq.open("GET", url);
      oReq.send();
    });
  }

  saveModel() {
    console.log(this.ifcAPI.GetModelSchema(0));
    const data = this.ifcAPI.SaveModel(this.modelIDIfcFile);
    const blob = new Blob([data]);
    const file = new File([blob], "modified.ifc");
    this.fileUrl = URL.createObjectURL(file);
    //
    // const link = document.createElement("a");
    // link.innerText = "Download";
    // link.download = "modified.ifc";
    // link.setAttribute("href", url);
    //
    // document.body.appendChild(link);
  }
}
