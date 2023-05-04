import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Node} from "../board-for-ifc/board-for-ifc.component";
import {BehaviorSubject} from "rxjs";
import {SubscribeService} from "../subscribe.service";

@Component({
  selector: 'tree-node',
  templateUrl: './tree-node.component.html',
  styleUrls: ['./tree-node.component.scss']
})
export class TreeNodeComponent {

  @Input() tree: Node | null;

  constructor(private subscribeService: SubscribeService,) {
  }

  hideElement() {
    this.subscribeService.hide$.next(this.tree);
  }

  removeHideElement() {
    this.subscribeService.removeHide$.next(this.tree);
  }
}
